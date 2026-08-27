import { createClient } from './supabase/client';

const supabase = createClient();
import { calcTotals, DEFAULT_TAX_RATE } from './orderTotals';

// ==================== CATEGORIES ====================

export const getCategories = async () => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
    return data;
};

export const addCategory = async (category) => {
    const { data, error } = await supabase
        .from('categories')
        .insert([category])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateCategory = async (id, updates) => {
    const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteCategory = async (id) => {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return true;
};

// ==================== MENU ITEMS ====================

export const getMenuItems = async () => {
    const { data, error } = await supabase
        .from('menu_items')
        .select('*');

    if (error) {
        console.error('Error fetching menu items:', error);
        return [];
    }
    return data;
};

export const getMenuItemsByCategory = async (categoryId) => {
    if (categoryId === 'all') return getMenuItems();

    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('category_id', categoryId);

    if (error) {
        console.error('Error fetching menu items by category:', error);
        return [];
    }
    return data;
};

export const addMenuItem = async (item) => {
    const { data, error } = await supabase
        .from('menu_items')
        .insert([item])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateMenuItem = async (id, updates) => {
    const { data, error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteMenuItem = async (id) => {
    const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return true;
};

/*
 * "86-ing" an item — marking it sold out for the rest of service.
 *
 * Kept separate from updateMenuItem so the floor can flip availability without
 * holding the whole item form open, and without a stale form overwriting a
 * price someone edited in the office a minute ago.
 */
export const setMenuItemAvailability = async (id, isAvailable) => {
    const { data, error } = await supabase
        .from('menu_items')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// ==================== WAITERS ====================

export const getWaiters = async () => {
    const { data, error } = await supabase
        .from('waiters')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching waiters:', error);
        return [];
    }
    return data;
};

// ==================== ORDERS ====================

/*
 * The statuses a ticket is still work for the kitchen. 'completed' and
 * 'cancelled' are done with, so the board never asks for them.
 */
export const KITCHEN_STATUSES = ['new', 'preparing', 'ready'];

/*
 * Exactly the columns a ticket renders. Spelling them out keeps the receipt
 * snapshot's neighbours — totals, customer details, payment fields — off a
 * screen that displays none of them.
 */
const KITCHEN_COLUMNS =
    'id, order_number, status, order_type, table_number, waiter_name, ' +
    'payment_status, items, notes, round_count, created_at, last_round_at';

/*
 * Live tickets for the kitchen display.
 *
 * Filtered in Postgres rather than in the browser. The board refetches on every
 * realtime event and every 15 seconds all service, and it used to pull every
 * order the restaurant had ever taken — each with its full JSONB item snapshot
 * — to render the dozen that are actually live. That query gets heavier every
 * week the till runs, on the one screen that must never stall.
 */
export const getKitchenOrders = async () => {
    const { data, error } = await supabase
        .from('orders')
        .select(KITCHEN_COLUMNS)
        .in('status', KITCHEN_STATUSES)
        // Oldest fired first, matching how the kitchen works the board; the
        // partial index in migration 14 serves both the filter and this order.
        .order('last_round_at', { ascending: true });

    if (error) {
        console.error('Error fetching kitchen orders:', error);
        return [];
    }
    return data;
};

export const ORDERS_PAGE_SIZES = [25, 50, 100];

/*
 * Paged, filtered order history.
 *
 * Filtering and slicing happen in Postgres rather than in the browser: this
 * table only ever grows, and a till that fetched every order it had ever taken
 * to show twenty-five of them would get slower every week it ran.
 *
 * Returns the total alongside the rows so the pager can show a real count
 * without a second round trip.
 */
export const getOrdersPage = async ({
    page = 1,
    pageSize = 25,
    status = 'all',      // 'all' | 'unpaid' | a kitchen status
    orderType = 'all',
    from = null,         // ISO timestamp, inclusive
    to = null,           // ISO timestamp, inclusive
    sort = 'newest',
    search = '',
} = {}) => {
    let query = supabase.from('orders').select('*', { count: 'exact' });

    /*
     * "Find that order" — by receipt number, who it was for, their phone, or
     * the table it went to. Which of those the operator has to hand varies, so
     * one box searches all four.
     *
     * Commas, parens and the wildcards themselves are stripped: PostgREST's
     * `or` filter is a comma-separated expression list, so a comma in the term
     * would be read as the start of another condition rather than as text.
     */
    const term = search.trim().replace(/[,()*%\\]/g, '');
    if (term) {
        const like = `%${term}%`;
        query = query.or([
            `order_number.ilike.${like}`,
            `customer_name.ilike.${like}`,
            `customer_phone.ilike.${like}`,
            `table_number.ilike.${like}`,
        ].join(','));
    }

    if (status === 'unpaid') {
        // Cuts across the kitchen flow: an open tab can be at any stage,
        // including served, and still owe money.
        query = query.eq('payment_status', 'unpaid').neq('status', 'cancelled');
    } else if (status !== 'all') {
        query = query.eq('status', status);
    }

    if (orderType !== 'all') query = query.eq('order_type', orderType);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const SORTS = {
        newest: ['created_at', false],
        oldest: ['created_at', true],
        highest: ['total', false],
        lowest: ['total', true],
    };
    const [column, ascending] = SORTS[sort] || SORTS.newest;
    query = query.order(column, { ascending });

    // Tie-break on id so equal totals can't shuffle between pages and hide a
    // row, or show one twice, as the operator clicks through.
    if (column !== 'created_at') query = query.order('created_at', { ascending: false });
    query = query.order('id', { ascending: true });

    const start = (page - 1) * pageSize;
    const { data, error, count } = await query.range(start, start + pageSize - 1);

    if (error) {
        console.error('Error fetching orders page:', error);
        return { rows: [], total: 0 };
    }
    return { rows: data || [], total: count ?? 0 };
};

/*
 * Void an order, with the reason recorded.
 *
 * Refuses a bill that is already settled. Money has changed hands at that
 * point, so reversing it is a refund — a flow with its own cash implications
 * that doesn't exist yet. Silently zeroing the revenue while the cash sits in
 * the drawer would be worse than not allowing it.
 */
export const cancelOrder = async (orderId, { reason, by } = {}) => {
    const order = await getOrderById(orderId);

    if (order.status === 'cancelled') {
        throw new Error('This order is already voided.');
    }
    if (order.payment_status === 'paid') {
        throw new Error('This bill is already settled — voiding it would need a refund.');
    }
    if (!reason || !reason.trim()) {
        throw new Error('A reason is required to void an order.');
    }

    // RPC path. The paid-order guard above stays client-side on purpose:
    // void_order CAN reverse a paid bill in the ledger, but offering that at
    // the till is a refund flow that arrives with P2's permissions.
    try {
        const { data, error } = await supabase.rpc('void_order', {
            p_order_id: orderId,
            p_reason: reason.trim(),
            p_by: by || null,
        });
        if (error) throw error;
        return data;
    } catch (error) {
        if (!rpcMissing(error)) throw error;
        console.warn('void_order RPC missing — run migrations 15–17; using legacy update');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('orders')
        .update({
            status: 'cancelled',
            cancelled_at: now,
            cancel_reason: reason.trim(),
            cancelled_by: by || null,
            updated_at: now,
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Counted separately from the current page: the badge means "unpaid overall",
// not "unpaid among the rows you happen to be looking at".
export const getUnpaidOrdersCount = async () => {
    const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'unpaid')
        .neq('status', 'cancelled');

    if (error) {
        console.error('Error counting unpaid orders:', error);
        return 0;
    }
    return count ?? 0;
};

// ==================== TAX RATE ====================

/*
 * The live GST rate, read from store_settings so it can change without a
 * deploy. Cached for the page's lifetime: it is consulted on every price
 * calculation and changes perhaps once a year. An admin who edits it sees the
 * new rate on the next reload of the till, which is the right trade against
 * issuing a query per keystroke in the cart.
 */
let taxRateCache = null;

export const getTaxRate = async () => {
    if (taxRateCache !== null) return taxRateCache;

    const { data, error } = await supabase
        .from('store_settings')
        .select('tax_rate')
        .maybeSingle();

    // Falls back rather than throwing: a till that cannot read a setting should
    // still be able to price an order.
    taxRateCache = (error || data?.tax_rate == null)
        ? DEFAULT_TAX_RATE
        : Number(data.tax_rate);

    return taxRateCache;
};

/*
 * calcTotals also returns `taxable`, which callers display but the orders table
 * has no column for, so every write goes through here.
 *
 * `discount` is omitted when zero so the till keeps working against a database
 * where migration 11 has not been applied yet — an unknown column would
 * otherwise fail the whole write.
 */
const totalsColumns = (totals) => ({
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    ...(totals.discount > 0 && { discount: totals.discount }),
});

/*
 * P1: every write that moves food or money goes through the atomic RPCs
 * (migration 17) — row locks, idempotency, server-recomputed totals. Each
 * wrapper falls back to its legacy direct-table path when the RPC isn't
 * installed, so this client deploys safely against a database where
 * migrations 15–17 haven't landed yet. Migration 18 retires the fallbacks
 * by revoking direct writes — apply it only after this client is live.
 */
const rpcMissing = (error) =>
    Boolean(error) && (
        error.code === 'PGRST202' ||
        /could not find the function|does not exist/i.test(error.message || '')
    );

const createOrderViaRpc = async (order) => {
    const { data, error } = await supabase.rpc('create_order', {
        p_items: order.items,
        p_opts: {
            payment_status: order.payment_status,
            payment_mode: order.payment_mode,
            order_type: order.order_type,
            include_tax: order.include_tax,
            discount: order.discount,
            discount_reason: order.discount_reason,
            table_number: order.table_number,
            waiter_id: order.waiter_id,
            waiter_name: order.waiter_name,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            customer_address: order.customer_address,
        },
        p_client_request_id: order.client_request_id || null,
        // The total the till showed the cashier. The server recomputes from
        // the lines and refuses to store a bill that disagrees with what the
        // customer was told.
        p_expected_total: order.total ?? null,
    });
    if (error) throw error;
    return data;
};

export const addOrder = async (order) => {
    let data;
    try {
        data = await createOrderViaRpc(order);
    } catch (error) {
        if (!rpcMissing(error)) throw error;
        console.warn('create_order RPC missing — run migrations 15–17; using legacy insert');
        data = await addOrderDirect(order);
    }

    // Best-effort, and deliberately after the order is safely stored: the
    // customer record is useful, but nothing about it is worth losing a sale
    // over if the write fails.
    if (order.customer_phone && data) {
        recordCustomer({
            name: order.customer_name,
            phone: order.customer_phone,
            address: order.customer_address,
            spent: data.total || 0,
        }).catch(err => console.error('Could not record customer', err));
    }

    return data;
};

// The pre-P1 insert path, kept only as the fallback above.
const addOrderDirect = async (order) => {
    const now = new Date().toISOString();
    const orderData = {
        ...order,
        order_number: order.order_number || Date.now().toString().slice(-6),
        status: order.status || 'new',
        // Paid at the counter unless the caller opens this as a tab
        payment_status: order.payment_status || 'paid',
        round_count: 1,
        last_round_at: now,
        created_at: now
    };

    if (orderData.payment_status === 'paid' && !orderData.paid_at) {
        orderData.paid_at = now;
    }

    /*
     * Idempotent when the caller supplies client_request_id.
     *
     * DO NOTHING rather than DO UPDATE: if the first attempt actually succeeded
     * and the kitchen has since started the ticket, an update would reset its
     * status to 'new' and re-fire food that's already on the pass. On a
     * collision we return the order that's already there, so a retry after a
     * timeout is indistinguishable from a first attempt that worked.
     */
    let data, error;

    if (orderData.client_request_id) {
        ({ data, error } = await supabase
            .from('orders')
            .upsert([orderData], { onConflict: 'client_request_id', ignoreDuplicates: true })
            .select()
            .maybeSingle());

        // Nothing came back, so this id was already used — fetch the winner.
        if (!error && !data) {
            const existing = await supabase
                .from('orders')
                .select('*')
                .eq('client_request_id', orderData.client_request_id)
                .maybeSingle();

            if (existing.error) throw existing.error;
            if (existing.data) return existing.data;
        }

        /*
         * Migration 12 not applied yet: rather than refuse the sale, drop the id
         * and insert normally. That gives up idempotency for this order — which
         * is where it already was — instead of stopping the till.
         */
        if (error && /client_request_id/i.test(error.message || '')) {
            console.warn('client_request_id column missing — run migration 12 for retry-safe checkout');
            const { client_request_id: _unused, ...withoutId } = orderData;
            ({ data, error } = await supabase
                .from('orders')
                .insert([withoutId])
                .select()
                .single());
        }
    } else {
        ({ data, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select()
            .single());
    }

    if (error) throw error;
    return data;
};

/*
 * Keeps a row per customer, keyed on phone — the one identifier a caller
 * reliably has. Running totals are incremented from the order that just
 * landed rather than recomputed, so this stays a single round trip.
 *
 * Address and name are only overwritten when supplied, so a delivery that
 * came in without an address doesn't erase the one already on file.
 */
export const recordCustomer = async ({ name, phone, address, spent = 0 }) => {
    if (!phone) return null;

    const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
        const { data, error } = await supabase
            .from('customers')
            .update({
                ...(name && { name }),
                ...(address && { address }),
                total_orders: (existing.total_orders || 0) + 1,
                total_spent: Number(existing.total_spent || 0) + Number(spent || 0),
                updated_at: now,
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase
        .from('customers')
        .insert([{
            // name is NOT NULL on the table, so an anonymous phone order still
            // needs something in the column.
            name: name || 'Walk-in',
            phone,
            address: address || null,
            total_orders: 1,
            total_spent: Number(spent || 0),
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Prefill at the till: a returning caller's details from their phone number.
export const findCustomerByPhone = async (phone) => {
    if (!phone) return null;

    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();

    if (error) {
        console.error('Error looking up customer:', error);
        return null;
    }
    return data;
};

/*
 * Kitchen/status transition, guarded: the write names the status it is
 * moving FROM, so a stale bump — the board raced an append_round re-fire —
 * loses and the caller gets the row as it truly is, instead of parking a
 * ticket with uncooked food in 'ready'.
 */
export const bumpOrder = async (orderId, fromStatus, toStatus) => {
    try {
        const { data, error } = await supabase.rpc('bump_order', {
            p_order_id: orderId,
            p_from: fromStatus,
            p_to: toStatus,
        });
        if (error) throw error;
        return data;
    } catch (error) {
        if (!rpcMissing(error)) throw error;
        console.warn('bump_order RPC missing — run migrations 15–17; using legacy update');
        return updateOrderStatus(orderId, toStatus);
    }
};

// Legacy unguarded write, kept only as bumpOrder's fallback.
export const updateOrderStatus = async (id, status) => {
    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// ==================== OPEN TABS ====================

// A tab is simply an order nobody has paid for yet. Cancelled checks are not
// tabs — there is nothing left to settle.
export const getOpenTabs = async () => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'unpaid')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching open tabs:', error);
        return [];
    }
    return data;
};

export const getOrderById = async (id) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
};

/*
 * Fire another round onto an open tab.
 *
 * The new lines are appended rather than merged into matching ones: the kitchen
 * needs "2 Naan" as a fresh line it has not cooked yet, not a quantity that
 * quietly ticks up on a ticket it already worked. Each line carries its round
 * number so the KDS can flag what is new, and the ticket is re-fired to 'new'
 * with last_round_at moved forward so its timer tracks this round.
 *
 * Read-then-write: fine for a single POS terminal, but two terminals appending
 * to one tab in the same instant would have the later write win.
 */
export const appendRoundToOrder = async (orderId, newItems, details = {}, { clientRequestId } = {}) => {
    // RPC path: the lock and the idempotency key make a retried or twin
    // "send round" land exactly one round — the audit's last CRITICAL.
    try {
        const { data, error } = await supabase.rpc('append_round', {
            p_order_id: orderId,
            p_items: newItems,
            p_client_request_id: clientRequestId || null,
            p_expected_total: null, // settle carries the money check
            p_opts: {
                ...(details.include_tax !== undefined && { include_tax: details.include_tax }),
                ...(details.table_number !== undefined && { table_number: details.table_number }),
                ...(details.waiter_id !== undefined && { waiter_id: details.waiter_id }),
                ...(details.waiter_name !== undefined && { waiter_name: details.waiter_name }),
            },
        });
        if (error) throw error;
        return data;
    } catch (error) {
        if (!rpcMissing(error)) throw error;
        console.warn('append_round RPC missing — run migrations 15–17; using legacy update');
    }

    const order = await getOrderById(orderId);

    if (order.payment_status === 'paid') {
        throw new Error('This bill has already been settled.');
    }

    const round = (order.round_count || 1) + 1;
    const items = [
        ...order.items,
        ...newItems.map(item => ({ ...item, round }))
    ];

    const includeTax = details.include_tax ?? order.include_tax ?? true;
    // A discount already agreed on this tab survives the new round. Re-pricing
    // without it would quietly withdraw something the customer was promised.
    const totals = calcTotals(items, includeTax, {
        taxRate: await getTaxRate(),
        discount: order.discount || 0,
    });
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('orders')
        .update({
            items,
            ...totalsColumns(totals),
            include_tax: includeTax,
            round_count: round,
            last_round_at: now,
            status: 'new', // back to the top of the kitchen board for this round
            updated_at: now,
            // The floor can correct these mid-sitting (table moved, shift change)
            ...(details.table_number !== undefined && { table_number: details.table_number }),
            ...(details.waiter_id !== undefined && { waiter_id: details.waiter_id }),
            ...(details.waiter_name !== undefined && { waiter_name: details.waiter_name })
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/*
 * Close out a tab. Totals are recomputed from the stored lines rather than
 * trusted from the screen, so the bill matches what actually went to the
 * kitchen. A tab whose food is already out is done, so it also leaves the
 * kitchen board; one still being cooked stays there for the pass.
 */
export const settleOrder = async (orderId, {
    paymentMode = 'cash', includeTax, discount, discountReason, invoiceNumber,
    expectedTotal, clientRequestId,
} = {}) => {
    // RPC path: one row-locked transaction settles the bill, writes the
    // payment, and mints the sequential invoice number. Two terminals racing
    // on the same tab: one wins, the other is told the truth.
    try {
        const { data, error } = await supabase.rpc('settle_order', {
            p_order_id: orderId,
            p_method: paymentMode,
            p_discount: discount ?? null,
            p_discount_reason: discountReason ?? null,
            p_include_tax: includeTax ?? null,
            p_expected_total: expectedTotal ?? null,
            p_client_request_id: clientRequestId || null,
        });
        if (error) throw error;
        return data;
    } catch (error) {
        if (!rpcMissing(error)) throw error;
        console.warn('settle_order RPC missing — run migrations 15–17; using legacy update');
    }

    const order = await getOrderById(orderId);

    if (order.payment_status === 'paid') {
        throw new Error('This bill has already been settled.');
    }

    const taxed = includeTax ?? order.include_tax ?? true;
    const totals = calcTotals(order.items, taxed, {
        taxRate: await getTaxRate(),
        // A discount can be applied at settle time, or carried from the tab.
        discount: discount ?? order.discount ?? 0,
    });
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('orders')
        .update({
            ...totalsColumns(totals),
            include_tax: taxed,
            ...(discountReason !== undefined && { discount_reason: discountReason }),
            // Only stamped if the bill doesn't already carry one, so settling a
            // tab twice can't renumber a receipt that was already printed.
            ...(invoiceNumber && !order.invoice_number && { invoice_number: invoiceNumber }),
            payment_status: 'paid',
            payment_mode: paymentMode,
            paid_at: now,
            updated_at: now,
            ...(order.status === 'ready' && { status: 'completed' })
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) throw error;
    return data;
};
// ==================== MODIFIERS ====================
export const getModifiers = async () => {
    const { data, error } = await supabase
        .from('modifiers')
        .select('*');

    if (error) {
        console.error('Error fetching modifiers:', error);
        return [];
    }

    // Convert to the record format used in the app if necessary
    // or return as is. The app seems to expect an object keyed by modifier key.
    const modifiersRecord = {};
    data.forEach(mod => {
        modifiersRecord[mod.key] = {
            type: mod.type,
            name: mod.name,
            options: mod.options
        };
    });
    return modifiersRecord;
};

// ==================== AGGREGATED DATA ====================
export const getFullMenuData = async () => {
    const [categories, items, modifiers] = await Promise.all([
        getCategories(),
        getMenuItems(),
        getModifiers()
    ]);

    return {
        categories,
        items,
        modifiers
    };
};

// ==================== IMAGE UPLOAD ====================
export const MENU_IMAGE_BUCKET = 'menu-images';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/*
 * Uploads a menu photo and returns its public URL, so the caller can store it
 * in menu_items.image exactly as if it had been pasted in by hand.
 *
 * Checks size and type here rather than trusting the file picker's accept
 * filter, which is a hint the OS is free to ignore. Names are random: staff
 * upload things like "IMG_0042.jpg" and "photo.jpg", and the original name
 * would collide or leak nothing useful.
 */
export const uploadMenuImage = async (file) => {
    if (!file.type.startsWith('image/')) {
        throw new Error('That file is not an image');
    }
    if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(`Image must be under ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${crypto.randomUUID()}.${ext || 'jpg'}`;

    const { error } = await supabase.storage
        .from(MENU_IMAGE_BUCKET)
        .upload(path, file, { cacheControl: '31536000', upsert: false });

    if (error) {
        // A missing bucket is the one failure worth naming outright — it's a
        // setup step, not something retrying will fix.
        if (/bucket not found/i.test(error.message)) {
            throw new Error(`Storage bucket "${MENU_IMAGE_BUCKET}" is missing. Create it in Supabase first.`);
        }
        throw error;
    }

    const { data } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
};
