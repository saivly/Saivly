import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/dashboard/csv";
import { toMajor } from "@/lib/dashboard/format";
import { TAB_STATES, TYPE_KINDS, parsePaymentFilters, rangeStart, searchExpression } from "@/lib/dashboard/payments-filters";
import { createClient } from "@/lib/supabase/server";

const MAX_ROWS = 10_000;
const BATCH = 1000; // PostgREST's default max rows per request

/**
 * CSV of the Transactions table with the same filters as the page
 * (?type=&status=&q=&range=). Runs as the signed-in user, so RLS limits it to
 * organisations they belong to.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const filters = parsePaymentFilters(Object.fromEntries(request.nextUrl.searchParams));
  const since = rangeStart(filters.range);
  const search = searchExpression(filters.q);
  const states = TAB_STATES[filters.tab];

  const rows: (string | number | null)[][] = [];
  for (let from = 0; from < MAX_ROWS; from += BATCH) {
    let query = supabase
      .from("transfers")
      .select("adyen_created_at, kind, counterparty_name, counterparty_account, description, reference, adyen_transfer_id, state, amount_value, currency")
      .eq("organisation_id", orgId)
      .in("kind", TYPE_KINDS[filters.type]);
    if (since) query = query.gte("adyen_created_at", since);
    if (search) query = query.or(search);
    if (states) query = query.in("state", states);
    const { data, error } = await query.order("adyen_created_at", { ascending: false }).range(from, from + BATCH - 1);
    if (error) return new NextResponse("Export failed", { status: 500 });

    for (const r of data) {
      rows.push([
        r.adyen_created_at,
        r.kind === "payout" ? "Payout" : "Incoming payment",
        r.counterparty_name ?? r.counterparty_account ?? r.description,
        r.reference,
        r.adyen_transfer_id,
        r.state,
        // Payouts leave the account, so they're negative.
        (r.kind === "payout" ? -1 : 1) * toMajor(r.amount_value, r.currency),
        r.currency,
      ]);
    }
    if (data.length < BATCH) break;
  }

  const csv = toCsv(["Date", "Type", "Counterparty", "Reference", "Adyen transfer ID", "Status", "Amount", "Currency"], rows);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
