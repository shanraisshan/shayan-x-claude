# Frontend — Next.js 15 (App Router)

The only thing end users see. Storefront is fully public; admin routes are gated by a Supabase Auth session. Server Components by default; Client Components only at the leaves that need handlers, hooks, or browser APIs. All FastAPI calls funnel through `lib/api.ts`.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- `@supabase/ssr` for browser + server clients
- React Context for cart state — no Redux, no React Query, no Formik, no Zod

## Folder Layout

```
frontend/
├── app/
│   ├── (store)/           # public storefront
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # home / product grid
│   │   ├── products/[slug]/page.tsx       # product detail
│   │   ├── cart/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── thank-you/[orderId]/page.tsx
│   ├── admin/             # gated by middleware.ts
│   │   ├── login/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # dashboard
│   │   ├── products/...                   # CRUD + image upload
│   │   └── orders/...                     # list + detail + status
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── Header.tsx
│   ├── ProductCard.tsx
│   ├── AddToCartButton.tsx
│   ├── CartProvider.tsx                   # cart context (Client)
│   └── admin/                             # admin-only components
├── lib/
│   ├── api.ts                             # typed FastAPI wrapper + ApiError
│   ├── types.ts                           # Product, Order, Cart shapes
│   └── supabase/
│       ├── client.ts                      # browser client
│       ├── server.ts                      # RSC / route handler client
│       └── middleware.ts                  # session refresh helper
└── middleware.ts                          # protects /admin/**
```

## Server vs Client Components

**Default: Server Component.** Reach for `"use client"` only when the file needs:

- `useState` / `useReducer` / `useEffect` / `useContext`
- DOM event handlers (`onClick`, `onSubmit`, `onChange`)
- Browser-only APIs (`localStorage`, `window`, `IntersectionObserver`)
- A library that itself requires the client

When a page mostly renders server-fetched data but has one interactive widget, keep the page as a Server Component and extract the widget into a Client Component file. Push `"use client"` to the leaf, never the page.

## Data Fetching (`lib/api.ts`)

Single typed surface for the FastAPI backend:

- `api<T>(path, opts)` core wrapper around `fetch`
- `ApiError(status, detail)` thrown on non-2xx
- Public helpers: `listProducts`, `getProduct`, `checkout`
- Admin helpers (require `token`): `adminListProducts`, `adminCreateProduct`, `adminUpdateProduct`, `adminUploadImage`, `adminListOrders`, `adminGetOrder`, `adminSetOrderStatus`

**Rules:**
- Never `fetch` against `NEXT_PUBLIC_API_URL` from a component or page; add a typed helper instead.
- Admin calls obtain the token from the Supabase session and pass it as the first arg.
- Wrapper sets `Content-Type: application/json` and `cache: "no-store"` for dynamic calls. Override `cache` / `next.revalidate` per call when ISR is appropriate.
- Multipart uploads bypass the JSON wrapper (see `adminUploadImage`) and let the browser set the boundary.

## Auth & Admin Gating

- `frontend/middleware.ts` runs `updateSession()` for `/admin/:path*` — keeps Supabase cookies fresh on every request and redirects unauthenticated hits to `/admin/login`.
- Server Components under `app/admin/` additionally call `await createSupabaseServerClient()` then `supabase.auth.getUser()` and verify `user?.app_metadata?.role === "admin"` server-side. Non-admins get redirect/403.
- Get the access token via `session.access_token` and pass it to the `admin*` helpers in `lib/api.ts`.
- **Never** reference `SUPABASE_SERVICE_ROLE_KEY` in this folder. That key is backend-only.

## Cart State

`components/CartProvider.tsx` — React Context, persisted to `localStorage` (key `cart.v1`). Exposes `lines`, `count`, `subtotalCents`, `add`, `setQuantity`, `remove`, `clear`. Use `useCart()` everywhere — don't roll your own cart logic.

## Storefront Flows

- Home → product grid (Server Component, `listProducts`)
- Product detail → `AddToCartButton` (Client) on a Server Component page
- Cart page → line items, qty edit (clamped to `stock`), subtotal, "Checkout" link
- Checkout → form (email + shipping) → `checkout()` → `/thank-you/{orderId}`, cart cleared

## Admin Flows

- `/admin/login` — Supabase `signInWithPassword`
- `/admin/products` — table with edit; "New product" form with image upload (multipart → backend → Storage)
- `/admin/orders` — list with status filter; detail shows items + status transitions

## Env Vars (`frontend/.env.local`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — FastAPI base URL

## Local Dev

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit
npm run build
```

## Conventions / Non-Negotiables

- Server Component by default; `"use client"` only where genuinely needed and at the leaf.
- All FastAPI calls go through `lib/api.ts`. No raw `fetch` to `NEXT_PUBLIC_API_URL` elsewhere.
- Strict TypeScript — no `any`. Shared shapes in `lib/types.ts`.
- Path aliases (`@/...`) — never `../../`.
- Handle empty / loading / error states (Suspense + `loading.tsx`, `error.tsx`, or inline guards).
- Tailwind utilities for styling; `next/image` for product images; `next/link` for nav.
- After a Client mutation, call `router.refresh()` to re-render parent Server Components against fresh data.
- Cart state through `useCart()`; don't duplicate it.
- Stack is locked: no Redux, no React Query, no Formik, no Zod, no other fetching/state libs without explicit approval.
- Never reference the Supabase service-role key here.

## Pointers

- Specialist agent: `.claude/agents/frontend-engineer.md`
- Detail skills: `.claude/skills/frontend-component-builder/SKILL.md`, `.claude/skills/frontend-api-integration/SKILL.md`
- Per-feature plans: `docs/features/*/plan.md` + `task.md`
