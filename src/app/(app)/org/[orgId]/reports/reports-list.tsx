"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/app/i18n-provider";
import { Icon, StatusPill, buttonStyles } from "@/components/dashboard/ui";
import { getReportDownloadUrl } from "./actions";

export type ReportItem = {
  id: string;
  format: "csv" | "xlsx" | "pdf";
  name: string;
  meta: string;
  status: "pending" | "ready" | "failed";
};

const BADGE = {
  csv: "bg-db-success-tint text-db-success",
  xlsx: "bg-db-tint text-db-info",
  pdf: "bg-db-danger-tint text-db-danger",
};

const POLL_MS = 2000;

export default function ReportsList({ orgId, items }: { orgId: string; items: ReportItem[] }) {
  const { t } = useT();
  const router = useRouter();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const anyPending = items.some((i) => i.status === "pending");

  // Re-fetch the server-rendered list while a report is being built.
  useEffect(() => {
    if (!anyPending) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [anyPending, router]);

  async function download(id: string) {
    setDownloading(id);
    setError(null);
    const result = await getReportDownloadUrl(orgId, id);
    setDownloading(null);
    if (result.url) window.location.assign(result.url);
    else setError(t(result.error ?? "Couldn't create a download link."));
  }

  if (items.length === 0) {
    return (
      <p className="border-t border-db-row px-5 py-10 text-center text-sm text-db-muted">
        {t("No reports yet. Create one above.")}
      </p>
    );
  }

  return (
    <>
      {error && <p className="border-t border-db-row px-5 py-3 text-sm text-db-danger">{error}</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 border-t border-db-row px-5 py-3.5 sm:px-6">
            <span className={`w-12 shrink-0 rounded-md py-1 text-center font-mono text-[11px] font-medium ${BADGE[item.format]}`}>
              {item.format.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-db-ink">{item.name}</span>
              <span className="block truncate text-xs text-db-muted">{item.meta}</span>
            </span>
            {item.status === "ready" && (
              <button
                type="button"
                onClick={() => download(item.id)}
                disabled={downloading === item.id}
                className={buttonStyles.ghost}
              >
                <Icon name="download" size={18} />
                {t("Download")}
              </button>
            )}
            {item.status === "pending" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-db-warning-tint px-[9px] py-[3px] text-xs font-semibold whitespace-nowrap text-db-warning">
                <Icon name="hourglass_top" size={14} />
                {t("Generating…")}
              </span>
            )}
            {item.status === "failed" && <StatusPill tone="danger">{t("Failed")}</StatusPill>}
          </li>
        ))}
      </ul>
    </>
  );
}
