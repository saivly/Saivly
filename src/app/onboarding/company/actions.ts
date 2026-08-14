"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { companyInfoSchema, businessActivitySchema } from "@/lib/zod";
import {
  searchKvkCompanies,
  getKvkCompanyDetails,
  type KvkSearchResult,
  type KvkCompanyDetails,
} from "@/lib/onboarding/kvk";
import {
  createAdyenOrganization,
  createAdyenBusinessLine,
  isHomeownersAssociation,
  HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE,
  sourceOfFundsDescription,
  type AdyenEntityRelationshipType,
} from "@/lib/adyen/legalEntity";
import { createAdyenAccountHolder, createAdyenBalanceAccount } from "@/lib/adyen/balancePlatform";

/**
 * Thin RPC wrappers so the client form (company-form.tsx) can call the KVK
 * API without KVK_API_KEY ever reaching the browser — src/lib/kvk.ts is
 * server-only, these "use server" exports are the only door into it.
 */
export async function searchKvk(query: string): Promise<KvkSearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return searchKvkCompanies(query);
}

export async function getKvkDetails(
  kvkNumber: string
): Promise<KvkCompanyDetails | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getKvkCompanyDetails(kvkNumber);
}

/** The organisation this user belongs to, if any (see src/lib/onboarding.ts). */
async function getOwnOrganisationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.organisation_id ?? null;
}

type AdyenChainResult = { ok: true } | { ok: false; error: string };

// "all" is a form-only sentinel (see ENTITY_RELATIONSHIP_TYPES in
// lib/zod.ts) — companyInfoSchema accepts it as a valid relationshipType
// value, but Adyen has no such value, so it's expanded back out into the
// three real ones here, right before it reaches createAdyenOrganization.
const ALL_RELATIONSHIP_TYPES: AdyenEntityRelationshipType[] = [
  "signatory",
  "uboThroughOwnership",
  "uboThroughControl",
];

function expandRelationshipTypes(value: string): AdyenEntityRelationshipType[] {
  return value === "all"
    ? ALL_RELATIONSHIP_TYPES
    : [value as AdyenEntityRelationshipType];
}

/**
 * Organisation legal entity -> account holder -> balance account ->
 * business lines (paymentProcessing, banking, issuing), in that order,
 * with each id persisted the moment it's created — not batched at the
 * end. That makes a retry after a partial failure resume from wherever
 * it actually stopped instead of creating a duplicate organization legal
 * entity in Adyen every time the shopper hits Continue again.
 * company_completed_at is only stamped once all six ids are in place
 * (freshly created or found already there on resume).
 *
 * Called from saveBusinessActivity below (the second of the "Organisation
 * info" step's two pages) — legalEntityId's compliance-facing fields
 * (industry/reserve-fund/etc.) aren't known until that page, so this
 * can't run any earlier than that.
 */
