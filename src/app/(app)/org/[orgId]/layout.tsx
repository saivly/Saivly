import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { notFound, redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { Icon } from "@/components/dashboard/ui";
import { ICON_NAMES } from "@/components/dashboard/icons";
import { adyenConfig } from "@/lib/adyen/config";
import { initials } from "@/lib/dashboard/format";
import { adyenEnvironment, getOrgContext } from "@/lib/dashboard/org";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

// Only the glyphs the dashboard uses, so the icon font stays small.
const ICON_FONT_URL = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&icon_names=${ICON_NAMES.join(",")}&display=block`;

/** Browser tab shows the organisation's name, not the platform's. */
export async function generateMetadata({ params }: { params: Promise<{ orgId: string }> }): Promise<Metadata> {
  const ctx = await getOrgContext((await params).orgId);
  return ctx ? { title: ctx.organisation.name } : {};
}

/**
 * Shell for every org-scoped page (dashboard, payments, accounts, …).
 * The proxy already gates these routes, but we defense-in-depth check
 * again here — never rely on the proxy alone. getOrgContext's queries
 * run through RLS, so a bogus id and someone else's org both come back
 * as null, which doubles as the membership check.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const [ctx, t] = await Promise.all([getOrgContext(orgId), getT()]);

  if (!ctx) {
    // Signed out -> login; signed in but not a member -> 404 rather than a
    // redirect, so it doesn't confirm to a guessing user that the id exists.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    notFound();
  }

  const { organisation, profile, user, role } = ctx;
  const adyenConnected = adyenConfig("balancePlatform") !== null;
  const helpUrl = process.env.NEXT_PUBLIC_HELP_URL;
  const roleLabel = `${role === "owner" ? t("Owner") : t("Member")} · ${
    adyenEnvironment() === "live" ? t("Live") : t("Test")
  }`;

  return (
    <div className={`dash ${dmSans.variable} ${jetBrainsMono.variable} flex min-h-dvh flex-col md:flex-row`}>
      <link rel="stylesheet" href={ICON_FONT_URL} precedence="default" />
      <Sidebar
        orgId={organisation.id}
        orgName={organisation.name}
        userName={profile?.full_name}
        userEmail={user.email ?? ""}
        initials={initials(profile?.full_name, user.email ?? "?")}
        roleLabel={roleLabel}
      />
      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 hidden items-center gap-4 border-b border-db-border bg-white px-10 py-4 md:flex">
          <form action={`/org/${organisation.id}/payments`} role="search" className="max-w-[420px] flex-1">
            <input type="hidden" name="range" value="all" />
            <label className="flex items-center gap-2 rounded-lg border border-db-border bg-db-page px-3 py-2 text-db-muted focus-within:border-db-primary">
              <Icon name="search" size={18} />
              <input
                type="search"
                name="q"
                placeholder={t("Search payments, customers, references…")}
                aria-label={t("Search payments")}
                className="w-full bg-transparent text-sm text-db-ink outline-none placeholder:text-db-faint"
              />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-3">
            {adyenConnected ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-db-success-tint px-3 py-1 text-xs font-semibold text-db-success">
                <span className="h-[7px] w-[7px] rounded-full bg-db-success-dot" />
                {t("All systems operational")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-db-warning-tint px-3 py-1 text-xs font-semibold text-db-warning">
                <span className="h-[7px] w-[7px] rounded-full bg-current" />
                {t("Adyen not connected")}
              </span>
            )}
            {helpUrl && (
              <a
                href={helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("Help")}
                title={t("Help")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-db-border text-db-muted hover:bg-db-page hover:text-db-ink"
              >
                <Icon name="help" size={20} />
              </a>
            )}
          </div>
        </div>
        <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 md:px-10 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
