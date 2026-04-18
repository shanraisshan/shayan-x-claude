# Cart and Checkout — Tasks

## Shipped
- [x] Cart provider with `localStorage` persistence + hydration guard
- [x] Quantity clamp to `product.stock`; out-of-stock disabled
- [x] Cart page with qty edit + line remove
- [x] Checkout form (email, name, shipping address jsonb)
- [x] `POST /api/orders` wired to `create_order` RPC
- [x] Transactional RPC: stock validation with row lock, price snapshot, stock decrement, mark paid
- [x] Typed error mapping (insufficient stock → 409, not found → 404, validation → 400)
- [x] Thank-you page with order id

## Next up
- [ ] Clear stale cart lines when referenced product becomes inactive or out of stock (detect on `/cart` load)
- [ ] Inline error surface on `/cart` when backend rejects checkout due to stock (today the message lands on `/checkout`)
- [ ] Pre-submit validation: client-side format checks for email / postal code

## Payments (currently mocked)
- [ ] Decide integration path — Stripe Checkout (hosted) vs. Stripe Elements (embedded). Plan doc locks this decision as TBD.
- [ ] Split `create_order` into `reserve_order` (status=pending, stock decremented) + `confirm_order(paid)` called by webhook.
- [ ] Webhook endpoint on FastAPI that verifies Stripe signature and flips status.
- [ ] Release stock on `cancelled` via a `release_order` RPC.

## Post-order experience
- [ ] Customer email confirmation (Resend / Postmark) — triggered on `paid`
- [ ] Guest order lookup page (`/orders/lookup` — email + order id)
- [ ] Rate-limit `POST /api/orders` to defend against abuse
