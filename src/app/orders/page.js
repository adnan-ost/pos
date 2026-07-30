'use client';
import { useState, useEffect } from 'react';
import styles from './orders.module.css';
import { getOrders, updateOrderStatus, getMenuItems } from '@/lib/supabaseDb';
import { supabase } from '@/lib/supabase';
import {
    getOrderNumber, formatOrderDate, buildImageMap, resolveItemImage, formatModifiers
} from '@/lib/orderDisplay';
import LiveClock from '@/components/Layout/LiveClock';
import {
    UtensilsCrossed, ArrowRight, LayoutGrid, List, UserRound, Armchair,
    ShoppingBag, Bike, Loader2, ClipboardList, Layers, Wallet
} from 'lucide-react';

const ORDER_TYPE = {
    'dine-in': { label: 'Dine-in', Icon: UtensilsCrossed },
    'takeaway': { label: 'Takeaway', Icon: ShoppingBag },
    'delivery': { label: 'Delivery', Icon: Bike }
};

const STATUS_LABEL = {
    new: 'New',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled'
};

const VIEWS = [
    { key: 'grid', label: 'Grid view', Icon: LayoutGrid },
    { key: 'list', label: 'List view', Icon: List }
];

// Kitchen status filters, plus one for money still owed
const FILTERS = ['all', 'unpaid', 'new', 'preparing', 'ready', 'completed'];

const FILTER_LABEL = { all: 'All', unpaid: 'Unpaid' };

