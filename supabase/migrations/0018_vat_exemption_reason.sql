-- ============================================================
-- 0018: VAT exemption reason on the business-activity screen.
--
-- Sits alongside vat_number (migration 0012): when an organisation has no
-- VAT number, the business-activity form (business-activity-form.tsx) now
-- asks why — "belowTaxThreshold" or "industryExemption", mirroring
-- Adyen's own vatAbsenceReason enum (see src/lib/adyen/legalEntity.ts).
-- Homeowners' associations get "industryExemption" fixed, same way they
-- already get vat_number fixed to null.
--
-- Record-keeping only for now, same as vat_number itself — neither is
-- currently sent to Adyen for non-VvE organisations (see
-- ensureAdyenOrganisationReady in company/contact-details/finish.ts).
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

alter table public.organisations
  add column vat_exemption_reason text; -- belowTaxThreshold | industryExemption | null — see VAT_EXEMPTION_REASONS in src/lib/zod.ts
