import Link from "next/link";
import { verifyMfaChallenge } from "./actions";
import { safeNext } from "@/lib/safe-redirect";

/**
 * AAL2 challenge. Verification happens in a server action so attempts
 * are rate limited (5 per 15 min per user) on top of Supabase's own
 * endpoint limits.
 */
export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Two-factor code</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      {params.error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {params.error}
        </p>
      )}

      <form action={verifyMfaChallenge} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="123456"
          className="rounded-lg border border-line bg-panel px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-accent"
        />
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Continue
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm">
        <Link href="/auth/mfa/recovery" className="text-accent hover:underline">
          Lost your device? Use a backup code
        </Link>
        <form action="/auth/signout" method="post">
          <button className="text-muted hover:underline">
            Use a different account
          </button>
        </form>
      </div>
    </main>
  );
}
