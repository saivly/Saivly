-- ============================================================
-- 0007: Track whether a user has been shown the optional passkey
-- prompt (/auth/passkey) that runs once, before the onboarding wizard.
-- Null = not shown yet; set on skip and on successful enrollment alike,
-- so it's a "seen", not a "completed", flag.
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.profiles
  add column passkey_prompt_seen_at timestamptz;
