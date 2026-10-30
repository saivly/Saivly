import { getBalanceAccount, primaryBalance } from "@/lib/adyen/accounts";
import { canPayOut, feeBalanceAccountId } from "@/lib/adyen/payouts";
import { formatMoney } from "@/lib/dashboard/format";
import type { OrgContext } from "@/lib/dashboard/org";
import type { Locale, T } from "@/lib/i18n";
import type { PayoutSource } from "./payout-dialog";

/** Accounts the "Pay out" button can pay from, and why it's disabled (if it is). */
export async function getPayoutButtonData(
  ctx: OrgContext,
  t: T,
  locale: Locale
): Promise<{ sources: PayoutSource[]; disabledReason?: string }> {
  const accountHolderId = ctx.organisation.adyen_account_holder_id;
  const instantEnabled = Boolean(feeBalanceAccountId());

  const [allowed, sources] = await Promise.all([
    accountHolderId ? canPayOut(accountHolderId) : Promise.resolve(false),
    Promise.all(
      ctx.accounts.map(async (a): Promise<PayoutSource | null> => {
        const balance = primaryBalance(await getBalanceAccount(a.adyen_balance_account_id), a.currency);
        if (!balance || balance.available <= 0) return null;
        return {
          id: a.adyen_balance_account_id,
          name: t(a.name),
          currency: balance.currency,
          available: balance.available,
          availableLabel: formatMoney(balance.available, balance.currency, locale),
          instantAvailable: instantEnabled && balance.currency === "EUR",
        };
      })
    ).then((list) => list.filter((s): s is PayoutSource => s !== null)),
  ]);

  // First reason that applies, shown as the button's tooltip.
  const disabledReason = !ctx.isOwner
    ? t("Only organisation owners can make payouts.")
    : !allowed
      ? t("Payouts aren't enabled for your organisation yet. Contact support to enable them.")
      : sources.length === 0
        ? t("There's no available balance to pay out.")
        : undefined;

  return { sources, disabledReason };
}
