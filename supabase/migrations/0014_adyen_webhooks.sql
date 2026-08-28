-- ============================================================
-- 0014: Adyen webhook notifications.
--
-- Raw storage for every Adyen webhook delivery, kept separate from any
-- business logic that reacts to them: the webhook route (see
-- src/app/api/webhooks/adyen/route.ts) does signature verification +
-- an insert here + a fast ack, nothing else — so a bug in downstream
-- processing can never turn into a missed/duplicated Adyen notification.
--
-- Written with the service role (no user session on a webhook request),
-- so RLS below only grants org members read access to their own org's
-- rows; there are deliberately no insert/update policies for
-- `authenticated` — only the service role (which bypasses RLS) writes.
--
-- Linking to an organisation: Adyen notifications don't carry our
-- organisation_id, so it's resolved at ingestion time by matching
-- balance_account_id / account_holder_id against
-- organisations.adyen_balance_account_id / adyen_account_holder_id
-- (migration 0010) and denormalized onto the row. Can be null for a
-- notification we can't yet match (e.g. arrives before the org's ids
-- are set, or a webhook type this app doesn't map to an org).
--
-- Superseded by migration 0015, which splits this one table into three
-- (Payment / Configuration / Transfer webhooks are separate Adyen
-- products with separate payload shapes and signing schemes) — kept
-- as-is here rather than edited in place because this migration was
-- already applied; changing what an applied migration's file contains
-- would desync the tracked history from what's actually in the
-- database. Don't add to this file — add a new migration instead.
--
-- Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

create table public.adyen_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations (id) on delete set null,

  event_type          text not null,     -- e.g. 'BALANCEACCOUNT_CREATED', 'AUTHORISATION'
  live                boolean not null default false,
  psp_reference       text,              -- classic payment notifications
  balance_account_id  text,
  account_holder_id   text,
  adyen_event_id      text,              -- Adyen's own id, when the notification carries one

  payload jsonb not null,                -- full raw notification item, kept for audit/replay
  status  text not null default 'received'
    check (status in ('received', 'processed', 'failed', 'ignored')),
  error   text,

  received_at  timestamptz not null default now(),
  processed_at timestamptz
);

-- Adyen redelivers on any ambiguity (timeout, non-2xx, ...); dedupe on its
-- own event id where present. Notifications without one fall back to
-- application-level dedupe on (psp_reference, event_type) at insert time.
create unique index adyen_webhook_events_dedupe_idx
  on public.adyen_webhook_events (adyen_event_id) where adyen_event_id is not null;

create index adyen_webhook_events_org_idx on public.adyen_webhook_events (organisation_id);
create index adyen_webhook_events_balance_account_idx on public.adyen_webhook_events (balance_account_id);
create index adyen_webhook_events_account_holder_idx on public.adyen_webhook_events (account_holder_id);
create index adyen_webhook_events_status_idx on public.adyen_webhook_events (status);

-- These become lookup keys as of this migration (ingestion matches
-- incoming webhooks against them) — index them too.
create index organisations_adyen_account_holder_idx on public.organisations (adyen_account_holder_id);
create index organisations_adyen_balance_account_idx on public.organisations (adyen_balance_account_id);

alter table public.adyen_webhook_events enable row level security;

create policy "adyen_webhook_events_select_member"
  on public.adyen_webhook_events for select
  to authenticated
  using (organisation_id is not null and public.is_org_member(organisation_id));

-- Same AAL2 requirement as every other table (see migration 0001's notes).
create policy "adyen_webhook_events_require_aal2"
  on public.adyen_webhook_events as restrictive
  to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2');
