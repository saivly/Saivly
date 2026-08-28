import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";

/**
 * Shell for every org-scoped page (dashboard, payments, accounts, …).
 * The proxy already gates these routes, but we defense-in-depth check
 * again here — never rely on the proxy alone. One check here covers every
 * page in the group, so individual pages don't need to repeat it.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // organisations' RLS policy (is_org_member) already scopes this select to
  // orgs the current user belongs to — a bogus id and someone else's org
  // both come back as "no row", not an error, so this doubles as the
  // membership check. Fetched alongside the profile, not gated behind it.
  const [{ data: organisation }, { data: profile }] = await Promise.all([
    supabase
      .from("organisations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  // Not a member of this org (or it doesn't exist) — a 404 rather than a
  // redirect so it doesn't confirm to a guessing user that the id exists.
  if (!organisation) notFound();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar
        orgId={organisation.id}
        orgName={organisation.name}
        userName={profile?.full_name}
        userEmail={user.email ?? ""}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
