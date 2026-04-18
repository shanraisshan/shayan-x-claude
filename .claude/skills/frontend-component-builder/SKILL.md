---
name: frontend-component-builder
description: Build pages and components in the Next.js 15 App Router (RSC by default, "use client" only when needed), Tailwind for styling, typed props, and the existing CartProvider for cart state. Use when creating or modifying pages, layouts, components, or forms in frontend/.
argument-hint: "[page-or-component-name]"
---

# Component Builder Skill

> **Version:** 1.0 | **Working Directory:** `frontend/`

Build pages and components for **$ARGUMENTS** following the App Router conventions used in this repo.

## Overview

This skill provides patterns for:
- **Page Layer** — `app/(store)/...` and `app/admin/...` routes (Server Components by default)
- **Component Layer** — reusable Server or Client components in `components/`
- **State** — local React state, plus the Cart Context in `components/CartProvider.tsx`
- **Styling** — Tailwind utilities

This MVP intentionally has **no Redux, no React Query, no Formik, no Zod**. Don't add them.

## Constitution (Non-Negotiable Rules)

| # | Rule | Why |
|---|------|-----|
| 1 | **Server Component by default**; add `"use client"` only when the file needs hooks (`useState`, `useEffect`, context), event handlers, or browser-only APIs | RSC keeps bundles small and fetches data on the server |
| 2 | **Push `"use client"` to the leaf** — wrap the smallest interactive piece, not the whole page | Keeps the rest of the tree as RSC |
| 3 | **Strict TypeScript** — no `any`; props typed via `interface` or `type`; shared shapes from `lib/types.ts` | Type safety |
| 4 | **All FastAPI calls through `lib/api.ts`** — never inline `fetch` against `NEXT_PUBLIC_API_URL` | Single typed surface for the API |
| 5 | **Path aliases `@/...`** — never `../../` | Maintainability |
| 6 | **Handle empty / loading / error** — Suspense + `loading.tsx`, `error.tsx`, or inline guards | Good UX |
| 7 | **Tailwind for styling** — match utility patterns in existing components; no inline `style={{...}}` for layout | Consistency |
| 8 | **No service-role secrets in `frontend/`** — admin tokens come from the user's Supabase session, not from a server key | Service-role key is backend-only |
| 9 | **`next/image` for product images, `next/link` for nav** | Perf + prefetch |
| 10 | **Cart state via `useCart()` from `components/CartProvider.tsx`** — don't roll your own | Single source of truth, persisted in localStorage |

## When to Use

- Creating a new storefront or admin page
- Building a reusable component
- Adding a form (login, checkout, product create/edit, status update)
- Refactoring a Client Component back to a Server Component when feasible

## Quick Start

### Server Component page (storefront)
```tsx
// frontend/app/(store)/products/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/api";
import { AddToCartButton } from "@/components/AddToCartButton";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch {
    notFound();
  }
  return (
    <article className="grid gap-6 md:grid-cols-2">
      {/* ... */}
      <AddToCartButton product={product} />
    </article>
  );
}
```

### Server Component admin page (gated)
```tsx
// frontend/app/admin/products/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminListProducts } from "@/lib/api";

export default async function AdminProductsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") redirect("/admin/login");

  const { data: { session } } = await supabase.auth.getSession();
  const { items } = await adminListProducts(session!.access_token, { limit: 100 });

  return <ProductsTable items={items} />; // ProductsTable can be a Client Component
}
```

### Client Component with handlers
```tsx
// frontend/components/AddToCartButton.tsx
"use client";

import { useCart } from "@/components/CartProvider";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <button
      onClick={() => add(product, 1)}
      className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      disabled={product.stock <= 0}
    >
      {product.stock > 0 ? "Add to cart" : "Sold out"}
    </button>
  );
}
```

### Form (Client Component, plain React state)
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkout, ApiError } from "@/lib/api";

