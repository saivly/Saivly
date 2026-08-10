import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * redirectUrl target for the Adyen-hosted onboarding link (see
 * ../actions.ts). Adyen sends the shopper's browser here with a plain GET
 * once they finish (or leave) the hosted flow — no query params to trust,
 * so this only records "they went through the redirect", not any result
 * Adyen reports (that arrives separately, via webhook, once that's wired
 * up). /onboarding then re-evaluates and routes to whatever's next.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from("profiles")
      .update({ adyen_onboarding_completed_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
