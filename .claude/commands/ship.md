---
description: Ship a planned feature end-to-end — implement, test, lint, browser-verify, review, open the PR. Checkpoints between phases.
argument-hint: <feature-slug>
---

## Argument

- **$ARGUMENTS**: the feature slug (kebab-case folder name under `docs/features/`).
  - If empty, list available slugs via `ls docs/features/` and ask which to ship.

## Goal

Take a planned feature from code implementation all the way to an open GitHub PR. Chain the existing `/implement` routing with three new agents (`test-engineer`, `browser-verifier`, `code-reviewer`) and finish by opening the PR via `gh`. You are a router — **never edit code directly, never re-plan**.

Lint happens automatically: the `.claude/settings.json` PostToolUse hooks run `eslint` on frontend edits and `ruff check` on backend edits during Phase A and Phase B, so the engineer agents see lint failures live and self-heal.

## Phases (each pauses for confirmation before starting)

### Phase A — Preflight + Implement

1. Resolve `<slug>` from `$ARGUMENTS`. If missing, list `docs/features/*/` and ask.
2. Verify `docs/features/<slug>/plan.md` and `task.md` both exist. Missing → **stop**, tell the user to run `/planning` first.
3. Verify the working tree is on a feature branch: `git rev-parse --abbrev-ref HEAD`. If `main` → **stop**, tell the user to `git checkout -b feature/<slug>` first.
4. Read `plan.md` + `task.md`. Count the `- [ ]` items under `Next up`.
5. **Checkpoint A**: print:
   ```
   Feature:       <slug>
   Branch:        <current branch>
   Plan:          docs/features/<slug>/plan.md
   Open tasks:    <N>
   Next phase:    Implement → test-engineer → lint → browser-verify → code-reviewer → gh pr create
   ```
   Ask: **"Proceed with implementation? (y/n)"**. Stop on `n`.
6. On `y`, delegate to the **existing `/implement` routing** — spawn `backend-engineer` and/or `frontend-engineer` per the rules in `.claude/commands/implement.md` (read it and follow its classification/ordering; do not duplicate its logic inline).
7. After engineers return, re-read `task.md`. If nothing moved from `Next up` → `Shipped`, **stop** and surface what the engineers reported.

### Phase B — Write Tests

1. **Checkpoint B**: print `Shipped <N> tasks. Proceed to tests? (y/n)`. Stop on `n`.
2. On `y`, spawn the `test-engineer` agent once with a self-contained prompt:
   ```
   Write tests for the <slug> feature.

   Plan:    docs/features/<slug>/plan.md
   Tasks:   docs/features/<slug>/task.md
   Scope:   everything newly moved into task.md::Shipped since origin/main
   Skills:  frontend-testing, backend-testing

   Use `git diff origin/main...HEAD --stat` to find the new files.
   Write backend tests under backend/tests/test_*.py and frontend tests
   co-located as *.test.tsx. Run pytest and vitest before declaring done.
   Return the TESTS WRITTEN report.
   ```
3. Parse its report. If it reported failures → spawn it once more with the failure log; if still failing, **stop** and surface.

### Phase C — Batch Lint Gate

Run the heavy checks that the per-file hooks skip:

```bash
cd frontend && npm run lint && npm run typecheck
cd ../backend && uv run ruff check . && uv run mypy app
```

Any failure → print the error and **stop**. Do not auto-loop; the user decides whether to re-dispatch to an engineer or fix directly.

### Phase D — Browser Verify

1. If `plan.md` has no `## Verify` section, **or** the Verify section is backend-only (no URLs, no UI steps) → **skip this phase**; note in the PR body that browser verification wasn't applicable.
2. Otherwise, **Checkpoint D**: print `Start local dev servers on :3000 (frontend) and :8000 (backend), then confirm ready. (y/n)`. Stop on `n`.
3. On `y`, quickly sanity-check:
   - `curl -sf http://localhost:8000/health`
   - `curl -sfo /dev/null -w "%{http_code}" http://localhost:3000`
   If either fails, **stop** and tell the user to start the servers.