async function ensureAdyenOrganisationReady(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organisationId: string,
  individualLegalEntityId: string,
  company: {
    legalName: string;
    rechtsvorm: string | null;
    registrationNumber: string;
    country: string;
    street: string;
    postalCode: string;
    city: string;
    relationshipTypes: AdyenEntityRelationshipType[];
    rsin: string | null;
    dateOfIncorporation: string | null;
    annualReserveFundContributions: number;
    reserveFundCurrency: string;
    industryCode: string;
    website: string | null;
  }
): Promise<AdyenChainResult> {
  const { data: org, error: readError } = await supabase
    .from("organisations")
    .select(
      "adyen_organization_legal_entity_id, adyen_account_holder_id, adyen_balance_account_id, adyen_business_line_payment_processing_id, adyen_business_line_banking_id, adyen_business_line_issuing_id"
    )
    .eq("id", organisationId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }

  let organizationLegalEntityId = org?.adyen_organization_legal_entity_id ?? null;
  let accountHolderId = org?.adyen_account_holder_id ?? null;
  let balanceAccountId = org?.adyen_balance_account_id ?? null;
  let paymentProcessingBusinessLineId =
    org?.adyen_business_line_payment_processing_id ?? null;
  let bankingBusinessLineId = org?.adyen_business_line_banking_id ?? null;
  let issuingBusinessLineId = org?.adyen_business_line_issuing_id ?? null;

  if (!organizationLegalEntityId) {
    organizationLegalEntityId = await createAdyenOrganization({
      legalName: company.legalName,
      rechtsvorm: company.rechtsvorm,
      registrationNumber: company.registrationNumber,
      countryOfGoverningLaw: company.country,
      registeredAddress: {
        street: company.street,
        city: company.city,
        postalCode: company.postalCode,
        country: company.country,
      },
      associatedIndividualLegalEntityId: individualLegalEntityId,
      relationshipTypes: company.relationshipTypes,
      rsin: company.rsin,
      dateOfIncorporation: company.dateOfIncorporation,
      annualReserveFundContributions: company.annualReserveFundContributions,
      reserveFundCurrency: company.reserveFundCurrency,
    });
    if (!organizationLegalEntityId) {
      return {
        ok: false,
        error:
          "We couldn't register your organisation with our payment provider. Please try again.",
      };
    }
    const { error } = await supabase
      .from("organisations")
      .update({ adyen_organization_legal_entity_id: organizationLegalEntityId })
      .eq("id", organisationId);
    if (error) return { ok: false, error: error.message };
  }

  if (!accountHolderId) {
    accountHolderId = await createAdyenAccountHolder(organizationLegalEntityId, company.legalName);
    if (!accountHolderId) {
      return {
        ok: false,
        error:
          "Your organisation was registered, but we couldn't set up its payout account. Please try again.",
      };
    }
    const { error } = await supabase
      .from("organisations")
      .update({ adyen_account_holder_id: accountHolderId })
      .eq("id", organisationId);
    if (error) return { ok: false, error: error.message };
  }

  if (!balanceAccountId) {
    balanceAccountId = await createAdyenBalanceAccount(accountHolderId, company.legalName);
    if (!balanceAccountId) {
      return {
        ok: false,
        error:
          "Your organisation's payout account was created, but we couldn't finish setting it up. Please try again.",
      };
    }
    const { error } = await supabase
      .from("organisations")
      .update({ adyen_balance_account_id: balanceAccountId })
      .eq("id", organisationId);
    if (error) return { ok: false, error: error.message };
  }

  if (!paymentProcessingBusinessLineId) {
    paymentProcessingBusinessLineId = await createAdyenBusinessLine(
      organizationLegalEntityId,
      "paymentProcessing",
      company.industryCode,
      company.website
    );
    if (!paymentProcessingBusinessLineId) {
      return {
        ok: false,
        error:
          "Your organisation's payout account was set up, but we couldn't finish registering it for payments. Please try again.",
      };
    }
    const { error } = await supabase
      .from("organisations")
      .update({ adyen_business_line_payment_processing_id: paymentProcessingBusinessLineId })
      .eq("id", organisationId);
    if (error) return { ok: false, error: error.message };
  }

  // Only VvEs (the common case here) get the reserve-fund-specific
  // description — every other org falls back to a generic one (see
  // sourceOfFundsDescription in src/lib/adyen/legalEntity.ts).
  const sourceOfFundsBusiness = {
    annualAmount: company.annualReserveFundContributions,
    currency: company.reserveFundCurrency,
    description: sourceOfFundsDescription(company.rechtsvorm),
  };

  if (!bankingBusinessLineId) {
    bankingBusinessLineId = await createAdyenBusinessLine(
      organizationLegalEntityId,
      "banking",
      company.industryCode,
      company.website,
      sourceOfFundsBusiness
    );
    if (!bankingBusinessLineId) {
      return {
        ok: false,
        error:
          "Your organisation's payout account was set up, but we couldn't finish registering it for banking. Please try again.",
      };
    }
    const { error } = await supabase
      .from("organisations")
      .update({ adyen_business_line_banking_id: bankingBusinessLineId })
      .eq("id", organisationId);
    if (error) return { ok: false, error: error.message };
  }

  if (!issuingBusinessLineId) {
    issuingBusinessLineId = await createAdyenBusinessLine(
      organizationLegalEntityId,
      "issuing",
      company.industryCode,
      company.website,
      sourceOfFundsBusiness
    );
    if (!issuingBusinessLineId) {
      return {
        ok: false,
        error:
          "Your organisation's payout account was set up, but we couldn't finish registering it for card issuing. Please try again.",
      };
    }
    const { error } = await supabase
      .from("organisations")
      .update({ adyen_business_line_issuing_id: issuingBusinessLineId })
      .eq("id", organisationId);
    if (error) return { ok: false, error: error.message };
  }

  // All six in place (whichever were just created vs. already there from
  // an earlier partial attempt) — the company step is now done.
  const { error: completedError } = await supabase
    .from("organisations")
    .update({ company_completed_at: new Date().toISOString() })
    .eq("id", organisationId);
  if (completedError) return { ok: false, error: completedError.message };

  return { ok: true };
}

