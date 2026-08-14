"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenError } from "zod";
import Link from "next/link";
import { saveCompanyInfo, searchKvk, getKvkDetails } from "./actions";
import type { KvkSearchResult } from "@/lib/onboarding/kvk";
import { inputClasses, CountrySelect, SelectChevron } from "../form-controls";
import { COMPANY_COUNTRIES, COMPANY_COUNTRY_CODES } from "@/lib/onboarding/countries";
import { companyInfoSchema } from "@/lib/zod";

type Existing = {
  companyCountry: string;
  relationshipType: string;
  kvkNumber: string;
  companyName: string;
  companyStreet: string;
  companyPostalCode: string;
  companyCity: string;
};

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="1" strokeLinejoin="round" />
      <path d="M9 7h1M14 7h1M9 11h1M14 11h1" strokeLinecap="round" />
      <path d="M10 21v-4h4v4" strokeLinejoin="round" />
    </svg>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M9 4 7 20M17 4l-2 16M4 9h16M3.5 15h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 3v18M8 21h8" strokeLinecap="round" />
      <path d="M5 7h6M13 7h6" strokeLinecap="round" />
      <path d="M5 7 2.5 12a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 5a2.5 2.5 0 0 0 5 0L19 7Z" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.25" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3" y="7.5" width="18" height="12" rx="1.5" strokeLinejoin="round" />
      <path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" strokeLinejoin="round" />
      <path d="M3 12.5h18" />
    </svg>
  );
}

// Mirrors AdyenEntityRelationshipType (src/lib/adyen/legalEntity.ts) and
// ENTITY_RELATIONSHIP_TYPES (src/lib/zod.ts) — keep all three in sync.
const RELATIONSHIP_OPTIONS = [
  { value: "signatory", label: "Signatory — authorized to sign on the company's behalf" },
  { value: "uboThroughOwnership", label: "Ultimate beneficial owner — through ownership (25%+ shares)" },
  { value: "uboThroughControl", label: "Ultimate beneficial owner — through control (e.g. voting rights)" },
  { value: "all", label: "All of the above" },
] as const;

