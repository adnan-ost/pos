/**
 * Menu Storage Utility
 * Handles localStorage-based persistence for menu data
 */

import { menuData as defaultMenuData } from './menuData';

const MENU_STORAGE_KEY = 'pos_menu_data';

/**
 * Initialize menu data in localStorage if not present
 */
export const initializeMenu = () => {
    if (typeof window === 'undefined') return;

    const existing = localStorage.getItem(MENU_STORAGE_KEY);
    if (!existing) {
        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(defaultMenuData));
    }
};

/**
 * Get current menu data from localStorage
 */
export const getMenuData = () => {
    if (typeof window === 'undefined') return defaultMenuData;

    initializeMenu();

    try {
        const stored = localStorage.getItem(MENU_STORAGE_KEY);
        return stored ? JSON.parse(stored) : defaultMenuData;
    } catch (e) {
        console.error('Failed to parse menu data', e);
        return defaultMenuData;
    }
};

/**
 * Save entire menu data structure
 */
export const saveMenuData = (data) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(data));
};

/**
 * Generate unique ID for new items
 */
const generateId = (prefix = 'item') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ==================== MENU ITEMS CRUD ====================

/**
 * Add a new menu item
 */
export const addMenuItem = (item) => {
    const data = getMenuData();
    const newItem = {
        ...item,
        id: generateId('item')
    };
    data.items = [...data.items, newItem];
    saveMenuData(data);
    return newItem;
};

/**
 * Update an existing menu item
 */
export const updateMenuItem = (id, updates) => {
    const data = getMenuData();
    data.items = data.items.map(item =>
        item.id === id ? { ...item, ...updates } : item
    );
    saveMenuData(data);
    return data.items.find(item => item.id === id);
};

/**
 * Delete a menu item
 */
export const deleteMenuItem = (id) => {
    const data = getMenuData();
    data.items = data.items.filter(item => item.id !== id);
    saveMenuData(data);
    return true;
};

/**
 * Get a single menu item by ID
 */
export const getMenuItem = (id) => {
    const data = getMenuData();
    return data.items.find(item => item.id === id);
};

// ==================== CATEGORIES CRUD ====================

/**
 * Add a new category
 */
export const addCategory = (category) => {
    const data = getMenuData();
    const newCategory = {
        ...category,
        id: generateId('cat')
    };
    data.categories = [...data.categories, newCategory];
    saveMenuData(data);
    return newCategory;
};

/**
 * Update an existing category
 */
export const updateCategory = (id, updates) => {
    const data = getMenuData();
    data.categories = data.categories.map(cat =>
        cat.id === id ? { ...cat, ...updates } : cat
    );
    saveMenuData(data);
    return data.categories.find(cat => cat.id === id);
};

/**
 * Delete a category
 * @param {string} id - Category ID
 * @param {boolean} deleteItems - Whether to also delete items in this category
 */
export const deleteCategory = (id, deleteItems = false) => {
    const data = getMenuData();
    data.categories = data.categories.filter(cat => cat.id !== id);

    if (deleteItems) {
        data.items = data.items.filter(item => item.categoryId !== id);
    }

    saveMenuData(data);
    return true;
};

/**
 * Get all categories
 */
export const getCategories = () => {
    const data = getMenuData();
    return data.categories;
};

/**
 * Get items by category
 */
export const getItemsByCategory = (categoryId) => {
    const data = getMenuData();
    if (categoryId === 'all') return data.items;
    return data.items.filter(item => item.categoryId === categoryId);
};

// ==================== MODIFIERS ====================

/**
 * Get all modifiers
 */
export const getModifiers = () => {
    const data = getMenuData();
    return data.modifiers || {};
};

/**
 * Reset menu to default data
 */
export const resetMenuToDefault = () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(defaultMenuData));
    return defaultMenuData;
};
