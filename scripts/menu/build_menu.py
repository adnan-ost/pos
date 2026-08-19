#!/usr/bin/env python3
"""
Builds supabase/seed/menu_v3.json from the menu document's parsed output, the
price map, and the supplied image folder.

Kept as a script rather than a one-off because the source document had no prices
and these will need revising — regenerating beats hand-editing 125 rows.
"""
import json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMG_ROOT = os.path.join(ROOT, 'Digital_Menu_Item_Images (webp 800)')

# Icons are limited to what CategoryIcon in menu/page.js can render.
CATEGORY_ICONS = {
    'Chicken BBQ': 'Flame', 'Mutton & Beef BBQ': 'Flame', 'From the Sea': 'Flame',
    'Karahi': 'Soup', 'Handi (Boneless)': 'Soup', 'Signature Curries': 'Soup',
    'Nihari, Paya & Haleem': 'Soup', 'Rice & Pulao': 'Utensils',
    'Daal & Sabzi': 'Soup', 'Breads from the Tandoor': 'Utensils',
    'Salads & Starters': 'Utensils', 'Breakfast (Subho ka Nashta)': 'Utensils',
    'Everyday Chai': 'GlassWater', 'Regional & Specialty Chai': 'GlassWater',
    'Flames Signature Chai': 'GlassWater', 'Cold by the River': 'GlassWater',
    'Mithai': 'Cookie',
}

# Half/full is how this restaurant already sells karahi and handi — the existing
# menu carried those variants (Chicken Karahi 1200 with Half 700). The document
# doesn't mention portions, so this preserves the capability rather than adding
# something new. ~58% mirrors the existing ratios.
HALF_RATIO = 0.58
HALF_FULL_CATEGORIES = {'Karahi', 'Handi (Boneless)'}

# Items whose options the document lists inline
EXPLICIT_VARIANTS = {
    'Haleem':   [('Chicken', 600), ('Mutton', 700), ('Beef', 650)],
    'Omelette': [('Plain', 200), ('Vegetable', 250), ('Cheese', 300), ('Mushroom', 320)],
    'Paratha':  [('Plain', 60), ('Aloo', 120)],
}

def round50(n):
    """Prices on this menu land on 50s; a Half at 696 would look computed."""
    return int(round(n / 50.0) * 50)

def main():
    parsed = json.load(open('/tmp/menu_parsed.json'))
    prices = json.load(open(os.path.join(ROOT, 'scripts/menu/prices.json')))
    prices.pop('_note', None)

    categories = [
        {'name': c['name'], 'icon': CATEGORY_ICONS.get(c['name'], 'Utensils'), 'sort_order': i}
        for i, c in enumerate(parsed['categories'])
    ]

    items = []
    for it in parsed['items']:
        name, cat = it['name'], it['category']
        price = prices[name]

        variants = []
        if name in EXPLICIT_VARIANTS:
            variants = [{'name': n, 'price': p} for n, p in EXPLICIT_VARIANTS[name]]
        elif cat in HALF_FULL_CATEGORIES:
            variants = [
                {'name': 'Half', 'price': round50(price * HALF_RATIO)},
                {'name': 'Full', 'price': price},
            ]

        items.append({
            'name': name,
            'category': cat,
            'description': it['description'],
            'price': price,
            'variants': variants,
            'image_file': it['image_file'],
        })

    out = os.path.join(ROOT, 'supabase/seed/menu_v3.json')
    json.dump({'categories': categories, 'items': items}, open(out, 'w'), indent=1, ensure_ascii=False)

    with_img = sum(1 for i in items if i['image_file'])
    with_var = sum(1 for i in items if i['variants'])
    print(f"wrote {out}")
    print(f"  categories {len(categories)}   items {len(items)}")
    print(f"  with image {with_img}   without {len(items)-with_img}")
    print(f"  with variants {with_var}")
    print(f"  price range Rs {min(i['price'] for i in items)} - {max(i['price'] for i in items)}")

if __name__ == '__main__':
    main()
