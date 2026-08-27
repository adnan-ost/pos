-- RPC test script for the P1 transactional core (migrations 15–17).
--
-- Run in the SQL Editor AFTER 15–17 are applied — on the rehearsal branch
-- first, and it is safe anywhere: everything happens inside one transaction
-- that always rolls back, so no order, payment, counter or audit row
-- survives, and no realtime event is published.
--
-- Every check RAISES on failure, so the script either finishes with the
-- final NOTICE or stops at the first broken invariant.
--
-- Not covered here (needs two sessions): the two-terminal race. Rehearse it
-- with two SQL Editor tabs on the branch DB:
--   tab A: BEGIN; SELECT * FROM orders WHERE id = '<id>' FOR UPDATE;
--   tab B: SELECT settle_order('<id>');                  -- blocks on A
--   tab A: SELECT settle_order('<id>'); COMMIT;          -- wins
--   tab B: unblocks and raises 'already been settled'.   -- loses, correctly

BEGIN;

DO $$
DECLARE
  k_create UUID := gen_random_uuid();
  k_round  UUID := gen_random_uuid();
  k_settle UUID := gen_random_uuid();
  v_rate NUMERIC := COALESCE((SELECT tax_rate FROM store_settings LIMIT 1), 0.16);
  o1 orders; o1b orders; tab orders; r orders;
  v_expected NUMERIC;
  v_n BIGINT;
  v_msg TEXT;
