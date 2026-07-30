'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './pos.module.css';
import {
    getMenuItems, getCategories, addOrder, getModifiers, getWaiters,
    getOpenTabs, appendRoundToOrder, settleOrder
} from '@/lib/supabaseDb';
import { supabase } from '@/lib/supabase';
import { calcTotals, itemRound } from '@/lib/orderTotals';
import { getOrderNumber, formatOrderDate } from '@/lib/orderDisplay';

import ModifierModal from '@/components/POS/ModifierModal';
import ReceiptPreview from '@/components/POS/ReceiptPreview';
import TabsDrawer from '@/components/POS/TabsDrawer';
import LiveClock from '@/components/Layout/LiveClock';

import {
    Soup, Flame, Utensils, Cookie, GlassWater, Plus, CirclePlus,
    Search, Banknote, CreditCard, X, Minus, UserRound, Armchair,
    UtensilsCrossed, ShoppingBag, Bike, Loader2, Layers, Receipt, Send
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
    const [receiptMode, setReceiptMode] = useState(null); // 'pay-now' | 'settle'
    const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' or 'card'
    const [isSending, setIsSending] = useState(false);
    const [notice, setNotice] = useState('');

    // Open tabs — unpaid checks the floor can add rounds to and settle later
    const [openTabs, setOpenTabs] = useState([]);
    const [showTabs, setShowTabs] = useState(false);
    const [activeTabId, setActiveTabId] = useState(null);

    // Order details
    const [waiters, setWaiters] = useState([]);
    const [waiterId, setWaiterId] = useState('');
    const [tableNumber, setTableNumber] = useState('');
    const [orderType, setOrderType] = useState('dine-in');
    const [includeTax, setIncludeTax] = useState(true);

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

    const loadTabs = useCallback(async () => {
        const tabs = await getOpenTabs();
        setOpenTabs(tabs);
        return tabs;
    }, []);

    // Tabs can move under us: the kitchen bumps a ticket, or another terminal
    // settles a bill. Follow the table rather than trusting our own snapshot.
    useEffect(() => {
        loadTabs();

        const subscription = supabase
            .channel('pos_tabs_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                loadTabs();
            })
            .subscribe();

        return () => { subscription.unsubscribe(); };
    }, [loadTabs]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(''), 3500);
        return () => clearTimeout(timer);
    }, [notice]);

    /*
     * The attached tab is derived, never stored: if it gets settled on another
     * terminal it simply drops away instead of leaving the POS pointed at a
     * bill that is already closed.
     */
    const tab = useMemo(
        () => openTabs.find(t => t.id === activeTabId) || null,
        [openTabs, activeTabId]
    );

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

    /*
     * Three amounts matter once a tab is in play: what is already on it, what
     * this round adds, and the bill the customer will actually pay.
     */
    const roundTotals = useMemo(() => calcTotals(cart, includeTax), [cart, includeTax]);
    const tabTotals = useMemo(
        () => calcTotals(tab?.items || [], includeTax),
        [tab, includeTax]
    );
    const billItems = useMemo(() => [...(tab?.items || []), ...cart], [tab, cart]);
    const billTotals = useMemo(() => calcTotals(billItems, includeTax), [billItems, includeTax]);

    const nextRound = (tab?.round_count || 0) + 1;
    const selectedWaiter = waiters.find(w => w.id === waiterId);
    const canSettle = Boolean(tab) && cart.length === 0;

    // Shown in the receipt: the whole bill for a tab, just the cart otherwise
    const receiptTotals = tab ? billTotals : roundTotals;

    const orderDetails = () => ({
        table_number: orderType === 'dine-in' ? tableNumber.trim() || null : null,
        waiter_id: waiterId || null,
        // Denormalised so the ticket still names the server if staff change
        waiter_name: selectedWaiter?.name || null
    });

    const clearOrderFields = () => {
        setActiveTabId(null);
        setCart([]);
        setTableNumber('');
        setWaiterId('');
        setOrderType('dine-in');
    };

    const attachTab = (target, mode = null) => {
        setActiveTabId(target.id);
        setOrderType(target.order_type || 'dine-in');
        setTableNumber(target.table_number || '');
        setWaiterId(target.waiter_id || '');
        setIncludeTax(target.include_tax ?? true);
        setShowTabs(false);
        setReceiptMode(mode);
    };

    /*
     * Step away from a tab without closing it. Anything not yet sent stays in
     * the cart — the usual reason to detach is that the round belongs on a
     * different tab, and throwing those lines away would be its own bug.
     */
    const detachTab = () => {
        setActiveTabId(null);
        setTableNumber('');
        setWaiterId('');
        setOrderType('dine-in');
        setNotice(cart.length > 0
            ? 'Tab left open. The unsent items are still in the cart.'
            : 'Tab left open — find it again under Open Tabs.');
    };

    // ---- Sending food and taking money -------------------------------------

    const handleCheckout = () => {
        if (cart.length === 0) return;
        setReceiptMode('pay-now');
    };

    // Pay-at-the-counter: one round, settled on the spot (the original flow)
    const handlePayNow = async () => {
        setIsSending(true);
        try {
            await addOrder({
                items: cart.map(item => ({ ...item, round: 1 })),
                ...roundTotals,
                include_tax: includeTax,
                order_type: orderType,
                ...orderDetails(),
                status: 'new', // fires the ticket to the kitchen display
                payment_status: 'paid',
                payment_mode: paymentMode
            });
            clearOrderFields();
            setReceiptMode(null);
            setNotice('Paid. Order sent to the kitchen.');
        } catch (error) {
            console.error("Failed to save order", error);
            alert("Failed to save order");
        } finally {
            setIsSending(false);
        }
    };

    // Open a tab: food fires now, the bill stays open until they leave
    const handleOpenTab = async () => {
        if (cart.length === 0) return;
        setIsSending(true);
        try {
            const created = await addOrder({
                items: cart.map(item => ({ ...item, round: 1 })),
                ...roundTotals,
                include_tax: includeTax,
                order_type: orderType,
                ...orderDetails(),
                status: 'new',
                payment_status: 'unpaid'
            });
            await loadTabs();
            setActiveTabId(created.id);
            setCart([]);
            setNotice(`Tab #${getOrderNumber(created)} opened — add rounds any time, pay at the end.`);
        } catch (error) {
            console.error('Failed to open tab', error);
            alert('Failed to open tab');
        } finally {
            setIsSending(false);
        }
    };

    // Another round on an existing tab
    const handleSendRound = async () => {
        if (!tab || cart.length === 0) return;
        setIsSending(true);
        try {
            await appendRoundToOrder(tab.id, cart, {
                include_tax: includeTax,
                ...orderDetails()
            });
            await loadTabs();
            setCart([]);
            setNotice(`Round ${nextRound} sent to the kitchen.`);
        } catch (error) {
            console.error('Failed to send round', error);
            alert(error.message || 'Failed to send round');
        } finally {
            setIsSending(false);
        }
    };

    const handleSettle = async () => {
        if (!tab) return;
        setIsSending(true);
        try {
            await settleOrder(tab.id, { paymentMode, includeTax });
            await loadTabs();
            clearOrderFields();
            setReceiptMode(null);
            setNotice('Bill settled.');
        } catch (error) {
            console.error('Failed to settle bill', error);
            alert(error.message || 'Failed to settle bill');
        } finally {
            setIsSending(false);
        }
    };

    const showCartPanel = cart.length > 0 || Boolean(tab);
    const activeType = ORDER_TYPES.find(t => t.key === orderType);

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

            {/* The tab can vanish under us — settled on another terminal — while
                its bill is on screen, so never render a settle receipt without one */}
            {receiptMode && (receiptMode !== 'settle' || tab) && (
                <ReceiptPreview
                    cart={receiptMode === 'settle' ? tab.items : cart}
                    totals={receiptTotals}
                    includeTax={includeTax}
                    invoiceNumber={tab ? `FBR-${getOrderNumber(tab)}` : undefined}
                    meta={tab ? {
                        orderNumber: getOrderNumber(tab),
                        table: tab.table_number,
                        waiter: tab.waiter_name,
                        rounds: tab.round_count || 1
                    } : {
                        table: orderType === 'dine-in' ? tableNumber.trim() : null,
                        waiter: selectedWaiter?.name
                    }}
                    printLabel={receiptMode === 'settle' ? 'Print Bill & Settle' : 'Print & Close'}
                    busy={isSending}
                    onClose={() => setReceiptMode(null)}
                    onPrint={receiptMode === 'settle' ? handleSettle : handlePayNow}
                />
            )}

            {showTabs && (
                <TabsDrawer
                    tabs={openTabs}
                    activeTabId={activeTabId}
                    onClose={() => setShowTabs(false)}
                    onAttach={target => attachTab(target)}
                    onSettle={target => attachTab(target, 'settle')}
                />
            )}

            {notice && <div className={styles.toast}>{notice}</div>}

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

                    <div className={styles.headerRight}>
                        <button
                            className={`${styles.tabsBtn} ${openTabs.length > 0 ? styles.tabsBtnActive : ''}`}
                            onClick={() => setShowTabs(true)}
                        >
                            <Layers size={18} aria-hidden="true" />
                            Open Tabs
                            {openTabs.length > 0 && (
                                <span className={styles.tabsCount}>{openTabs.length}</span>
                            )}
                        </button>

                        <div className={styles.customerInfo}>
                            <LiveClock className={styles.headerClock} />
                        </div>
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

            {/* Cart Section (Right Side) — once there are items, or while a tab is attached */}
            {showCartPanel && (
            <div className={styles.cartSection}>
                <div className={styles.cartHeader}>
                    <div>
                        <h2>{tab ? 'Open Tab' : 'Current Order'}</h2>
                        {tab && (
                            <div className={styles.cartSubtitle}>
                                Opened {formatOrderDate(tab.created_at)} · unpaid
                            </div>
                        )}
                    </div>
                    <div className={styles.cartHeaderRight}>
                        <span className={styles.orderId}>
                            {tab ? `#${getOrderNumber(tab)}` : 'New'}
                        </span>
                        {tab && (
                            <button
                                className={styles.detachBtn}
                                onClick={detachTab}
                                title="Leave this tab open and start a fresh order"
                                aria-label="Leave this tab"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Order details: who is serving, and where */}
                <div className={styles.orderDetails}>
                    {tab ? (
                        // A tab's type is fixed once it is open — it is the same sitting
                        <div className={styles.typeLocked}>
                            {activeType && <activeType.Icon size={15} aria-hidden="true" />}
                            {activeType?.label || orderType}
                            <span className={styles.typeLockedNote}>· paying at the end</span>
                        </div>
                    ) : (
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
                    )}

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
                    {/* Already fired to the kitchen — read-only history of the tab */}
                    {tab && tab.items.length > 0 && (
                        <div className={styles.sentBlock}>
                            <div className={styles.sectionLabel}>
                                <span>Already sent</span>
                                <span>
                                    {tab.round_count || 1} {(tab.round_count || 1) === 1 ? 'round' : 'rounds'}
                                </span>
                            </div>
                            {tab.items.map((item, idx) => (
                                <div key={idx} className={styles.sentRow}>
                                    <span className={styles.sentQty}>{item.qty}x</span>
                                    <span className={styles.sentName}>
                                        {item.name}
                                        <span className={styles.roundTag}>R{itemRound(item)}</span>
                                    </span>
                                    <span className={styles.sentPrice}>
                                        Rs. {(item.price * item.qty).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {cart.length > 0 && tab && (
                        <div className={styles.sectionLabel}>
                            <span>Not sent yet</span>
                            <span>Round {nextRound}</span>
                        </div>
                    )}

                    {cart.map((item, idx) => (
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
                    ))}

                    {tab && cart.length === 0 && (
                        <div className={styles.tabHint}>
                            Tap menu items to add another round, or settle the bill below.
                        </div>
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

                    {tab && (
                        <>
                            <div className={styles.summaryRow}>
                                <span>Already on tab</span>
                                <span>Rs. {tabTotals.subtotal.toLocaleString()}</span>
                            </div>
                            {cart.length > 0 && (
                                <div className={styles.summaryRow}>
                                    <span>This round</span>
                                    <span>Rs. {roundTotals.subtotal.toLocaleString()}</span>
                                </div>
                            )}
                        </>
                    )}

                    <div className={styles.summaryRow}>
                        <span>Subtotal</span>
                        <span>Rs. {receiptTotals.subtotal.toLocaleString()}</span>
                    </div>
                    <div className={styles.summaryRow}>
                        <span>Tax (16%)</span>
                        <span>Rs. {receiptTotals.tax.toLocaleString()}</span>
                    </div>
                    <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                        <span>{tab ? 'Bill total' : 'Total'}</span>
                        <span>Rs. {receiptTotals.total.toLocaleString()}</span>
                    </div>

                    {tab ? (
                        <>
                            <button
                                className={styles.checkoutBtn}
                                onClick={handleSendRound}
                                disabled={cart.length === 0 || isSending}
                            >
                                <Send size={17} aria-hidden="true" />
                                Send Round {nextRound} to Kitchen
                            </button>
                            <button
                                className={styles.secondaryBtn}
                                onClick={() => setReceiptMode('settle')}
                                disabled={!canSettle || isSending}
                                title={canSettle
                                    ? 'Print the bill and take payment'
                                    : 'Send this round to the kitchen first'}
                            >
                                <Receipt size={17} aria-hidden="true" />
                                Settle Bill (Rs. {tabTotals.total.toLocaleString()})
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className={styles.checkoutBtn}
                                onClick={handleCheckout}
                                disabled={cart.length === 0 || isSending}
                            >
                                Send &amp; Pay Now (Rs. {roundTotals.total.toLocaleString()})
                            </button>
                            <button
                                className={styles.secondaryBtn}
                                onClick={handleOpenTab}
                                disabled={cart.length === 0 || isSending}
                                title="Send the food now and keep the bill open"
                            >
                                <Layers size={17} aria-hidden="true" />
                                Open Tab · Pay at the End
                            </button>
                        </>
                    )}
                </div>
            </div>
            )}
        </div>
    );
}
