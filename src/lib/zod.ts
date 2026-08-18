import * as zod from 'zod';
import { PASSWORD_REGEX, PASSWORD_HINT } from './password-policy';
import { COUNTRY_CODES, COMPANY_COUNTRY_CODES, CURRENCY_CODES } from './onboarding/countries';
import { provincesForCountry } from './onboarding/provinces';
import { INDUSTRY_CODE_VALUES } from './onboarding/industry-codes';

export const signupSchema = zod.object({
    firstname: zod.string().min(1, { message: 'First name is required' }),
    lastname: zod.string().min(1, { message: 'Last name is required' }),
    email: zod.email({ message: 'Invalid email address' }),
    // Individual requirements are surfaced separately via passwordRequirements
    // in the checklist UI; this just gates overall form validity.
    password: zod.string().regex(PASSWORD_REGEX, { message: PASSWORD_HINT }),
})

export const loginSchema = zod.object({
    email: zod.email({ message: 'Invalid email address' }),
    password: zod.string().min(1, {message: 'Please provide a valid password.'}),
})

// ---------------------------------------------------------------
// /onboarding — one schema per step. Mirrors auth: client-side
// live validation in each step's form re-uses these; the server
// action re-validates independently and never trusts the client.
// ---------------------------------------------------------------

const isoCountry = zod.enum(COUNTRY_CODES, { message: 'Select a country.' });
// Organisations only, not shoppers — residentialCountry/nationality above
// keep the full COUNTRY_CODES list.
const companyCountryCode = zod.enum(COMPANY_COUNTRY_CODES, {
    message: 'We only support organisations from the Netherlands, United Kingdom, or United States right now.',
});

// Lenient on purpose — phone formats vary too widely across countries to
// validate strictly client-side. Just enough to catch obvious junk.
const PHONE_PATTERN = /^\+?[0-9\s()-]{6,20}$/;

function isAdult(dob: string): boolean {
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return false;
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    return date <= eighteenYearsAgo;
}

export const personalInfoSchema = zod
    .object({
        dateOfBirth: zod
            .string()
            .min(1, { message: 'Date of birth is required.' })
            .refine((v) => !Number.isNaN(new Date(v).getTime()), {
                message: 'Enter a valid date.',
            })
            .refine((v) => new Date(v) <= new Date(), {
                message: 'Date of birth can’t be in the future.',
            })
            .refine(isAdult, { message: 'You must be at least 18 years old.' }),
        phoneNumber: zod
            .string()
            .min(1, { message: 'Phone number is required.' })
            .regex(PHONE_PATTERN, { message: 'Enter a valid phone number.' }),
        residentialStreet: zod.string().trim().min(1, { message: 'Street address is required.' }),
        residentialCity: zod.string().trim().min(1, { message: 'City is required.' }),
        // Countries with a known subdivision list (NL/GB/US, see provincesForCountry)
        // must submit one of its 2-letter codes; every other country gets a free-text
        // region name, so the field itself stays optional here and is enforced below.
        residentialProvince: zod
            .string()
            .trim()
            .max(40, { message: 'Province is too long.' })
            .optional()
            .or(zod.literal('')),
        residentialPostalCode: zod
            .string()
            .trim()
            .min(1, { message: 'Postal code is required.' })
            .max(12, { message: 'Postal code is too long.' }),
        residentialCountry: isoCountry,
        nationality: isoCountry,
    })
    .superRefine((data, ctx) => {
        const options = provincesForCountry(data.residentialCountry);
        if (options && !options.some((p) => p.code === data.residentialProvince)) {
            ctx.addIssue({
                code: 'custom',
                path: ['residentialProvince'],
                message: 'Select a province.',
            });
        }
    });

// The first three mirror AdyenEntityRelationshipType in
// src/lib/adyen/legalEntity.ts — keep both in sync. Restricted to the
// subset Adyen allows when the *current* legal entity is type
// "organization" (ours always is). 'all' isn't a real Adyen value — it's
// a form-only sentinel meaning "send all three", expanded back out to
// the real values in company/actions.ts before it ever reaches Adyen.
const ENTITY_RELATIONSHIP_TYPES = [
    'signatory',
    'uboThroughOwnership',
    'uboThroughControl',
    'all',
] as const;

