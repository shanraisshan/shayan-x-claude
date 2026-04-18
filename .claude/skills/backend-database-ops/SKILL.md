---
name: backend-database-ops
description: Supabase Postgres + Storage + Auth operations from FastAPI — service-role client, RLS-aware queries, additive SQL migrations under backend/db/migrations, the create_order RPC, and the product-images bucket. Use when adding tables/columns, writing queries, calling RPCs, or working with Storage.
argument-hint: "[table or operation]"
---

# Database Operations Skill

> **Version:** 1.0 | **Working Directory:** `backend/`

Supabase operations for **$ARGUMENTS** in this FastAPI service.

## Overview

One database, three surfaces:
- **Postgres** — `products`, `orders`, `order_items`, plus the `public.create_order` PL/pgSQL RPC
- **Storage** — `product-images` bucket (public read; writes via service-role)
- **Auth** — admin JWT verification handled by `app/auth.py` (JWKS), bootstrap is manual via the Supabase dashboard

All access from the backend uses the **service-role** client, which bypasses RLS by design (the service is the single trusted writer). Anonymous browser access is governed by RLS policies defined in the migration.

## Constitution (Non-Negotiable Rules)

| # | Rule | Why |
|---|------|-----|
| 1 | **Use `get_supabase()`** from `app.supabase_client` — never construct a client inline | One configured service-role client |
| 2 | **Multi-row atomic writes go through a Postgres function (RPC)** — checkout uses `public.create_order` | Python loops are not transactional; SQL is |
| 3 | **Schema changes ship as new files** in `backend/db/migrations/000N_<change>.sql` — never edit a shipped migration | Migrations are append-only history |
| 4 | **Public reads filter `is_active = true`** in the service when the call is for the storefront | Inactive products must not leak |
| 5 | **RLS stays restrictive** — `products` SELECT public, all writes service-role; `orders` / `order_items` no anon policies | Backend is the security boundary |
| 6 | **Storage writes use service-role**; the bucket is public-read so URLs work in the storefront without signing | Don't expose service-role to the browser |
| 7 | **Never log or return the service-role key** | Secrets stay in env / config |
| 8 | **No SQLAlchemy / Alembic / MongoDB / Redis** in this project — Supabase Postgres is the database | Don't add a second DB stack |
| 9 | **Don't widen RLS without an explicit migration + approval** | RLS changes are security-critical |
| 10 | **For data backfills, write SQL** (one-off file under `backend/db/migrations/` or a `scripts/` script that uses the service-role client) | Reviewable, replayable |

## When to Use

- Adding/altering a table or column
- Writing a Supabase query in a service
- Calling or extending the `create_order` RPC
- Uploading to or reading from Storage
- Backfilling data
- Debugging a 401/403/RLS issue or an "atomic write" race

## Quick Database Selection

There's only one — Postgres via Supabase. Use **Storage** for product images, **Auth** for admin sessions.

## Quick Reference

```python
from app.supabase_client import get_supabase

# SELECT with filter, search, pagination
sb = get_supabase()
resp = (
    sb.table("products")
      .select("*", count="exact")
      .eq("is_active", True)
      .ilike("name", f"%{q}%")
      .order("created_at", desc=True)
      .range(offset, offset + limit - 1)
      .execute()
)
items, total = resp.data or [], resp.count or 0

# INSERT / UPDATE / DELETE
sb.table("products").insert(data.model_dump()).execute()
sb.table("products").update(payload).eq("id", str(product_id)).execute()
sb.table("products").delete().eq("id", str(product_id)).execute()  # we don't expose this in the API — use is_active=false instead

# RPC (atomic checkout)
resp = sb.rpc("create_order", {
    "p_email": email,
    "p_shipping_name": shipping_name,
    "p_shipping_address": shipping_address,
    "p_items": items,
}).execute()

# Storage upload (service-role, public-read bucket)
sb.storage.from_("product-images").upload(
    path=key,
    file=file_bytes,
    file_options={"content-type": mime, "upsert": "true"},
)
public_url = sb.storage.from_("product-images").get_public_url(key)
```

## Schema Snapshot (single source: `backend/db/migrations/0001_init.sql`)

| Table | Notable columns | Notes |
|-------|-----------------|-------|
| `products` | `id uuid pk`, `slug text unique`, `name`, `price_cents int`, `image_url`, `stock`, `is_active bool`, `created_at`, `updated_at` | RLS: SELECT public when `is_active=true`; writes service-role only |
| `orders` | `id uuid pk`, `email`, `shipping_name`, `shipping_address jsonb`, `subtotal_cents`, `total_cents`, `status text check ('pending','paid','shipped','cancelled')` | RLS: no anon policies |
| `order_items` | `id`, `order_id fk`, `product_id fk`, `quantity int`, `unit_price_cents int` | Snapshot price at purchase; RLS: no anon policies |

Function:
- `public.create_order(p_email, p_shipping_name, p_shipping_address, p_items)` — locks affected `products` rows, validates stock, inserts the order + items, decrements stock, marks the order `paid`, returns `{order_id, total_cents, status}`.

## Migrations

Migrations are plain SQL files in `backend/db/migrations/`, applied in order. There's no migration tool wired in for this MVP — files are run manually against Supabase via the SQL editor or `psql`.

