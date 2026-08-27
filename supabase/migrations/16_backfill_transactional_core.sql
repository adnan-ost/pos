-- P1 transactional core, part 2 of 3: backfill and prove it.
--
-- Explodes every existing order's JSONB `items` into order_rounds and
-- order_items, and writes one payments row per already-paid order. Then it
-- reconciles: row counts, item counts, and money totals must match between
-- the JSONB and the new tables or the whole transaction raises and rolls
-- back. A backfill that can't prove itself doesn't get to commit.
--
-- Rerunnable: it only touches orders that have no lines yet, so applying it
-- twice backfills nothing the second time and the checks still pass.
--
-- The JSONB shape it reads is exactly what the till writes (see
-- ModifierModal.handleConfirm and POS addToCart):
--   { id: <menu_item uuid>, name: "Chicken Karahi (Full)", price: <unit,
--     variant+modifiers included>, qty, round?, selectedVariant?: {name},
--     selectedModifiers?: {...}, ...menu item columns along for the ride }

BEGIN;

-- ==================== ROUNDS ====================

-- One row per (order, round) pair present in the JSONB. Lines that predate
-- rounds read as round 1, same as the app's itemRound() fallback. Firing
-- times: round 1 is the order's creation; the newest round is last_round_at;
-- rounds in between left null rather than invented.
INSERT INTO order_rounds (order_id, branch_id, round_no, fired_at)
SELECT
  o.id,
  o.branch_id,
  r.round_no,
  CASE
    WHEN r.round_no = 1 THEN o.created_at
    WHEN r.round_no = COALESCE(o.round_count, 1) THEN o.last_round_at
    ELSE NULL
  END
FROM orders o
CROSS JOIN LATERAL (
  SELECT DISTINCT COALESCE(NULLIF(item->>'round', '')::int, 1) AS round_no
  FROM jsonb_array_elements(o.items) AS item
) r
WHERE jsonb_typeof(o.items) = 'array'
  AND NOT EXISTS (SELECT 1 FROM order_rounds x WHERE x.order_id = o.id);

-- ==================== LINE ITEMS ====================

INSERT INTO order_items
  (order_id, round_id, branch_id, round_no, menu_item_id,
   name, variant, modifiers, unit_price, qty)
SELECT
  o.id,
  r.id,
  o.branch_id,
  COALESCE(NULLIF(item->>'round', '')::int, 1),
  -- The spread carries the menu item's id; a line whose dish has since been
  -- deleted (or whose id doesn't parse) keeps its name and loses the link.
  CASE
    WHEN (item->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         AND EXISTS (SELECT 1 FROM menu_items m WHERE m.id = (item->>'id')::uuid)
      THEN (item->>'id')::uuid
    ELSE NULL
  END,
  COALESCE(NULLIF(item->>'name', ''), 'Unknown item'),
  item->'selectedVariant'->>'name',
  NULLIF(item->'selectedModifiers', 'null'::jsonb),
  COALESCE(NULLIF(item->>'price', '')::numeric, 0),
  GREATEST(COALESCE(NULLIF(item->>'qty', '')::int, 1), 1)
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
LEFT JOIN order_rounds r
  ON r.order_id = o.id
 AND r.round_no = COALESCE(NULLIF(item->>'round', '')::int, 1)
WHERE jsonb_typeof(o.items) = 'array'
  AND NOT EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id);

-- ==================== PAYMENTS ====================

-- One synthesized tender per paid order: the full total, in the recorded
-- mode. History predating payment_mode is written as cash-or-card unknown —
-- kept honest with method 'cash' NOT assumed; instead such rows are skipped
-- and counted in reconciliation as known-unpaid-mode orders. (Reports already
-- bucket them as "unrecorded"; a ledger must not invent what the till never
-- wrote.)
INSERT INTO payments (order_id, branch_id, method, amount, paid_at)
SELECT
  o.id,
  o.branch_id,
  o.payment_mode,
  o.total,
  COALESCE(o.paid_at, o.updated_at, o.created_at)
FROM orders o
WHERE o.payment_status = 'paid'
  AND o.payment_mode IN ('cash', 'card')
  AND o.total IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id);

-- ==================== RECONCILIATION ====================

-- The gate. Counts and sums must agree or nothing above commits.
DO $$
DECLARE
  bad_orders INT;
  json_lines BIGINT;
  table_lines BIGINT;
  json_money NUMERIC;
  lines_money NUMERIC;
  paid_known INT;
  paid_rows INT;
  pay_drift NUMERIC;
BEGIN
  -- Every array-shaped order has lines.
  SELECT count(*) INTO bad_orders
  FROM orders o
  WHERE jsonb_typeof(o.items) = 'array'
    AND jsonb_array_length(o.items) > 0
    AND NOT EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id);
  IF bad_orders > 0 THEN
    RAISE EXCEPTION 'Backfill drift: % orders have JSONB items but no order_items rows', bad_orders;
  END IF;

  -- Line-for-line count.
  SELECT COALESCE(sum(jsonb_array_length(o.items)), 0) INTO json_lines
  FROM orders o WHERE jsonb_typeof(o.items) = 'array';
  SELECT count(*) INTO table_lines FROM order_items;
  IF json_lines <> table_lines THEN
    RAISE EXCEPTION 'Backfill drift: % JSONB lines vs % order_items rows', json_lines, table_lines;
  END IF;

  -- Rupee-for-rupee: Σ(price*qty) both ways. Tolerance zero — the same
  -- numbers went in, the same numbers must come out.
  SELECT COALESCE(sum(
           COALESCE(NULLIF(item->>'price','')::numeric, 0)
           * GREATEST(COALESCE(NULLIF(item->>'qty','')::int, 1), 1)), 0)
    INTO json_money
  FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
  WHERE jsonb_typeof(o.items) = 'array';
  SELECT COALESCE(sum(line_total), 0) INTO lines_money FROM order_items;
  IF json_money <> lines_money THEN
    RAISE EXCEPTION 'Backfill drift: JSONB money % vs order_items money %', json_money, lines_money;
  END IF;

  -- Every paid order with a known mode has exactly one payment of its total.
  SELECT count(*) INTO paid_known FROM orders
  WHERE payment_status = 'paid' AND payment_mode IN ('cash','card') AND total IS NOT NULL;
  SELECT count(*) INTO paid_rows FROM payments;
  IF paid_known <> paid_rows THEN
    RAISE EXCEPTION 'Backfill drift: % paid orders vs % payment rows', paid_known, paid_rows;
  END IF;

  SELECT COALESCE(sum(o.total), 0) - COALESCE((SELECT sum(amount) FROM payments), 0)
    INTO pay_drift
  FROM orders o
  WHERE o.payment_status = 'paid' AND o.payment_mode IN ('cash','card') AND o.total IS NOT NULL;
  IF pay_drift <> 0 THEN
    RAISE EXCEPTION 'Backfill drift: paid totals differ from payments by %', pay_drift;
  END IF;

  RAISE NOTICE 'Reconciliation clean: % lines, % rupees, % payments',
    table_lines, lines_money, paid_rows;
END $$;

COMMIT;
