"use client";

import { useEffect, useRef, useState } from "react";
import { phonePlaceholder } from "@/lib/countries";
import { provincesForCountry } from "@/lib/provinces";
import { savePersonalInfo, lookupResidentialAddress } from "./actions";
import { inputClasses, SelectChevron, CountrySelect } from "../_components/form-controls";

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

const NL_POSTAL_CODE = /^\d{4}\s?[A-Za-z]{2}$/;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Day/month/year is split into three fields — day and year as free text
 * (so no browser spin buttons), month as a dropdown of names — rather than
 * a native `type="date"` input, whose picker UI and formatting vary across
 * browsers/locales. The three pieces are recombined into a single ISO
 * `YYYY-MM-DD` string for submission via a hidden input. */
function DateOfBirthFields({ defaultValue }: { defaultValue: string }) {
  const [initialYear = "", initialMonth = "", initialDay = ""] = (
    defaultValue || ""
  ).split("-");

  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(
    initialMonth ? String(Number(initialMonth)) : ""
  );
  const [year, setYear] = useState(initialYear);

  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);
  const isValid =
    day !== "" &&
    month !== "" &&
    year.length === 4 &&
    dayNum >= 1 &&
    dayNum <= 31 &&
    monthNum >= 1 &&
    monthNum <= 12 &&
    yearNum >= 1900;
  // Roundtrip through Date to catch out-of-range days (e.g. 31 Feb).
  const isRealDate =
    isValid &&
    (() => {
      const d = new Date(yearNum, monthNum - 1, dayNum);
      return (
        d.getFullYear() === yearNum &&
        d.getMonth() === monthNum - 1 &&
        d.getDate() === dayNum
      );
    })();

  const isoValue = isRealDate
    ? `${year.padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(
        dayNum
      ).padStart(2, "0")}`
    : "";

  // All three sub-fields carry `required` for the empty case, but an
  // impossible combination (31 February) leaves them all filled while
  // isoValue is still "" — so surface that on the day field via the
  // constraint-validation API rather than letting it submit silently.
  const dayRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    dayRef.current?.setCustomValidity(
      isValid && !isRealDate ? "That date doesn't exist." : ""
    );
  }, [isValid, isRealDate]);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      Date of birth
      <div className="flex gap-3">
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          required
          placeholder="20"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))}
          className={`${inputClasses} flex-1 text-center`}
        />
        <div className="relative flex-1">
          <select
            required
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={`${inputClasses} w-full appearance-none pr-8`}
          >
            <option value="" disabled>
              Month
            </option>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          required
          placeholder="1993"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
          className={`${inputClasses} flex-1 text-center`}
        />
      </div>
      <input type="hidden" name="dateOfBirth" required value={isoValue} />
    </div>
  );
}

export default function PersonalForm({ existing }: { existing: Existing }) {
  const [country, setCountry] = useState(existing.residentialCountry || "NL");
  // Defaults to the country of residence — most shoppers' nationality
  // matches it, and it means this select (like the one above) always shows
  // a flag instead of sitting on the blank "Select…" placeholder.
  const [nationality, setNationality] = useState(existing.nationality || country);
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
    // A province code (or a house number, which only this country's form
    // even collects separately) from the old country is meaningless once
    // the country changes, so don't carry either over silently.
    setProvince("");
    setHouseNumber("");
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
      <DateOfBirthFields defaultValue={existing.dateOfBirth} />

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
              required
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
          required
          autoComplete="street-address"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          className={inputClasses}
        />
      </label>
      {/* The backend only has a single street column, and the house number
          field above (NL only) is what actually collects the number — so
          recombine here rather than showing it back in the street box.
          For non-NL, there's no separate house-number field and houseNumber
          stays "", so this is just `street` unchanged. */}
      <input
        type="hidden"
        name="residentialStreet"
        value={[street, houseNumber].filter(Boolean).join(" ")}
      />

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

      <button className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
        Continue
      </button>
    </form>
  );
}