/**
 * First half of the "Organisation info" step's company page: KVK lookup
 * (or manual entry outside NL) + relationship-to-the-company, persisted
 * as soon as they're submitted. Deliberately does nothing Adyen-facing —
 * that all happens once industry/reserve-fund/support-contact/VAT are
 * gathered too, on the business-activity screen this redirects to (see
 * saveBusinessActivity below), so a shopper who never gets that far
 * hasn't left a half-registered legal entity behind in Adyen.
 */
export async function saveCompanyInfo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sequential lock, enforced server-side too — not just by hiding the link.
  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");

  const parsed = companyInfoSchema.safeParse({
    companyCountry: (formData.get("companyCountry") as string) ?? "",
    relationshipType: (formData.get("relationshipType") as string) ?? "",
    kvkNumber: ((formData.get("kvkNumber") as string) ?? "").trim(),
    companyName: ((formData.get("companyName") as string) ?? "").trim(),
    companyStreet: ((formData.get("companyStreet") as string) ?? "").trim(),
    companyPostalCode: (
      (formData.get("companyPostalCode") as string) ?? ""
    ).trim(),
    companyCity: ((formData.get("companyCity") as string) ?? "").trim(),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/onboarding/company?error=${encodeURIComponent(message)}`);
  }

  const {
    companyCountry,
    relationshipType,
    kvkNumber,
    companyName,
    companyStreet,
    companyPostalCode,
    companyCity,
  } = parsed.data;

  const orgFields = {
    name: companyName,
    country: companyCountry,
    relationship_type: relationshipType,
    kvk_number: kvkNumber || null,
    street: companyStreet,
    postal_code: companyPostalCode,
    city: companyCity,
  };

  const existingOrgId = await getOwnOrganisationId(supabase, user.id);

  if (existingOrgId) {
    const { error } = await supabase
      .from("organisations")
      .update(orgFields)
      .eq("id", existingOrgId);
    if (error) {
      redirect(
        `/onboarding/company?error=${encodeURIComponent(error.message)}`
      );
    }
  } else {
    // First time through — create the org, then join it as owner.
    // The id is generated here (rather than left to the DB default +
    // read back via `.select()`) so we never need a SELECT against a row
    // the user isn't a member of yet — organisations_insert_any allows
    // the insert itself regardless, but there's no reason to rely on
    // RETURNING being exempt from the table's SELECT policy when we can
    // just... not need it.
    const organisationId = crypto.randomUUID();

    const { error: orgError } = await supabase
      .from("organisations")
      .insert({ id: organisationId, ...orgFields });
    if (orgError) {
      redirect(
        `/onboarding/company?error=${encodeURIComponent(orgError.message)}`
      );
    }

    const { error: memberError } = await supabase
      .from("organisation_members")
      .insert({ organisation_id: organisationId, user_id: user.id, role: "owner" });
    if (memberError) {
      redirect(
        `/onboarding/company?error=${encodeURIComponent(memberError.message)}`
      );
    }
  }

  // See personal/actions.ts for why this is needed on every step's
  // completion redirect, not just this one.
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/company/business-activity");
}

/**
 * Second half of the "Organisation info" step: industry, the reserve-fund
 * estimate (amount + currency), support contact details, VAT number, and
 * website — then the whole organisation-legal-entity/account-holder/
 * balance-account/business-line chain in Adyen (ensureAdyenOrganisationReady
 * above), using these answers together with whatever saveCompanyInfo
 * already persisted.
 */
export async function saveBusinessActivity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");

  const organisationId = await getOwnOrganisationId(supabase, user.id);
  if (!organisationId) redirect("/onboarding/company");

  const { data: org, error: orgReadError } = await supabase
    .from("organisations")
    .select(
      "name, country, relationship_type, kvk_number, street, postal_code, city, adyen_organization_legal_entity_id, adyen_account_holder_id, adyen_balance_account_id, adyen_business_line_payment_processing_id, adyen_business_line_banking_id, adyen_business_line_issuing_id"
    )
    .eq("id", organisationId)
    .maybeSingle();

  if (orgReadError || !org) {
    redirect(
      `/onboarding/company?error=${encodeURIComponent(
        orgReadError?.message ?? "We couldn't find your organisation. Please start again."
      )}`
    );
  }

  // Shouldn't happen — saveCompanyInfo always sets this before this page
  // is ever reachable — but the Adyen chain below needs a real value.
  if (!org.relationship_type) {
    redirect("/onboarding/company");
  }

  // KVK's "statutaire naam" (formal registered name), rechtsvorm (legal
  // form), RSIN (Dutch tax/legal-entity id), and date of incorporation
  // feed Adyen's organization.legalName/type/taxInformation/
  // dateOfIncorporation — re-fetched here from the kvkNumber rather than
  // trusted from the submitted form, since these go straight into a
  // compliance-facing API call. Outside NL there's no KVK register to
  // check, so the saved company name stands in for legalName and the
  // rest stay null (mapRechtsvormToOrganizationType's fallback:
  // privateCompany; no RSIN/incorporation date outside NL). Done up
  // front (not just inside the Adyen-chain branch below) because
  // rechtsvorm also decides whether this is a VvE — which locks several
  // of the fields being saved to organisations just below.
  let legalName = org.name;
  let rechtsvorm: string | null = null;
  let rsin: string | null = null;
  let dateOfIncorporation: string | null = null;
  if (org.kvk_number) {
    const kvkDetails = await getKvkCompanyDetails(org.kvk_number);
    if (kvkDetails) {
      legalName = kvkDetails.statutoryName ?? org.name;
      rechtsvorm = kvkDetails.legalForm;
      rsin = kvkDetails.rsin;
      dateOfIncorporation = kvkDetails.dateOfIncorporation;
    }
  }
  const isVve = isHomeownersAssociation(rechtsvorm);

  const parsed = businessActivitySchema.safeParse({
    industryCode: (formData.get("industryCode") as string) ?? "",
    reserveFundCurrency: (formData.get("reserveFundCurrency") as string) ?? "",
    annualReserveFundContributions:
      (formData.get("annualReserveFundContributions") as string) ?? "",
    supportEmail: ((formData.get("supportEmail") as string) ?? "").trim(),
    supportPhone: ((formData.get("supportPhone") as string) ?? "").trim(),
    vatNumber: ((formData.get("vatNumber") as string) ?? "").trim(),
    website: ((formData.get("website") as string) ?? "").trim(),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(
      `/onboarding/company/business-activity?error=${encodeURIComponent(message)}`
    );
  }

  const {
    industryCode: submittedIndustryCode,
    reserveFundCurrency,
    annualReserveFundContributions: enteredReserveFundAmount,
    supportEmail,
    supportPhone,
    vatNumber,
    website: submittedWebsite,
  } = parsed.data;

  // VvEs get a few fields locked server-side, not just disabled in the
  // form — a shopper can't override them by tampering with the request.
  const industryCode = isVve ? HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE : submittedIndustryCode;
  const website = isVve ? null : submittedWebsite || null;
  // VvEs are asked for their *monthly* contribution (see the "Expected
  // Monthly contribution for this account" label in business-activity-
  // form.tsx) — Adyen's annualTurnover/sourceOfFunds.amount both want a
  // true annual figure, so it's annualised here before going anywhere
  // near either. Everyone else's figure is already annual.
  const annualReserveFundContributions = isVve
    ? enteredReserveFundAmount * 12
    : enteredReserveFundAmount;

  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      industry_code: industryCode,
      annual_reserve_fund_currency: reserveFundCurrency,
      annual_reserve_fund_contributions: annualReserveFundContributions,
      support_email: supportEmail,
      support_phone: supportPhone,
      vat_number: vatNumber || null,
      website,
    })
    .eq("id", organisationId);
  if (updateError) {
    redirect(
      `/onboarding/company/business-activity?error=${encodeURIComponent(updateError.message)}`
    );
  }

  // Already fully set up in Adyen — an edit to an already-completed
  // company step shouldn't re-run entity/account-holder/balance-account/
  // business-line creation (that would mint duplicates in Adyen for every
  // re-save). Checks all six ids, not just the first three: an org that
  // has the legal entity/account holder/balance account but not yet its
  // business lines (e.g. it onboarded before business lines existed)
  // must still fall through to ensureAdyenOrganisationReady below so it
  // can pick up wherever it actually left off.
  const alreadyAdyenReady = Boolean(
    org.adyen_organization_legal_entity_id &&
      org.adyen_account_holder_id &&
      org.adyen_balance_account_id &&
      org.adyen_business_line_payment_processing_id &&
      org.adyen_business_line_banking_id &&
      org.adyen_business_line_issuing_id
  );

  if (!alreadyAdyenReady) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("adyen_legal_entity_id")
      .eq("id", user.id)
      .maybeSingle();

    const individualLegalEntityId = profile?.adyen_legal_entity_id;
    if (!individualLegalEntityId) {
      // Shouldn't happen — personalDone requires this — but the org
      // legal entity's entityAssociations needs an id to point at.
      redirect(
        `/onboarding/company/business-activity?error=${encodeURIComponent(
          "We couldn't find your identity verification record. Go back to Personal info and save it again, then retry."
        )}`
      );
    }

    const result = await ensureAdyenOrganisationReady(
      supabase,
      organisationId,
      individualLegalEntityId,
      {
        legalName,
        rechtsvorm,
        registrationNumber: org.kvk_number ?? "",
        country: org.country,
        street: org.street ?? "",
        postalCode: org.postal_code ?? "",
        city: org.city ?? "",
        // "all" expands to all three real Adyen values — one
        // entityAssociation gets created per entry (see
        // createAdyenOrganization), each with its own type standing in
        // for its own jobTitle too.
        relationshipTypes: expandRelationshipTypes(org.relationship_type),
        rsin,
        dateOfIncorporation,
        annualReserveFundContributions,
        reserveFundCurrency,
        industryCode,
        website,
      }
    );

    if (!result.ok) {
      redirect(
        `/onboarding/company/business-activity?error=${encodeURIComponent(result.error)}`
      );
    }
  }

  // See personal/actions.ts for why this is needed on every step's
  // completion redirect, not just this one.
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/adyen");
}
