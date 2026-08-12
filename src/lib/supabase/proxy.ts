import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getOnboardingStatus, hasSeenPasskeyPrompt } from "@/lib/onboarding/onboarding";

/**
 * Session refresher + route guard used by the root proxy (middleware).
 *
 * Enforcement ladder:
 *  0. Session open >2h (see SESSION_MAX_AGE_SECONDS) -> forced sign-out,
 *     then /login — regardless of AAL level or how recently they clicked
 *     around. Checked before everything else below.
 *  1. No session               -> /login
 *  2. Session but not AAL2     -> /auth/mfa/enroll (no TOTP factor yet)
 *                                 /auth/mfa        (factor exists, needs code)
 *  3. AAL2, onboarding unfinished, passkey prompt unseen -> /auth/passkey
 *  4. AAL2, onboarding unfinished -> /onboarding
 *  5. AAL2, onboarding done       -> pass through (and bounce away from
 *                                     /onboarding itself, done is done)
 *
 * TOTP is MANDATORY: there is no way to reach a protected route at aal1.
 * A passkey is not — /auth/passkey is a skippable, one-time interstitial
 * shown only to users still going through onboarding (step 3), never
 * re-shown to already-onboarded users.
 */

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/error"];
const ONBOARDING_BASE = "/onboarding";
const PASSKEY_PROMPT_PATH = "/auth/passkey";

// Absolute session cap, not an idle timeout — the clock starts at login
// and never resets just because the shopper stays active. Supabase's own
// access token normally auto-refreshes indefinitely as long as the
// browser keeps making requests, which would otherwise keep a session
// alive forever; this cookie is what actually bounds it. A fixed cookie
// (set once, checked every request, never bumped) rather than reading the
// JWT's own `iat` claim, because `iat` gets bumped forward on every token
// refresh (~hourly) and so never reflects the *original* login time.
export const SESSION_STARTED_COOKIE = "session_started_at";
const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60; // 2 hours

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
    }
  }

  // 1. Unauthenticated -> login
  if (!user && !isPublic(pathname)) {
    return redirectTo(request, "/login", supabaseResponse, pathname);
  }

  // 2. Authenticated but below AAL2 -> force MFA before any protected route.
  //    (/auth/* is public, so the MFA pages themselves stay reachable.)
  if (user && !isPublic(pathname)) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal?.currentLevel !== "aal2") {
      const target =
        aal?.nextLevel === "aal2" ? "/auth/mfa" : "/auth/mfa/enroll";
      return redirectTo(request, target, supabaseResponse, pathname);
    }

    // 4. AAL2 but onboarding isn't finished -> force it, except on the
    //    onboarding flow itself (or every step would redirect to step 1).
    const onOnboardingPath =
      pathname === ONBOARDING_BASE || pathname.startsWith(ONBOARDING_BASE + "/");
    const onboarding = await getOnboardingStatus(supabase, user.sub);

    if (!onboarding.allDone) {
      // 3. Still onboarding and hasn't seen the passkey prompt yet ->
      //    show it once, ahead of the wizard itself. Scoped to
      //    unfinished onboarding on purpose: already-onboarded users
      //    never hit this, so it can't reappear as a surprise interstitial
      //    for existing accounts once this feature ships.
      //    (/auth/passkey itself never reaches this branch — it's under
      //    the "/auth" prefix in PUBLIC_PATHS, same as /auth/mfa/enroll.)
      const promptSeen = await hasSeenPasskeyPrompt(supabase, user.sub);
      if (!promptSeen) {
        return redirectTo(request, PASSKEY_PROMPT_PATH, supabaseResponse);
      }
      if (!onOnboardingPath) {
        return redirectTo(request, ONBOARDING_BASE, supabaseResponse);
      }
    } else if (onOnboardingPath) {
      // 5. Already onboarded -> no reason to revisit the wizard.
      return redirectTo(request, "/dashboard", supabaseResponse);
    }
  }

  // IMPORTANT: always return supabaseResponse (or copy its cookies onto any
  // response you build) or the browser and server will desync sessions.
  return supabaseResponse;
}
