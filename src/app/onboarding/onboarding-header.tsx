"use client";

import type { Locale, Theme } from "@/lib/i18n";
import { useT } from "@/app/i18n-provider";
import { LanguageMenu, ThemeToggle } from "@/components/preferences";
import { Icon } from "@/components/dashboard/ui";

export default function OnboardingHeader({
  locale,
  theme: initialTheme,
}: {
  locale: Locale;
  theme: Theme;
}) {
  const { t } = useT();
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-6">
        {/* Same brand mark as the dashboard sidebar. */}
        <span className="mr-auto flex items-center gap-3">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-db-bright text-white">
            <Icon name="account_balance" size={20} />
          </span>
          <span className="text-base font-bold tracking-[.02em] text-ink">Saivly</span>
        </span>
        <LanguageMenu locale={locale} label={t("Language")} />
        <ThemeToggle initialTheme={initialTheme} />
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-soft">
            {t("Log out")}
          </button>
        </form>
      </div>
    </header>
  );
}
