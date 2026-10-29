-- ============================================================
-- 0019: Subscription plans starter / pro / enterprise + billing interval.
--
-- The subscription step (onboarding/subscription/plan-picker.tsx) offers
-- Starter, Pro and Enterprise, billed monthly or yearly (yearly = 5% off).
-- Existing "free" rows become "starter"; "unlimited" (from an earlier
-- draft of this migration) goes back to "enterprise".
-- Keep in sync with PLAN_OPTIONS / BILLING_INTERVALS in src/lib/zod.ts.
--
-- Also records when the Terms of Service were accepted on that step.
--
-- Safe to re-run. Run in Supabase SQL Editor, or `supabase db push`.
-- ============================================================

alter table public.organisations
  drop constraint if exists organisations_plan_check;

update public.organisations set plan = 'starter' where plan = 'free';
update public.organisations set plan = 'enterprise' where plan = 'unlimited';

alter table public.organisations
  add constraint organisations_plan_check
  check (plan in ('starter', 'pro', 'enterprise'));

alter table public.organisations
  add column if not exists billing_interval text
  check (billing_interval in ('monthly', 'yearly'));

alter table public.organisations
  add column if not exists terms_accepted_at timestamptz;
