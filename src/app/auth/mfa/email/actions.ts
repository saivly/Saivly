"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import {
  EMAIL_MFA_VERIFIED_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/supabase/proxy";
import {
  hitRateLimit,
  RATE_LIMIT_UNAVAILABLE_MSG,
  TOO_MANY_ATTEMPTS_MSG,
} from "@/lib/rate-limit";

/**
 * Fallback second factor for accounts with neither an authenticator app
 * nor a passkey on file (see the enforcement ladder in
 * @/lib/supabase/proxy). There's no standalone "email" factor type in
 * Supabase's own MFA system, so this rides on its passwordless email-OTP
 * flow instead (signInWithOtp / verifyOtp) — the user is already
 * signed in at aal1; this just proves they also control the inbox.
 *
 * Always targets the *currently signed-in* user's own email (never a
 * client-supplied one) — otherwise a signed-in user could request a code
 * for an address they don't own, or worse, verifyOtp() would happily sign
 * them in as a different account entirely.
 */

/** Sends (or resends) the emailed code, then redirects back with ?sent=1. */
export async function requestEmailCode(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const next = safeNext(formData.get("next") as string);
  const qs = `next=${encodeURIComponent(next)}`;

  // Supabase's own OTP rate limit (~1/60s per address) covers hammering
  // the send button; this is a coarser backstop in front of it.
  const rl = await hitRateLimit(`email-mfa-send:${user.id}`, 5, 900);
  if (!rl.allowed) {
    const msg = rl.unavailable
      ? RATE_LIMIT_UNAVAILABLE_MSG
      : TOO_MANY_ATTEMPTS_MSG;
    redirect(`/auth/mfa/email?${qs}&error=${encodeURIComponent(msg)}`);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    redirect(`/auth/mfa/email?${qs}&error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/mfa/email?${qs}&sent=1`);
}

/** Verifies the 6-digit code and marks this session's email challenge cleared. */
export async function verifyEmailCode(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const next = safeNext(formData.get("next") as string);
  const qs = `sent=1&next=${encodeURIComponent(next)}`;

  const rl = await hitRateLimit(`email-mfa-verify:${user.id}`, 5, 900);
  if (!rl.allowed) {
    const msg = rl.unavailable
      ? RATE_LIMIT_UNAVAILABLE_MSG
      : TOO_MANY_ATTEMPTS_MSG;
    redirect(`/auth/mfa/email?${qs}&error=${encodeURIComponent(msg)}`);
  }

  const { error } = await supabase.auth.verifyOtp({
    email: user.email,
    token: (formData.get("code") as string) ?? "",
    type: "email",
  });

  if (error) {
    redirect(
      `/auth/mfa/email?${qs}&error=${encodeURIComponent("Invalid or expired code.")}`
    );
  }

  // Supabase's AAL system has no concept of this factor, so the proxy
  // can't infer "cleared" from the session the way it does for TOTP —
  // this cookie is what it checks instead. Session-scoped on purpose
  // (see SECURITY_PROMPT_DISMISSED_COOKIE's comment in proxy.ts): a fresh
  // login for this same method-less account must go through this again.
  const cookieStore = await cookies();
  cookieStore.set(EMAIL_MFA_VERIFIED_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(next);
}
