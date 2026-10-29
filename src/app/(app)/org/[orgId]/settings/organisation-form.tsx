"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useT } from "@/app/i18n-provider";
import Select from "@/components/select";
import { Field } from "@/components/dashboard/ui";
import { ACCOUNT_CURRENCIES } from "@/lib/dashboard/constants";
import { updateOrganisation, type SettingsState } from "./actions";

/** Default currency — saves as soon as it changes. */
export default function OrganisationForm({ orgId, currency, disabled }: { orgId: string; currency: string; disabled: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateOrganisation, {});
  const [value, setValue] = useState(currency);
  const formRef = useRef<HTMLFormElement>(null);

  // Submit after the new value has rendered into the hidden input.
  useEffect(() => {
    if (value !== currency) formRef.current?.requestSubmit();
    // Only a change made here should save — not a new `currency` prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form ref={formRef} action={action}>
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
        <Select
          name="currency"
          value={value}
          onChange={setValue}
          disabled={disabled || pending}
          options={ACCOUNT_CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </Field>
    </form>
  );
}
