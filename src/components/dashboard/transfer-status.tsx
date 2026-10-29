import type { T } from "@/lib/i18n";
import type { TransferState } from "@/lib/adyen/transfer-state";
import { StatusPill, type PillTone } from "./ui";

const PAYMENT: Record<TransferState, { label: string; tone: PillTone }> = {
  succeeded: { label: "Succeeded", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  in_transit: { label: "Pending", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

const PAYOUT: Record<TransferState, { label: string; tone: PillTone }> = {
  succeeded: { label: "Paid", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  in_transit: { label: "In transit", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
};

export function TransferStatus({ state, payout, t }: { state: TransferState; payout?: boolean; t: T }) {
  const { label, tone } = (payout ? PAYOUT : PAYMENT)[state];
  return <StatusPill tone={tone}>{t(label)}</StatusPill>;
}
