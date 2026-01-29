'use client';
import { useState, useEffect } from 'react';
import styles from './CategoryForm.module.css';
import { addCategory, updateCategory } from '@/lib/supabaseDb';
import { X, Soup, Flame, Utensils, Cookie, GlassWater, Plus, Check } from 'lucide-react';

// Available icons for categories
const AVAILABLE_ICONS = [
    { id: 'Soup', icon: Soup, label: 'Soup' },
    { id: 'Flame', icon: Flame, label: 'Flame' },
    { id: 'Utensils', icon: Utensils, label: 'Utensils' },
    { id: 'Cookie', icon: Cookie, label: 'Cookie' },
    { id: 'GlassWater', icon: GlassWater, label: 'Glass' },
    { id: 'Plus', icon: Plus, label: 'Plus' },
];

export default function CategoryForm({ category, onClose }) {
    const isEditing = !!category;

    const [formData, setFormData] = useState({
        name: '',
        icon: 'Utensils'
    });

    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize form with category data when editing
    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name || '',
                icon: category.icon || 'Utensils'
            });
        }
    }, [category]);

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    // Handle icon selection
    const selectIcon = (iconId) => {
        setFormData(prev => ({ ...prev, icon: iconId }));
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Category name is required');
            return;
        }

        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const categoryData = {
                name: formData.name.trim(),
                icon: formData.icon
            };

            if (isEditing) {
                await updateCategory(category.id, categoryData);
            } else {
                await addCategory(categoryData);
            }

            onClose(true);
        } catch (err) {
            console.error("Error saving category:", err);
            setError("Failed to save category");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={() => onClose(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>{isEditing ? 'Edit Category' : 'Add New Category'}</h2>
                    <button className={styles.closeBtn} onClick={() => onClose(false)}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Name */}
                    <div className={styles.formGroup}>
                        <label>Category Name *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter category name"
                            className={error ? styles.inputError : ''}
                            autoFocus
                        />
                        {error && <span className={styles.error}>{error}</span>}
                    </div>

                    {/* Icon Selection */}
                    <div className={styles.formGroup}>
                        <label>Icon</label>
                        <div className={styles.iconGrid}>
                            {AVAILABLE_ICONS.map(({ id, icon: Icon, label }) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`${styles.iconBtn} ${formData.icon === id ? styles.selected : ''}`}
                                    onClick={() => selectIcon(id)}
                                    title={label}
                                >
                                    <Icon size={20} />
                                    {formData.icon === id && (
                                        <span className={styles.checkmark}>
                                            <Check size={12} />
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className={styles.preview}>
                        <span className={styles.previewLabel}>Preview:</span>
                        <div className={styles.previewTab}>
                            {AVAILABLE_ICONS.find(i => i.id === formData.icon)?.icon &&
                                (() => {
                                    const IconComponent = AVAILABLE_ICONS.find(i => i.id === formData.icon)?.icon;
                                    return <IconComponent size={16} />;
                                })()
                            }
                            {formData.name || 'Category Name'}
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className={styles.formActions}>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={() => onClose(false)}
                        >
                            Cancel
                        </button>
                        <button type="submit" className={styles.submitBtn}>
                            {isEditing ? 'Save Changes' : 'Add Category'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
