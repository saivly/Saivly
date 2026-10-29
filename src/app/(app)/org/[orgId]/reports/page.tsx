import { notFound } from "next/navigation";
import { Card, CardTitle, PageHeader } from "@/components/dashboard/ui";
import { formatBytes, formatFullDateTime } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";
import { getLocale, getT } from "@/lib/i18n-server";
import { STALE_REPORT_MINUTES } from "@/lib/dashboard/constants";
import { periodLabel } from "@/lib/reports/periods";
import { createClient } from "@/lib/supabase/server";
import ReportBuilder from "./report-builder";
import ReportsList, { type ReportItem } from "./reports-list";

const TYPE_LABELS = {
  transactions: "Transactions",
  settlements: "Settlements",
  balances: "Balances",
  disputes: "Disputes",
} as const;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const { orgId } = await params;
  const { account } = await searchParams;
  const [ctx, t, locale] = await Promise.all([getOrgContext(orgId), getT(), getLocale()]);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, report_type, period, period_start, balance_account_id, format, status, size_bytes, row_count, error, created_at")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .limit(30);

  const accountName = new Map(ctx.accounts.map((a) => [a.id, a.name]));
  const staleBefore = Date.now() - STALE_REPORT_MINUTES * 60_000;

  const items: ReportItem[] = (reports ?? []).map((r) => {
    const stale = r.status === "pending" && new Date(r.created_at).getTime() < staleBefore;
    const status = stale ? "failed" : r.status;
    const meta = [
      r.format.toUpperCase(),
      r.balance_account_id ? (accountName.get(r.balance_account_id) ?? t("Removed account")) : t("All accounts"),
      formatFullDateTime(r.created_at, locale),
      status === "ready" && r.size_bytes !== null ? formatBytes(r.size_bytes) : null,
      status === "ready" && r.row_count !== null ? t("{count} rows", { count: r.row_count }) : null,
    ].filter(Boolean);
    const name =
      r.report_type === "balances"
        ? t("Balances")
        : `${t(TYPE_LABELS[r.report_type])} — ${periodLabel(r.period, r.period_start, locale, t("year to date"))}`;
    return { id: r.id, format: r.format, name, meta: meta.join(" · "), status };
  });

  const preselected = ctx.accounts.some((a) => a.id === account) ? account! : "all";

  return (
    <>
      <PageHeader title={t("Reports")} subtitle={t("Generate and download reports for accounting and reconciliation.")} />

      <Card>
        <CardTitle>{t("Create a report")}</CardTitle>
        <ReportBuilder
          orgId={orgId}
          accounts={ctx.accounts.map((a) => ({ id: a.id, name: `${a.name} (${a.currency})` }))}
          defaultAccount={preselected}
        />
      </Card>

      <Card className="!p-0">
        <div className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-db-ink">{t("Available reports")}</h2>
        </div>
        <ReportsList orgId={orgId} items={items} />
      </Card>
    </>
  );
}
