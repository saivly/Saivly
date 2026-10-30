"use server";

import { redirect } from "next/navigation";
import { createAdyenOnboardingLink } from "@/lib/adyen/legalEntity";
import { createClient } from "@/lib/supabase/server";

/**
 * Sends the shopper back through Adyen's hosted onboarding when Adyen
 * found something invalid, rejected or missing. Same two legs as the
 * original onboarding (organisation first, then the shopper as a person),
 * but both return to /verifying instead of the onboarding wizard.
 */
export async function startReverification() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saivly.com";
  const url = legalEntityId ? await createAdyenOnboardingLink(legalEntityId, `${siteUrl}/verifying/return`) : null;

  if (!url) {
    redirect(`/verifying?error=${encodeURIComponent("We couldn't open Adyen's verification right now. Try again in a moment.")}`);
  }
  redirect(url);
}
