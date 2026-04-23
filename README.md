# Ecommerce MVP

Next.js storefront + FastAPI backend + Supabase (Postgres, Storage, Auth).

- Customers browse and check out **as guests** (no signup).
- Only **admins** sign in — Supabase Auth with `app_metadata.role = 'admin'`.
- Payments are **mocked**: `POST /api/orders` marks the order `paid` immediately.
- Product images are stored in a Supabase Storage `product-images` bucket.

See `CLAUDE.md` for the full architectural plan.

---

## Prerequisites

- Node 22+
- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- A Supabase project (free tier is fine)

---

## 1. Database setup

Open the Supabase SQL editor and run, in order:

1. `backend/db/migrations/0001_init.sql`
2. `backend/db/seed.sql` (optional — seeds 8 demo products)

Then verify the `product-images` bucket exists under Storage.

### Create an admin

```sql
-- After inviting the user via Auth → Users
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
 where email = 'admin@example.com';
```

Sign the user out and back in so the new JWT carries the role claim.

---

## 2. Backend

```bash
cd backend
cp .env.example .env        # fill in your Supabase values
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Required `.env` values:

- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_ROLE_KEY` — **secret**, server-only (bypasses RLS)
- `CORS_ORIGINS` — e.g. `http://localhost:3000`

Admin JWTs are verified against the project's public JWKS at
`$SUPABASE_URL/auth/v1/.well-known/jwks.json` — no shared secret needed.

Smoke test:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/products
```

---

## 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in Supabase + API values
npm install
npm run dev
```

Required env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — e.g. `http://localhost:8000`

Open:

- Storefront: http://localhost:3000
- Admin: http://localhost:3000/admin (redirects to `/admin/login` if no session)

---

## Project layout

See `CLAUDE.md`. Key dirs:

- `frontend/app/(store)` — public storefront
- `frontend/app/admin` — admin panel (gated by `middleware.ts`)
- `backend/app/routers` — FastAPI routers: `public.py`, `orders.py`, `admin.py`
- `backend/app/auth.py` — Supabase JWT verification + `require_admin` dep
- `backend/db/migrations` — SQL schema, RLS, and the transactional `create_order` RPC

---

## Shipping a feature (Claude Code workflow)

The repo uses a plan → ship pipeline driven by Claude Code agents, skills, and slash commands (all in `.claude/`). Full details in `CLAUDE.md::Workflow`; the short version:

1. **Plan** — `/planning "<what you want>"` spawns the `planner` agent, which writes `docs/features/<slug>/plan.md` + `task.md`.
2. **Ship** — `git checkout -b feature/<slug>` then `/ship <slug>`. The `/ship` command chains:
   - Implement (routes tasks to `backend-engineer` / `frontend-engineer`)
   - Test (`test-engineer` writes Vitest + pytest tests)
   - Lint (automatic via the `PostToolUse` hook in `.claude/settings.json`, plus a batch gate)
   - Browser verify (`browser-verifier` drives `claude-in-chrome` — needs dev servers on `:3000`/`:8000`)
   - Review (`code-reviewer` checks the diff against the plan)
   - Open the PR via `gh pr create` with a body built from `plan.md`
3. Each phase pauses for a y/n checkpoint before starting, so you can intervene.

Tests and linting run in CI too:
- `.github/workflows/frontend.yml` runs `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- `.github/workflows/backend.yml` runs `ruff`, `mypy`, `pytest`

Run locally:

```bash
cd frontend && npm test                 # Vitest + React Testing Library
cd backend  && uv run pytest            # pytest + httpx
```
