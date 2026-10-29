"use client";

import { useActionState, useState } from "react";
import { useT } from "@/app/i18n-provider";
import { Button, Field, IconChip, Segmented, inputStyles, segmentStyles, type ChipTone } from "@/components/dashboard/ui";
import { REPORT_FORMATS, REPORT_PERIODS, type ReportFormat, type ReportPeriod, type ReportType } from "@/lib/dashboard/constants";
import { createReport, type CreateReportState } from "./actions";

const TYPES: { value: ReportType; title: string; description: string; icon: string; tone: ChipTone }[] = [
  { value: "transactions", title: "Transactions", description: "Every payment, payout and transfer.", icon: "receipt_long", tone: "blue" },
  { value: "settlements", title: "Settlements", description: "Payouts to your bank account.", icon: "account_balance", tone: "green" },
  { value: "balances", title: "Balances", description: "Current balance per account.", icon: "account_balance_wallet", tone: "violet" },
  { value: "disputes", title: "Disputes", description: "Chargebacks and their outcome.", icon: "gavel", tone: "amber" },
];

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  last_quarter: "Last quarter",
  year_to_date: "Year to date",
};

export default function ReportBuilder({
  orgId,
  accounts,
  defaultAccount,
}: {
  orgId: string;
  accounts: { id: string; name: string }[];
  defaultAccount: string;
}) {
  const { t } = useT();
  const [type, setType] = useState<ReportType>("transactions");
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [state, action, pending] = useActionState<CreateReportState, FormData>(createReport, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="format" value={format} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-db-text">{t("Report type")}</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {TYPES.map((option) => {
            const selected = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setType(option.value)}
                className={`flex items-start gap-3 rounded-[10px] p-4 text-left transition-colors ${
                  selected
                    ? "border-[1.5px] border-db-primary bg-db-selected"
                    : "border-[1.5px] border-db-border bg-white hover:bg-db-subtle"
                }`}
              >
                <IconChip name={option.icon} tone={option.tone} size={18} />
                <span>
                  <span className="block text-sm font-semibold text-db-ink">{t(option.title)}</span>
                  <span className="block text-xs text-db-muted">{t(option.description)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] items-end gap-4">
        <Field label={t("Period")}>
          <select name="period" defaultValue="last_month" disabled={type === "balances"} className={inputStyles}>
            {REPORT_PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(PERIOD_LABELS[p])}
              </option>
            ))}
          </select>
        </Field>
        {/* A disabled select isn't submitted — balances are always "as of now". */}
        {type === "balances" && <input type="hidden" name="period" value="this_month" />}
        <Field label={t("Account")}>
          <select name="account" defaultValue={defaultAccount} className={inputStyles}>
            <option value="all">{t("All accounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-db-text">{t("Format")}</span>
          <Segmented className="w-fit">
            {REPORT_FORMATS.map((f) => (
              <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)} className={segmentStyles(format === f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </Segmented>
        </div>
        <Button type="submit" icon="description" disabled={pending} className="justify-self-start">
          {pending ? t("Starting…") : t("Generate report")}
        </Button>
      </div>
      {state.error && <p className="text-sm text-db-danger">{t(state.error)}</p>}
    </form>
  );
}
