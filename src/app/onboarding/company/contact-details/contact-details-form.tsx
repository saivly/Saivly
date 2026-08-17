"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenError } from "zod";
import Link from "next/link";
import { saveContactDetails } from "../actions";
import { inputClasses } from "../../form-controls";
import { phonePlaceholder } from "@/lib/onboarding/countries";
import { contactDetailsSchema } from "@/lib/zod";

type Existing = {
  companyCountry: string;
  website: string;
  supportEmail: string;
  supportPhone: string;
};

// Same useFormStatus caveat as company-form.tsx's ContinueButton — pulled
// out so it reports the enclosing <form>'s pending state rather than
// always false. This click fires the whole organisation-legal-entity/
// account-holder/balance-account/business-line chain in Adyen
// (saveContactDetails), so a second click landing before the first
// finishes could very well mint duplicates there.
function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

export default function ContactDetailsForm({
  existing,
  isVve,
}: {
  existing: Existing;
  /** Whether this org's KVK rechtsvorm is "vereniging van eigenaars" — see
   * isHomeownersAssociation in src/lib/adyen/legalEntity.ts. Locks website
   * to a fixed (empty) value; enforced server-side too
   * (saveContactDetails), this is just what makes that legible in the
   * form itself. */
  isVve: boolean;
}) {
  const [website, setWebsite] = useState(existing.website);
  const [supportEmail, setSupportEmail] = useState(existing.supportEmail);
  const [supportPhone, setSupportPhone] = useState(existing.supportPhone);

  // Live client-side mirror of contactDetailsSchema (lib/zod.ts — same
  // schema saveContactDetails re-validates with server-side), same
  // pattern as company-form.tsx: re-parse on every change, but only
  // surface a field's error once the user has actually left it.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  function touch(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }
  const parsed = contactDetailsSchema.safeParse({
    website,
    supportEmail,
    supportPhone,
  });
  const fieldErrors = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  function fieldError(field: keyof typeof fieldErrors) {
    if (!touched[field]) return undefined;
    return fieldErrors[field]?.[0];
  }

  return (
    <form action={saveContactDetails} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Website (if applicable)
        <input
          type="url"
          name={isVve ? undefined : "website"}
          disabled={isVve}
          placeholder={isVve ? "" : "https://example.com"}
          value={isVve ? "" : website}
          onChange={(e) => setWebsite(e.target.value)}
          onBlur={() => touch("website")}
          aria-invalid={!!fieldError("website")}
          className={`${inputClasses} disabled:opacity-70`}
        />
        {isVve && (
          <span className="text-xs text-muted">
            Not applicable for homeowners&apos; associations.
          </span>
        )}
        {fieldError("website") && (
          <span className="text-xs text-danger">{fieldError("website")}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Support email address
        <input
          type="email"
          name="supportEmail"
          required
          value={supportEmail}
          onChange={(e) => setSupportEmail(e.target.value)}
          onBlur={() => touch("supportEmail")}
          aria-invalid={!!fieldError("supportEmail")}
          className={inputClasses}
        />
        <span className="text-xs text-muted">
          Where homeowners can reach the association with questions.
        </span>
        {fieldError("supportEmail") && (
          <span className="text-xs text-danger">{fieldError("supportEmail")}</span>
        )}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Support phone number
        <input
          type="tel"
          name="supportPhone"
          required
          placeholder={phonePlaceholder(existing.companyCountry)}
          value={supportPhone}
          onChange={(e) => setSupportPhone(e.target.value)}
          onBlur={() => touch("supportPhone")}
          aria-invalid={!!fieldError("supportPhone")}
          className={inputClasses}
        />
        {fieldError("supportPhone") && (
          <span className="text-xs text-danger">{fieldError("supportPhone")}</span>
        )}
      </label>

      <ContinueButton />

      <Link
        href="/onboarding/company/business-activity"
        className="self-start text-sm text-muted hover:underline"
      >
        ← Back
      </Link>
    </form>
  );
}
