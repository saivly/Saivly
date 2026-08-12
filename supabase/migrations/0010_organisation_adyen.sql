-- ============================================================
-- 0010: Adyen organization/payout identifiers for organisations.
--
-- Set together, all-or-nothing, when the company step's Adyen chain
-- succeeds (see src/app/onboarding/company/actions.ts):
--   adyen_organization_legal_entity_id — the org's own LEM legal entity
--     (type: "organization"), separate from the individual legal entity
--     already on profiles.adyen_legal_entity_id for the shopper themself.
--   adyen_account_holder_id  — Balance Platform account holder for the org.
--   adyen_balance_account_id — its balance account (where payments land).
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.organisations
  add column adyen_organization_legal_entity_id text,
  add column adyen_account_holder_id text,
  add column adyen_balance_account_id text;