### Rules

| Rule | Why |
|------|-----|
| **One concern per file** — schema vs data, not mixed | Easier to roll forward / back |
| **Filename: `000N_<change>.sql`** continuing from `0001_init.sql` | Order is preserved |
| **Additive on populated tables** — add nullable column → backfill → enforce in a follow-up migration | Avoids downtime / breakage |
| **Wrap in a transaction** when changes span multiple statements that must succeed together | Atomicity |
| **Update RLS in the same migration that adds the table** | Don't ship a table with no policies and forget |
| **Never edit a shipped migration** | Replays must be deterministic |

### Add a column (template)

```sql
-- backend/db/migrations/0002_add_product_brand.sql
begin;

alter table public.products
  add column if not exists brand text;

create index if not exists products_brand_idx on public.products(brand);

commit;
```

### Modify the `create_order` RPC (template)

```sql
-- backend/db/migrations/000N_update_create_order.sql
begin;

create or replace function public.create_order(
  p_email text,
  p_shipping_name text,
  p_shipping_address jsonb,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  -- ... (mirror the existing fn structure: lock rows, validate stock, insert, decrement, set status='paid')
begin
  -- body
end;
$$;

commit;
```
The RPC is `security definer` so it runs with the function owner's privileges — that's how anonymous checkout writes orders/items even though `orders` has no anon RLS policies. Don't change `security` semantics without explicit approval.

### Backfill (data migration, template)

```sql
-- backend/db/migrations/000N_backfill_brand.sql
begin;

update public.products
   set brand = split_part(name, ' ', 1)
 where brand is null;

commit;
```

For large tables, batch in chunks; for now we have small data so a single statement is fine.

### Run a migration locally

```bash
# preferred — Supabase SQL editor (paste the file, run)
# or, with the Postgres connection string from the Supabase dashboard:
psql "$SUPABASE_DB_URL" -f backend/db/migrations/0002_add_product_brand.sql
```

## Storage

Bucket: `product-images` (public read).

```python
# backend/app/services/storage.py — exemplar
def upload_product_image(file: UploadFile) -> str:
    sb = get_supabase()
    key = f"{uuid4()}-{file.filename}"
    sb.storage.from_("product-images").upload(
        path=key,
        file=file.file.read(),
        file_options={"content-type": file.content_type or "application/octet-stream", "upsert": "true"},
    )
    return sb.storage.from_("product-images").get_public_url(key)
```

Rules:
- Generate a non-guessable key (UUID prefix) so users can't enumerate
- Store the returned public URL on `products.image_url`
- For deletion, also remove the storage object (when the admin replaces an image)

## RLS Quick Reference

- **`products`** — `SELECT` allowed for `anon` when `is_active = true`; `INSERT/UPDATE/DELETE` denied for `anon` (service-role bypasses)
- **`orders`, `order_items`** — no `anon` policies; only service-role and the `security definer` `create_order` function can write

If a query unexpectedly returns 0 rows or 401/403 from the anon side, RLS is almost always the cause. From the backend (service-role) it should never matter — if it does, you're using the wrong client.

## Common Bugs

- **Stock overdraft on checkout** → service did multi-step Python writes instead of calling `create_order`. Fix: call the RPC.
- **Inactive product in storefront** → service forgot `.eq("is_active", True)`. Fix: add the filter; consider adding a service helper that always applies it for public reads.
- **Image upload 403** → service-role client not initialized (env vars missing) or bucket name typo. Fix: check `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL`.
- **Migration applied twice** → you edited a shipped file. Don't. Add a new file.
- **Anon write to `orders` works (somehow)** → an anon RLS policy was added by mistake. Audit policies; remove via a new migration.

## Common Tasks

### Add a column to `products`
1. Write `backend/db/migrations/000N_<change>.sql` (additive)
2. Update `app/schemas/product.py` to include the field (optional on `ProductCreate` if backfilling)
3. Update services that read/write the column
4. Run the migration against your Supabase project

### Add a new table
1. New migration file: `create table`, indexes, RLS policies (default to anon-deny), comments
2. Schema in `app/schemas/`
3. Service in `app/services/`
4. Router endpoint(s) in the right `routers/*.py`
5. Register router if it's a new file

### Change the checkout flow
1. Write a migration that `create or replace function public.create_order(...)`
2. Update `app/services/orders.py` if input/output shape changes
3. Update `app/schemas/order.py` to mirror the new shape
4. Test end-to-end: cart → checkout → row in `orders`, `order_items`, stock decremented

### Backfill data
1. New migration file with the `update`/`insert`
2. For repeatable scripts that aren't migrations (e.g., importing seed data), use `backend/scripts/` (see `seed_shirts.py`) and the service-role client

## Exemplar Files

- `backend/db/migrations/0001_init.sql` — schema + RLS + RPC
- `backend/db/seed.sql` — seed data
- `backend/app/supabase_client.py` — service-role client factory
- `backend/app/services/products.py` — query + write patterns
- `backend/app/services/orders.py` — RPC call
- `backend/app/services/storage.py` — Storage upload
- `backend/scripts/seed_shirts.py` — data import via service-role
