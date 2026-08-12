import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SESSION_STARTED_COOKIE } from "@/lib/supabase/proxy";

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
  // Not strictly required — the proxy re-stamps this fresh on next login
  // regardless — but a signed-out session shouldn't leave a stale timer
  // cookie sitting around either.
  res.cookies.delete(SESSION_STARTED_COOKIE);
  return res;
}
