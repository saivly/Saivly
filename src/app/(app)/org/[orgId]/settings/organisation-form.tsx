"use client";

import { useActionState } from "react";
import { useT } from "@/app/i18n-provider";
import { Field, inputStyles } from "@/components/dashboard/ui";
import { ACCOUNT_CURRENCIES } from "@/lib/dashboard/constants";
import { updateOrganisation, type SettingsState } from "./actions";

/** Default currency — saves as soon as it changes. */
export default function OrganisationForm({ orgId, currency, disabled }: { orgId: string; currency: string; disabled: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateOrganisation, {});

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <Field
        label={t("Default currency")}
        hint={
          state.error ? (
            <span className="text-db-danger">{t(state.error)}</span>
          ) : pending ? (
            t("Saving…")
          ) : state.ok ? (
            t("Saved")
          ) : (
            t("Used for totals on the Overview.")
          )
        }
      >
        <select
          name="currency"
          defaultValue={currency}
          disabled={disabled || pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={inputStyles}
        >
          {ACCOUNT_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
    </form>
  );
}
