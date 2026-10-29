"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/app/i18n-provider";
import { Icon } from "@/components/dashboard/ui";
import { PAYMENT_RANGES, type PaymentRange } from "@/lib/dashboard/payments-filters";

const LABELS: Record<PaymentRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export default function RangeSelect({ value }: { value: PaymentRange }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="relative inline-flex items-center gap-2 rounded-lg border border-db-border bg-db-card px-3.5 py-2 text-[13px] font-medium text-db-ink hover:bg-db-page">
      <Icon name="calendar_today" size={18} className="text-db-muted" />
      <span>{t(LABELS[value])}</span>
      <select
        aria-label={t("Date range")}
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          if (e.target.value === "30d") params.delete("range");
          else params.set("range", e.target.value);
          params.delete("page");
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {PAYMENT_RANGES.map((r) => (
          <option key={r} value={r}>
            {t(LABELS[r])}
          </option>
        ))}
      </select>
    </label>
  );
}
