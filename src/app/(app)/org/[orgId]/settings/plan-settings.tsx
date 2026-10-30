"use client";

import { useState, useTransition } from "react";
import { useT } from "@/app/i18n-provider";
import { Button } from "@/components/dashboard/ui";
import { BANK_ACCOUNT_LIMITS, PLAN_DETAILS, PLAN_ORDER, type Plan } from "@/lib/plans";
import { upgradePlan } from "./actions";

/** Current plan, plus an upgrade option for every higher plan. */
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const eur = (n: number) =>
    new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-IE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  const price = (p: Plan) =>
    interval === "yearly"
      ? t("{price} per year", { price: eur(PLAN_DETAILS[p].yearlyPrice) })
      : t("{price} per month", { price: eur(PLAN_DETAILS[p].price) });
  const accounts = (p: Plan) => {
    const limit = BANK_ACCOUNT_LIMITS[p];
    return limit === null
      ? t("Unlimited bank accounts")
      : limit === 1
        ? t("1 bank account")
        : t("Up to {count} bank accounts", { count: limit });
  };

  const upgrades = PLAN_ORDER.slice(PLAN_ORDER.indexOf(plan) + 1);

  function upgrade(next: Plan) {
    const message = t("Upgrade to {plan} for {price}? The new price applies from your next billing period.", {
      plan: PLAN_DETAILS[next].name,
      price: price(next),
    });
    if (!window.confirm(message)) return;
    startTransition(async () => {
      const result = await upgradePlan(orgId, next);
      setError(result.error ? t(result.error) : null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-db-primary bg-db-tint px-4 py-3">
        <div>
          <p className="text-[13px] text-db-muted">{t("Current plan")}</p>
          <p className="text-lg font-bold text-db-ink">{PLAN_DETAILS[plan].name}</p>
          <p className="text-[13px] text-db-muted">{accounts(plan)}</p>
        </div>
        <p className="text-sm font-semibold text-db-ink">
          {price(plan)}
          <span className="block text-right text-[12px] font-normal text-db-muted">
            {interval === "yearly" ? t("Billed yearly") : t("Billed monthly")}
          </span>
        </p>
      </div>

      {upgrades.length === 0 ? (
        <p className="text-[13px] text-db-muted">{t("You're on our highest plan.")}</p>
      ) : (
        upgrades.map((p) => (
          <div
            key={p}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-db-row pt-4 first:border-t-0"
          >
            <div>
              <p className="text-sm font-semibold text-db-ink">{PLAN_DETAILS[p].name}</p>
              <p className="text-[13px] text-db-muted">
                {price(p)} · {accounts(p)}
              </p>
            </div>
            <Button
              type="button"
              icon="upgrade"
              disabled={disabled || pending}
              title={disabled ? t("Only organisation owners can change the plan.") : undefined}
              onClick={() => upgrade(p)}
            >
              {t("Upgrade to {plan}", { plan: PLAN_DETAILS[p].name })}
            </Button>
          </div>
        ))
      )}

      {error && <p className="text-sm text-db-danger">{error}</p>}
    </div>
  );
}
