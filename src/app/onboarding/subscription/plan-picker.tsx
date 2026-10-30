"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { PLAN_OPTIONS, BILLING_INTERVALS } from "@/lib/zod";
import { useT } from "@/app/i18n-provider";
import { PLAN_DETAILS } from "@/lib/plans";

type PlanId = (typeof PLAN_OPTIONS)[number];
type BillingInterval = (typeof BILLING_INTERVALS)[number];

const formatEur = (n: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);

type Feature = { icon: IconName; title: string; detail?: string };

type Plan = {
  id: PlanId;
  name: string;
  description: string;
  price: number;
  /** Set by hand so it's a clean number — not derived from price. */
  yearlyPrice: number;
  badge?: string;
  includesFrom?: string;
  features: Feature[];
};

const FREE_MONTH: Feature = {
  icon: "gift",
  title: "1 month free of charge",
  detail: "Try any plan free for 30 days",
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description:
      "Your business finances, simplified. Manage payments, receipts, and everyday banking in one place.",
    price: PLAN_DETAILS.starter.price,
    yearlyPrice: PLAN_DETAILS.starter.yearlyPrice,
    badge: "Most popular",
    features: [
      FREE_MONTH,
      { icon: "bank", title: "One business IBAN" },
      { icon: "user-plus", title: "Invite your accountant or bookkeeper" },
      { icon: "receipt", title: "Scan and organize receipts" },
      { icon: "repeat", title: "Set up 4 recurring payments" },
      { icon: "download", title: "Financial reporting and statements" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description:
      "Give your team the tools to spend smarter, automate admin, and stay in control of every transaction.",
    price: PLAN_DETAILS.pro.price,
    yearlyPrice: PLAN_DETAILS.pro.yearlyPrice,
    includesFrom: "Starter",
    features: [
      FREE_MONTH,
      { icon: "users", title: "Up to 4 team members" },
      { icon: "percent", title: "1% interest on overnight balances" },
      { icon: "card", title: "1 physical and 5 virtual cards" },
      { icon: "check-circle", title: "Approval workflows for payments" },
      { icon: "calendar", title: "Schedule payments in advance" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description:
      "Run the finances of multiple legal entities on one platform, with one login. Switch between entities instantly and see everything in one consolidated view.",
    price: PLAN_DETAILS.enterprise.price,
    yearlyPrice: PLAN_DETAILS.enterprise.yearlyPrice,
    includesFrom: "Pro",
    features: [
      FREE_MONTH,
      { icon: "users", title: "Unlimited team members" },
      { icon: "card", title: "multiple physical and virtual cards" },
      { icon: "building", title: "Manage multiple legal entities" },
      { icon: "list-checks", title: "Multi-level payment approval workflows" },
      { icon: "headset", title: "Priority customer support" },
    ],
  },
];

// Biggest yearly discount across plans, for the toggle's "Save up to" label.
const MAX_YEARLY_DISCOUNT = Math.floor(
  Math.max(...PLANS.map((p) => (1 - p.yearlyPrice / (p.price * 12)) * 100))
);

// TODO: point these at the real documents once they're published.
const TERMS_URL = "/terms";
const PRIVACY_URL = "/privacy";

function SubmitButton({ planName, disabled }: { planName: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      disabled={pending || disabled}
      className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-db-primary-hover disabled:opacity-50"
    >
      {pending ? t("Saving…") : t("Continue with {plan}", { plan: planName })}
    </button>
  );
}

export default function PlanPicker({
  action,
  initialPlan,
  initialInterval,
}: {
  action: (formData: FormData) => Promise<void>;
  initialPlan: PlanId | null;
  initialInterval: BillingInterval | null;
}) {
  const { t, locale } = useT();
  const eur = (n: number) => formatEur(n, locale === "nl" ? "nl-NL" : "en-IE");
  const [selected, setSelected] = useState<PlanId>(initialPlan ?? "starter");
  const [interval, setBillingInterval] = useState<BillingInterval>(initialInterval ?? "monthly");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const plan = PLANS.find((p) => p.id === selected) ?? PLANS[0];
  const yearly = interval === "yearly";
  const fullYearly = plan.price * 12;
  const yearlyTotal = plan.yearlyPrice;
  const yearlySaving = fullYearly - yearlyTotal;

  return (
    <form noValidate action={action} className="flex flex-col gap-5">
      <input type="hidden" name="plan" value={plan.id} />
      <input type="hidden" name="billingInterval" value={interval} />

      {/* Promo banner */}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-accent-soft px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel text-ink">
          <Icon name="gift" />
        </span>
        <div>
          <p className="text-sm font-medium">{t("Your first month is free")}</p>
          <p className="text-xs text-muted">{t("Try any plan free for 30 days. Cancel anytime.")}</p>
        </div>
      </div>

      {/* Billing interval toggle */}
      <div className="flex justify-center">
        <div role="radiogroup" aria-label={t("Billing")} className="inline-flex gap-1 rounded-full bg-accent-soft p-1">
          {BILLING_INTERVALS.map((i) => {
            const active = i === interval;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBillingInterval(i)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {i === "monthly" ? t("Monthly") : t("Yearly")}
                {i === "yearly" && (
                  <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
                    {t("Save up to {percent}%", { percent: MAX_YEARLY_DISCOUNT })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Segmented plan switcher */}
      <div
        role="tablist"
        aria-label={t("Plans")}
        className="grid grid-cols-3 gap-1 rounded-lg bg-accent-soft p-1"
      >
        {PLANS.map((p) => {
          const active = p.id === plan.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(p.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Plan card */}
      <div role="tabpanel" className="rounded-xl border border-line bg-panel p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
          {plan.badge && (
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent">
              {t(plan.badge)}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">{t(plan.description)}</p>

        <div className="my-5 border-t border-line" />

        <p className="flex items-baseline gap-1.5">
          {yearly && (
            <span className="text-lg text-muted line-through">{eur(fullYearly)}</span>
          )}
          <span className="text-3xl font-semibold tracking-tight">
            {eur(yearly ? yearlyTotal : plan.price)}
          </span>
          <span className="text-sm text-muted">{yearly ? t("per year") : t("per month")}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {yearly
            ? t("You save {amount} compared to monthly billing", { amount: eur(yearlySaving) })
            : t("Billed monthly. Switch to yearly and save {amount}.", { amount: eur(yearlySaving) })}
        </p>

        <div className="my-5 border-t border-line" />

        {plan.includesFrom && (
          <p className="mb-3 text-xs text-muted">
            {t("Everything in {plan}, plus", { plan: plan.includesFrom })}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {plan.features.map((f, i) => (
            <li key={f.title} className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-ink">
                <Icon name={f.icon} />
              </span>
              <div>
                <p className={`text-sm ${i === 0 ? "font-medium text-ink" : "text-muted"}`}>
                  {t(f.title)}
                </p>
                {f.detail && <p className="text-xs text-muted">{t(f.detail)}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          name="acceptTerms"
          value="on"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-accent"
        />
        <span>
          {t("I agree to the")}{" "}
          <a href={TERMS_URL} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
            {t("Terms of Service")}
          </a>{" "}
          {t("and")}{" "}
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
            {t("Privacy Policy")}
          </a>
          .
        </span>
      </label>

      <SubmitButton planName={plan.name} disabled={!acceptedTerms} />
    </form>
  );
}

const ICON_PATHS = {
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  "user-plus": (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </>
  ),
  receipt: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  tag: (
    <>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  gauge: (
    <>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  zap: (
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </>
  ),
  trending: (
    <>
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  plug: (
    <>
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a6 6 0 0 1-12 0V8z" />
    </>
  ),
  bank: (
    <>
      <path d="M3 22h18" />
      <path d="M6 18v-7" />
      <path d="M10 18v-7" />
      <path d="M14 18v-7" />
      <path d="M18 18v-7" />
      <path d="m12 2 8 5H4z" />
    </>
  ),
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M12 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </>
  ),
  "list-checks": (
    <>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </>
  ),
  "pie-chart": (
    <>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </>
  ),
  layers: (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </>
  ),
  headset: (
    <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
  ),
  code: (
    <>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICON_PATHS;

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
