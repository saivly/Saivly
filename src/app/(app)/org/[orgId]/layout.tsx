import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { Icon } from "@/components/dashboard/ui";
import { LanguageMenu, ThemeToggle } from "@/components/preferences";
import { adyenConfig } from "@/lib/adyen/config";
import { initials } from "@/lib/dashboard/format";
import { adyenEnvironment, getOrgContext } from "@/lib/dashboard/org";
import { getLocale, getT, getTheme } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";

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
  const [ctx, t, locale, theme] = await Promise.all([getOrgContext(orgId), getT(), getLocale(), getTheme()]);

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
    <div className="flex min-h-dvh flex-col bg-db-page text-db-ink md:flex-row">
      <Sidebar
        orgId={organisation.id}
        orgName={organisation.name}
        userName={profile?.full_name}
        userEmail={user.email ?? ""}
        initials={initials(profile?.full_name, user.email ?? "?")}
        roleLabel={roleLabel}
      />
      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-4 border-b border-db-border bg-db-card px-4 py-3 sm:px-6 md:sticky md:top-0 md:z-30 md:px-10 md:py-4">
          <form action={`/org/${organisation.id}/payments`} role="search" className="hidden max-w-[420px] flex-1 sm:block">
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
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {adyenConnected ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-db-success-tint px-3 py-1 text-xs font-semibold text-db-success">
                <span className="h-[7px] w-[7px] rounded-full bg-db-success-dot" />
                <span className="hidden sm:inline">{t("All systems operational")}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-db-warning-tint px-3 py-1 text-xs font-semibold text-db-warning">
                <span className="h-[7px] w-[7px] rounded-full bg-current" />
                <span className="hidden sm:inline">{t("Adyen not connected")}</span>
              </span>
            )}
            <LanguageMenu locale={locale} label={t("Language")} />
            <ThemeToggle initialTheme={theme} />
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
