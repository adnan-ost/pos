'use client';
import { useState, useEffect } from 'react';
import styles from './MenuItemForm.module.css';
import { addMenuItem, updateMenuItem } from '@/lib/supabaseDb';
import { X, Plus, Trash2, Image as ImageIcon } from 'lucide-react';

export default function MenuItemForm({ item, categories, modifiers, onClose }) {
    const isEditing = !!item;

    const [formData, setFormData] = useState({
        name: '',
        category_id: categories[0]?.id || '',
        price: '',
        unit: '',
        description: '',
        image: '',
        variants: [],
        modifiers: []
    });

    const [errors, setErrors] = useState({});
    const [imagePreviewError, setImagePreviewError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize form with item data when editing
    useEffect(() => {
        if (item) {
            setFormData({
                name: item.name || '',
                category_id: item.category_id || categories[0]?.id || '',
                price: item.price?.toString() || '',
                unit: item.unit || '',
                description: item.description || '',
                image: item.image || '',
                variants: item.variants || [],
                modifiers: item.modifiers || []
            });
        }
    }, [item, categories]);

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Reset image preview error when URL changes
        if (name === 'image') {
            setImagePreviewError(false);
        }
    };

    // Handle variant changes
    const addVariant = () => {
        setFormData(prev => ({
            ...prev,
            variants: [...prev.variants, { name: '', price: '' }]
        }));
    };

    const updateVariant = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map((v, i) =>
                i === index ? { ...v, [field]: field === 'price' ? value : value } : v
            )
        }));
    };

    const removeVariant = (index) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index)
        }));
    };

    // Handle modifier selection
    const toggleModifier = (modKey) => {
        setFormData(prev => ({
            ...prev,
            modifiers: prev.modifiers.includes(modKey)
                ? prev.modifiers.filter(m => m !== modKey)
                : [...prev.modifiers, modKey]
        }));
    };

    // Validate form
    const validate = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        if (!formData.category_id) {
            newErrors.category_id = 'Category is required';
        }

        if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
            newErrors.price = 'Valid price is required';
        }

        // Validate variants
        formData.variants.forEach((v, i) => {
            if (v.name && (!v.price || isNaN(parseFloat(v.price)))) {
                newErrors[`variant_${i}`] = 'Variant needs a valid price';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate() || isSubmitting) return;

        setIsSubmitting(true);

        try {
            // Clean up variants - remove empty ones and parse prices
            const cleanVariants = formData.variants
                .filter(v => v.name.trim() && v.price)
                .map(v => ({ name: v.name.trim(), price: parseFloat(v.price) }));

            const itemData = {
                name: formData.name.trim(),
                category_id: formData.category_id,
                price: parseFloat(formData.price),
                unit: formData.unit.trim() || undefined,
                description: formData.description.trim() || undefined,
                image: formData.image.trim() || undefined,
                variants: cleanVariants.length > 0 ? cleanVariants : undefined,
                modifiers: formData.modifiers.length > 0 ? formData.modifiers : undefined
            };

            if (isEditing) {
                await updateMenuItem(item.id, itemData);
            } else {
                await addMenuItem(itemData);
            }

            onClose(true);
        } catch (error) {
            console.error("Error saving item:", error);
            setErrors({ submit: "Failed to save item" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={() => onClose(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>{isEditing ? 'Edit Menu Item' : 'Add New Item'}</h2>
                    <button className={styles.closeBtn} onClick={() => onClose(false)}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGrid}>
                        {/* Left Column */}
                        <div className={styles.formColumn}>
                            {/* Name */}
                            <div className={styles.formGroup}>
                                <label>Item Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter item name"
                                    className={errors.name ? styles.inputError : ''}
                                />
                                {errors.name && <span className={styles.error}>{errors.name}</span>}
                            </div>

                            {/* Category */}
                            <div className={styles.formGroup}>
                                <label>Category *</label>
                                <select
                                    name="category_id"
                                    value={formData.category_id}
                                    onChange={handleChange}
                                    className={errors.category_id ? styles.inputError : ''}
                                >
                                    <option value="">Select category</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                {errors.category_id && <span className={styles.error}>{errors.category_id}</span>}
                            </div>

                            {/* Price & Unit */}
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Price (Rs.) *</label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleChange}
                                        placeholder="0"
                                        min="0"
                                        step="1"
                                        className={errors.price ? styles.inputError : ''}
                                    />
                                    {errors.price && <span className={styles.error}>{errors.price}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Unit</label>
                                    <input
                                        type="text"
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleChange}
                                        placeholder="e.g., Full, 4 pcs"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className={styles.formGroup}>
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Brief description of the item"
                                    rows={3}
                                />
                            </div>

                            {/* Modifiers */}
                            {Object.keys(modifiers).length > 0 && (
                                <div className={styles.formGroup}>
                                    <label>Modifiers</label>
                                    <div className={styles.modifiersList}>
                                        {Object.entries(modifiers).map(([key, mod]) => (
                                            <label key={key} className={styles.modifierCheckbox}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.modifiers.includes(key)}
                                                    onChange={() => toggleModifier(key)}
                                                />
                                                <span>{mod.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column */}
                        <div className={styles.formColumn}>
                            {/* Image URL */}
                            <div className={styles.formGroup}>
                                <label>Image URL</label>
                                <input
                                    type="text"
                                    name="image"
                                    value={formData.image}
                                    onChange={handleChange}
                                    placeholder="https://..."
                                />
                                <div className={styles.imagePreview}>
                                    {formData.image && !imagePreviewError ? (
                                        <img
                                            src={formData.image}
                                            alt="Preview"
                                            onError={() => setImagePreviewError(true)}
                                        />
                                    ) : (
                                        <div className={styles.noImagePreview}>
                                            <ImageIcon size={32} />
                                            <span>{imagePreviewError ? 'Invalid image URL' : 'Image preview'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Variants */}
                            <div className={styles.formGroup}>
                                <div className={styles.variantHeader}>
                                    <label>Variants (optional)</label>
                                    <button
                                        type="button"
                                        className={styles.addVariantBtn}
                                        onClick={addVariant}
                                    >
                                        <Plus size={14} />
                                        Add
                                    </button>
                                </div>
                                {formData.variants.length === 0 ? (
                                    <p className={styles.variantHint}>
                                        Add variants like "Half" or "Large" with different prices
                                    </p>
                                ) : (
                                    <div className={styles.variantsList}>
                                        {formData.variants.map((variant, idx) => (
                                            <div key={idx} className={styles.variantRow}>
                                                <input
                                                    type="text"
                                                    value={variant.name}
                                                    onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                                                    placeholder="Name"
                                                    className={styles.variantName}
                                                />
                                                <input
                                                    type="number"
                                                    value={variant.price}
                                                    onChange={(e) => updateVariant(idx, 'price', e.target.value)}
                                                    placeholder="Price"
                                                    className={`${styles.variantPrice} ${errors[`variant_${idx}`] ? styles.inputError : ''}`}
                                                />
                                                <button
                                                    type="button"
                                                    className={styles.removeVariantBtn}
                                                    onClick={() => removeVariant(idx)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                            {isEditing ? 'Save Changes' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
