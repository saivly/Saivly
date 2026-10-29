import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 proxy (formerly middleware.ts).
 * On Next.js 15, rename this file to `middleware.ts` and rename the
 * exported function to `middleware` — the body is identical.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets:
     * - _next/static, _next/image, favicon
     * - common image/font files, icons and the web manifest
     *   (browsers fetch these without a session; they must not redirect)
     * - api/webhooks/: server-to-server calls (Adyen) that never carry a
     *   login cookie. The login guard would 307 them to /login, so Adyen
     *   sees every delivery fail. Each webhook route authenticates the
     *   caller itself (Basic auth + HMAC signature) and fails closed.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/webhooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
