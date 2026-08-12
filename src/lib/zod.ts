import * as zod from 'zod';
import { PASSWORD_REGEX, PASSWORD_HINT } from './password-policy';
import { COUNTRY_CODES, COMPANY_COUNTRY_CODES } from './onboarding/countries';
import { provincesForCountry } from './onboarding/provinces';

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

// Mirrors AdyenEntityRelationshipType in src/lib/adyen/legalEntity.ts —
// keep both in sync. Restricted to the subset Adyen allows when the
// *current* legal entity is type "organization" (ours always is).
const ENTITY_RELATIONSHIP_TYPES = [
    'signatory',
    'uboThroughOwnership',
    'uboThroughControl',
] as const;

export const companyInfoSchema = zod
    .object({
        companyCountry: companyCountryCode,
        relationshipType: zod.enum(ENTITY_RELATIONSHIP_TYPES, {
            message: 'Select your relationship to the company.',
        }),
        // entityAssociations[].jobTitle on the Adyen side.
        jobTitle: zod.string().trim().min(1, { message: 'Job title is required.' }),
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

export const PLAN_OPTIONS = ['free', 'pro', 'enterprise'] as const;

export const subscriptionSchema = zod.object({
    plan: zod.enum(PLAN_OPTIONS, { message: 'Choose a plan.' }),
})

