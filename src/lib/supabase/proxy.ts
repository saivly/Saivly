import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getOnboardingStatus } from "@/lib/onboarding/onboarding";

/**
 * Session refresher + route guard used by the root proxy (middleware).
 *
 * Enforcement ladder:
 *  0. Session open >2h (see SESSION_MAX_AGE_SECONDS) -> forced sign-out,
 *     then /login — regardless of AAL level or how recently they clicked
 *     around. Checked before everything else below.
 *  1. No session                       -> /login
 *  2. Verified authenticator app, but  -> /auth/mfa (needs this session's
 *     not yet cleared this session        code)
 *  3. No authenticator app AND no      -> /auth/mfa/email (needs this
 *     passkey on file                     session's emailed code)
 *  4. ...and hasn't dismissed the      -> /auth/security (nudge to add
 *     security nudge this session         either method — shown again
 *                                          every session until they do)
 *  5. Onboarding unfinished            -> /onboarding
 *  6. Onboarding done                  -> pass through (and bounce away
 *                                          from /onboarding itself, done
 *                                          is done)
 *
 * Two-factor auth is OPTIONAL to *set up*, but every session still ends
 * up with a second factor of some kind: an authenticator app or a passkey
 * if the account has one, otherwise a 6-digit code emailed on the spot
 * (step 3) — see /auth/mfa/email. Passkeys are a first-factor sign-in
 * credential in Supabase's model, not an `auth.mfa`-enrolled factor, so
 * they never show up in `getAuthenticatorAssuranceLevel()`; step 3 checks
 * for one directly instead of relying on `aal`.
 *
 * Steps 2 and 3 are mutually exclusive (an account either has a verified
 * TOTP factor or it doesn't) and both are mandatory. Step 4 only applies
 * to the no-TOTP-and-no-passkey branch, and — unlike the old one-time,
 * permanently-dismissed prompt — is tracked per session (a cookie, not a
 * profiles column) precisely so it keeps coming back for accounts that
 * still have nothing stronger than the email fallback.
 */

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/error"];
const ONBOARDING_BASE = "/onboarding";
const SECURITY_PROMPT_PATH = "/auth/security";
const EMAIL_MFA_PATH = "/auth/mfa/email";

// Absolute session cap, not an idle timeout — the clock starts at login
// and never resets just because the shopper stays active. Supabase's own
// access token normally auto-refreshes indefinitely as long as the
// browser keeps making requests, which would otherwise keep a session
// alive forever; this cookie is what actually bounds it. A fixed cookie
// (set once, checked every request, never bumped) rather than reading the
// JWT's own `iat` claim, because `iat` gets bumped forward on every token
// refresh (~hourly) and so never reflects the *original* login time.
export const SESSION_STARTED_COOKIE = "session_started_at";
export const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60; // 2 hours

// Set once the emailed code (step 3) is verified, and once the security
// nudge (step 4) is dismissed via Skip/Next — both scoped to the current
// session (same lifetime as SESSION_STARTED_COOKIE, cleared alongside it)
// since neither should carry over into the next login.
export const EMAIL_MFA_VERIFIED_COOKIE = "email_mfa_verified_at";
export const SECURITY_PROMPT_DISMISSED_COOKIE = "security_prompt_dismissed_at";

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );
}

