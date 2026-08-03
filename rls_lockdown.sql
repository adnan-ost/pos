-- Lock down the tables that were left with RLS disabled ("Unrestricted"
-- in the Table Editor): categories, customers, modifiers, orders.
-- menu_items, waiters and store_settings already have policies.
--
-- Safe to run now, and only now: the app's client-side Supabase calls used
-- to go through a disconnected client that never carried the logged-in
-- session, so every browser request hit these tables as the anon role
-- regardless of login state. That has been fixed (supabaseDb.js and the
-- realtime subscriptions now use the session-aware browser client), so
-- "authenticated" below actually means "someone is logged in" rather than
-- silently locking out the app.
--
-- Run once in the Supabase SQL Editor.

-- ==================== CATEGORIES ====================
-- Read by the public /customer menu page as well as the admin app.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read categories" ON categories;
CREATE POLICY "Public read categories" ON categories
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated manage categories" ON categories;
CREATE POLICY "Authenticated manage categories" ON categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==================== MODIFIERS ====================
-- Same shape as categories: public read (customer menu + POS), no public
-- write path exists today, but staff-only writes cover it if one is added.
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read modifiers" ON modifiers;
CREATE POLICY "Public read modifiers" ON modifiers
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated manage modifiers" ON modifiers;
CREATE POLICY "Authenticated manage modifiers" ON modifiers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==================== CUSTOMERS ====================
-- PII (name, phone, spend history). No page reads this table today and
-- nothing public should ever need to — staff-only, full stop.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage customers" ON customers;
CREATE POLICY "Authenticated manage customers" ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==================== ORDERS ====================
-- Every read/write path (POS checkout, Orders, KDS, Reports) is behind
-- the app's login. No public page ever touches this table.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage orders" ON orders;
CREATE POLICY "Authenticated manage orders" ON orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
