import { supabase } from './supabase';
import { calcTotals } from './orderTotals';

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

export const getOrders = async () => {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
    return data;
};

export const addOrder = async (order) => {
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

    const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

    if (error) throw error;
    return data;
};

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
export const appendRoundToOrder = async (orderId, newItems, details = {}) => {
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
    const totals = calcTotals(items, includeTax);
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('orders')
        .update({
            items,
            ...totals,
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
export const settleOrder = async (orderId, { paymentMode = 'cash', includeTax } = {}) => {
    const order = await getOrderById(orderId);

    if (order.payment_status === 'paid') {
        throw new Error('This bill has already been settled.');
    }

    const taxed = includeTax ?? order.include_tax ?? true;
    const totals = calcTotals(order.items, taxed);
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('orders')
        .update({
            ...totals,
            include_tax: taxed,
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
