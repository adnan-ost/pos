'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './pos.module.css';
import { getMenuItems, getCategories, addOrder } from '@/lib/supabaseDb';

import ModifierModal from '@/components/POS/ModifierModal';
import ReceiptPreview from '@/components/POS/ReceiptPreview';

import { Soup, Flame, Utensils, Cookie, GlassWater, Plus, CirclePlus } from 'lucide-react';

const CategoryIcon = ({ name, size = 18 }) => {
    const icons = {
        'Soup': Soup,
        'Flame': Flame,
        'Utensils': Utensils,
        'Cookie': Cookie,
        'GlassWater': GlassWater,
        'Plus': CirclePlus
    };
    const Icon = icons[name] || Utensils;
    return <Icon size={size} />;
};

export default function POSPage() {
    const [menuData, setMenuData] = useState({ categories: [], items: [], modifiers: {} });
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [modifyingItem, setModifyingItem] = useState(null);

    // Checkout State
    const [showReceipt, setShowReceipt] = useState(false);
    const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' or 'card'

    // Load menu data from Supabase
    useEffect(() => {
        const loadData = async () => {
            try {
                const [categories, items] = await Promise.all([
                    getCategories(),
                    getMenuItems()
                ]);
                // TODO: fetch modifiers from DB
                const modifiers = {
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
                };
                setMenuData({ categories, items, modifiers });
            } catch (error) {
                console.error("Failed to load POS data", error);
            }
        };
        loadData();
    }, []);

    // Filter items based on category and search
    const filteredItems = useMemo(() => {
        let items = menuData.items;

        // Filter by Category (unless 'all')
        if (activeCategory !== 'all') {
            items = items.filter(item => item.category_id === activeCategory);
        }

        // Filter by Search
        if (searchQuery) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return items;
    }, [activeCategory, searchQuery, menuData.items]);

    // Handle Item Click
    const handleItemClick = (item) => {
        if ((item.variants && item.variants.length > 0) || (item.modifiers && item.modifiers.length > 0)) {
            setModifyingItem(item);
        } else {
            addToCart({ ...item, uniqueId: item.id }); // Simple item
        }
    };

    // Add Item to Cart (from Modal or Direct)
    const addToCart = (item) => {
        setCart(prev => {
            const existingIndex = prev.findIndex(i => i.uniqueId === item.uniqueId);

            if (existingIndex >= 0) {
                const newCart = [...prev];
                newCart[existingIndex].qty += 1;
                return newCart;
            }
            return [...prev, { ...item, qty: 1 }];
        });
        setModifyingItem(null);
    };

    // Update Cart Quantity
    const updateQty = (index, change) => {
        setCart(prev => {
            const newCart = [...prev];
            const item = newCart[index];
            const newQty = item.qty + change;

            if (newQty <= 0) {
                return prev.filter((_, i) => i !== index);
            }
            newCart[index] = { ...item, qty: newQty };
            return newCart;
        });
    };

    // Remove Item
    const removeItem = (index) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    // Tax Toggle
    const [includeTax, setIncludeTax] = useState(true);

    // Cart Calculations
    const totals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => {
            return sum + (item.price * item.qty);
        }, 0);
        const tax = includeTax ? Math.round(subtotal * 0.16) : 0; // 16% FBR Tax
        return { subtotal, tax, total: subtotal + tax };
    }, [cart, includeTax]);

    // Checkout Handler
    const handleCheckout = () => {
        if (cart.length === 0) return;
        setShowReceipt(true);
    };

    const handlePrint = async () => {
        // In real app: window.print() or thermal printer API
        const order = {
            items: cart,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            // paymentMode,
            // includeTax,
            // customerType: 'Walk-in',
            order_type: 'dine-in',
            status: 'completed'
        };

        try {
            await addOrder(order);
            alert('Printing Receipt... Order Completed!');
            setCart([]);
            setShowReceipt(false);
        } catch (error) {
            console.error("Failed to save order", error);
            alert("Failed to save order");
        }
    };

    return (
        <div className={styles.container}>
            {/* Modals */}
            {modifyingItem && (
                <ModifierModal
                    item={modifyingItem}
                    modifiersData={menuData.modifiers}
                    onClose={() => setModifyingItem(null)}
                    onConfirm={addToCart}
                />
            )}

            {showReceipt && (
                <ReceiptPreview
                    cart={cart}
                    totals={totals}
                    includeTax={includeTax}
                    onClose={() => setShowReceipt(false)}
                    onPrint={handlePrint}
                />
            )}

            {/* Main Content (Left Side) */}
            <div className={styles.mainContent}>
                <header className={styles.header}>
                    <div className={styles.searchBar}>
                        <span className={styles.searchIcon}>🔍</span>
                        <input
                            type="text"
                            placeholder="Search menu..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className={styles.customerInfo}>
                        <span>Walk-in Customer</span>
                    </div>
                </header>

                {/* Category Tabs */}
                <div className={styles.categories}>
                    <button
                        className={`${styles.categoryTab} ${activeCategory === 'all' ? styles.active : ''}`}
                        onClick={() => setActiveCategory('all')}
                    >
                        All
                    </button>
                    {menuData.categories.map(cat => (
                        <button
                            key={cat.id}
                            className={`${styles.categoryTab} ${activeCategory === cat.id ? styles.active : ''}`}
                            onClick={() => setActiveCategory(cat.id)}
                        >
                            <CategoryIcon name={cat.icon} />
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Menu Grid */}
                <div className={styles.menuGrid}>
                    {filteredItems.map(item => (
                        <div key={item.id} className={styles.menuItem} onClick={() => handleItemClick(item)}>
                            <div className={styles.imageContainer}>
                                {item.image && <img src={item.image} alt={item.name} />}
                            </div>
                            <div className={styles.itemContent}>
                                <div className={styles.itemHeader}>
                                    <h3>{item.name}</h3>
                                    <span className={styles.itemPrice}>Rs. {item.price}</span>
                                </div>

                                <p className={styles.itemDesc}>{item.description}</p>

                                {item.variants && <span className={styles.badge}>Variants</span>}
                            </div>
                            <button className={styles.addBtn}><Plus size={16} /></button>
                        </div>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className={styles.emptyState}>No items found</div>
                    )}
                </div>
            </div>

            {/* Cart Section (Right Side) */}
            <div className={styles.cartSection}>
                <div className={styles.cartHeader}>
                    <h2>Current Order</h2>
                    <span className={styles.orderId}>#1024</span>
                </div>

                <div className={styles.cartItems}>
                    {cart.length === 0 ? (
                        <div className={styles.emptyCart}>No items added</div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={idx} className={styles.cartItemRow}>
                                <div className={styles.cartItemInfo}>
                                    <h4>{item.name}</h4>
                                    {item.selectedModifiers && (
                                        <div className={styles.modifiersList} style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                                            {Object.values(item.selectedModifiers).flat().map((m, i) => (
                                                <span key={i}>{m.name}{i < Object.values(item.selectedModifiers).flat().length - 1 ? ', ' : ''}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className={styles.qtyControls}>
                                        <button onClick={() => updateQty(idx, -1)}>-</button>
                                        <span>{item.qty}</span>
                                        <button onClick={() => updateQty(idx, 1)}>+</button>
                                    </div>
                                </div>
                                <div className={styles.cartItemRight}>
                                    <div className={styles.cartItemTotal}>
                                        Rs. {item.price * item.qty}
                                    </div>
                                    <button className={styles.removeBtn} onClick={() => removeItem(idx)}>×</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={styles.cartSummary}>
                    {/* Payment Mode */}
                    <div className={styles.paymentMode}>
                        <button
                            className={`${styles.modeBtn} ${paymentMode === 'cash' ? styles.activeMode : ''}`}
                            onClick={() => setPaymentMode('cash')}
                        >
                            💵 Cash
                        </button>
                        <button
                            className={`${styles.modeBtn} ${paymentMode === 'card' ? styles.activeMode : ''}`}
                            onClick={() => setPaymentMode('card')}
                        >
                            💳 Card
                        </button>
                    </div>

                    {/* FBR Tax Toggle */}
                    <label className={styles.taxToggle}>
                        <input
                            type="checkbox"
                            checked={includeTax}
                            onChange={(e) => setIncludeTax(e.target.checked)}
                        />
                        <span>Include FBR Tax (16%)</span>
                    </label>

                    <div className={styles.summaryRow}>
                        <span>Subtotal</span>
                        <span>Rs. {totals.subtotal.toLocaleString()}</span>
                    </div>
                    <div className={styles.summaryRow}>
                        <span>Tax (16%)</span>
                        <span>Rs. {totals.tax.toLocaleString()}</span>
                    </div>
                    <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                        <span>Total</span>
                        <span>Rs. {totals.total.toLocaleString()}</span>
                    </div>

                    <button className={styles.checkoutBtn} onClick={handleCheckout}>
                        Checkout (Rs. {totals.total.toLocaleString()})
                    </button>
                </div>
            </div>
        </div>
    );
}
