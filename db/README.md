# Database

Schema lives in `migrations/`. Apply to a Supabase project in this order:

1. `migrations/0001_init.sql` — tables, RLS, RPC, storage bucket
2. `seed.sql` — demo products (optional)

## Applying

Using the Supabase SQL editor: paste each file and run.

Using the Supabase CLI:

```bash
supabase db push          # if tracked as migrations
# or
psql "$DATABASE_URL" -f migrations/0001_init.sql
psql "$DATABASE_URL" -f seed.sql
```

## Granting an admin role

Customers don't log in — only admins do. After inviting an admin user via
Supabase Auth, run:

```sql
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
 where email = 'admin@example.com';
```

The backend verifies the Supabase JWT and checks `app_metadata.role == 'admin'`.