4. Spawn the `browser-verifier` agent with:
   ```
   Verify the <slug> feature against the running dev servers.

   Plan:    docs/features/<slug>/plan.md (execute every step in the Verify section)
   Output:  docs/features/<slug>/verify.gif
   Skill:   browser-verification

   Return the VERIFY: PASSED | FAILED report.
   ```
5. On `FAILED`: print the transcript. **Stop** and ask the user whether to dispatch the failure back to the engineer or fix manually (do not auto-loop — UI bugs often need judgment).

### Phase E — Local Code Review

1. Spawn the `code-reviewer` agent:
   ```
   Review the <slug> feature before PR.

   Plan:    docs/features/<slug>/plan.md
   Tasks:   docs/features/<slug>/task.md
   Diff:    `git diff origin/main...HEAD` + unstaged `git diff`
   Skill:   code-review

   Emit the VERDICT contract verbatim.
   ```
2. Parse the first `VERDICT:` line.
3. If `APPROVE` → continue to Phase F.
4. If `CHANGES_REQUESTED`:
   - Print the ISSUES list.
   - **Checkpoint E**: ask `Dispatch issues back to the engineer? (y/n/skip)`. `skip` → continue to Phase F anyway (user override); `n` → stop; `y` → spawn the right engineer (backend/frontend — pick based on `[side]` tags in each issue) with the issue list verbatim, then re-spawn `code-reviewer` once.
   - Max **2 review loops**. After 2, stop and hand back to the user.

### Phase F — Open the PR

1. `git status --short` — if the working tree is dirty, **stop** and ask the user to commit first. `/ship` does **not** auto-commit code the user hasn't seen.
2. `git fetch origin && git log --oneline origin/main..HEAD` — confirm there's something to push.
3. If the branch has no upstream: `git push -u origin HEAD`. Otherwise: `git push`.
4. Build the PR body from `plan.md`:
   - Title: `<slug>: <first line of plan.md intro>` (≤ 70 chars; truncate if needed)
   - Summary: 3 bullets from `plan.md::User flows`
   - Test plan: a checklist of the Verify steps
   - Browser verify: link to `docs/features/<slug>/verify.gif` if present
   - Plan link: `docs/features/<slug>/plan.md`
5. Run:
   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   ## Summary
   - <bullet 1>
   - <bullet 2>
   - <bullet 3>

   ## Test plan
   - [x] `cd backend && uv run pytest`
   - [x] `cd frontend && npm test`
   - [x] Browser verify (see docs/features/<slug>/verify.gif)
   - [ ] <Verify step 1 from plan.md>
   - [ ] <Verify step 2>

   ## Plan
   docs/features/<slug>/plan.md

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```
6. Print the returned PR URL.

## Rules

| # | Rule | Why |
|---|------|-----|
| 1 | **Never re-plan** — missing/thin plan → route user to `/planning` | Planner is the scope authority |
| 2 | **Never edit code yourself** — always via `backend-engineer` / `frontend-engineer` / `test-engineer` | This command is a router |
| 3 | **Never skip a checkpoint** | User must be able to intervene |
| 4 | **Never force-push, never `gh pr merge`** | Destructive / human-review gate |
| 5 | **Never auto-commit code the user hasn't seen** — Phase F requires a clean working tree | User owns the commit story |
| 6 | **Max 2 code-review loops** in Phase E | Prevents infinite bouncing |
| 7 | **Skip Phase D when no UI flow** — don't invent Verify steps | Honor the plan as written |
| 8 | **Engineer prompts must be self-contained** — they don't see this conversation | Pass plan path, out-of-scope, reuses verbatim |

## Stop Conditions

Stop and report to the user — do not push through — when:

- `<slug>` folder doesn't exist
- On `main` branch
- `Depends on` feature still has unchecked tasks
- An engineer reports a blocked task
- Batch lint gate (Phase C) fails
- Dev servers unreachable at Phase D
- `browser-verifier` returns `FAILED`
- `code-reviewer` returns `CHANGES_REQUESTED` after 2 loops
- Working tree dirty at Phase F
- `gh` not installed / not authenticated
