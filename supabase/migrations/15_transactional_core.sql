-- P1 transactional core, part 1 of 3: the tables.
--
-- Orders stop being a JSONB blob with money columns and become a real
-- transactional spine: line items with identity, a payments ledger, sequential
-- invoice numbers, and an audit trail. Everything later in the roadmap —
-- shifts, inventory depletion, KOT routing, split bills, SQL reports — hangs
-- off these tables, which is why they land before any of those features.
--
-- Purely additive: nothing here changes what the running till reads or
-- writes. The JSONB `orders.items` stays, demoted to a display snapshot once
-- the RPCs (migration 17) become the only writers.
--
-- Apply order: 15 → 16 (backfill) → 17 (RPCs) → client deploy → 18 (lockdown).

-- ==================== BRANCHES ====================

-- One row today. The point is the column: every money-bearing table born
-- branchless grows a retrofit migration the week branch #2 opens, and unique
-- indexes built without branch_id have to be rebuilt. A single defaulted
-- integer now makes the second branch an INSERT instead of a schema rewrite.
CREATE TABLE IF NOT EXISTS branches (
  id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO branches (name)
SELECT 'Flames by the Indus'
WHERE NOT EXISTS (SELECT 1 FROM branches);

-- Defaulted so no existing writer has to know branches exist.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INT NOT NULL DEFAULT 1 REFERENCES branches(id);

-- ==================== ORDER ROUNDS ====================

-- One row per firing of food to the kitchen. Round 1 is the original order;
-- each append is another row. This is what makes a retried "send round" safe:
-- the same client_request_id can only ever create one round (checkout got
-- this in migration 12; rounds — the path staff use most — never did).
CREATE TABLE IF NOT EXISTS order_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  branch_id INT NOT NULL DEFAULT 1 REFERENCES branches(id),
  round_no INT NOT NULL CHECK (round_no >= 1),
  -- Nullable: rounds backfilled from history have no known firing time except
  -- the first and last.
  fired_at TIMESTAMPTZ,
  client_request_id UUID,
  UNIQUE (order_id, round_no)
);

-- Partial unique: history predates the id, and NULLs must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS order_rounds_client_request_id_key
  ON order_rounds (client_request_id) WHERE client_request_id IS NOT NULL;

-- ==================== ORDER ITEMS ====================

-- The line items. Per-item analytics, recipe depletion, station routing and
-- split-by-item all need lines with identity; none of them can be built on a
-- JSONB array, which is why this table exists before any of them do.
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  round_id UUID REFERENCES order_rounds(id) ON DELETE SET NULL,
  branch_id INT NOT NULL DEFAULT 1 REFERENCES branches(id),
  round_no INT NOT NULL DEFAULT 1,
  -- SET NULL, not CASCADE: deleting a dish from the menu must never delete it
  -- from bills already charged. The name below is the durable record.
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  -- Snapshots of what was actually sold, as charged. The name carries the
  -- variant suffix ("Chicken Karahi (Full)") exactly as the till writes it;
  -- unit_price already includes variant and modifier prices, matching the
  -- client's cart math.
  name TEXT NOT NULL,
  variant TEXT,
  modifiers JSONB,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  qty INT NOT NULL CHECK (qty > 0),
  line_total NUMERIC(12,2) GENERATED ALWAYS AS (unit_price * qty) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
-- The index per-item sales reports will lean on.
CREATE INDEX IF NOT EXISTS order_items_menu_item_idx ON order_items (menu_item_id, created_at);

-- ==================== PAYMENTS ====================

-- Money movements, one row per tender. An order paid cash is one row; a split
-- bill is several; a refund is a negative amount. Shift math in P2 sums this
-- table — `shift_id` arrives with the shifts table then, additively.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  branch_id INT NOT NULL DEFAULT 1 REFERENCES branches(id),
  method TEXT NOT NULL CHECK (method IN ('cash', 'card')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_request_id UUID
);

CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON payments (paid_at);
CREATE UNIQUE INDEX IF NOT EXISTS payments_client_request_id_key
  ON payments (client_request_id) WHERE client_request_id IS NOT NULL;

-- 'partial' joins the vocabulary for split tenders. Existing constraint, if
-- any, is by column values only — payment_status was added in migration 05
-- with no CHECK, so nothing to alter; this comment records the new value.

-- ==================== INVOICE COUNTERS ====================

-- Real invoice numbers: sequential per branch per Karachi day, assigned
-- inside settle under the row lock, stored forever. Replaces two client-side
-- generators (Date.now() slice and Math.random()) that could collide within a
-- day and were never guaranteed stored.
CREATE TABLE IF NOT EXISTS invoice_counters (
  branch_id INT NOT NULL REFERENCES branches(id),
  day DATE NOT NULL,
  last_no INT NOT NULL DEFAULT 0,
  PRIMARY KEY (branch_id, day)
);

-- ==================== AUDIT LOG ====================

-- Append-only. Written by the RPCs in the same transaction as the change they
-- record, so a logged action and its effect can never disagree. staff_id
-- stays null until P2 gives cashiers identities.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id INT NOT NULL DEFAULT 1 REFERENCES branches(id),
  action TEXT NOT NULL,
  order_id UUID,
  staff_id UUID,
  details JSONB
);

CREATE INDEX IF NOT EXISTS audit_log_order_idx ON audit_log (order_id);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);

-- Price and availability changes on the menu are audited by trigger — they
-- happen through the admin UI's direct table writes, not through the RPCs.
CREATE OR REPLACE FUNCTION log_menu_item_change() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.price IS DISTINCT FROM OLD.price)
     OR (NEW.is_available IS DISTINCT FROM OLD.is_available) THEN
    INSERT INTO audit_log (action, details)
    VALUES ('menu_item_change', jsonb_build_object(
      'menu_item_id', NEW.id,
      'name', NEW.name,
      'old_price', OLD.price, 'new_price', NEW.price,
      'old_available', OLD.is_available, 'new_available', NEW.is_available
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS menu_item_audit ON menu_items;
CREATE TRIGGER menu_item_audit
  AFTER UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION log_menu_item_change();

-- ==================== RLS ====================

-- Readable by signed-in staff; writable by nobody but the RPCs. No INSERT/
-- UPDATE/DELETE policies exist, so PostgREST writes are refused outright —
-- the SECURITY DEFINER functions in migration 17 are the only write path.
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read branches" ON branches;
CREATE POLICY "Authenticated read branches" ON branches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read order_rounds" ON order_rounds;
CREATE POLICY "Authenticated read order_rounds" ON order_rounds
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read order_items" ON order_items;
CREATE POLICY "Authenticated read order_items" ON order_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read payments" ON payments;
CREATE POLICY "Authenticated read payments" ON payments
  FOR SELECT TO authenticated USING (true);

-- Counters are internal bookkeeping; nothing in the app reads them directly.
-- Audit log reads arrive with the admin viewer; SELECT-only for admins.
DROP POLICY IF EXISTS "Admin read audit_log" ON audit_log;
CREATE POLICY "Admin read audit_log" ON audit_log
  FOR SELECT TO authenticated USING (is_admin());