export function CheckoutForm({ items }: { items: { product_id: string; quantity: number }[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await checkout({
        email: String(fd.get("email")),
        shipping_name: String(fd.get("name")),
        shipping_address: {
          line1: String(fd.get("line1")),
          city: String(fd.get("city")),
          postal_code: String(fd.get("postal")),
          country: String(fd.get("country")),
        },
        items,
      });
      router.push(`/thank-you?order=${res.order_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* ...inputs... */}
      {error && <p className="text-red-600">{error}</p>}
      <button disabled={submitting}>{submitting ? "Placing…" : "Place order"}</button>
    </form>
  );
}
```

## File Organization

| What | Where |
|------|-------|
| Public storefront pages | `frontend/app/(store)/...` |
| Admin pages | `frontend/app/admin/...` |
| Reusable components | `frontend/components/` (admin-specific in `frontend/components/admin/`) |
| Types | `frontend/lib/types.ts` |
| FastAPI calls | `frontend/lib/api.ts` |
| Supabase clients | `frontend/lib/supabase/{client,server,middleware}.ts` |
| Admin gating | `frontend/middleware.ts` (matcher: `/admin/:path*`) |

## Choosing Server vs Client

Default to **Server**. Reach for `"use client"` only when the file needs:

- `useState` / `useReducer` / `useEffect` / `useContext`
- DOM event handlers (`onClick`, `onSubmit`, `onChange`)
- Browser-only APIs (`localStorage`, `window`, `IntersectionObserver`)
- A library that itself requires the client

When a page mostly renders server-fetched data but has *one* interactive widget, keep the page server and extract the widget into a Client Component file.

## Data Fetching

- Server Components: `await listProducts(...)` etc. directly. The wrapper sets `cache: "no-store"` for these dynamic admin/storefront calls; switch to `next: { revalidate: N }` per call when you want ISR
- After a mutation in a Client Component, call `router.refresh()` to re-render parent Server Components against fresh data
- Don't re-fetch the same thing in two places — fetch in the page, pass props down

## Forms

- Plain `<form onSubmit>` + `useState` is enough; do not add Formik/Zod for this MVP
- Validate required fields inline; show `ApiError.detail` for server errors
- For admin mutations, get the token from `createSupabaseBrowserClient().auth.getSession()` (or pass it down from the server-rendered parent)

## Common Tasks

### Add a Storefront Page
1. Create `frontend/app/(store)/<route>/page.tsx` as `async function` (Server Component)
2. Fetch via a typed helper from `lib/api.ts`
3. Render with Tailwind; handle empty state
4. Add `loading.tsx` / `error.tsx` siblings if the page is data-heavy

### Add an Admin Page
1. Create `frontend/app/admin/<route>/page.tsx` as a Server Component
2. Use `createSupabaseServerClient()` + `getUser()`; redirect or 403 non-admins
3. Get `session.access_token`, call `admin*` helper from `lib/api.ts`
4. For interactivity, extract a `"use client"` child component

### Add a Reusable Component
1. Decide Server vs Client (default Server)
2. Define `interface Props`
3. Tailwind for styling; match the look of existing components
4. Place in `frontend/components/` or `frontend/components/admin/`

### Add a Form
1. New `"use client"` component
2. Plain `useState` for fields, `onSubmit` handler
3. Call the appropriate `lib/api.ts` helper
4. Surface `ApiError.detail`; on success `router.push()` and/or `router.refresh()`

## Additional Resources

- For API and auth wiring details, see [../frontend-api-integration/SKILL.md](../frontend-api-integration/SKILL.md)
- For real-world examples, look at the exemplar files below

## Exemplar Files

- `frontend/app/(store)/page.tsx` — Server Component with data fetch
- `frontend/app/admin/products/page.tsx` — admin Server Component + auth check
- `frontend/components/CartProvider.tsx` — Client Context (the cart state)
- `frontend/components/AddToCartButton.tsx` — small leaf Client Component
- `frontend/components/ProductCard.tsx` — Server Component card
