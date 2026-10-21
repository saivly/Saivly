import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { createClient } from "@/lib/supabase/server";
import { getKvkCompanyDetails } from "@/lib/onboarding/kvk";
import {
  createAdyenOrganization,
  createAdyenBusinessLine,
  isHomeownersAssociation,
  sourceOfFundsDescription,
  type AdyenEntityRelationshipType,
} from "@/lib/adyen/legalEntity";
import { createAdyenAccountHolder, createAdyenBalanceAccount } from "@/lib/adyen/balancePlatform";
import { contactDetailsSchema } from "@/lib/zod";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type AdyenChainResult = { ok: true } | { ok: false; error: string };

// organisations.relationship_type (migration 0012) is a single text
// column holding however many of the three Adyen relationship values
// apply, comma-joined by saveCompanyInfo (see company-form.tsx's
// checkboxes) — split back out here, right before it reaches
// createAdyenOrganization. "all" is a pre-checkbox sentinel meaning "all
// three" (back when this was a single-select dropdown) — kept only so an
// organisation saved under that older shape still expands correctly.
const ALL_RELATIONSHIP_TYPES: AdyenEntityRelationshipType[] = [
  "signatory",
  "uboThroughOwnership",
  "uboThroughControl",
];

function expandRelationshipTypes(value: string): AdyenEntityRelationshipType[] {
  if (value === "all") return ALL_RELATIONSHIP_TYPES;
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean) as AdyenEntityRelationshipType[];
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
 * Called from finishContactDetails below — legalEntityId's compliance-
 * facing fields (industry/reserve-fund/etc., gathered on the business-
 * activity page) plus support contact details both have to be known
 * before this can run.
 */
async function ensureAdyenOrganisationReady(
  supabase: SupabaseClient,
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
    supportEmail: string;
    supportPhone: string;
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
      supportEmail: company.supportEmail,
      supportPhone: company.supportPhone,
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
 * Fourth (final) page of the "Organisation info" step: support contact
 * details and website — then the whole organisation-legal-entity/
 * account-holder/balance-account/business-line chain in Adyen
 * (ensureAdyenOrganisationReady above), using these answers together with
 * whatever saveCompanyInfo/saveBusinessActivity already persisted.
 *
 * Shared by two callers: saveContactDetails (company/actions.ts), the
 * normal form submission, and contact-details/page.tsx's homeowners'-
 * association auto-skip, which calls this directly with the owner's own
 * email/phone instead of rendering the form at all — a VvE has no
 * separate support contact to ask about. Both end in a redirect (never
 * return normally) — on success to /onboarding/adyen, on failure back to
 * this step's own URL with ?error=, which is also what makes the auto-
 * skip caller safe to retry: it only ever attempts this once per visit
 * (gated on !error), falling back to the ordinary form, pre-filled, with
 * that error shown, rather than redirecting to itself forever.
 */
export async function finishContactDetails(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  organisationId: string,
  rawInput: { website: string; supportEmail: string; supportPhone: string }
) {
  const { data: org, error: orgReadError } = await supabase
    .from("organisations")
    .select(
      "name, country, relationship_type, kvk_number, street, postal_code, city, industry_code, annual_reserve_fund_currency, annual_reserve_fund_contributions, adyen_organization_legal_entity_id, adyen_account_holder_id, adyen_balance_account_id, adyen_business_line_payment_processing_id, adyen_business_line_banking_id, adyen_business_line_issuing_id"
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
  // Shouldn't happen either — saveBusinessActivity always sets these
  // before this page is ever reachable (see its own page.tsx guard) —
  // but the Adyen chain below needs real values for all three.
  if (
    !org.industry_code ||
    org.annual_reserve_fund_currency == null ||
    org.annual_reserve_fund_contributions == null
  ) {
    redirect("/onboarding/company/business-activity");
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
  // rechtsvorm also decides whether this is a VvE — which locks website
  // just below.
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

  const parsed = contactDetailsSchema.safeParse(rawInput);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(
      `/onboarding/company/contact-details?error=${encodeURIComponent(message)}`
    );
  }

  const { website: submittedWebsite, supportEmail, supportPhone } = parsed.data;

  // VvEs get website locked server-side, not just disabled in the form —
  // a shopper can't override it by tampering with the request.
  const website = isVve ? null : submittedWebsite || null;

  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      website,
      support_email: supportEmail,
      support_phone: supportPhone,
    })
    .eq("id", organisationId);
  if (updateError) {
    redirect(
      `/onboarding/company/contact-details?error=${encodeURIComponent(updateError.message)}`
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
        `/onboarding/company/contact-details?error=${encodeURIComponent(
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
        annualReserveFundContributions: org.annual_reserve_fund_contributions,
        reserveFundCurrency: org.annual_reserve_fund_currency,
        industryCode: org.industry_code,
        website,
        supportEmail,
        supportPhone,
      }
    );

    if (!result.ok) {
      redirect(
        `/onboarding/company/contact-details?error=${encodeURIComponent(result.error)}`
      );
    }
  }

  // See personal/actions.ts for why this is needed on every step's
  // completion redirect, not just this one.
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/adyen");
}
