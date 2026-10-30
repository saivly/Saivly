import { APP_TIME_ZONE } from "@/lib/dashboard/format";
import type { ReportPeriod } from "@/lib/dashboard/constants";
import { intlLocale, type Locale } from "@/lib/i18n";
import { formatWithCapitalMonth } from "@/lib/dates";

/** Offset (ms) of APP_TIME_ZONE from UTC at a given instant. */
function zoneOffset(at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - at;
}

/** Midnight on the 1st of (year, month) in APP_TIME_ZONE, as a Date. Month may overflow. */
function localMonthStart(year: number, month: number): Date {
  const guess = Date.UTC(year, month, 1);
  return new Date(guess - zoneOffset(guess - zoneOffset(guess)));
}

function localYearMonth(now: Date): { year: number; month: number } {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit" })
    .format(now)
    .split("-");
  return { year: +y, month: +m - 1 };
}

export type PeriodRange = { start: Date; end: Date };

/** [start, end) of a report period, relative to `now`. "This" periods end now. */
export function periodRange(period: ReportPeriod, now = new Date()): PeriodRange {
  const { year, month } = localYearMonth(now);
  const quarterStart = month - (month % 3);
  switch (period) {
    case "this_month":
      return { start: localMonthStart(year, month), end: now };
    case "last_month":
      return { start: localMonthStart(year, month - 1), end: localMonthStart(year, month) };
    case "this_quarter":
      return { start: localMonthStart(year, quarterStart), end: now };
    case "last_quarter":
      return { start: localMonthStart(year, quarterStart - 3), end: localMonthStart(year, quarterStart) };
    case "year_to_date":
      return { start: localMonthStart(year, 0), end: now };
  }
}

/** "October 2026", "Q3 2026", "2026 year to date" — from the stored period + start. */
export function periodLabel(period: ReportPeriod, startIso: string, locale: Locale, ytdText = "year to date"): string {
  const start = new Date(startIso);
  const { year, month } = localYearMonth(start);
  if (period === "this_month" || period === "last_month") {
    return formatWithCapitalMonth(new Intl.DateTimeFormat(intlLocale(locale), { timeZone: APP_TIME_ZONE, month: "long", year: "numeric" }), start);
  }
  if (period === "this_quarter" || period === "last_quarter") return `Q${Math.floor(month / 3) + 1} ${year}`;
  return `${year} ${ytdText}`;
}
