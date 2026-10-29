import Link from "next/link";
import { notFound } from "next/navigation";
import { TransferStatus } from "@/components/dashboard/transfer-status";
import { Card, Icon, SegmentLink, Segmented, Table, TableEmpty, TableRow, buttonStyles } from "@/components/dashboard/ui";
import { PAYMENTS_PAGE_SIZE } from "@/lib/dashboard/constants";
import { formatDateTime, formatMoney } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";
import {
  PAYMENT_TABS,
  TAB_STATES,
  filtersToQuery,
  parsePaymentFilters,
  rangeStart,
  searchExpression,
  type PaymentFilters,
  type PaymentTab,
} from "@/lib/dashboard/payments-filters";
import { getLocale, getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import PaymentsHeader from "./payments-header";
import RangeSelect from "./range-select";

const COLUMNS = "1.3fr 1.6fr 1.2fr 1fr 1fr";
const TAB_LABELS: Record<PaymentTab, string> = {
  all: "All",
  succeeded: "Succeeded",
  pending: "Pending",
  failed: "Failed",
};

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const filters = parsePaymentFilters(await searchParams);
  const [ctx, t, locale] = await Promise.all([getOrgContext(orgId), getT(), getLocale()]);
  if (!ctx) notFound();

  const supabase = await createClient();
  const since = rangeStart(filters.range);
  const search = searchExpression(filters.q);

  // Base query with everything but the status tab — shared by the list
  // and the per-tab counts so the counts always match what's listed.
  const base = (select: string, head = false) => {
    let query = supabase
      .from("transfers")
      .select(select, { count: "exact", head })
      .eq("organisation_id", orgId)
      .eq("kind", "payment");
    if (since) query = query.gte("adyen_created_at", since);
    if (search) query = query.or(search);
    return query;
  };

  const from = (filters.page - 1) * PAYMENTS_PAGE_SIZE;
  const states = TAB_STATES[filters.tab];
  let list = base("id, adyen_created_at, counterparty_name, description, reference, adyen_transfer_id, state, amount_value, currency");
  if (states) list = list.in("state", states);

  const [listResult, ...counts] = await Promise.all([
    list.order("adyen_created_at", { ascending: false }).range(from, from + PAYMENTS_PAGE_SIZE - 1),
    ...PAYMENT_TABS.map((tab) => {
      const s = TAB_STATES[tab];
      return s ? base("id", true).in("state", s) : base("id", true);
    }),
  ]);

  type Row = {
    id: string;
    adyen_created_at: string;
    counterparty_name: string | null;
    description: string | null;
    reference: string | null;
    adyen_transfer_id: string;
    state: "pending" | "in_transit" | "succeeded" | "failed";
    amount_value: number;
    currency: string;
  };
  const rows = (listResult.data ?? []) as unknown as Row[];
  const total = listResult.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE));
  const countByTab = Object.fromEntries(PAYMENT_TABS.map((tab, i) => [tab, counts[i]?.count ?? 0]));

  const href = (f: Partial<PaymentFilters>) => `/org/${orgId}/payments${filtersToQuery({ ...filters, ...f })}`;
  const exportHref = `/org/${orgId}/payments/export${filtersToQuery({ ...filters, page: 1 })}`;

  return (
    <>
      <PaymentsHeader orgId={orgId} view="payments" t={t} />

      <Card className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <Segmented>
            {PAYMENT_TABS.map((tab) => (
              <SegmentLink key={tab} href={href({ tab, page: 1 })} active={filters.tab === tab}>
                {t(TAB_LABELS[tab])}
                <span className="text-db-faint">{countByTab[tab]}</span>
              </SegmentLink>
            ))}
          </Segmented>

          <div className="flex flex-wrap items-center gap-2">
            <form role="search" className="min-w-[200px] flex-1">
              {filters.tab !== "all" && <input type="hidden" name="status" value={filters.tab} />}
              {filters.range !== "30d" && <input type="hidden" name="range" value={filters.range} />}
              <label className="flex items-center gap-2 rounded-lg border border-db-border bg-db-card px-3 py-2 text-db-muted focus-within:border-db-primary">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.q}
                  placeholder={t("Search customer or reference")}
                  aria-label={t("Search payments")}
                  className="w-full bg-transparent text-[13px] text-db-ink outline-none placeholder:text-db-faint"
                />
              </label>
            </form>
            <RangeSelect value={filters.range} />
            <a href={exportHref} className={buttonStyles.secondary} download>
              <Icon name="download" size={18} />
              {t("Export")}
            </a>
          </div>
        </div>

        <Table
          columns={COLUMNS}
          head={[t("Date"), t("Customer"), t("Reference"), t("Status"), t("Amount")]}
        >
          {rows.length === 0 ? (
            <TableEmpty>
              {filters.q || filters.tab !== "all"
                ? t("No payments match these filters.")
                : t("No payments in this period yet.")}
            </TableEmpty>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                columns={COLUMNS}
                cells={[
                  <span key="d" className="text-db-text">{formatDateTime(row.adyen_created_at, locale)}</span>,
                  <span key="c" className="font-medium">{row.counterparty_name || row.description || "—"}</span>,
                  <span key="r" className="font-mono text-xs text-db-muted">{row.reference || row.adyen_transfer_id}</span>,
                  <TransferStatus key="s" state={row.state} t={t} />,
                  <span key="a" className="font-semibold">{formatMoney(row.amount_value, row.currency, locale)}</span>,
                ]}
              />
            ))
          )}
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-db-row px-5 py-4">
          <span className="text-[13px] text-db-muted">
            {total === 0
              ? t("Showing 0 payments")
              : t("Showing {from}–{to} of {total} payments", {
                  from: from + 1,
                  to: Math.min(from + PAYMENTS_PAGE_SIZE, total),
                  total,
                })}
          </span>
          {pages > 1 && <Pagination page={filters.page} pages={pages} href={(page) => href({ page })} t={t} />}
        </div>
      </Card>
    </>
  );
}

function Pagination({
  page,
  pages,
  href,
  t,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  t: (s: string) => string;
}) {
  // First, last, and a window around the current page.
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const cell = "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-medium";
  return (
    <nav aria-label={t("Pagination")} className="flex items-center gap-1">
      <Link
        href={href(Math.max(1, page - 1))}
        aria-label={t("Previous page")}
        aria-disabled={page === 1}
        className={`${cell} border border-db-border text-db-muted hover:bg-db-page aria-disabled:pointer-events-none aria-disabled:opacity-40`}
      >
        <Icon name="chevron_left" size={18} />
      </Link>
      {shown.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - shown[i - 1] > 1 && <span className="px-1 text-db-faint">…</span>}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${cell} ${p === page ? "bg-db-primary text-white" : "border border-db-border text-db-ink hover:bg-db-page"}`}
          >
            {p}
          </Link>
        </span>
      ))}
      <Link
        href={href(Math.min(pages, page + 1))}
        aria-label={t("Next page")}
        aria-disabled={page === pages}
        className={`${cell} border border-db-border text-db-muted hover:bg-db-page aria-disabled:pointer-events-none aria-disabled:opacity-40`}
      >
        <Icon name="chevron_right" size={18} />
      </Link>
    </nav>
  );
}
