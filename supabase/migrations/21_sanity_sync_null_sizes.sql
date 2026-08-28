-- Fixes "cannot extract elements from a scalar" in sync_menu_from_sanity.
--
-- Sanity returns `"sizes": null` for a dish sold in one size — a JSON null,
-- not an empty array. Migration 20 guarded that with
-- COALESCE(d->'sizes', '[]'::jsonb), which does nothing here: COALESCE
-- replaces SQL NULL, and `d->'sizes'` on a JSON null returns the JSONB value
-- `null`, which is not SQL NULL. It sailed through the COALESCE into
-- jsonb_array_elements, which refuses anything that is not an array.
--
--   select jsonb_typeof(COALESCE('null'::jsonb, '[]'::jsonb));  -- 'null'
--
-- Why the tests missed it: the fixtures passed "sizes":[] explicitly, and the
-- payload builder normalised nulls away in JS before they ever reached
-- Postgres. The test normalised the exact thing that breaks. The regression
-- test added with this migration passes a JSON null through untouched.
--
-- The fix is a helper that checks the type rather than the nullness, applied
-- everywhere an array is read out of JSONB — including `menu_items.variants`,
-- which is a proper array on all 125 rows today but is written by this same
-- function and so could stop being one.

CREATE OR REPLACE FUNCTION _jsonb_array(p JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE '[]'::jsonb END
$$;

REVOKE ALL ON FUNCTION _jsonb_array(JSONB) FROM PUBLIC, anon, authenticated;

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
BEGIN
  -- SECURITY DEFINER bypasses RLS, so migration 08's admin-only rule on
  -- menu_items has to be restated here.
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only an admin can sync the menu';
  END IF;

  IF p_dishes IS NULL OR jsonb_typeof(p_dishes) <> 'array' OR jsonb_array_length(p_dishes) = 0 THEN
    RAISE EXCEPTION 'No dishes supplied — refusing to sync an empty menu';
  END IF;
  v_seen := jsonb_array_length(p_dishes);

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
       -- _jsonb_array, not COALESCE: Sanity sends JSON null for an unsized dish.
       FROM jsonb_array_elements(_jsonb_array(d->'sizes')) s
       WHERE s->>'label' IS NOT NULL AND (s->>'price') ~ '^[0-9]+(\.[0-9]+)?$'),
      '[]'::jsonb)                               AS variants
  FROM jsonb_array_elements(p_dishes) d
  WHERE COALESCE(NULLIF(d->>'name', ''), '') <> ''
    AND (d->>'price') ~ '^[0-9]+(\.[0-9]+)?$';

  -- Matching, computed but not persisted: a dry run must write nothing.
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

  CREATE TEMP TABLE _diff ON COMMIT DROP AS
  SELECT
    m.id, m.name,
    m.price AS old_price,
    -- The POS grid shows menu_items.price and ModifierModal defaults to the
    -- LAST variant, i.e. the largest; Sanity's price field is the smallest
    -- size. For a sized dish the equivalent POS figure is the largest size.
    CASE WHEN jsonb_array_length(_jsonb_array(i.variants)) > 0
         THEN (SELECT max((v->>'price')::numeric)
               FROM jsonb_array_elements(_jsonb_array(i.variants)) v)
         ELSE i.price END AS new_price,
    m.variants AS old_variants,
    i.variants AS new_variants,
    m.description AS old_desc,
    i.description AS new_desc,
    (jsonb_array_length(_jsonb_array(m.variants)) > 0
      OR jsonb_array_length(_jsonb_array(i.variants)) > 0) AS sized,
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
    'applied', p_apply, 'dishes_seen', v_seen, 'newly_bound', v_bound,
    'changed', v_changed, 'held_sized', v_held, 'unmatched', v_unmatched,
    'detail', COALESCE(v_detail, '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION sync_menu_from_sanity(JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sync_menu_from_sanity(JSONB, BOOLEAN, BOOLEAN) TO authenticated;
