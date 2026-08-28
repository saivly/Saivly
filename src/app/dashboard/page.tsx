import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryOrganisationId } from "@/lib/organisation";

/**
 * Every post-login/post-onboarding redirect in the app points here
 * (login/actions.ts, proxy.ts, onboarding's finish steps, …) because none
 * of those call sites know the user's organisation id. Its only job is to
 * resolve that and forward to the real, org-scoped dashboard — nothing
 * renders at this URL.
 */
export default async function DashboardRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await getPrimaryOrganisationId(supabase, user.id);
  // No membership yet -> onboarding isn't done; the proxy would already
  // have routed here away from /onboarding, but guard it directly too
  // rather than redirecting into a /org/undefined/dashboard 404.
  if (!orgId) redirect("/onboarding");

  redirect(`/org/${orgId}/dashboard`);
}
