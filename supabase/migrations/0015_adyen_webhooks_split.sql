-- ============================================================
-- 0015: Split adyen_webhook_events (migration 0014) into three tables,
-- one per Adyen webhook product.
--
-- Adyen itself treats these as three separate things: separate webhook
-- configurations in the Customer Area (each with its own URL + HMAC
-- key), separate payload shapes, and even separate signing schemes.
-- Splitting storage the same way means each table's columns actually
-- fit the notifications landing in it, instead of a pile of
-- mostly-null columns shared across unrelated event shapes:
--
--   adyen_payment_webhook_events — Standard/Payment webhooks
--     (AUTHORISATION, CAPTURE, REFUND, ...). Classic
--     NotificationRequestItem format, batched (one HTTP POST can carry
--     several items) — one row per item. Signed per-item via
--     additionalData.hmacSignature (field-concatenation HMAC, see
--     src/lib/adyen/webhooks/hmac.ts).
--
--   adyen_configuration_webhook_events — legalEntity.* /
--     accountHolder.* / balanceAccount.* events from onboarding/KYC.
--     One notification per HTTP POST. Signed via the `hmacsignature`
--     HTTP header (HMAC over the raw body).
--
--   adyen_transfer_webhook_events — transfer.* events (money actually
--     moving). Same envelope/header-signing scheme as configuration
--     webhooks, but its own Customer Area subscription + HMAC key, and
--     worth keeping physically separate from KYC/account-status events.
--
-- adyen_webhook_events is dropped outright rather than migrated
-- row-by-row: nothing has ever written to it (no webhook route existed
-- pointed at it in production, and no Adyen webhook subscription was
-- ever configured against it), so there's nothing to carry forward.
-- The guard below confirms that before dropping, rather than assuming
-- it — if it fires, stop and migrate that data manually before
-- adjusting/removing the guard.
--
-- Written with the service role (no user session on a webhook
-- request), so RLS below only grants org members read access to their
-- own org's rows; there are deliberately no insert/update policies for
-- `authenticated` — only the service role (which bypasses RLS) writes.
--
-- Linking to an organisation: none of these notifications carry our
-- organisation_id, so it's resolved at ingestion time by matching
-- whatever Adyen id the event carries (balance_account_id /
-- account_holder_id / legal_entity_id) against the matching column on
-- organisations (migration 0010) and denormalized onto the row. Can be
-- null when nothing matches yet (e.g. arrives before the org's ids are
-- set) — see each src/lib/adyen/webhooks/*.ts for the exact lookup.
-- adyen_payment_webhook_events' organisation_id resolution is a stub
-- for now (see payments.ts) — nothing about a classic payment
-- notification identifies an organisation on this platform until a
-- payments flow exists that stamps one into merchantReference.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

do $$
begin
  if exists (select 1 from public.adyen_webhook_events limit 1) then
    raise exception
      'adyen_webhook_events has rows — this migration drops it. Migrate that data to the new tables (or confirm it can be discarded) before running this.';
  end if;
end $$;

drop table public.adyen_webhook_events;

create table public.adyen_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations (id) on delete set null,

  event_code          text not null,   -- 'AUTHORISATION', 'CAPTURE', 'REFUND', ...
  live                boolean not null default false,
  psp_reference       text not null,
  original_reference  text,
  merchant_account_code text not null,
  merchant_reference  text,
  amount_value        bigint,          -- minor units
  amount_currency     text,
  success             boolean,
  reason              text,            -- failure/refusal reason, when present

  payload jsonb not null,              -- the raw NotificationRequestItem
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'failed', 'ignored')),
  error   text,

  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- Adyen's own recommended dedupe key for classic notifications: a
-- redelivered item has the same pspReference + eventCode.
create unique index adyen_payment_webhook_events_dedupe_idx
  on public.adyen_payment_webhook_events (psp_reference, event_code);

create index adyen_payment_webhook_events_org_idx on public.adyen_payment_webhook_events (organisation_id);
create index adyen_payment_webhook_events_merchant_reference_idx on public.adyen_payment_webhook_events (merchant_reference);
create index adyen_payment_webhook_events_status_idx on public.adyen_payment_webhook_events (processing_status);

create table public.adyen_configuration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations (id) on delete set null,

  event_type          text not null,   -- 'balancePlatform.accountHolder.updated', ...
  live                boolean not null default false,
  balance_account_id  text,
  account_holder_id   text,
  legal_entity_id     text,

  -- No documented top-level notification id on this envelope to dedupe
  -- on, so: sha256 of the exact raw body Adyen sent. Catches a verbatim
  -- redelivery; a same-content-different-timestamp resend (rare) would
  -- still create a second row, which processing must tolerate anyway.
  raw_body_hash text not null,

  payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'failed', 'ignored')),
  error   text,

  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

create unique index adyen_configuration_webhook_events_dedupe_idx
  on public.adyen_configuration_webhook_events (raw_body_hash);

create index adyen_configuration_webhook_events_org_idx on public.adyen_configuration_webhook_events (organisation_id);
create index adyen_configuration_webhook_events_balance_account_idx on public.adyen_configuration_webhook_events (balance_account_id);
create index adyen_configuration_webhook_events_account_holder_idx on public.adyen_configuration_webhook_events (account_holder_id);
create index adyen_configuration_webhook_events_legal_entity_idx on public.adyen_configuration_webhook_events (legal_entity_id);
create index adyen_configuration_webhook_events_status_idx on public.adyen_configuration_webhook_events (processing_status);

create table public.adyen_transfer_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations (id) on delete set null,

  event_type          text not null,   -- 'balancePlatform.transfer.created' / '.updated'
  live                boolean not null default false,
  balance_account_id  text,
  transfer_reference  text,
  transfer_status     text,            -- Adyen's own status on the transfer resource
  amount_value        bigint,
  amount_currency     text,

  raw_body_hash text not null,         -- see adyen_configuration_webhook_events above

  payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'failed', 'ignored')),
  error   text,

  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

create unique index adyen_transfer_webhook_events_dedupe_idx
  on public.adyen_transfer_webhook_events (raw_body_hash);

create index adyen_transfer_webhook_events_org_idx on public.adyen_transfer_webhook_events (organisation_id);
create index adyen_transfer_webhook_events_balance_account_idx on public.adyen_transfer_webhook_events (balance_account_id);
create index adyen_transfer_webhook_events_status_idx on public.adyen_transfer_webhook_events (processing_status);

-- organisations_adyen_account_holder_idx / organisations_adyen_balance_account_idx
-- already exist from migration 0014 — only the legal-entity lookup is new here.
create index organisations_adyen_organization_legal_entity_idx on public.organisations (adyen_organization_legal_entity_id);

alter table public.adyen_payment_webhook_events enable row level security;
alter table public.adyen_configuration_webhook_events enable row level security;
alter table public.adyen_transfer_webhook_events enable row level security;

create policy "adyen_payment_webhook_events_select_member"
  on public.adyen_payment_webhook_events for select
  to authenticated
  using (organisation_id is not null and public.is_org_member(organisation_id));

create policy "adyen_configuration_webhook_events_select_member"
  on public.adyen_configuration_webhook_events for select
  to authenticated
  using (organisation_id is not null and public.is_org_member(organisation_id));

create policy "adyen_transfer_webhook_events_select_member"
  on public.adyen_transfer_webhook_events for select
  to authenticated
  using (organisation_id is not null and public.is_org_member(organisation_id));

-- Same AAL2 requirement as every other table (see migration 0001's notes).
create policy "adyen_payment_webhook_events_require_aal2"
  on public.adyen_payment_webhook_events as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "adyen_configuration_webhook_events_require_aal2"
  on public.adyen_configuration_webhook_events as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');

create policy "adyen_transfer_webhook_events_require_aal2"
  on public.adyen_transfer_webhook_events as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
