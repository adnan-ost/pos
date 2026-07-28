'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './pos.module.css';
import { getMenuItems, getCategories, addOrder, getModifiers, getWaiters } from '@/lib/supabaseDb';

import ModifierModal from '@/components/POS/ModifierModal';
import ReceiptPreview from '@/components/POS/ReceiptPreview';
import LiveClock from '@/components/Layout/LiveClock';

import {
    Soup, Flame, Utensils, Cookie, GlassWater, Plus, CirclePlus,
    Search, Banknote, CreditCard, X, Minus, UserRound, Armchair,
    UtensilsCrossed, ShoppingBag, Bike, Loader2
} from 'lucide-react';

const ORDER_TYPES = [
    { key: 'dine-in', label: 'Dine-in', Icon: UtensilsCrossed },
    { key: 'takeaway', label: 'Takeaway', Icon: ShoppingBag },
    { key: 'delivery', label: 'Delivery', Icon: Bike }
];

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
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [loadedItemCount, setLoadedItemCount] = useState(null);

    // Checkout State
    const [showReceipt, setShowReceipt] = useState(false);
    const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' or 'card'

    // Order details
    const [waiters, setWaiters] = useState([]);
    const [waiterId, setWaiterId] = useState('');
    const [tableNumber, setTableNumber] = useState('');
    const [orderType, setOrderType] = useState('dine-in');

    // Load menu data from Supabase
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                const [categories, items, modifiers] = await Promise.all([
                    getCategories(),
                    getMenuItems(),
                    getModifiers()
                ]);

                console.debug('POS loadData:', { categoriesCount: categories.length, itemsCount: items.length, modifiersCount: Object.keys(modifiers).length });
                setMenuData({ categories, items, modifiers });
                setLoadedItemCount(items.length);
            } catch (error) {
                console.error("Failed to load POS data", error);
                setLoadError(error?.message || 'Failed to load menu data');
                setLoadedItemCount(0);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
        getWaiters().then(setWaiters);
    }, []);

    // Filter items based on category and search
    const filteredItems = useMemo(() => {
        let items = activeCategory === 'all'
            ? menuData.items
            : menuData.items.filter(item => item.category_id === activeCategory);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query)
            );
        }

        return items;
    }, [menuData.items, activeCategory, searchQuery]);

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

    const selectedWaiter = waiters.find(w => w.id === waiterId);

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
            order_type: orderType,
            // Only dine-in occupies a table
            table_number: orderType === 'dine-in' ? tableNumber.trim() || null : null,
            waiter_id: waiterId || null,
            // Denormalised so the ticket still names the server if staff change
            waiter_name: selectedWaiter?.name || null,
            status: 'new' // fires the ticket to the kitchen display
        };

        try {
            await addOrder(order);
            alert('Printing Receipt... Order sent to kitchen!');
            setCart([]);
            setTableNumber('');
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
                        <Search className={styles.searchIcon} size={18} aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Search menu..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className={styles.customerInfo}>
                        <LiveClock className={styles.headerClock} />
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
                    {isLoading ? (
                        <div className={styles.emptyState}>
                            <Loader2 className={styles.loadingSpinner} size={28} />
                            <h3>Loading menu...</h3>
                        </div>
                    ) : filteredItems.length === 0 && (
                        <div className={styles.emptyState}>
                            {loadError ? (
                                <>
                                    <h3>Unable to load menu items</h3>
                                    <p>{loadError}</p>
                                </>
                            ) : loadedItemCount === 0 ? (
                                <>
                                    <h3>No menu items returned</h3>
                                    <p>Check Supabase row access, policies, or the correct project environment.</p>
                                </>
                            ) : (
                                <h3>No items found</h3>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Section (Right Side) */}
            <div className={styles.cartSection}>
                <div className={styles.cartHeader}>
                    <h2>Current Order</h2>
                    <span className={styles.orderId}>#1024</span>
                </div>

                {/* Order details: who is serving, and where */}
                <div className={styles.orderDetails}>
                    <div className={styles.orderTypeRow}>
                        {ORDER_TYPES.map(({ key, label, Icon }) => (
                            <button
                                key={key}
                                type="button"
                                className={`${styles.typeBtn} ${orderType === key ? styles.activeType : ''}`}
                                onClick={() => setOrderType(key)}
                            >
                                <Icon size={16} aria-hidden="true" />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className={styles.detailFields}>
                        <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                                <UserRound size={14} aria-hidden="true" />
                                Waiter
                            </span>
                            <select
                                className={styles.fieldInput}
                                value={waiterId}
                                onChange={(e) => setWaiterId(e.target.value)}
                            >
                                <option value="">Unassigned</option>
                                {waiters.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.code ? `${w.code} · ${w.name}` : w.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {orderType === 'dine-in' && (
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>
                                    <Armchair size={14} aria-hidden="true" />
                                    Table
                                </span>
                                <input
                                    type="text"
                                    className={styles.fieldInput}
                                    placeholder="e.g. T4"
                                    value={tableNumber}
                                    onChange={(e) => setTableNumber(e.target.value)}
                                />
                            </label>
                        )}
                    </div>
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
                                        <button onClick={() => updateQty(idx, -1)} aria-label="Decrease quantity">
                                            <Minus size={14} />
                                        </button>
                                        <span>{item.qty}</span>
                                        <button onClick={() => updateQty(idx, 1)} aria-label="Increase quantity">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.cartItemRight}>
                                    <div className={styles.cartItemTotal}>
                                        Rs. {item.price * item.qty}
                                    </div>
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeItem(idx)}
                                        aria-label={`Remove ${item.name}`}
                                    >
                                        <X size={16} />
                                    </button>
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
                            <Banknote size={18} aria-hidden="true" />
                            Cash
                        </button>
                        <button
                            className={`${styles.modeBtn} ${paymentMode === 'card' ? styles.activeMode : ''}`}
                            onClick={() => setPaymentMode('card')}
                        >
                            <CreditCard size={18} aria-hidden="true" />
                            Card
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
