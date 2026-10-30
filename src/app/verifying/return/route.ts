import { NextResponse } from "next/server";
import { createAdyenOnboardingLink } from "@/lib/adyen/legalEntity";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Adyen sends the shopper after re-doing the organisation's hosted
 * onboarding (see ../actions.ts). Chains into the shopper's own
 * individual onboarding — that's verified separately, and a problem can
 * sit on either one — which then returns to /verifying.
 */
export async function GET(request: Request) {
  const back = new URL("/verifying", request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase
    .from("profiles")
    .select("adyen_legal_entity_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.adyen_legal_entity_id) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://saivly.com";
    const url = await createAdyenOnboardingLink(profile.adyen_legal_entity_id, `${siteUrl}/verifying`);
    if (url) return NextResponse.redirect(url);
    console.error("[verifying] couldn't create the individual's onboarding link", profile.adyen_legal_entity_id);
  }
  return NextResponse.redirect(back);
}
