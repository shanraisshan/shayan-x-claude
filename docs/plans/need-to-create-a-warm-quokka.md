# Plan → PR Workflow

## Context

The repo already has `planner`, `backend-engineer`, `frontend-engineer` agents plus `/planning` and `/implement` commands. That covers phases 1–2 of the plan→PR pipeline. Missing: unit-test authoring, local PR review, a linting feedback loop inside Claude Code, and browser verification via `claude-in-chrome` MCP. The frontend has no test framework at all.

Goal: add the missing pieces and wire a single `/ship <slug>` command that chains every phase end-to-end with checkpoints, so a planned feature goes from `plan.md` to an open GitHub PR with one entry point.

User decisions (locked): **Vitest + RTL** for frontend tests · **single `/ship <slug>`** command · **Claude Code PostToolUse hooks** for lint · **local reviewer agent before PR opens**.

## Inventory: reuse vs build

| Piece | Status | Action |
|---|---|---|
| `planner` agent | Exists | Reuse as-is (phase 0) |
| `backend-engineer` / `frontend-engineer` | Exists | Reuse as-is (phase A + loops from E) |
| 4 domain skills (endpoint-builder, database-ops, component-builder, api-integration) | Exists | Reuse as-is |
| `/planning`, `/implement` | Exists | Reuse; `/ship` delegates to `/implement` routing verbatim |
| Observability hooks (`.claude/hooks/scripts/hooks.py`) | Exists | Untouched — add new lint hooks alongside |
| Backend pytest + ruff + mypy | Configured; `tests/test_health.py` pattern | Reuse; add `test_*.py` files per feature |
| Frontend tests | **Missing** | Install Vitest + RTL, add config and setup |
| `test-engineer` agent | Missing | Build |
| `code-reviewer` agent | Missing | Build |
| `browser-verifier` agent | Missing | Build |
| `frontend-testing` skill | Missing | Build |
| `backend-testing` skill | Missing | Build |
| `code-review` skill | Missing | Build |
| `browser-verification` skill | Missing | Build |
| `/ship <slug>` command | Missing | Build |
| Lint PostToolUse hooks | Missing | Add to `.claude/settings.json` |

## Workflow

```
/planning "<requirements>"
  │
  ▼  planner ──▶ docs/features/<slug>/plan.md + task.md        [phase 0]
  │
/ship <slug>
  │
  ├─[A] Preflight + implement
  │     • verify plan exists, verify on feature branch (not main)
  │     • Checkpoint A → delegate to /implement routing
  │     • backend-engineer / frontend-engineer land code
  │     • PostToolUse lint hook fires per Edit/Write  ◀── phase 5 live here
  │
  ├─[B] Tests
  │     • Checkpoint B → spawn test-engineer
  │     • writes *.test.tsx + test_*.py, runs vitest + pytest, must be green
  │
  ├─[C] Batch lint gate (npm lint + tsc + ruff + mypy)
  │     • failure pauses for user; no auto-loop
  │
  ├─[D] Browser verify  (skipped if plan has no user-visible Verify)
  │     • Checkpoint D (confirm dev servers up on :3000/:8000)
  │     • browser-verifier drives claude-in-chrome, records verify.gif
  │     • console.error or 4xx/5xx → loop back to engineer
  │
  ├─[E] Local PR review
  │     • code-reviewer parses diff vs plan.md
  │     • APPROVE → phase F
  │     • CHANGES_REQUESTED → Checkpoint E → engineer fixes → re-review (max 2 loops)
  │
  └─[F] gh pr create
        • body generated from plan.md (Summary + Verify + link to verify.gif)
        • returns PR URL
```

## New files

```
.claude/agents/test-engineer.md
.claude/agents/code-reviewer.md
.claude/agents/browser-verifier.md
.claude/skills/frontend-testing/SKILL.md
.claude/skills/backend-testing/SKILL.md
.claude/skills/code-review/SKILL.md
.claude/skills/browser-verification/SKILL.md
.claude/commands/ship.md
frontend/vitest.config.ts
frontend/test/setup.ts
frontend/test/utils.tsx
```

## Modified files

```
.claude/settings.json            # +2 PostToolUse array entries for lint
frontend/package.json            # +test, test:watch scripts; +vitest devDeps
.github/workflows/frontend.yml   # +npm test step between typecheck and build
```

Existing agents, skills, commands, backend `pyproject.toml`, observability hook, and all `CLAUDE.md` files are **untouched**.

## Agent specs

