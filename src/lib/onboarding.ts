import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Single source of truth for step order/labels — driving both the proxy's
// redirect target and the sidebar in /onboarding/layout.tsx.
export const ONBOARDING_STEPS = [
  { path: "personal", label: "Personal info" },
  { path: "organisation", label: "Organisation" },
  { path: "company", label: "Company info" },
  { path: "subscription", label: "Subscription" },
] as const;

export type OnboardingStepPath = (typeof ONBOARDING_STEPS)[number]["path"];

export type OnboardingStatus = {
  personalDone: boolean;
  // Whether the user has picked a side of the create-vs-join fork on
  // /onboarding/organisation — true the moment an organisation_members
  // row exists, regardless of which path put it there.
  organisationDone: boolean;
  companyDone: boolean;
  subscriptionDone: boolean;
  allDone: boolean;
};

const ALL_DONE: OnboardingStatus = {
  personalDone: true,
  organisationDone: true,
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
 * (in practice, today, the one they created or joined on
 * /onboarding/organisation — there's no way to belong to a second one yet).
 */
export async function getOnboardingStatus(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OnboardingStatus> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("personal_completed_at, adyen_legal_entity_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    // profiles always exists (migration 0001) — an error here is
    // unexpected, not "migration not applied yet". Fail closed.
    console.error("[onboarding] profile check failed:", profileError.message);
  }
  // Both, not just personal_completed_at: the personal step also registers
  // the user as an Adyen legal entity (src/lib/adyen.ts), and that call can
  // fail independently (e.g. ADYEN_LEGALENTITY_API_KEY missing/invalid in
  // an environment). savePersonalInfo only stamps personal_completed_at
  // once adyen_legal_entity_id is confirmed, so in steady state these two
  // agree — but check both anyway so a row from before that guarantee
  // existed (or a manually-edited one) doesn't slip through the gate.
  const personalDone = Boolean(
    profile?.personal_completed_at && profile?.adyen_legal_entity_id
  );

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
    return {
      personalDone,
      organisationDone: false,
      companyDone: false,
      subscriptionDone: false,
      allDone: false,
    };
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
    organisationDone: true,
    companyDone,
    subscriptionDone,
    allDone: personalDone && companyDone && subscriptionDone,
  };
}

/** First step the user hasn't finished yet, or null once all four are done. */
export function firstIncompleteStep(
  status: OnboardingStatus
): OnboardingStepPath | null {
  if (!status.personalDone) return "personal";
  if (!status.organisationDone) return "organisation";
  if (!status.companyDone) return "company";
  if (!status.subscriptionDone) return "subscription";
  return null;
}

/**
 * Whether the user has already been shown the optional passkey prompt
 * (/auth/passkey) — set on skip and on successful enrollment alike, so
 * this is "seen", not "completed". Gates a one-time interstitial that
 * runs before the onboarding wizard, not a wizard step itself: it has
 * no ONBOARDING_STEPS entry and isn't tracked in the sidebar.
 */
export async function hasSeenPasskeyPrompt(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("passkey_prompt_seen_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // Same fail-closed reasoning as the profile check above — profiles
    // always exists, so an error here is unexpected. Treat as "seen" so
    // a query hiccup doesn't loop-redirect the user; worst case they
    // just don't get prompted this one time.
    console.error(
      "[onboarding] passkey prompt check failed:",
      error.message
    );
    return true;
  }

  return Boolean(data?.passkey_prompt_seen_at);
}
