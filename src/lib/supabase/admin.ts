import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client using the SECRET key (sb_secret_...). Bypasses RLS and can
 * call auth.admin.* — server-only, used here solely for the backup-code
 * recovery flow (deleting a lost TOTP factor).
 * NEVER import this from client components.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set — required for MFA recovery."
    );
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