### `.claude/agents/test-engineer.md`
- **Frontmatter:** `model: sonnet`, `color: yellow`, `tools: Read, Write, Edit, Glob, Grep, Bash`, skills: `frontend-testing`, `backend-testing`.
- **Responsibility:** read `plan.md` + `task.md::Shipped`, grep the new code, write tests co-located with the code (frontend) or in `backend/tests/` (backend). Covers happy path + every error branch named in `plan.md`.
- **Guardrails:** never touches production code (only `*.test.ts(x)` and `backend/tests/test_*.py`). Runs `cd frontend && npm test` and `cd backend && uv run pytest -q` before declaring done.

### `.claude/agents/code-reviewer.md`
- **Frontmatter:** `model: opus`, `color: red`, `tools: Read, Glob, Grep, Bash` (no Edit/Write), skill: `code-review`.
- **Inputs:** slug, `git diff origin/main...HEAD`, `git diff` (unstaged), `plan.md`.
- **Output contract** (so `/ship` can parse):
  ```
  VERDICT: APPROVE | CHANGES_REQUESTED
  ISSUES:
  1. [severity] [frontend|backend] <file:line> — <one-line issue> — <suggested fix>
  ...
  FOLLOW-UPS: <non-blocking nits>
  ```

### `.claude/agents/browser-verifier.md`
- **Frontmatter:** `model: sonnet`, `color: magenta`, tools include `Read, Grep, Bash, ToolSearch` + the `mcp__claude-in-chrome__*` tools needed (navigate, find, form_input, read_page, get_page_text, read_console_messages, read_network_requests, gif_creator, tabs_context_mcp, tabs_create_mcp, javascript_tool). Skill: `browser-verification`.
- **Preflight:** `ToolSearch select:mcp__claude-in-chrome__<name>` for each MCP tool before first call (schemas are deferred per MCP server instructions).
- **Flow:** `tabs_context_mcp` → `navigate(http://localhost:3000)` → execute each step from `plan.md::Verify` → assert UI → `read_console_messages` (any `error` → fail) → `read_network_requests` (any 4xx/5xx to `NEXT_PUBLIC_API_URL` origin → fail) → `gif_creator` → write to `docs/features/<slug>/verify.gif`.

## Skill specs (one-paragraph outlines each)

- **`frontend-testing`** — Vitest + RTL. Co-locate `Component.test.tsx` next to `Component.tsx`; `frontend/lib/api.test.ts` for API helpers; page integration tests under `frontend/app/**/page.test.tsx`. Mock `@/lib/api` with `vi.mock`; don't mock `fetch` unless testing `api.ts` itself. Server Components: `await Page({ params })` then render. Export `renderWithCart()` from `frontend/test/utils.tsx`. Don't test `middleware.ts`, Tailwind classes, or third-party libs.

- **`backend-testing`** — pytest + httpx. Reuse the `app.dependency_overrides[current_user]` pattern from `tests/test_health.py`. Add `tests/fakes.py::FakeSupabase` with chainable `.table().select().eq().execute()` mocks; mock via `monkeypatch.setattr("app.services.<mod>.get_supabase", lambda: fake)`. Assert snake_case `detail` strings from HTTPException. Fixtures `authed_admin`, `authed_user`, `test_client` live in existing `conftest.py`.

- **`code-review`** — pre-PR checklist: (1) every `[x]` in `task.md::Shipped` maps to a diff hunk; no out-of-scope files. (2) Security: grep diff for `SUPABASE_SERVICE_ROLE_KEY` outside `backend/`; every new admin endpoint under `dependencies=[Depends(require_admin)]`; new migrations are additive and never edit existing `000N_*.sql`. (3) Layering: router ≤5 statements and calls one service fn; `"use client"` only on leaves. (4) Dead code: unused imports/exports, orphaned `types.ts` entries. (5) `lib/api.ts` helpers paired with `types.ts` request/response types.

- **`browser-verification`** — always start with `ToolSearch select:mcp__claude-in-chrome__<name>` for each tool (deferred schemas). Canonical flow: `tabs_context_mcp` → `navigate` → `read_page` (confirm load) → `find` + `form_input` → `read_console_messages` after each nav. `console.error` = fail; warnings logged. Network fail on 4xx/5xx to the API origin. Output GIF at `docs/features/<slug>/verify.gif` referenced in the PR body.

## `/ship <slug>` command

`.claude/commands/ship.md` — frontmatter `description: Ship a planned feature end-to-end — implement, test, lint, browser-verify, review, open PR.`, `argument-hint: <feature-slug>`.

Body mirrors `/implement`'s style (router, never edits code directly). Phases A–F as above. Rules:
- Never re-plan (route back to `planner` if plan is thin).
- Never edit code directly — always via agent.
- Never skip a checkpoint.
- Never force-push; never `gh pr merge`.
- Never auto-commit code the user hasn't seen — Phase F requires a clean working tree.

