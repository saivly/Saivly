import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAdyenVerificationStatus } from "@/lib/adyen/legalEntity";

/**
 * redirectUrl target for the *individual's* Adyen-hosted onboarding link
 * (see ../route.ts, which chains into this one after the organisation's
 * own hosted onboarding finishes). This is the second and final leg —
 * both the org's KYB and the shopper's own individual KYC have now been
 * through Adyen's hosted flow — but landing here only means they went
 * through the redirect, not that they actually finished filling
 * everything in (a shopper can leave Adyen's hosted pages blank and
 * click through, or just abandon partway and come back). So before
 * marking this step done, check with Adyen directly via
 * checkAdyenVerificationStatus, called on the *organization* legal
 * entity — Adyen's docs say this also surfaces problems on its
 * associated individual, so one call covers both legs.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

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
  const status = legalEntityId
    ? await checkAdyenVerificationStatus(legalEntityId)
    : null;

  if (status === "incomplete") {
    // Not everything was filled in (or something was rejected/invalid) —
    // don't mark this step done. Sent back to /onboarding/adyen rather
    // than straight into another hosted-link redirect, so they see why
    // before going through it again.
    return NextResponse.redirect(
      new URL(
        `/onboarding/adyen?error=${encodeURIComponent(
          "Adyen still needs more information before verification can continue. Use “Review with Adyen again” below and go through every step this time."
        )}`,
        request.url
      )
    );
  }

  // "verified", "pending" (still under Adyen's own review — not the
  // shopper's fault, and not something going through the hosted link
  // again would fix), or null (couldn't reach Adyen, or there's no
  // organization legal entity id yet — shouldn't happen since companyDone
  // requires one, but fail open rather than stranding the shopper on an
  // API hiccup, same reasoning as the org-leg return's own fallback when
  // minting this leg's link fails).
  await supabase
    .from("profiles")
    .update({ adyen_onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  // See personal/actions.ts for why this is needed on every step's
  // completion redirect — the client router cache can otherwise serve
  // a stale sidebar render after this.
  revalidatePath("/onboarding", "layout");

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
