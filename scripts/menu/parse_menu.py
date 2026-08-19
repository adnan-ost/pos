import re, json, os, unicodedata

SRC = '/tmp/menu.txt'
IMG_ROOT = '/Users/adnanmalik/Flames by the Indus POS/Digital_Menu_Item_Images (webp 800)'

def norm(s):
    # Parentheses are dropped as punctuation, not as content: the filenames spell
    # them out ("Namkeen_Gosht_Peshawari_Karahi"), so removing the bracketed words
    # from the menu name is what broke the match.
    s = unicodedata.normalize('NFKD', s).lower()
    s = s.replace('&', ' and ')
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(s.split())

# Category headings as they appear, mapped to the image folder that holds them
CATS = [
    ('CHICKEN BBQ',                'Chicken BBQ',                 '01_From_the_Coals/01_Chicken_BBQ'),
    ('MUTTON & BEEF BBQ',          'Mutton & Beef BBQ',           '01_From_the_Coals/02_Mutton_and_Beef_BBQ'),
    ('FROM THE SEA',               'From the Sea',                '01_From_the_Coals/03_From_the_Sea'),
    ('KARAHI',                     'Karahi',                      '02_The_Kitchen_of_the_Indus/01_Karahi'),
    ('HANDI (BONELESS)',           'Handi (Boneless)',            '02_The_Kitchen_of_the_Indus/02_Handi_Boneless'),
    ('SIGNATURE CURRIES & SLOW-COOKED','Signature Curries',        '02_The_Kitchen_of_the_Indus/03_Signature_Curries_and_Slow_Cooked'),
    ('NIHARI, PAYA & HALEEM',      'Nihari, Paya & Haleem',       '02_The_Kitchen_of_the_Indus/04_Nihari_Paya_and_Haleem'),
    ('RICE & PULAO',               'Rice & Pulao',                '02_The_Kitchen_of_the_Indus/05_Rice_and_Pulao'),
    ('DAAL & SABZI',               'Daal & Sabzi',                '02_The_Kitchen_of_the_Indus/06_Daal_and_Sabzi'),
    ('BREADS FROM THE TANDOOR',    'Breads from the Tandoor',     '02_The_Kitchen_of_the_Indus/07_Breads_from_the_Tandoor'),
    ('TO BEGIN — SALADS & STARTERS','Salads & Starters',          '02_The_Kitchen_of_the_Indus/08_Salads_and_Starters'),
    ('SUBHO KA NASHTA — BREAKFAST','Breakfast (Subho ka Nashta)', '02_The_Kitchen_of_the_Indus/09_Breakfast_Subho_Ka_Nashta'),
    ('EVERYDAY CHAI',              'Everyday Chai',               '03_The_Chai_Khana/01_Everyday_Chai'),
    ('REGIONAL & SPECIALTY',       'Regional & Specialty Chai',   '03_The_Chai_Khana/02_Regional_and_Specialty'),
    ('FLAMES SIGNATURES',          'Flames Signature Chai',       '03_The_Chai_Khana/03_Flames_Signatures'),
    ('COLD BY THE RIVER (SUMMER)', 'Cold by the River',           '03_The_Chai_Khana/04_Cold_by_the_River_Summer'),
    ('MITHAI — SWEET ENDINGS',     'Mithai',                      '03_The_Chai_Khana/05_Mithai_Sweet_Endings'),
]
HEAD = {h: (label, folder) for h, label, folder in CATS}
SUBGROUPS = {'Chicken', 'Mutton', 'Beef'}

# index every image by normalised name, per folder
images = {}
for root, _, files in os.walk(IMG_ROOT):
    for f in files:
        if not f.endswith('.webp'): continue
        rel = os.path.relpath(os.path.join(root, f), IMG_ROOT)
        # Strip the extension first, then the optional size suffix. Doing it the
        # other way round only worked for files literally named *_800x800.webp,
        # so any other image dropped into the folder silently failed to match.
        stem = re.sub(r'\.webp$', '', f)
        stem = re.sub(r'^\d+_', '', stem)
        stem = re.sub(r'_\d+x\d+$', '', stem)
        images.setdefault(norm(stem), []).append(rel)

items, cat_order, cur = [], [], None
for raw in open(SRC):
    line = raw.strip()
    if not line: continue
    if line in HEAD:
        cur = HEAD[line]
        if cur[0] not in [c['name'] for c in cat_order]:
            cat_order.append({'name': cur[0], 'folder': cur[1]})
        continue
    if line in SUBGROUPS: continue
    if '|' not in line or cur is None: continue

    name_desc = line.split('|')[0].strip()
    if not name_desc: continue
    parts = re.split(r'\s{2,}', name_desc, maxsplit=1)
    name = parts[0].strip()
    desc = parts[1].strip() if len(parts) > 1 else ''

    key = norm(name)
    candidates = images.get(key, [])
    # Prefer an image inside this category's own folder. Two categories can hold
    # the same dish — Channay appears under both Daal & Sabzi and Breakfast — and
    # matching on name alone gave them both the same file.
    same_cat = [c for c in candidates if c.startswith(cur[1])]
    img = same_cat or candidates
    items.append({
        'category': cur[0], 'name': name, 'description': desc,
        'image_file': img[0] if img else None,
    })

print(f"categories: {len(cat_order)}   items: {len(items)}")
missing = [i['name'] for i in items if not i['image_file']]
print(f"items without a matched image: {len(missing)}")
for m in missing: print(f"   - {m}")
json.dump({'categories': cat_order, 'items': items}, open('/tmp/menu_parsed.json','w'), indent=1, ensure_ascii=False)
