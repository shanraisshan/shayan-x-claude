# Admin Order Management — Plan

Admin view of every order plus manual status transitions (`pending` → `paid` → `shipped`, or `cancelled`).

## User flows

- `/admin/orders` → table of all orders filterable by status; shows placed time, email, name, total, colored status badge.
- Click **View** → `/admin/orders/{id}` shows items, shipping address, customer email, status transition buttons.
- Click a status button (any except the current one) → PATCH order → badge refreshes.

## Frontend

- `frontend/app/admin/orders/page.tsx` — list + status filter dropdown; uses `adminListOrders`.
- `frontend/app/admin/orders/[id]/page.tsx` — detail with transition buttons; uses `adminGetOrder` + `adminSetOrderStatus`.
- `frontend/lib/api.ts::adminListOrders / adminGetOrder / adminSetOrderStatus`.

## Backend

- `GET   /api/admin/orders?status=&limit=&offset=` — paginated list, optional status filter.
- `GET   /api/admin/orders/{id}` — returns `OrderWithItems` (order row + its `order_items`).
- `PATCH /api/admin/orders/{id}` — body `{ status }`; returns updated row.
- All routes gated by `require_admin`.
- Files: `backend/app/routers/admin.py`, `services/orders.py`, `schemas/order.py`.

## Database

- Reads `public.orders` and `public.order_items` via service-role client.
- Status column has a `CHECK` constraint enforcing the four allowed values.
- No status-transition graph enforced by the DB — any admin can jump between statuses. Business-rule enforcement belongs in `services/orders.py::set_order_status` when needed.

## Depends on

- `admin-auth` — all endpoints use `require_admin`.
- `cart-and-checkout` — orders are produced there.

## Verify

1. Place a guest order (lands as `paid` via mocked checkout).
2. Open `/admin/orders` — row visible with **paid** badge.
3. Click through to detail — line items + address render; totals match the storefront order.
4. Click **Mark shipped** — UI and DB both reflect the change (`orders.status = 'shipped'`, `updated_at` advanced).
