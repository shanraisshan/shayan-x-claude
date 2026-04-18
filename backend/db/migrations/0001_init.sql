-- Ecommerce MVP initial schema
-- Run against a Supabase project via the SQL editor or `supabase db push`.

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_is_active_idx on public.products (is_active);
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ---------- orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  shipping_name text not null,
  shipping_address jsonb not null,
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending','paid','shipped','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_email_idx on public.orders (email);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ---------- order_items ----------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ---------- RLS ----------
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Public can read active products only
drop policy if exists "public read active products" on public.products;
create policy "public read active products"
on public.products for select
using (is_active = true);

-- No policies on orders/order_items: service-role key (used by FastAPI) bypasses RLS.
-- Admin dashboards go through FastAPI, which is trusted.

-- ---------- checkout RPC (transactional) ----------
create or replace function public.create_order(
  p_email text,
  p_shipping_name text,
  p_shipping_address jsonb,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_subtotal int := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;

  insert into public.orders (email, shipping_name, shipping_address, subtotal_cents, total_cents, status)
  values (p_email, p_shipping_name, p_shipping_address, 0, 0, 'pending')
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid_quantity';
    end if;

    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and is_active = true
    for update;

    if not found then
      raise exception 'product_not_found:%', v_item->>'product_id';
    end if;

    if v_product.stock < v_qty then
      raise exception 'insufficient_stock:%', v_product.slug;
    end if;

    insert into public.order_items (order_id, product_id, quantity, unit_price_cents)
    values (v_order_id, v_product.id, v_qty, v_product.price_cents);

    update public.products set stock = stock - v_qty where id = v_product.id;

    v_subtotal := v_subtotal + v_product.price_cents * v_qty;
  end loop;

  -- Payments mocked: mark as paid immediately.
  update public.orders
    set subtotal_cents = v_subtotal,
        total_cents = v_subtotal,
        status = 'paid'
  where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'total_cents', v_subtotal,
    'status', 'paid'
  );
end;
$$;

-- Only service-role callers should hit this RPC.
revoke all on function public.create_order(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(text, text, jsonb, jsonb) to service_role;

-- ---------- storage bucket ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
on storage.objects for select
using (bucket_id = 'product-images');
-- Writes go through service-role key from FastAPI, which bypasses RLS.
