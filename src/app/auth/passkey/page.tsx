"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LaptopIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="4" y="5" width="16" height="11" rx="1.5" strokeLinejoin="round" />
      <path d="M2.5 19h19" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
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
      <path d="M11 18h2" strokeLinecap="round" />
    </svg>
  );
}

function VaultIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="3.5" y="7" width="17" height="14" rx="2" strokeLinejoin="round" />
      <path d="M7.5 7V6a4.5 4.5 0 0 1 9 0v1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="1.75" />
      <path d="M12 14.75V17" strokeLinecap="round" />
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

const FEATURES = [
  {
    icon: LaptopIcon,
    title: "On the computer",
    body: "Logging in to Saivly as you would on your computer.",
  },
  {
    icon: PhoneIcon,
    title: "On a phone",
    body: "Also to log in to the app or other devices.",
  },
  {
    icon: VaultIcon,
    title: "In a password manager",
    body: "One passkey securely shared between your devices.",
  },
];

/**
 * Passkey setup flow, entered from the /auth/security picker. Not gated
 * on AAL — a passkey can be set up before, after, or instead of an
 * authenticator app, since neither is mandatory. Always hands back to
 * /auth/security when done (or when backing out), so the picker can show
 * a checkmark for it.
 */
export default function PasskeyPromptPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        // Already has one — e.g. added earlier from the dashboard — so
        // there's nothing to ask; go straight back to the picker.
        if (cancelled) return;
        const { data: passkeys } = await supabase.auth.passkey.list();
        if (cancelled) return;
        if (passkeys && passkeys.length > 0) {
          router.replace("/auth/security");
          return;
        }
        setChecking(false);
      } catch (err) {
        // Either await above can throw (network blip, the experimental
        // passkey API misbehaving, etc.), not just resolve with
        // data/error. Without this catch, setChecking(false) never runs
        // and the page is stuck rendering nothing (see the `if
        // (checking) return null` below) — indistinguishable from the
        // whole feature being broken. Fail open: show the normal prompt
        // (with a working way back) instead of a blank page.
        console.error("[passkey] initial check failed:", err);
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No router.refresh() here — /auth/security re-fetches its own status
  // fresh on every mount, so there's nothing stale for refresh() to
  // invalidate. Calling it right after replace() only risks refreshing
  // whatever route is *still* committed at that instant (i.e. this page)
  // before the navigation lands — which looks exactly like "back does
  // nothing."
  function back() {
    router.replace("/auth/security");
  }

  async function setUp() {
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.registerPasskey();
      if (error) {
        // Most commonly the user cancelled the browser prompt — let them
        // try again or go back, don't force a page reload.
        setError(error.message);
        setBusy(false);
        return;
      }

      back();
    } catch (err) {
      console.error("[passkey] setup failed:", err);
      setError("Something went wrong setting up your passkey — try again or go back for now.");
      setBusy(false);
    }
  }

  // Avoids a flash of the prompt for the (uncommon) case where the user
  // already has a passkey and we're about to bounce past this page.
  if (checking) return null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center justify-center rounded-2xl bg-accent-soft py-14">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-panel shadow-sm">
          <KeyIcon className="h-9 w-9 text-ink" />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Extra account security with a passkey
        </h1>
        <p className="mt-2 text-sm text-muted">
          With a passkey, you can secure your account using your
          device&apos;s login method, such as fingerprint, face
          recognition, or a PIN code.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-on-accent">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={back}
          disabled={busy}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-soft disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={setUp}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Waiting for browser…" : "Set up a passkey"}
        </button>
      </div>
    </main>
  );
}
