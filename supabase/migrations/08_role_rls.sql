-- Upgrade write access on staff/business-config tables from "any signed-in
-- user" to "admin only", now that profiles_migration.sql exists and both
-- role accounts have a profiles row. Run role_rls_migration.sql only after
-- that — is_admin() depends on it.
--
-- orders and customers are deliberately untouched: both roles need full
-- read/write there for POS/Orders/KDS/customer capture to work.
--
-- Each table's policy set is declared here from scratch (not as a diff
-- against assumed existing names) because menu_items' original policies
-- were created by hand via chat-provided SQL, never committed to a file in
-- this repo — so their exact names are the only thing being assumed below.
-- If the Dashboard shows a different name for an old policy, drop it manually.
--
-- Run once in the Supabase SQL Editor.

-- ==================== CATEGORIES ====================
-- Public read stays as rls_lockdown.sql set it up; only the write half tightens.
DROP POLICY IF EXISTS "Authenticated manage categories" ON categories;
DROP POLICY IF EXISTS "Admin manage categories" ON categories;
CREATE POLICY "Admin manage categories" ON categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==================== MODIFIERS ====================
DROP POLICY IF EXISTS "Authenticated manage modifiers" ON modifiers;
DROP POLICY IF EXISTS "Admin manage modifiers" ON modifiers;
CREATE POLICY "Admin manage modifiers" ON modifiers
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==================== MENU_ITEMS ====================
-- Declared from scratch: this table's RLS was set up by hand, not from a
-- file in this repo. Original policy names, dropped here for a clean swap:
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON menu_items;
DROP POLICY IF EXISTS "Public read menu_items" ON menu_items;
CREATE POLICY "Public read menu_items" ON menu_items
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage menu_items" ON menu_items;
DROP POLICY IF EXISTS "Admin manage menu_items" ON menu_items;
CREATE POLICY "Admin manage menu_items" ON menu_items
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==================== WAITERS ====================
-- Both roles still read this (assigning a waiter at checkout); only
-- managing the staff list itself becomes admin-only.
DROP POLICY IF EXISTS "Authenticated manage waiters" ON waiters;
DROP POLICY IF EXISTS "Admin manage waiters" ON waiters;
CREATE POLICY "Admin manage waiters" ON waiters
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ==================== STORE_SETTINGS ====================
-- Both roles must keep read access: ReceiptPreview reads merchant_name/
-- raast_id for the payment QR on every printed receipt, regardless of who's
-- on the till. Only writing merchant/payment config becomes admin-only.
-- Also closes a dormant gap: no INSERT policy existed before, even though
-- updateSettings() has an insert fallback for the first-ever save.
DROP POLICY IF EXISTS "Allow authenticated read" ON store_settings;
DROP POLICY IF EXISTS "Authenticated read settings" ON store_settings;
CREATE POLICY "Authenticated read settings" ON store_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update" ON store_settings;
DROP POLICY IF EXISTS "Admin update settings" ON store_settings;
CREATE POLICY "Admin update settings" ON store_settings
  FOR UPDATE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Admin insert settings" ON store_settings;
CREATE POLICY "Admin insert settings" ON store_settings
  FOR INSERT TO authenticated WITH CHECK (is_admin());
