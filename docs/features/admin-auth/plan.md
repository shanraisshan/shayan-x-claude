# Admin Auth — Plan

Everything under `/admin/**` except `/admin/login` requires a signed-in Supabase user whose `app_metadata.role == 'admin'`. JWT verification uses the project's public JWKS (asymmetric ES256) — no shared secret needed.

## User flows

- Unauthenticated hit on `/admin/...` → middleware redirects to `/admin/login?next=...`.
- Sign in on `/admin/login` with email + password → redirected back to `next` (default `/admin`).
- Signed-in but missing `role = admin` → layout renders "Not authorized" with a sign-out button; admin API calls 403.
- Sign out → returns to `/admin/login`.

## Frontend

- `frontend/middleware.ts` + `frontend/lib/supabase/middleware.ts` — `@supabase/ssr` session refresh, redirects unauthenticated `/admin/**` hits (skipping `/admin/login`), and bounces signed-in users off the login page.
- `frontend/app/admin/layout.tsx` — server component. No user → render `{children}` bare (login case). Otherwise check `app_metadata.role`; non-admin → "Not authorized"; admin → chrome + children.
- `frontend/app/admin/login/page.tsx` — client form calling `supabase.auth.signInWithPassword`.
- `frontend/components/admin/SignOutButton.tsx`.
- `frontend/components/admin/useAdminToken.ts` — returns the current session access token for admin client components.
- `frontend/lib/supabase/{client,server}.ts` — browser + server `@supabase/ssr` clients.

## Backend

- `backend/app/auth.py`:
  - `PyJWKClient` fetching `$SUPABASE_URL/auth/v1/.well-known/jwks.json` (cached 1h).
  - `_decode` verifies signature (ES256/RS256), audience `authenticated`.
  - `current_user(authorization: Bearer <jwt>)` returns `AuthedUser(id, email, role)`.
  - `require_admin` — 403 unless `role == "admin"`.
- `backend/app/routers/admin.py` — `APIRouter(prefix="/api/admin", dependencies=[Depends(require_admin)])`.

## Database

- `backend/db/create_admin.sql` — idempotent SQL to create (or upsert) an admin user directly in `auth.users`: bcrypt password hash via `crypt()`, `email_confirmed_at` set, matching `auth.identities` row, `raw_app_meta_data.role = 'admin'`.

## Environment

Backend `.env`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`

Frontend `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

No `SUPABASE_JWT_SECRET` — the backend reads the JWKS at runtime.

## Depends on

- `database-and-seed` — `auth.users` + `auth.identities` are Supabase-managed tables.

## Verify

- Hit `http://localhost:3000/admin` unauthenticated → lands on `/admin/login`.
- `curl -I $API/api/admin/products` → `401 missing_bearer_token`.
- Run `backend/db/create_admin.sql`, sign in, `curl -H "Authorization: Bearer <jwt>" $API/api/admin/products` → 200 JSON.
- Sign in as a non-admin user → admin UI shows "Not authorized"; API returns 403.
