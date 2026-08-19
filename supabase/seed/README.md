# Menu seed

## Files

| File | What it is |
|---|---|
| `menu_v3.json` | The live menu: 17 categories, 125 items, generated from the menu document |
| `menu_backup_pre_v3.json` | The 13 categories and 57 items that were live before it, taken just before the swap |

## Regenerating

`menu_v3.json` is built, not hand-edited — 125 rows is too many to keep
consistent by hand, and the prices will need revising:

```
python3 scripts/menu/build_menu.py       # prices.json + parsed doc -> menu_v3.json
```

Prices live in `scripts/menu/prices.json`. Edit there and rebuild.

## Applying

```
ADMIN_EMAIL=... ADMIN_PIN=... node scripts/menu/apply_menu.mjs backup    # dump what's live now
ADMIN_EMAIL=... ADMIN_PIN=... node scripts/menu/apply_menu.mjs upload    # images -> menu-images bucket
ADMIN_EMAIL=... ADMIN_PIN=... node scripts/menu/apply_menu.mjs replace   # swap the live menu
```

Phases are separate deliberately: uploading is slow and repeatable, replacing is
fast and destructive. A failed upload should never leave the till with no menu.

## About the prices

**The source document contained no prices at all** — every one of its 125 slots
was blank, and there was not a single digit in the file. The prices in
`prices.json` are estimates, anchored to the prices that were already in the POS
so they sit in the same bands the restaurant already charges (Chicken Karahi
1200, Mutton Karahi 2200, Chicken Tikka 350, Beef Nihari 700, Cheese Naan 150,
Ras Malai 350, and so on). Nineteen items carried their exact previous price.

They are a starting point, not a price list. Check them before trading.

## Images

114 of the 125 items have a photo. The 11 without are everything in *Cold by the
River* and *Mithai* — those folders were supplied empty. Those items render the
fallback icon until photos exist; add them through Menu Management → Upload photo.

Uploaded objects are at `menu-images/menu-v3/<category-slug>/<item-slug>.webp`,
which is stable, so re-running `upload` replaces rather than duplicates.
