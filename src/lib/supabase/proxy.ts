import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getOnboardingStatus } from "@/lib/onboarding";

/**
 * Session refresher + route guard used by the root proxy (middleware).
 *
 * Enforcement ladder:
 *  1. No session               -> /login
 *  2. Session but not AAL2     -> /auth/mfa/enroll (no TOTP factor yet)
 *                                 /auth/mfa        (factor exists, needs code)
 *  3. AAL2, onboarding unfinished -> /onboarding
 *  4. AAL2, onboarding done       -> pass through (and bounce away from
 *                                     /onboarding itself, done is done)
 *
 * TOTP is MANDATORY: there is no way to reach a protected route at aal1.
 */

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/error"];
const ONBOARDING_BASE = "/onboarding";

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

    // 3. AAL2 but onboarding isn't finished -> force it, except on the
    //    onboarding flow itself (or every step would redirect to step 1).
    const onOnboardingPath =
      pathname === ONBOARDING_BASE || pathname.startsWith(ONBOARDING_BASE + "/");
    const onboarding = await getOnboardingStatus(supabase, user.sub);

    if (!onboarding.allDone && !onOnboardingPath) {
      return redirectTo(request, ONBOARDING_BASE, supabaseResponse);
    }
    // 4. Already onboarded -> no reason to revisit the wizard.
    if (onboarding.allDone && onOnboardingPath) {
      return redirectTo(request, "/dashboard", supabaseResponse);
    }
  }

  // IMPORTANT: always return supabaseResponse (or copy its cookies onto any
  // response you build) or the browser and server will desync sessions.
  return supabaseResponse;
}
