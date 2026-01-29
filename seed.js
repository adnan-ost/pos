const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We need to redefine this here because we're running this in a node script
// that might not support ES modules import of the lib file easily without configuration
const menuData = {
    categories: [
        { id: 'karahi', name: 'Karahi & Handi', icon: 'Soup' },
        { id: 'qorma', name: 'Qorma & Curry', icon: 'Soup' },
        { id: 'nihari', name: 'Nihari & Haleem', icon: 'Soup' },
        { id: 'bbq', name: 'BBQ', icon: 'Flame' },
        { id: 'rice', name: 'Rice', icon: 'Utensils' },
        { id: 'tandoor', name: 'Tandoor', icon: 'Cookie' },
        { id: 'chinese', name: 'Chinese', icon: 'Utensils' },
        { id: 'street', name: 'Street Food', icon: 'Cookie' },
        { id: 'dessert', name: 'Desserts', icon: 'Cookie' },
        { id: 'beverages', name: 'Beverages', icon: 'GlassWater' },
        { id: 'sides', name: 'Sides & Extras', icon: 'Plus' },
    ],
    items: [
        // === KARAHI & HANDI ===
        {
            categoryId: 'karahi',
            name: 'Chicken Karahi',
            price: 1200,
            unit: 'Full',
            description: 'Traditional Desi Chicken Karahi in wok.',
            image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop',
            variants: [{ name: 'Half', price: 700 }, { name: 'Full', price: 1200 }],
            modifiers: ['spiciness']
        },
        // ... (truncated for brevity, I will include all items in the actual execution)
        // I will copy the full data structure from current menuData.js but adapted for DB insertion
    ],
    modifiers: {
        spiciness: {
            type: 'select',
            name: 'Spice Level',
            options: [
                { name: 'Mild', price: 0 },
                { name: 'Medium', price: 0 },
                { name: 'Spicy', price: 0 },
                { name: 'Extra Spicy', price: 0 }
            ]
        },
        raita: {
            type: 'multiselect',
            name: 'Add-ons',
            options: [
                { name: 'Raita', price: 50 },
                { name: 'Salad', price: 50 }
            ]
        }
    }
};

