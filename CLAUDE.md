# Ecommerce MVP — Next.js + FastAPI + Supabase

## Context

Greenfield build in `learning-x-claude`. Goal: ship an MVP storefront with a protected admin panel.

**Locked decisions (from clarifying questions):**
- **Scope:** MVP storefront + admin UI
- **Customer auth:** none — guest checkout, orders tied to email
- **Admin auth:** Supabase Auth; FastAPI verifies Supabase JWT and enforces `role = admin`
- **Payments:** mocked for now — checkout writes orders as `paid` without a real gateway
- **Assets:** Supabase Storage (public bucket for product images)
- **Deploy:** Vercel (frontend), GitHub Actions for CI; backend deploy target TBD (Fly.io/Render/Railway — pick at deploy time)

---

## Architecture

```
┌─────────────┐     REST/JSON      ┌──────────────┐      SQL      ┌──────────────┐
│  Next.js    │ ─────────────────► │  FastAPI     │ ────────────► │  Supabase    │
│  (Vercel)   │                    │  (uvicorn)   │               │  Postgres    │
│             │                    │              │               │  + Storage   │
│  • Store    │◄── Supabase JS ───►│  • Catalog   │               │  + Auth      │
│  • Admin UI │    (admin only)    │  • Orders    │               └──────────────┘
└─────────────┘                    │  • Admin API │
                                   └──────────────┘
```

- **Next.js** is the only thing end users see. Storefront is fully public (no login). Admin routes are gated by Supabase Auth session.
- **FastAPI** is the single source of truth for business logic. All writes flow through it. It uses the Supabase **service-role key** server-side to bypass RLS for its own queries.
- **Supabase** provides Postgres (schema below), Storage (product images), and Auth (admins only).
- **JWT flow:** admin signs in via Supabase on Next.js → Next.js attaches `Authorization: Bearer <supabase-jwt>` when hitting FastAPI admin endpoints → FastAPI verifies signature against Supabase JWT secret and checks `app_metadata.role == 'admin'`.

---

## Repo Layout

App code sits at the repo root (no wrapper directory).

```
learning-x-claude/
├── frontend/              # Next.js 15 (App Router, TypeScript)
│   ├── app/
│   │   ├── (store)/        # public storefront routes
│   │   │   ├── page.tsx              # home / product list
│   │   │   ├── products/[slug]/page.tsx
│   │   │   ├── cart/page.tsx
│   │   │   └── checkout/page.tsx
│   │   ├── admin/           # gated by middleware
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx              # dashboard
│   │   │   ├── products/…            # CRUD
│   │   │   └── orders/…              # list + detail + status
│   │   └── api/             # BFF proxy to FastAPI if needed
│   ├── lib/
│   │   ├── supabase/        # browser + server clients (@supabase/ssr)
│   │   ├── api.ts           # typed fetch wrapper for FastAPI
│   │   └── cart.ts          # cart persistence (localStorage/cookie)
│   ├── components/
│   └── middleware.ts        # protects /admin/**
│
├── backend/               # FastAPI
│   ├── app/
│   │   ├── main.py                # app factory, CORS, routers
│   │   ├── config.py              # pydantic-settings (env vars)
│   │   ├── supabase_client.py     # service-role client
│   │   ├── auth.py                # JWT verify dep, require_admin dep
│   │   ├── schemas/               # pydantic request/response shapes
│   │   ├── routers/
│   │   │   ├── public.py          # GET products
│   │   │   ├── orders.py          # POST checkout (guest)
│   │   │   └── admin.py           # product/order CRUD (require_admin)
│   │   └── services/              # business logic
│   ├── scripts/
│   │   └── seed_shirts.py          # pulls real apparel from DummyJSON → products
│   ├── db/                # Supabase migrations + seed + admin bootstrap
│   │   ├── migrations/0001_init.sql
│   │   ├── seed.sql
│   │   └── create_admin.sql
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── .github/workflows/
│   ├── frontend.yml         # typecheck, lint, build
│   └── backend.yml          # ruff, mypy, pytest
│
└── README.md
```

---

## Database Schema (Supabase)

Single migration `backend/db/migrations/0001_init.sql`:

- **`products`** — `id uuid pk`, `slug text unique`, `name`, `description`, `price_cents int`, `currency text default 'USD'`, `image_url text`, `stock int`, `is_active bool`, `created_at`, `updated_at`
- **`orders`** — `id uuid pk`, `email text`, `shipping_name`, `shipping_address jsonb`, `subtotal_cents int`, `total_cents int`, `status text check in ('pending','paid','shipped','cancelled') default 'pending'`, `created_at`, `updated_at`
- **`order_items`** — `id`, `order_id fk`, `product_id fk`, `quantity int`, `unit_price_cents int` (snapshot at purchase time)

**RLS:**
- `products` SELECT is public (filtered to `is_active = true`); writes denied for anon — FastAPI uses service-role key
- `orders`, `order_items` have no anon policies — backend-only access
- Supabase Storage `product-images` bucket: public read, writes via service-role

