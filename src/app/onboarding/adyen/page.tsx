import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus, firstIncompleteStep } from "@/lib/onboarding/onboarding";
import { startAdyenVerification } from "./actions";
import ContinueButton from "./continue-button";

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 3.5 5 6v5.5c0 4.6 3 7.9 7 9 4-1.1 7-4.4 7-9V6l-7-2.5Z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M4 10.5 8 14l8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const EXPECTATIONS = [
  "Confirm your organisation's and your own personal details",
  "Upload a photo ID or business document, if asked",
  "Add the bank account you'd like payouts sent to",
  "Takes most people just a few minutes",
];

/**
 * "Adyen verification" step — between organisation/company info and
 * subscription (see ONBOARDING_STEPS in @/lib/onboarding). Not done yet:
 * explanatory + a Continue button, the actual work happens on Adyen's
 * hosted page, which startAdyenVerification() (actions.ts) redirects to.
 * Already done: a completed-state view instead of redirecting away, since
 * step 4's sidebar entry links back here and that link needs somewhere
 * to land.
 */
export default async function AdyenVerificationStep({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await getOnboardingStatus(supabase, user.id);
  if (!status.personalDone) redirect("/onboarding/personal");
  if (!status.companyDone) redirect("/onboarding/company");

  // Once done, this used to bounce straight past — but step 4
  // (subscription) links back here via the sidebar, and that link has to
  // actually land somewhere: show a completed state instead of
  // redirecting away from it every time.
  if (status.adyenDone) {
    const next = firstIncompleteStep(status);
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Verify your identity with Adyen
          </h1>
          <p className="mt-2 text-sm text-muted">
            Step 3 of 4 — you&apos;ve completed this step.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">You&apos;re verified with Adyen</p>
            <p className="mt-1 text-sm text-muted">
              Your organisation went through Adyen&apos;s hosted verification.
              If Adyen needs anything else from you, they&apos;ll ask —
              otherwise there&apos;s nothing more to do here.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <form action={startAdyenVerification}>
            <button className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-soft">
              Review with Adyen again
            </button>
          </form>
          <Link
            href={next ? `/onboarding/${next}` : "/dashboard"}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Verify your identity with Adyen
        </h1>
        <p className="mt-2 text-sm text-muted">
          Step 3 of 4 — to complete onboarding, we partner with{" "}
          <span className="font-medium text-ink">Adyen</span> — the payments
          infrastructure used by platforms like eBay, Uber, and Spotify — to
          verify your organisation and keep payouts secure.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-line bg-panel p-5">
        <div className="flex items-center gap-2.5">
          <ShieldIcon className="h-5 w-5 shrink-0 text-muted" />
          <p className="font-semibold">What to expect</p>
        </div>
        <p className="mt-1 text-sm text-muted">
          You&apos;ll be redirected to a secure page hosted by Adyen, then
          brought straight back here when you&apos;re done.
        </p>
        <ul className="mt-4 flex flex-col gap-2.5 text-sm">
          {EXPECTATIONS.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted">
        Adyen only shares your verification status with us — never your
        documents or bank details directly.
      </p>

      <form action={startAdyenVerification}>
        <ContinueButton />
      </form>
    </div>
  );
}
