"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenError } from "zod";
import { dialCode, phoneDigitsPlaceholder, splitStoredPhoneNumber } from "@/lib/onboarding/countries";
import { provincesForCountry } from "@/lib/onboarding/provinces";
import { savePersonalInfo, lookupResidentialAddress } from "./actions";
import { inputClasses, CountrySelect, DialCodeSelect } from "../form-controls";
import Select from "@/components/select";
import { personalInfoSchema } from "@/lib/zod";
import { intlLocale } from "@/lib/i18n";
import { useT } from "@/app/i18n-provider";

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

// How long to wait after the last keystroke in postcode / house number
// before looking the address up — long enough not to fire mid-typing
// ("12" on the way to "121"), short enough to feel instant.
const LOOKUP_DEBOUNCE_MS = 600;

// The saved street is "<street> <house number>" in one column (the form
// recombines them on submit). Split it back apart when the page is
// revisited, so the house number lands in its own field again:
//   "Keizersgracht 12" -> ["Keizersgracht", "12"]
//   "Hoofdstraat 41-2" / "12A" / "12 bis" -> number keeps its addition
//   "Plein 1944 3"     -> ["Plein 1944", "3"] (the last number wins)
// Anything that doesn't end in a house number is left untouched.
const HOUSE_NUMBER_AT_END = /^(.+)\s(\d+(?:[-/]?[A-Za-z0-9]{1,4})?(?:\s[A-Za-z]{1,4})?)$/;

function lookupKey(postalCode: string, houseNumber: string): string {
  return `${postalCode.replace(/\s+/g, "").toUpperCase()}|${houseNumber.trim()}`;
}

function splitStreetAndHouseNumber(combined: string): { street: string; houseNumber: string } {
  const match = combined.trim().match(HOUSE_NUMBER_AT_END);
  return match ? { street: match[1].trim(), houseNumber: match[2] } : { street: combined, houseNumber: "" };
}

/** Month names in the given language, January first. */
function monthNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 1))));
}

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

// Newest-eligible year first (most signups cluster near 18-40) down to
// 100 years ago — generous enough to cover everyone isAdult() would
// ever accept without listing centuries nobody needs.
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 83 }, (_, i) => String(CURRENT_YEAR - 18 - i));

function isAdult(iso: string): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  return date <= eighteenYearsAgo;
}

