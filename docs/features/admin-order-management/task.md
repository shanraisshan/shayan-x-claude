# Admin Order Management — Tasks

## Shipped
- [x] Admin orders list with status-filter dropdown
- [x] Order detail showing items, address, customer
- [x] Status transition buttons (any→any) with DB persistence
- [x] Colored status badges
- [x] JWT-authenticated list/detail/update endpoints

## Next up
- [ ] Enforce transition graph server-side (e.g., can't go `shipped → pending`)
- [ ] Resolve product names on detail page (currently shows `product_id` UUID; join products on the backend)
- [ ] Pagination UI for the list
- [ ] Date-range filter + search by email / order id
- [ ] CSV export of filtered list

## Cancellation flow (important)
- [ ] Cancelling an order should restock inventory atomically — add `cancel_order(p_order_id)` RPC
- [ ] Prevent cancelling `shipped` orders (or require override)

## Customer-facing
- [ ] Email customer on every status change (Resend / Postmark)
- [ ] Tracking number field + shipping carrier dropdown
- [ ] Public "track your order" page keyed by order id + email
