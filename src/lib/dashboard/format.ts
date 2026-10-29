import { intlLocale, type Locale } from "@/lib/i18n";

/**
 * Dates on the dashboard are shown in the organisation's local time.
 * Every organisation is Dutch for now (KVK/PDOK onboarding), so this is
 * one constant; make it a column on organisations if that changes.
 */
export const APP_TIME_ZONE = "Europe/Amsterdam";

/** ISO 4217 currencies whose minor unit isn't 1/100. */
const MINOR_UNIT_DIGITS: Record<string, number> = {
  JPY: 0, KRW: 0, ISK: 0, CLP: 0, VND: 0,
  BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3,
};

export function minorUnitDigits(currency: string): number {
  return MINOR_UNIT_DIGITS[currency] ?? 2;
}

/** Minor units (Adyen's format) -> major units. */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorUnitDigits(currency);
}

export function formatMoney(
  minor: number,
  currency: string,
  locale: Locale,
  opts: { compact?: boolean; signed?: boolean } = {}
): string {
  const digits = minorUnitDigits(currency);
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: opts.compact ? 0 : digits,
    maximumFractionDigits: opts.compact ? 0 : digits,
  }).format(toMajor(Math.abs(minor), currency));
  if (minor < 0) return `−${formatted}`;
  return opts.signed ? `+${formatted}` : formatted;
}

function fmt(iso: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: APP_TIME_ZONE, ...options }).format(new Date(iso));
}

/** "28 Oct 09:41" */
export function formatDateTime(iso: string, locale: Locale): string {
  return `${fmt(iso, locale, { day: "numeric", month: "short" })} ${fmt(iso, locale, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

/** "28 Oct" */
export function formatShortDate(iso: string, locale: Locale): string {
  return fmt(iso, locale, { day: "numeric", month: "short" });
}

/** "Thu 29 Oct" */
export function formatWeekdayDate(iso: string, locale: Locale): string {
  return fmt(iso, locale, { weekday: "short", day: "numeric", month: "short" });
}

/** "28 Oct 2026, 09:41" */
export function formatFullDateTime(iso: string, locale: Locale): string {
  return fmt(iso, locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "Nov" */
export function formatMonth(iso: string, locale: Locale): string {
  return fmt(iso, locale, { month: "short" });
}

/** Hour of day (0–23) in APP_TIME_ZONE. */
export function localHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", hour12: false }).format(date)
  ) % 24;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string | null | undefined, fallback: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
