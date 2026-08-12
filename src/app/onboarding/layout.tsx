import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus, ONBOARDING_STEPS } from "@/lib/onboarding";
import OnboardingSidebar from "./onboarding-sidebar";

// stepDone (and the sidebar checkmarks it drives) is per-user, per-request
// state — the App Router's client-side navigation cache would otherwise
// happily reuse an earlier render of this layout (e.g. from before a step
// completed) when the user clicks between steps with <Link>. Force this
// whole segment to always re-render server-side instead of ever serving
// a cached copy.
export const dynamic = "force-dynamic";

/**
 * Shared shell for every /onboarding/* step: sidebar step-tracker +
 * content area. The proxy already keeps unauthenticated/aal1/fully-onboarded
 * users out of here — this fetch is defense-in-depth, same as dashboard/page.tsx.
 */
export default async function TeamOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  // Keyed by ONBOARDING_STEPS' step.key, not by URL — "organisation" is
  // the merged create-vs-join + company-details step, so it's only "done"
  // once companyDone is (which also implies organisationDone: an org has
  // to exist, created or joined, before it can have company info at all).
  const stepDone: Record<string, boolean> = {
    personal: status.personalDone,
    organisation: status.companyDone,
    adyen: status.adyenDone,
    subscription: status.subscriptionDone,
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-16 md:flex-row md:gap-16">
      <OnboardingSidebar steps={ONBOARDING_STEPS} stepDone={stepDone} />
      <div className="min-w-0 flex-1">{children}</div>
    </main>
  );
}
