"use client";

import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { saveCompanyInfo, searchKvk, getKvkDetails } from "./actions";
import type { KvkSearchResult } from "@/lib/kvk";

type Existing = {
  companyCountry: string;
  kvkNumber: string;
  companyName: string;
  companyStreet: string;
  companyPostalCode: string;
  companyCity: string;
};

const inputClasses =
  "rounded-lg border border-line bg-panel px-3 py-2.5 text-base outline-none transition-colors focus:border-ink sm:text-sm";

export default function CompanyForm({
  existing,
  usingTestData,
}: {
  existing: Existing;
  usingTestData: boolean;
}) {
  const [country, setCountry] = useState(existing.companyCountry || "NL");
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

  const isNL = country === "NL";

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setKvkError(null);
    setResults(null);
    try {
      const found = await searchKvk(query);
      setResults(found);
      if (found.length === 0) {
        setKvkError("No matches. Try the KVK number, or fill in the details below by hand.");
      }
    } catch {
      setKvkError(
        "KVK lookup is temporarily unavailable — you can still fill in the details below by hand."
      );
    } finally {
      setSearching(false);
    }
  }

  async function pick(kvkNumber: string) {
    setSearching(true);
    setKvkError(null);
    try {
      const details = await getKvkDetails(kvkNumber);
      if (!details) {
        setKvkError("Couldn't load that company's details — try again or fill in by hand.");
        return;
      }
      setFields({
        kvkNumber: details.kvkNumber,
        companyName: details.name,
        companyStreet: details.street ?? "",
        companyPostalCode: details.postalCode ?? "",
        companyCity: details.city ?? "",
      });
      setResults(null);
      setQuery("");
    } catch {
      setKvkError("Couldn't load that company's details — try again or fill in by hand.");
    } finally {
      setSearching(false);
    }
  }

  function updateField(field: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [field]: value }));
  }

  return (
    <form action={saveCompanyInfo} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Country of business
        <select
          name="companyCountry"
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={inputClasses}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
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

          {results && results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((r) => (
                <li key={r.kvkNumber}>
                  <button
                    type="button"
                    onClick={() => pick(r.kvkNumber)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-surface"
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

          {fields.kvkNumber && (
            <p className="text-xs text-success">
              Selected KVK number {fields.kvkNumber} — review the details
              below and edit anything that needs it.
            </p>
          )}
        </div>
      )}

      {isNL && (
        <input type="hidden" name="kvkNumber" value={fields.kvkNumber} />
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        Company name
        <input
          type="text"
          name="companyName"
          required
          value={fields.companyName}
          onChange={(e) => updateField("companyName", e.target.value)}
          className={inputClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        Street address
        <input
          type="text"
          name="companyStreet"
          required
          value={fields.companyStreet}
          onChange={(e) => updateField("companyStreet", e.target.value)}
          className={inputClasses}
        />
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
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          City
          <input
            type="text"
            name="companyCity"
            required
            value={fields.companyCity}
            onChange={(e) => updateField("companyCity", e.target.value)}
            className={inputClasses}
          />
        </label>
      </div>

      <button className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
        Continue
      </button>
    </form>
  );
}