**Checkout RPC (`public.create_order`)**: a single PL/pgSQL function does stock validation (with row locks), inserts order + items, decrements stock, and marks the order `paid`. This keeps checkout atomic.

---

## Backend (FastAPI) — Key Endpoints

Public:
- `GET  /api/products` — list active products (paginate, search by name)
- `GET  /api/products/{slug}` — single product
- `POST /api/orders` — guest checkout: `{email, shipping, items:[{product_id, qty}]}` → calls `create_order` RPC → returns `{order_id, total_cents, status}`

Admin (require_admin dep):
- `GET  /api/admin/products` — list (includes inactive)
- `POST /api/admin/products` — create
- `PATCH /api/admin/products/{id}` — update (toggle `is_active` here to hide from the storefront; no separate delete endpoint)
- `POST /api/admin/products/upload-image` — multipart image → Supabase Storage → returns public URL
- `GET  /api/admin/orders` — list with status filter
- `GET  /api/admin/orders/{id}` — order with items
- `PATCH /api/admin/orders/{id}` — transition status

**Auth dep (`backend/app/auth.py`):**
- Verifies JWTs against the project's JWKS (`/auth/v1/.well-known/jwks.json`, ES256), audience `authenticated`
- Extracts `sub`, checks `app_metadata.role == 'admin'`
- Returns 401/403 on failure

---

## Frontend (Next.js) — Key Flows

**Storefront (public):**
- Home → product grid (SSR from `GET /api/products`)
- Product detail → "Add to cart" (cart in cookie + React state)
- Cart page → line items, qty edit, subtotal
- Checkout → form (email, shipping) → `POST /api/orders` → thank-you page with order id

**Admin:**
- `middleware.ts` checks Supabase session cookie; redirects unauthenticated hits on `/admin/**` to `/admin/login`
- Admin pages also verify `app_metadata.role === 'admin'` server-side; non-admin logged-in users get 403
- Product list → table with edit link, "New product" form with image upload
- Orders list → filter by status, detail shows items + status transitions

**Image upload path:** Frontend sends multipart file to FastAPI → FastAPI uses Supabase service-role client to upload to Storage → returns URL stored on product row. (Keeps service-role key server-side.)

---

## Admin Bootstrap

Admins are created manually via Supabase dashboard:
1. Invite admin email via Supabase Auth
2. In SQL editor:
   ```sql
   update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
    where email = 'admin@example.com';
   ```

---

## Implementation Milestones

**M1 — Foundation (scaffolding + read-only storefront)** — *done*
- `frontend/` (Next.js 15, TS, App Router, Tailwind)
- `backend/` (FastAPI + uv)
- `0001_init.sql` + `seed.sql`
- `GET /api/products` + storefront list/detail pages

**M2 — Cart + guest checkout**
- Client cart (cookie-backed), cart page
- Checkout form + `POST /api/orders` (mocked payment, transactional RPC)
- Order confirmation page

**M3 — Admin auth + product CRUD**
- Supabase Auth login page, `middleware.ts`, role check
- `auth.py` dep in FastAPI
- Admin product list/create/edit/delete with Supabase Storage upload

**M4 — Admin orders + CI + polish**
- Orders list + detail + status transitions
- GitHub Actions workflows (lint, typecheck, tests, build)
- Empty states, error handling, loading skeletons
- Deploys (Vercel + containerized backend)

---

## Critical Files

- `backend/db/migrations/0001_init.sql` — schema + RLS + RPC
- `backend/app/main.py`, `config.py`, `supabase_client.py`, `auth.py`
- `backend/app/routers/public.py`, `orders.py`, `admin.py`
- `frontend/middleware.ts` — admin gating
- `frontend/lib/supabase/server.ts` + `client.ts` — `@supabase/ssr` clients
- `frontend/lib/api.ts` — typed fetch wrapper that attaches Supabase JWT on admin calls
- `.github/workflows/frontend.yml`, `backend.yml`

---

## Env Vars

**Frontend (`.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` (FastAPI base)

**Backend (`.env`):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`

Admin JWTs are verified via the public JWKS at `/auth/v1/.well-known/jwks.json` — no shared secret.

---

## Verification

End-to-end smoke test for each milestone:

**M1:** `curl $API/api/products` returns seeded products; storefront home renders the grid; product detail page loads.

**M2:** Add items to cart in browser → checkout form submits → row appears in Supabase `orders` table with correct `total_cents`, linked `order_items` rows, stock decremented on `products`.

**M3:** Log in as admin on `/admin/login` → create a product with an image → image appears in Supabase Storage bucket, new product shows on public storefront. Unauthenticated hit on `/admin` redirects to login. Non-admin logged-in user gets 403 on admin API calls.

**M4:** Admin changes order status `paid → shipped` → DB reflects change. Deploy frontend to Vercel; hit production URL and repeat M1–M3 checks.

**Automated:** `pytest` for FastAPI routers (auth guards, health); `tsc --noEmit` + `next build` in CI; optionally one Playwright happy-path test.
