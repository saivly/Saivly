"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setLocale } from "@/app/preferences/actions";
import { LOCALES, LOCALE_NAMES, THEME_COOKIE, type Locale, type Messages, type Theme } from "@/lib/i18n";

export default function OnboardingHeader({
  locale,
  theme: initialTheme,
  t,
}: {
  locale: Locale;
  theme: Theme;
  t: Messages;
}) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-end gap-2 px-6">
        <LanguageMenu locale={locale} label={t["header.language"]} />
        <ThemeToggle initialTheme={initialTheme} t={t} />
        <form action="/auth/signout" method="post">
          <button className="rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-soft">
            {t["header.logout"]}
          </button>
        </form>
      </div>
    </header>
  );
}

function LanguageMenu({ locale, label }: { locale: Locale; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next !== locale) startTransition(() => setLocale(next));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-accent-soft hover:text-ink ${
          pending ? "opacity-60" : ""
        }`}
      >
        <GlobeIcon />
        <span className="font-medium">{locale.toUpperCase()}</span>
        <ChevronIcon />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-lg"
        >
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                onClick={() => choose(l)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink hover:bg-accent-soft"
              >
                {LOCALE_NAMES[l]}
                {l === locale && <CheckIcon />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ThemeToggle({ initialTheme, t }: { initialTheme: Theme; t: Messages }) {
  const [theme, setTheme] = useState(initialTheme);

  // Applied client-side straight away; the cookie lets the server render
  // the same theme on the next page load (see app/layout.tsx).
  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const label = theme === "dark" ? t["header.theme.toLight"] : t["header.theme.toDark"];
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-ink transition-colors hover:bg-accent-soft"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function GlobeIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg {...iconProps} width={14} height={14}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps} width={16} height={16}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}
