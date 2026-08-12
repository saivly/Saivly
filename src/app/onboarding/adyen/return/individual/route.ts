import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * redirectUrl target for the *individual's* Adyen-hosted onboarding link
 * (see ../route.ts, which chains into this one after the organisation's
 * own hosted onboarding finishes). This is the second and final leg —
 * both the org's KYB and the shopper's own individual KYC have now been
 * through Adyen's hosted flow, so this is what actually marks the step
 * done. No query params to trust, so this only records "they went
 * through the redirect", not any verification result Adyen reports
 * (that arrives separately, via webhook, once that's wired up).
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
    // See personal/actions.ts for why this is needed on every step's
    // completion redirect — the client router cache can otherwise serve
    // a stale sidebar render after this.
    revalidatePath("/onboarding", "layout");
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
