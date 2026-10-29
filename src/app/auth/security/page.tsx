"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safe-redirect";
import { dismissSecurityPromptForSession } from "./actions";

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path
        d="M12 3.5 19 6v5.5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-2.5Z"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AuthenticatorIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="7" y="2.5" width="10" height="19" rx="2" strokeLinejoin="round" />
      <path d="M9.5 6.5h5M9.5 9.5h5M9.5 12.5h2.5" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <circle cx="8" cy="15.5" r="4.5" />
      <path d="M11.5 12 19.5 4M17 6.5 19 4.5M15 8.5l1.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const OPTIONS = [
  {
    key: "authenticator" as const,
    title: "Authenticator app",
    body: "Enter a 6-digit code from an app like Google Authenticator or 1Password.",
    href: "/auth/mfa/enroll",
    icon: AuthenticatorIcon,
  },
  {
    key: "passkey" as const,
    title: "Passkeys",
    body: "Use your device's fingerprint, face recognition, or PIN instead.",
    href: "/auth/passkey",
    icon: KeyIcon,
  },
];

/**
 * Skippable picker for adding a stronger second factor — see the
 * enforcement ladder in @/lib/supabase/proxy for when this is reached.
 * Not reachable via the sidebar/wizard: it's outside ONBOARDING_STEPS on
 * purpose, it isn't a step you can come back to.
 *
 * Neither method is required — an account with neither still gets an
 * emailed code every session (/auth/mfa/email) instead. Unlike a true
 * one-time interstitial, Skip/Next here only dismiss this page for the
 * *current* session (see dismissSecurityPromptForSession): as long as
 * the account has nothing stronger than the email fallback, the proxy
 * shows this again on every fresh login. Picking a card hands off to
 * that method's own flow (/auth/mfa/enroll or /auth/passkey), which
 * always lands back here so the picker can show a checkmark for whatever
 * just got set up.
 */
export default function SecurityPromptPage() {
  // useSearchParams() needs a Suspense boundary above it (Next.js opts
  // the whole page into client-side rendering at request time otherwise,
  // which errors at build time without this).
  return (
    <Suspense fallback={null}>
      <SecurityPrompt />
    </Suspense>
  );
}

function SecurityPrompt() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticatorDone, setAuthenticatorDone] = useState(false);
  const [passkeyDone, setPasskeyDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          router.replace("/login");
          return;
        }

        if (cancelled) return;
        const [{ data: factors }, { data: passkeys }] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.passkey.list(),
        ]);
        if (cancelled) return;

        setAuthenticatorDone(
          Boolean(factors?.totp.some((f) => f.status === "verified"))
        );
        setPasskeyDone(Boolean(passkeys && passkeys.length > 0));
        setChecking(false);
      } catch (err) {
        // Either await above can throw (network blip, the experimental
        // passkey API misbehaving, etc.), not just resolve with
        // data/error. Without this catch, setChecking(false) never runs
        // and the page is stuck rendering nothing — indistinguishable
        // from the whole feature being broken. Fail open: show the
        // normal picker (with a working Skip) instead of a blank page.
        console.error("[security] initial check failed:", err);
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No router.refresh() here — wherever `next` points does its own fresh
  // server-side checks on every load (the proxy runs on every request
  // regardless), so there's nothing stale for refresh() to invalidate.
  // Calling it right after replace() only risks refreshing whatever route
  // is *still* committed at that instant (i.e. this page) before the
  // navigation lands — which looks exactly like "Skip/Next does nothing."
  function proceed() {
    router.replace(next);
  }

  async function continueOnward() {
    setBusy(true);
    setError(null);
    try {
      const ok = await dismissSecurityPromptForSession();
      if (!ok) {
        setError("Couldn't continue just now — try again in a moment.");
        setBusy(false);
        return;
      }
      proceed();
    } catch (err) {
      // dismissSecurityPromptForSession() is a server action — it can
      // throw (network blip, stale action reference after a redeploy,
      // etc.), not just return ok:false. Without this catch, busy stays
      // true forever with no feedback.
      console.error("[security] continue failed:", err);
      setError("Couldn't continue just now — try again in a moment.");
      setBusy(false);
    }
  }

  // Avoids a flash of the picker for the (uncommon) case where the check
  // above is still in flight.
  if (checking) return null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center justify-center rounded-2xl bg-accent-soft py-14">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-panel shadow-sm">
          <ShieldIcon className="h-9 w-9 text-ink" />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Improve your account security
        </h1>
        <p className="mt-2 text-sm text-muted">
          With two-factor authentication via an app or a passkey, your
          account is safer than with just a password. Set up one below, or
          skip for now and do it later.
        </p>
      </div>

      {!authenticatorDone && !passkeyDone && (
        <div className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm text-muted">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Without one of these, we&apos;ll email you an 8-digit code to
            confirm it&apos;s you every time you sign in. An authenticator
            app or passkey is faster — and doesn&apos;t depend on your
            inbox.
          </p>
        </div>
      )}

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
        {OPTIONS.map(({ key, title, body, href, icon: Icon }) => {
          const done = key === "authenticator" ? authenticatorDone : passkeyDone;
          const row = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-on-accent">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted">{body}</span>
              </span>
              {done ? (
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent">
                  <CheckIcon className="h-4 w-4" />
                  Enabled
                </span>
              ) : (
                <ChevronIcon className="h-4 w-4 shrink-0 text-muted" />
              )}
            </>
          );

          return done ? (
            <div key={key} className="flex items-center gap-4 px-4 py-4">
              {row}
            </div>
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => router.push(href)}
              className="flex items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-accent-soft"
            >
              {row}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={continueOnward}
          disabled={busy}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-soft disabled:opacity-50"
        >
          Skip
        </button>
        <button
          onClick={continueOnward}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Next"}
        </button>
      </div>
    </main>
  );
}
