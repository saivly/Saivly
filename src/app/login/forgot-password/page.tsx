import Link from "next/link";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  const linkClasses =
    "text-center text-sm font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink";

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-muted">
          If an account exists for that address, we sent a link to reset
          your password.
        </p>
        <Link href="/login" className={linkClasses}>
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Reset password
        </h1>
        <p className="mt-3 text-sm text-muted">
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="sr-only">Email address</span>
          <input
            name="email"
            type="email"
            placeholder="Email address"
            required
            autoComplete="email"
            className="rounded-xl border border-line bg-panel px-4 py-3 outline-none transition-colors focus:border-ink"
          />
        </label>
        <button className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-85">
          Send reset link
        </button>
      </form>

      <Link href="/login" className={linkClasses}>
        Back to sign in
      </Link>
    </main>
  );
}
