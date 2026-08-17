import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// The actual URLs a user moves through, in order — driving
// firstIncompleteStep()'s redirect target below. "organisation" and
// "company" are two distinct pages (the create-vs-join fork, and — for
// the create path — the company details form), so this stays
// fine-grained even though the sidebar groups them into one visual step
// (see ONBOARDING_STEPS below).
export type OnboardingStepPath =
  | "personal"
  | "organisation"
  | "company"
  | "company/business-activity"
  | "company/contact-details"
  | "adyen"
  | "subscription";

// Sidebar-facing grouping — driving the step numbering/labels in
// /onboarding/layout.tsx + onboarding-sidebar.tsx. "Organisation info"
// covers five URLs (the create-vs-join fork, its join sub-page, and the
// three company-detail pages) as a single step: picking a side of that
// fork and, for the create path, filling in company details are one
// conceptual task. Its own sub-steps (below) are what actually surface
// that internal structure in the sidebar — see OnboardingSidebar.
export const ONBOARDING_STEPS = [
  {
    key: "personal",
    label: "Personal info",
    paths: ["personal"],
    // Where the sidebar links a *done* (but not currently active) step —
    // i.e. where "revisit/edit this" should land.
    revisitPath: "personal",
  },
  {
    key: "organisation",
    label: "Organisation info",
    paths: [
      "organisation",
      "organisation/join",
      "company",
      "company/business-activity",
      "company/contact-details",
    ],
    revisitPath: "company",
    // Rendered nested under this step in the sidebar (see
    // OnboardingSidebar) — done-ness for each comes from
    // OnboardingStatus's finer-grained flags below, not from this step's
    // own (all-four-pages) stepDone.
    subSteps: [
      {
        key: "new-organisation",
        label: "New organisation",
        paths: ["organisation", "organisation/join"],
        revisitPath: "organisation",
      },
      {
        key: "company-information",
        label: "Company information",
        paths: ["company"],
        revisitPath: "company",
      },
      {
        key: "business-activity",
        label: "Business activity",
        paths: ["company/business-activity"],
        revisitPath: "company/business-activity",
      },
      {
        key: "contact-details",
        label: "Contact details",
        paths: ["company/contact-details"],
        revisitPath: "company/contact-details",
      },
    ],
  },
  {
    key: "adyen",
    label: "Adyen verification",
    paths: ["adyen"],
    revisitPath: "adyen",
  },
  {
    key: "subscription",
    label: "Subscription",
    paths: ["subscription"],
    revisitPath: "subscription",
  },
] as const;

export type OnboardingStatus = {
  personalDone: boolean;
  // Whether the user has picked a side of the create-vs-join fork on
  // /onboarding/organisation — true the moment an organisation_members
  // row exists, regardless of which path put it there.
  organisationDone: boolean;
  // Sub-step flags for the "Organisation info" step, in the order its
  // four pages are actually filled in — company/business-activity/
  // contact-details, each gating the next (see their page.tsx guards).
  // companyInfoDone flips once saveCompanyInfo has run at least once
  // (relationship_type is the tell — it's set unconditionally there);
  // businessActivityDone once saveBusinessActivity has (industry_code).
  // companyDone is the step as a whole — the Adyen organisation-legal-
  // entity chain only finishes on the last page (saveContactDetails), so
  // it stays the authoritative "can the user move on to Adyen
  // verification?" gate everywhere else in the wizard already relied on.
  companyInfoDone: boolean;
  businessActivityDone: boolean;
  companyDone: boolean;
  // Went through the Adyen-hosted onboarding redirect and came back — see
  // migration 0009. Not the same as Adyen having approved their KYC;
  // that's a separate async outcome, not tracked here yet.
  adyenDone: boolean;
  subscriptionDone: boolean;
  allDone: boolean;
};

const ALL_DONE: OnboardingStatus = {
  personalDone: true,
  organisationDone: true,
  companyInfoDone: true,
  businessActivityDone: true,
  companyDone: true,
  adyenDone: true,
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
    .select("personal_completed_at, adyen_legal_entity_id, adyen_onboarding_completed_at")
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
  const adyenDone = Boolean(profile?.adyen_onboarding_completed_at);

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
      companyInfoDone: false,
      businessActivityDone: false,
      companyDone: false,
      adyenDone,
      subscriptionDone: false,
      allDone: false,
    };
  }

  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select(
      "relationship_type, industry_code, company_completed_at, subscription_completed_at"
    )
    .eq("id", membership.organisation_id)
    .maybeSingle();

  if (orgError) {
    console.error("[onboarding] organisation check failed:", orgError.message);
  }

  // relationship_type/industry_code are each set unconditionally by the
  // save action of the page that asks for them (saveCompanyInfo,
  // saveBusinessActivity) — their presence is what "that page has been
  // submitted at least once" actually looks like from here.
  const companyInfoDone = Boolean(org?.relationship_type);
  const businessActivityDone = Boolean(org?.industry_code);
  const companyDone = Boolean(org?.company_completed_at);
  const subscriptionDone = Boolean(org?.subscription_completed_at);

  return {
    personalDone,
    organisationDone: true,
    companyInfoDone,
    businessActivityDone,
    companyDone,
    adyenDone,
    subscriptionDone,
    allDone: personalDone && companyDone && adyenDone && subscriptionDone,
  };
}

/** First step the user hasn't finished yet, or null once every step is done. */
export function firstIncompleteStep(
  status: OnboardingStatus
): OnboardingStepPath | null {
  if (!status.personalDone) return "personal";
  if (!status.organisationDone) return "organisation";
  if (!status.companyInfoDone) return "company";
  if (!status.businessActivityDone) return "company/business-activity";
  if (!status.companyDone) return "company/contact-details";
  if (!status.adyenDone) return "adyen";
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
