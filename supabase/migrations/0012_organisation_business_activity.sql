-- ============================================================
-- 0012: Business Activity screen (organisation info step).
--
-- The company step now spans two pages instead of one — KVK lookup +
-- address on /onboarding/company, then industry/reserve-fund/contact/VAT/
-- website on /onboarding/company/business-activity (see ONBOARDING_STEPS
-- in src/lib/onboarding/onboarding.ts, still the same "Organisation info"
-- sidebar step). Splitting across a real page navigation means these
-- answers have to survive a fresh request, so — unlike
-- relationshipType/annualReserveFundContributions before this migration —
-- they're persisted rather than only ever living in the submitting
-- form's memory.
--
-- relationship_type moves here too: it's collected on the first page but
-- wasn't previously persisted, and the second page's Adyen chain
-- (ensureAdyenOrganisationReady in src/app/onboarding/company/actions.ts)
-- needs it again after that navigation.
--
-- website replaces what used to be a fixed assumption in
-- src/lib/adyen/legalEntity.ts (every org exempted from webAddress) — now
-- asked per org instead. sourceOfFunds.description stays fixed there
-- (not asked here) — every org on this platform tells the same story.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.organisations
  add column relationship_type text, -- signatory | uboThroughOwnership | uboThroughControl | all — see ENTITY_RELATIONSHIP_TYPES in src/lib/zod.ts
  add column industry_code text, -- one of Adyen's own industry codes — see src/lib/onboarding/industry-codes.ts; feeds every business line's industryCode
  add column vat_number text, -- optional: most associations here are VAT-exempt (see vatAbsenceReason in src/lib/adyen/legalEntity.ts)
  add column support_email text,
  add column support_phone text,
  add column annual_reserve_fund_contributions integer, -- whole units of annual_reserve_fund_currency
  add column annual_reserve_fund_currency text, -- ISO 4217, e.g. "EUR" — defaults from the company's country but is user-editable
  add column website text; -- optional; feeds the banking/issuing/paymentProcessing business lines' webAddress when set (webDataExemption otherwise)
