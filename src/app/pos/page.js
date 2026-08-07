'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './pos.module.css';
import {
    getMenuItems, getCategories, addOrder, getModifiers, getWaiters,
    getOpenTabs, appendRoundToOrder, settleOrder, getTaxRate, findCustomerByPhone
} from '@/lib/supabaseDb';
import { useRealtimeTable } from '@/lib/useRealtimeTable';
import { calcTotals, itemRound, DEFAULT_TAX_RATE } from '@/lib/orderTotals';
import { getOrderNumber, formatOrderDate } from '@/lib/orderDisplay';
import { loadCartDraft, saveCartDraft, clearCartDraft } from '@/lib/cartDraft';
import { getSettings } from '@/app/settings/actions';
import { printReceipt } from '@/lib/printReceipt';

import ModifierModal from '@/components/POS/ModifierModal';
import ReceiptPreview from '@/components/POS/ReceiptPreview';
import TabsDrawer from '@/components/POS/TabsDrawer';
import LiveClock from '@/components/Layout/LiveClock';
import { useRole } from '@/components/Layout/AppLayout';

import {
    Soup, Flame, Utensils, Cookie, GlassWater, Plus, CirclePlus,
    Search, Banknote, CreditCard, X, Minus, UserRound, Armchair, Phone, MapPin,
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
    const role = useRole();
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
    const [pendingInvoiceNo, setPendingInvoiceNo] = useState(null);

    /*
     * One id per checkout attempt, reused on retry.
     *
     * Without it a timeout during checkout is unrecoverable: the cashier can't
     * tell whether the order landed, retries, and gets a second order because
     * addOrder mints a fresh order_number each call. Deliberately NOT cleared in
     * the error path — reusing it is the whole point.
     */
    const [pendingRequestId, setPendingRequestId] = useState(null);

    // Order details
    const [waiters, setWaiters] = useState([]);
    const [waiterId, setWaiterId] = useState('');
    const [tableNumber, setTableNumber] = useState('');
    const [orderType, setOrderType] = useState('dine-in');
    const [includeTax, setIncludeTax] = useState(true);
    const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
    // Absent column reads as enabled, matching how qr_enabled degrades
    const [autoPrint, setAutoPrint] = useState(true);

    // Discount on the bill being paid
    const [discountMode, setDiscountMode] = useState('amount'); // 'amount' | 'percent'
    const [discountValue, setDiscountValue] = useState('');
    const [discountReason, setDiscountReason] = useState('');

    // Who the order is for. Needed for delivery, useful for takeaway callbacks.
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerFound, setCustomerFound] = useState(false);

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

        /*
         * Restore an unsent basket. Done here rather than in a useState
         * initialiser because localStorage doesn't exist during the server
         * render, and seeding state from it there would hydrate mismatched.
         */
        const draft = loadCartDraft();
        if (draft) {
            setCart(draft.cart);
            setOrderType(draft.orderType || 'dine-in');
            setTableNumber(draft.tableNumber || '');
            setWaiterId(draft.waiterId || '');
            setCustomerName(draft.customerName || '');
            setCustomerPhone(draft.customerPhone || '');
            setCustomerAddress(draft.customerAddress || '');
            setIncludeTax(draft.includeTax ?? true);
            // The tab itself is deliberately not restored: it may have been
            // settled on another terminal while this one was away, and
            // reattaching to a closed bill is worse than starting detached.
            setNotice('Recovered an unsent order from this device.');
        }
        // Rate comes from store_settings so it survives a rate change without a
        // deploy; getTaxRate falls back to the default if it can't be read.
        getTaxRate().then(setTaxRate);
        getSettings().then(s => setAutoPrint(s?.auto_print !== false));
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
    }, [loadTabs]);

    // Tabs can move under us — the kitchen bumps a ticket, another terminal
    // settles a bill — including while this terminal's socket was down.
    useRealtimeTable({ table: 'orders', channel: 'pos_tabs_channel', onChange: loadTabs });

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(''), 3500);
        return () => clearTimeout(timer);
    }, [notice]);

    /*
     * Mirror the unsent basket to the device on every change. Cheap enough to do
     * eagerly — the alternative is debouncing and losing the last few seconds,
     * which is exactly the window a crash happens in.
     */
    useEffect(() => {
        saveCartDraft({
            cart,
            orderType,
            tableNumber,
            waiterId,
            customerName,
            customerPhone,
            customerAddress,
            includeTax,
        });
    }, [cart, orderType, tableNumber, waiterId, customerName, customerPhone, customerAddress, includeTax]);

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
        // Sold-out items stay on the grid so staff can tell a customer it's off
        // tonight, but they can't be rung up.
        if (item.is_available === false) return;

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
    const discountAmount = useMemo(() => {
        const value = Number(discountValue) || 0;
        if (value <= 0) return 0;
        // Percentages are an input convenience; what gets stored and charged is
        // always the resulting rupee amount.
        if (discountMode === 'percent') {
            const base = [...(tab?.items || []), ...cart]
                .reduce((sum, i) => sum + i.price * i.qty, 0);
            return Math.round(base * Math.min(value, 100) / 100);
        }
        return Math.round(value);
    }, [discountValue, discountMode, tab, cart]);

    const priceOpts = useMemo(() => ({ taxRate }), [taxRate]);

    // The round on its own is never discounted — a discount applies to the bill
    // being paid, and applying it here as well would double-count it.
    const roundTotals = useMemo(() => calcTotals(cart, includeTax, priceOpts), [cart, includeTax, priceOpts]);
    const tabTotals = useMemo(
        () => calcTotals(tab?.items || [], includeTax, priceOpts),
        [tab, includeTax, priceOpts]
    );
    const billItems = useMemo(() => [...(tab?.items || []), ...cart], [tab, cart]);
    const billTotals = useMemo(
        () => calcTotals(billItems, includeTax, { ...priceOpts, discount: discountAmount }),
        [billItems, includeTax, priceOpts, discountAmount]
    );

    /*
     * calcTotals hands back `taxable` for display; the orders table has no such
     * column, and `discount` only exists once migration 11 has run, so writes
     * are narrowed to the columns that are actually there.
     */
    const billColumns = (totals) => ({
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        ...(totals.discount > 0 && { discount: totals.discount }),
    });

    const newInvoiceNumber = () => `FBR-${Date.now().toString().slice(-6)}`;

    /*
     * Sends the receipt on screen to the printer.
     *
     * Called after the save resolves and before the modal closes, which is the
     * only correct order: printing first could hand a customer paper for an
     * order that failed to store, and closing first unmounts the very thing
     * being printed. That sequencing is safe because window.print() blocks
     * within the current task, and React won't flush the state update that
     * unmounts the receipt until the task finishes.
     *
     * With Chrome launched --kiosk-printing this goes straight to the default
     * printer with no dialog. Without that flag it opens the normal print
     * preview, which is the visible sign the terminal isn't set up yet.
     */
    const printIfEnabled = () => {
        if (!autoPrint) return;
        printReceipt();
    };

    // "16%" from a 0.16 rate, without a trailing ".00" on whole percentages
    const taxPercentLabel = `${Number((taxRate * 100).toFixed(2))}%`;

    const nextRound = (tab?.round_count || 0) + 1;
    const selectedWaiter = waiters.find(w => w.id === waiterId);
    const canSettle = Boolean(tab) && cart.length === 0;

    /*
     * Shown in the receipt. billTotals covers both cases: with a tab it's the
     * tab's lines plus anything unsent, and without one billItems is just the
     * cart. Using roundTotals here would drop the discount from a pay-now bill.
     */
    const receiptTotals = billTotals;

    const orderDetails = () => ({
        table_number: orderType === 'dine-in' ? tableNumber.trim() || null : null,
        waiter_id: waiterId || null,
        // Denormalised so the ticket still names the server if staff change
        waiter_name: selectedWaiter?.name || null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        // Only meaningful for delivery, and stored on the order rather than only
        // on the customer: people move, and a past delivery should still say
        // where it actually went.
        customer_address: orderType === 'delivery' ? customerAddress.trim() || null : null
    });

    const clearOrderFields = () => {
        setActiveTabId(null);
        setCart([]);
        setTableNumber('');
        setWaiterId('');
        setOrderType('dine-in');
        setDiscountValue('');
        setDiscountReason('');
        setDiscountMode('amount');
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setCustomerFound(false);
        setPendingInvoiceNo(null);
        setPendingRequestId(null);
        // The order is on the server now, so the local copy is no longer a
        // recovery aid — leaving it would resurrect a completed sale.
        clearCartDraft();
    };

    /*
     * Prefill a returning caller from their phone number. Deliberately manual
     * rather than firing on every keystroke: a lookup per digit is a query per
     * digit, and the operator knows when they've finished typing.
     */
    const lookupCustomer = async () => {
        const phone = customerPhone.trim();
        if (!phone) return;

        const found = await findCustomerByPhone(phone);
        if (found) {
            setCustomerName(found.name === 'Walk-in' ? '' : found.name || '');
            if (found.address) setCustomerAddress(found.address);
            setCustomerFound(true);
            setNotice(`Found ${found.name} — ${found.total_orders || 0} previous orders.`);
        } else {
            setCustomerFound(false);
            setNotice('No previous orders for that number.');
        }
    };

    const attachTab = (target, mode = null) => {
        setActiveTabId(target.id);
        setOrderType(target.order_type || 'dine-in');
        setTableNumber(target.table_number || '');
        setWaiterId(target.waiter_id || '');
        setIncludeTax(target.include_tax ?? true);
        setCustomerName(target.customer_name || '');
        setCustomerPhone(target.customer_phone || '');
        setCustomerAddress(target.customer_address || '');
        // A tab opened before invoice numbers were stored needs one minted at
        // settle time; one that already has a number keeps it.
        if (mode === 'settle' && !target.invoice_number) {
            setPendingInvoiceNo(newInvoiceNumber());
        }
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
        // Fixed now rather than at print time so the number stored on the order
        // is the number on the paper, and a reprint is the same document.
        setPendingInvoiceNo(newInvoiceNumber());
        setPendingRequestId(crypto.randomUUID());
        setReceiptMode('pay-now');
    };

    // Pay-at-the-counter: one round, settled on the spot (the original flow)
    const handlePayNow = async () => {
        setIsSending(true);
        try {
            await addOrder({
                items: cart.map(item => ({ ...item, round: 1 })),
                ...billColumns(billTotals),
                discount_reason: discountAmount > 0 ? discountReason.trim() || null : null,
                invoice_number: pendingInvoiceNo,
                client_request_id: pendingRequestId,
                include_tax: includeTax,
                order_type: orderType,
                ...orderDetails(),
                status: 'new', // fires the ticket to the kitchen display
                payment_status: 'paid',
                payment_mode: paymentMode
            });
            // Stored, so it's safe to hand over paper. Before clearOrderFields,
            // which unmounts the receipt being printed.
            printIfEnabled();
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
        // Same protection as checkout — opening a tab twice would have the
        // kitchen cook the first round twice.
        const requestId = pendingRequestId || crypto.randomUUID();
        setPendingRequestId(requestId);
        try {
            const created = await addOrder({
                items: cart.map(item => ({ ...item, round: 1 })),
                client_request_id: requestId,
                ...billColumns(billTotals),
                include_tax: includeTax,
                order_type: orderType,
                ...orderDetails(),
                status: 'new',
                payment_status: 'unpaid'
            });
            await loadTabs();
            setActiveTabId(created.id);
            setCart([]);
            setPendingRequestId(null);
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
            await settleOrder(tab.id, {
                paymentMode,
                includeTax,
                discount: discountAmount,
                discountReason: discountAmount > 0 ? discountReason.trim() || null : null,
                invoiceNumber: pendingInvoiceNo,
            });
            printIfEnabled();
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
                    /* Keyed by item so picking a different dish remounts with that
                       dish's defaults rather than inheriting the last one's. */
                    key={modifyingItem.id}
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
                    /* A tab already settled once keeps its stored number so a
                       reprint matches the original paper. */
                    invoiceNumber={tab?.invoice_number || pendingInvoiceNo || undefined}
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
                    role={role}
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
                    {filteredItems.map(item => {
                        const soldOut = item.is_available === false;
                        return (
                            <div
                                key={item.id}
                                className={`${styles.menuItem} ${soldOut ? styles.soldOut : ''}`}
                                onClick={() => handleItemClick(item)}
                                aria-disabled={soldOut}
                            >
                                <div className={styles.imageContainer}>
                                    {item.image && <img src={item.image} alt={item.name} />}
                                    {soldOut && <span className={styles.soldOutTag}>Sold out</span>}
                                </div>
                                <div className={styles.itemContent}>
                                    <div className={styles.itemHeader}>
                                        <h3>{item.name}</h3>
                                        <span className={styles.itemPrice}>Rs. {item.price}</span>
                                    </div>

                                    <p className={styles.itemDesc}>{item.description}</p>

                                    {item.variants && <span className={styles.badge}>Variants</span>}
                                </div>
                                {!soldOut && <button className={styles.addBtn}><Plus size={16} /></button>}
                            </div>
                        );
                    })}
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

                    {/* Customer details. Optional for dine-in, but delivery has
                        nowhere to send the food without them. */}
                    {orderType !== 'dine-in' && (
                        <div className={styles.detailsRow}>
                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>
                                    <Phone size={14} aria-hidden="true" />
                                    Phone
                                    {customerFound && <span className={styles.returningTag}>returning</span>}
                                </span>
                                <div className={styles.phoneRow}>
                                    <input
                                        type="tel"
                                        inputMode="tel"
                                        className={styles.fieldInput}
                                        placeholder="03xx xxxxxxx"
                                        value={customerPhone}
                                        onChange={(e) => { setCustomerPhone(e.target.value); setCustomerFound(false); }}
                                        onBlur={lookupCustomer}
                                    />
                                </div>
                            </label>

                            <label className={styles.field}>
                                <span className={styles.fieldLabel}>
                                    <UserRound size={14} aria-hidden="true" />
                                    Name
                                </span>
                                <input
                                    type="text"
                                    className={styles.fieldInput}
                                    placeholder="Customer name"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                />
                            </label>
                        </div>
                    )}

                    {orderType === 'delivery' && (
                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className={styles.fieldLabel}>
                                <MapPin size={14} aria-hidden="true" />
                                Delivery address
                            </span>
                            <textarea
                                className={styles.fieldInput}
                                rows={2}
                                placeholder="House / street / area"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                            />
                        </label>
                    )}
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
                        <span>Include FBR Tax ({taxPercentLabel})</span>
                    </label>

                    {/* Discount. Amount or percent, with a reason, because a
                        discount nobody can account for later is how a till
                        quietly leaks money. */}
                    <div className={styles.discountBlock}>
                        <div className={styles.discountRow}>
                            <div className={styles.discountModes}>
                                <button
                                    type="button"
                                    className={`${styles.discountMode} ${discountMode === 'amount' ? styles.activeMode : ''}`}
                                    onClick={() => setDiscountMode('amount')}
                                >
                                    Rs.
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.discountMode} ${discountMode === 'percent' ? styles.activeMode : ''}`}
                                    onClick={() => setDiscountMode('percent')}
                                >
                                    %
                                </button>
                            </div>
                            <input
                                type="number"
                                min="0"
                                max={discountMode === 'percent' ? 100 : undefined}
                                step="1"
                                inputMode="numeric"
                                className={styles.discountInput}
                                placeholder="Discount"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                            />
                        </div>
                        {discountAmount > 0 && (
                            <input
                                type="text"
                                className={styles.discountReason}
                                placeholder="Reason (staff meal, comp, manager)"
                                value={discountReason}
                                onChange={(e) => setDiscountReason(e.target.value)}
                                maxLength={60}
                            />
                        )}
                    </div>

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
                    {receiptTotals.discount > 0 && (
                        <div className={`${styles.summaryRow} ${styles.discountSummary}`}>
                            <span>Discount{discountReason.trim() ? ` · ${discountReason.trim()}` : ''}</span>
                            <span>− Rs. {receiptTotals.discount.toLocaleString()}</span>
                        </div>
                    )}
                    <div className={styles.summaryRow}>
                        <span>Tax ({taxPercentLabel})</span>
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
