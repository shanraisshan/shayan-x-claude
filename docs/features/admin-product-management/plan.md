# Admin Product Management — Plan

Admin CRUD over the product catalog, including image uploads that land in a Supabase Storage bucket.

## User flows

- `/admin/products` → table of every product (active + inactive) with an Edit link.
- **New product** → form for slug, name, description, price, currency, stock, active flag, optional image. Save → POST → back to list.
- **Edit** → same form, pre-filled. PATCH only changed fields. Unchecking **Active** hides a product from the storefront without losing its order history (the product keeps its row and FKs).
- **Image upload** — pick a file → frontend POSTs multipart to FastAPI → FastAPI uploads via service-role key to `product-images` bucket → returns public URL → stored on the product row.

## Frontend

- `frontend/app/admin/products/page.tsx` — list + "New product" link.
- `frontend/app/admin/products/new/page.tsx` — create mode.
- `frontend/app/admin/products/[id]/edit/page.tsx` — edit mode.
- `frontend/components/admin/ProductForm.tsx` — shared form for both modes.
- `frontend/components/admin/useAdminToken.ts` — token for admin API calls.
- `frontend/lib/api.ts::adminListProducts / adminCreateProduct / adminUpdateProduct / adminUploadImage`.

## Backend

- `GET    /api/admin/products?q=&limit=&offset=` — includes inactive rows.
- `POST   /api/admin/products` — body `ProductCreate`; returns 201.
- `PATCH  /api/admin/products/{id}` — partial update (`ProductUpdate`, None fields skipped). Toggle `is_active` here to hide from the storefront.
- `POST   /api/admin/products/upload-image` — multipart file; type-checked (`jpeg/png/webp/gif`), 5 MB cap, random key, returns `{ url }`.

Delete is intentionally **not** exposed: products feed historical orders (via `order_items.product_id`), so we hide-via-`is_active` rather than allow row deletion.
- All routes gated by `require_admin`.
- Files: `backend/app/routers/admin.py`, `services/products.py`, `services/storage.py`.

## Database & Storage

- `public.products` — writes via service-role client (RLS allows public SELECT only).
- Supabase Storage `product-images` bucket — public read, writes via service-role. Created by the migration.

## Depends on

- `admin-auth` — all endpoints use `require_admin`.
- `database-and-seed` — `products` table + `product-images` bucket.

## Verify

1. Sign in as admin; open `/admin/products`.
2. Create a product with an image: new row appears in admin list, on public storefront (if active), image URL resolves on Supabase Storage.
3. Edit (lower the price) — change visible on the storefront.
4. Edit and uncheck **Active** — disappears from storefront, still in admin list with **Active: No**.