Stop-and-ask conditions: plan missing, on `main` branch, `Depends on` feature unshipped, two review loops exhausted, batch lint gate fails, dev servers unreachable for Phase D.

## `.claude/settings.json` hook additions

Existing `PostToolUse` array has one entry (the observability hook at line 30). **Append two more** (do not replace):

```json
{
  "matcher": "Edit|Write|MultiEdit",
  "hooks": [
    {
      "type": "command",
      "command": "bash -c 'f=\"${CLAUDE_TOOL_INPUT_file_path:-}\"; case \"$f\" in ${CLAUDE_PROJECT_DIR}/frontend/*.ts|${CLAUDE_PROJECT_DIR}/frontend/*.tsx|${CLAUDE_PROJECT_DIR}/frontend/*.js|${CLAUDE_PROJECT_DIR}/frontend/*.jsx) cd \"${CLAUDE_PROJECT_DIR}/frontend\" && npx --no-install eslint \"$f\" ;; esac'",
      "timeout": 20000
    }
  ]
},
{
  "matcher": "Edit|Write|MultiEdit",
  "hooks": [
    {
      "type": "command",
      "command": "bash -c 'f=\"${CLAUDE_TOOL_INPUT_file_path:-}\"; case \"$f\" in ${CLAUDE_PROJECT_DIR}/backend/*.py) cd \"${CLAUDE_PROJECT_DIR}/backend\" && uv run ruff check \"$f\" ;; esac'",
      "timeout": 20000
    }
  ]
}
```

Synchronous (default `async: false`) so the engineer agent sees lint failures immediately and self-heals. Path filtering via `case` means edits outside `frontend/`/`backend/` no-op. Existing async observability hook at array[0] keeps working.

## Frontend test scaffolding

**devDependencies** (`cd frontend && npm i -D ...`):
```
vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**`frontend/vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
})
```

**`frontend/test/setup.ts`:** `import '@testing-library/jest-dom'`; stub `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**`frontend/test/utils.tsx`:** `renderWithCart(ui, { initialLines? })` wrapping `CartProvider`.

**`frontend/package.json` scripts:**
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**`.github/workflows/frontend.yml`:** add `- run: npm test` step between the existing `typecheck` and `build` steps.

## Verification (end-to-end dry run)

Dummy feature to prove the pipeline works without touching real product code:

1. `/planning "Add a site version badge in the public footer showing the package.json version"` → produces `docs/features/site-version-badge/plan.md` + `task.md`. Pure frontend, trivial Verify.
2. `git checkout -b feature/site-version-badge && /ship site-version-badge`:
   - **A:** frontend-engineer adds `components/SiteVersion.tsx`, wires into existing `Header.tsx` / layout footer. Watch lint hook run `eslint` per save.
   - **B:** test-engineer adds `components/SiteVersion.test.tsx`. `npm test` green.
   - **C:** batch lint passes.
   - **D:** browser-verifier navigates to `http://localhost:3000`, asserts `v0.1.0` visible, no console errors, saves `verify.gif`.
   - **E:** code-reviewer → `APPROVE`.
   - **F:** `gh pr create` returns a PR URL.
3. **Negative tests** (prove the guards bite):
   - Inject `console.error("boom")` in the component → Phase D returns `FAILED`, loops.
   - Drop `const KEY = "eyJ..."` in `frontend/lib/api.ts` → Phase E returns `CHANGES_REQUESTED` with a security issue.
   - Add an unused import → PostToolUse `eslint` flags it immediately in Phase A, before the engineer returns.
4. Close the dummy PR and delete the branch.

If all three pass (and all three negatives are caught), the workflow is live.

## Critical files to modify

- `/home/muhammad/Dev/learning-x-claude/.claude/settings.json` — append 2 PostToolUse entries
- `/home/muhammad/Dev/learning-x-claude/.claude/commands/ship.md` — new orchestrator
- `/home/muhammad/Dev/learning-x-claude/.claude/agents/test-engineer.md` — new
- `/home/muhammad/Dev/learning-x-claude/.claude/agents/code-reviewer.md` — new
- `/home/muhammad/Dev/learning-x-claude/.claude/agents/browser-verifier.md` — new
- `/home/muhammad/Dev/learning-x-claude/frontend/vitest.config.ts` — new
- `/home/muhammad/Dev/learning-x-claude/frontend/package.json` — +scripts, +devDeps
- `/home/muhammad/Dev/learning-x-claude/.github/workflows/frontend.yml` — +test step
