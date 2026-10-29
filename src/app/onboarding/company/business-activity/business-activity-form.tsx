"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenError } from "zod";
import Link from "next/link";
import { saveBusinessActivity } from "../actions";
import { inputClasses } from "../../form-controls";
import Select from "@/components/select";
import { currencySymbol } from "@/lib/onboarding/countries";
import {
  RESERVE_FUND_RANGE_IDS,
  reserveFundRangeLabel,
} from "@/lib/onboarding/reserve-fund-ranges";
import { INDUSTRY_CODE_GROUPS } from "@/lib/onboarding/industry-codes";
import { businessActivitySchema, VAT_EXEMPTION_REASONS } from "@/lib/zod";
import { INDUSTRY_DESCRIPTIONS_NL, INDUSTRY_SECTORS_NL } from "@/lib/onboarding/industry-codes.nl";
import { intlLocale } from "@/lib/i18n";
import { useT } from "@/app/i18n-provider";

const VAT_EXEMPTION_REASON_LABELS: Record<(typeof VAT_EXEMPTION_REASONS)[number], string> = {
  belowTaxThreshold: "Revenue below tax threshold",
  industryExemption: "Industry exemption",
};

// Prefilled for VvEs so the user can just hit Continue — still editable.
const HOMEOWNERS_ASSOCIATION_DESCRIPTION =
  "A Homeowners’ Association (HOA) manages and maintains the common areas of an apartment building. The HOA collects contributions from the owners, arranges maintenance and repairs, and ensures that shared expenses and agreements are properly managed.";

type Existing = {
  industryCode: string;
  reserveFundRange: string;
  reserveFundAmount: string;
  vatNumber: string;
  vatExemptionReason: string;
  businessDescription: string;
};