const isOpenTab = (order) => order.payment_status === 'unpaid';

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [itemImages, setItemImages] = useState({});
    const [view, setView] = useState('grid');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getMenuItems().then(items => setItemImages(buildImageMap(items)));

        // Load orders on mount
        loadOrders();

        // Restore the operator's last view choice
        const saved = localStorage.getItem('orders:view');
        if (saved === 'grid' || saved === 'list') setView(saved);

        // Real-time subscription for new orders
        const subscription = supabase
            .channel('orders_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
                loadOrders();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const loadOrders = async () => {
        try {
            const data = await getOrders();
            setOrders(data);
        } catch (error) {
            console.error("Failed to load orders", error);
        } finally {
            setIsLoading(false);
        }
    };

    const changeView = (next) => {
        setView(next);
        localStorage.setItem('orders:view', next);
    };

    const filteredOrders = orders.filter(order => {
        if (activeTab === 'all') return true;
        // "Unpaid" cuts across the kitchen flow: an open tab can be at any
        // stage, including served, and still owe money
        if (activeTab === 'unpaid') return isOpenTab(order) && order.status !== 'cancelled';
        return order.status === activeTab;
    });

    const handleStatusUpdate = async (orderId, currentStatus) => {
        const flow = ['new', 'preparing', 'ready', 'completed'];
        const currentIndex = flow.indexOf(currentStatus);
        if (currentIndex < flow.length - 1) {
            const nextStatus = flow[currentIndex + 1];
            try {
                await updateOrderStatus(orderId, nextStatus);
                // State will auto-update via subscription, but for instant feedback:
                loadOrders();
            } catch (error) {
                console.error("Failed to update status", error);
            }
        }
    };

    const getStatusLabel = (status) => STATUS_LABEL[status] || status;

    const unpaidCount = orders.filter(o => isOpenTab(o) && o.status !== 'cancelled').length;

    // Rounds and payment state — an open tab reads differently to a paid order
    const PaymentChips = ({ order }) => {
        const rounds = order.round_count || 1;
        return (
            <>
                {rounds > 1 && (
                    <span className={styles.metaChip}>
                        <Layers size={13} aria-hidden="true" />
                        {rounds} rounds
                    </span>
                )}
                {isOpenTab(order) ? (
                    <span className={`${styles.metaChip} ${styles.unpaidChip}`}>
                        <Wallet size={13} aria-hidden="true" />
                        Unpaid tab
                    </span>
                ) : order.payment_mode && (
                    <span className={styles.metaChip}>
                        <Wallet size={13} aria-hidden="true" />
                        {order.payment_mode === 'card' ? 'Card' : 'Cash'}
                    </span>
                )}
            </>
        );
    };

    // Order type, table and server — shown on both views
    const OrderMeta = ({ order }) => {
        const type = ORDER_TYPE[order.order_type];
        return (
            <div className={styles.metaRow}>
                {type && (
                    <span className={styles.metaChip}>
                        <type.Icon size={13} aria-hidden="true" />
                        {type.label}
                    </span>
                )}
                {order.table_number && (
                    <span className={styles.metaChip}>
                        <Armchair size={13} aria-hidden="true" />
                        {order.table_number}
                    </span>
                )}
                {order.waiter_name && (
                    <span className={`${styles.metaChip} ${styles.waiterChip}`}>
                        <UserRound size={13} aria-hidden="true" />
                        {order.waiter_name}
                    </span>
                )}
                <PaymentChips order={order} />
            </div>
        );
    };

    const ItemThumb = ({ item, size = 36 }) => {
        const image = resolveItemImage(item, itemImages);
        return image
            ? <img src={image} alt="" className={styles.itemThumb} style={{ width: size, height: size }} />
            : (
                <div className={styles.itemThumbFallback} style={{ width: size, height: size }}>
                    <UtensilsCrossed size={Math.round(size * 0.45)} />
                </div>
            );
    };

    const NextStatusBtn = ({ order }) => (
        <button
            className={styles.actionBtn}
            onClick={() => handleStatusUpdate(order.id, order.status)}
        >
            Next Status
            <ArrowRight size={15} aria-hidden="true" />
        </button>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Orders</h1>
                    <LiveClock className={styles.clock} />
                </div>

                <div className={styles.headerRight}>
                    <div className={styles.filters}>
                        {FILTERS.map(tab => (
                            <button
                                key={tab}
                                className={`${styles.filterTab} ${activeTab === tab ? styles.active : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {FILTER_LABEL[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)}
                                {tab === 'unpaid' && unpaidCount > 0 && (
                                    <span className={styles.filterCount}>{unpaidCount}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className={styles.viewToggle}>
                        {VIEWS.map(({ key, label, Icon }) => (
                            <button
                                key={key}
                                className={`${styles.viewBtn} ${view === key ? styles.activeView : ''}`}
                                onClick={() => changeView(key)}
                                title={label}
                                aria-label={label}
                                aria-pressed={view === key}
                            >
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className={styles.stateBlock}>
                    <Loader2 className={styles.spinner} size={32} />
                    <p>Loading orders…</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className={styles.stateBlock}>
                    <ClipboardList size={32} />
                    <p>No orders in this category.</p>
                </div>
            ) : view === 'grid' ? (
                /* ===== GRID ===== */
                <div className={styles.ordersGrid}>
                    {filteredOrders.map(order => (
                        <div key={order.id} className={styles.orderCard}>
                            <div className={styles.cardHeader}>
                                <div>
                                    <div className={styles.orderId}>Order #{getOrderNumber(order)}</div>
                                    <div className={styles.orderTime}>
                                        {formatOrderDate(order.created_at)}
                                    </div>
                                </div>
                                <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                                    {getStatusLabel(order.status)}
                                </span>
                            </div>

                            <OrderMeta order={order} />

                            <div className={styles.itemsList}>
                                {order.items.map((item, idx) => {
                                    const mods = formatModifiers(item);
                                    return (
                                        <div key={idx} className={styles.itemRow}>
                                            <ItemThumb item={item} />
                                            <div className={styles.itemInfo}>
                                                <div className={styles.itemName}>
                                                    <span className={styles.itemQty}>{item.qty}x</span>
                                                    {item.name}
                                                </div>
                                                {mods && (
                                                    <div className={styles.itemModifiers}>{mods}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className={styles.cardFooter}>
                                <div className={styles.totalAmount}>
                                    Rs. {order.total.toLocaleString()}
                                </div>
                                {order.status !== 'completed' && <NextStatusBtn order={order} />}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* ===== LIST ===== */
                <div className={styles.listWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Placed</th>
                                <th>Type / Table</th>
                                <th>Waiter</th>
                                <th>Items</th>
                                <th>Status</th>
                                <th className={styles.alignRight}>Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(order => {
                                const type = ORDER_TYPE[order.order_type];
                                return (
                                    <tr key={order.id}>
                                        <td className={styles.cellStrong}>
                                            #{getOrderNumber(order)}
                                        </td>
                                        <td className={styles.cellMuted}>
                                            {formatOrderDate(order.created_at)}
                                        </td>
                                        <td>
                                            <span className={styles.cellInline}>
                                                {type && <type.Icon size={14} aria-hidden="true" />}
                                                {type?.label || order.order_type}
                                                {order.table_number && ` · ${order.table_number}`}
                                            </span>
                                        </td>
                                        <td className={styles.cellMuted}>
                                            {order.waiter_name || '—'}
                                        </td>
                                        <td>
                                            <div className={styles.listThumbs}>
                                                {order.items.slice(0, 4).map((item, idx) => (
                                                    <ItemThumb key={idx} item={item} size={28} />
                                                ))}
                                                {order.items.length > 4 && (
                                                    <span className={styles.moreCount}>
                                                        +{order.items.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                        </td>
                                        <td className={`${styles.cellStrong} ${styles.alignRight}`}>
                                            Rs. {order.total.toLocaleString()}
                                            {isOpenTab(order) && (
                                                <div className={styles.unpaidNote}>
                                                    Unpaid
                                                    {(order.round_count || 1) > 1 &&
                                                        ` · ${order.round_count} rounds`}
                                                </div>
                                            )}
                                        </td>
                                        <td className={styles.alignRight}>
                                            {order.status !== 'completed' && <NextStatusBtn order={order} />}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
