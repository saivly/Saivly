"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { headers } from "next/headers";
import {
  hitRateLimit,
  RATE_LIMIT_UNAVAILABLE_MSG,
  TOO_MANY_ATTEMPTS_MSG,
} from "@/lib/rate-limit";
import { isStrongPassword, PASSWORD_HINT } from "@/lib/password-policy";
import { loginSchema, signupSchema } from "@/lib/zod";

export async function login(formData: FormData) {
  const supabase = await createClient();

  // Client-side live validation (auth-panels.tsx) mirrors this schema;
  // never trust the client.
  const parsed = loginSchema.safeParse({
    email: (formData.get("email") as string).trim().toLowerCase(),
    password: formData.get("password") as string,
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  const { email, password } = parsed.data;

  // 10 attempts per 15 min per IP+email. Postgres-backed (migration 0002).
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const rl = await hitRateLimit(`login:${ip}:${email}`, 10, 900);
  if (!rl.allowed) {
    const msg = rl.unavailable
      ? RATE_LIMIT_UNAVAILABLE_MSG
      : TOO_MANY_ATTEMPTS_MSG;
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Don't leak whether the email exists or the password was wrong —
    // Supabase's own message ("Invalid login credentials") covers that
    // case; anything else (e.g. unconfirmed email) still passes through.
    const message =
      error.code === "invalid_credentials"
        ? "Incorrect email or password. Please try again."
        : error.message;
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/", "layout");

  // Password auth only gets you to aal1. Route straight to the right
  // MFA step instead of bouncing off the proxy.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const next = safeNext(formData.get("next") as string);

  if (aal?.currentLevel !== "aal2") {
    if (aal?.nextLevel === "aal2") {
      redirect(`/auth/mfa?next=${encodeURIComponent(next)}`);
    }
    redirect("/auth/mfa/enroll");
  }

  redirect(next);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // Client-side live validation (auth-panels.tsx) mirrors this schema;
  // never trust the client.
  const parsed = signupSchema.safeParse({
    firstname: (formData.get("first_name") as string).trim(),
    lastname: (formData.get("last_name") as string).trim(),
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }
  const { firstname, lastname, email, password } = parsed.data;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Where the confirmation email's link lands (see auth/confirm/route.ts)
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm`,
      data: {
        full_name: `${firstname} ${lastname}`.trim() || null,
        first_name: firstname || null,
        last_name: lastname || null,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/signup?sent=1");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = (formData.get("email") as string).trim().toLowerCase();

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const rl = await hitRateLimit(`pwreset:${ip}:${email}`, 5, 900);
  if (!rl.allowed) {
    const msg = rl.unavailable
      ? RATE_LIMIT_UNAVAILABLE_MSG
      : TOO_MANY_ATTEMPTS_MSG;
    redirect(`/login/forgot-password?error=${encodeURIComponent(msg)}`);
  }

  // resetPasswordForEmail never reveals whether the address has an
  // account, so we always land on the same "check your email" screen.
  //
  // NOTE: the "Reset Password" template in Supabase Dashboard -> Auth ->
  // Email Templates must forward {{ .RedirectTo }} as `next` on the
  // confirm link (e.g. `{{ .SiteURL }}/auth/confirm?token_hash={{
  // .TokenHash }}&type=recovery&next={{ .RedirectTo }}`), or this link
  // sends the user to the default fallback ("/dashboard") instead of
  // /login/reset-password.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm?next=${encodeURIComponent("/login/reset-password")}`,
  });

  redirect("/login/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  // Only reachable with the recovery session set by /auth/confirm.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login/forgot-password");
  }

  const password = formData.get("password") as string;
  if (!isStrongPassword(password)) {
    redirect(`/login/reset-password?error=${encodeURIComponent(PASSWORD_HINT)}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/login/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
