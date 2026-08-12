import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdyenOnboardingLink } from "@/lib/adyen/legalEntity";

/**
 * redirectUrl target for the *organisation's* Adyen-hosted onboarding link
 * (see ../actions.ts). Adyen sends the shopper's browser here once they
 * finish (or leave) that hosted flow.
 *
 * The organisation's own hosted onboarding does NOT also verify its
 * associated individuals (signatory/UBO) — per Adyen's docs, an
 * associated individual completes their own separate verification, not
 * one bundled into the organization's flow. So rather than marking this
 * step done here, this hop chains into a *second* onboarding link — for
 * the shopper's own individual legal entity (profiles.adyen_legal_entity_id,
 * created in the personal step) — which is where actual identity/ID-scan
 * verification for them as a person happens. Only the individual leg's
 * own return (./individual/route.ts) marks adyen_onboarding_completed_at.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("adyen_legal_entity_id")
    .eq("id", user.id)
    .maybeSingle();

  const individualLegalEntityId = profile?.adyen_legal_entity_id;

  if (individualLegalEntityId) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saivly.com";
    const url = await createAdyenOnboardingLink(
      individualLegalEntityId,
      `${siteUrl}/onboarding/adyen/return/individual`
    );
    if (url) {
      return NextResponse.redirect(url);
    }
    // Couldn't mint the second leg's link (Adyen error, etc.) — don't let
    // that block onboarding entirely. The org's own verification did
    // succeed; fall through and mark the step done anyway, same as
    // before this chain existed. The individual just stays unverified
    // for now — nothing else in the app currently re-offers this leg.
    console.error(
      "[adyen] couldn't create onboarding link for individual legal entity",
      individualLegalEntityId
    );
  } else {
    console.error(
      "[adyen] no individual legal entity id on profile — skipping the individual verification leg",
      user.id
    );
  }

  return NextResponse.redirect(new URL("/onboarding/adyen/return/individual", request.url));
}
