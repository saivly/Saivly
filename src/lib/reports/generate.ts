import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { getBalanceAccount } from "@/lib/adyen/accounts";
import { toCsv } from "@/lib/dashboard/csv";
import { toMajor } from "@/lib/dashboard/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodLabel } from "./periods";

/**
 * Builds a report file for a pending row in public.reports, uploads it
 * to the private "reports" bucket and marks the row ready (or failed).
 *
 * Runs after the "Generate report" response has been sent (see
 * next/server `after` in the reports actions), using the service role:
 * the request that created the job was already authorised, and every
 * query below is scoped to the report's organisation explicitly.
 *
 * If the server stops before this finishes, the row stays "pending";
 * the Reports page shows jobs older than STALE_REPORT_MINUTES as failed.
 */


const BATCH = 1000;
const MAX_ROWS = 100_000;

type Cell = string | number | null;
type Sheet = { title: string; header: string[]; rows: Cell[][] };

const TITLES = {
  transactions: "Transactions",
  settlements: "Settlements",
  balances: "Balances",
  disputes: "Disputes",
} as const;

const CONTENT_TYPES = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

type Admin = ReturnType<typeof createAdminClient>;
type Report = NonNullable<Awaited<ReturnType<typeof loadReport>>>;

async function loadReport(admin: Admin, reportId: string) {
  const { data } = await admin.from("reports").select("*").eq("id", reportId).maybeSingle();
  return data;
}

async function transferRows(admin: Admin, report: Report, adyenAccountId: string | null, kind: "all" | "payout" | "dispute") {
  const rows: Cell[][] = [];
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    let query = admin
      .from("transfers")
      .select("adyen_created_at, kind, direction, category, type, status, state, counterparty_name, counterparty_account, reference, adyen_transfer_id, amount_value, currency, balance_account_id")
      .eq("organisation_id", report.organisation_id)
      .gte("adyen_created_at", report.period_start)
      .lt("adyen_created_at", report.period_end);
    if (adyenAccountId) query = query.eq("balance_account_id", adyenAccountId);
    if (kind === "payout") query = query.eq("kind", "payout");
    if (kind === "dispute") query = query.or("type.ilike.*chargeback*,status.ilike.*chargeback*,status.ilike.*dispute*");
    const { data, error } = await query.order("adyen_created_at", { ascending: true }).range(from, from + BATCH - 1);
    if (error) throw new Error(error.message);

    for (const r of data) {
      const signed = r.direction === "outgoing" ? -r.amount_value : r.amount_value;
      rows.push([
        r.adyen_created_at,
        r.kind,
        r.direction,
        r.type ?? r.category,
        r.state,
        r.status,
        r.counterparty_name,
        r.counterparty_account,
        r.reference,
        r.adyen_transfer_id,
        toMajor(signed, r.currency),
        r.currency,
      ]);
    }
    if (data.length < BATCH) break;
  }
  return rows;
}

const TRANSFER_HEADER = [
  "Date (UTC)",
  "Kind",
  "Direction",
  "Type",
  "Status",
  "Adyen status",
  "Counterparty",
  "Counterparty account",
  "Reference",
  "Adyen transfer ID",
  "Amount",
  "Currency",
];

