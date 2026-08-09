-- ============================================================
-- 0006: Add residential_province to profiles — a 2-letter subdivision
-- code (e.g. NL "NH" for Noord-Holland, US state codes, UK nation codes),
-- collected on /onboarding/personal alongside the rest of the residential
-- address. See src/lib/provinces.ts for the code tables.
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.profiles
  add column residential_province text;
