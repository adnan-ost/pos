# Supabase

Everything the database side of this app needs. There is no Supabase CLI setup
here — migrations are applied by hand in the **SQL Editor** on the project
dashboard, so the numbering below *is* the apply order.

All migrations in `migrations/` have already been applied to the production
project. They're kept so the schema can be rebuilt from scratch, and so the
reasoning behind each policy stays with the SQL rather than in a chat log.

## migrations/

Run in order. Numbers reflect the order they were originally applied.

| File | What it does |
| --- | --- |
| `01_schema.sql` | Base tables: categories, menu_items, modifiers, orders, customers |
| `02_store_settings.sql` | `store_settings` — merchant name, city, Raast ID for QR payments |
| `03_enable_realtime.sql` | Adds `orders` to the realtime publication (KDS, Orders, POS tabs) |
| `04_waiters.sql` | `waiters` table for the POS waiter picker |
| `05_tabs.sql` | Open-tab support: add rounds to an order, settle at the end |
| `06_profiles.sql` | `profiles` (admin/staff role per account) and `is_admin()` |
| `07_rls_lockdown.sql` | Enables RLS on the tables left unrestricted |
| `08_role_rls.sql` | Narrows writes on config tables to admin — **needs 06 first** |
| `09_menu_images_storage.sql` | `menu-images` storage bucket + policies for photo upload |
| `10_qr_toggle.sql` | `store_settings.qr_enabled` — switch receipt QR printing on/off |
| `11_pos_operations.sql` | Voids, discounts, invoice numbers, delivery address, configurable tax rate, order indexes |
| `12_order_idempotency.sql` | `orders.client_request_id` + unique index — makes a retried checkout safe |

Two ordering constraints worth respecting if you ever rebuild:

- `08_role_rls.sql` calls `is_admin()`, so `06_profiles.sql` has to land first.
- `09_menu_images_storage.sql` creates a storage bucket, which needs the service
  role. Running it in the SQL Editor works; the app's anon/authenticated keys
  cannot create buckets.

## seed/

Optional. `01_menu.sql` is the real menu content; the other two are demo data
for exercising the Orders and KDS screens on an empty database.

| File | What it does |
| --- | --- |
| `01_menu.sql` | Categories, menu items and modifiers |
| `02_demo_orders.sql` | Sample orders for the Orders screen |
| `03_demo_kds.sql` | Sample in-progress tickets for the KDS |

## scripts/

`check_db.js` — connectivity and read check against the configured project.
Reads `.env.local`, so run it from the repository root:

```bash
node supabase/scripts/check_db.js
```

## Accounts and roles

Roles are not stored on the auth user; they're re-derived from `profiles` on
every request (see `src/lib/supabase/role.js`). The login screen has no email
field — a role toggle selects one of two shared accounts named by the
`AUTH_ADMIN_EMAIL` / `AUTH_STAFF_EMAIL` environment variables, and the PIN is
that account's password.

Granting a role to an account is a manual step, by design: `profiles` has RLS
enabled with **no write policy**, so these rows can only be managed from the SQL
Editor and never by the app.

```sql
insert into profiles (id, role)
select id, 'admin' from auth.users where email = '<admin-email>'
on conflict (id) do update set role = excluded.role;
```

PIN recovery emails are also configured here — see
**Authentication → Email Templates → Reset Password**, which must point at the
app's `/auth/confirm` route:

```
{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery
```

and **Authentication → URL Configuration**, where the deployed origin and
`http://localhost:3000/**` both need to be in Redirect URLs.
