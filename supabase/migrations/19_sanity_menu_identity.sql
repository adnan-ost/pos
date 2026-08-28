-- Sanity menu sync, part 1 of 2: give POS dishes a stable Sanity identity.
--
-- The website (flamesbytheindus.com) authors the menu in Sanity; the till
-- keeps its own copy in menu_items and must go on working when Sanity or the
-- connection is unreachable. So the till is never a Sanity client at runtime:
-- a sync copies content down, and Supabase stays the source of truth for
-- everything the POS charges.
--
-- This migration only establishes identity. Migration 20 does the copying.
--
-- Why an id column rather than matching on name every time: order_items.
-- menu_item_id references menu_items(id), so a dish row must survive a rename
-- on the website. Matching by name would mean deleting and recreating the row
-- when the name changes, which orphans every historical line that pointed at
-- it and silently breaks per-item sales reporting.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sanity_id TEXT;

-- Deliberately NOT unique. A dish can legitimately map to more than one POS
-- row: "Channay" is one dish in Sanity, referenced from two menu sections,
-- and exists in the POS as two rows (Daal & Sabzi, and Breakfast) because a
-- POS item belongs to exactly one category. Both rows mirror the same dish
-- and should be priced together.
CREATE INDEX IF NOT EXISTS menu_items_sanity_id_idx ON menu_items (sanity_id);

-- Records what each sync did, so a price that moved can be traced to the run
-- that moved it. audit_log gets a row per changed dish as well (migration 15's
-- trigger fires on price changes); this is the run-level record.
CREATE TABLE IF NOT EXISTS menu_sync_runs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  branch_id INT NOT NULL DEFAULT 1 REFERENCES branches(id),
  applied BOOLEAN NOT NULL,
  dishes_seen INT NOT NULL DEFAULT 0,
  changed INT NOT NULL DEFAULT 0,
  held INT NOT NULL DEFAULT 0,
  unmatched INT NOT NULL DEFAULT 0,
  detail JSONB
);

CREATE INDEX IF NOT EXISTS menu_sync_runs_at_idx ON menu_sync_runs (at DESC);

ALTER TABLE menu_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read menu_sync_runs" ON menu_sync_runs;
CREATE POLICY "Admin read menu_sync_runs" ON menu_sync_runs
  FOR SELECT TO authenticated USING (is_admin());