/** Day/month/year is split into three dropdowns rather than a native
 * `type="date"` input, whose picker UI and formatting vary across
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
  const { t, locale } = useT();
  const months = monthNames(intlLocale(locale));
  const [initialYear = "", initialMonth = "", initialDay = ""] = (
    defaultValue || ""
  ).split("-");

  // Stored (and DAYS/MONTHS option values) are unpadded — "5", not
  // "05" — so a saved "05" has to be renormalized or it won't match any
  // option and the dropdown would silently sit on its placeholder.
  const [day, setDay] = useState(
    initialDay ? String(Number(initialDay)) : ""
  );
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
    if (allEmpty) error = t("Date of birth is required.");
    else if (isComplete) {
      if (!isRealDate) error = t("That date doesn't exist.");
      else if (new Date(isoValue) > new Date())
        error = t("Date of birth can’t be in the future.");
      else if (!isAdult(isoValue))
        error = t("You must be at least 18 years old.");
    }
  }

  useEffect(() => {
    onValidityChange(isoValue);
    // onValidityChange is a fresh closure every render (it reads other
    // form state) — only isoValue itself should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoValue]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
      <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t("Date of birth")}</span>
      <div className="flex gap-3">
        <div className="flex-[2]">
          <Select
            value={day}
            onChange={setDay}
            onBlur={() => setTouched(true)}
            invalid={!!error}
            placeholder={t("Day")}
            aria-label={t("Day")}
            options={DAYS.map((d) => ({ value: d, label: d }))}
          />
        </div>
        <div className="flex-[5]">
          <Select
            value={month}
            onChange={setMonth}
            onBlur={() => setTouched(true)}
            invalid={!!error}
            placeholder={t("Month")}
            aria-label={t("Month")}
            options={months.map((name, i) => ({ value: String(i + 1), label: name }))}
          />
        </div>
        <div className="flex-[3]">
          <Select
            value={year}
            onChange={setYear}
            onBlur={() => setTouched(true)}
            invalid={!!error}
            placeholder={t("Year")}
            aria-label={t("Year")}
            options={YEARS.map((y) => ({ value: y, label: y }))}
          />
        </div>
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
  const { t } = useT();
  return (
    <button
      disabled={pending || !formValid}
      className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-db-primary-hover disabled:opacity-50"
    >
      {pending ? t("Saving…") : t("Continue")}
    </button>
  );
}

export default function PersonalForm({ existing }: { existing: Existing }) {
  const { t } = useT();
  const [country, setCountry] = useState(existing.residentialCountry || "NL");
  // Defaults to the country of residence — most shoppers' nationality
  // matches it, and it means this select (like the one above) always shows
  // a flag instead of sitting on the blank "Select…" placeholder.
  const [nationality, setNationality] = useState(existing.nationality || country);
  // The phone field is split into a dial-code dropdown + a plain
  // subscriber-number box (see DialCodeSelect) rather than one free-text
  // field — splitStoredPhoneNumber recovers both pieces from whatever
  // combined string was saved before, defaulting the dial code to the
  // country of residence like a fresh signup would.
  const initialPhone = splitStoredPhoneNumber(
    existing.phoneNumber,
    existing.residentialCountry || "NL"
  );
  const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone.digits);
  const [postalCode, setPostalCode] = useState(existing.residentialPostalCode);
  // Only NL collects the house number in its own field (see below).
  const initialAddress =
    (existing.residentialCountry || "NL") === "NL"
      ? splitStreetAndHouseNumber(existing.residentialStreet)
      : { street: existing.residentialStreet, houseNumber: "" };
  const [houseNumber, setHouseNumber] = useState(initialAddress.houseNumber);
  const [street, setStreet] = useState(initialAddress.street);
  const [city, setCity] = useState(existing.residentialCity);
  const [province, setProvince] = useState(existing.residentialProvince);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  // Whether the address lookup has resolved (found or not) for the *current*
  // postcode + house number. Gates manual editing of street/city for NL:
  // those fields are meant to come from the lookup, not be typed ahead of
  // it. Starts true when editing an already-saved NL address (nothing to
  // re-check yet), false otherwise — including on first arrival, where
  // no lookup has run yet.
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
  // dialCode(phoneCountry) + the typed subscriber number — recombined into
  // the single string personalInfoSchema (and the server) actually expect,
  // same split/join pattern as residentialStreet + houseNumber below.
  const phoneNumber = `${dialCode(phoneCountry)} ${phoneDigits}`.trim();

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
    const message = fieldErrors[field]?.[0];
    return message && t(message);
  }

  function handleCountryChange(next: string) {
    setCountry(next);
    // The phone dial code follows the country of residence — a shopper
    // can still pick a different one afterwards (e.g. a foreign mobile
    // number), but changing residence again re-syncs it, same as every
    // other country-derived default on this form.
    setPhoneCountry(next);
    // A province code (or a house number, which only this country's form
    // even collects separately) from the old country is meaningless once
    // the country changes, so don't carry either over silently.
    setProvince("");
    setHouseNumber("");
    invalidateLookup();
    // Force a fresh lookup for the newly-selected country's address —
    // only matters when landing on NL (addressLocked is always false
    // otherwise), harmless either way.
    setLookupDone(false);
  }

  // The postcode + house number the last lookup was for, and a counter
  // so only the newest lookup's result is ever applied (an older, slower
  // request finishing late must not overwrite a newer answer).
  const lastLookupKey = useRef<string | null>(
    existing.residentialStreet && initialAddress.houseNumber
      ? lookupKey(existing.residentialPostalCode, initialAddress.houseNumber)
      : null
  );
  const lookupSeq = useRef(0);

  function invalidateLookup() {
    lastLookupKey.current = null;
    lookupSeq.current++;
    setLooking(false);
  }

  function handlePostalCodeChange(value: string) {
    setPostalCode(value);
    invalidateLookup();
    // The street/city currently shown (if any) belong to the *previous*
    // postcode — re-lock until a lookup confirms the new one.
    if (isNL) setLookupDone(false);
  }

  function handleHouseNumberChange(value: string) {
    setHouseNumber(value);
    invalidateLookup();
    if (isNL) setLookupDone(false);
  }

  async function runLookup(nextPostalCode: string, nextHouseNumber: string) {
    if (!isNL) return;
    if (!NL_POSTAL_CODE.test(nextPostalCode.trim()) || !nextHouseNumber.trim()) return;

    // Already looked up (e.g. the debounce fired, then the user tabbed out).
    const key = lookupKey(nextPostalCode, nextHouseNumber);
    if (key === lastLookupKey.current) return;
    lastLookupKey.current = key;
    const seq = ++lookupSeq.current;

    setLooking(true);
    setLookupError(null);
    try {
      const found = await lookupResidentialAddress(nextPostalCode, nextHouseNumber);
      if (seq !== lookupSeq.current) return; // the user changed something meanwhile
      if (found) {
        setStreet(found.street);
        setCity(found.city);
        if (found.province) setProvince(found.province);
      } else {
        // Not found — unlock street/city for manual entry rather than
        // leaving the user stuck with no way to proceed.
        setLookupError(
          t("No address found for that postcode + house number — fill it in by hand.")
        );
      }
    } catch {
      if (seq !== lookupSeq.current) return;
      setLookupError(
        t("Address lookup is temporarily unavailable — fill it in by hand.")
      );
    } finally {
      if (seq === lookupSeq.current) {
        setLooking(false);
        setLookupDone(true);
      }
    }
  }

  // Look the address up as soon as the user pauses typing — no need to
  // leave the field first. (Leaving it still triggers a lookup straight
  // away; runLookup skips it if this one already ran.)
  useEffect(() => {
    if (!isNL) return;
    const timer = setTimeout(() => runLookup(postalCode, houseNumber), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // runLookup is a fresh closure every render — only the inputs it
    // reads should restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode, houseNumber, isNL]);

  return (
    <form noValidate action={savePersonalInfo} className="flex flex-col gap-4">
      <DateOfBirthFields
        defaultValue={existing.dateOfBirth}
        onValidityChange={setDateOfBirth}
      />

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-panel p-3 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t("Country of residence")}</span>
          <CountrySelect
            name="residentialCountry"
            value={country}
            onChange={handleCountryChange}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t("Nationality")}</span>
          <CountrySelect
            name="nationality"
            value={nationality}
            onChange={setNationality}
            placeholder={t("Select…")}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3 text-sm">
        <span className="pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t("Phone number")}</span>
        <div className="flex gap-2">
          <div className="w-32 shrink-0">
            <DialCodeSelect
              value={phoneCountry}
              onChange={setPhoneCountry}
            />
          </div>
          <input
            type="tel"
            required
            autoComplete="tel-national"
            placeholder={phoneDigitsPlaceholder(phoneCountry)}
            value={phoneDigits}
            onChange={(e) => setPhoneDigits(e.target.value)}
            onBlur={() => touch("phoneNumber")}
            aria-invalid={!!fieldError("phoneNumber")}
            className={`${inputClasses} flex-1`}
          />
        </div>
        {fieldError("phoneNumber") && (
          <span className="text-xs text-danger">{fieldError("phoneNumber")}</span>
        )}
        {/* The two fields above are UI-only — this hidden input carries
            the recombined "+<dial code> <digits>" string that
            personalInfoSchema (and the server) actually validate/store. */}
        <input type="hidden" name="phoneNumber" value={phoneNumber} />
      </label>

      <div className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-3 text-sm">
        <span className="-mb-2 pb-2 text-xs font-medium tracking-wide text-muted uppercase">{t("Residential address")}</span>
        {isNL && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              {t("Postal code")}
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
              {t("House number")}
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
                placeholder={t("12 or 41-2")}
                className={inputClasses}
              />
            </label>
          </div>
        )}

        {isNL && (looking || lookupError) && (
          <p className={`text-xs ${lookupError ? "text-danger" : "text-muted"}`}>
            {looking ? t("Looking up address…") : lookupError}
          </p>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          {t("Street")}
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
              {t("Fill in the postcode and house number above — we'll look this up for you.")}
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
            {t("City")}
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
            {t("Province")}
            {provinceOptions ? (
              <Select
                name="residentialProvince"
                value={province}
                onChange={setProvince}
                onBlur={() => touch("residentialProvince")}
                invalid={!!fieldError("residentialProvince")}
                searchable={provinceOptions.length > 12}
                options={provinceOptions.map((p) => ({ value: p.code, label: t(p.name) }))}
              />
            ) : (
              <input
                type="text"
                name="residentialProvince"
                autoComplete="address-level1"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                onBlur={() => touch("residentialProvince")}
                aria-invalid={!!fieldError("residentialProvince")}
                placeholder={t("Province / region")}
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
              {t("Postal code")}
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
      </div>

      <ContinueButton formValid={parsed.success} />
    </form>
  );
}
