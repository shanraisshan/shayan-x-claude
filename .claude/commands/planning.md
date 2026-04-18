---
description: Plan a new feature or change. Takes user requirements and invokes the planner agent to produce docs/features/<slug>/plan.md + task.md.
argument-hint: <feature requirements>
---

## Argument

- **$ARGUMENTS**: the user's feature requirements — free-form description of what they want built.
  - If empty, ask the user to describe the feature/change they want planned before proceeding. Do not invoke the agent with an empty brief.

## Goal

Turn a raw feature request into a `plan.md` + `task.md` under `docs/features/<slug>/` by delegating to the `planner` agent. This command is a thin router — it does not itself survey the codebase, pick slugs, or draft plans. The planner owns all of that.

## Actions

### 1. Capture the requirements

- Read `$ARGUMENTS` as the user's brief verbatim.
- If it's empty or a single vague word (e.g., just "reviews"), ask the user to expand: what's the user-visible behavior, is it admin-only or customer-facing, any constraints you already know. Wait for an answer before invoking the planner.
- Do **not** rewrite or "clean up" the requirements yourself — the planner needs the user's own words to ask the right clarifying questions.

### 2. Invoke the `planner` agent

Spawn the `planner` agent via the `Agent` tool with `subagent_type: "planner"`. The agent doesn't see this conversation, so the prompt must be self-contained:

```
Plan a new feature for this Next.js + FastAPI + Supabase MVP.

User requirements (verbatim):
<paste $ARGUMENTS exactly as the user wrote it>

Follow your own workflow:
1. Clarify only if an implementation decision genuinely hinges on the answer — don't drip-feed questions.
2. Survey docs/features/, frontend/, backend/, and the CLAUDE.md trio for pieces to reuse.
3. Propose a slug + outline in chat and wait for user confirmation before writing files.
4. Write docs/features/<slug>/plan.md and task.md in the existing repo style.
5. End with a handoff sentence naming which engineer agent should pick it up (`backend-engineer`, `frontend-engineer`, or both with backend-first).

Respect every locked decision in root CLAUDE.md (mocked payments, guest checkout, admin via Supabase Auth, etc.) and the non-negotiables in frontend/CLAUDE.md / backend/CLAUDE.md. Flag any conflict before planning around it.

Do not implement. Plans only.
```

### 3. Report back

After the planner returns:

- Surface the slug it picked and the path to the written files (`docs/features/<slug>/plan.md` + `task.md`).
- Pass through the planner's handoff sentence (which engineer picks it up next).
- Suggest the natural next step: `/implement <slug>` once the user is happy with the plan.

If the planner stopped before writing files (e.g., waiting on a clarifying question, or flagged a conflict with a locked decision), relay that to the user verbatim — don't push through.

## Rules

| # | Rule | Why |
|---|------|-----|
| 1 | **Never draft the plan yourself** — always delegate to the `planner` agent | The planner owns the survey + format; this command is a router |
| 2 | **Pass the user's requirements verbatim** — don't paraphrase or expand | The planner needs the raw ask to judge what's ambiguous |
| 3 | **Don't pick a slug** — that's the planner's Step 3 | Avoids two sources of truth |
| 4 | **Don't write files under `docs/features/`** from this command | The planner writes; the command orchestrates |
| 5 | **Don't auto-invoke `/implement`** after planning completes | The user reviews the plan first |

## Stop conditions

Stop and report to the user — do not push through — when:

- `$ARGUMENTS` is empty or too vague to form a brief
- The planner reports a conflict with a locked decision in the CLAUDE.md trio
- The planner is waiting on a clarifying answer from the user
- A folder with the proposed slug already exists and the planner is asking whether to extend it
