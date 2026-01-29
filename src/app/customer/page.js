'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './customer.module.css';
import { getMenuData } from '@/lib/menuStorage';
import { Soup, Flame, Utensils, Cookie, GlassWater, Plus, Search } from 'lucide-react';
import Image from 'next/image';

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

export default function CustomerMenuPage() {
    const [menuData, setMenuData] = useState({ categories: [], items: [], modifiers: {} });
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Load menu data
    useEffect(() => {
        const loadData = () => {
            const data = getMenuData();
            setMenuData(data);
            setIsLoading(false);
        };
        loadData();
    }, []);

    // Filter items by category and search
    const filteredItems = useMemo(() => {
        let items = activeCategory === 'all'
            ? menuData.items
            : menuData.items.filter(item => item.categoryId === activeCategory);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query)
            );
        }

        return items;
    }, [menuData.items, activeCategory, searchQuery]);

    // Get category name
    const getCategoryName = (categoryId) => {
        const category = menuData.categories.find(c => c.id === categoryId);
        return category?.name || 'Other';
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading menu...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.branding}>
                        <Image
                            src="/flames-by-the-indus-logo.svg"
                            alt="Flames by the Indus"
                            width={180}
                            height={54}
                            priority
                            className={styles.logo}
                        />
                        <p className={styles.tagline}>Authentic Pakistani Cuisine</p>
                    </div>
                    <div className={styles.searchBar}>
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Search our menu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>
            </header>

            {/* Categories */}
            <div className={styles.categoriesWrapper}>
                <div className={styles.categories}>
                    <button
                        className={`${styles.categoryTab} ${activeCategory === 'all' ? styles.active : ''}`}
                        onClick={() => setActiveCategory('all')}
                    >
                        <Utensils size={18} />
                        All Items
                    </button>
                    {menuData.categories.map(category => (
                        <button
                            key={category.id}
                            className={`${styles.categoryTab} ${activeCategory === category.id ? styles.active : ''}`}
                            onClick={() => setActiveCategory(category.id)}
                        >
                            <CategoryIcon name={category.icon} size={18} />
                            {category.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Menu Content */}
            <main className={styles.mainContent}>
                {filteredItems.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Utensils size={64} />
                        <h3>No items found</h3>
                        <p>Try a different search term or category</p>
                    </div>
                ) : (
                    <div className={styles.menuGrid}>
                        {filteredItems.map(item => (
                            <article key={item.id} className={styles.menuItem}>
                                <div className={styles.imageContainer}>
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} />
                                    ) : (
                                        <div className={styles.noImage}>
                                            <Utensils size={40} />
                                        </div>
                                    )}
                                    <span className={styles.categoryBadge}>
                                        {getCategoryName(item.categoryId)}
                                    </span>
                                </div>
                                <div className={styles.itemContent}>
                                    <div className={styles.itemHeader}>
                                        <h3>{item.name}</h3>
                                        {item.unit && (
                                            <span className={styles.unitBadge}>{item.unit}</span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <p className={styles.itemDesc}>{item.description}</p>
                                    )}
                                    <div className={styles.itemFooter}>
                                        <div className={styles.priceSection}>
                                            <span className={styles.price}>
                                                Rs. {item.price.toLocaleString()}
                                            </span>
                                            {item.variants && item.variants.length > 0 && (
                                                <div className={styles.variants}>
                                                    {item.variants.map((v, idx) => (
                                                        <span key={idx} className={styles.variant}>
                                                            {v.name}: Rs. {v.price.toLocaleString()}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className={styles.footer}>
                <p>&copy; {new Date().getFullYear()} Flames by the Indus. All rights reserved.</p>
                <p className={styles.footerNote}>Prices are subject to applicable taxes</p>
            </footer>
        </div>
    );
}
