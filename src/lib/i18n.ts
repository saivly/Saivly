// Language + theme preferences, both kept in plain cookies so the server
// can render the right <html lang> / .dark class on the first paint.
//
// Translations are keyed by the English text itself: code writes
// t("Date of birth") and gets the Dutch version when the locale is "nl"
// (see ./translations/nl.ts), or the English text unchanged otherwise.
// Anything missing from the Dutch map falls back to English.

import { NL } from "./translations/nl";

export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";

export function toLocale(value: string | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

export function toTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
};

/** BCP 47 tag for Intl formatting (numbers, currencies, months, countries). */
export function intlLocale(locale: Locale): string {
  return locale === "nl" ? "nl-NL" : "en-GB";
}

export type TranslateVars = Record<string, string | number>;
export type T = (text: string, vars?: TranslateVars) => string;

/** Returns a translator for `locale`. `{name}` placeholders are filled from `vars`. */
export function createT(locale: Locale): T {
  return (text, vars) => {
    const translated = locale === "nl" ? (NL[text] ?? text) : text;
    if (!vars) return translated;
    return translated.replace(/\{(\w+)\}/g, (m: string, key: string) =>
      key in vars ? String(vars[key]) : m
    );
  };
}
