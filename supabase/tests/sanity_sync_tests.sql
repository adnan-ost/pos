-- Regression tests for sync_menu_from_sanity (migrations 20–21).
--
-- Runs inside a transaction that always rolls back, so it is safe anywhere.
-- Needs an admin's uuid: the function checks is_admin(), which reads
-- auth.uid(), so a plain SQL Editor session has to impersonate one.
--
--   select id from profiles where role = 'admin' limit 1;
--
-- then substitute it below.
--
-- The first test is the one that matters. Migration 20 shipped with
-- COALESCE(d->'sizes','[]') guarding the sizes array, which does nothing when
-- Sanity sends `"sizes": null` — COALESCE replaces SQL NULL, and a JSONB null
-- is not SQL NULL. It reached production and failed with "cannot extract
-- elements from a scalar" on the first real click.
--
-- It got that far because every fixture wrote "sizes":[] explicitly and the
-- payload builder normalised nulls in JS first. The tests normalised away the
-- exact thing that breaks. So: pass JSON null through untouched, and pass one
-- dish with no sizes key at all.

BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"REPLACE-WITH-ADMIN-UUID","role":"authenticated"}';

DO $$
DECLARE
  r JSONB;
  v_changed INT;
  v_held INT;
BEGIN
  ----------------------------------------------------------------------
  -- 1. JSON null sizes, and a missing sizes key, must not crash.
  ----------------------------------------------------------------------
  r := sync_menu_from_sanity('[
    {"_id":"n1","name":"Chicken Tikka","price":1180,"sizes":null},
    {"_id":"n2","name":"Kulfi","price":255},
    {"_id":"n3","name":"Chicken Karahi","price":2355,
     "sizes":[{"label":"Half","price":2355},{"label":"Full","price":4350}]}
  ]'::jsonb);

  IF (r->>'changed')::int < 2 THEN
    RAISE EXCEPTION 'TEST 1: expected at least 2 changes, got %', r->>'changed';
  END IF;
  IF (r->>'applied')::boolean THEN
    RAISE EXCEPTION 'TEST 1: a dry run reported itself as applied';
  END IF;
  RAISE NOTICE 'TEST 1 ok: null and absent sizes handled';

  ----------------------------------------------------------------------
  -- 2. A sized dish takes the LARGEST size, never Sanity's base price.
  --    Sanity's price field is the smallest size; the POS grid shows the
  --    largest, because ModifierModal defaults to the last variant.
  ----------------------------------------------------------------------
  SELECT (x->>'new')::numeric INTO v_changed
  FROM jsonb_array_elements(r->'detail') x
  WHERE x->>'name' = 'Chicken Karahi';
  IF v_changed <> 4350 THEN
    RAISE EXCEPTION 'TEST 2: sized dish priced at % — expected the largest size 4350', v_changed;
  END IF;
  RAISE NOTICE 'TEST 2 ok: sized dish uses the largest size';

  ----------------------------------------------------------------------
  -- 3. Sized dishes are held unless explicitly asked for.
  ----------------------------------------------------------------------
  IF (r->>'held_sized')::int < 1 THEN
    RAISE EXCEPTION 'TEST 3: sized dish was not held back';
  END IF;
  RAISE NOTICE 'TEST 3 ok: sized dishes held by default';

  ----------------------------------------------------------------------
  -- 4. A name the POS spells with a parenthetical still matches.
  ----------------------------------------------------------------------
  r := sync_menu_from_sanity('[{"_id":"n4","name":"Paye","price":2620,"sizes":null}]'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'detail') x
                 WHERE x->>'name' = 'Paye (Trotters)' AND x->>'bucket' = 'changed') THEN
    RAISE EXCEPTION 'TEST 4: "Paye" did not match "Paye (Trotters)"';
  END IF;
  RAISE NOTICE 'TEST 4 ok: parenthetical name matching';

  ----------------------------------------------------------------------
  -- 5. One Sanity dish maps to every POS row of that name. "Channay" sits
  --    in two categories on the till and is one dish on the website.
  ----------------------------------------------------------------------
  r := sync_menu_from_sanity('[{"_id":"n5","name":"Channay","price":1655,"sizes":null}]'::jsonb);
  SELECT count(*) INTO v_held FROM jsonb_array_elements(r->'detail') x
  WHERE x->>'name' = 'Channay' AND x->>'bucket' = 'changed';
  IF v_held <> 2 THEN
    RAISE EXCEPTION 'TEST 5: Channay updated % rows, expected 2', v_held;
  END IF;
  RAISE NOTICE 'TEST 5 ok: one dish maps to both POS rows';

  ----------------------------------------------------------------------
  -- 6. An empty or non-array payload is refused, not silently ignored.
  ----------------------------------------------------------------------
  BEGIN
    PERFORM sync_menu_from_sanity('[]'::jsonb);
    RAISE EXCEPTION 'TEST 6: an empty menu was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%empty menu%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'TEST 6 ok: empty payload refused';

  RAISE NOTICE 'ALL SANITY SYNC TESTS PASSED — rolling back, nothing persisted';
END $$;

ROLLBACK;