export const companyInfoSchema = zod
    .object({
        companyCountry: companyCountryCode,
        relationshipType: zod.enum(ENTITY_RELATIONSHIP_TYPES, {
            message: 'Select your relationship to the company.',
        }),
        kvkNumber: zod
            .string()
            .trim()
            .regex(/^\d{8}$/, { message: 'A KVK number is 8 digits.' })
            .optional()
            .or(zod.literal('')),
        companyName: zod.string().trim().min(1, { message: 'Company name is required.' }),
        companyStreet: zod.string().trim().min(1, { message: 'Street address is required.' }),
        companyPostalCode: zod
            .string()
            .trim()
            .min(1, { message: 'Postal code is required.' })
            .max(12, { message: 'Postal code is too long.' }),
        companyCity: zod.string().trim().min(1, { message: 'City is required.' }),
    })
    // KVK only registers Dutch businesses — require the number there, and
    // there alone, rather than validating it as a fixed 8-digit field above.
    .superRefine((data, ctx) => {
        if (data.companyCountry === 'NL' && !data.kvkNumber) {
            ctx.addIssue({
                code: 'custom',
                path: ['kvkNumber'],
                message: 'KVK number is required for Dutch companies.',
            });
        }
    });

// Second half of the "Organisation info" step — /onboarding/company/business-
// activity, shown right after a company's picked in the KVK register (or,
// outside NL, its details are entered manually) on /onboarding/company.
// Kept as its own schema/page rather than folded into companyInfoSchema
// above because it's a separate page (see ONBOARDING_STEPS in
// src/lib/onboarding/onboarding.ts): the company step now spans several
// URLs. This is the third of them — industry/reserve-fund/VAT/description
// — with contact details (below) split off onto a fourth so each screen
// asks about one thing at a time.
export const businessActivitySchema = zod.object({
    // One of Adyen's own industry codes (see src/lib/onboarding/industry-codes.ts) —
    // feeds every business line's industryCode directly (see
    // createAdyenBusinessLine in src/lib/adyen/legalEntity.ts), replacing
    // the single fixed code every org used to get regardless of activity.
    industryCode: zod.enum(INDUSTRY_CODE_VALUES, { message: 'Select the industry your business is in.' }),
    // Feeds Adyen's businessLine.sourceOfFunds (type "business") for the
    // banking/issuing lines, and the organization legal entity's
    // financialReports.annualTurnover — see createAdyenBusinessLine /
    // createAdyenOrganization in src/lib/adyen/legalEntity.ts. Whole units
    // of reserveFundCurrency — converted to minor units server-side.
    reserveFundCurrency: zod.enum(CURRENCY_CODES, { message: 'Select a currency.' }),
    // zod.coerce.number() alone would turn an empty string into 0 — a
    // "valid" number — via `Number("")`, letting the client-side re-parse
    // in business-activity-form.tsx call the (still-empty) required field
    // valid, enable Continue, and hand off to the browser's own "Please
    // fill out this field" bubble on submit. Route empty/blank input to
    // undefined first so it fails coercion instead.
    annualReserveFundContributions: zod.preprocess(
        (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        zod.coerce
            .number({ message: 'Enter the estimated annual reserve fund contributions.' })
            .int({ message: 'Enter a whole number.' })
            .min(0, { message: 'This can’t be negative.' })
    ),
    // Optional — most organisations here are VAT-exempt homeowners'
    // associations (see vatAbsenceReason in src/lib/adyen/legalEntity.ts).
    vatNumber: zod.string().trim().max(32, { message: 'VAT number is too long.' }).optional().or(zod.literal('')),
    // Optional, free text — not sent to Adyen anywhere, just shown back to
    // the org later (see migration 0013).
    businessDescription: zod.string().trim().max(500, { message: 'Keep the description under 500 characters.' }).optional().or(zod.literal('')),
});

// Fourth (final) page of the "Organisation info" step — see
// businessActivitySchema above. Collected last because submitting it is
// what fires the Adyen organisation-legal-entity chain
// (ensureAdyenOrganisationReady in company/actions.ts), which needs every
// answer from all three earlier pages plus these.
export const contactDetailsSchema = zod.object({
    // Optional — most associations here don't have one. Feeds every
    // business line's webAddress when set (see createAdyenBusinessLine);
    // webDataExemption otherwise.
    website: zod.url({ message: 'Enter a valid website URL, e.g. https://example.com.' }).optional().or(zod.literal('')),
    supportEmail: zod.email({ message: 'Enter a valid support email address.' }),
    supportPhone: zod
        .string()
        .min(1, { message: 'Support phone number is required.' })
        .regex(PHONE_PATTERN, { message: 'Enter a valid phone number.' }),
});

export const PLAN_OPTIONS = ['free', 'pro', 'enterprise'] as const;

export const subscriptionSchema = zod.object({
    plan: zod.enum(PLAN_OPTIONS, { message: 'Choose a plan.' }),
})

