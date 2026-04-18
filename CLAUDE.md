# Ecommerce MVP — Next.js + FastAPI + Supabase

Greenfield MVP storefront with a protected admin panel. End users browse and check out as guests; admins sign in via Supabase to manage products and orders.

## Locked Decisions

- **Scope:** MVP storefront + admin UI
- **Customer auth:** none — guest checkout, orders tied to email
- **Admin auth:** Supabase Auth; FastAPI verifies Supabase JWT and enforces `app_metadata.role = "admin"`
- **Payments:** mocked — checkout writes orders as `paid` without a real gateway
- **Assets:** Supabase Storage (public bucket for product images)
- **Deploy:** Vercel for frontend; backend deploy target TBD (Fly.io / Render / Railway — picked at deploy time)

These are intentionally narrow. Re-open one before planning around it.

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

- **Next.js** — the only thing end users see. Public storefront, gated `/admin/**`.
- **FastAPI** — single source of truth for business logic. All writes flow through it. Uses the Supabase service-role key server-side and bypasses RLS by design.
- **Supabase** — Postgres, Storage (product images), Auth (admins only).
- **JWT flow:** admin signs in via Supabase on Next.js → Next.js attaches `Authorization: Bearer <jwt>` on admin calls → FastAPI verifies the signature against Supabase JWKS and checks `app_metadata.role == "admin"`.

## Repo Layout

```
learning-x-claude/
├── frontend/        # Next.js 15 — see frontend/CLAUDE.md
├── backend/         # FastAPI — see backend/CLAUDE.md
├── docs/
│   ├── features/    # one folder per feature: plan.md + task.md
│   └── plans/
└── .claude/
    ├── agents/      # planner, frontend-engineer, backend-engineer
    ├── skills/      # patterns the engineer agents consult
    └── commands/    # /implement <slug> drives a planned feature
```

## Where to Look

| You want to… | Read |
|--------------|------|
| Work on the frontend | [`frontend/CLAUDE.md`](frontend/CLAUDE.md) |
| Work on the backend or DB | [`backend/CLAUDE.md`](backend/CLAUDE.md) |
| Understand a specific feature | `docs/features/<slug>/plan.md` + `task.md` |
| Plan a new feature | run the `planner` agent — see `.claude/agents/planner.md` |
| Implement a planned feature | run `/implement <slug>` — see `.claude/commands/implement.md` |
| Deep frontend patterns | `.claude/skills/frontend-component-builder/SKILL.md`, `frontend-api-integration/SKILL.md` |
| Deep backend patterns | `.claude/skills/backend-endpoint-builder/SKILL.md`, `backend-database-ops/SKILL.md` |

## Workflow

1. **Plan** — describe the feature; the `planner` agent surveys the codebase, asks clarifying questions only when needed, and writes `docs/features/<slug>/plan.md` + `task.md` with each task tagged `[backend-engineer]` / `[frontend-engineer]` / `[both]`.
2. **Implement** — `/implement <slug>` reads the plan, classifies tasks by their owner tag, and dispatches to `backend-engineer` and/or `frontend-engineer` (backend first when the frontend depends on a new API surface; parallel when independent).
3. **Verify** — run the steps in `plan.md::Verify`; engineer agents update `task.md` (`[ ]` → `[x]`) as work lands.

## Env Vars (summary)

Full lists live in the per-folder docs.

- **Frontend** (`frontend/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`
- **Backend** (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`

The service-role key stays in `backend/`. Never reference it from `frontend/`.
