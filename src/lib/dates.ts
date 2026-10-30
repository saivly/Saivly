/**
 * Intl.DateTimeFormat#format, but with month names capitalised.
 * Dutch writes them lowercase ("5 jan.", "januari 2026"); the app always
 * shows "5 Jan.", "Januari 2026". Only the month part changes.
 */
export function formatWithCapitalMonth(formatter: Intl.DateTimeFormat, date: Date): string {
  return formatter
    .formatToParts(date)
    .map((part) =>
      part.type === "month" ? part.value.charAt(0).toLocaleUpperCase() + part.value.slice(1) : part.value
    )
    .join("");
}
