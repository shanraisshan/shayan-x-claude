---
name: frontend-api-integration
description: Integrate with the FastAPI backend through the typed wrapper in frontend/lib/api.ts, attach Supabase JWTs for admin calls, and handle errors via ApiError. Use when adding/modifying API calls or wiring auth.
argument-hint: "[endpoint or feature]"
---

# API Integration Skill

> **Version:** 1.0 | **Working Directory:** `frontend/`

API integration patterns for **$ARGUMENTS** in the Next.js frontend.

## Overview

Single API surface, single auth flow:
- **`frontend/lib/api.ts`** — typed `fetch` wrapper, `ApiError` class, helpers per endpoint
- **`process.env.NEXT_PUBLIC_API_URL`** — base URL (no other URLs hardcoded anywhere)
- **Supabase Auth** — admin JWT obtained from the Supabase session and passed as `token` to `admin*` helpers
- **`@supabase/ssr`** — `createSupabaseServerClient()` for RSC/route handlers, `createSupabaseBrowserClient()` for Client Components

## Constitution (Non-Negotiable Rules)

| # | Rule | Why |
|---|------|-----|
| 1 | **Every backend call is a typed helper in `lib/api.ts`** — never `fetch` against `NEXT_PUBLIC_API_URL` from a component or page | One typed surface, one place to add headers/cache |
| 2 | **Admin calls require `token`** — get it from `supabase.auth.getSession()` and pass to the helper | Backend's `require_admin` checks the JWT |
| 3 | **Never hardcode the API URL** — always via `NEXT_PUBLIC_API_URL` | Environment-portable |
| 4 | **Throw `ApiError`** — non-2xx responses already throw; let it propagate or catch with `instanceof ApiError` for `detail` | Consistent error surface |
| 5 | **Strict types for request and response** — define them in `lib/types.ts`, import where used | No `any` |
| 6 | **No service-role secret on the frontend** — never reference `SUPABASE_SERVICE_ROLE_KEY` from `frontend/`; that key is backend-only | Service-role bypasses RLS |
| 7 | **Cache choice is deliberate** — admin/checkout helpers use `cache: "no-store"` (already set); use `next: { revalidate: N }` for ISR-eligible reads | Avoid stale dashboards and accidental caching of mutations |
| 8 | **Multipart goes through a dedicated helper** — `adminUploadImage` builds `FormData` and skips `Content-Type` so the browser sets the boundary | Multipart needs no manual `Content-Type` |

## When to Use

- Adding a new FastAPI endpoint to consume from the UI
- Modifying error handling for a call
- Wiring admin auth into a new admin page
- Adding a multipart upload

## Quick Start

### 1. Add a typed helper
```ts
// frontend/lib/api.ts
export function adminBulkUpdateProducts(token: string, ids: string[], patch: Partial<Product>) {
  return api<Product[]>(`/api/admin/products/bulk`, {
    method: "POST",
    token,
    body: JSON.stringify({ ids, patch }),
  });
}
```

(If new shapes are involved, define them in `frontend/lib/types.ts` first.)

### 2. Use it from a Server Component (admin)
```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminListOrders } from "@/lib/api";

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/admin/login");
  const { items } = await adminListOrders(session.access_token, { limit: 50 });
  return <OrdersTable items={items} />;
}
```

### 3. Use it from a Client Component (admin mutation)
```tsx
"use client";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { adminSetOrderStatus, ApiError } from "@/lib/api";

export function StatusDropdown({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  async function onChange(next: string) {
    const supabase = createSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      await adminSetOrderStatus(session.access_token, orderId, next);
      router.refresh();
    } catch (err) {
      alert(err instanceof ApiError ? String(err.detail) : "Update failed");
    }
  }
  return <select defaultValue={current} onChange={(e) => onChange(e.target.value)}>{/* ... */}</select>;
}
```

### 4. Public/storefront call from a Server Component
```tsx
import { listProducts } from "@/lib/api";
const { items } = await listProducts({ q, limit: 24 });
```

## Auth & Token Lifecycle

- **Sign-in / sign-out** — `frontend/app/admin/login/page.tsx` uses `createSupabaseBrowserClient()` to call `signInWithPassword` / `signOut`
- **Session refresh** — `frontend/middleware.ts` runs `updateSession()` for `/admin/:path*`, which keeps cookies fresh on every request
- **Reading the session** — server: `createSupabaseServerClient().auth.getSession()`; client: `createSupabaseBrowserClient().auth.getSession()`
- **Role check** — `user.app_metadata?.role === "admin"`; non-admins get a redirect/403 server-side
- **Never** copy the access token into `localStorage` or attach it to non-admin requests

## Cache Strategy

| Call | Cache |
|------|-------|
| Admin list/detail | `cache: "no-store"` (already set) — admins want fresh data |
| Mutations (POST/PATCH) | `cache: "no-store"` |
| Public product list/detail | `cache: "no-store"` for now; switch to `next: { revalidate: 60 }` if traffic warrants |
| After a mutation | `router.refresh()` from the Client Component to re-render server data |

## Errors

`api()` throws `ApiError(status, detail)` for non-2xx. `detail` is the parsed JSON body when the server returned JSON (FastAPI usually returns `{ "detail": "..." }`), otherwise the raw text.

```ts
try { await checkout(payload); }
catch (e) {
  if (e instanceof ApiError) {
    const msg = typeof e.detail === "object" && e.detail && "detail" in e.detail
      ? String((e.detail as { detail: unknown }).detail)
      : String(e.detail);
    setError(msg);
  } else {
    setError("Network error");
  }
}
```

In Server Components: let it bubble to the closest `error.tsx`, or catch and `notFound()` for 404s (see exemplar `app/(store)/products/[slug]/page.tsx`).

## Multipart Uploads

`adminUploadImage` is the template:
- Build `FormData`, append the file
- Bypass the JSON `api()` wrapper (it sets `Content-Type: application/json`)
- Set `Authorization` manually; let the browser set the multipart boundary
- Throw `ApiError` on non-2xx for parity

Don't add a generic multipart helper unless a second upload endpoint shows up.

## Exemplar Files

- `frontend/lib/api.ts` — every helper, `ApiError`, the `api<T>()` core
- `frontend/lib/supabase/server.ts` — RSC/route-handler client
- `frontend/lib/supabase/client.ts` — browser client
- `frontend/lib/supabase/middleware.ts` — session refresh used by `frontend/middleware.ts`
- `frontend/lib/types.ts` — request/response types
