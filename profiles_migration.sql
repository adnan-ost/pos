-- Role-based access: who is "Admin" vs "Staff".
--
-- Two rows will ever exist here — one per shared role account, not one per
-- person (see login rework). Role is never trusted from client input; every
-- check re-derives it from this table, keyed by the authenticated user's id.
--
-- Purely additive: nothing in the app reads this table yet. Safe to run now.
-- Run once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- A user may read their own role. No write policy at all: with RLS enabled
-- and no policy for a command, that command is denied by default — these
-- rows are managed by hand in the SQL Editor, never by the app.
DROP POLICY IF EXISTS "Read own profile" ON profiles;
CREATE POLICY "Read own profile" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

-- SECURITY DEFINER isn't strictly required for the single "own row" policy
-- above, but it's the correct choice the moment profiles ever gets a second
-- policy (e.g. "admins can read all profiles") — without it, that policy
-- calling is_admin() calling this same table would recurse.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ==================== BOOTSTRAP (run after creating the two accounts) ====
-- 1. Supabase Dashboard -> Authentication -> Users -> Add user, for each:
--      - Admin: reuse your existing login account, don't create a new one.
--      - Staff: create one with email staff@flamesbytheindus.invalid and a
--        temporary password. Check "Auto Confirm User".
-- 2. Fill in the two UUIDs below (Dashboard shows each user's id) and run:
--
-- insert into profiles (id, role) values ('<admin-auth-uid>', 'admin');
-- insert into profiles (id, role) values ('<staff-auth-uid>', 'staff');
