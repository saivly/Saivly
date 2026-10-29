/**
 * URL query params for the Payments table (?status=&q=&range=&page=),
 * parsed once and shared by the page and its CSV export, so both always
 * show the same rows. Filtering happens in the database query.
 */

export const PAYMENT_TABS = ["all", "succeeded", "pending", "failed"] as const;
export type PaymentTab = (typeof PAYMENT_TABS)[number];

export const PAYMENT_RANGES = ["7d", "30d", "90d", "all"] as const;
export type PaymentRange = (typeof PAYMENT_RANGES)[number];

export const TAB_STATES: Record<PaymentTab, ("pending" | "in_transit" | "succeeded" | "failed")[] | null> = {
  all: null,
  succeeded: ["succeeded"],
  pending: ["pending", "in_transit"],
  failed: ["failed"],
};

export type PaymentFilters = { tab: PaymentTab; q: string; range: PaymentRange; page: number };

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parsePaymentFilters(raw: Raw): PaymentFilters {
  const tab = first(raw.status).toLowerCase();
  const range = first(raw.range);
  const page = Number.parseInt(first(raw.page), 10);
  return {
    tab: (PAYMENT_TABS as readonly string[]).includes(tab) ? (tab as PaymentTab) : "all",
    // Characters with meaning inside a PostgREST or()/ilike filter are dropped.
    q: first(raw.q).replace(/[,()*%\\:"]/g, " ").trim().slice(0, 80),
    range: (PAYMENT_RANGES as readonly string[]).includes(range) ? (range as PaymentRange) : "30d",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** ISO lower bound for the date range, or null for "all time". */
export function rangeStart(range: PaymentRange): string | null {
  const days = { "7d": 7, "30d": 30, "90d": 90, all: 0 }[range];
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
}

/** PostgREST or() expression for the free-text search. */
export function searchExpression(q: string): string | null {
  if (!q) return null;
  return ["counterparty_name", "reference", "description", "adyen_transfer_id"].map((c) => `${c}.ilike.*${q}*`).join(",");
}

export function filtersToQuery(f: Partial<PaymentFilters>): string {
  const params = new URLSearchParams();
  if (f.tab && f.tab !== "all") params.set("status", f.tab);
  if (f.q) params.set("q", f.q);
  if (f.range && f.range !== "30d") params.set("range", f.range);
  if (f.page && f.page > 1) params.set("page", String(f.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}
