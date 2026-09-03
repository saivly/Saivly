import { requestEmailCode, verifyEmailCode } from "./actions";
import { safeNext } from "@/lib/safe-redirect";

/**
 * Fallback per-session second factor for accounts with neither an
 * authenticator app nor a passkey on file — see the enforcement ladder in
 * @/lib/supabase/proxy. An 8-digit code emailed through Supabase's own
 * passwordless OTP flow (signInWithOtp / verifyOtp), since there's no
 * standalone "email" factor type in Supabase's own MFA system.
 *
 * Requires the project's Supabase "Magic Link" email template (Auth ->
 * Email Templates, in the Supabase dashboard) to include {{ .Token }} —
 * otherwise the email carries only a sign-in link, no 8-digit code to
 * enter below.
 */
export default async function EmailMfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const sent = params.sent === "1";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Confirm it&apos;s you</h1>
        <p className="mt-1 text-sm text-muted">
          {sent
            ? "Enter the 8-digit code we emailed you. It expires shortly — send a new one if it's been a while."
            : "You haven't set up an authenticator app or passkey, so we'll email you an 8-digit code to confirm it's you."}
        </p>
      </div>

      {params.error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {params.error}
        </p>
      )}

      {sent ? (
        <>
          <form action={verifyEmailCode} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{8}"
              maxLength={8}
              required
              autoFocus
              placeholder="12345678"
              className="rounded-lg border border-line bg-panel px-3 py-2 text-center text-lg tracking-[0.4em] outline-none focus:border-accent"
            />
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Continue
            </button>
          </form>

          <form action={requestEmailCode} className="self-center">
            <input type="hidden" name="next" value={next} />
            <button className="text-sm text-accent hover:underline">
              Send a new code
            </button>
          </form>
        </>
      ) : (
        <form action={requestEmailCode} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Email me a code
          </button>
        </form>
      )}

      <form action="/auth/signout" method="post" className="self-center">
        <button className="text-sm text-muted hover:underline">
          Use a different account
        </button>
      </form>
    </main>
  );
}
