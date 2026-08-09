"use client";

import { useState } from "react";
import { COUNTRIES, countryFlag, phonePlaceholder } from "@/lib/countries";
import { provincesForCountry } from "@/lib/provinces";
import { savePersonalInfo, lookupResidentialAddress } from "./actions";

type Existing = {
  dateOfBirth: string;
  phoneNumber: string;
  residentialStreet: string;
  residentialCity: string;
  residentialProvince: string;
  residentialPostalCode: string;
  residentialCountry: string;
  nationality: string;
};

const inputClasses =
  "rounded-lg border border-line bg-panel px-3 py-2.5 text-base outline-none transition-colors focus:border-ink sm:text-sm";

const NL_POSTAL_CODE = /^\d{4}\s?[A-Za-z]{2}$/;

/** Chevron for our appearance-none selects — closer in and larger than the
 * default browser arrow, which sat right at the edge and rendered tiny. */
function SelectChevron() {
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

function CountrySelect({
  name,
  value,
  onChange,
  placeholder,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        name={name}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} w-full appearance-none pr-8`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {countryFlag(c.code)} {c.name}
          </option>
        ))}
      </select>
      <SelectChevron />
    </div>
  );
}

export default function PersonalForm({ existing }: { existing: Existing }) {
  const [country, setCountry] = useState(existing.residentialCountry || "NL");
  const [nationality, setNationality] = useState(existing.nationality);
  const [postalCode, setPostalCode] = useState(existing.residentialPostalCode);
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState(existing.residentialStreet);
  const [city, setCity] = useState(existing.residentialCity);
  const [province, setProvince] = useState(existing.residentialProvince);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const isNL = country === "NL";
  const provinceOptions = provincesForCountry(country);

  function handleCountryChange(next: string) {
    setCountry(next);
    // A province code from the old country (e.g. "NH") is meaningless once
    // the country changes, so don't carry it over silently.
    setProvince("");
  }

  async function runLookup(nextPostalCode: string, nextHouseNumber: string) {
    if (!isNL) return;
    if (!NL_POSTAL_CODE.test(nextPostalCode.trim()) || !nextHouseNumber.trim()) return;

    setLooking(true);
    setLookupError(null);
    try {
      const found = await lookupResidentialAddress(nextPostalCode, nextHouseNumber);
      if (found) {
        setStreet(found.street);
        setCity(found.city);
        if (found.province) setProvince(found.province);
      } else {
        setLookupError(
          "No address found for that postcode + house number — fill it in by hand."
        );
      }
    } catch {
      setLookupError(
        "Address lookup is temporarily unavailable — fill it in by hand."
      );
    } finally {
      setLooking(false);
    }
  }

  return (
    <form action={savePersonalInfo} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Date of birth
        <input
          type="date"
          name="dateOfBirth"
          required
          defaultValue={existing.dateOfBirth}
          className={inputClasses}
        />
      </label>

      {isNL && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            Postal code
            <input
              type="text"
              required
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              onBlur={() => runLookup(postalCode, houseNumber)}
              autoComplete="postal-code"
              placeholder="1234 AB"
              className={inputClasses}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            House number
            <input
              type="text"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              onBlur={() => runLookup(postalCode, houseNumber)}
              placeholder="12 or 41-2"
              className={inputClasses}
            />
          </label>
        </div>
      )}

      {isNL && (looking || lookupError) && (
        <p className={`text-xs ${lookupError ? "text-danger" : "text-muted"}`}>
          {looking ? "Looking up address…" : lookupError}
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        Street address
        <input
          type="text"
          name="residentialStreet"
          required
          autoComplete="street-address"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className={inputClasses}
        />
      </label>

      <div className={`grid gap-3 ${isNL ? "grid-cols-2" : "grid-cols-3"}`}>
        <label className="flex flex-col gap-1.5 text-sm">
          City
          <input
            type="text"
            name="residentialCity"
            required
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClasses}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Province
          {provinceOptions ? (
            <div className="relative">
              <select
                name="residentialProvince"
                required
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className={`${inputClasses} w-full appearance-none pr-8`}
              >
                <option value="" disabled>
                  Select…
                </option>
                {provinceOptions.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          ) : (
            <input
              type="text"
              name="residentialProvince"
              autoComplete="address-level1"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Province / region"
              className={inputClasses}
            />
          )}
        </label>

        {isNL ? (
          <input type="hidden" name="residentialPostalCode" value={postalCode} />
        ) : (
          <label className="flex flex-col gap-1.5 text-sm">
            Postal code
            <input
              type="text"
              name="residentialPostalCode"
              required
              autoComplete="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className={inputClasses}
            />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          Country of residence
          <CountrySelect
            name="residentialCountry"
            value={country}
            onChange={handleCountryChange}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Nationality
          <CountrySelect
            name="nationality"
            value={nationality}
            onChange={setNationality}
            placeholder="Select…"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        Phone number
        <input
          type="tel"
          name="phoneNumber"
          required
          autoComplete="tel"
          placeholder={phonePlaceholder(country)}
          defaultValue={existing.phoneNumber}
          className={inputClasses}
        />
      </label>

      <button className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
        Continue
      </button>
    </form>
  );
}
