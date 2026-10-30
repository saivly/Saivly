"use client";

import { useActionState, useEffect, useState } from "react";
import { useT } from "@/app/i18n-provider";
import Select from "@/components/select";
import { Button, Field, Icon, buttonStyles, inputStyles } from "@/components/dashboard/ui";
import { type PayoutSpeed, INSTANT_FEE_RATE } from "@/lib/adyen/payout-fee";
import { payOut, type PayoutState } from "./actions";

export type PayoutSource = {
  id: string; // Adyen balance account id
  name: string;
  currency: string;
  available: number; // minor units
  availableLabel: string; // already formatted, e.g. "€ 1.234,56"
  instantAvailable: boolean;
};

/** "1.234,56" / "1234.56" -> major units, for the live fee preview only (the server re-parses). */
function previewAmount(raw: string): number {
  let s = raw.replace(/[\s€$£]/g, "");
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (lastSep !== -1 && s.length - lastSep - 1 <= 2) {
    s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function PayoutButton({
  orgId,
  sources,
  locale,
  disabledReason,
  defaultSourceId,
  variant = "primary",
  className,
}: {
  orgId: string;
  sources: PayoutSource[];
  locale: string; // BCP 47 tag
  disabledReason?: string;
  /** Account to preselect, e.g. when opened from that account's card. */
  defaultSourceId?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(defaultSourceId ?? sources[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [speed, setSpeed] = useState<PayoutSpeed>("standard");
  // New key per dialog opening: a double click on "Pay out" reuses it
  // (Adyen returns the same payout), a fresh payout gets a new one.
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, action, pending] = useActionState<PayoutState, FormData>(payOut, {});

  const source = sources.find((s) => s.id === sourceId) ?? sources[0];
  const money = (major: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: source?.currency ?? "EUR" }).format(major);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  function openDialog() {
    setIdempotencyKey(crypto.randomUUID());
    setSourceId(defaultSourceId ?? sources[0]?.id ?? "");
    setAmount("");
    setSpeed("standard");
    setOpen(true);
  }

  const major = previewAmount(amount);
  const fee = speed === "instant" ? Math.ceil(major * 100 * INSTANT_FEE_RATE) / 100 : 0;

  const speedOption = (value: PayoutSpeed, title: string, detail: string, disabled = false) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
        speed === value ? "border-db-primary bg-db-tint" : "border-db-border"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input
        type="radio"
        name="speed"
        value={value}
        checked={speed === value}
        disabled={disabled}
        onChange={() => setSpeed(value)}
        className="mt-0.5 accent-[var(--color-db-primary)]"
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-db-muted">{detail}</span>
      </span>
    </label>
  );

  return (
    <>
      <Button
        type="button"
        variant={variant}
        icon="north_east"
        onClick={openDialog}
        disabled={Boolean(disabledReason)}
        title={disabledReason}
        className={`whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
      >
        {t("Pay out")}
      </Button>
      {open && source && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[rgba(15,27,45,.45)] p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <form
            action={action}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-title"
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex w-full max-w-[460px] flex-col gap-4 rounded-[14px] bg-db-card p-7 text-db-ink shadow-[0_20px_50px_-10px_rgba(15,27,45,.35)]"
          >
            <span className="inline-flex w-fit rounded-lg bg-db-tint p-2 text-db-primary">
              <Icon name="north_east" size={22} />
            </span>
            <h2 id="payout-title" className="text-lg font-bold">
              {t("New payout")}
            </h2>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
            {sources.length > 1 ? (
              <Field label={t("From account")}>
                <Select
                  name="balanceAccountId"
                  value={sourceId}
                  onChange={(value) => {
                    setSourceId(value);
                    if (!sources.find((s) => s.id === value)?.instantAvailable) setSpeed("standard");
                  }}
                  options={sources.map((s) => ({ value: s.id, label: `${s.name} (${s.currency})` }))}
                />
              </Field>
            ) : (
              <input type="hidden" name="balanceAccountId" value={source.id} />
            )}
            <Field
              label={t("Amount ({currency})", { currency: source.currency })}
              hint={t("Available: {amount}", { amount: source.availableLabel })}
            >
              <input
                name="amount"
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputStyles}
              />
            </Field>
            <Field label={t("Account holder name")}>
              <input
                name="recipientName"
                required
                maxLength={80}
                autoComplete="off"
                placeholder={t("Name as known by the bank")}
                className={inputStyles}
              />
            </Field>
            <Field label={t("IBAN")}>
              <input
                name="iban"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="NL00 BANK 0123 4567 89"
                className={`${inputStyles} font-mono uppercase`}
              />
            </Field>
            <Field label={t("Reference (optional)")}>
              <input
                name="reference"
                maxLength={80}
                autoComplete="off"
                placeholder={t("Shown on the recipient's bank statement")}
                className={inputStyles}
              />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-[13px] font-medium text-db-text">{t("Speed")}</legend>
              {speedOption("standard", t("Standard"), t("1–2 business days · free"))}
              {speedOption(
                "instant",
                t("Instant"),
                source.instantAvailable ? t("Within 30 minutes · 1% fee") : t("Not available for this account"),
                !source.instantAvailable
              )}
            </fieldset>
            {major > 0 && (
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-lg bg-db-page px-4 py-3 text-sm">
                <dt className="text-db-muted">{t("Amount")}</dt>
                <dd className="text-right">{money(major)}</dd>
                {fee > 0 && (
                  <>
                    <dt className="text-db-muted">{t("Instant fee (1%)")}</dt>
                    <dd className="text-right">{money(fee)}</dd>
                  </>
                )}
                <dt className="font-semibold">{t("Total from your balance")}</dt>
                <dd className="text-right font-semibold">{money(major + fee)}</dd>
              </dl>
            )}
            {state.error && <p className="text-sm text-db-danger">{t(state.error)}</p>}
            <div className="mt-1 flex justify-end gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className={`${buttonStyles.secondary} text-sm`}
              >
                {t("Cancel")}
              </button>
              <Button type="submit" disabled={pending}>
                {pending ? t("Paying out…") : t("Pay out")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
