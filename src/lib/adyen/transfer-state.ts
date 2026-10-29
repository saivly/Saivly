/**
 * Maps an Adyen transfer resource (as carried by
 * balancePlatform.transfer.created / .updated webhooks) onto the row
 * shape of public.transfers (migration 0020) — in particular the
 * dashboard's own `kind` and `state`, which the UI and SQL stats use.
 *
 * Adyen transfer reference:
 * https://docs.adyen.com/api-explorer/transfer-webhooks/latest/post/balancePlatform.transfer.updated
 */

export type TransferKind = "payment" | "payout" | "other";
export type TransferState = "pending" | "in_transit" | "succeeded" | "failed";

const FAILED_STATUSES = new Set([
  "refused",
  "rejected",
  "error",
  "failed",
  "returned",
  "cancelled",
  "expired",
  "authAdjustmentError",
  "authAdjustmentRefused",
  "captureReversed",
  "refundReversed",
]);

const SETTLED_STATUSES = new Set(["booked", "captured", "capturedExternally", "credited"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" ? value : null);

export function transferKind(category: string | null, direction: string | null): TransferKind {
  if (direction === "outgoing" && category === "bank") return "payout";
  if (direction === "incoming" && (category === "platformPayment" || category === "bank")) return "payment";
  return "other";
}

export function transferState(kind: TransferKind, status: string, trackingStatus: string | null): TransferState {
  if (FAILED_STATUSES.has(status)) return "failed";
  if (kind === "payout") {
    // A bank payout is "booked" when it leaves the balance account, and
    // only "credited" (via tracking) once it reaches the bank.
    if (trackingStatus === "credited" || status === "credited") return "succeeded";
    if (status === "booked") return "in_transit";
    return "pending";
  }
  return SETTLED_STATUSES.has(status) ? "succeeded" : "pending";
}

/** "NL91ABNA0417164300" -> "NL91 ABNA ···· 4300". */
export function maskIban(iban: string): string {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 12) return compact;
  return `${compact.slice(0, 4)} ${compact.slice(4, 8)} ···· ${compact.slice(-4)}`;
}

/** The transfer object sits directly under `data` (current docs) or under `data.transfer` (older shape). */
export function transferResource(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data)) return null;
  if (isRecord(data.transfer)) return data.transfer;
  return data;
}

export type NormalizedTransfer = {
  adyen_transfer_id: string;
  balance_account_id: string | null;
  category: string | null;
  type: string | null;
  direction: "incoming" | "outgoing";
  status: string;
  kind: TransferKind;
  state: TransferState;
  amount_value: number;
  currency: string;
  reference: string | null;
  description: string | null;
  counterparty_name: string | null;
  counterparty_account: string | null;
  sequence_number: number;
  estimated_arrival_at: string | null;
  adyen_created_at: string;
};

export function balanceAccountIdOf(transfer: Record<string, unknown> | null): string | null {
  if (!transfer) return null;
  const nested = isRecord(transfer.balanceAccount) ? str(transfer.balanceAccount.id) : null;
  return nested ?? str(transfer.balanceAccountId);
}

/** Returns null when the payload lacks what a dashboard row needs (id, direction, amount). */
export function normalizeTransfer(transfer: Record<string, unknown> | null): NormalizedTransfer | null {
  if (!transfer) return null;
  const id = str(transfer.id);
  const direction = str(transfer.direction);
  const amount = isRecord(transfer.amount) ? transfer.amount : null;
  const value = num(amount?.value);
  const currency = str(amount?.currency);
  if (!id || (direction !== "incoming" && direction !== "outgoing") || value === null || !currency) {
    return null;
  }

  const category = str(transfer.category);
  const status = str(transfer.status) ?? "received";
  const tracking = isRecord(transfer.tracking) ? transfer.tracking : null;
  const kind = transferKind(category, direction);

  const counterparty = isRecord(transfer.counterparty) ? transfer.counterparty : null;
  const bankAccount = isRecord(counterparty?.bankAccount) ? counterparty!.bankAccount : null;
  const holder = isRecord(bankAccount?.accountHolder) ? bankAccount!.accountHolder : null;
  const identification = isRecord(bankAccount?.accountIdentification) ? bankAccount!.accountIdentification : null;
  const merchant = isRecord(counterparty?.merchant) ? counterparty!.merchant : null;
  const iban = str(identification?.iban);
  const accountNumber = str(identification?.accountNumber);

  return {
    adyen_transfer_id: id,
    balance_account_id: balanceAccountIdOf(transfer),
    category,
    type: str(transfer.type),
    direction,
    status,
    kind,
    state: transferState(kind, status, str(tracking?.status)),
    amount_value: Math.abs(value),
    currency,
    reference: str(transfer.reference),
    description: str(transfer.description) ?? str(transfer.referenceForBeneficiary),
    counterparty_name: str(holder?.fullName) ?? str(merchant?.name) ?? null,
    counterparty_account: iban ? maskIban(iban) : accountNumber ? `···· ${accountNumber.slice(-4)}` : null,
    sequence_number: num(transfer.sequenceNumber) ?? 0,
    estimated_arrival_at: str(tracking?.estimatedArrivalTime),
    adyen_created_at: str(transfer.creationDate) ?? new Date().toISOString(),
  };
}
