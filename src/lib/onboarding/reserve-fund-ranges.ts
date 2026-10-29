import type { T } from "@/lib/i18n";

// Options for the reserve-fund question on the business-activity step
// (see business-activity-form.tsx). The user picks a range rather than
// typing an amount; Adyen still needs a single number (annualTurnover /
// sourceOfFunds.amount), so each range carries a fixed `estimate` that's
// stored in annual_reserve_fund_contributions instead.
//
// Amounts are whole units of the company's own currency (see
// companyCountryCurrency in ./countries.ts). For homeowners' associations
// the question is asked per month — saveBusinessActivity multiplies the
// estimate by 12 before storing it.

export const RESERVE_FUND_RANGES = [
  { id: "under10k", min: 0, max: 10_000, estimate: 5_000 },
  { id: "10kTo50k", min: 10_000, max: 50_000, estimate: 30_000 },
  { id: "50kTo100k", min: 50_000, max: 100_000, estimate: 75_000 },
  { id: "over100k", min: 100_000, max: null, estimate: 150_000 },
] as const;

/** Lower bound of the open-ended "More than …" range, where the user
 * types the actual amount instead of relying on `estimate`. */
export const RESERVE_FUND_OPEN_RANGE_MIN = 100_000;

/** Parses the typed amount ("150.000", "150,000", "150000"). */
export function parseReserveFundAmount(raw: string | undefined): number {
  return Number((raw ?? "").replace(/[\s.,]/g, ""));
}

export type ReserveFundRangeId = (typeof RESERVE_FUND_RANGES)[number]["id"];

export const RESERVE_FUND_RANGE_IDS = RESERVE_FUND_RANGES.map((r) => r.id) as [
  ReserveFundRangeId,
  ...ReserveFundRangeId[],
];

export function reserveFundEstimate(id: ReserveFundRangeId): number {
  return RESERVE_FUND_RANGES.find((r) => r.id === id)!.estimate;
}

/** Maps a stored amount back to its range, for prefilling the form. */
export function reserveFundRangeFor(amount: number): ReserveFundRangeId {
  return (
    RESERVE_FUND_RANGES.find((r) => amount >= r.min && (r.max === null || amount < r.max)) ??
    RESERVE_FUND_RANGES[0]
  ).id;
}

export function reserveFundRangeLabel(
  id: ReserveFundRangeId,
  currency: string,
  t: T = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? "")),
  intlLocale = "en"
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).format(n);
  const r = RESERVE_FUND_RANGES.find((x) => x.id === id)!;
  if (r.min === 0) return t("Less than {amount}", { amount: fmt(r.max!) });
  if (r.max === null) return t("More than {amount}", { amount: fmt(r.min) });
  return t("Between {min} and {max}", { min: fmt(r.min), max: fmt(r.max) });
}
