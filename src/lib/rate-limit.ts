import { createClient } from "@/lib/supabase/server";

type RateLimitResult = {
  allowed: boolean;
  /** true when the DB function is missing/unreachable (run migration 0002). */
  unavailable?: boolean;
};

/**
 * Fixed-window rate limiter backed by Postgres (see migration 0002).
 * FAILS CLOSED: if the limiter itself errors, the action is denied —
 * for auth endpoints that's the correct default.
 */
export async function hitRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("rate limiter unavailable:", error.message);
    return { allowed: false, unavailable: true };
  }
  return { allowed: data === true };
}

export const RATE_LIMIT_UNAVAILABLE_MSG =
  "Sign-in is temporarily unavailable. (Developer: is migration 0002 applied?)";
export const TOO_MANY_ATTEMPTS_MSG =
  "Too many attempts. Wait a few minutes and try again.";
