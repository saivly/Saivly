import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The org a user lands in when no [orgId] is already in the URL (bare
 * /dashboard, a server action that needs a path to revalidate, …). Same
 * "first membership row" convention as getOnboardingStatus — there's no
 * way to belong to a second organisation yet, so "first" and "theirs" are
 * equivalent in practice. See src/lib/onboarding/onboarding.ts.
 */
export async function getPrimaryOrganisationId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return data?.organisation_id ?? null;
}
