"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenError } from "zod";
import Link from "next/link";
import { saveBusinessActivity } from "../actions";
import { inputClasses, CurrencySelect, SelectChevron } from "../../form-controls";
import { INDUSTRY_CODE_GROUPS } from "@/lib/onboarding/industry-codes";
import { businessActivitySchema } from "@/lib/zod";

// Mirrors HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE in src/lib/adyen/legalEntity.ts.
// Not imported directly — that file pulls in the Adyen client, which has
// no business being bundled into client code.
const HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE = "81399";

// Prefilled for VvEs so the user can just hit Continue — still editable.
const HOMEOWNERS_ASSOCIATION_DESCRIPTION =
  "A Homeowners’ Association (HOA) manages and maintains the common areas of an apartment building. The HOA collects contributions from the owners, arranges maintenance and repairs, and ensures that shared expenses and agreements are properly managed.";

type Existing = {
  industryCode: string;
  reserveFundCurrency: string;
  annualReserveFundContributions: string;
  vatNumber: string;
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
    businessDescription,
  });
  const fieldErrors = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  function fieldError(field: keyof typeof fieldErrors) {
    if (!touched[field]) return undefined;
    return fieldErrors[field]?.[0];
  }

  return (
    <form action={saveBusinessActivity} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Industry
        <div className="relative">
          <select
            name={isVve ? undefined : "industryCode"}
            required
            disabled={isVve}
            value={industryCode}
            onChange={(e) => setIndustryCode(e.target.value)}
            onBlur={() => touch("industryCode")}
            aria-invalid={!!fieldError("industryCode")}
            className={`${inputClasses} w-full appearance-none pr-8 disabled:opacity-70`}
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
        {/* A disabled <select> doesn't submit its value — this carries it
            through instead, same pattern as the read-only company summary
            in company-form.tsx. */}
        {isVve && (
          <input type="hidden" name="industryCode" value={HOMEOWNERS_ASSOCIATION_INDUSTRY_CODE} />
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

      <div className="flex flex-col gap-1.5 text-sm">
        {isVve
          ? "Expected Monthly contribution for this account"
          : "Estimated annual reserve fund contributions"}
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

      <label className="flex flex-col gap-1.5 text-sm">
        VAT number
        <input
          type="text"
          name="vatNumber"
          value={vatNumber}
          onChange={(e) => setVatNumber(e.target.value)}
          onBlur={() => touch("vatNumber")}
          aria-invalid={!!fieldError("vatNumber")}
          className={inputClasses}
        />
        <span className="text-xs text-muted">
          Leave blank if the organisation doesn&apos;t have one — most don&apos;t.
        </span>
        {fieldError("vatNumber") && (
          <span className="text-xs text-danger">{fieldError("vatNumber")}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Business description
        <textarea
          name="businessDescription"
          rows={3}
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
