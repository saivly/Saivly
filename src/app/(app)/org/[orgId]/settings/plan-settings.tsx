"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/app/i18n-provider";
import { Button, Icon, StatusPill, buttonStyles } from "@/components/dashboard/ui";
import { BANK_ACCOUNT_LIMITS, PLAN_DETAILS, PLAN_ORDER, type Plan } from "@/lib/plans";
import { upgradePlan } from "./actions";

/** A few highlights per plan (same wording as the onboarding plan picker). */
const HIGHLIGHTS: Record<Plan, string[]> = {
  starter: ["Invite your accountant or bookkeeper", "Financial reporting and statements"],
  pro: ["Up to 4 team members", "Approval workflows for payments", "Schedule payments in advance"],
  enterprise: ["Unlimited team members", "Manage multiple legal entities", "Priority customer support"],
};

/** All plans side by side: the current one highlighted, higher ones upgradeable. */
export default function PlanSettings({
  orgId,
  plan,
  interval,
  disabled,
}: {
  orgId: string;
  plan: Plan;
  interval: "monthly" | "yearly";
  disabled: boolean;
}) {
  const { t, locale } = useT();
  const [confirming, setConfirming] = useState<Plan | null>(null);
  const [upgradedTo, setUpgradedTo] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const yearly = interval === "yearly";
  const eur = (n: number) =>
    new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-IE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  const amount = (p: Plan) => eur(yearly ? PLAN_DETAILS[p].yearlyPrice : PLAN_DETAILS[p].price);
  const per = yearly ? t("/ year") : t("/ month");
  const accounts = (p: Plan) => {
    const limit = BANK_ACCOUNT_LIMITS[p];
    if (limit === null) return t("Unlimited bank accounts");
    return limit === 1 ? t("1 bank account") : t("Up to {count} bank accounts", { count: limit });
  };
  const rank = (p: Plan) => PLAN_ORDER.indexOf(p);

  function confirmUpgrade() {
    if (!confirming) return;
    const next = confirming;
    startTransition(async () => {
      const result = await upgradePlan(orgId, next);
      if (result.error) {
        setError(t(result.error));
        return;
      }
      setError(null);
      setConfirming(null);
      setUpgradedTo(next);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {upgradedTo && upgradedTo === plan && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-db-tint px-4 py-3 text-sm font-medium text-db-primary"
        >
          <Icon name="check_circle" size={18} />
          {t("You're now on {plan}. Your new limits apply right away.", { plan: PLAN_DETAILS[plan].name })}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {PLAN_ORDER.map((p) => {
          const current = p === plan;
          const higher = rank(p) > rank(plan);
          return (
            <div
              key={p}
              className={`flex flex-col gap-4 rounded-xl border p-4 transition-colors ${
                current ? "border-db-primary bg-db-tint/40 ring-1 ring-db-primary" : "border-db-border"
              } ${!current && !higher ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-bold text-db-ink">{PLAN_DETAILS[p].name}</p>
                {current && <StatusPill tone="info">{t("Current plan")}</StatusPill>}
              </div>

              <p className="text-db-ink">
                <span className="text-[26px] leading-none font-bold">{amount(p)}</span>
                <span className="ml-1 text-[13px] text-db-muted">{per}</span>
              </p>

              <ul className="flex flex-1 flex-col gap-2 text-[13px] text-db-text">
                {[accounts(p), ...HIGHLIGHTS[p].map((h) => t(h))].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Icon name="check" size={16} className="mt-px shrink-0 text-db-primary" />
                    {line}
                  </li>
                ))}
              </ul>

              {current ? (
                <p className="py-2 text-center text-[13px] font-medium text-db-muted">
                  {yearly ? t("Billed yearly") : t("Billed monthly")}
                </p>
              ) : higher ? (
                <Button
                  type="button"
                  className="w-full justify-center"
                  disabled={disabled}
                  title={disabled ? t("Only organisation owners can change the plan.") : undefined}
                  onClick={() => {
                    setError(null);
                    setConfirming(p);
                  }}
                >
                  {t("Upgrade to {plan}", { plan: PLAN_DETAILS[p].name })}
                </Button>
              ) : (
                <p className="py-2 text-center text-[13px] text-db-muted">{t("Included in your plan")}</p>
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <UpgradeDialog
          from={plan}
          to={confirming}
          price={`${amount(confirming)} ${per}`}
          gains={[accounts(confirming), ...HIGHLIGHTS[confirming].map((h) => t(h))]}
          pending={pending}
          error={error}
          onCancel={() => !pending && setConfirming(null)}
          onConfirm={confirmUpgrade}
        />
      )}
    </div>
  );
}

function UpgradeDialog({
  from,
  to,
  price,
  gains,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  from: Plan;
  to: Plan;
  price: string;
  gains: string[];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,27,45,.45)] p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-[14px] bg-db-card p-7 text-db-ink shadow-[0_20px_50px_-10px_rgba(15,27,45,.35)]"
      >
        <span className="inline-flex w-fit rounded-lg bg-db-tint p-2 text-db-primary">
          <Icon name="workspace_premium" size={22} />
        </span>
        <div>
          <h2 id="upgrade-title" className="text-lg font-bold">
            {t("Upgrade to {plan}", { plan: PLAN_DETAILS[to].name })}
          </h2>
          <p className="mt-1 text-sm text-db-muted">
            {t("From {from} to {to} · {price}", {
              from: PLAN_DETAILS[from].name,
              to: PLAN_DETAILS[to].name,
              price,
            })}
          </p>
        </div>

        <ul className="flex flex-col gap-2 rounded-lg bg-db-page px-4 py-3 text-sm">
          {gains.map((g) => (
            <li key={g} className="flex items-start gap-2">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-db-primary" />
              {g}
            </li>
          ))}
        </ul>

        <p className="text-[13px] text-db-muted">
          {t("Your new limits apply right away. The new price applies from your next billing period.")}
        </p>

        {error && <p className="text-sm text-db-danger">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" disabled={pending} onClick={onCancel} className={`${buttonStyles.secondary} text-sm`}>
            {t("Cancel")}
          </button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending ? t("Upgrading…") : t("Confirm upgrade")}
          </Button>
        </div>
      </div>
    </div>
  );
}
