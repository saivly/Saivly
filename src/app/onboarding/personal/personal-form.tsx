"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenError } from "zod";
import { phonePlaceholder } from "@/lib/onboarding/countries";
import { provincesForCountry } from "@/lib/onboarding/provinces";
import { savePersonalInfo, lookupResidentialAddress } from "./actions";
import { inputClasses, SelectChevron, CountrySelect } from "../form-controls";
import { personalInfoSchema } from "@/lib/zod";

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

function isAdult(iso: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  return date <= eighteenYearsAgo;
}

/** Day/month/year is split into three fields — day and year as free text
 * (so no browser spin buttons), month as a dropdown of names — rather than
 * a native `type="date"` input, whose picker UI and formatting vary across
 * browsers/locales. The three pieces are recombined into a single ISO
 * `YYYY-MM-DD` string, reported to the parent (for the Continue button's
 * validity gate) via onValidityChange rather than read back out of the
 * hidden input, since the parent needs to know *before* a submit attempt.
 */
function DateOfBirthFields({
  defaultValue,
  onValidityChange,
}: {
  defaultValue: string;
  onValidityChange: (isoValue: string) => void;
}) {
  const [initialYear = "", initialMonth = "", initialDay = ""] = (
    defaultValue || ""
  ).split("-");

  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(
    initialMonth ? String(Number(initialMonth)) : ""
  );
  const [year, setYear] = useState(initialYear);
  const [touched, setTouched] = useState(false);

  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);
  const allEmpty = day === "" && month === "" && year === "";
  const isComplete =
    day !== "" &&
    month !== "" &&
    year.length === 4 &&
    dayNum >= 1 &&
    dayNum <= 31 &&
    monthNum >= 1 &&
    monthNum <= 12;
  // Roundtrip through Date to catch out-of-range days (e.g. 31 Feb).
  const isRealDate =
    isComplete &&
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

  // Same messages as personalInfoSchema (lib/zod.ts) — kept in sync by
  // hand since this half of the validation never leaves the browser (the
  // hidden input below is what the server actually re-validates).
  //
  // Only judge date-shape/range once all three pieces are filled in
  // (isComplete) — day/month/year are three separate inputs sharing one
  // `touched` flag, so blurring day alone (month/year still empty) must
  // not read as "this date doesn't exist" when there's no date yet to
  // judge, just an incomplete one.
  let error: string | null = null;
  if (touched) {
    if (allEmpty) error = "Date of birth is required.";
    else if (isComplete) {
      if (!isRealDate) error = "That date doesn't exist.";
      else if (new Date(isoValue) > new Date())
        error = "Date of birth can’t be in the future.";
      else if (!isAdult(isoValue))
        error = "You must be at least 18 years old.";
    }
  }

  useEffect(() => {
    onValidityChange(isoValue);
    // onValidityChange is a fresh closure every render (it reads other
    // form state) — only isoValue itself should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoValue]);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      Date of birth
      <div className="flex gap-3">
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          required
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))}
          onBlur={() => setTouched(true)}
          aria-invalid={!!error}
          className={`${inputClasses} flex-[2] text-center`}
        />
        <div className="relative flex-[5]">
          <select
            required
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={!!error}
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
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
          onBlur={() => setTouched(true)}
          aria-invalid={!!error}
          className={`${inputClasses} flex-[3] text-center`}
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      <input type="hidden" name="dateOfBirth" value={isoValue} />
    </div>
  );
}

// useFormStatus only reports the enclosing <form>'s real pending state
// when called from a component distinct from the one rendering the
// <form> itself (see the same pattern in login/auth-panels.tsx and
// ../company/company-form.tsx).
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