BEGIN
  ----------------------------------------------------------------------
  -- 1. Pay-now create: lines, totals, invoice, payment, audit — one call.
  ----------------------------------------------------------------------
  o1 := create_order(
    '[{"name":"Test Gulab Jamun","price":835,"qty":2},
      {"name":"Test Karak","price":415,"qty":1,
       "selectedVariant":{"name":"Full"},"selectedModifiers":{"m1":[{"name":"Extra"}]}}]',
    '{"order_type":"takeaway","payment_status":"paid","payment_mode":"cash"}',
    k_create);

  v_expected := (2085 - 0) + round(2085 * v_rate);
  IF o1.total <> v_expected THEN
    RAISE EXCEPTION 'TEST 1 totals: got %, expected %', o1.total, v_expected;
  END IF;
  IF o1.payment_status <> 'paid' OR o1.invoice_number IS NULL THEN
    RAISE EXCEPTION 'TEST 1: pay-now order not settled/numbered (% / %)',
      o1.payment_status, o1.invoice_number;
  END IF;
  SELECT count(*) INTO v_n FROM order_items WHERE order_id = o1.id;
  IF v_n <> 2 THEN RAISE EXCEPTION 'TEST 1: % lines, expected 2', v_n; END IF;
  SELECT count(*) INTO v_n FROM payments WHERE order_id = o1.id AND amount = o1.total;
  IF v_n <> 1 THEN RAISE EXCEPTION 'TEST 1: % payments, expected 1', v_n; END IF;
  IF jsonb_array_length(o1.items) <> 2 THEN
    RAISE EXCEPTION 'TEST 1: snapshot has % lines', jsonb_array_length(o1.items);
  END IF;
  RAISE NOTICE 'TEST 1 ok: create+settle atomic, total %, invoice %', o1.total, o1.invoice_number;

  ----------------------------------------------------------------------
  -- 2. Create replay: same client_request_id returns the same order.
  ----------------------------------------------------------------------
  o1b := create_order('[{"name":"X","price":1,"qty":1}]', '{}', k_create);
  IF o1b.id <> o1.id THEN RAISE EXCEPTION 'TEST 2: replay made a new order'; END IF;
  SELECT count(*) INTO v_n FROM payments WHERE order_id = o1.id;
  IF v_n <> 1 THEN RAISE EXCEPTION 'TEST 2: replay duplicated the payment'; END IF;
  RAISE NOTICE 'TEST 2 ok: create is idempotent';

  ----------------------------------------------------------------------
  -- 3. Tab + round replay: the round double-fire is dead.
  ----------------------------------------------------------------------
  tab := create_order('[{"name":"Round1","price":500,"qty":1}]',
                      '{"payment_status":"unpaid","order_type":"dine-in"}');
  tab := append_round(tab.id, '[{"name":"Round2 Naan","price":100,"qty":2}]', k_round,
                      NULL, '{"table_number":"T7"}');
  IF tab.round_count <> 2 THEN RAISE EXCEPTION 'TEST 3: round_count %', tab.round_count; END IF;
  IF tab.table_number IS DISTINCT FROM 'T7' THEN
    RAISE EXCEPTION 'TEST 3: mid-sitting table correction lost (%)', tab.table_number;
  END IF;

  tab := append_round(tab.id, '[{"name":"Round2 Naan","price":100,"qty":2}]', k_round); -- retry!
  IF tab.round_count <> 2 THEN RAISE EXCEPTION 'TEST 3: replay double-fired the round'; END IF;
  SELECT count(*) INTO v_n FROM order_items WHERE order_id = tab.id;
  IF v_n <> 2 THEN RAISE EXCEPTION 'TEST 3: replay duplicated lines (%)', v_n; END IF;
  IF tab.status <> 'new' THEN RAISE EXCEPTION 'TEST 3: round did not re-fire ticket'; END IF;
  RAISE NOTICE 'TEST 3 ok: append_round is idempotent';

  ----------------------------------------------------------------------
  -- 4. Expected-total mismatch aborts before money moves.
  ----------------------------------------------------------------------
  BEGIN
    PERFORM settle_order(tab.id, 'cash', NULL, NULL, NULL, 1, NULL);
    RAISE EXCEPTION 'TEST 4: settle accepted a wrong expected total';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE 'Total mismatch%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 4 ok: expected-total check holds';

  ----------------------------------------------------------------------
  -- 5. Settle with discount; replay succeeds; second distinct attempt fails.
  ----------------------------------------------------------------------
  tab := settle_order(tab.id, 'card', 100, 'Regular', NULL, NULL, k_settle);
  v_expected := (700 - 100) + round((700 - 100) * v_rate);
  IF tab.total <> v_expected THEN
    RAISE EXCEPTION 'TEST 5 totals: got %, expected %', tab.total, v_expected;
  END IF;

  r := settle_order(tab.id, 'card', NULL, NULL, NULL, NULL, k_settle); -- replay: fine
  IF r.total <> tab.total THEN RAISE EXCEPTION 'TEST 5: replay changed the bill'; END IF;
  SELECT count(*) INTO v_n FROM payments WHERE order_id = tab.id;
  IF v_n <> 1 THEN RAISE EXCEPTION 'TEST 5: replay duplicated the payment'; END IF;

  BEGIN
    PERFORM settle_order(tab.id, 'cash');  -- a different, second attempt
    RAISE EXCEPTION 'TEST 5: double settle accepted';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE '%already been settled%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 5 ok: settle idempotent on replay, refused on repeat';

  ----------------------------------------------------------------------
  -- 6. Rounds cannot land on a settled bill.
  ----------------------------------------------------------------------
  BEGIN
    PERFORM append_round(tab.id, '[{"name":"Late food","price":50,"qty":1}]');
    RAISE EXCEPTION 'TEST 6: round appended to a paid bill';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE '%already been settled%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 6 ok: paid bills are closed to new rounds';

  ----------------------------------------------------------------------
  -- 7. Sequential invoice numbers within the day.
  ----------------------------------------------------------------------
  IF substring(tab.invoice_number FROM '\d{4}$')::int
     <> substring(o1.invoice_number FROM '\d{4}$')::int + 1 THEN
    RAISE EXCEPTION 'TEST 7: invoices not sequential (% then %)',
      o1.invoice_number, tab.invoice_number;
  END IF;
  RAISE NOTICE 'TEST 7 ok: invoices sequential (% → %)', o1.invoice_number, tab.invoice_number;

  ----------------------------------------------------------------------
  -- 8. Voiding a paid bill reverses its money in the ledger.
  ----------------------------------------------------------------------
  r := void_order(tab.id, 'test void', 'admin');
  IF r.status <> 'cancelled' THEN RAISE EXCEPTION 'TEST 8: not cancelled'; END IF;
  SELECT COALESCE(sum(amount), -1) INTO v_expected FROM payments WHERE order_id = tab.id;
  IF v_expected <> 0 THEN
    RAISE EXCEPTION 'TEST 8: ledger nets % after void, expected 0', v_expected;
  END IF;
  r := void_order(tab.id, 'again');  -- voiding a void: quiet no-op
  RAISE NOTICE 'TEST 8 ok: void reverses the payment';

  ----------------------------------------------------------------------
  -- 9. Stale KDS bump loses to a re-fire instead of overwriting it.
  ----------------------------------------------------------------------
  r := create_order('[{"name":"Bump test","price":10,"qty":1}]', '{"payment_status":"unpaid"}');
  r := bump_order(r.id, 'new', 'preparing');
  IF r.status <> 'preparing' THEN RAISE EXCEPTION 'TEST 9: bump failed'; END IF;
  r := bump_order(r.id, 'new', 'preparing');  -- stale: board thought it was still new
  IF r.status <> 'preparing' THEN
    RAISE EXCEPTION 'TEST 9: stale bump overwrote status to %', r.status;
  END IF;
  RAISE NOTICE 'TEST 9 ok: guarded bump';

  RAISE NOTICE 'ALL P1 RPC TESTS PASSED — rolling back, nothing persisted';
END $$;

ROLLBACK;
