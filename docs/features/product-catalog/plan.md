# Product Catalog — Plan

The public storefront: anonymous visitors can browse active products and open a detail page.

## User flows

- Land on `/` → grid of active products with image, name, price.
- Click a card → `/products/{slug}` shows description, stock, "Add to cart".
- Inactive products (`is_active = false`) never appear publicly.

## Frontend

- `frontend/app/(store)/layout.tsx` — wraps storefront routes with `<CartProvider>` + `<Header>`.
- `frontend/app/(store)/page.tsx` — home grid; Server Component calling `listProducts({ limit: 24 })`.
- `frontend/app/(store)/products/[slug]/page.tsx` — detail page; 404s via `notFound()` on `ApiError` 404.
- `frontend/components/ProductCard.tsx` — card used by the grid.
- `frontend/lib/api.ts` — `listProducts()`, `getProduct(slug)`, typed against `lib/types.ts`.

## Backend

- `GET  /api/products?q=&limit=&offset=` — `backend/app/routers/public.py` → `services/products.py::list_products` (filters `is_active = true`, order by `created_at desc`).
- `GET  /api/products/{slug}` — `get_product_by_slug`, 404 if not found or inactive.

## Database

- Reads `public.products` via the Supabase service-role client.
- RLS allows anon SELECT on `products` where `is_active = true`; writes denied for anon. FastAPI uses the service-role key and bypasses RLS.

## Depends on

- `database-and-seed` — `products` table + data.

## Verify

```bash
curl $API/api/products | jq '.total, .items[0].name'
```

Open `http://localhost:3000/` — grid renders; clicking any card loads `/products/<slug>` with the same data.
