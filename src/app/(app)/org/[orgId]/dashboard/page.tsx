import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Card, CardTitle, IconChip, PageHeader, type ChipTone } from "@/components/dashboard/ui";
import { getBalanceAccount, primaryBalance } from "@/lib/adyen/accounts";
import { formatDateTime, formatMoney, localHour, toMajor } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";
import { getLocale, getT } from "@/lib/i18n-server";
import { createT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import VolumeChart from "./volume-chart";

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function StatCard({
  label,
  icon,
  tone,
  value,
  delta,
}: {
  label: string;
  icon: string;
  tone: ChipTone;
  value: string;
  delta: { text: string; positive: boolean | null };
}) {
  return (
    <Card className="flex flex-col gap-3 !p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-db-muted">{label}</span>
        <IconChip name={icon} tone={tone} size={18} />
      </div>
      <span className="truncate text-[26px] leading-tight font-bold text-db-ink">{value}</span>
      <span
        className={`text-[13px] font-medium ${
          delta.positive === null ? "text-db-muted" : delta.positive ? "text-db-success" : "text-db-danger"
        }`}
      >
        {delta.text}
      </span>
    </Card>
  );
}

export default async function OverviewPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [ctx, t, locale] = await Promise.all([getOrgContext(orgId), getT(), getLocale()]);
  if (!ctx) notFound();

  const { organisation, profile, accounts } = ctx;
  const currency = organisation.default_currency;
  const supabase = await createClient();

  const [{ data: stats }, { data: volume }, { data: recent }, balances] = await Promise.all([
    supabase.rpc("transfer_stats", { org_id: orgId, p_currency: currency }),
    supabase.rpc("transfer_monthly_volume", { org_id: orgId, p_currency: currency }),
    supabase
      .from("transfers")
      .select("id, direction, kind, state, amount_value, currency, counterparty_name, description, reference, adyen_created_at")
      .eq("organisation_id", orgId)
      .order("adyen_created_at", { ascending: false })
      .limit(6),
    Promise.all(
      accounts
        .filter((a) => a.currency === currency)
        .map(async (a) => primaryBalance(await getBalanceAccount(a.adyen_balance_account_id), currency))
    ),
  ]);

  const s = stats?.[0];
  const knownBalances = balances.filter((b) => b !== null);
  const totalBalance = knownBalances.reduce((sum, b) => sum + b.balance, 0);

  const deltaText = (pct: number | null) =>
    pct === null
      ? { text: t("No data for the previous 30 days"), positive: null }
      : {
          text: t("{change} vs previous 30 days", {
            change: `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`,
          }),
          positive: pct >= 0,
        };

  const rate = (ok: number, failed: number) => (ok + failed === 0 ? null : (ok / (ok + failed)) * 100);
  const successRate = s ? rate(s.succeeded_30d, s.failed_30d) : null;
  const previousRate = s ? rate(s.succeeded_prev, s.failed_prev) : null;
  const rateDelta =
    successRate !== null && previousRate !== null
      ? {
          text: t("{change} pts vs previous 30 days", {
            change: `${successRate >= previousRate ? "+" : "−"}${Math.abs(successRate - previousRate).toFixed(1)}`,
          }),
          positive: successRate >= previousRate,
        }
      : { text: t("No data for the previous 30 days"), positive: null };

  const hour = localHour();
  const greeting = hour < 12 ? "Good morning, {name}" : hour < 18 ? "Good afternoon, {name}" : "Good evening, {name}";
  const firstName = profile?.first_name || profile?.full_name?.split(" ")[0] || "";

  const chartData = (volume ?? []).map((row) => ({
    month: row.month,
    incoming: toMajor(row.incoming, currency),
    outgoing: toMajor(row.outgoing, currency),
  }));

  return (
    <>
      <PageHeader
        title={firstName ? t(greeting, { name: firstName }) : t("Overview")}
        subtitle={t("Here's what's happening with {org} today.", { org: organisation.name })}
        actions={
          <ButtonLink href={`/org/${orgId}/payments`} icon="add">
            {t("New payment")}
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <StatCard
          label={t("Total balance")}
          icon="account_balance"
          tone="blue"
          value={knownBalances.length > 0 ? formatMoney(totalBalance, currency, locale) : "—"}
          delta={{
            text:
              knownBalances.length > 0
                ? t("Across {count} {currency} accounts", { count: knownBalances.length, currency })
                : t("Balance unavailable"),
            positive: null,
          }}
        />
        <StatCard
          label={t("Incoming (30 days)")}
          icon="south_west"
          tone="green"
          value={formatMoney(s?.incoming_30d ?? 0, currency, locale)}
          delta={deltaText(s ? pctChange(s.incoming_30d, s.incoming_prev) : null)}
        />
        <StatCard
          label={t("Outgoing (30 days)")}
          icon="north_east"
          tone="amber"
          value={formatMoney(s?.outgoing_30d ?? 0, currency, locale)}
          delta={deltaText(s ? pctChange(s.outgoing_30d, s.outgoing_prev) : null)}
        />
        <StatCard
          label={t("Success rate")}
          icon="verified"
          tone="violet"
          value={successRate === null ? "—" : `${successRate.toFixed(1)}%`}
          delta={rateDelta}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] items-start gap-4">
        <Card>
          <VolumeChart data={chartData} currency={currency} locale={locale} />
        </Card>

        <RecentActivity orgId={orgId} rows={recent ?? []} locale={locale} />
      </div>
    </>
  );
}

function RecentActivity({
  orgId,
  rows,
  locale,
}: {
  orgId: string;
  rows: {
    id: string;
    direction: "incoming" | "outgoing";
    kind: "payment" | "payout" | "other";
    state: string;
    amount_value: number;
    currency: string;
    counterparty_name: string | null;
    description: string | null;
    reference: string | null;
    adyen_created_at: string;
  }[];
  locale: Awaited<ReturnType<typeof getLocale>>;
}) {
  const t = createT(locale);
  return (
    <Card>
      <CardTitle
        aside={
          <Link href={`/org/${orgId}/payments`} className="text-[13px] font-semibold text-db-primary hover:underline">
            {t("View all")}
          </Link>
        }
      >
        {t("Recent activity")}
      </CardTitle>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-db-muted">
          {t("No activity yet. Payments and payouts appear here as soon as Adyen reports them.")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            const incoming = row.direction === "incoming";
            const name =
              row.counterparty_name ||
              row.description ||
              (row.kind === "payout" ? t("Payout") : row.reference) ||
              t("Transfer");
            return (
              <li key={row.id} className="flex items-center gap-3 border-t border-db-row py-3 first:border-t-0 first:pt-0">
                <IconChip
                  name={row.state === "failed" ? "error" : incoming ? "south_west" : "north_east"}
                  tone={row.state === "failed" ? "red" : incoming ? "green" : "blue"}
                  round
                  size={18}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-db-ink">{name}</span>
                  <span className="block text-xs text-db-faint">{formatDateTime(row.adyen_created_at, locale)}</span>
                </span>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    incoming ? "text-db-success" : "text-db-ink"
                  } ${row.state === "failed" ? "line-through opacity-60" : ""}`}
                >
                  {formatMoney(incoming ? row.amount_value : -row.amount_value, row.currency, locale, {
                    signed: incoming,
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
