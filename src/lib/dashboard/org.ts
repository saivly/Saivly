import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything most dashboard pages need about the current org, loaded
 * once per request (the layout and the page both call this; React's
 * cache() dedupes it). RLS scopes every query to orgs the user belongs
 * to, so a foreign orgId simply returns null.
 */
export const getOrgContext = cache(async (orgId: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: organisation }, { data: membership }, { data: profile }, { data: accounts }] = await Promise.all([
    supabase
      .from("organisations")
      .select(
        "id, name, country, kvk_number, default_currency, ip_allowlist_enabled, large_payment_alerts_enabled, adyen_account_holder_id"
      )
      .eq("id", orgId)
      .maybeSingle(),
    supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, first_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("balance_accounts")
      .select("id, adyen_balance_account_id, name, currency, is_primary, created_at")
      .eq("organisation_id", orgId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  if (!organisation || !membership) return null;

  return {
    user,
    organisation,
    role: membership.role,
    isOwner: membership.role === "owner",
    profile,
    accounts: accounts ?? [],
  };
});

export type OrgContext = NonNullable<Awaited<ReturnType<typeof getOrgContext>>>;

/** "live" when the app talks to Adyen's live environment, else "test". */
export function adyenEnvironment(): "live" | "test" {
  return process.env.ADYEN_ENVIRONMENT === "live" ? "live" : "test";
}
