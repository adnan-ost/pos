export const menuData = {
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
            id: 'k1',
            categoryId: 'karahi',
            name: 'Chicken Karahi',
            price: 1200,
            unit: 'Full',
            description: 'Traditional Desi Chicken Karahi in wok.',
            image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop',
            variants: [{ name: 'Half', price: 700 }, { name: 'Full', price: 1200 }],
            modifiers: ['spiciness']
        },
        {
            id: 'k2',
            categoryId: 'karahi',
            name: 'Mutton Karahi',
            price: 2200,
            unit: 'Full',
            description: 'Tender Mutton Karahi with rich gravy.',
            image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=800&auto=format&fit=crop',
            variants: [{ name: 'Half', price: 1200 }, { name: 'Full', price: 2200 }],
            modifiers: ['spiciness']
        },
        {
            id: 'k3',
            categoryId: 'karahi',
            name: 'Chicken Handi',
            price: 1400,
            description: 'Creamy chicken handi with desi ghee.',
            image: 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?q=80&w=800&auto=format&fit=crop',
            variants: [{ name: 'Half', price: 800 }, { name: 'Full', price: 1400 }],
            modifiers: ['spiciness']
        },
        {
            id: 'k4',
            categoryId: 'karahi',
            name: 'Dumba Karahi',
            price: 2800,
            description: 'Premium lamb karahi with fat tails.',
            image: 'https://images.unsplash.com/photo-1545247181-516773cae754?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'k5',
            categoryId: 'karahi',
            name: 'Daal Makhni',
            price: 650,
            description: 'Slow-cooked black lentils in creamy gravy.',
            image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=800&auto=format&fit=crop',
        },
        // === QORMA & CURRY ===
        {
            id: 'q1',
            categoryId: 'qorma',
            name: 'Chicken Qorma',
            price: 900,
            description: 'Rich Mughlai style chicken qorma.',
            image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'q2',
            categoryId: 'qorma',
            name: 'Mutton Qorma',
            price: 1400,
            description: 'Aromatic mutton in thick yogurt gravy.',
            image: 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'q3',
            categoryId: 'qorma',
            name: 'Chicken White Qorma',
            price: 950,
            description: 'Creamy white chicken korma.',
            image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'q4',
            categoryId: 'qorma',
            name: 'Chicken Badami Qorma',
            price: 1000,
            description: 'Almond-rich chicken korma.',
            image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'q5',
            categoryId: 'qorma',
            name: 'Chicken Jalfrezi',
            price: 850,
            description: 'Spicy chicken with bell peppers.',
            image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        // === NIHARI & HALEEM ===
        {
            id: 'n1',
            categoryId: 'nihari',
            name: 'Beef Nihari',
            price: 700,
            description: 'Slow-cooked beef shank in rich spices.',
            image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'n2',
            categoryId: 'nihari',
            name: 'Mutton Nihari',
            price: 900,
            description: 'Premium mutton nihari overnight stew.',
            image: 'https://images.unsplash.com/photo-1574653853027-5382a3d23a15?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'n3',
            categoryId: 'nihari',
            name: 'Beef Haleem',
            price: 550,
            description: 'Hearty wheat and beef stew.',
            image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'n4',
            categoryId: 'nihari',
            name: 'Mutton Haleem',
            price: 700,
            description: 'Rich mutton haleem with garnish.',
            image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        // === BBQ ===
        {
            id: 'b1',
            categoryId: 'bbq',
            name: 'Chicken Tikka',
            price: 350,
            description: 'Charcoal grilled chicken pieces.',
            image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'b2',
            categoryId: 'bbq',
            name: 'Seekh Kabab',
            price: 400,
            unit: '4 pcs',
            description: 'Minced beef kababs with herbs.',
            image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'b3',
            categoryId: 'bbq',
            name: 'Malai Boti',
            price: 450,
            description: 'Creamy tender chicken cubes.',
            image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'b4',
            categoryId: 'bbq',
            name: 'Chapli Kabab',
            price: 450,
            unit: '2 pcs',
            description: 'Peshawari flat beef kababs.',
            image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'b5',
            categoryId: 'bbq',
            name: 'Chicken Chargha',
            price: 1200,
            description: 'Whole deep-fried marinated chicken.',
            image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'b6',
            categoryId: 'bbq',
            name: 'BBQ Platter',
            price: 1500,
            description: 'Mixed tikka, kabab, chops, boti.',
            image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        {
            id: 'b7',
            categoryId: 'bbq',
            name: 'Lamb Chops',
            price: 850,
            unit: '4 pcs',
            description: 'Juicy lamb chops marinated overnight.',
            image: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop',
            modifiers: ['spiciness']
        },
        // === RICE ===
        {
            id: 'r1',
            categoryId: 'rice',
            name: 'Chicken Biryani',
            price: 450,
            description: 'Aromatic spicy chicken biryani.',
            image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop',
            modifiers: ['raita']
        },
        {
            id: 'r2',
            categoryId: 'rice',
            name: 'Mutton Biryani',
            price: 650,
            description: 'Saffron mutton biryani.',
            image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop',
            modifiers: ['raita']
        },
        {
            id: 'r3',
            categoryId: 'rice',
            name: 'Beef Biryani',
            price: 550,
            description: 'Spicy beef biryani with potatoes.',
            image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop',
            modifiers: ['raita']
        },
        {
            id: 'r4',
            categoryId: 'rice',
            name: 'Chicken Pulao',
            price: 400,
            description: 'Fragrant rice with tender chicken.',
            image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'r5',
            categoryId: 'rice',
            name: 'Zarda',
            price: 250,
            description: 'Sweet saffron rice with nuts.',
            image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?q=80&w=800&auto=format&fit=crop',
        },
        // === TANDOOR ===
        {
            id: 't1',
            categoryId: 'tandoor',
            name: 'Roghni Naan',
            price: 80,
            description: 'Soft naan with sesame seeds.',
            image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 't2',
            categoryId: 'tandoor',
            name: 'Garlic Naan',
            price: 100,
            description: 'Naan with garlic butter.',
            image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 't3',
            categoryId: 'tandoor',
            name: 'Cheese Naan',
            price: 150,
            description: 'Stuffed with melted cheese.',
            image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 't4',
            categoryId: 'tandoor',
            name: 'Tandoori Roti',
            price: 40,
            description: 'Whole wheat tandoori bread.',
            image: 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 't5',
            categoryId: 'tandoor',
            name: 'Paratha',
            price: 60,
            description: 'Layered flaky bread.',
            image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?q=80&w=800&auto=format&fit=crop',
        },
        // === CHINESE ===
        {
            id: 'c1',
            categoryId: 'chinese',
            name: 'Chicken Chowmein',
            price: 450,
            description: 'Stir-fried noodles with chicken.',
            image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'c2',
            categoryId: 'chinese',
            name: 'Chicken Shashlik',
            price: 550,
            description: 'Grilled skewers with bell peppers.',
            image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'c3',
            categoryId: 'chinese',
            name: 'Egg Fried Rice',
            price: 350,
            description: 'Classic fried rice with eggs.',
            image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'c4',
            categoryId: 'chinese',
            name: 'Hot & Sour Soup',
            price: 250,
            description: 'Tangy and spicy soup.',
            image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop',
        },
        // === STREET FOOD ===
        {
            id: 'sf1',
            categoryId: 'street',
            name: 'Samosa',
            price: 80,
            unit: '2 pcs',
            description: 'Crispy potato-filled pastries.',
            image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'sf2',
            categoryId: 'street',
            name: 'Samosa Chaat',
            price: 150,
            description: 'Crushed samosa with chutneys.',
            image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'sf3',
            categoryId: 'street',
            name: 'Dahi Baray',
            price: 200,
            description: 'Lentil dumplings in spiced yogurt.',
            image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'sf4',
            categoryId: 'street',
            name: 'Gol Gappay',
            price: 150,
            description: 'Crispy puris with tangy water.',
            image: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'sf5',
            categoryId: 'street',
            name: 'Pakora',
            price: 120,
            description: 'Crispy fritters, assorted.',
            image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?q=80&w=800&auto=format&fit=crop',
        },
        // === DESSERTS ===
        {
            id: 'd1',
            categoryId: 'dessert',
            name: 'Gulab Jamun',
            price: 200,
            unit: '4 pcs',
            description: 'Hot milk dumplings in syrup.',
            image: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'd2',
            categoryId: 'dessert',
            name: 'Kheer',
            price: 250,
            description: 'Creamy rice pudding.',
            image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'd3',
            categoryId: 'dessert',
            name: 'Gajar Ka Halwa',
            price: 300,
            description: 'Warm carrot pudding with nuts.',
            image: 'https://images.unsplash.com/photo-1567337710282-00832b415979?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'd4',
            categoryId: 'dessert',
            name: 'Ras Malai',
            price: 350,
            description: 'Soft paneer in sweet milk.',
            image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'd5',
            categoryId: 'dessert',
            name: 'Shahi Tukray',
            price: 280,
            description: 'Fried bread in sweetened milk.',
            image: 'https://images.unsplash.com/photo-1551326844-4df70f78d0e9?q=80&w=800&auto=format&fit=crop',
        },
        // === BEVERAGES ===
        {
            id: 'be1',
            categoryId: 'beverages',
            name: 'Doodh Patti',
            price: 100,
            description: 'Strong Pakistani milk tea.',
            image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'be2',
            categoryId: 'beverages',
            name: 'Kashmiri Chai',
            price: 180,
            description: 'Pink tea with nuts.',
            image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'be3',
            categoryId: 'beverages',
            name: 'Lassi (Sweet)',
            price: 180,
            description: 'Creamy yogurt drink.',
            image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'be4',
            categoryId: 'beverages',
            name: 'Fresh Lime',
            price: 150,
            description: 'Refreshing lime soda.',
            image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'be5',
            categoryId: 'beverages',
            name: 'Soft Drink',
            price: 120,
            description: 'Chilled Pepsi, Sprite, 7Up.',
            image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 'be6',
            categoryId: 'beverages',
            name: 'Mineral Water',
            price: 80,
            description: '500ml bottled water.',
            image: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?q=80&w=800&auto=format&fit=crop',
        },
        // === SIDES & EXTRAS ===
        {
            id: 's1',
            categoryId: 'sides',
            name: 'Raita',
            price: 100,
            description: 'Yogurt with cucumber & mint.',
            image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 's2',
            categoryId: 'sides',
            name: 'Green Salad',
            price: 150,
            description: 'Fresh garden salad.',
            image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 's3',
            categoryId: 'sides',
            name: 'Russian Salad',
            price: 200,
            description: 'Creamy mayo vegetable salad.',
            image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 's4',
            categoryId: 'sides',
            name: 'French Fries',
            price: 250,
            description: 'Crispy golden fries.',
            image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=800&auto=format&fit=crop',
        },
        {
            id: 's5',
            categoryId: 'sides',
            name: 'Achar (Pickle)',
            price: 80,
            description: 'Spicy mixed pickle.',
            image: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?q=80&w=800&auto=format&fit=crop',
        }
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
