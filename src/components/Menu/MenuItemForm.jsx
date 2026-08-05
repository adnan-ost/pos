'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './MenuItemForm.module.css';
import { addMenuItem, updateMenuItem, uploadMenuImage, addCategory } from '@/lib/supabaseDb';
import CategorySelect from './CategorySelect';
import { X, Plus, Trash2, Image as ImageIcon, Upload, Loader2, Link2 } from 'lucide-react';

export default function MenuItemForm({ item, categories, modifiers, onClose }) {
    const isEditing = !!item;

    const [formData, setFormData] = useState({
        name: '',
        // Left empty on purpose: defaulting to the first category meant a new
        // item could be saved into a category nobody actually picked, and
        // validation couldn't catch it because the field was already filled.
        category_id: '',
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
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Categories created from inside this form are held locally and merged over
    // the prop: the parent page only refetches on close, and losing a
    // just-created category mid-form would be worse than a briefly split list.
    const [newCategories, setNewCategories] = useState([]);
    const categoryList = useMemo(
        () => [...categories, ...newCategories],
        [categories, newCategories]
    );

    const handleCreateCategory = async (name) => {
        const created = await addCategory({ name });
        setNewCategories(prev => [...prev, created]);
        return created;
    };

    // Upload writes the resulting public URL straight into the same `image`
    // field the URL box edits, so both routes end up in one place and the
    // preview logic below doesn't need to know which was used.
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        // Reset immediately so picking the same file twice still fires onChange.
        e.target.value = '';
        if (!file) return;

        setIsUploading(true);
        setErrors(prev => ({ ...prev, image: '' }));

        try {
            const url = await uploadMenuImage(file);
            setFormData(prev => ({ ...prev, image: url }));
            setImagePreviewError(false);
        } catch (error) {
            console.error('Image upload failed:', error);
            setErrors(prev => ({ ...prev, image: error.message || 'Upload failed' }));
        } finally {
            setIsUploading(false);
        }
    };

    // Initialize form with item data when editing
    useEffect(() => {
        if (item) {
            setFormData({
                name: item.name || '',
                category_id: item.category_id || '',
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

        // Submitting mid-upload would save the item without the photo.
        if (!validate() || isSubmitting || isUploading) return;

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
                                <label htmlFor="category_id">Category *</label>
                                <CategorySelect
                                    id="category_id"
                                    categories={categoryList}
                                    onCreate={handleCreateCategory}
                                    value={formData.category_id}
                                    hasError={Boolean(errors.category_id)}
                                    onChange={(categoryId) => {
                                        setFormData(prev => ({ ...prev, category_id: categoryId }));
                                        setErrors(prev => ({ ...prev, category_id: '' }));
                                    }}
                                />
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
                            {/* Image: upload a file or paste a URL */}
                            <div className={styles.formGroup}>
                                <label htmlFor="image">Item Image</label>

                                <div className={styles.imageSourceRow}>
                                    <button
                                        type="button"
                                        className={styles.uploadBtn}
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 size={14} className={styles.spin} />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={14} />
                                                Upload photo
                                            </>
                                        )}
                                    </button>
                                    {formData.image && !isUploading && (
                                        <button
                                            type="button"
                                            className={styles.clearImageBtn}
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, image: '' }));
                                                setImagePreviewError(false);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                            Remove
                                        </button>
                                    )}
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/avif"
                                    onChange={handleFileSelect}
                                    className={styles.hiddenFileInput}
                                    tabIndex={-1}
                                />

                                <div className={styles.urlInputWrap}>
                                    <Link2 size={14} className={styles.urlIcon} />
                                    <input
                                        id="image"
                                        type="text"
                                        name="image"
                                        value={formData.image}
                                        onChange={handleChange}
                                        placeholder="...or paste an image URL"
                                        className={styles.urlInput}
                                    />
                                </div>

                                {errors.image && <span className={styles.error}>{errors.image}</span>}

                                <div className={styles.imagePreview}>
                                    {isUploading ? (
                                        <div className={styles.noImagePreview}>
                                            <Loader2 size={32} className={styles.spin} />
                                            <span>Uploading...</span>
                                        </div>
                                    ) : formData.image && !imagePreviewError ? (
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
                                        Add variants like &ldquo;Half&rdquo; or &ldquo;Large&rdquo; with different prices
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
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isSubmitting || isUploading}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={14} className={styles.spin} />
                                    Saving...
                                </>
                            ) : (
                                isEditing ? 'Save Changes' : 'Add Item'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
