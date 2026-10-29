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
  isHomeownersAssociation,
  HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE,
} from "@/lib/adyen/legalEntity";
import { finishContactDetails } from "./contact-details/finish";
import { companyCountryCurrency } from "@/lib/onboarding/countries";
import { reserveFundEstimate, parseReserveFundAmount } from "@/lib/onboarding/reserve-fund-ranges";

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

/**
 * First of the "Organisation info" step's four pages: KVK lookup (or
 * manual entry outside NL) + relationship-to-the-company, persisted as
 * soon as they're submitted. Deliberately does nothing Adyen-facing —
 * that all happens once industry/reserve-fund/VAT (business-activity)
 * and support-contact/website (contact-details) are gathered too, on the
 * two screens this eventually leads to (see saveBusinessActivity and
 * saveContactDetails below), so a shopper who never gets that far hasn't
 * left a half-registered legal entity behind in Adyen.
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
    // One or more checked checkboxes, all named "relationshipType"
    // (company-form.tsx) — getAll, not get, so every checked value comes
    // through rather than just the first.
    relationshipType: formData.getAll("relationshipType") as string[],
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
    // relationship_type is a single text column (migration 0012) — joined
    // here rather than storing an array, same read-back split in
    // company-form.tsx (parseStoredRelationshipTypes) and
    // contact-details/finish.ts (expandRelationshipTypes).
    relationship_type: relationshipType.join(","),
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
 * Third of the "Organisation info" step's four pages: industry, the
 * reserve-fund estimate (amount + currency), VAT number, and a short
 * business description — persisted as soon as they're submitted.
 * Deliberately does nothing Adyen-facing, same reasoning as saveCompanyInfo
 * above: that only happens once contact details are gathered too, on the
 * page this redirects to (see saveContactDetails below).
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
    .select("kvk_number, country")
    .eq("id", organisationId)
    .maybeSingle();

  if (orgReadError || !org) {
    redirect(
      `/onboarding/company?error=${encodeURIComponent(
        orgReadError?.message ?? "We couldn't find your organisation. Please start again."
      )}`
    );
  }

  // rechtsvorm isn't persisted — re-fetched here from the kvkNumber the
  // same way saveContactDetails does below, since VvE-ness locks
  // industryCode and changes what the reserve-fund amount means (monthly
  // vs. annual). Outside NL there's no KVK register to check, so this
  // just stays null (never a VvE).
  const kvkDetails = org.kvk_number ? await getKvkCompanyDetails(org.kvk_number) : null;
  const isVve = isHomeownersAssociation(kvkDetails?.legalForm);

  const parsed = businessActivitySchema.safeParse({
    industryCode: (formData.get("industryCode") as string) ?? "",
    reserveFundRange: (formData.get("reserveFundRange") as string) ?? "",
    reserveFundAmount: (formData.get("reserveFundAmount") as string) ?? "",
    vatNumber: ((formData.get("vatNumber") as string) ?? "").trim(),
    vatExemptionReason: ((formData.get("vatExemptionReason") as string) ?? "").trim(),
    businessDescription: ((formData.get("businessDescription") as string) ?? "").trim(),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(
      `/onboarding/company/business-activity?error=${encodeURIComponent(message)}`
    );
  }

  const {
    industryCode: submittedIndustryCode,
    reserveFundRange,
    reserveFundAmount,
    vatNumber,
    vatExemptionReason,
    businessDescription,
  } = parsed.data;

  // VvEs get industry locked server-side, not just disabled in the form —
  // a shopper can't override it by tampering with the request.
  const industryCode = isVve ? HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE : submittedIndustryCode;
  // Currency follows the company's country — not asked on the form.
  const reserveFundCurrency = companyCountryCurrency(org.country);
  // The picked range becomes one representative figure (see
  // reserve-fund-ranges.ts). VvEs are asked per *month* — Adyen's
  // annualTurnover/sourceOfFunds.amount both want a true annual figure,
  // so it's annualised here. Everyone else's figure is already annual.
  // "More than 100,000" comes with the actual figure typed in.
  const enteredReserveFundAmount =
    reserveFundRange === "over100k"
      ? parseReserveFundAmount(reserveFundAmount)
      : reserveFundEstimate(reserveFundRange);
  const annualReserveFundContributions = isVve
    ? enteredReserveFundAmount * 12
    : enteredReserveFundAmount;

  const { error: updateError } = await supabase
    .from("organisations")
    .update({
      industry_code: industryCode,
      annual_reserve_fund_currency: reserveFundCurrency,
      annual_reserve_fund_contributions: annualReserveFundContributions,
      // VvEs get VAT-exemption locked server-side, not just grayed out in
      // the form — a shopper can't override it by tampering with the
      // request, same reasoning as industryCode just above.
      vat_number: isVve ? null : vatNumber || null,
      vat_exemption_reason: isVve ? "industryExemption" : vatExemptionReason || null,
      business_description: businessDescription || null,
    })
    .eq("id", organisationId);
  if (updateError) {
    redirect(
      `/onboarding/company/business-activity?error=${encodeURIComponent(updateError.message)}`
    );
  }

  // See personal/actions.ts for why this is needed on every step's
  // completion redirect, not just this one.
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/company/contact-details");
}

/**
 * Fourth and last of the "Organisation info" step's pages: support
 * contact details and website — then the whole organisation-legal-entity/
 * account-holder/balance-account/business-line chain in Adyen. The actual
 * work lives in finishContactDetails (./contact-details/finish.ts), shared
 * with contact-details/page.tsx's homeowners'-association auto-skip —
 * this just pulls the raw values out of the submitted form.
 */
export async function saveContactDetails(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");

  const organisationId = await getOwnOrganisationId(supabase, user.id);
  if (!organisationId) redirect("/onboarding/company");

  await finishContactDetails(supabase, user, organisationId, {
    website: ((formData.get("website") as string) ?? "").trim(),
    supportEmail: ((formData.get("supportEmail") as string) ?? "").trim(),
    supportPhone: ((formData.get("supportPhone") as string) ?? "").trim(),
  });
}
