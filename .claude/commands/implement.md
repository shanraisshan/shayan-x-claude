---
description: Implement a feature from its plan. Reads docs/features/<slug>/plan.md + task.md and delegates work to the backend-engineer and/or frontend-engineer agents in the right order.
argument-hint: <feature-slug>
---

## Argument

- **$ARGUMENTS**: the feature slug (kebab-case folder name under `docs/features/`).
  - If empty, ask the user which slug to implement and list available folders under `docs/features/` so they can pick.

## Goal

Pick up an already-planned feature and drive its implementation to completion using the existing engineer agents — without re-planning, without re-deciding scope, and without re-doing anything the plan says to reuse.

The plan and task list are the source of truth. Your job is execution: route each unchecked task to the right specialist agent, in the right order, and ensure `task.md` is updated as work lands.

## Actions

### 1. Locate the plan

- Resolve the slug from `$ARGUMENTS`. If missing, list `docs/features/*/` and ask which one.
- Verify `docs/features/<slug>/plan.md` and `docs/features/<slug>/task.md` both exist.
- If either is missing, **stop**. Tell the user: "No plan at `docs/features/<slug>/`. Run the `planner` agent first." Do not improvise a plan.

### 2. Read both files in full

- Use `Read` on `docs/features/<slug>/plan.md` and `docs/features/<slug>/task.md`.
- Note these specifically:
  - The **Reuses** section in `plan.md` — these are inputs to the implementer's brief, not things to rebuild.
  - **Depends on** — if it lists another feature whose `task.md` still has unchecked items, stop and tell the user; don't silently work around a missing dependency.
  - **Out of scope** — pass these forward verbatim to the engineer prompts so they don't drift.
  - The unchecked items in `task.md` under "Next up" — these are the work units.

### 3. Classify tasks by app

For each unchecked `- [ ]` line in `task.md::Next up`, decide who owns it. **Prefer the explicit owner tag the planner wrote** at the start of the task line:

| Tag | Owner |
|-----|-------|
| `[backend-engineer]` | `backend-engineer` |
| `[frontend-engineer]` | `frontend-engineer` |
| `[both]` | coordinated — handle as a verify/coordination step in step 5 |

Fall back to the file-path prefix only when a task has no tag (older plans):

| Path prefix | Owner |
|-------------|-------|
| `backend/` | `backend-engineer` |
| `frontend/` | `frontend-engineer` |
| Other (verification, docs, no path) | tag as `verify` — handle in step 5 |

If a task has *neither* a tag nor a path you can route from, stop and ask the user — don't guess.

### 4. Order and delegate

- **Backend-first rule:** if the feature has both backend and frontend tasks AND the frontend tasks consume a new endpoint/schema/RPC the backend introduces, run `backend-engineer` first and wait for it to finish. The frontend agent needs the API surface to exist before it can wire calls through `lib/api.ts`.
- **Independent-side rule:** if backend and frontend tasks are genuinely independent (e.g., a frontend-only refactor on shipped endpoints, or a backend admin-only change with no UI touch), spawn both agents **in parallel** in the same message — do not block one on the other.
- **Single-side feature:** spawn only the relevant agent.

For each agent invocation, use a self-contained prompt of this shape (the agent doesn't see this conversation):

```
Implement the <slug> feature for the <backend|frontend> side.

Plan:        docs/features/<slug>/plan.md
Tasks:       docs/features/<slug>/task.md
Out of scope (do not expand): <copy from plan.md::Out of scope, or "none">
Reuse (do NOT rebuild): <copy from plan.md::Reuses + the relevant Frontend/Backend section>
Depends on: <copy from plan.md::Depends on, or "none">

Your tasks (from task.md::Next up — only the ones for your side):
- <task 1 verbatim>
- <task 2 verbatim>
...

Working rules:
- Read plan.md and task.md in full before touching any code.
- Honor every "Reuses" reference — extend, don't recreate.
- After each task is done, edit task.md: change that line from "- [ ]" to "- [x]" and move it from "Next up" to "Shipped". Do this immediately, not at the end.
- Follow your agent's own checklist (architecture compliance, types, tests, etc.) before declaring a task complete.
- If a task is blocked or wrong, stop and report back — do not invent a workaround.
- Verify per the plan.md::Verify section for any task that completes a user-visible flow.

Return a short summary: which tasks you completed, which you couldn't and why, and any follow-ups discovered.
```

### 5. Verification round

After the engineer agent(s) return:

- Re-read `docs/features/<slug>/task.md` to confirm `Shipped` reflects what landed.
- If the plan has a `Verify` section with shell commands (e.g., curl + jq), offer to run them — do not run anything destructive without confirming with the user first.
- For UI flows, remind the user that frontend changes need a browser sanity check (the implementing agent can't verify UI on its own).

### 6. Report

End with a concise summary to the user:

- ✅ Tasks completed (count + one-line list)
- ⚠️  Tasks not done and why (blocked, out of scope, missing dependency)
- 🔎 Anything follow-up the engineers surfaced
- Next suggested action (run the verify commands, eyeball the UI, run `/implement <other-slug>` if a dependency is now unblocked, etc.)

## Rules

| # | Rule | Why |
|---|------|-----|
| 1 | **Never re-plan** — if the plan is wrong or thin, stop and route the user back to the `planner` agent | The planner is the authority for scope |
| 2 | **Never edit code yourself in this command** — always delegate to `backend-engineer` / `frontend-engineer` via the `Agent` tool | Specialists know their architecture rules; the command stays a router |
| 3 | **Backend before frontend** when the frontend depends on a new API surface | Avoids the frontend agent inventing endpoints that don't exist yet |
| 4 | **Parallel when independent** — spawn both agents in one message | Speed when there's no dependency |
| 5 | **Pass `Reuses` and `Out of scope` forward verbatim** | Engineers don't see conversation context; the brief must carry it |
| 6 | **Engineers update `task.md`** as they finish each item — they do this in their own work, not in a batch at the end | Keeps the plan honest in real time |
| 7 | **Block on missing `Depends on`** — don't silently work around an unmet cross-feature dependency | Avoids hidden assumptions |
| 8 | **Never run destructive verify commands without confirmation** (e.g., resetting the DB, dropping tables) | Plans may include risky checks |

## Stop conditions

Stop and report to the user — do not push through — when:

- The slug folder doesn't exist
- `plan.md` or `task.md` is missing or empty
- A `Depends on` feature still has unchecked tasks
- An engineer agent reports a task as blocked
- The plan contradicts root `CLAUDE.md` locked decisions (mocked payments, no customer accounts, etc.) or `frontend/CLAUDE.md` / `backend/CLAUDE.md` non-negotiables
