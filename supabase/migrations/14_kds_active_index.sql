-- Makes the kitchen display's query cheap.
--
-- The board refetches on every realtime event and every 15 seconds for the
-- whole service. It used to read the entire orders table — every column,
-- including each order's full JSONB item snapshot — and filter down to the
-- live tickets in the browser, so the busiest screen in the building got
-- slower every week the till ran.
--
-- getKitchenOrders() now asks Postgres for the three active statuses only.
-- This index is the other half of that: a partial index is small because it
-- only holds rows the kitchen still has work on — a few dozen at any moment,
-- against a table that only grows — and completed orders leave it as they are
-- bumped, so it does not grow with history.
--
-- Keyed on last_round_at because that is both what the board sorts by (a round
-- added to an open tab is newly fired food) and what makes the ordering come
-- out of the index rather than a sort. orders_status_idx from migration 11
-- stays: it serves lookups for statuses this predicate excludes.

CREATE INDEX IF NOT EXISTS orders_kitchen_active_idx
  ON orders (last_round_at)
  WHERE status IN ('new', 'preparing', 'ready');
