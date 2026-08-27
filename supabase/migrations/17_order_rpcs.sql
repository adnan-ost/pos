-- P1 transactional core, part 3 of 3: the RPCs.
--
-- Every write that moves food or money becomes one SECURITY DEFINER function
-- running in one transaction under one row lock. Totals are recomputed
-- server-side from order_items every time; the client's displayed total is
-- accepted only as a cross-check (p_expected_total) and a mismatch aborts.
-- Each function is idempotent through a client_request_id, so a till that
-- times out retries safely — the reply is the order as it already is.
--
-- Defects this layer retires: the round double-fire (the audit's last open
-- CRITICAL), two terminals settling one tab, non-atomic settle, phantom and
-- duplicate invoice numbers, client-trusted totals, the KDS bump/re-fire race.
--
-- What it deliberately does NOT do yet: reprice lines from the menu (variant
-- and modifier prices live in menu JSONB config; repricing lands with P2's
-- permission checks) and staff attribution (audit_log.staff_id waits for P2).
--
-- The till keeps its direct writes until the client deploy converts it to
-- these functions; migration 18 then removes the direct write path. Nothing
-- breaks in between — this file only adds.

-- ==================== INTERNALS ====================

-- The one place money math lives on the server. Mirrors calcTotals() in
-- src/lib/orderTotals.js exactly: discount off the subtotal first, clamped to
-- [0, subtotal]; tax on the remainder, rounded to the rupee (round-half-up,
-- same as JS Math.round for positive amounts); total = taxable + tax.
CREATE OR REPLACE FUNCTION _recompute_order(p_order_id UUID)
RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rate NUMERIC;
  v_subtotal NUMERIC;
  v_order orders;
  v_discount NUMERIC;
  v_taxable NUMERIC;
  v_tax NUMERIC;
  v_snapshot JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  v_rate := COALESCE((SELECT tax_rate FROM store_settings LIMIT 1), 0.16);

  SELECT COALESCE(sum(line_total), 0) INTO v_subtotal
  FROM order_items WHERE order_id = p_order_id;

  v_discount := LEAST(GREATEST(COALESCE(v_order.discount, 0), 0), v_subtotal);
  v_taxable := v_subtotal - v_discount;
  v_tax := CASE WHEN COALESCE(v_order.include_tax, true)
                THEN round(v_taxable * v_rate) ELSE 0 END;

  -- The JSONB snapshot the KDS and receipts read, rebuilt from the lines so
  -- the two can never disagree. Shape matches what the till used to write.
  SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', oi.menu_item_id,
           'name', oi.name,
           'price', oi.unit_price,
           'qty', oi.qty,
           'round', oi.round_no,
           'selectedVariant', CASE WHEN oi.variant IS NULL THEN NULL
                                   ELSE jsonb_build_object('name', oi.variant) END,
           'selectedModifiers', oi.modifiers,
           'notes', oi.notes
         )) ORDER BY oi.round_no, oi.created_at), '[]'::jsonb)
    INTO v_snapshot
  FROM order_items oi WHERE oi.order_id = p_order_id;

  UPDATE orders SET
    items = v_snapshot,
    subtotal = v_subtotal,
    discount = v_discount,   -- written even at zero: a bill priced back to no
                             -- discount must not keep asserting the old one
    tax = v_tax,
    total = v_taxable + v_tax,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END $$;

