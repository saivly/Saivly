"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { REPORT_FORMATS, REPORT_PERIODS, REPORT_TYPES } from "@/lib/dashboard/constants";
import { getOrgContext } from "@/lib/dashboard/org";
import { generateReport } from "@/lib/reports/generate";
import { periodLabel, periodRange } from "@/lib/reports/periods";
import { createClient } from "@/lib/supabase/server";

const CreateReportSchema = z.object({
  orgId: z.uuid(),
  type: z.enum(REPORT_TYPES),
  period: z.enum(REPORT_PERIODS),
  account: z.union([z.literal("all"), z.uuid()]),
  format: z.enum(REPORT_FORMATS),
});

export type CreateReportState = { error?: string; ok?: number };

/**
 * Queues a report job, then builds it after the response is sent. The
 * page polls (router.refresh) while any job is pending and the row
 * flips to "Download" once the generator marks it ready.
 */
export async function createReport(_prev: CreateReportState, formData: FormData): Promise<CreateReportState> {
  const parsed = CreateReportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid input." };
  const { orgId, type, period, account, format } = parsed.data;

  const ctx = await getOrgContext(orgId);
  if (!ctx) return { error: "Organisation not found." };
  if (account !== "all" && !ctx.accounts.some((a) => a.id === account)) return { error: "Account not found." };

  const { start, end } = periodRange(period);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      organisation_id: orgId,
      report_type: type,
      period,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      period_label: periodLabel(period, start.toISOString(), "en"),
      balance_account_id: account === "all" ? null : account,
      format,
    })
    .select("id")
    .single();
  if (error) return { error: "Couldn't start the report. Try again." };

  after(() => generateReport(data.id));
  revalidatePath(`/org/${orgId}/reports`);
  return { ok: Date.now() };
}

/** Short-lived signed URL for a ready report. Storage RLS limits it to org members. */
export async function getReportDownloadUrl(orgId: string, reportId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("file_path, report_type, period_label, format")
    .eq("id", reportId)
    .eq("organisation_id", orgId)
    .eq("status", "ready")
    .maybeSingle();
  if (!report?.file_path) return { error: "Report not found." };

  const filename = `${report.report_type}-${report.period_label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `.${report.format}`;
  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(report.file_path, 60, { download: filename });
  if (error || !data) return { error: "Couldn't create a download link." };
  return { url: data.signedUrl };
}
