-- What has to exist before Menu Management can be deleted from the POS.
--
-- The menu is authored in Sanity now, so the till has no business editing
-- names, prices or descriptions. But two things that screen did are not
-- Sanity's job, and deleting it without replacing them would take real
-- capability away:
--
--   1. Marking a dish sold out. Sanity is the wrong home for this — 86'ing
--      happens mid-rush, by whoever is on the floor, and routing it through a
--      CMS means opening Studio, publishing, and then running a sync before
--      the till stops selling food the kitchen does not have. It belongs on
--      the till, one tap, instant.
--
--   2. Categories. They are still POS-only, so once the screen goes there is
--      no way to change them at all. Sanity's 20 sections become the source.

-- ==================== 86 / SOLD OUT ====================

-- An RPC rather than a direct write, because menu_items writes are admin-only
-- (migration 08) and 86'ing is a floor-staff act, not an admin one. The
-- permission model P2 brings will gate this on a `can_86` verb; until then any
-- signed-in account may do it, which matches how the shift actually runs.
--
-- Audited, because "who took the biryani off at 8pm" is a real question the
-- morning after, and because this is the one menu field a human still changes
-- by hand.
CREATE OR REPLACE FUNCTION set_item_availability(
  p_item_id UUID,
  p_available BOOLEAN
) RETURNS menu_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item menu_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change availability';
  END IF;

  UPDATE menu_items
  SET is_available = p_available, updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That dish is no longer on the menu';
  END IF;

  INSERT INTO audit_log (action, details)
  VALUES ('set_availability', jsonb_build_object(
    'menu_item_id', v_item.id,
    'name', v_item.name,
    'available', p_available
  ));

  RETURN v_item;
END $$;

REVOKE ALL ON FUNCTION set_item_availability(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_item_availability(UUID, BOOLEAN) TO authenticated;

-- ==================== CATEGORIES FROM SANITY ====================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sanity_id TEXT;
CREATE INDEX IF NOT EXISTS categories_sanity_id_idx ON categories (sanity_id);

/*
 * Adopt the website's sections as the till's categories.
 *
 * Dry run by default, like the dish sync.
 *
 * Categories are never deleted. menu_items.category_id references them with
 * ON DELETE SET NULL, so dropping a category silently strands its dishes in
 * the POS grid's "All" tab with no group — the sort of thing nobody notices
 * until a cashier cannot find the naan. One left empty is reported instead.
 *
 * A dish that sits in more than one Sanity section is left where it is. The
 * only one today is Channay, which is one dish on the website and two POS rows
 * (an item belongs to exactly one category), and the two rows are already in
 * the right two categories. Moving them by sanity_id would put both in
 * whichever section happened to be processed last.
 */
CREATE OR REPLACE FUNCTION sync_categories_from_sanity(
  p_sections JSONB,
  p_apply BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_created INT := 0;
  v_renumbered INT := 0;
  v_moved INT := 0;
  v_ambiguous INT := 0;
  v_emptied JSONB;
  v_plan JSONB;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only an admin can restructure the menu categories';
  END IF;

  IF p_sections IS NULL OR jsonb_typeof(p_sections) <> 'array'
     OR jsonb_array_length(p_sections) = 0 THEN
    RAISE EXCEPTION 'No sections supplied — refusing to empty the menu categories';
  END IF;

  CREATE TEMP TABLE _sections ON COMMIT DROP AS
  SELECT s->>'id'                        AS sanity_id,
         btrim(s->>'title')              AS title,
         COALESCE((s->>'order')::int, 0) AS sort_order,
         _jsonb_array(s->'dishes')       AS dish_ids
  FROM jsonb_array_elements(p_sections) s
  WHERE COALESCE(NULLIF(btrim(s->>'title'), ''), '') <> '';

  -- Which POS category each section maps to: an existing one matched by name,
  -- or nothing yet (to be created).
  CREATE TEMP TABLE _map ON COMMIT DROP AS
  SELECT sec.sanity_id, sec.title, sec.sort_order, sec.dish_ids,
         (SELECT c.id FROM categories c
           WHERE lower(btrim(c.name)) = lower(sec.title)
              OR c.sanity_id = sec.sanity_id
           LIMIT 1) AS category_id
  FROM _sections sec;

  SELECT count(*) FILTER (WHERE category_id IS NULL) INTO v_created FROM _map;

  -- A dish listed in more than one section keeps its current category.
  CREATE TEMP TABLE _dish_section ON COMMIT DROP AS
  SELECT d.dish_id, count(*) AS in_sections, min(m.title) AS only_section
  FROM _map m, jsonb_array_elements_text(m.dish_ids) AS d(dish_id)
  GROUP BY d.dish_id;

  SELECT count(*) INTO v_ambiguous FROM _dish_section WHERE in_sections > 1;

  SELECT count(*) INTO v_moved
  FROM menu_items mi
  JOIN _dish_section ds ON ds.dish_id = mi.sanity_id AND ds.in_sections = 1
  JOIN _map m ON m.title = ds.only_section
  WHERE mi.category_id IS DISTINCT FROM m.category_id OR m.category_id IS NULL;

  SELECT count(*) INTO v_renumbered
  FROM _map m JOIN categories c ON c.id = m.category_id
  WHERE c.sort_order IS DISTINCT FROM m.sort_order;

  -- Categories that would be left holding nothing.
  SELECT jsonb_agg(c.name ORDER BY c.name) INTO v_emptied
  FROM categories c
  WHERE NOT EXISTS (SELECT 1 FROM _map m WHERE m.category_id = c.id)
    AND EXISTS (SELECT 1 FROM menu_items mi WHERE mi.category_id = c.id);

  IF p_apply THEN
    INSERT INTO categories (name, sanity_id, sort_order, icon)
    SELECT m.title, m.sanity_id, m.sort_order, 'Utensils'
    FROM _map m WHERE m.category_id IS NULL;

    -- Re-resolve: the rows just inserted now have ids.
    UPDATE _map m SET category_id = c.id
    FROM categories c
    WHERE m.category_id IS NULL AND lower(btrim(c.name)) = lower(m.title);

    UPDATE categories c
    SET sort_order = m.sort_order, sanity_id = m.sanity_id, updated_at = now()
    FROM _map m WHERE c.id = m.category_id;

    UPDATE menu_items mi
    SET category_id = m.category_id, updated_at = now()
    FROM _dish_section ds
    JOIN _map m ON m.title = ds.only_section
    WHERE ds.dish_id = mi.sanity_id
      AND ds.in_sections = 1
      AND mi.category_id IS DISTINCT FROM m.category_id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    INSERT INTO audit_log (action, details)
    VALUES ('sync_categories', jsonb_build_object(
      'sections', (SELECT count(*) FROM _map),
      'created', v_created, 'moved', v_moved, 'left_empty', v_emptied));
  END IF;

  SELECT jsonb_agg(jsonb_build_object('title', title, 'order', sort_order,
                                      'dishes', jsonb_array_length(dish_ids),
                                      'new', category_id IS NULL) ORDER BY sort_order)
    INTO v_plan FROM _map;

  RETURN jsonb_build_object(
    'applied', p_apply,
    'sections', (SELECT count(*) FROM _map),
    'categories_created', v_created,
    'dishes_moved', v_moved,
    'renumbered', v_renumbered,
    'dishes_in_two_sections', v_ambiguous,
    'left_empty', COALESCE(v_emptied, '[]'::jsonb),
    'plan', COALESCE(v_plan, '[]'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION sync_categories_from_sanity(JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sync_categories_from_sanity(JSONB, BOOLEAN) TO authenticated;
