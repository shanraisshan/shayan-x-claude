# Backend — FastAPI + Supabase

The single source of truth for business logic. Public endpoints serve the storefront; admin endpoints sit behind a Supabase JWT check. All Postgres / Storage access uses the **service-role** Supabase client (server-side only) and bypasses RLS by design — RLS is the safety net for the browser, not for this service.

## Stack

- FastAPI (sync handlers — only go async when there's real `await` work)
- Pydantic v2 for schemas
- `supabase-py` service-role client
- `pyjwt` + JWKS for auth
- `uv` for env/deps

## Layered Architecture

```
Request → Router (Pydantic-validate, dep-inject auth, call ONE service fn, return)
        → Service (ALL business logic; raises HTTPException on domain errors)
        → Supabase client (CRUD, or rpc("create_order", ...) for atomic writes)
        → Postgres / Storage / Auth
```

**Golden Rule:** thin routers, fat services. Routers never contain business logic.

## Folder Layout

```
backend/
├── app/
│   ├── main.py                # app factory, CORS, router include
│   ├── config.py              # pydantic-settings (env vars)
│   ├── supabase_client.py     # get_supabase() — service-role
│   ├── auth.py                # current_user + require_admin (JWKS verify)
│   ├── schemas/               # Pydantic v2 request/response shapes
│   │   ├── product.py
│   │   └── order.py
│   ├── routers/
│   │   ├── public.py          # GET products
│   │   ├── orders.py          # POST checkout (guest)
│   │   └── admin.py           # product/order CRUD (require_admin)
│   └── services/              # business logic
│       ├── products.py
│       ├── orders.py
│       └── storage.py
├── db/
│   ├── migrations/0001_init.sql   # schema + RLS + RPC
│   ├── seed.sql
│   └── create_admin.sql
├── scripts/
│   └── seed_shirts.py             # DummyJSON → products
├── tests/
└── pyproject.toml
```

## Database Schema (`db/migrations/0001_init.sql`)

| Table | Notable columns | RLS |
|-------|-----------------|-----|
| `products` | `id uuid pk`, `slug unique`, `name`, `price_cents`, `currency`, `image_url`, `stock`, `is_active`, `created_at`, `updated_at` | SELECT public when `is_active=true`; writes service-role |
| `orders` | `id uuid pk`, `email`, `shipping_name`, `shipping_address jsonb`, `subtotal_cents`, `total_cents`, `status` (`pending|paid|shipped|cancelled`) | No anon policies |
| `order_items` | `id`, `order_id fk`, `product_id fk`, `quantity`, `unit_price_cents` (price snapshot at purchase) | No anon policies |

**Storage:** bucket `product-images` is public-read; writes via service-role only.

**RPC `public.create_order(p_email, p_shipping_name, p_shipping_address, p_items)`** — `security definer`. Locks affected `products` rows, validates stock, inserts order + items, decrements stock, marks the order `paid`, returns `{order_id, total_cents, status}`. Multi-row writes go through this — never replicate the transaction in Python.

## Endpoints

**Public (`routers/public.py`)**
- `GET  /api/products` — list active products (paginate, optional name search)
- `GET  /api/products/{slug}` — single product

**Guest checkout (`routers/orders.py`)**
- `POST /api/orders` — `{email, shipping, items:[{product_id, qty}]}` → `create_order` RPC → `{order_id, total_cents, status}`

**Admin (`routers/admin.py`, gated by `dependencies=[Depends(require_admin)]`)**
- `GET    /api/admin/products` — list (includes inactive)
- `POST   /api/admin/products` — create
- `PATCH  /api/admin/products/{id}` — update (toggle `is_active` to hide; no delete endpoint)
- `POST   /api/admin/products/upload-image` — multipart → Supabase Storage → public URL
- `GET    /api/admin/orders` — list with status filter
- `GET    /api/admin/orders/{id}` — order with items
- `PATCH  /api/admin/orders/{id}` — transition status

**Meta**
- `GET /health` — `{status: "ok"}`

## Auth (`app/auth.py`)

- Verifies admin JWTs against the project's JWKS (`/auth/v1/.well-known/jwks.json`, algos `ES256` + `RS256`), audience `authenticated`. No shared secret.
- `current_user` extracts `sub`, `email`, and `app_metadata.role`.
- `require_admin` enforces `role == "admin"`; returns 401 (missing/expired/invalid token) or 403 (not admin).

**Admin bootstrap** — manual via Supabase dashboard:
```sql
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
 where email = 'admin@example.com';
```

## Env Vars (`backend/.env`)

- `SUPABASE_URL` — project URL (also used to derive the JWKS endpoint)
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key. **Never** logged, returned, or shipped to the frontend.
- `CORS_ORIGINS` — comma-separated allowed origins for the storefront/admin

## Local Dev

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
uv run pytest
uv run ruff check .
```

## Conventions / Non-Negotiables

- All business logic in `services/`. Routers validate, dep-inject auth, call exactly one service function, return.
- Pydantic v2 schemas for every request body and response shape (`response_model=` on every data-returning endpoint).
- Domain errors via `HTTPException(status, "snake_case_code")` raised from the service (matches `services/products.py`). The frontend reads `detail` and renders it.
- Supabase access exclusively via `get_supabase()` from `app.supabase_client`. Never instantiate inline.
- Multi-row atomic writes go through a Postgres function (RPC). Don't loop writes in Python.
- Schema changes ship as a new file `backend/db/migrations/000N_<change>.sql`. **Never edit a shipped migration.** Additive on populated tables (add nullable → backfill → enforce in a follow-up).
- Public reads filter `is_active = true`. Inactive products must not leak.
- Don't widen RLS without an explicit migration + approval.
- No `print()` debugging. No service-role key in logs.
- Match the existing sync style; don't make handlers async without a real `await`.
- Stack is locked: no SQLAlchemy, no Alembic, no MongoDB, no Redis, no payment gateway. Get explicit approval before adding any of these.

## Pointers

- Specialist agent: `.claude/agents/backend-engineer.md`
- Detail skills: `.claude/skills/backend-endpoint-builder/SKILL.md`, `.claude/skills/backend-database-ops/SKILL.md`
- Per-feature plans: `docs/features/*/plan.md` + `task.md`
