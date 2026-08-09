"use client";

import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { savePersonalInfo, lookupResidentialAddress } from "./actions";

type Existing = {
  dateOfBirth: string;
  phoneNumber: string;
  residentialStreet: string;
  residentialCity: string;
  residentialPostalCode: string;
  residentialCountry: string;
  nationality: string;
};

const inputClasses =
  "rounded-lg border border-line bg-panel px-3 py-2.5 text-base outline-none transition-colors focus:border-ink sm:text-sm";

const NL_POSTAL_CODE = /^\d{4}\s?[A-Za-z]{2}$/;

export default function PersonalForm({ existing }: { existing: Existing }) {
  const [country, setCountry] = useState(existing.residentialCountry || "NL");
  const [postalCode, setPostalCode] = useState(existing.residentialPostalCode);
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState(existing.residentialStreet);
  const [city, setCity] = useState(existing.residentialCity);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const isNL = country === "NL";

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

      <label className="flex flex-col gap-1.5 text-sm">
        Phone number
        <input
          type="tel"
          name="phoneNumber"
          required
          autoComplete="tel"
          placeholder="+31 6 12345678"
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
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              onBlur={() => runLookup(postalCode, houseNumber)}
              placeholder="12"
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

      <div className="grid grid-cols-2 gap-3">
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
          <select
            name="residentialCountry"
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
        <label className="flex flex-col gap-1.5 text-sm">
          Nationality
          <select
            name="nationality"
            required
            defaultValue={existing.nationality}
            className={inputClasses}
          >
            <option value="" disabled>
              Select…
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
        Continue
      </button>
    </form>
  );
}
