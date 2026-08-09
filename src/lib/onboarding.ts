import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Single source of truth for step order/labels — driving both the proxy's
// redirect target and the sidebar in /onboarding/layout.tsx.
export const ONBOARDING_STEPS = [
  { path: "personal", label: "Personal info" },
  { path: "company", label: "Company info" },
  { path: "subscription", label: "Subscription" },
] as const;

export type OnboardingStepPath = (typeof ONBOARDING_STEPS)[number]["path"];

export type OnboardingStatus = {
  personalDone: boolean;
  companyDone: boolean;
  subscriptionDone: boolean;
  allDone: boolean;
};

const ALL_DONE: OnboardingStatus = {
  personalDone: true,
  companyDone: true,
  subscriptionDone: true,
  allDone: true,
};

/**
 * Personal info lives on the user's own profiles row; company +
 * subscription live on whichever organisation they're a member of — an
 * org-level fact, not a per-user one, so a teammate who joins an
 * already-set-up org later doesn't have to redo those steps. For
 * onboarding purposes we only care about the first org a user belongs to
 * (in practice, today, the one they created in the company step — there's
 * no invite flow yet, so nobody has a second one).
 */
export async function getOnboardingStatus(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OnboardingStatus> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("personal_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    // profiles always exists (migration 0001) — an error here is
    // unexpected, not "migration not applied yet". Fail closed.
    console.error("[onboarding] profile check failed:", profileError.message);
  }
  const personalDone = Boolean(profile?.personal_completed_at);

  const { data: membership, error: memberError } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    // PGRST205 = organisations/organisation_members don't exist yet, i.e.
    // supabase/migrations/0003_organisations.sql hasn't been run. Fail
    // OPEN (pretend onboarding is done) rather than routing every user
    // into a wizard whose every save will 404 the same way.
    if (memberError.code === "PGRST205") {
      console.error(
        "[onboarding] organisation tables not found — run supabase/migrations/0003_organisations.sql. Skipping the onboarding gate until then."
      );
      return ALL_DONE;
    }
    console.error("[onboarding] membership check failed:", memberError.message);
  }

  if (!membership) {
    return { personalDone, companyDone: false, subscriptionDone: false, allDone: false };
  }

  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("company_completed_at, subscription_completed_at")
    .eq("id", membership.organisation_id)
    .maybeSingle();

  if (orgError) {
    console.error("[onboarding] organisation check failed:", orgError.message);
  }

  const companyDone = Boolean(org?.company_completed_at);
  const subscriptionDone = Boolean(org?.subscription_completed_at);

  return {
    personalDone,
    companyDone,
    subscriptionDone,
    allDone: personalDone && companyDone && subscriptionDone,
  };
}

/** First step the user hasn't finished yet, or null once all three are done. */
export function firstIncompleteStep(
  status: OnboardingStatus
): OnboardingStepPath | null {
  if (!status.personalDone) return "personal";
  if (!status.companyDone) return "company";
  if (!status.subscriptionDone) return "subscription";
  return null;
}
