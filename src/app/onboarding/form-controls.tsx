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
import Select from "@/components/select";

/** Country list with names in the current language. */
function useLocalizedCountries(options: { code: string; name: string }[]) {
  const { locale } = useT();
  return useMemo(() => localizeCountries(options, intlLocale(locale)), [options, locale]);
}

// Shared between every /onboarding form (personal, company, …) so their
// inputs look identical — and identical to the dropdowns (see
// components/select.tsx), which use the same border, radius and focus.
export const inputClasses =
  "rounded-lg border border-db-input bg-panel px-3 py-2.5 text-base outline-none transition-colors focus:border-accent aria-[invalid=true]:border-danger sm:text-sm";

/** Flag emoji sized to sit next to option text. */
function Flag({ code }: { code: string }) {
  return (
    <span aria-hidden className="w-5 shrink-0 text-center text-lg leading-none">
      {countryFlag(code)}
    </span>
  );
}

export function CountrySelect({
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  options = COUNTRIES,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Defaults to every country — pass a subset (e.g. COMPANY_COUNTRIES) to
   * restrict which ones this particular dropdown offers. */
  options?: { code: string; name: string }[];
}) {
  const localized = useLocalizedCountries(options);
  return (
    <Select
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      // A short list (company countries) doesn't need a search box.
      searchable={localized.length > 8}
      options={localized.map((c) => ({ value: c.code, label: c.name, icon: <Flag code={c.code} /> }))}
    />
  );
}

/** Currency picker: "USD — US Dollar" in the menu, "USD - $" when closed. */
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
    <Select
      name={name}
      value={value}
      onChange={onChange}
      searchable
      options={CURRENCIES.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
        selectedLabel: `${c.code} - ${currencySymbol(c.code)}`,
      }))}
    />
  );
}

/** Picks a dial code by picking a country — `value`/`onChange` carry the
 * 2-letter country code (like CountrySelect), not the "+XX" string itself,
 * so the caller can resolve it via dialCode() the same way everywhere
 * else does. Closed it shows just flag + dial code; the menu spells out
 * the country name too, since several countries share a dial code (+1
 * for US and CA, for instance). */
export function DialCodeSelect({
  name,
  value,
  onChange,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useT();
  const localized = useLocalizedCountries(COUNTRIES);
  return (
    <Select
      name={name}
      value={value}
      onChange={onChange}
      searchable
      aria-label={t("Country calling code")}
      menuClassName="min-w-[18rem]"
      options={localized.map((c) => ({
        value: c.code,
        label: `${c.name} (${dialCode(c.code)})`,
        selectedLabel: dialCode(c.code),
        icon: <Flag code={c.code} />,
      }))}
    />
  );
}