// Same useFormStatus caveat as company-form.tsx's ContinueButton — pulled
// out so it reports the enclosing <form>'s pending state rather than
// always false. Gated on formValid (same pattern as personal-form.tsx)
// so an incomplete form can't be submitted at all — that keeps the
// browser's own "Please fill out this field" bubble from ever firing,
// leaving the red fieldError text below each input as the only, and
// properly styled, validation feedback.
function ContinueButton({ formValid }: { formValid: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useT();
  return (
    <button
      disabled={pending || !formValid}
      className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-db-primary-hover disabled:opacity-50"
    >
      {pending ? t("Saving…") : t("Continue")}
    </button>
  );
}

export default function BusinessActivityForm({
  existing,
  isVve,
  currency,
}: {
  existing: Existing;
  /** Whether this org's KVK rechtsvorm is "vereniging van eigenaars" — see
   * isHomeownersAssociation in src/lib/adyen/legalEntity.ts. Locks
   * industry to a fixed value and changes what the reserve-fund amount
   * asks for; enforced server-side too (saveBusinessActivity), this is
   * just what makes that legible in the form itself. */
  isVve: boolean;
  /** ISO 4217 code from the company's country — used in the range labels. */
  currency: string;
}) {
  const { t, locale } = useT();
  const isDutch = locale === "nl";
  const [industryCode, setIndustryCode] = useState(existing.industryCode);
  const [reserveFundRange, setReserveFundRange] = useState(existing.reserveFundRange);
  const [reserveFundAmount, setReserveFundAmount] = useState(existing.reserveFundAmount);
  const [vatNumber, setVatNumber] = useState(existing.vatNumber);
  const [vatExemptionReason, setVatExemptionReason] = useState(existing.vatExemptionReason);
  const [businessDescription, setBusinessDescription] = useState(
    existing.businessDescription || (isVve ? t(HOMEOWNERS_ASSOCIATION_DESCRIPTION) : "")
  );

  // Live client-side mirror of businessActivitySchema (lib/zod.ts — same
  // schema saveBusinessActivity re-validates with server-side), same
  // pattern as company-form.tsx: re-parse on every change, but only
  // surface a field's error once the user has actually left it.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  function touch(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }
  const parsed = businessActivitySchema.safeParse({
    industryCode,
    reserveFundRange,
    reserveFundAmount,
    vatNumber,
    vatExemptionReason,
    businessDescription,
  });
  const fieldErrors = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  function fieldError(field: keyof typeof fieldErrors) {
    if (!touched[field]) return undefined;
    const message = fieldErrors[field]?.[0];
    return message && t(message);
  }

  return (
    <form noValidate action={saveBusinessActivity} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            {t("Industry")}
          </span>
          {isVve ? (
            <>
              {/* The underlying Adyen industry code (passed in via
                  `existing.industryCode`, see business-activity/page.tsx) is
                  a real-estate classification, not something a homeowners'
                  association would recognise itself in — show the plain
                  label instead and carry the real code through via the
                  hidden input below. */}
              <input
                type="text"
                value={t("Home Association")}
                disabled
                readOnly
                className={`${inputClasses} disabled:opacity-70`}
              />
              <input type="hidden" name="industryCode" value={industryCode} />
            </>
          ) : (
            <Select
              name="industryCode"
              value={industryCode}
              onChange={setIndustryCode}
              onBlur={() => touch("industryCode")}
              invalid={!!fieldError("industryCode")}
              searchable
              options={INDUSTRY_CODE_GROUPS.map((group) => ({
                label: (isDutch && INDUSTRY_SECTORS_NL[group.sector]) || group.sector,
                options: group.codes.map((code) => ({
                  value: code.code,
                  label: (isDutch && INDUSTRY_DESCRIPTIONS_NL[code.code]) || code.description,
                })),
              }))}
            />
          )}
          <span className="text-xs text-muted">
            {isVve
              ? t("Fixed for homeowners' associations.")
              : t("Adyen's own classification, closest to what the organisation actually does day to day.")}
          </span>
          {fieldError("industryCode") && (
            <span className="text-xs text-danger">{fieldError("industryCode")}</span>
          )}
        </label>
      </div>

      <fieldset
        className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel p-3 text-sm"
        aria-invalid={!!fieldError("reserveFundRange")}
      >
        <legend className="sr-only">
          {isVve ? t("Expected monthly contribution") : t("Estimated annual reserve fund contributions")}
        </legend>
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          {isVve
            ? t("Expected Monthly contribution for this account")
            : t("Estimated annual reserve fund contributions")}
        </span>
        <span className="pb-2 text-xs text-muted">{t("Give your best estimate")}</span>
        <div className="flex flex-col gap-2">
          {RESERVE_FUND_RANGE_IDS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-3 transition-colors hover:bg-accent-soft has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="reserveFundRange"
                value={id}
                required
                checked={reserveFundRange === id}
                onChange={() => {
                  setReserveFundRange(id);
                  touch("reserveFundRange");
                }}
                className="h-4 w-4 shrink-0 accent-accent"
              />
              {reserveFundRangeLabel(id, currency, t, intlLocale(locale))}
            </label>
          ))}
        </div>
        {reserveFundRange === "over100k" && (
          <label className="mt-2 flex flex-col gap-1.5">
            <span className="text-xs text-muted">
              {isVve ? t("Expected monthly amount") : t("Expected annual amount")}
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                {currencySymbol(currency)}
              </span>
              <input
                type="text"
                inputMode="numeric"
                name="reserveFundAmount"
                autoFocus
                placeholder={isDutch ? "150.000" : "150,000"}
                value={reserveFundAmount}
                onChange={(e) => setReserveFundAmount(e.target.value)}
                onBlur={() => touch("reserveFundAmount")}
                aria-invalid={!!fieldError("reserveFundAmount")}
                className={`${inputClasses} w-full pl-8`}
              />
            </div>
            {fieldError("reserveFundAmount") && (
              <span className="text-xs text-danger">{fieldError("reserveFundAmount")}</span>
            )}
          </label>
        )}
        {fieldError("reserveFundRange") && (
          <span className="text-xs text-danger">{fieldError("reserveFundRange")}</span>
        )}
      </fieldset>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            {t("VAT number")}
          </span>
          <input
            type="text"
            name={isVve ? undefined : "vatNumber"}
            disabled={isVve}
            value={isVve ? "" : vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            onBlur={() => touch("vatNumber")}
            aria-invalid={!!fieldError("vatNumber")}
            className={`${inputClasses} disabled:border-line disabled:bg-line/50 disabled:text-muted disabled:opacity-100`}
          />
          <span className="text-xs text-muted">
            {isVve
              ? t("Homeowners’ associations are VAT-exempt.")
              : t("Leave blank if the organisation doesn’t have one — most don’t.")}
          </span>
          {fieldError("vatNumber") && (
            <span className="text-xs text-danger">{fieldError("vatNumber")}</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            {t("VAT exemption reason")}
          </span>
          {isVve ? (
            <>
              <input
                type="text"
                value={t(VAT_EXEMPTION_REASON_LABELS.industryExemption)}
                disabled
                readOnly
                className={`${inputClasses} border-line bg-line/50 text-muted opacity-100`}
              />
              <input type="hidden" name="vatExemptionReason" value="industryExemption" />
            </>
          ) : (
            <Select
              name="vatExemptionReason"
              value={vatExemptionReason}
              onChange={setVatExemptionReason}
              onBlur={() => touch("vatExemptionReason")}
              invalid={!!fieldError("vatExemptionReason")}
              options={[
                { value: "", label: t("Not exempt") },
                ...VAT_EXEMPTION_REASONS.map((reason) => ({
                  value: reason,
                  label: t(VAT_EXEMPTION_REASON_LABELS[reason]),
                })),
              ]}
            />
          )}
          <span className="text-xs text-muted">
            {isVve
              ? t("Fixed for homeowners' associations.")
              : t("Only relevant if the organisation has no VAT number.")}
          </span>
          {fieldError("vatExemptionReason") && (
            <span className="text-xs text-danger">{fieldError("vatExemptionReason")}</span>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            {t("Business description")}
          </span>
          <textarea
            name="businessDescription"
            rows={4}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            onBlur={() => touch("businessDescription")}
            aria-invalid={!!fieldError("businessDescription")}
            className={`${inputClasses} resize-none`}
          />
          <span className="text-xs text-muted">
            {t("A short description of what the organisation does.")}
          </span>
          {fieldError("businessDescription") && (
            <span className="text-xs text-danger">{fieldError("businessDescription")}</span>
          )}
        </label>
      </div>

      <ContinueButton formValid={parsed.success} />

      <Link
        href="/onboarding/company"
        className="self-start text-sm text-muted hover:underline"
      >
        ← {t("Back")}
      </Link>
    </form>
  );
}
