import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { getKvkCompanyDetails } from "@/lib/onboarding/kvk";
import { isHomeownersAssociation } from "@/lib/adyen/legalEntity";
import ContactDetailsForm from "./contact-details-form";
import { getT } from "@/lib/i18n-server";

export default async function ContactDetailsStep({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getT();

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

  // Nothing to ask about yet — this screen is the fourth (final) page of
  // the company step, reachable only after saveCompanyInfo has created
  // the organisation row (see company/actions.ts).
  if (!membership) redirect("/onboarding/company");

  const { data: org } = await supabase
    .from("organisations")
    .select("name, country, kvk_number, industry_code, support_email, support_phone, website")
    .eq("id", membership.organisation_id)
    .maybeSingle();

  if (!org) redirect("/onboarding/company");

  // industry_code is only ever set by saveBusinessActivity — its absence
  // means that page hasn't been submitted yet, same "second half can't
  // come before the first" logic as business-activity/page.tsx's own
  // membership guard above.
  if (!org.industry_code) redirect("/onboarding/company/business-activity");

  // Same re-fetch-from-KVK-rather-than-trust-a-stored-guess pattern as
  // saveContactDetails (see company/actions.ts) — rechtsvorm isn't
  // persisted, and VvE-ness decides whether website is locked.
  const kvkDetails = org.kvk_number ? await getKvkCompanyDetails(org.kvk_number) : null;
  const isVve = isHomeownersAssociation(kvkDetails?.legalForm);

  // Homeowners' associations have no separate support contact to ask
  // about — they just use the owner's own email/phone, already on file
  // from the personal-info step.
  const ownerPhone = isVve
    ? (
        await supabase
          .from("profiles")
          .select("phone_number")
          .eq("id", user.id)
          .maybeSingle()
      ).data?.phone_number ?? ""
    : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">
          {t("Contact details")}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {t("Step 2 of 4 — how customers and Adyen can reach {name}.", { name: org.name })}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {t(error)}
        </p>
      )}

      <ContactDetailsForm
        isVve={isVve}
        existing={{
          companyCountry: org.country,
          website: isVve ? "" : org.website ?? "",
          // Homeowners' associations don't have a separate support
          // contact to ask about — prefill with the owner's own details
          // (already on file from personal-info) so there's nothing left
          // to type, just something to check and confirm with Continue.
          // Not locked server-side (see saveContactDetails) — editable
          // like any other org's, this is only ever the starting value.
          supportEmail: isVve ? user.email ?? "" : org.support_email ?? "",
          supportPhone: isVve ? ownerPhone : org.support_phone ?? "",
        }}
      />
    </div>
  );
}
