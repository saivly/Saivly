import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";

/**
 * Shell for every post-onboarding page (dashboard, payments, accounts, …).
 * The proxy already gates these routes, but we defense-in-depth check
 * again here — never rely on the proxy alone. One check here covers every
 * page in the group, so individual pages don't need to repeat it.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-dvh md:flex-row flex-col">
      <Sidebar userName={profile?.full_name} userEmail={user.email ?? ""} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
