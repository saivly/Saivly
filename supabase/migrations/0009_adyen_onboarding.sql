-- ============================================================
-- 0009: Track completion of the "Adyen verification" onboarding step —
-- stamped when the shopper is redirected back from Adyen's hosted
-- onboarding page (see src/app/onboarding/adyen/return/route.ts).
--
-- This marks "went through the hosted-onboarding redirect flow and came
-- back", not "Adyen has approved their KYC" — that's a separate, async
-- outcome Adyen reports via webhooks/back office review, tracked
-- elsewhere once that's built. Same spirit as the subscription step only
-- meaning "picked a plan", not "payment method verified".
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.profiles
  add column adyen_onboarding_completed_at timestamptz;
