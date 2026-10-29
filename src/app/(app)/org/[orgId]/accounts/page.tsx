import { notFound } from "next/navigation";
import { ButtonLink, Card, PageHeader, StatusPill, buttonStyles, chipToneClass, type ChipTone } from "@/components/dashboard/ui";
import { getBalanceAccount, getBalanceAccountIban, primaryBalance } from "@/lib/adyen/accounts";
import { formatMoney } from "@/lib/dashboard/format";
import { getOrgContext } from "@/lib/dashboard/org";
import { getLocale, getT } from "@/lib/i18n-server";
import OpenAccountButton from "./open-account-dialog";

const CURRENCY_TONE: Record<string, ChipTone> = { EUR: "blue", USD: "green", GBP: "violet" };

const STATUS_TONE = { active: "success", inactive: "neutral", suspended: "warning", closed: "danger" } as const;
const STATUS_LABEL = { active: "Active", inactive: "Inactive", suspended: "Suspended", closed: "Closed" } as const;

export default async function AccountsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [ctx, t, locale] = await Promise.all([getOrgContext(orgId), getT(), getLocale()]);
  if (!ctx) notFound();

  const accounts = await Promise.all(
    ctx.accounts.map(async (account) => {
      const [adyen, iban] = await Promise.all([
        getBalanceAccount(account.adyen_balance_account_id),
        getBalanceAccountIban(account.adyen_balance_account_id),
      ]);
      return { ...account, adyen, iban, balance: primaryBalance(adyen, account.currency) };
    })
  );

  const disabledReason = !ctx.isOwner
    ? t("Only organisation owners can open accounts.")
    : !ctx.organisation.adyen_account_holder_id
      ? t("Finish Adyen verification before opening more accounts.")
      : undefined;

  return (
    <>
      <PageHeader
        title={t("Accounts")}
        subtitle={t("Balances are shown live from your Adyen balance accounts.")}
        actions={<OpenAccountButton orgId={orgId} disabledReason={disabledReason} />}
      />

      {accounts.length === 0 ? (
        <Card className="text-center text-sm text-db-muted">
          {t("No accounts yet. Your first account is opened when Adyen verification finishes.")}
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
          {accounts.map((account) => {
            const status = account.adyen?.status ?? null;
            return (
              <Card key={account.id} className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold ${chipToneClass(
                      CURRENCY_TONE[account.currency] ?? "neutral"
                    )}`}
                  >
                    {account.currency}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-semibold text-db-ink">{account.name}</h2>
                    <p className="truncate font-mono text-xs text-db-muted">{account.iban ?? t("No IBAN issued yet")}</p>
                  </div>
                  {status ? (
                    <StatusPill tone={STATUS_TONE[status]}>{t(STATUS_LABEL[status])}</StatusPill>
                  ) : (
                    <StatusPill tone="neutral">{t("Unavailable")}</StatusPill>
                  )}
                </div>
                <div>
                  <p className="text-[13px] text-db-muted">{t("Available balance")}</p>
                  <p className="truncate text-[26px] leading-tight font-bold text-db-ink">
                    {account.balance ? formatMoney(account.balance.available, account.balance.currency, locale) : "—"}
                  </p>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled
                    title={t("Transfers between accounts are coming soon.")}
                    className={buttonStyles.secondary}
                  >
                    {t("Transfer")}
                  </button>
                  <ButtonLink variant="secondary" href={`/org/${orgId}/reports?account=${account.id}`}>
                    {t("Statements")}
                  </ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