-- Validates and inserts one round's lines. Create and append share this so
-- the two paths cannot drift. Errors are worded for the till's alert box.
CREATE OR REPLACE FUNCTION _insert_round_items(
  p_order_id UUID, p_round_id UUID, p_round_no INT, p_branch_id INT, p_items JSONB)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
  item JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A round needs at least one item';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE(NULLIF(item->>'name', ''), '') = '' THEN
      RAISE EXCEPTION 'Every line needs an item name';
    END IF;
    IF COALESCE((item->>'qty')::int, 0) < 1 THEN
      RAISE EXCEPTION 'Quantity must be at least 1 on "%"', item->>'name';
    END IF;
    IF COALESCE((item->>'price')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Price missing or negative on "%"', item->>'name';
    END IF;
  END LOOP;

  INSERT INTO order_items
    (order_id, round_id, branch_id, round_no, menu_item_id,
     name, variant, modifiers, unit_price, qty, notes)
  SELECT
    p_order_id, p_round_id, p_branch_id, p_round_no,
    -- The cart spreads the menu item, so its uuid rides in as 'id'. A line
    -- whose dish was deleted (or whose id doesn't parse) keeps the name and
    -- loses the link — the bill is the record, the FK is a convenience.
    CASE
      WHEN (i->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND EXISTS (SELECT 1 FROM menu_items m WHERE m.id = (i->>'id')::uuid)
        THEN (i->>'id')::uuid
      ELSE NULL
    END,
    i->>'name',
    i->'selectedVariant'->>'name',
    NULLIF(i->'selectedModifiers', 'null'::jsonb),
    (i->>'price')::numeric,
    (i->>'qty')::int,
    NULLIF(i->>'notes', '')
  FROM jsonb_array_elements(p_items) AS i;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ==================== SETTLE ====================

-- Defined before create_order only for reading order; resolution happens at
-- call time either way.
CREATE OR REPLACE FUNCTION settle_order(
  p_order_id UUID,
  p_method TEXT DEFAULT 'cash',
  p_discount NUMERIC DEFAULT NULL,
  p_discount_reason TEXT DEFAULT NULL,
  p_include_tax BOOLEAN DEFAULT NULL,
  p_expected_total NUMERIC DEFAULT NULL,
  p_client_request_id UUID DEFAULT NULL
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders;
  v_day DATE;
  v_no INT;
BEGIN
  IF p_method NOT IN ('cash', 'card') THEN
    RAISE EXCEPTION 'Unknown payment method %', p_method;
  END IF;

  -- The lock: of two terminals settling the same tab, one wins and the other
  -- learns the truth instead of both charging the customer.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'This order was voided.';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    -- A replay of the settle that already succeeded is a success; a second,
    -- distinct attempt is the double-charge this function exists to refuse.
    IF p_client_request_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM payments
      WHERE order_id = p_order_id AND client_request_id = p_client_request_id
    ) THEN
      RETURN v_order;
    END IF;
    RAISE EXCEPTION 'This bill has already been settled.';
  END IF;

  UPDATE orders SET
    include_tax = COALESCE(p_include_tax, include_tax, true),
    discount = COALESCE(p_discount, discount, 0),
    discount_reason = CASE
      WHEN COALESCE(p_discount, discount, 0) > 0
        THEN COALESCE(p_discount_reason, discount_reason)
      ELSE NULL
    END
  WHERE id = p_order_id;

  v_order := _recompute_order(p_order_id);

  IF p_expected_total IS NOT NULL AND p_expected_total <> v_order.total THEN
    RAISE EXCEPTION 'Total mismatch: till shows %, server computed % — reload before settling',
      p_expected_total, v_order.total;
  END IF;

  -- Sequential invoice number per branch per Karachi day, assigned exactly
  -- once — a bill that already carries one keeps it, so a reprint is the
  -- same document forever.
  IF v_order.invoice_number IS NULL THEN
    v_day := (now() AT TIME ZONE 'Asia/Karachi')::date;
    INSERT INTO invoice_counters (branch_id, day, last_no)
    VALUES (v_order.branch_id, v_day, 1)
    ON CONFLICT (branch_id, day)
    DO UPDATE SET last_no = invoice_counters.last_no + 1
    RETURNING last_no INTO v_no;

    UPDATE orders
    SET invoice_number = 'FBR-' || to_char(v_day, 'YYMMDD') || '-' || lpad(v_no::text, 4, '0')
    WHERE id = p_order_id;
  END IF;

  INSERT INTO payments (order_id, branch_id, method, amount, client_request_id)
  VALUES (p_order_id, v_order.branch_id, p_method, v_order.total, p_client_request_id);

  UPDATE orders SET
    payment_status = 'paid',
    payment_mode = p_method,
    paid_at = now(),
    status = CASE WHEN status = 'ready' THEN 'completed' ELSE status END,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO audit_log (branch_id, action, order_id, details)
  VALUES (v_order.branch_id, 'settle_order', p_order_id,
          jsonb_build_object('method', p_method, 'total', v_order.total,
                             'invoice', v_order.invoice_number));

  RETURN v_order;
END $$;

-- ==================== CREATE ORDER ====================

-- One call: order row, round 1, its lines, recomputed totals — and for a
-- pay-at-counter sale, the payment and invoice number too, all or nothing.
CREATE OR REPLACE FUNCTION create_order(
  p_items JSONB,
  p_opts JSONB DEFAULT '{}'::jsonb,
  p_client_request_id UUID DEFAULT NULL,
  p_expected_total NUMERIC DEFAULT NULL
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders;
  v_round_id UUID;
  v_pay_now BOOLEAN := COALESCE(p_opts->>'payment_status', 'paid') = 'paid';
BEGIN
  -- Idempotent replay: the same attempt returns the order it already made,
  -- indistinguishable from the first success. DO-NOTHING semantics — never
  -- touch a ticket the kitchen may already be cooking. The ON CONFLICT on
  -- the INSERT below covers the concurrent case this pre-check can't: two
  -- identical attempts in flight at once (a double-tap under latency).
  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_order FROM orders WHERE client_request_id = p_client_request_id;
    IF FOUND THEN RETURN v_order; END IF;
  END IF;

  -- Born unpaid; the pay-now path settles two statements down, inside this
  -- same transaction. order_number stays the client's human-readable id —
  -- the invoice number minted at settle is the real identity.
  INSERT INTO orders
    (order_number, items, subtotal, tax, total, status, payment_status,
     order_type, include_tax, discount, discount_reason,
     table_number, waiter_id, waiter_name,
     customer_name, customer_phone, customer_address,
     round_count, last_round_at, client_request_id, created_at, updated_at)
  VALUES
    (COALESCE(NULLIF(p_opts->>'order_number', ''), lpad((floor(random() * 1000000))::int::text, 6, '0')),
     '[]'::jsonb, 0, 0, 0,
     'new',
     'unpaid',
     COALESCE(NULLIF(p_opts->>'order_type', ''), 'dine-in'),
     COALESCE((p_opts->>'include_tax')::boolean, true),
     COALESCE((p_opts->>'discount')::numeric, 0),
     NULLIF(p_opts->>'discount_reason', ''),
     NULLIF(p_opts->>'table_number', ''),
     NULLIF(p_opts->>'waiter_id', '')::uuid,
     NULLIF(p_opts->>'waiter_name', ''),
     NULLIF(p_opts->>'customer_name', ''),
     NULLIF(p_opts->>'customer_phone', ''),
     NULLIF(p_opts->>'customer_address', ''),
     1, now(), p_client_request_id, now(), now())
  ON CONFLICT (client_request_id) DO NOTHING
  RETURNING * INTO v_order;

  -- Lost the race to our own twin: the other attempt's order is the order.
  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM orders WHERE client_request_id = p_client_request_id;
    RETURN v_order;
  END IF;

  INSERT INTO order_rounds (order_id, branch_id, round_no, fired_at, client_request_id)
  VALUES (v_order.id, v_order.branch_id, 1, now(), p_client_request_id)
  RETURNING id INTO v_round_id;

  PERFORM _insert_round_items(v_order.id, v_round_id, 1, v_order.branch_id, p_items);
  v_order := _recompute_order(v_order.id);

  INSERT INTO audit_log (branch_id, action, order_id, details)
  VALUES (v_order.branch_id, 'create_order', v_order.id,
          jsonb_build_object('total', v_order.total, 'type', v_order.order_type));

  IF v_pay_now THEN
    -- Same-transaction settle; the expected-total check happens there.
    v_order := settle_order(
      v_order.id,
      COALESCE(NULLIF(p_opts->>'payment_mode', ''), 'cash'),
      NULL, NULL, NULL,
      p_expected_total,
      p_client_request_id);
  ELSIF p_expected_total IS NOT NULL AND p_expected_total <> v_order.total THEN
    RAISE EXCEPTION 'Total mismatch: till shows %, server computed % — reload and re-ring',
      p_expected_total, v_order.total;
  END IF;

  RETURN v_order;
END $$;

-- ==================== APPEND ROUND ====================

CREATE OR REPLACE FUNCTION append_round(
  p_order_id UUID,
  p_items JSONB,
  p_client_request_id UUID DEFAULT NULL,
  p_expected_total NUMERIC DEFAULT NULL,
  -- Mid-sitting corrections the floor makes while adding food: table moved,
  -- shift changed the waiter, tax toggled. Only these keys are honoured.
  p_opts JSONB DEFAULT '{}'::jsonb
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders;
  v_round_no INT;
  v_round_id UUID;
BEGIN
  -- Replay of a round that already landed: hand back the order as it is.
  -- This is the fix for the audit's last CRITICAL — a timed-out "send round"
  -- retried by the cashier used to cook and bill the food twice.
  IF p_client_request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM order_rounds WHERE client_request_id = p_client_request_id
  ) THEN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    RETURN v_order;
  END IF;

  -- The lock. Two terminals appending to one tab now queue instead of
  -- last-write-wins overwriting each other's items array.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Re-checked under the lock: a twin of this request that held the lock
  -- first has committed its round by the time we get here, and the pre-lock
  -- check above ran too early to see it.
  IF p_client_request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM order_rounds WHERE client_request_id = p_client_request_id
  ) THEN
    RETURN v_order;
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'This bill has already been settled.';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'This order was voided.';
  END IF;

  v_round_no := COALESCE(v_order.round_count, 1) + 1;

  INSERT INTO order_rounds (order_id, branch_id, round_no, fired_at, client_request_id)
  VALUES (p_order_id, v_order.branch_id, v_round_no, now(), p_client_request_id)
  RETURNING id INTO v_round_id;

  PERFORM _insert_round_items(p_order_id, v_round_id, v_round_no, v_order.branch_id, p_items);

  UPDATE orders SET
    round_count = v_round_no,
    last_round_at = now(),
    status = 'new',           -- back to the top of the kitchen board
    include_tax = COALESCE((p_opts->>'include_tax')::boolean, include_tax),
    table_number = CASE WHEN p_opts ? 'table_number'
                        THEN NULLIF(p_opts->>'table_number', '') ELSE table_number END,
    waiter_id = CASE WHEN p_opts ? 'waiter_id'
                     THEN NULLIF(p_opts->>'waiter_id', '')::uuid ELSE waiter_id END,
    waiter_name = CASE WHEN p_opts ? 'waiter_name'
                       THEN NULLIF(p_opts->>'waiter_name', '') ELSE waiter_name END
  WHERE id = p_order_id;

  v_order := _recompute_order(p_order_id);

  IF p_expected_total IS NOT NULL AND p_expected_total <> v_order.total THEN
    RAISE EXCEPTION 'Total mismatch: till shows %, server computed % — reload and re-ring',
      p_expected_total, v_order.total;
  END IF;

  INSERT INTO audit_log (branch_id, action, order_id, details)
  VALUES (v_order.branch_id, 'append_round', p_order_id,
          jsonb_build_object('round', v_round_no, 'total', v_order.total));

  RETURN v_order;
END $$;

-- ==================== VOID ====================

CREATE OR REPLACE FUNCTION void_order(
  p_order_id UUID,
  p_reason TEXT,
  p_by TEXT DEFAULT NULL
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A void needs a reason';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN v_order; -- voiding a void is a no-op, not an error
  END IF;

  -- Voiding a bill that was already paid reverses the money in the ledger,
  -- so the day's cash math nets to what is actually in the drawer.
  IF v_order.payment_status = 'paid' AND v_order.payment_mode IN ('cash', 'card') THEN
    INSERT INTO payments (order_id, branch_id, method, amount)
    VALUES (p_order_id, v_order.branch_id, v_order.payment_mode, -v_order.total);
  END IF;

  UPDATE orders SET
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = btrim(p_reason),
    cancelled_by = NULLIF(btrim(COALESCE(p_by, '')), ''),
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO audit_log (branch_id, action, order_id, details)
  VALUES (v_order.branch_id, 'void_order', p_order_id,
          jsonb_build_object('reason', v_order.cancel_reason, 'by', v_order.cancelled_by,
                             'was_paid', v_order.paid_at IS NOT NULL, 'total', v_order.total));

  RETURN v_order;
END $$;

-- ==================== KDS BUMP ====================

-- Guarded transition instead of a blind status write. A bump races an
-- append_round re-fire today: the append sets status back to 'new' for the
-- new food, and an unguarded bump then parks the ticket in 'ready' with a
-- round nobody will cook. The WHERE clause makes the stale bump lose.
CREATE OR REPLACE FUNCTION bump_order(
  p_order_id UUID,
  p_from TEXT,
  p_to TEXT
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders;
BEGIN
  IF p_to NOT IN ('preparing', 'ready', 'completed') THEN
    RAISE EXCEPTION 'Not a kitchen transition: %', p_to;
  END IF;

  UPDATE orders SET status = p_to, updated_at = now()
  WHERE id = p_order_id AND status = p_from
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    -- Someone else moved it first (or a round re-fired it). Return the truth;
    -- the board redraws from it instead of overwriting it.
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order % not found', p_order_id;
    END IF;
  END IF;

  RETURN v_order;
END $$;

-- ==================== GRANTS ====================

-- Postgres grants EXECUTE to PUBLIC on new functions by default; strip that
-- first, then hand the five verbs to signed-in staff only. The internals are
-- callable by nobody but the verbs themselves (SECURITY DEFINER runs as
-- owner, which retains its own rights).
REVOKE ALL ON FUNCTION _recompute_order(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION _insert_round_items(UUID, UUID, INT, INT, JSONB) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION create_order(JSONB, JSONB, UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION append_round(UUID, JSONB, UUID, NUMERIC, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION settle_order(UUID, TEXT, NUMERIC, TEXT, BOOLEAN, NUMERIC, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION void_order(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION bump_order(UUID, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION create_order(JSONB, JSONB, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION append_round(UUID, JSONB, UUID, NUMERIC, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION settle_order(UUID, TEXT, NUMERIC, TEXT, BOOLEAN, NUMERIC, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION void_order(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bump_order(UUID, TEXT, TEXT) TO authenticated;
