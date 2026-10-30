// Shared by the payout dialog (browser) and the payout action (server).

export type PayoutSpeed = "standard" | "instant";

/** Instant payouts cost 1% of the amount, charged on top, rounded up to the cent. */
export const INSTANT_FEE_RATE = 0.01;

export function instantFee(amountMinor: number): number {
  return Math.ceil(amountMinor * INSTANT_FEE_RATE);
}
