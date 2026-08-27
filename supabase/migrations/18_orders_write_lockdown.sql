-- P1 epilogue: close the direct write path to orders.
--
-- ⚠️  DO NOT run this with 15–17. It goes in ONLY after the client deploy
-- that converts supabaseDb.js to the RPCs is live and verified in service —
-- until then the till still writes orders directly, and this would stop
-- the restaurant.
--
-- Before this migration, "Authenticated manage orders" (07_rls_lockdown)
-- granted every signed-in account full INSERT/UPDATE/DELETE on orders, which
-- meant the admin-only void gate — and every total — was enforced in the
-- browser only. After it, staff read orders; the SECURITY DEFINER functions
-- from migration 17 are the only way food or money moves.
--
-- Rollback, if service breaks and the old client must come back:
--   DROP POLICY IF EXISTS "Authenticated read orders" ON orders;
--   CREATE POLICY "Authenticated manage orders" ON orders
--     FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated manage orders" ON orders;

CREATE POLICY "Authenticated read orders" ON orders
  FOR SELECT TO authenticated USING (true);
