"use client";

import type { Locale, Theme } from "@/lib/i18n";
import { useT } from "@/app/i18n-provider";
import { LanguageMenu, ThemeToggle } from "@/components/preferences";
import { Logo } from "@/components/logo";

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
        <Logo size={20} markSize={24} className="mr-auto" />
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
