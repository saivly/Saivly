"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";
import {
  hitRateLimit,
  RATE_LIMIT_UNAVAILABLE_MSG,
  TOO_MANY_ATTEMPTS_MSG,
} from "@/lib/rate-limit";

/**
 * Joins an existing organisation via the join_organisation() RPC
 * (migration 0008) — a SECURITY DEFINER function, because RLS
 * (organisations_select_member) blocks a non-member from reading the org
 * row to check its name before becoming one. The (id, name) pair is the
 * de facto invite code: an owner shares both out of band (the id is shown
 * to owners on the company step, see company-form.tsx).
 */
export async function joinOrganisation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sequential lock, enforced server-side too — not just by hiding the link.
  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");
  if (status.organisationDone) redirect("/onboarding");

  // The UUID space makes guessing infeasible, but a leaked/mistyped-target
  // brute force of names against a known id is still worth capping.
  const rl = await hitRateLimit(`join-org:${user.id}`, 10, 3600);
  if (!rl.allowed) {
    const msg = rl.unavailable
      ? RATE_LIMIT_UNAVAILABLE_MSG
      : TOO_MANY_ATTEMPTS_MSG;
    redirect(`/onboarding/organisation/join?error=${encodeURIComponent(msg)}`);
  }

  const organisationName = ((formData.get("organisationName") as string) ?? "").trim();
  const organisationId = ((formData.get("organisationId") as string) ?? "").trim();

  if (!organisationName || !organisationId) {
    redirect(
      `/onboarding/organisation/join?error=${encodeURIComponent(
        "Enter both the organisation's name and its ID."
      )}`
    );
  }

  const { data: joined, error } = await supabase.rpc("join_organisation", {
    target_org_id: organisationId,
    claimed_name: organisationName,
  });

  // A malformed (non-UUID) id surfaces as `error`; a well-formed id that's
  // wrong, or a name that doesn't match, surfaces as `joined === false` —
  // both get the same message so a wrong id can't be distinguished from a
  // wrong name (nothing to enumerate either way, but no reason to help).
  if (error || !joined) {
    redirect(
      `/onboarding/organisation/join?error=${encodeURIComponent(
        "We couldn't find an organisation with that exact name and ID. Double-check both with whoever invited you and try again."
      )}`
    );
  }

  // See personal/actions.ts for why this is needed on every step's
  // completion redirect, not just this one.
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding");
}
