# Cart and Checkout — Plan

Guest checkout — no customer account required. The cart lives in the browser, checkout posts once to the backend, which runs a transactional Postgres RPC that validates stock, snapshots prices, creates the order, decrements stock, and marks it paid (payments are mocked).

## User flows

- Product detail → **Add to cart** → redirected to `/cart` with the line visible.
- `/cart` → edit quantity (clamped to `stock`), remove items, see subtotal.
- **Checkout** → fill email + shipping form → **Place order** → redirect to `/thank-you/{orderId}`.
- Cart persists across reloads (localStorage) until order succeeds, then it's cleared.

## Frontend

- `frontend/components/CartProvider.tsx` — React context + `localStorage` (key `cart.v1`); exposes `lines`, `count`, `subtotalCents`, `add`, `setQuantity`, `remove`, `clear`.
- `frontend/components/AddToCartButton.tsx` — quantity input bounded by `product.stock`; disables when `stock === 0`.
- `frontend/components/Header.tsx` — cart count badge.
- `frontend/app/(store)/cart/page.tsx` — line-item table, subtotal, "Checkout" link.
- `frontend/app/(store)/checkout/page.tsx` — form (email, name, address), posts to `checkout()` in `lib/api.ts`, calls `clear()` on success.
- `frontend/app/(store)/thank-you/[orderId]/page.tsx` — confirmation.

## Backend

- `POST /api/orders` — `backend/app/routers/orders.py` → `services/orders.py::checkout` → calls the Supabase RPC `create_order(p_email, p_shipping_name, p_shipping_address, p_items)`.
- Response: `{ order_id, total_cents, status: "paid" }`.
- Error mapping: `insufficient_stock` → 409, `product_not_found` → 404, validation failures → 400.

## Database

- `public.create_order` (PL/pgSQL, `security definer`) in `backend/db/migrations/0001_init.sql`:
  1. Validates items non-empty and email format.
  2. Inserts an `orders` shell (`pending`).
  3. For each item: `SELECT … FOR UPDATE` on the product row, checks stock, inserts `order_items` snapshotting the price, decrements `products.stock`.
  4. Marks the order `paid` (payments mocked) and returns JSON.
- `grant execute … to service_role` — RPC only reachable from the backend.
- Shipping address stored as `jsonb` on `orders.shipping_address`.

## Depends on

- `product-catalog` — products must exist.
- `database-and-seed` — `create_order` RPC and `orders` / `order_items` tables.

## Verify

Add an item, check out with any email, and:

```bash
curl -s -H "apikey: $SVC" -H "Authorization: Bearer $SVC" \
  "$SUPABASE_URL/rest/v1/orders?select=id,email,total_cents,status&order=created_at.desc&limit=1" | jq
```

- New row exists with `status = 'paid'` and the right total.
- `stock` on the purchased product dropped by the ordered quantity.
- `order_items` has rows with `unit_price_cents` equal to the product price at purchase time.
