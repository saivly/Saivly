# SupaNext Boilerplate

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase Auth (@supabase/ssr) · Proxy route guard · Row Level Security

## What's included

| Layer | Where | What it does |
|---|---|---|
| Proxy (middleware) | `src/proxy.ts` + `src/lib/supabase/proxy.ts` | Refreshes the session cookie on every request, redirects unauthenticated users off protected routes |
| Supabase clients | `src/lib/supabase/client.ts` / `server.ts` | Browser client for Client Components, per-request server client for RSC/actions/routes |
| Auth flows | `src/app/login`, `src/app/signup`, `src/app/auth/*` | Password sign-in/up via Server Actions, email confirmation (`/auth/confirm`), OAuth code exchange (`/auth/callback`), sign-out |
| Mandatory MFA (AAL2) | `src/app/auth/mfa`, `src/app/auth/mfa/enroll` | TOTP enrollment forced on first login, 6-digit challenge on every new session; proxy blocks all protected routes below `aal2` |
| Protected page | `src/app/dashboard` | Double-checks auth server-side, demonstrates RLS-scoped CRUD (todos) |
| Database | `supabase/migrations/0001_auth_profiles_rls.sql` | `profiles` auto-created on signup via trigger, `todos` with full owner-only policies |

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at database.new, then copy `.env.example` to `.env.local` and fill in the URL + **publishable key** (`sb_publishable_...`, Project Settings → API Keys). Don't use legacy anon/service_role keys — they're deprecated end of 2026.

3. **Run the migrations** — paste both files in `supabase/migrations/` into the SQL Editor in order, or with the CLI:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```

4. **Point the confirmation email at this app** — Dashboard → Auth → Email Templates → "Confirm signup", set the link to:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```
   And set Site URL (Auth → URL Configuration) to `http://localhost:3000` for dev.

5. **Run**
   ```bash
   npm run dev
   ```

## Next.js 15 compatibility

This template uses Next 16's `proxy.ts` convention. On Next 15, rename `src/proxy.ts` → `src/middleware.ts` and the exported function `proxy` → `middleware`. Nothing else changes.

## Security model (read this once)

- **RLS is the real boundary.** The proxy redirect is UX, the `getUser()` check in pages is defense-in-depth, but the thing that actually prevents data leaks is the policies in the migration. Every table in `public` must have RLS enabled.
- **`getClaims()` in the proxy, `getUser()` in pages.** Both validate the JWT; never trust `getSession()` alone in server code.
- **The secret key (`sb_secret_...`) bypasses RLS.** It's commented out in `.env.example` on purpose — only add it for trusted server-side jobs, never with a `NEXT_PUBLIC_` prefix. It's not a JWT: send it as the `apikey` header, never `Authorization: Bearer`.
- **Inserts can't be spoofed.** `todos.user_id` defaults to `auth.uid()` and the insert policy re-checks it, so clients can't write rows as someone else.
- **AAL2 is enforced twice.** The proxy redirects any `aal1` session to `/auth/mfa` (or `/auth/mfa/enroll` if no factor exists), and the migration adds RESTRICTIVE policies requiring `auth.jwt() ->> 'aal' = 'aal2'` — so even if the app layer is bypassed, an aal1 token reads zero rows.

## The AAL2 flow

1. Sign up → confirm email → first sign-in lands at `aal1`.
2. Proxy (and the login action) route to `/auth/mfa/enroll` — QR code + manual secret, verify a 6-digit code, session upgrades to `aal2`.
3. Every later sign-in: password → `/auth/mfa` challenge → `aal2` → dashboard.
4. There is no path to protected routes or data at `aal1`.

Enable TOTP in Dashboard → Auth → Multi-Factor if it isn't already.

## Rate limiting & recovery (built in)

- **Rate limiting** — Postgres-backed fixed-window limiter (`hit_rate_limit()` in migration 0002, `src/lib/rate-limit.ts`). Applied to: login (10 / 15 min per IP+email), MFA challenge and enrollment (5 / 15 min per user), backup-code redemption (5 / hour per user). Fails **closed** if the limiter is unreachable. Schedule the pg_cron cleanup noted in the migration. Also tune Supabase's own endpoint limits: Dashboard → Auth → Rate Limits.
- **Backup codes** — 10 single-use codes generated server-side after TOTP enrollment, shown once, stored as SHA-256 hashes under RLS (insert/delete require aal2; redemption works at aal1 by design). Redeeming a code deletes the lost factor via the Admin API and forces fresh enrollment — this is why `SUPABASE_SECRET_KEY` is required.

## Production hardening checklist (dashboard toggles)

1. **Leaked-password protection + strength rules** — Auth → Policies: enable HaveIBeenPwned checking and set minimum strength. (The form's `minLength` is UX, not enforcement.)
2. **Email enumeration protection** — Auth → Settings: prevents signup/login responses from revealing whether an address is registered.
3. **CAPTCHA** — Auth → Attack Protection: enable Cloudflare Turnstile or hCaptcha, then pass the widget token via `options.captchaToken` in `signUp` / `signInWithPassword`.
4. **SMTP** — configure a custom sender (Auth → SMTP); the built-in sender is heavily rate limited and dev-only.
5. **Redirect allow-list** — Auth → URL Configuration: set Site URL and additional redirect URLs to your production domains only.

## Extending

- **OAuth providers:** enable in Dashboard → Auth → Providers, then call `signInWithOAuth` with `redirectTo: /auth/callback`.
- **Passkeys:** add as an optional convenience factor on top of TOTP; keep TOTP as the mandatory baseline.
- **Generated types:** `npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts`, then type the clients with `<Database>`.
