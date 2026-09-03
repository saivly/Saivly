"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  SECURITY_PROMPT_DISMISSED_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/supabase/proxy";

/**
 * Dismisses the "improve your account security" prompt for the rest of
 * this session only — called when the user clicks Skip or Next. Session-
 * scoped on purpose (a cookie, not a profiles column): an account with
 * neither an authenticator app nor a passkey is meant to see this prompt
 * again on every fresh login (see the enforcement ladder in
 * @/lib/supabase/proxy) until it adds one, so dismissing it here must not
 * carry over into the next session. Once the account has either method,
 * the proxy stops forcing this page at all and this cookie is moot.
 *
 * Returns whether the user was actually signed in (the caller bails out
 * to /login otherwise, rather than silently setting a cookie no one's
 * session will ever check).
 */
export async function dismissSecurityPromptForSession(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const cookieStore = await cookies();
  cookieStore.set(SECURITY_PROMPT_DISMISSED_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return true;
}