async function buildSheet(admin: Admin, report: Report): Promise<Sheet> {
  const { data: accounts } = await admin
    .from("balance_accounts")
    .select("id, name, currency, adyen_balance_account_id")
    .eq("organisation_id", report.organisation_id);
  const account = report.balance_account_id ? accounts?.find((a) => a.id === report.balance_account_id) : null;
  if (report.balance_account_id && !account) throw new Error("Account not found");
  const adyenId = account?.adyen_balance_account_id ?? null;

  const title = `${TITLES[report.report_type]} — ${periodLabel(report.period, report.period_start, "en")}`;

  if (report.report_type === "balances") {
    const rows: Cell[][] = [];
    for (const a of account ? [account] : (accounts ?? [])) {
      const live = await getBalanceAccount(a.adyen_balance_account_id);
      if (!live) throw new Error(`Couldn't read balance for ${a.name} from Adyen`);
      for (const b of live.balances) {
        rows.push([
          a.name,
          a.adyen_balance_account_id,
          b.currency,
          toMajor(b.balance, b.currency),
          toMajor(b.available, b.currency),
          toMajor(b.reserved, b.currency),
          toMajor(b.pending, b.currency),
        ]);
      }
    }
    return {
      title: `Balances — as of ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
      header: ["Account", "Adyen balance account", "Currency", "Balance", "Available", "Reserved", "Pending"],
      rows,
    };
  }

  const kind = report.report_type === "settlements" ? "payout" : report.report_type === "disputes" ? "dispute" : "all";
  return { title, header: TRANSFER_HEADER, rows: await transferRows(admin, report, adyenId, kind) };
}

async function toXlsx(sheet: Sheet): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Saivly";
  const ws = workbook.addWorksheet("Report");
  ws.addRow([sheet.title]).font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(sheet.header).font = { bold: true };
  for (const row of sheet.rows) ws.addRow(row);
  ws.columns.forEach((col) => (col.width = 18));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Standard PDF fonts only cover WinAnsi; anything else becomes "?". */
function safe(text: string): string {
  return text.replace(/[^\x20-\x7E -ÿ€—–‘’“”•…]/g, "?");
}

function fit(font: PDFFont, text: string, size: number, width: number): string {
  let s = safe(text);
  if (font.widthOfTextAtSize(s, size) <= width) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > width) s = s.slice(0, -1);
  return `${s}…`;
}

async function toPdf(sheet: Sheet): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H, M, SIZE, LINE] = [842, 595, 36, 7.5, 13]; // A4 landscape
  const colWidth = (W - 2 * M) / sheet.header.length;
  const ink = rgb(0.086, 0.125, 0.18);
  const muted = rgb(0.39, 0.45, 0.55);

  let page = pdf.addPage([W, H]);
  let y = H - M;
  const drawRow = (cells: Cell[], f: PDFFont, color = ink) => {
    cells.forEach((c, i) =>
      page.drawText(fit(f, c === null ? "" : String(c), SIZE, colWidth - 4), { x: M + i * colWidth, y, size: SIZE, font: f, color })
    );
    y -= LINE;
  };
  const header = () => {
    drawRow(sheet.header, bold, muted);
    page.drawLine({ start: { x: M, y: y + LINE - 4 }, end: { x: W - M, y: y + LINE - 4 }, thickness: 0.5, color: muted });
  };

  page.drawText(safe(sheet.title), { x: M, y, size: 14, font: bold, color: ink });
  y -= 24;
  header();
  if (sheet.rows.length === 0) drawRow(["No rows in this period."], font, muted);
  for (const row of sheet.rows) {
    if (y < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    drawRow(row, font);
  }
  return pdf.save();
}

export async function generateReport(reportId: string): Promise<void> {
  const admin = createAdminClient();
  const report = await loadReport(admin, reportId);
  if (!report || report.status !== "pending") return;

  try {
    const sheet = await buildSheet(admin, report);
    const body =
      report.format === "csv"
        ? new TextEncoder().encode(toCsv(sheet.header, sheet.rows))
        : report.format === "xlsx"
          ? await toXlsx(sheet)
          : await toPdf(sheet);

    const path = `${report.organisation_id}/${report.id}.${report.format}`;
    const { error: uploadError } = await admin.storage
      .from("reports")
      .upload(path, body, { contentType: CONTENT_TYPES[report.format], upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    await admin
      .from("reports")
      .update({
        status: "ready",
        file_path: path,
        size_bytes: body.byteLength,
        row_count: sheet.rows.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", report.id);
  } catch (err) {
    console.error(`[reports] ${report.id} failed:`, err);
    await admin
      .from("reports")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      })
      .eq("id", report.id);
  }
}