export default function PersonalForm({ existing }: { existing: Existing }) {
  const [country, setCountry] = useState(existing.residentialCountry || "NL");
  // Defaults to the country of residence — most shoppers' nationality
  // matches it, and it means this select (like the one above) always shows
  // a flag instead of sitting on the blank "Select…" placeholder.
  const [nationality, setNationality] = useState(existing.nationality || country);
  const [phoneNumber, setPhoneNumber] = useState(existing.phoneNumber);
  const [postalCode, setPostalCode] = useState(existing.residentialPostalCode);
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState(existing.residentialStreet);
  const [city, setCity] = useState(existing.residentialCity);
  const [province, setProvince] = useState(existing.residentialProvince);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  // Whether the address lookup has resolved (found or not) for the *current*
  // postcode + house number. Gates manual editing of street/city for NL:
  // those fields are meant to come from the lookup, not be typed ahead of
  // it. Starts true when editing an already-saved NL address (nothing to
  // re-check yet), false otherwise — including on first arrival, where
  // houseNumber is always blank (see below) so no lookup has run yet.
  const [lookupDone, setLookupDone] = useState(
    Boolean(existing.residentialStreet)
  );
  const [dateOfBirth, setDateOfBirth] = useState("");

  const isNL = country === "NL";
  const provinceOptions = provincesForCountry(country);
  // Street/city are populated by the postcode+house-number lookup for NL —
  // lock them (readOnly, not disabled, so the value still submits) until
  // that lookup has actually resolved, so there's no window to type a
  // street that was never checked against the postcode.
  const addressLocked = isNL && !lookupDone;

  // Live client-side mirror of personalInfoSchema, same pattern as
  // login/auth-panels.tsx and ../company/company-form.tsx: re-parse on
  // every change, but only surface a field's error once the user has
  // actually left it, so errors don't flash red before they've had a
  // chance to type anything.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  function touch(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }
  const parsed = personalInfoSchema.safeParse({
    dateOfBirth,
    phoneNumber,
    residentialStreet: [street, houseNumber].filter(Boolean).join(" "),
    residentialCity: city,
    residentialProvince: province,
    residentialPostalCode: postalCode,
    residentialCountry: country,
    nationality,
  });
  const fieldErrors = parsed.success ? {} : flattenError(parsed.error).fieldErrors;
  function fieldError(field: keyof typeof fieldErrors) {
    if (!touched[field]) return undefined;
    return fieldErrors[field]?.[0];
  }

  function handleCountryChange(next: string) {
    setCountry(next);
    // A province code (or a house number, which only this country's form
    // even collects separately) from the old country is meaningless once
    // the country changes, so don't carry either over silently.
    setProvince("");
    setHouseNumber("");
    // Force a fresh lookup for the newly-selected country's address —
    // only matters when landing on NL (addressLocked is always false
    // otherwise), harmless either way.
    setLookupDone(false);
  }

  function handlePostalCodeChange(value: string) {
    setPostalCode(value);
    // The street/city currently shown (if any) belong to the *previous*
    // postcode — re-lock until a lookup confirms the new one.
    if (isNL) setLookupDone(false);
  }

  function handleHouseNumberChange(value: string) {
    setHouseNumber(value);
    if (isNL) setLookupDone(false);
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
        // Not found — unlock street/city for manual entry rather than
        // leaving the user stuck with no way to proceed.
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
      setLookupDone(true);
    }
  }

  return (
    <form action={savePersonalInfo} className="flex flex-col gap-4">
      <DateOfBirthFields
        defaultValue={existing.dateOfBirth}
        onValidityChange={setDateOfBirth}
      />

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
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          onBlur={() => touch("phoneNumber")}
          aria-invalid={!!fieldError("phoneNumber")}
          className={inputClasses}
        />
        {fieldError("phoneNumber") && (
          <span className="text-xs text-danger">{fieldError("phoneNumber")}</span>
        )}
      </label>

      {isNL && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            Postal code
            <input
              type="text"
              required
              value={postalCode}
              onChange={(e) => handlePostalCodeChange(e.target.value)}
              onBlur={() => {
                touch("residentialPostalCode");
                runLookup(postalCode, houseNumber);
              }}
              aria-invalid={!!fieldError("residentialPostalCode")}
              autoComplete="postal-code"
              placeholder="1234 AB"
              className={inputClasses}
            />
            {fieldError("residentialPostalCode") && (
              <span className="text-xs text-danger">
                {fieldError("residentialPostalCode")}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            House number
            <input
              type="text"
              required
              value={houseNumber}
              onChange={(e) => handleHouseNumberChange(e.target.value)}
              onBlur={() => {
                touch("residentialStreet");
                runLookup(postalCode, houseNumber);
              }}
              aria-invalid={!!fieldError("residentialStreet")}
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
          onBlur={() => touch("residentialStreet")}
          readOnly={addressLocked}
          aria-invalid={!!fieldError("residentialStreet")}
          className={`${inputClasses} ${addressLocked ? "cursor-not-allowed opacity-60" : ""}`}
        />
        {/* Locked (NL, no confirmed lookup yet): explain why instead of the
            generic "required" error — this isn't a validation failure, it's
            waiting on the postcode + house number lookup above. */}
        {addressLocked ? (
          <span className="text-xs text-muted">
            Fill in the postcode and house number above — we&apos;ll look this up for you.
          </span>
        ) : (
          // House number (NL) feeds the same submitted field — only show
          // the message once here, not duplicated under both boxes.
          fieldError("residentialStreet") && (
            <span className="text-xs text-danger">{fieldError("residentialStreet")}</span>
          )
        )}
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
            onBlur={() => touch("residentialCity")}
            readOnly={addressLocked}
            aria-invalid={!!fieldError("residentialCity")}
            className={`${inputClasses} ${addressLocked ? "cursor-not-allowed opacity-60" : ""}`}
          />
          {!addressLocked && fieldError("residentialCity") && (
            <span className="text-xs text-danger">{fieldError("residentialCity")}</span>
          )}
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
                onBlur={() => touch("residentialProvince")}
                aria-invalid={!!fieldError("residentialProvince")}
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
              onBlur={() => touch("residentialProvince")}
              aria-invalid={!!fieldError("residentialProvince")}
              placeholder="Province / region"
              className={inputClasses}
            />
          )}
          {fieldError("residentialProvince") && (
            <span className="text-xs text-danger">{fieldError("residentialProvince")}</span>
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
              onBlur={() => touch("residentialPostalCode")}
              aria-invalid={!!fieldError("residentialPostalCode")}
              className={inputClasses}
            />
            {fieldError("residentialPostalCode") && (
              <span className="text-xs text-danger">
                {fieldError("residentialPostalCode")}
              </span>
            )}
          </label>
        )}
      </div>

      <ContinueButton formValid={parsed.success} />
    </form>
  );
}
