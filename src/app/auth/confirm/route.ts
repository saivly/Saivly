import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import {
  SIGNUP_JUST_CONFIRMED_COOKIE,
  SIGNUP_JUST_CONFIRMED_MAX_AGE_SECONDS,
} from "@/lib/supabase/proxy";

/**
 * Handles email confirmation links (signup, magic link, recovery, email change).
 * Supabase Dashboard -> Auth -> Email Templates should point links here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const res = NextResponse.redirect(new URL(next, request.url));

      if (type === "signup") {
        // Clicking this link IS the proof of inbox control that the
        // proxy's step-3 emailed 8-digit code would otherwise demand a
        // second time, before the user has even had a chance to set up a
        // passkey/authenticator. Let the proxy's first pass this session
        // treat step 3 as already satisfied (see proxy.ts).
        res.cookies.set(SIGNUP_JUST_CONFIRMED_COOKIE, "1", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: SIGNUP_JUST_CONFIRMED_MAX_AGE_SECONDS,
        });
      }

      return res;
    }
  }

  return NextResponse.redirect(new URL("/error", request.url));
}
