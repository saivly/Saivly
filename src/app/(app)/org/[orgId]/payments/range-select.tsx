"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/app/i18n-provider";
import { Icon } from "@/components/dashboard/ui";
import Select from "@/components/select";
import { PAYMENT_RANGES, type PaymentRange } from "@/lib/dashboard/payments-filters";

const LABELS: Record<PaymentRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

/** Date range for the payments table — kept in the URL (?range=). */
export default function RangeSelect({ value }: { value: PaymentRange }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "30d") params.delete("range");
    else params.set("range", next);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="w-44">
      <Select
        value={value}
        onChange={change}
        aria-label={t("Date range")}
        icon={<Icon name="calendar_today" size={18} className="text-db-muted" />}
        // Toolbar size: matches the Export button next to it.
        className="border-db-border! py-2! text-[13px]! font-medium"
        options={PAYMENT_RANGES.map((r) => ({ value: r, label: t(LABELS[r]) }))}
      />
    </div>
  );
}
