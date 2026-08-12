"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import { createAdyenOnboardingLink } from "@/lib/adyen/legalEntity";

/**
 * Mints a fresh Adyen-hosted onboarding link (expires in 4 minutes — see
 * legalEntity.ts) for the *organisation's* legal entity and sends the
 * shopper's browser there directly. Adyen's hosted flow walks through
 * the org's own KYB requirements plus whatever its associated
 * individual (signatory/UBO, see createAdyenOrganization) still needs —
 * one combined verification, not a separate one per legal entity. They
 * land back at /onboarding/adyen/return once done, which stamps
 * adyen_onboarding_completed_at and bounces them on to the next step.
 */
export async function startAdyenVerification() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sequential lock, enforced server-side too — not just by hiding the link.
  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");
  if (!status.companyDone) redirect("/onboarding/company");

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: org } = membership
    ? await supabase
        .from("organisations")
        .select("adyen_organization_legal_entity_id")
        .eq("id", membership.organisation_id)
        .maybeSingle()
    : { data: null };

  const legalEntityId = org?.adyen_organization_legal_entity_id;
  if (!legalEntityId) {
    // Shouldn't happen — companyDone requires this to be set (see
    // ensureAdyenOrganisationReady in ../company/actions.ts) — but the
    // link creation call below needs an id to call, so guard it anyway.
    redirect(
      `/onboarding/adyen?error=${encodeURIComponent(
        "We couldn't find your organisation's verification record. Go back to Company information and save it again, then retry."
      )}`
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saivly.com";
  const url = await createAdyenOnboardingLink(
    legalEntityId,
    `${siteUrl}/onboarding/adyen/return`
  );

  if (!url) {
    redirect(
      `/onboarding/adyen?error=${encodeURIComponent(
        "We couldn't reach Adyen just now — try again in a moment."
      )}`
    );
  }

  redirect(url);
}
