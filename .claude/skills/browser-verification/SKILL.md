---
name: browser-verification
description: Drive Chrome via the claude-in-chrome MCP to exercise plan.md::Verify steps for a shipped feature. Loads deferred MCP tool schemas, asserts console/network cleanliness, records a GIF for the PR. Used by the browser-verifier agent.
---

# Browser Verification Skill

> **Version:** 1.0 | **Working Directory:** repo root

Execute the `Verify` section of `docs/features/<slug>/plan.md` against `http://localhost:3000` (frontend) talking to `http://localhost:8000` (backend). Fail loudly on console errors or API 4xx/5xx. Record a GIF artifact.

## Prerequisites (confirm before starting)

1. User has `uvicorn` running on `:8000` (backend) — confirm with `curl -s http://localhost:8000/health | grep ok`.
2. User has `npm run dev` running on `:3000` (frontend) — confirm with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` returning `200`.
3. If either is down, stop and ask the user to start it. Do not try to start dev servers from the agent.

## MCP Tool Schema Loading (MANDATORY)

`mcp__claude-in-chrome__*` tool schemas are **deferred** — calling them without loading fails with `InputValidationError`. Load each tool before first use:

```
ToolSearch query: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__find,mcp__claude-in-chrome__form_input,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__gif_creator,mcp__claude-in-chrome__javascript_tool"
```

Always start a session with `tabs_context_mcp` — never reuse a tab ID from a prior session.

## Canonical Flow

1. **Load tool schemas** (`ToolSearch select:...`)
2. **`tabs_context_mcp`** → see what's open; if the user doesn't explicitly want to reuse a tab, call `tabs_create_mcp` for a fresh tab
3. **`gif_creator` — start recording** with a name like `<slug>_verify.gif`, aiming at the new tab
4. **`navigate(http://localhost:3000<path>)`** to the start of the flow
5. **`read_page`** to confirm the page loaded; fail fast if the expected container isn't present
6. For each step in `plan.md::Verify`:
   - **`find(selector)`** to locate the element
   - **`form_input`** to type values or **click** via `computer` / `javascript_tool` for non-form interactions
   - **`read_console_messages`** with a pattern filter to check for `level: "error"`
   - **`read_network_requests`** filtered to origin `http://localhost:8000` — any `status >= 400` is a failure
7. **`gif_creator` — stop recording**; save to `docs/features/<slug>/verify.gif`
8. Report `PASSED` or `FAILED` with the transcript

## Assertion Rules

| Signal | Result |
|---|---|
| Any `console.error` during the flow | FAILED |
| Any network 4xx or 5xx to `NEXT_PUBLIC_API_URL` origin | FAILED |
| Expected text/selector missing after `navigate` | FAILED |
| `console.warn` | Logged, non-blocking |
| 3xx redirects (login gating) | Expected when the plan says "redirects to /admin/login" |

## Dialog / Alert Avoidance

**Do not trigger `alert()`, `confirm()`, `prompt()`, or browser modals.** They block all further MCP events and freeze the session. If the plan's Verify section includes a confirm-to-delete flow, warn and use `javascript_tool` to pre-accept the dialog via `window.confirm = () => true` before the click.

## Output Format

```
VERIFY: PASSED
slug: <slug>
artifact: docs/features/<slug>/verify.gif
steps:
  - navigate /products/shirt → 200
  - Add to cart clicked → cart count = 1
  - /cart loaded → subtotal = $10.00
  - Checkout submitted → redirected to /thank-you/<id>
console: clean
network: 4 requests, all 2xx
```

or

```
VERIFY: FAILED
slug: <slug>
artifact: docs/features/<slug>/verify.gif
failure: console.error at step 3 — "Cannot read properties of undefined (reading 'stock')"
transcript:
  - navigate /products/shirt → 200
  - Add to cart clicked → console.error ← FAIL
```

## Rabbit-Hole Guard

Stop after 2–3 failed attempts at the same step and return `FAILED`. Do not explore unrelated pages to debug. Don't refresh/retry loops — report and exit.

## Exemplar Plan Verify Sections

The browser-verifier should interpret plan Verify sections that read like:

```
## Verify
1. Open http://localhost:3000 — product grid shows at least one card
2. Click a product card — detail page shows name, price, "Add to cart" button
3. Click "Add to cart" — header cart count increments
4. Navigate to /cart — line item shows with correct quantity
5. Navigate to /checkout, fill email + shipping, submit — redirected to /thank-you/<uuid>
```

Translate each numbered step into the MCP call sequence described in Canonical Flow.
