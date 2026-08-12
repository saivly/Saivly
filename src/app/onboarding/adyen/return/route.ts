import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    // This particular hop is already a real HTTP redirect (Adyen's own
    // server sends the browser here, then this route redirects onward),
    // so the client router cache staleness that affects the other steps'
    // server-action redirects isn't really in play — still invalidated
    // for consistency, in case a client-side <Link> back into
    // /onboarding is reachable afterward.
    revalidatePath("/onboarding", "layout");
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
