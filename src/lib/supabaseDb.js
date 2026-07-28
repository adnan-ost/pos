import { supabase } from './supabase';

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
    const orderData = {
        ...order,
        order_number: order.order_number || Date.now().toString().slice(-6),
        status: order.status || 'new',
        created_at: new Date().toISOString()
    };

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