const seed = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting seed process...');

    // 1. Clear existing data
    console.log('Clearing existing data...');
    await supabase.from('menu_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // modifiers table might be referenced, so handle carefullly or just delete
    await supabase.from('modifiers').delete().neq('id', '00000000-0000-0000-0000-000000000000');


    // 2. Insert Categories
    console.log('Inserting categories...');
    const categoryMap = {}; // oldId -> newUUID

    for (const [index, cat] of menuData.categories.entries()) {
        const { data, error } = await supabase
            .from('categories')
            .insert({
                name: cat.name,
                icon: cat.icon,
                sort_order: index
            })
            .select()
            .single();

        if (error) {
            console.error(`Error inserting category ${cat.name}:`, error);
        } else {
            categoryMap[cat.id] = data.id;
        }
    }

    // 3. Insert Modifiers
    console.log('Inserting modifiers...');
    // We're storing modifiers as arrays of strings in json/text in the original
    // For the DB, we created a 'modifiers' table. Let's populate it.
    // However, the current schema on menu_items uses text[] for modifiers keys.
    // So we just need to ensure the keys exist in the modifiers table for reference?
    // Or we keep the menu_items.modifiers as an array of keys and just have a reference table.

    for (const [key, mod] of Object.entries(menuData.modifiers)) {
        const { error } = await supabase
            .from('modifiers')
            .insert({
                key: key,
                name: mod.name,
                type: mod.type,
                options: mod.options
            });

        if (error) console.error(`Error inserting modifier ${key}:`, error);
    }

    // 4. Insert Menu Items
    // I need to read the full file first to get all items since I truncated above
    // For this specific script step, I will simplify and just assume I can read the file
    // But since I cannot `require` ES modules easily in this standalone script without setup,
    // I will read the file manually or just paste the data I know exists.

    // To be safe and complete, I'll copy the full data from the view_file output I saw earlier.
    const fullItems = [
        { categoryId: 'karahi', name: 'Chicken Karahi', price: 1200, unit: 'Full', description: 'Traditional Desi Chicken Karahi in wok.', image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641', variants: [{ name: 'Half', price: 700 }, { name: 'Full', price: 1200 }], modifiers: ['spiciness'] },
        { categoryId: 'karahi', name: 'Mutton Karahi', price: 2200, unit: 'Full', description: 'Tender Mutton Karahi with rich gravy.', image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe', variants: [{ name: 'Half', price: 1200 }, { name: 'Full', price: 2200 }], modifiers: ['spiciness'] },
        { categoryId: 'karahi', name: 'Chicken Handi', price: 1400, description: 'Creamy chicken handi with desi ghee.', image: 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15', variants: [{ name: 'Half', price: 800 }, { name: 'Full', price: 1400 }], modifiers: ['spiciness'] },
        { categoryId: 'karahi', name: 'Dumba Karahi', price: 2800, description: 'Premium lamb karahi with fat tails.', image: 'https://images.unsplash.com/photo-1545247181-516773cae754', modifiers: ['spiciness'] },
        { categoryId: 'karahi', name: 'Daal Makhni', price: 650, description: 'Slow-cooked black lentils in creamy gravy.', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d' },

        { categoryId: 'qorma', name: 'Chicken Qorma', price: 900, description: 'Rich Mughlai style chicken qorma.', image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398', modifiers: ['spiciness'] },
        { categoryId: 'qorma', name: 'Mutton Qorma', price: 1400, description: 'Aromatic mutton in thick yogurt gravy.', image: 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15', modifiers: ['spiciness'] },
        { categoryId: 'qorma', name: 'Chicken White Qorma', price: 950, description: 'Creamy white chicken korma.', image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe', modifiers: ['spiciness'] },
        { categoryId: 'qorma', name: 'Chicken Badami Qorma', price: 1000, description: 'Almond-rich chicken korma.', image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641', modifiers: ['spiciness'] },
        { categoryId: 'qorma', name: 'Chicken Jalfrezi', price: 850, description: 'Spicy chicken with bell peppers.', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7', modifiers: ['spiciness'] },

        { categoryId: 'nihari', name: 'Beef Nihari', price: 700, description: 'Slow-cooked beef shank in rich spices.', image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84', modifiers: ['spiciness'] },
        { categoryId: 'nihari', name: 'Mutton Nihari', price: 900, description: 'Premium mutton nihari overnight stew.', image: 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15', modifiers: ['spiciness'] },
        { categoryId: 'nihari', name: 'Beef Haleem', price: 550, description: 'Hearty wheat and beef stew.', image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b', modifiers: ['spiciness'] },
        { categoryId: 'nihari', name: 'Mutton Haleem', price: 700, description: 'Rich mutton haleem with garnish.', image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe', modifiers: ['spiciness'] },

        { categoryId: 'bbq', name: 'Chicken Tikka', price: 350, description: 'Charcoal grilled chicken pieces.', image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91', modifiers: ['spiciness'] },
        { categoryId: 'bbq', name: 'Seekh Kabab', price: 400, unit: '4 pcs', description: 'Minced beef kababs with herbs.', image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0', modifiers: ['spiciness'] },
        { categoryId: 'bbq', name: 'Malai Boti', price: 450, description: 'Creamy tender chicken cubes.', image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8', modifiers: ['spiciness'] },
        { categoryId: 'bbq', name: 'Chapli Kabab', price: 450, unit: '2 pcs', description: 'Peshawari flat beef kababs.', image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84', modifiers: ['spiciness'] },
        { categoryId: 'bbq', name: 'Chicken Chargha', price: 1200, description: 'Whole deep-fried marinated chicken.', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b', modifiers: ['spiciness'] },
        { categoryId: 'bbq', name: 'BBQ Platter', price: 1500, description: 'Mixed tikka, kabab, chops, boti.', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1', modifiers: ['spiciness'] },
        { categoryId: 'bbq', name: 'Lamb Chops', price: 850, unit: '4 pcs', description: 'Juicy lamb chops marinated overnight.', image: 'https://images.unsplash.com/photo-1544025162-d76694265947', modifiers: ['spiciness'] },

        { categoryId: 'rice', name: 'Chicken Biryani', price: 450, description: 'Aromatic spicy chicken biryani.', image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0', modifiers: ['raita'] },
        { categoryId: 'rice', name: 'Mutton Biryani', price: 650, description: 'Saffron mutton biryani.', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8', modifiers: ['raita'] },
        { categoryId: 'rice', name: 'Beef Biryani', price: 550, description: 'Spicy beef biryani with potatoes.', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8', modifiers: ['raita'] },
        { categoryId: 'rice', name: 'Chicken Pulao', price: 400, description: 'Fragrant rice with tender chicken.', image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b' },
        { categoryId: 'rice', name: 'Zarda', price: 250, description: 'Sweet saffron rice with nuts.', image: 'https://images.unsplash.com/photo-1567337710282-00832b415979' },

        { categoryId: 'tandoor', name: 'Roghni Naan', price: 80, description: 'Soft naan with sesame seeds.', image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be' },
        { categoryId: 'tandoor', name: 'Garlic Naan', price: 100, description: 'Naan with garlic butter.', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950' },
        { categoryId: 'tandoor', name: 'Cheese Naan', price: 150, description: 'Stuffed with melted cheese.', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af' },
        { categoryId: 'tandoor', name: 'Tandoori Roti', price: 40, description: 'Whole wheat tandoori bread.', image: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40' },
        { categoryId: 'tandoor', name: 'Paratha', price: 60, description: 'Layered flaky bread.', image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641' },

        { categoryId: 'chinese', name: 'Chicken Chowmein', price: 450, description: 'Stir-fried noodles with chicken.', image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246' },
        { categoryId: 'chinese', name: 'Chicken Shashlik', price: 550, description: 'Grilled skewers with bell peppers.', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1' },
        { categoryId: 'chinese', name: 'Egg Fried Rice', price: 350, description: 'Classic fried rice with eggs.', image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b' },
        { categoryId: 'chinese', name: 'Hot & Sour Soup', price: 250, description: 'Tangy and spicy soup.', image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd' },

        { categoryId: 'street', name: 'Samosa', price: 80, unit: '2 pcs', description: 'Crispy potato-filled pastries.', image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950' },
        { categoryId: 'street', name: 'Samosa Chaat', price: 150, description: 'Crushed samosa with chutneys.', image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84' },
        { categoryId: 'street', name: 'Dahi Baray', price: 200, description: 'Lentil dumplings in spiced yogurt.', image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55' },
        { categoryId: 'street', name: 'Gol Gappay', price: 150, description: 'Crispy puris with tangy water.', image: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f' },
        { categoryId: 'street', name: 'Pakora', price: 120, description: 'Crispy fritters, assorted.', image: 'https://images.unsplash.com/photo-1567337710282-00832b415979' },

        { categoryId: 'dessert', name: 'Gulab Jamun', price: 200, unit: '4 pcs', description: 'Hot milk dumplings in syrup.', image: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7' },
        { categoryId: 'dessert', name: 'Kheer', price: 250, description: 'Creamy rice pudding.', image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add' },
        { categoryId: 'dessert', name: 'Gajar Ka Halwa', price: 300, description: 'Warm carrot pudding with nuts.', image: 'https://images.unsplash.com/photo-1567337710282-00832b415979' },
        { categoryId: 'dessert', name: 'Ras Malai', price: 350, description: 'Soft paneer in sweet milk.', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7' },
        { categoryId: 'dessert', name: 'Shahi Tukray', price: 280, description: 'Fried bread in sweetened milk.', image: 'https://images.unsplash.com/photo-1551326844-4df70f78d0e9' },

        { categoryId: 'beverages', name: 'Doodh Patti', price: 100, description: 'Strong Pakistani milk tea.', image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f' },
        { categoryId: 'beverages', name: 'Kashmiri Chai', price: 180, description: 'Pink tea with nuts.', image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f' },
        { categoryId: 'beverages', name: 'Lassi (Sweet)', price: 180, description: 'Creamy yogurt drink.', image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add' },
        { categoryId: 'beverages', name: 'Fresh Lime', price: 150, description: 'Refreshing lime soda.', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd' },
        { categoryId: 'beverages', name: 'Soft Drink', price: 120, description: 'Chilled Pepsi, Sprite, 7Up.', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97' },
        { categoryId: 'beverages', name: 'Mineral Water', price: 80, description: '500ml bottled water.', image: 'https://images.unsplash.com/photo-1560023907-5f339617ea30' },

        { categoryId: 'sides', name: 'Raita', price: 100, description: 'Yogurt with cucumber & mint.', image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55' },
        { categoryId: 'sides', name: 'Green Salad', price: 150, description: 'Fresh garden salad.', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd' },
        { categoryId: 'sides', name: 'Russian Salad', price: 200, description: 'Creamy mayo vegetable salad.', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999' },
        { categoryId: 'sides', name: 'French Fries', price: 250, description: 'Crispy golden fries.', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877' },
        { categoryId: 'sides', name: 'Achar (Pickle)', price: 80, description: 'Spicy mixed pickle.', image: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f' }
    ];

    console.log(`Inserting ${fullItems.length} menu items...`);

    for (const item of fullItems) {
        const catUuid = categoryMap[item.categoryId];
        if (!catUuid) {
            console.error(`Skipping item ${item.name}: Category ${item.categoryId} not found in map`);
            continue;
        }

        const { error } = await supabase
            .from('menu_items')
            .insert({
                category_id: catUuid,
                name: item.name,
                description: item.description,
                price: item.price,
                unit: item.unit,
                image: item.image,
                variants: item.variants || [],
                modifiers: item.modifiers || [],
                is_available: true
            });

        if (error) console.error(`Error inserting item ${item.name}:`, error);
    }

    console.log('Seed completed successfully!');
};

seed();
