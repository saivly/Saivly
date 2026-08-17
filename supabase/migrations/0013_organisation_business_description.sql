-- ============================================================
-- 0013: Business description + Contact details split.
--
-- The "Organisation info" step's second page (business-activity) is now
-- split into two: business-activity (industry, reserve fund, VAT number,
-- business description) and contact-details (website, support email,
-- support phone) — see ONBOARDING_STEPS in src/lib/onboarding/onboarding.ts.
-- Every other field asked on the old combined page already had a column
-- (migration 0012); business_description is the only new one needed.
--
-- Not sent to Adyen anywhere (see saveBusinessActivity in
-- src/app/onboarding/company/actions.ts) — just a short, free-text
-- description shown back to the org later, nothing compliance-facing
-- reads it today.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.organisations
  add column business_description text;
