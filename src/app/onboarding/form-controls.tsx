"use client";

import { useMemo } from "react";
import {
  COUNTRIES,
  countryFlag,
  CURRENCIES,
  currencySymbol,
  dialCode,
  localizeCountries,
} from "@/lib/onboarding/countries";
import { intlLocale } from "@/lib/i18n";
import { useT } from "@/app/i18n-provider";

/** Country list with names in the current language. */
function useLocalizedCountries(options: { code: string; name: string }[]) {
  const { locale } = useT();
  return useMemo(() => localizeCountries(options, intlLocale(locale)), [options, locale]);
}

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
  const localized = useLocalizedCountries(options);
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
        {localized.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      <SelectChevron />
    </div>
  );
}

/** Same shell as CountrySelect, but instead of a flag glyph laid over
 * plain text, the select's own text is made transparent and a "USD - $"
 * overlay stands in for it when closed — full "USD — US Dollar" names
 * stay legible in the open dropdown since each <option> gets its color
 * set back explicitly, which (being specified rather than inherited)
 * wins over the transparent color coming down from the <select>. */
export function CurrencySelect({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      {value && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-ink sm:text-sm"
        >
          {value} - {currencySymbol(value)}
        </span>
      )}
      <select
        name={name}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} w-full appearance-none pr-8 text-transparent`}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="text-ink">
            {c.code} — {c.name}
          </option>
        ))}
      </select>
      <SelectChevron />
    </div>
  );
}

/** Picks a dial code by picking a country — `value`/`onChange` carry the
 * 2-letter country code (like CountrySelect), not the "+XX" string itself,
 * so the caller can resolve it via dialCode() the same way everywhere
 * else does. Same transparent-select-plus-overlay shell as CurrencySelect,
 * showing just the flag + dial code when closed; the open list spells out
 * the country name too, since several entries can share a dial code
 * (+1 for US and CA, for instance) and the code alone can't disambiguate. */
export function DialCodeSelect({
  name,
  value,
  onChange,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const localized = useLocalizedCountries(COUNTRIES);
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base leading-none sm:text-sm"
      >
        {countryFlag(value)} {dialCode(value)}
      </span>
      <select
        name={name}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} w-full appearance-none pl-14 pr-8 text-transparent`}
      >
        {localized.map((c) => (
          <option key={c.code} value={c.code} className="text-ink">
            {c.name} ({dialCode(c.code)})
          </option>
        ))}
      </select>
      <SelectChevron />
    </div>
  );
}
