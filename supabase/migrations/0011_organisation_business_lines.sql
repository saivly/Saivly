-- ============================================================
-- 0011: Adyen business line identifiers for organisations.
--
-- One business line per Adyen product every organisation on this
-- platform uses — paymentProcessing (POS + eCommerce), banking, and
-- issuing — created under the org's own legal entity
-- (organisations.adyen_organization_legal_entity_id, see migration
-- 0010) right after the org/account-holder/balance-account chain, and
-- before the shopper is sent to Adyen's hosted onboarding page (see
-- ensureAdyenOrganisationReady in src/app/onboarding/company/actions.ts).
-- Set together with the rest of that chain, all-or-nothing —
-- company_completed_at isn't stamped until all six ids are in place.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.organisations
  add column adyen_business_line_payment_processing_id text,
  add column adyen_business_line_banking_id text,
  add column adyen_business_line_issuing_id text;
