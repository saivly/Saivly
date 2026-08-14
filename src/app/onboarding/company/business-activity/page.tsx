import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { companyCountryCurrency } from "@/lib/onboarding/countries";
import { getKvkCompanyDetails } from "@/lib/onboarding/kvk";
import {
  isHomeownersAssociation,
  HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE,
} from "@/lib/adyen/legalEntity";
import BusinessActivityForm from "./business-activity-form";

export default async function BusinessActivityStep({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  // Nothing to ask about yet — this screen is the second half of the
  // company step, reachable only after saveCompanyInfo has created the
  // organisation row (see company/actions.ts).
  if (!membership) redirect("/onboarding/company");

  const { data: org } = await supabase
    .from("organisations")
    .select(
      "name, country, kvk_number, industry_code, vat_number, support_email, support_phone, annual_reserve_fund_contributions, annual_reserve_fund_currency, website"
    )
    .eq("id", membership.organisation_id)
    .maybeSingle();

  if (!org) redirect("/onboarding/company");

  // Same re-fetch-from-KVK-rather-than-trust-a-stored-guess pattern as
  // saveBusinessActivity (see company/actions.ts) — rechtsvorm isn't
  // persisted, and VvE-ness decides whether industry/website/the reserve-
  // fund label below are locked.
  const kvkDetails = org.kvk_number ? await getKvkCompanyDetails(org.kvk_number) : null;
  const isVve = isHomeownersAssociation(kvkDetails?.legalForm);

  // Stored as a true annual figure regardless of org type (see
  // saveBusinessActivity) — VvEs are asked for their *monthly*
  // contribution instead, so it's shown divided back down for them here.
  const storedAmount = org.annual_reserve_fund_contributions;
  const prefillAmount =
    storedAmount == null ? "" : (isVve ? Math.round(storedAmount / 12) : storedAmount).toString();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Business activity
        </h1>
        <p className="mt-2 text-sm text-muted">
          Step 2 of 4 — a few more details about {org.name}.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <BusinessActivityForm
        isVve={isVve}
        existing={{
          companyCountry: org.country,
          industryCode: isVve ? HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE : org.industry_code ?? "",
          reserveFundCurrency:
            org.annual_reserve_fund_currency ?? companyCountryCurrency(org.country),
          annualReserveFundContributions: prefillAmount,
          supportEmail: org.support_email ?? "",
          supportPhone: org.support_phone ?? "",
          vatNumber: org.vat_number ?? "",
          website: isVve ? "" : org.website ?? "",
        }}
      />
    </div>
  );
}
