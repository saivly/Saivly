"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/app/i18n-provider";
import { intlLocale, type Locale } from "@/lib/i18n";

const INCOMING = "#3B82F6";
const OUTGOING = "#BFD3F5";

type Point = { month: string; incoming: number; outgoing: number };

export default function VolumeChart({ data, currency, locale }: { data: Point[]; currency: string; locale: Locale }) {
  const { t } = useT();
  const tag = intlLocale(locale);
  const month = (iso: string) => new Intl.DateTimeFormat(tag, { month: "short", timeZone: "UTC" }).format(new Date(iso));
  const monthYear = (iso: string) =>
    new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
  const money = (value: number, compact = false) =>
    new Intl.NumberFormat(tag, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value);
  const empty = data.every((d) => d.incoming === 0 && d.outgoing === 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-db-ink">{t("Payment volume")}</h2>
          <p className="text-xs text-db-muted">{t("Last 12 months · {currency}", { currency })}</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-db-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOMING }} />
            {t("Incoming")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OUTGOING }} />
            {t("Outgoing")}
          </span>
        </div>
      </div>

      <div className="relative h-[240px]">
        {empty && (
          <p className="absolute inset-x-0 top-1/3 z-10 text-center text-sm text-db-muted">
            {t("No payment volume yet")}
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="25%" margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#F0F2F6" />
            <XAxis
              dataKey="month"
              tickFormatter={month}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              interval={0}
            />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              tickFormatter={(v: number) => money(v, true)}
            />
            <Tooltip
              cursor={{ fill: "#F5F7FA" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-db-border bg-white px-3 py-2 text-xs shadow-md">
                    <div className="mb-1 font-semibold text-db-ink">{monthYear(String(label))}</div>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center gap-2 text-db-text">
                        <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                        {p.dataKey === "incoming" ? t("Incoming") : t("Outgoing")}
                        <span className="ml-auto pl-3 font-semibold text-db-ink">{money(Number(p.value))}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            <Bar dataKey="incoming" fill={INCOMING} maxBarSize={14} radius={[4, 4, 0, 0]} />
            <Bar dataKey="outgoing" fill={OUTGOING} maxBarSize={14} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
