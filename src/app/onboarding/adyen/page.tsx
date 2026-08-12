import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingStatus, firstIncompleteStep } from "@/lib/onboarding";
import { startAdyenVerification } from "./actions";

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
 * subscription (see ONBOARDING_STEPS in @/lib/onboarding). Purely
 * explanatory + a Continue button: the actual work happens on Adyen's
 * hosted page, which startAdyenVerification() (actions.ts) redirects to.
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
  // Nothing to revisit here (no persisted form) — once done, move on.
  if (status.adyenDone) {
    const next = firstIncompleteStep(status);
    redirect(next ? `/onboarding/${next}` : "/dashboard");
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
        <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:w-auto">
          Continue to Adyen
        </button>
      </form>
    </div>
  );
}
