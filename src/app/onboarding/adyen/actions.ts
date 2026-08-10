"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding";
import { createAdyenOnboardingLink } from "@/lib/adyen/legalEntity";

/**
 * Mints a fresh Adyen-hosted onboarding link (expires in 4 minutes — see
 * legalEntity.ts) and sends the shopper's browser there directly. They
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("adyen_legal_entity_id")
    .eq("id", user.id)
    .maybeSingle();

  const legalEntityId = profile?.adyen_legal_entity_id;
  if (!legalEntityId) {
    // Shouldn't happen — personalDone requires this to be set — but the
    // link creation call below needs an id to call, so guard it anyway.
    redirect(
      `/onboarding/adyen?error=${encodeURIComponent(
        "We couldn't find your identity verification record. Go back to Personal info and save it again, then retry."
      )}`
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
