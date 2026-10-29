import { notFound } from "next/navigation";
import { TransferStatus } from "@/components/dashboard/transfer-status";
import { Card, Table, TableEmpty, TableRow } from "@/components/dashboard/ui";
import { getPayoutSchedule } from "@/lib/adyen/accounts";
import { formatMoney, formatShortDate, formatWeekdayDate } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";
import { getLocale, getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import PaymentsHeader from "../payments-header";

const COLUMNS = "1fr 1.6fr 1fr 1fr";
const PAYOUT_LIMIT = 50;

const SCHEDULE_LABELS: Record<string, string> = {
  daily: "Daily, T+1",
  weekly: "Weekly",
  monthly: "Monthly",
  balance: "When balance threshold is reached",
  cron: "Custom schedule",
};

export default async function PayoutsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [ctx, t, locale] = await Promise.all([getOrgContext(orgId), getT(), getLocale()]);
  if (!ctx) notFound();

  const primary = ctx.accounts.find((a) => a.is_primary) ?? ctx.accounts[0];
  const supabase = await createClient();

  const [{ data: payouts }, { data: upcoming }, schedule] = await Promise.all([
    supabase
      .from("transfers")
      .select("id, adyen_created_at, estimated_arrival_at, counterparty_account, state, amount_value, currency")
      .eq("organisation_id", orgId)
      .eq("kind", "payout")
      .order("adyen_created_at", { ascending: false })
      .limit(PAYOUT_LIMIT),
    supabase
      .from("transfers")
      .select("adyen_created_at, estimated_arrival_at, counterparty_account, amount_value, currency")
      .eq("organisation_id", orgId)
      .eq("kind", "payout")
      .in("state", ["pending", "in_transit"])
      .order("adyen_created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    primary ? getPayoutSchedule(primary.adyen_balance_account_id) : Promise.resolve(null),
  ]);

  const destination = upcoming?.counterparty_account ?? schedule?.destination ?? null;

  return (
    <>
      <PaymentsHeader orgId={orgId} view="payouts" t={t} />

      <section className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-db-side px-6 py-6 text-white sm:px-7">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-db-side-text">
            {upcoming
              ? t("Next payout · {date}", {
                  date: formatWeekdayDate(upcoming.estimated_arrival_at ?? upcoming.adyen_created_at, locale),
                })
              : t("Next payout")}
          </p>
          <p className="mt-1 truncate text-[32px] leading-tight font-bold">
            {upcoming ? formatMoney(upcoming.amount_value, upcoming.currency, locale) : t("Nothing scheduled")}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-db-side-text">
            <span>
              {t("Destination")}:{" "}
              <span className="font-mono text-white">{destination ?? t("No payout account yet")}</span>
            </span>
            <span>
              {t("Schedule")}:{" "}
              <span className="text-white">
                {schedule ? t(SCHEDULE_LABELS[schedule.schedule] ?? "Custom schedule") : t("Not set up")}
              </span>
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled
          title={t("On-demand payouts need a verified payout bank account. Contact support to enable them.")}
          className="inline-flex items-center gap-2 rounded-lg bg-db-bright px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("Pay out now")}
        </button>
      </section>

      <Card className="!p-0">
        <div className="p-5">
          <h2 className="text-base font-semibold text-db-ink">{t("Payout history")}</h2>
        </div>
        <Table
          columns={COLUMNS}
          minWidth={600}
          head={[t("Arrival date"), t("Destination"), t("Status"), t("Amount")]}
        >
          {(payouts ?? []).length === 0 ? (
            <TableEmpty>{t("No payouts yet.")}</TableEmpty>
          ) : (
            (payouts ?? []).map((row) => (
              <TableRow
                key={row.id}
                columns={COLUMNS}
                cells={[
                  <span key="d" className="text-db-text">
                    {formatShortDate(row.estimated_arrival_at ?? row.adyen_created_at, locale)}
                  </span>,
                  <span key="a" className="font-mono text-xs text-db-muted">{row.counterparty_account ?? "—"}</span>,
                  <TransferStatus key="s" state={row.state} payout t={t} />,
                  <span key="m" className="font-semibold">{formatMoney(row.amount_value, row.currency, locale)}</span>,
                ]}
              />
            ))
          )}
        </Table>
        {(payouts ?? []).length === PAYOUT_LIMIT && (
          <p className="border-t border-db-row px-5 py-4 text-[13px] text-db-muted">
            {t("Showing the latest {count} payouts. Use Reports for the full history.", { count: PAYOUT_LIMIT })}
          </p>
        )}
      </Card>
    </>
  );
}
