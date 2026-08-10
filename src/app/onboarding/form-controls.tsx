"use client";

import { COUNTRIES, countryFlag } from "@/lib/countries";

// Shared between every /onboarding form (personal, company, …) so their
// inputs/selects look identical.
export const inputClasses =
  "rounded-lg border border-line bg-panel px-3 py-2.5 text-base outline-none transition-colors focus:border-ink sm:text-sm";

/** Chevron for our appearance-none selects — closer in and larger than the
 * default browser arrow, which sat right at the edge and rendered tiny. */
export function SelectChevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
    >
      <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CountrySelect({
  name,
  value,
  onChange,
  placeholder,
  options = COUNTRIES,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Defaults to every country — pass a subset (e.g. COMPANY_COUNTRIES) to
   * restrict which ones this particular dropdown offers. */
  options?: { code: string; name: string }[];
}) {
  // <option> text can't be styled — a flag emoji inside it is stuck at the
  // same size as the country name next to it. To make the flag noticeably
  // bigger without also blowing up the text (and staying the same size as
  // every other field), the option list stays plain text and a standalone,
  // larger flag glyph is layered on top of the closed control instead.
  return (
    <div className="relative">
      {value && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xl leading-none"
        >
          {countryFlag(value)}
        </span>
      )}
      <select
        name={name}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} w-full appearance-none pr-8 ${value ? "pl-9" : ""}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <SelectChevron />
    </div>
  );
}