/** Redirect while preserving any refreshed auth cookies. */
function redirectTo(
  request: NextRequest,
  pathname: string,
  from: NextResponse,
  next?: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Needed for auth.passkey.list() below (step 3) — listing passkeys
      // is a plain authenticated API call (no WebAuthn ceremony, so no
      // browser required), but it's still gated behind this flag like
      // every other passkey method.
      auth: { experimental: { passkey: true } },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run code between createServerClient and getClaims().
  // getClaims() validates the JWT and refreshes it if needed.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  // Sets when step 0 below stamps a brand-new session's start time —
  // used to force EMAIL_MFA_VERIFIED_COOKIE/SECURITY_PROMPT_DISMISSED_COOKIE
  // to "not set" for the rest of *this* request even if a stale value for
  // either is still sitting in the incoming request's cookies. Deleting
  // them only queues a Set-Cookie on the response; request.cookies below
  // would otherwise still read the old value on this very first request.
  let freshSession = false;

  // 0. Session open too long -> force sign-out regardless of AAL level or
  //    which page this is (applies on /auth/* and /login too, not just
  //    protected routes — a stale session shouldn't linger there either).
  if (user) {
    const startedAtRaw = request.cookies.get(SESSION_STARTED_COOKIE)?.value;
    const startedAt = startedAtRaw ? Number(startedAtRaw) : null;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (startedAt && nowSeconds - startedAt > SESSION_MAX_AGE_SECONDS) {
      await supabase.auth.signOut(); // invalidates the refresh token too, not just this cookie
      const res = redirectTo(request, "/login", supabaseResponse);
      res.cookies.delete(SESSION_STARTED_COOKIE);
      res.cookies.delete(EMAIL_MFA_VERIFIED_COOKIE);
      res.cookies.delete(SECURITY_PROMPT_DISMISSED_COOKIE);
      return res;
    }

    if (!startedAt) {
      // First request we've seen from this session (e.g. right after
      // login, whichever method — password, passkey, OAuth, magic link —
      // they all funnel through here) — start the clock now.
      supabaseResponse.cookies.set(SESSION_STARTED_COOKIE, String(nowSeconds), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      });

      // A fresh session must clear the email challenge and see the
      // security nudge on its own terms — without this, a leftover
      // email_mfa_verified_at cookie from a *previous* session that ended
      // some other way than /auth/signout (token just expired, a reset
      // elsewhere, etc.) would let a brand-new login skip step 3 below
      // entirely, since the cookie alone is what the proxy checks.
      freshSession = true;
      supabaseResponse.cookies.delete(EMAIL_MFA_VERIFIED_COOKIE);
      supabaseResponse.cookies.delete(SECURITY_PROMPT_DISMISSED_COOKIE);
    }
  }

  // 1. Unauthenticated -> login
  if (!user && !isPublic(pathname)) {
    return redirectTo(request, "/login", supabaseResponse, pathname);
  }

  // 2/3. Every session needs a cleared second factor before any protected
  //      route: the account's own (verified TOTP or a passkey on file) if
  //      it has one, otherwise the emailed-code fallback.
  //      (/auth/* is public, so all of these pages stay reachable.)
  if (user && !isPublic(pathname)) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal?.nextLevel === "aal2") {
      // 2. Verified authenticator app -> its per-session challenge is
      //    mandatory, same as ever.
      if (aal.currentLevel !== "aal2") {
        return redirectTo(request, "/auth/mfa", supabaseResponse, pathname);
      }
    } else {
      // No authenticator app. Passkeys don't affect `aal` above (see the
      // module comment), so check for one directly.
      const { data: passkeys } = await supabase.auth.passkey.list();
      const hasPasskey = Boolean(passkeys && passkeys.length > 0);

      if (!hasPasskey) {
        // 3. Nothing stronger on file -> fall back to a code emailed for
        //    this session.
        const emailOk =
          !freshSession &&
          request.cookies.get(EMAIL_MFA_VERIFIED_COOKIE)?.value === "1";
        if (!emailOk) {
          return redirectTo(request, EMAIL_MFA_PATH, supabaseResponse, pathname);
        }

        // 4. Cleared for this session, but still nothing stronger set up
        //    -> nudge every session (not just once) until they add one.
        const dismissed =
          !freshSession &&
          request.cookies.get(SECURITY_PROMPT_DISMISSED_COOKIE)?.value === "1";
        if (!dismissed) {
          return redirectTo(request, SECURITY_PROMPT_PATH, supabaseResponse, pathname);
        }
      }
    }

    // 5. Onboarding isn't finished -> force it, except on the onboarding
    //    flow itself (or every step would redirect to step 1).
    const onOnboardingPath =
      pathname === ONBOARDING_BASE || pathname.startsWith(ONBOARDING_BASE + "/");
    const onboarding = await getOnboardingStatus(supabase, user.sub);

    if (!onboarding.allDone) {
      if (!onOnboardingPath) {
        return redirectTo(request, ONBOARDING_BASE, supabaseResponse);
      }
    } else if (onOnboardingPath) {
      // 6. Already onboarded -> no reason to revisit the wizard.
      return redirectTo(request, "/dashboard", supabaseResponse);
    }
  }

  // IMPORTANT: always return supabaseResponse (or copy its cookies onto any
  // response you build) or the browser and server will desync sessions.
  return supabaseResponse;
}