// useFormStatus only reports the enclosing <form>'s real pending state
// when called from a component distinct from the one rendering the
// <form> itself (see the same pattern in login/auth-panels.tsx) — hence
// pulling this out instead of inlining the button below. This click
// creates the organisation + membership row (saveCompanyInfo) before
// moving on to the business-activity screen, so a second click landing
// before the first finishes could still double up that insert.
function ContinueButton({ disabledUntilReady }: { disabledUntilReady: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || disabledUntilReady}
      className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

export default function CompanyForm({
  existing,
  usingTestData,
  organisationId,
}: {
  existing: Existing;
  usingTestData: boolean;
  /** Null until this organisation has actually been created (first save). */
  organisationId: string | null;
}) {
  // Clamp to NL/GB/US: a pre-existing org saved before that restriction
  // existed could carry any country code, which wouldn't match any option
  // in the now-restricted CountrySelect below.
  const [country, setCountry] = useState(
    (COMPANY_COUNTRY_CODES as readonly string[]).includes(existing.companyCountry)
      ? existing.companyCountry
      : "NL"
  );
  const [relationshipType, setRelationshipType] = useState(existing.relationshipType);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KvkSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [kvkError, setKvkError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    kvkNumber: existing.kvkNumber,
    companyName: existing.companyName,
    companyStreet: existing.companyStreet,
    companyPostalCode: existing.companyPostalCode,
    companyCity: existing.companyCity,
  });
  // legalForm/mainActivity are display-only — organisations doesn't persist
  // them, so a revisit re-fetches them from KVK below rather than storing
  // (and keeping in sync) two more columns for what's already re-derivable
  // from the kvkNumber we do store.
  const [details, setDetails] = useState<{
    legalForm: string | null;
    mainActivity: string | null;
  }>({ legalForm: null, mainActivity: null });

  const isNL = country === "NL";
  // A company has been chosen (fresh pick, or an already-saved one on
  // revisit) — show the read-only summary instead of raw editable fields.
  const hasSelectedCompany = isNL && Boolean(fields.kvkNumber);

  // Live client-side mirror of companyInfoSchema (lib/zod.ts — same schema
  // saveCompanyInfo re-validates with server-side), same pattern as
  // login/auth-panels.tsx: re-parse on every change, but only surface a
  // field's error once the user has actually left it, so errors don't
  // flash red before they've had a chance to type anything.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  function touch(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }
  const parsed = companyInfoSchema.safeParse({
    companyCountry: country,
    relationshipType,
    kvkNumber: fields.kvkNumber,
    companyName: fields.companyName,
    companyStreet: fields.companyStreet,
    companyPostalCode: fields.companyPostalCode,
    companyCity: fields.companyCity,
  });
  const fieldErrors = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  function fieldError(field: keyof typeof fieldErrors) {
    if (!touched[field]) return undefined;
    return fieldErrors[field]?.[0];
  }

  useEffect(() => {
    if (!existing.kvkNumber) return;
    let cancelled = false;
    getKvkDetails(existing.kvkNumber).then((found) => {
      if (!cancelled && found) {
        setDetails({ legalForm: found.legalForm, mainActivity: found.mainActivity });
      }
    });
    return () => {
      cancelled = true;
    };
    // Only ever needed for the value this form mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

    // A KVK number identifies exactly one company — no point showing a
    // picker with a single, foregone option. Go straight to it.
    if (/^\d{8}$/.test(trimmed)) {
      await pick(trimmed);
      return;
    }

    setSearching(true);
    setKvkError(null);
    setResults(null);
    try {
      const found = await searchKvk(trimmed);
      setResults(found);
      if (found.length === 0) {
        setKvkError("No matches. Try the KVK number instead.");
      }
    } catch {
      setKvkError("KVK lookup is temporarily unavailable — try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  async function pick(kvkNumber: string) {
    setSearching(true);
    setKvkError(null);
    try {
      const found = await getKvkDetails(kvkNumber);
      if (!found) {
        setKvkError("Couldn't load that company's details — try again.");
        return;
      }
      setFields({
        kvkNumber: found.kvkNumber,
        companyName: found.name,
        companyStreet: found.street ?? "",
        companyPostalCode: found.postalCode ?? "",
        companyCity: found.city ?? "",
      });
      setDetails({ legalForm: found.legalForm, mainActivity: found.mainActivity });
      setResults(null);
      setQuery("");
    } catch {
      setKvkError("Couldn't load that company's details — try again.");
    } finally {
      setSearching(false);
    }
  }

  function changeCompany() {
    setFields((f) => ({ ...f, kvkNumber: "" }));
    setDetails({ legalForm: null, mainActivity: null });
  }

  function updateField(field: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [field]: value }));
  }

  return (
    <form action={saveCompanyInfo} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Country of business
        <CountrySelect
          name="companyCountry"
          value={country}
          onChange={setCountry}
          options={COMPANY_COUNTRIES}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Your relationship to the company
        <div className="relative">
          <select
            name="relationshipType"
            required
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
            onBlur={() => touch("relationshipType")}
            aria-invalid={!!fieldError("relationshipType")}
            className={`${inputClasses} w-full appearance-none pr-8`}
          >
            <option value="" disabled>
              Select…
            </option>
            {RELATIONSHIP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
        {fieldError("relationshipType") && (
          <span className="text-xs text-danger">{fieldError("relationshipType")}</span>
        )}
      </label>

      {isNL && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Find your company in the KVK register
          </p>
          {usingTestData && (
            <p className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted">
              Dev mode: searching KVK&apos;s sandbox test data (fictional
              companies), not the live register. Set KVK_API_KEY to search
              real companies.
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
              placeholder="Company name or KVK number"
              className={`${inputClasses} flex-1`}
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching || !query.trim()}
              className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>

          {kvkError && <p className="text-xs text-danger">{kvkError}</p>}

          {/* All options shown directly, not tucked behind a closed
              dropdown — a name is ambiguous, so the whole point is letting
              you scan and compare them in one glance. */}
          {results && results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((r) => (
                <li key={r.kvkNumber}>
                  <button
                    type="button"
                    onClick={() => pick(r.kvkNumber)}
                    disabled={searching}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-surface disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate">
                      {r.name}
                      {r.city && (
                        <span className="text-muted"> — {r.city}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {r.kvkNumber}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isNL && (
        <input type="hidden" name="kvkNumber" value={fields.kvkNumber} />
      )}

      {hasSelectedCompany ? (
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold">Company details</p>
          <div className="rounded-xl border border-line bg-panel p-5">
            <div className="flex items-center gap-2.5">
              <BuildingIcon className="h-5 w-5 shrink-0 text-muted" />
              <p className="font-semibold">{fields.companyName}</p>
            </div>

            <dl className="mt-4 grid grid-cols-[20px_auto_1fr] items-start gap-x-2.5 gap-y-3 text-sm">
              <HashIcon className="h-4 w-4 text-muted" />
              <dt className="text-muted">KVK number</dt>
              <dd className="min-w-0">{fields.kvkNumber}</dd>

              {details.legalForm && (
                <>
                  <ScaleIcon className="h-4 w-4 text-muted" />
                  <dt className="text-muted">Legal form</dt>
                  <dd className="min-w-0">{details.legalForm}</dd>
                </>
              )}

              <PinIcon className="h-4 w-4 text-muted" />
              <dt className="text-muted">Address</dt>
              <dd className="min-w-0">
                {[
                  fields.companyStreet,
                  [fields.companyPostalCode, fields.companyCity]
                    .filter(Boolean)
                    .join(", "),
                ]
                  .filter(Boolean)
                  .join(", ")}
              </dd>

              {details.mainActivity && (
                <>
                  <BriefcaseIcon className="h-4 w-4 text-muted" />
                  <dt className="text-muted">Main activity</dt>
                  <dd className="min-w-0">{details.mainActivity}</dd>
                </>
              )}
            </dl>

            <button
              type="button"
              onClick={changeCompany}
              className="mt-4 text-sm text-accent hover:underline"
            >
              Change company
            </button>
          </div>

          {/* Fields above are read-only display — these carry the same
              values through to the server action. */}
          <input type="hidden" name="companyName" value={fields.companyName} />
          <input type="hidden" name="companyStreet" value={fields.companyStreet} />
          <input type="hidden" name="companyPostalCode" value={fields.companyPostalCode} />
          <input type="hidden" name="companyCity" value={fields.companyCity} />
        </div>
      ) : isNL ? (
        // NL always goes through the KVK register above — no manual-entry
        // fallback. Submitting without picking a result fails companyName's
        // required check server-side and bounces back with that error.
        null
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            Company name
            <input
              type="text"
              name="companyName"
              required
              value={fields.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              onBlur={() => touch("companyName")}
              aria-invalid={!!fieldError("companyName")}
              className={inputClasses}
            />
            {fieldError("companyName") && (
              <span className="text-xs text-danger">{fieldError("companyName")}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            Street address
            <input
              type="text"
              name="companyStreet"
              required
              value={fields.companyStreet}
              onChange={(e) => updateField("companyStreet", e.target.value)}
              onBlur={() => touch("companyStreet")}
              aria-invalid={!!fieldError("companyStreet")}
              className={inputClasses}
            />
            {fieldError("companyStreet") && (
              <span className="text-xs text-danger">{fieldError("companyStreet")}</span>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              Postal code
              <input
                type="text"
                name="companyPostalCode"
                required
                value={fields.companyPostalCode}
                onChange={(e) => updateField("companyPostalCode", e.target.value)}
                onBlur={() => touch("companyPostalCode")}
                aria-invalid={!!fieldError("companyPostalCode")}
                className={inputClasses}
              />
              {fieldError("companyPostalCode") && (
                <span className="text-xs text-danger">{fieldError("companyPostalCode")}</span>
              )}
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              City
              <input
                type="text"
                name="companyCity"
                required
                value={fields.companyCity}
                onChange={(e) => updateField("companyCity", e.target.value)}
                onBlur={() => touch("companyCity")}
                aria-invalid={!!fieldError("companyCity")}
                className={inputClasses}
              />
              {fieldError("companyCity") && (
                <span className="text-xs text-danger">{fieldError("companyCity")}</span>
              )}
            </label>
          </div>
        </>
      )}

      {/* NL has no manual-entry fallback (see the null branch above), so
          there's nothing to submit until a KVK search result is actually
          picked — fade the button out rather than leaving it looking
          clickable ahead of that (and again while the submission itself
          is in flight, see ContinueButton). Industry, reserve fund,
          support contact, and VAT number are asked next, on the
          business-activity screen. */}
      <ContinueButton disabledUntilReady={isNL && !hasSelectedCompany} />

      {/* Only meaningful before the org actually exists: once created (or
          joined), /onboarding/organisation's own guard just bounces past
          it again since that fork is already resolved — so don't offer a
          "go back and reconsider" that wouldn't actually undo anything. */}
      {!organisationId && (
        <Link
          href="/onboarding/organisation"
          className="self-start text-sm text-muted hover:underline"
        >
          ← Back
        </Link>
      )}
    </form>
  );
}
