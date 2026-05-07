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
    ├── agents/      # planner, backend-engineer, frontend-engineer,
    │                # test-engineer, code-reviewer, browser-verifier
    ├── skills/      # patterns the agents consult (endpoint-builder,
    │                # database-ops, component-builder, api-integration,
    │                # frontend-testing, backend-testing,
    │                # code-review, browser-verification)
    ├── commands/    # /planning, /implement <slug>, /ship <slug>
    ├── hooks/       # scripts/lint_on_edit.py — PostToolUse lint router
    └── settings.json
```

## Where to Look

| You want to… | Read |
|--------------|------|
| Work on the frontend | [`frontend/CLAUDE.md`](frontend/CLAUDE.md) |
| Work on the backend or DB | [`backend/CLAUDE.md`](backend/CLAUDE.md) |
| Understand a specific feature | `docs/features/<slug>/plan.md` + `task.md` |
| Plan a new feature | `/planning <requirements>` or run the `planner` agent directly — `.claude/agents/planner.md` |
| Implement a planned feature | run `/implement <slug>` — `.claude/commands/implement.md` |
| Ship a feature plan → PR end-to-end | run `/ship <slug>` — `.claude/commands/ship.md` |
| Deep frontend patterns | `.claude/skills/frontend-component-builder/SKILL.md`, `frontend-api-integration/SKILL.md` |
| Deep backend patterns | `.claude/skills/backend-endpoint-builder/SKILL.md`, `backend-database-ops/SKILL.md` |
| Write tests for a feature | `.claude/skills/frontend-testing/SKILL.md`, `backend-testing/SKILL.md` (the `test-engineer` agent consults these) |
| Review a diff before PR | `.claude/skills/code-review/SKILL.md` (the `code-reviewer` agent consults this) |
| Exercise a UI flow in Chrome | `.claude/skills/browser-verification/SKILL.md` (the `browser-verifier` agent consults this) |

## Workflow

The pipeline is **Plan → Ship**. `/ship <slug>` runs the full sequence with a checkpoint between each phase; individual commands (`/implement`, etc.) still work for partial runs.

1. **Plan** — `/planning <requirements>` spawns the `planner` agent, which surveys the codebase, asks clarifying questions only when needed, and writes `docs/features/<slug>/plan.md` + `task.md` with each task tagged `[backend-engineer]` / `[frontend-engineer]` / `[both]`.
2. **Ship** — `/ship <slug>` chains the remaining phases:
   - **A. Implement** — delegates to `/implement` routing; dispatches `backend-engineer` / `frontend-engineer` per task tags (backend first when the frontend depends on a new API surface).
   - **B. Test** — `test-engineer` writes Vitest + RTL tests co-located in `frontend/` and pytest tests in `backend/tests/`, covering the happy path + every error branch named in `plan.md`.
   - **C. Lint** — the `PostToolUse` hook in `.claude/settings.json` fires after every Edit/Write, running ESLint on frontend files and `uv run ruff check` on backend files; `/ship` also runs a batch `npm run lint && npm run typecheck` + `ruff check . && mypy app` gate after tests.
   - **D. Browser verify** (skipped if no UI flow) — `browser-verifier` drives the `claude-in-chrome` MCP against the running dev servers (`:3000` / `:8000`), asserts a clean console + no 4xx/5xx, and records `docs/features/<slug>/verify.gif`.
   - **E. Review** — `code-reviewer` diffs against `origin/main`, checks plan alignment + security gates + layering, and returns `APPROVE` or `CHANGES_REQUESTED` (up to 2 loops back to the engineer).
   - **F. PR** — on clean working tree, `gh pr create` opens a PR with body built from `plan.md` (summary + Verify checklist + link to `verify.gif`).
3. **Verify** — run the shell steps in `plan.md::Verify`; engineer agents update `task.md` (`[ ]` → `[x]`) as work lands.

## Env Vars (summary)

Full lists live in the per-folder docs.

- **Frontend** (`frontend/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`
- **Backend** (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`

The service-role key stays in `backend/`. Never reference it from `frontend/`.
