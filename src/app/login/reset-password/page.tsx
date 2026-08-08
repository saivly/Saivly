import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../actions";
import { PASSWORD_PATTERN, PASSWORD_HINT } from "@/lib/password-policy";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect("/login/forgot-password");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Set a new password
        </h1>
        <p className="mt-3 text-sm text-muted">
          Choose a new password for your account.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={updatePassword} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="sr-only">New password</span>
          <input
            name="password"
            type="password"
            placeholder="New password"
            required
            minLength={16}
            pattern={PASSWORD_PATTERN}
            title={PASSWORD_HINT}
            autoComplete="new-password"
            className="rounded-xl border border-line bg-panel px-4 py-3 outline-none transition-colors focus:border-ink"
          />
          <span className="text-xs text-muted">{PASSWORD_HINT}</span>
        </label>
        <button className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-85">
          Update password
        </button>
      </form>
    </main>
  );
}
