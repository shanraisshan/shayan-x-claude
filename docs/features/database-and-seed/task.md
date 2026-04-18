# Database and Seed — Tasks

## Shipped
- [x] Initial migration: `products`, `orders`, `order_items`
- [x] `updated_at` trigger on `products` and `orders`
- [x] RLS policies (anon SELECT on active products; nothing else)
- [x] Indexes: `is_active`, `gin_trgm_ops(name)`, `orders(status)`, `orders(email)`, `order_items(order_id)`
- [x] `pg_trgm` + `pgcrypto` extensions
- [x] `create_order` RPC (stock lock, snapshot price, atomic)
- [x] `product-images` storage bucket + public read policy
- [x] `create_admin.sql` bootstrap helper
- [x] `seed_shirts.py` pulling real apparel from DummyJSON → upserts via REST and regenerates `seed.sql`

## Next up
- [ ] Migration tooling: wire up Supabase CLI (`supabase db push`) so migrations run from a tracked folder instead of copy/paste
- [ ] Second migration file `0002_...` pattern established
- [ ] Add `cancel_order(p_order_id)` RPC that restocks items (see `admin-order-management` tasks)
- [ ] `categories` + `product_categories` tables (see `product-catalog` tasks)

## Operational
- [ ] Weekly backup procedure documented (Supabase dashboard → Database → Backups)
- [ ] `ANALYZE` on seed refresh for query planner freshness
- [ ] Connection-pool / pooler URL captured in `.env` once Supabase exposes an IPv4-reachable endpoint for this project (currently the direct host is IPv6-only)

## Data quality
- [ ] Stock can go negative only through direct SQL; RPC protects normal path. Add a `CHECK (stock >= 0)` — already present.
- [ ] Consider `price_cents > 0` constraint (currently `>= 0` allows free products; keep if intentional)
- [ ] `email` shape validated in the RPC; could also add a domain-level check constraint
