import Link from "next/link";
import { recoverWithBackupCode } from "../actions";

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Use a backup code</h1>
        <p className="mt-1 text-sm text-muted">
          Enter one of the single-use backup codes you saved when setting up
          two-factor auth. Your old authenticator will be removed and
          you&apos;ll set up a new one.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={recoverWithBackupCode} className="flex flex-col gap-4">
        <input
          name="code"
          required
          autoFocus
          placeholder="ABCD-EFGH"
          autoComplete="off"
          spellCheck={false}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-center text-lg tracking-widest uppercase outline-none focus:border-accent"
        />
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Recover account
        </button>
      </form>

      <Link
        href="/auth/mfa"
        className="self-center text-sm text-muted hover:underline"
      >
        Back to code entry
      </Link>
    </main>
  );
}
