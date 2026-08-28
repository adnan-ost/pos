-- Sanity menu sync, part 2 of 2: the sync itself.
--
-- One function. The caller fetches the dishes from Sanity (the dataset is
-- public, so this needs no API token anywhere) and hands them over as JSON;
-- everything else — matching, diffing, writing, auditing — happens here in
-- one transaction.
--
-- Dry run by default. sync_menu_from_sanity(payload) reports what WOULD
-- change and writes nothing but a run record. Only sync_menu_from_sanity(
-- payload, p_apply => true) writes prices.
--
-- ==================== WHAT SANITY OWNS, AND WHAT IT DOES NOT ====================
--
-- Copied down     : price, sizes -> variants, description.
-- Never touched   : is_available, modifiers, category_id, image, name.
--
-- is_available is the important one. When the kitchen runs out of mutton at
-- 9pm and the floor switches the dish off at the till, Sanity has no idea —
-- a sync that "corrected" that flag would put a sold-out dish back on the
-- menu mid-service. Same reasoning for category_id: the website groups dishes
-- into 20 sections mirroring Blink's structure, the till has its own 17
-- categories tuned for the grid, and reshuffling the till's layout is a
-- decision for a human, not a side effect of a price change.
--
-- name is not copied because it is the fallback matching key. A dish renamed
-- on the website keeps its POS name until someone renames it there too; the
-- sanity_id binding means the price still follows correctly.
--
-- ==================== SIZED DISHES ====================
--
-- p_apply_sized defaults to false, which holds back any dish that has sizes
-- in Sanity or variants in the POS, reporting it instead of writing it.
--
-- This exists because the two systems disagree about what the base price
-- means: the POS treats menu_items.price as the DEFAULT variant (the largest,
-- since ModifierModal picks the last one), while Sanity's price field is the
-- SMALLEST size. Writing one into the other would quietly reprice every
-- karahi to its half price. Until a sized dish's full set of prices is
-- confirmed, price and variants have to move together or not at all.

