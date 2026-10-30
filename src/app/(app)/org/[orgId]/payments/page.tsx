import Link from "next/link";
import { notFound } from "next/navigation";
import { TransferStatus } from "@/components/dashboard/transfer-status";
import { Card, Icon, PageHeader, SegmentLink, Segmented, Table, TableEmpty, TableRow, buttonStyles } from "@/components/dashboard/ui";
import { PAYMENTS_PAGE_SIZE } from "@/lib/dashboard/constants";
import { formatDateTime, formatMoney } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";
import {
  PAYMENT_TABS,
  TAB_STATES,
  TRANSACTION_TYPES,
  TYPE_KINDS,
  filtersToQuery,
  parsePaymentFilters,
  rangeStart,
  searchExpression,
  type PaymentFilters,
  type PaymentTab,
  type TransactionType,
} from "@/lib/dashboard/payments-filters";
import { intlLocale } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { getPayoutButtonData } from "./payouts/payout-button-data";
import PayoutButton from "./payouts/payout-dialog";
import RangeSelect from "./range-select";

const COLUMNS = "1.2fr 1.1fr 1.5fr 1.2fr 0.9fr 1fr";
const TYPE_LABELS: Record<TransactionType, { label: string; icon: string }> = {
  all: { label: "All transactions", icon: "swap_horiz" },
  payments: { label: "Incoming payments", icon: "south_west" },
  payouts: { label: "Payouts", icon: "north_east" },
};
const TAB_LABELS: Record<PaymentTab, string> = {
  all: "All",
  succeeded: "Succeeded",
  pending: "Pending",
  failed: "Failed",
};

export default async function TransactionsPage({
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
      .in("kind", TYPE_KINDS[filters.type]);
    if (since) query = query.gte("adyen_created_at", since);
    if (search) query = query.or(search);
    return query;
  };

  const from = (filters.page - 1) * PAYMENTS_PAGE_SIZE;
  const states = TAB_STATES[filters.tab];
  let list = base(
    "id, adyen_created_at, kind, counterparty_name, counterparty_account, description, reference, adyen_transfer_id, state, amount_value, currency"
  );
  if (states) list = list.in("state", states);

  const [payoutButton, listResult, ...counts] = await Promise.all([
    getPayoutButtonData(ctx, t, locale),
    list.order("adyen_created_at", { ascending: false }).range(from, from + PAYMENTS_PAGE_SIZE - 1),
    ...PAYMENT_TABS.map((tab) => {
      const s = TAB_STATES[tab];
      return s ? base("id", true).in("state", s) : base("id", true);
    }),
  ]);

  type Row = {
    id: string;
    adyen_created_at: string;
    kind: "payment" | "payout";
    counterparty_name: string | null;
    counterparty_account: string | null;
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
      <PageHeader
        title={t("Transactions")}
        subtitle={t("Incoming payments and payouts to bank accounts.")}
        actions={
          <PayoutButton
            orgId={orgId}
            sources={payoutButton.sources}
            locale={intlLocale(locale)}
            disabledReason={payoutButton.disabledReason}
          />
        }
      />

      <Card className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <Segmented>
            {TRANSACTION_TYPES.map((type) => (
              <SegmentLink
                key={type}
                href={href({ type, page: 1 })}
                active={filters.type === type}
                icon={TYPE_LABELS[type].icon}
              >
                {t(TYPE_LABELS[type].label)}
              </SegmentLink>
            ))}
          </Segmented>

          <div className="flex flex-wrap items-center gap-2">
            <form role="search" className="min-w-[200px] flex-1">
              {filters.type !== "all" && <input type="hidden" name="type" value={filters.type} />}
              {filters.tab !== "all" && <input type="hidden" name="status" value={filters.tab} />}
              {filters.range !== "30d" && <input type="hidden" name="range" value={filters.range} />}
              <label className="flex items-center gap-2 rounded-lg border border-db-border bg-db-card px-3 py-2 text-db-muted focus-within:border-db-primary">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.q}
                  placeholder={t("Search name or reference")}
                  aria-label={t("Search transactions")}
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

        <div className="flex flex-wrap items-center gap-3 border-t border-db-row px-4 py-3 sm:px-5">
          <span className="text-[13px] text-db-muted">{t("Status")}</span>
          <Segmented>
            {PAYMENT_TABS.map((tab) => (
              <SegmentLink key={tab} href={href({ tab, page: 1 })} active={filters.tab === tab}>
                {t(TAB_LABELS[tab])}
                <span className="text-db-faint">{countByTab[tab]}</span>
              </SegmentLink>
            ))}
          </Segmented>
        </div>

        <Table
          columns={COLUMNS}
          head={[t("Date"), t("Type"), t("Name"), t("Reference"), t("Status"), t("Amount")]}
        >
          {rows.length === 0 ? (
            <TableEmpty>
              {filters.q || filters.tab !== "all" || filters.type !== "all"
                ? t("No transactions match these filters.")
                : t("No transactions in this period yet.")}
            </TableEmpty>
          ) : (
            rows.map((row) => {
              const payout = row.kind === "payout";
              return (
                <TableRow
                  key={row.id}
                  columns={COLUMNS}
                  cells={[
                    <span key="d" className="text-db-text">{formatDateTime(row.adyen_created_at, locale)}</span>,
                    <span key="t" className="inline-flex items-center gap-1.5 text-db-text">
                      <Icon name={payout ? "north_east" : "south_west"} size={16} className="text-db-muted" />
                      {payout ? t("Payout") : t("Incoming")}
                    </span>,
                    <span key="c" className="min-w-0">
                      <span className="block truncate font-medium">
                        {row.counterparty_name || row.description || (payout ? row.counterparty_account : null) || "—"}
                      </span>
                      {payout && row.counterparty_name && row.counterparty_account && (
                        <span className="block truncate font-mono text-xs text-db-muted">{row.counterparty_account}</span>
                      )}
                    </span>,
                    <span key="r" className="truncate font-mono text-xs text-db-muted">{row.reference || row.adyen_transfer_id}</span>,
                    <TransferStatus key="s" state={row.state} payout={payout} t={t} />,
                    <span key="a" className="font-semibold">
                      {payout
                        ? formatMoney(-row.amount_value, row.currency, locale)
                        : formatMoney(row.amount_value, row.currency, locale, { signed: true })}
                    </span>,
                  ]}
                />
              );
            })
          )}
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-db-row px-5 py-4">
          <span className="text-[13px] text-db-muted">
            {total === 0
              ? t("Showing 0 transactions")
              : t("Showing {from}–{to} of {total} transactions", {
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
