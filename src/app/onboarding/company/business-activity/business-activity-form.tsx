"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenError } from "zod";
import Link from "next/link";
import { saveBusinessActivity } from "../actions";
import { inputClasses, CurrencySelect, SelectChevron } from "../../form-controls";
import { INDUSTRY_CODE_GROUPS } from "@/lib/onboarding/industry-codes";
import { businessActivitySchema, VAT_EXEMPTION_REASONS } from "@/lib/zod";

const VAT_EXEMPTION_REASON_LABELS: Record<(typeof VAT_EXEMPTION_REASONS)[number], string> = {
  belowTaxThreshold: "Revenue below tax threshold",
  industryExemption: "Industry exemption",
};

// Prefilled for VvEs so the user can just hit Continue — still editable.
const HOMEOWNERS_ASSOCIATION_DESCRIPTION =
  "A Homeowners’ Association (HOA) manages and maintains the common areas of an apartment building. The HOA collects contributions from the owners, arranges maintenance and repairs, and ensures that shared expenses and agreements are properly managed.";

type Existing = {
  industryCode: string;
  reserveFundCurrency: string;
  annualReserveFundContributions: string;
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
  return (
    <button
      disabled={pending || !formValid}
      className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

export default function BusinessActivityForm({
  existing,
  isVve,
}: {
  existing: Existing;
  /** Whether this org's KVK rechtsvorm is "vereniging van eigenaars" — see
   * isHomeownersAssociation in src/lib/adyen/legalEntity.ts. Locks
   * industry to a fixed value and changes what the reserve-fund amount
   * asks for; enforced server-side too (saveBusinessActivity), this is
   * just what makes that legible in the form itself. */
  isVve: boolean;
}) {
  const [industryCode, setIndustryCode] = useState(existing.industryCode);
  const [reserveFundCurrency, setReserveFundCurrency] = useState(existing.reserveFundCurrency);
  const [annualReserveFundContributions, setAnnualReserveFundContributions] = useState(
    existing.annualReserveFundContributions
  );
  const [vatNumber, setVatNumber] = useState(existing.vatNumber);
  const [vatExemptionReason, setVatExemptionReason] = useState(existing.vatExemptionReason);
  const [businessDescription, setBusinessDescription] = useState(
    existing.businessDescription || (isVve ? HOMEOWNERS_ASSOCIATION_DESCRIPTION : "")
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
    reserveFundCurrency,
    annualReserveFundContributions,
    vatNumber,
    vatExemptionReason,
    businessDescription,
  });
  const fieldErrors = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  function fieldError(field: keyof typeof fieldErrors) {
    if (!touched[field]) return undefined;
    return fieldErrors[field]?.[0];
  }

  return (
    <form action={saveBusinessActivity} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Industry
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
                value="Home Association"
                disabled
                readOnly
                className={`${inputClasses} disabled:opacity-70`}
              />
              <input type="hidden" name="industryCode" value={industryCode} />
            </>
          ) : (
            <div className="relative">
              <select
                name="industryCode"
                required
                value={industryCode}
                onChange={(e) => setIndustryCode(e.target.value)}
                onBlur={() => touch("industryCode")}
                aria-invalid={!!fieldError("industryCode")}
                className={`${inputClasses} w-full appearance-none pr-8`}
              >
                <option value="" disabled>
                  Select…
                </option>
                {INDUSTRY_CODE_GROUPS.map((group) => (
                  <optgroup key={group.sector} label={group.sector}>
                    {group.codes.map((i) => (
                      <option key={i.code} value={i.code}>
                        {i.description}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <SelectChevron />
            </div>
          )}
          <span className="text-xs text-muted">
            {isVve
              ? "Fixed for homeowners' associations."
              : "Adyen's own classification, closest to what the organisation actually does day to day."}
          </span>
          {fieldError("industryCode") && (
            <span className="text-xs text-danger">{fieldError("industryCode")}</span>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-panel p-3 text-sm">
        <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
          {isVve
            ? "Expected Monthly contribution for this account"
            : "Estimated annual reserve fund contributions"}
        </span>
        <div className="grid grid-cols-[1fr_3fr] gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Currency</span>
            <CurrencySelect
              name="reserveFundCurrency"
              value={reserveFundCurrency}
              onChange={setReserveFundCurrency}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Amount</span>
            <input
              type="number"
              name="annualReserveFundContributions"
              min="0"
              step="1"
              required
              value={annualReserveFundContributions}
              onChange={(e) => setAnnualReserveFundContributions(e.target.value)}
              onBlur={() => touch("annualReserveFundContributions")}
              aria-invalid={!!fieldError("annualReserveFundContributions")}
              className={inputClasses}
            />
          </label>
        </div>
        {/* <span className="text-xs text-muted">
          {isVve
            ? "What the association collects from its homeowners each month."
            : "Total the association's households pay in each year toward the reserve fund for future maintenance and restoration."}
        </span> */}
        {(fieldError("reserveFundCurrency") || fieldError("annualReserveFundContributions")) && (
          <span className="text-xs text-danger">
            {fieldError("reserveFundCurrency") ?? fieldError("annualReserveFundContributions")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            VAT number
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
              ? "Homeowners’ associations are VAT-exempt."
              : "Leave blank if the organisation doesn’t have one — most don’t."}
          </span>
          {fieldError("vatNumber") && (
            <span className="text-xs text-danger">{fieldError("vatNumber")}</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            VAT exemption reason
          </span>
          {isVve ? (
            <>
              <input
                type="text"
                value={VAT_EXEMPTION_REASON_LABELS.industryExemption}
                disabled
                readOnly
                className={`${inputClasses} border-line bg-line/50 text-muted opacity-100`}
              />
              <input type="hidden" name="vatExemptionReason" value="industryExemption" />
            </>
          ) : (
            <div className="relative">
              <select
                name="vatExemptionReason"
                value={vatExemptionReason}
                onChange={(e) => setVatExemptionReason(e.target.value)}
                onBlur={() => touch("vatExemptionReason")}
                aria-invalid={!!fieldError("vatExemptionReason")}
                className={`${inputClasses} w-full appearance-none pr-8`}
              >
                <option value="">Not exempt</option>
                {VAT_EXEMPTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {VAT_EXEMPTION_REASON_LABELS[reason]}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          )}
          <span className="text-xs text-muted">
            {isVve
              ? "Fixed for homeowners' associations."
              : "Only relevant if the organisation has no VAT number."}
          </span>
          {fieldError("vatExemptionReason") && (
            <span className="text-xs text-danger">{fieldError("vatExemptionReason")}</span>
          )}
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Business description
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
            A short description of what the organisation does.
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
        ← Back
      </Link>
    </form>
  );
}
