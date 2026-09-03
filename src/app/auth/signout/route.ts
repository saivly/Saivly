import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SESSION_STARTED_COOKIE,
  EMAIL_MFA_VERIFIED_COOKIE,
  SECURITY_PROMPT_DISMISSED_COOKIE,
} from "@/lib/supabase/proxy";

export async function POST(request: Request) {
  // Reject cross-site form posts (logout CSRF).
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login", request.url), {
    status: 302,
  });
  // Not strictly required — the proxy re-stamps/re-checks these fresh on
  // next login regardless — but a signed-out session shouldn't leave
  // stale session-scoped cookies sitting around either. In particular,
  // EMAIL_MFA_VERIFIED_COOKIE surviving a sign-out would let the next
  // login (even a different account on a shared browser) skip the email
  // challenge it's supposed to enforce.
  res.cookies.delete(SESSION_STARTED_COOKIE);
  res.cookies.delete(EMAIL_MFA_VERIFIED_COOKIE);
  res.cookies.delete(SECURITY_PROMPT_DISMISSED_COOKIE);
  return res;
}
