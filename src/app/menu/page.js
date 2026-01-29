'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './menu.module.css';
import Sidebar from '@/components/Layout/Sidebar';
import MenuItemForm from '@/components/Menu/MenuItemForm';
import CategoryForm from '@/components/Menu/CategoryForm';
import {
    getMenuItems,
    getCategories,
    deleteMenuItem,
    deleteCategory,
} from '@/lib/supabaseDb';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    FolderPlus,
    Soup,
    Flame,
    Utensils,
    Cookie,
    GlassWater,
    AlertCircle
} from 'lucide-react';

// Icon mapping for categories
const CategoryIcon = ({ name, size = 18 }) => {
    const icons = {
        Soup: Soup,
        Flame: Flame,
        Utensils: Utensils,
        Cookie: Cookie,
        GlassWater: GlassWater,
        Plus: Plus,
    };
    const Icon = icons[name] || Utensils;
    return <Icon size={size} />;
};

export default function MenuManagementPage() {
    const [menuData, setMenuData] = useState({ categories: [], items: [], modifiers: {} });
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Modal states
    const [showItemForm, setShowItemForm] = useState(false);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: null, id: null, name: '' });

    // Load menu data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [categories, items] = await Promise.all([
                getCategories(),
                getMenuItems()
            ]);

            // Hardcoded modifiers for now as they are not full CRUD yet in the UI
            // In a real app, fetch these from DB too
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
            console.error("Failed to load menu data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh data after changes
    const refreshData = () => {
        loadData();
    };

    // Filter items by category and search
    const filteredItems = useMemo(() => {
        let items = activeCategory === 'all'
            ? menuData.items
            : menuData.items.filter(item => item.category_id === activeCategory); // Note: Supabase uses category_id

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query)
            );
        }

        return items;
    }, [menuData.items, activeCategory, searchQuery]);

    // Handle item edit
    const handleEditItem = (item) => {
        setEditingItem(item);
        setShowItemForm(true);
    };

    // Handle item delete
    const handleDeleteItem = (item) => {
        setDeleteConfirm({ show: true, type: 'item', id: item.id, name: item.name });
    };

    // Handle category edit
    const handleEditCategory = (category) => {
        setEditingCategory(category);
        setShowCategoryForm(true);
    };

    // Handle category delete
    const handleDeleteCategory = (category) => {
        setDeleteConfirm({ show: true, type: 'category', id: category.id, name: category.name });
    };

    // Confirm delete
    const confirmDelete = async () => {
        if (deleteConfirm.type === 'item') {
            await deleteMenuItem(deleteConfirm.id);
        } else if (deleteConfirm.type === 'category') {
            await deleteCategory(deleteConfirm.id);
            if (activeCategory === deleteConfirm.id) {
                setActiveCategory('all');
            }
        }
        setDeleteConfirm({ show: false, type: null, id: null, name: '' });
        refreshData();
    };

    // Close item form
    const handleItemFormClose = (saved) => {
        setShowItemForm(false);
        setEditingItem(null);
        if (saved) refreshData();
    };

    // Close category form
    const handleCategoryFormClose = (saved) => {
        setShowCategoryForm(false);
        setEditingCategory(null);
        if (saved) refreshData();
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <Sidebar />
                <main className={styles.mainContent}>
                    <div className={styles.loading}>Loading menu data...</div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <Sidebar />

            <main className={styles.mainContent}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h1>Menu Management</h1>
                        <span className={styles.itemCount}>
                            {menuData.items.length} items • {menuData.categories.length} categories
                        </span>
                    </div>
                    <div className={styles.headerRight}>
                        <div className={styles.searchBar}>
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search menu items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={styles.searchInput}
                            />
                        </div>
                        <button
                            className={styles.addCategoryBtn}
                            onClick={() => setShowCategoryForm(true)}
                        >
                            <FolderPlus size={18} />
                            Add Category
                        </button>
                        <button
                            className={styles.addItemBtn}
                            onClick={() => setShowItemForm(true)}
                        >
                            <Plus size={18} />
                            Add Item
                        </button>
                    </div>
                </div>

                {/* Categories */}
                <div className={styles.categories}>
                    <button
                        className={`${styles.categoryTab} ${activeCategory === 'all' ? styles.active : ''}`}
                        onClick={() => setActiveCategory('all')}
                    >
                        All Items
                    </button>
                    {menuData.categories.map(category => (
                        <div key={category.id} className={styles.categoryWrapper}>
                            <button
                                className={`${styles.categoryTab} ${activeCategory === category.id ? styles.active : ''}`}
                                onClick={() => setActiveCategory(category.id)}
                            >
                                <CategoryIcon name={category.icon} size={16} />
                                {category.name}
                            </button>
                            <div className={styles.categoryActions}>
                                <button
                                    className={styles.categoryActionBtn}
                                    onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }}
                                    title="Edit category"
                                >
                                    <Pencil size={12} />
                                </button>
                                <button
                                    className={`${styles.categoryActionBtn} ${styles.deleteBtn}`}
                                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category); }}
                                    title="Delete category"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Menu Items Grid */}
                <div className={styles.menuGrid}>
                    {filteredItems.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Utensils size={48} />
                            <h3>No items found</h3>
                            <p>
                                {searchQuery
                                    ? 'Try a different search term'
                                    : 'Click "Add Item" to create your first menu item'
                                }
                            </p>
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <div key={item.id} className={styles.menuItem}>
                                <div className={styles.imageContainer}>
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} />
                                    ) : (
                                        <div className={styles.noImage}>
                                            <Utensils size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className={styles.itemContent}>
                                    <div className={styles.itemHeader}>
                                        <h3>{item.name}</h3>
                                        <span className={styles.itemPrice}>
                                            Rs. {item.price.toLocaleString()}
                                        </span>
                                    </div>
                                    {item.description && (
                                        <p className={styles.itemDesc}>{item.description}</p>
                                    )}
                                    {item.unit && (
                                        <span className={styles.badge}>{item.unit}</span>
                                    )}
                                    {item.variants && item.variants.length > 0 && (
                                        <span className={styles.variantBadge}>
                                            {item.variants.length} variants
                                        </span>
                                    )}
                                </div>
                                <div className={styles.itemActions}>
                                    <button
                                        className={styles.editBtn}
                                        onClick={() => handleEditItem(item)}
                                    >
                                        <Pencil size={16} />
                                        Edit
                                    </button>
                                    <button
                                        className={styles.deleteItemBtn}
                                        onClick={() => handleDeleteItem(item)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Item Form Modal */}
            {showItemForm && (
                <MenuItemForm
                    item={editingItem}
                    categories={menuData.categories}
                    modifiers={menuData.modifiers}
                    onClose={handleItemFormClose}
                />
            )}

            {/* Category Form Modal */}
            {showCategoryForm && (
                <CategoryForm
                    category={editingCategory}
                    onClose={handleCategoryFormClose}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm.show && (
                <div className={styles.modalOverlay} onClick={() => setDeleteConfirm({ show: false, type: null, id: null, name: '' })}>
                    <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.confirmIcon}>
                            <AlertCircle size={48} />
                        </div>
                        <h3>Delete {deleteConfirm.type === 'item' ? 'Item' : 'Category'}?</h3>
                        <p>
                            Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>?
                            {deleteConfirm.type === 'category' && (
                                <span className={styles.warning}>
                                    <br />This will also delete all items in this category.
                                </span>
                            )}
                        </p>
                        <div className={styles.confirmActions}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setDeleteConfirm({ show: false, type: null, id: null, name: '' })}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.confirmDeleteBtn}
                                onClick={confirmDelete}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
