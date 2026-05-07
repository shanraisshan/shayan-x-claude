---
name: code-review
description: Pre-PR code review checklist for this repo. Plan alignment, security gates, layering, dead code, API-surface completeness. Used by the code-reviewer agent.
---

# Code Review Skill

> **Version:** 1.0 | **Read-only** — reviewer agent does not edit files.

Review a diff against `origin/main` for this repo. Produce a verdict and an ordered issue list. Do not fix issues yourself.

## Inputs

- `<slug>` — feature slug; read `docs/features/<slug>/plan.md` and `task.md`
- `git diff origin/main...HEAD` — committed changes on the feature branch
- `git diff` — unstaged/uncommitted changes in the working tree
- `git status --short` — new/deleted files

## Output Contract

**MUST be parseable — `/ship` parses the `VERDICT:` line verbatim.**

```
VERDICT: APPROVE
ISSUES: (none)
FOLLOW-UPS: <non-blocking nits or empty>
```

or

```
VERDICT: CHANGES_REQUESTED
ISSUES:
1. [BLOCKER] [backend] app/routers/admin.py:42 — missing Depends(require_admin) on new endpoint — move under the admin router's prefix or add the dependency explicitly
2. [MAJOR] [frontend] components/Foo.tsx:12 — raw fetch against NEXT_PUBLIC_API_URL — route through lib/api.ts
FOLLOW-UPS:
- [frontend] Button aria-label could be more descriptive (non-blocking)
```

**Severity levels:** `BLOCKER` (security, correctness, architecture violation) · `MAJOR` (non-security bug, dead code, missing tests for new surface) · `MINOR` (style, naming) — MINOR goes under FOLLOW-UPS, never in ISSUES.

Any `BLOCKER` or `MAJOR` → `CHANGES_REQUESTED`.

## Checklist

### 1. Plan alignment
- [ ] Every `[x]` entry in `task.md::Shipped` maps to at least one hunk in the diff
- [ ] No files touched outside the plan's scope (check `plan.md::Out of scope` — any hit is a BLOCKER)
- [ ] Reused components listed in `plan.md::Reuses` are **extended**, not re-implemented

### 2. Security (BLOCKERS)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` appears nowhere under `frontend/`
- [ ] Every new admin endpoint in `backend/app/routers/admin.py` is under the router's `dependencies=[Depends(require_admin)]` (or explicitly on the route)
- [ ] No new endpoint returns or logs the service-role key, JWTs, or user emails in error messages
- [ ] New migrations in `backend/db/migrations/` are additive and numbered after the latest existing file — **never edit a shipped migration**
- [ ] RLS not widened without an explicit migration + approval note in `plan.md`
- [ ] No hardcoded secrets; config goes through `app/config.py` (backend) or `process.env.NEXT_PUBLIC_*` (frontend)

### 3. Backend architecture (`backend/`)
- [ ] Routers are thin: each endpoint body ≤ ~5 statements and calls exactly one service function
- [ ] Business logic lives in `app/services/`, not `routers/` or `schemas/`
- [ ] Supabase access via `get_supabase()` only — no inline client construction
- [ ] Multi-row atomic writes go through a Postgres RPC (checkout uses `create_order`), not Python loops
- [ ] Pydantic v2 schemas validate every request body; `response_model=` set on data-returning routes
- [ ] Domain errors raised as `HTTPException(status, "snake_case_code")`
- [ ] Public reads filter `is_active = true`

### 4. Frontend architecture (`frontend/`)
- [ ] Server Component by default; `"use client"` only at leaves that need hooks/handlers/browser APIs
- [ ] All FastAPI calls go through `lib/api.ts` — no raw `fetch` to `NEXT_PUBLIC_API_URL` elsewhere
- [ ] New `lib/api.ts` helpers have matching request/response types in `lib/types.ts`
- [ ] Admin pages verify `user.app_metadata.role === "admin"` server-side before rendering
- [ ] Cart state via `useCart()`; no alternate cart implementation
- [ ] Path aliases (`@/...`) — no `../../`
- [ ] Empty / loading / error states handled

### 5. Tests
- [ ] New backend services have `backend/tests/test_*.py` covering happy path + every `HTTPException` branch named in `plan.md`
- [ ] New frontend components/pages have `*.test.tsx` co-located
- [ ] Tests do not hit real Supabase (look for `SUPABASE_URL` with production-looking values in test fixtures)

### 6. Hygiene
- [ ] No unused imports, unused exports, unreachable branches
- [ ] No `console.log` / `print()` debugging
- [ ] No `any` in frontend TypeScript; no `# type: ignore` without a comment explaining why
- [ ] Migration filename matches pattern `000N_<kebab_desc>.sql`

## Review Workflow

1. Read `docs/features/<slug>/plan.md` + `task.md` in full
2. Run `git diff origin/main...HEAD --stat` to see scope
3. For each file in the diff: read the full hunks (not just headers); map to a checklist section
4. Group issues by severity; emit the output contract verbatim
5. Stop. Do not edit files; do not propose patches beyond the one-line "suggested fix" in the issue format

## What NOT To Flag

- Style preferences that aren't in `CLAUDE.md` or this checklist (save for FOLLOW-UPS)
- Tailwind class ordering — no enforced convention
- Comment density — this repo prefers minimal comments
- Test coverage % — binary: does the new surface have at least one happy-path + error-branch test?
