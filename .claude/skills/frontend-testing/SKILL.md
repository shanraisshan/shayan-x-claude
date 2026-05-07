---
name: frontend-testing
description: Vitest + React Testing Library patterns for the Next.js 15 frontend. Co-located component tests, mocking lib/api.ts, testing Server Components, CartProvider harness. Use when writing or reviewing *.test.ts(x) files in frontend/.
argument-hint: "[file or feature under test]"
---

# Frontend Testing Skill

> **Version:** 1.0 | **Working Directory:** `frontend/`

Write Vitest + React Testing Library tests for **$ARGUMENTS** following the conventions in this repo.

## Stack

- **Vitest** — runner and assertion library (`vi.mock`, `expect`, `vi.fn`)
- **@testing-library/react** — render + DOM queries
- **@testing-library/jest-dom** — matchers (`toBeInTheDocument`, `toHaveTextContent`, …)
- **@testing-library/user-event** — user interactions
- **jsdom** — DOM environment

No Jest. No Enzyme. No snapshot tests unless explicitly requested.

## Constitution (Non-Negotiable Rules)

| # | Rule | Why |
|---|------|-----|
| 1 | **Co-locate tests** next to the file under test: `Foo.tsx` → `Foo.test.tsx` in the same folder | Keeps tests discoverable; matches `include: ['**/*.test.{ts,tsx}']` in vitest config |
| 2 | **Mock `@/lib/api` with `vi.mock`**, not raw `fetch` (unless testing `lib/api.ts` itself) | Tests the component, not the transport |
| 3 | **Server Components**: call them as `async` functions (`await Page({ params: Promise.resolve({slug}) })`) then `render(jsx)` | Next 15 + React 19 Server Components aren't rendered by `next/navigation` stubs |
| 4 | **Use `userEvent`** over `fireEvent` for anything a user would do (click, type, select) | `userEvent` fires realistic event sequences |
| 5 | **Query by role / label / text**, not by test IDs unless there's no accessible alternative | Catches a11y regressions for free |
| 6 | **Cart tests use `renderWithCart`** from `@/test/utils` | Single source of truth for CartProvider setup |
| 7 | **Don't test**: `middleware.ts` (edge runtime), Tailwind class presence (brittle), third-party libs | Low value, high maintenance |
| 8 | **Strict TypeScript in tests** — no `any`, no `@ts-ignore` without a comment explaining why | Same bar as production code |

## Quick Start

### Pure component (Client)
```tsx
// frontend/components/AddToCartButton.test.tsx
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithCart } from "@/test/utils";
import { AddToCartButton } from "./AddToCartButton";

const product = {
  id: "p1", slug: "shirt", name: "Tee", price_cents: 1000,
  currency: "USD", image_url: null, stock: 3, is_active: true,
};

describe("AddToCartButton", () => {
  it("adds the product to the cart on click", async () => {
    const user = userEvent.setup();
    renderWithCart(<AddToCartButton product={product} />);
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    // assert via a cart-reading sibling or by observing the re-render; don't peek into localStorage
  });

  it("is disabled when out of stock", () => {
    renderWithCart(<AddToCartButton product={{ ...product, stock: 0 }} />);
    expect(screen.getByRole("button", { name: /sold out/i })).toBeDisabled();
  });
});
```

### Server Component page
```tsx
// frontend/app/(store)/products/[slug]/page.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  getProduct: vi.fn(async (slug: string) => ({
    id: "p1", slug, name: "Tee", price_cents: 1000,
    currency: "USD", image_url: null, stock: 3, is_active: true,
  })),
}));

const { default: ProductPage } = await import("./page");

describe("ProductPage", () => {
  it("renders the product name", async () => {
    const jsx = await ProductPage({ params: Promise.resolve({ slug: "shirt" }) });
    render(jsx);
    expect(screen.getByRole("heading", { name: /tee/i })).toBeInTheDocument();
  });
});
```

### `lib/api.ts` helper test (mock fetch here — this is the boundary)
```ts
// frontend/lib/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProducts, ApiError } from "./api";

beforeEach(() => { vi.restoreAllMocks(); });

describe("listProducts", () => {
  it("returns items on 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 })
    ));
    const res = await listProducts();
    expect(res.items).toEqual([]);
  });

  it("throws ApiError on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ detail: "not_found" }), { status: 404 })
    ));
    await expect(listProducts()).rejects.toBeInstanceOf(ApiError);
  });
});
```

## File Organization

| What to test | Where the test file goes |
|---|---|
| `components/Foo.tsx` | `components/Foo.test.tsx` (same folder) |
| `app/(store)/products/[slug]/page.tsx` | `app/(store)/products/[slug]/page.test.tsx` |
| `lib/api.ts` | `lib/api.test.ts` |
| Shared utilities | `lib/<name>.test.ts` |

## What To Cover

Read `docs/features/<slug>/plan.md` first. Derive tests from the plan's user flows + error mapping:

- **Happy path** — one test per documented flow
- **Every error branch in `plan.md`** — map `ApiError.detail` strings to rendered messages
- **Empty / loading / out-of-stock states** — components must render without crashing
- **Gated UI** — admin components should handle a missing session gracefully (render nothing or a login prompt)

## What NOT To Cover

- `frontend/middleware.ts` — runs in the edge runtime; integration-test via real auth flow
- Tailwind class names — querying `.className` is brittle
- `CartProvider` internals — treat as a black box via `useCart()`
- Third-party lib internals (`@supabase/ssr`, `next/image`)

## Common Patterns

### Mocking the Supabase browser client
```ts
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "t" } } })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    },
  }),
}));
```

### Asserting `router.refresh()` was called
```ts
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
// ... trigger the action
expect(refresh).toHaveBeenCalled();
```

### Resetting module-level mocks between tests
```ts
import { beforeEach } from "vitest";
beforeEach(() => { vi.clearAllMocks(); });
```

## Running

```bash
cd frontend
npm test                  # one-shot (CI mode)
npm run test:watch        # watch mode during dev
npm run test:coverage     # with coverage report
```

## Exemplar Files

- `frontend/test/setup.ts` — global test setup (jest-dom + env stubs)
- `frontend/test/utils.tsx` — `renderWithCart` helper
- `frontend/vitest.config.ts` — config with jsdom + `@` alias