CREATE OR REPLACE FUNCTION sync_menu_from_sanity(
  p_dishes JSONB,
  p_apply BOOLEAN DEFAULT false,
  p_apply_sized BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_detail JSONB;
  v_seen INT;
  v_changed INT := 0;
  v_held INT := 0;
  v_unmatched INT := 0;
  v_bound INT := 0;
  r RECORD;
BEGIN
  -- SECURITY DEFINER runs as the owner and bypasses RLS, so the admin-only
  -- rule that migration 08 puts on menu_items has to be restated here. Without
  -- it, anyone holding the shared staff PIN could reprice the entire menu.
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only an admin can sync the menu';
  END IF;

  IF p_dishes IS NULL OR jsonb_typeof(p_dishes) <> 'array' OR jsonb_array_length(p_dishes) = 0 THEN
    RAISE EXCEPTION 'No dishes supplied — refusing to sync an empty menu';
  END IF;
  v_seen := jsonb_array_length(p_dishes);

  -- A payload far smaller than the menu almost certainly means a failed or
  -- truncated fetch, and applying it would look like "most dishes vanished".
  -- Nothing is deleted by this function, but a partial payload would still
  -- silently skip dishes, so refuse it outright.
  IF p_apply AND v_seen < (SELECT count(*) FROM menu_items) / 2 THEN
    RAISE EXCEPTION 'Payload has % dishes but the menu has % — refusing a partial sync',
      v_seen, (SELECT count(*) FROM menu_items);
  END IF;

  CREATE TEMP TABLE _incoming ON COMMIT DROP AS
  SELECT
    d->>'_id'                                    AS sanity_id,
    d->>'name'                                   AS name,
    NULLIF(d->>'description', '')                AS description,
    (d->>'price')::numeric                       AS price,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('name', s->>'label', 'price', (s->>'price')::numeric)
                        ORDER BY (s->>'price')::numeric)
       FROM jsonb_array_elements(COALESCE(d->'sizes', '[]'::jsonb)) s),
      '[]'::jsonb)                               AS variants
  FROM jsonb_array_elements(p_dishes) d
  WHERE COALESCE(NULLIF(d->>'name', ''), '') <> ''
    AND (d->>'price') ~ '^[0-9]+(\.[0-9]+)?$';

  -- Matching, computed but not yet persisted.
  --
  -- Three passes, most trustworthy first: an existing binding, then an exact
  -- name, then a name whose POS spelling carries a parenthetical the website
  -- drops ("Paye (Trotters)" against "Paye"). The last only fires when it
  -- leaves exactly one candidate, so an ambiguous pair is reported rather
  -- than guessed at.
  --
  -- Deliberately a temp table rather than an UPDATE: a dry run must write
  -- nothing, and binding sanity_id is a write like any other. It is persisted
  -- further down, only when p_apply is true.
  CREATE TEMP TABLE _match ON COMMIT DROP AS
  SELECT m.id AS pos_id,
         COALESCE(
           m.sanity_id,
           (SELECT i.sanity_id FROM _incoming i
             WHERE lower(btrim(i.name)) = lower(btrim(m.name)) LIMIT 1),
           (SELECT i.sanity_id FROM _incoming i
             WHERE lower(btrim(i.name)) = lower(btrim(regexp_replace(m.name, '\s*\([^)]*\)\s*$', '')))
               AND (SELECT count(*) FROM menu_items m2
                     WHERE lower(btrim(regexp_replace(m2.name, '\s*\([^)]*\)\s*$', '')))
                           = lower(btrim(i.name))) = 1
             LIMIT 1)
         ) AS sanity_id,
         (m.sanity_id IS NULL) AS was_unbound
  FROM menu_items m;

  SELECT count(*) INTO v_bound FROM _match WHERE was_unbound AND sanity_id IS NOT NULL;

  -- The diff. One row per POS dish, with what it is and what it would become.
  CREATE TEMP TABLE _diff ON COMMIT DROP AS
  SELECT
    m.id,
    m.name,
    m.price       AS old_price,
    -- The POS shows menu_items.price on the grid tile and ModifierModal
    -- defaults to the LAST variant, i.e. the largest. Sanity's price field is
    -- the smallest size. For a sized dish the equivalent POS figure is
    -- therefore the largest size, not Sanity's base.
    CASE WHEN jsonb_array_length(COALESCE(i.variants,'[]'::jsonb)) > 0
         THEN (SELECT max((v->>'price')::numeric)
               FROM jsonb_array_elements(i.variants) v)
         ELSE i.price END AS new_price,
    m.variants    AS old_variants,
    i.variants    AS new_variants,
    m.description AS old_desc,
    i.description AS new_desc,
    (jsonb_array_length(COALESCE(m.variants,'[]'::jsonb)) > 0
      OR jsonb_array_length(COALESCE(i.variants,'[]'::jsonb)) > 0) AS sized,
    (i.sanity_id IS NULL) AS unmatched
  FROM menu_items m
  JOIN _match mt ON mt.pos_id = m.id
  LEFT JOIN _incoming i ON i.sanity_id = mt.sanity_id;

  SELECT count(*) FILTER (WHERE unmatched) INTO v_unmatched FROM _diff;

  SELECT
    count(*) FILTER (WHERE NOT unmatched AND NOT sized
                     AND (old_price IS DISTINCT FROM new_price
                          OR old_desc IS DISTINCT FROM new_desc)),
    count(*) FILTER (WHERE NOT unmatched AND sized)
  INTO v_changed, v_held
  FROM _diff;

  IF p_apply THEN
    -- Persist the identity first: even a run that changes no price is worth
    -- binding, so the next sync survives a rename on the website.
    UPDATE menu_items m
    SET sanity_id = mt.sanity_id
    FROM _match mt
    WHERE m.id = mt.pos_id AND m.sanity_id IS NULL AND mt.sanity_id IS NOT NULL;

    UPDATE menu_items m
    SET price = d.new_price,
        description = COALESCE(d.new_desc, m.description),
        variants = CASE WHEN d.sized THEN d.new_variants ELSE m.variants END,
        updated_at = now()
    FROM _diff d
    WHERE m.id = d.id
      AND NOT d.unmatched
      AND (p_apply_sized OR NOT d.sized)
      AND (m.price IS DISTINCT FROM d.new_price
           OR m.description IS DISTINCT FROM COALESCE(d.new_desc, m.description)
           OR (d.sized AND p_apply_sized AND m.variants IS DISTINCT FROM d.new_variants));
    GET DIAGNOSTICS v_changed = ROW_COUNT;
  END IF;

  -- The per-dish record, capped so a run record stays readable. Ordered by
  -- the size of the change, because that is what a reviewer wants to see.
  SELECT jsonb_agg(x ORDER BY x->>'bucket', (x->>'sort')::numeric DESC) INTO v_detail
  FROM (
    SELECT jsonb_build_object(
      'name', name,
      'bucket', CASE WHEN unmatched THEN 'unmatched'
                     WHEN sized AND NOT p_apply_sized THEN 'held'
                     WHEN old_price IS DISTINCT FROM new_price THEN 'changed'
                     ELSE 'same' END,
      'old', old_price, 'new', new_price,
      'sort', COALESCE(new_price / NULLIF(old_price, 0), 0)
    ) AS x
    FROM _diff
    WHERE unmatched OR sized OR old_price IS DISTINCT FROM new_price
  ) s;

  INSERT INTO menu_sync_runs (applied, dishes_seen, changed, held, unmatched, detail)
  VALUES (p_apply, v_seen, v_changed, v_held, v_unmatched, v_detail);

  RETURN jsonb_build_object(
    'applied', p_apply,
    'dishes_seen', v_seen,
    'newly_bound', v_bound,
    'changed', v_changed,
    'held_sized', v_held,
    'unmatched', v_unmatched,
    'detail', COALESCE(v_detail, '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION sync_menu_from_sanity(JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sync_menu_from_sanity(JSONB, BOOLEAN, BOOLEAN) TO authenticated;
