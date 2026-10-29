"use client";

import { useActionState, useEffect, useState } from "react";
import { useT } from "@/app/i18n-provider";
import Select from "@/components/select";
import { Button, Field, Icon, buttonStyles, inputStyles } from "@/components/dashboard/ui";
import { ACCOUNT_CURRENCIES } from "@/lib/dashboard/constants";
import { openAccount, type OpenAccountState } from "./actions";

export default function OpenAccountButton({ orgId, disabledReason }: { orgId: string; disabledReason?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<OpenAccountState, FormData>(openAccount, {});

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button icon="add" onClick={() => setOpen(true)} disabled={Boolean(disabledReason)} title={disabledReason}>
        {t("Open account")}
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,27,45,.45)] p-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={action}
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-account-title"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-[420px] flex-col gap-4 rounded-[14px] bg-db-card p-7 shadow-[0_20px_50px_-10px_rgba(15,27,45,.35)]"
          >
            <span className="inline-flex w-fit rounded-lg bg-db-tint p-2 text-db-primary">
              <Icon name="account_balance_wallet" size={22} />
            </span>
            <div>
              <h2 id="open-account-title" className="text-lg font-bold text-db-ink">
                {t("Open a new account")}
              </h2>
              <p className="mt-1 text-sm text-db-muted">
                {t("A new balance account is opened with Adyen under your organisation.")}
              </p>
            </div>
            <input type="hidden" name="orgId" value={orgId} />
            <Field label={t("Account name")}>
              <input name="name" required maxLength={60} placeholder={t("e.g. Reserve account")} className={inputStyles} />
            </Field>
            <Field label={t("Currency")}>
              <Select name="currency" defaultValue="EUR" options={ACCOUNT_CURRENCIES.map((c) => ({ value: c, label: c }))} />
            </Field>
            {state.error && <p className="text-sm text-db-danger">{t(state.error)}</p>}
            <div className="mt-2 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className={`${buttonStyles.secondary} text-sm`}>
                {t("Cancel")}
              </button>
              <Button type="submit" disabled={pending}>
                {pending ? t("Opening…") : t("Open account")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
