import { useState } from 'react';
import styles from './ModifierModal.module.css';

// Default to the largest/last variant — the biggest portion is what gets
// ordered most, so it saves a tap at the busiest moment.
const defaultVariant = (item) =>
    item?.variants?.length ? item.variants[item.variants.length - 1] : null;

const defaultSelections = (item, modifiersData) => {
    const initial = {};
    if (!item?.modifiers) return initial;

    item.modifiers.forEach(modId => {
        const mod = modifiersData?.[modId];
        if (mod && mod.type === 'select') {
            initial[modId] = mod.options[1]; // Default to second option (usually Medium)
        } else if (mod && mod.type === 'multiselect') {
            initial[modId] = [];
        }
    });
    return initial;
};

/*
 * Defaults are computed during the first render rather than assigned by an
 * effect afterwards. Doing it in an effect meant the modal painted once with
 * the wrong selections — nothing on a first open, the previous item's on a
 * later one — and only corrected on the following render, which on a busy pass
 * is long enough to tap.
 *
 * This relies on the POS keying the modal by item id, so switching items
 * remounts with fresh defaults instead of carrying the old ones over.
 */
const ModifierModal = ({ item, modifiersData, onClose, onConfirm }) => {
    const [selectedVariant, setSelectedVariant] = useState(() => defaultVariant(item));
    const [selections, setSelections] = useState(() => defaultSelections(item, modifiersData));

    if (!item) return null;

    const handleModifierChange = (modId, option, type) => {
        if (type === 'select') {
            setSelections(prev => ({ ...prev, [modId]: option }));
        } else {
            // Multiselect
            setSelections(prev => {
                const current = prev[modId] || [];
                const exists = current.find(o => o.name === option.name);
                if (exists) {
                    return { ...prev, [modId]: current.filter(o => o.name !== option.name) };
                }
                return { ...prev, [modId]: [...current, option] };
            });
        }
    };

    const calculateTotal = () => {
        let price = selectedVariant ? selectedVariant.price : item.price;

        Object.keys(selections).forEach(key => {
            const val = selections[key];
            if (Array.isArray(val)) {
                val.forEach(v => price += v.price);
            } else if (val) {
                price += val.price;
            }
        });

        return price;
    };

    const handleConfirm = () => {
        onConfirm({
            ...item,
            uniqueId: Date.now(), // For cart distinctness
            selectedVariant,
            selectedModifiers: selections,
            price: calculateTotal(),
            basePrice: calculateTotal(), // Store for qty calc
            name: `${item.name} ${selectedVariant ? `(${selectedVariant.name})` : ''}`
        });
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>{item.name}</h2>
                    <button onClick={onClose} className={styles.closeBtn}>×</button>
                </div>

                <div className={styles.content}>
                    {/* Variants */}
                    {item.variants && (
                        <div className={styles.section}>
                            <h3>Size / Variant</h3>
                            <div className={styles.optionsGrid}>
                                {item.variants.map(variant => (
                                    <button
                                        key={variant.name}
                                        className={`${styles.optionBtn} ${selectedVariant?.name === variant.name ? styles.selected : ''}`}
                                        onClick={() => setSelectedVariant(variant)}
                                    >
                                        {variant.name} <span>Rs. {variant.price}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Modifiers */}
                    {item.modifiers && item.modifiers.map(modId => {
                        const mod = modifiersData[modId];
                        if (!mod) return null;

                        return (
                            <div key={modId} className={styles.section}>
                                <h3>{mod.name}</h3>
                                <div className={styles.optionsFlex}>
                                    {mod.options.map((opt, idx) => (
                                        <button
                                            key={idx}
                                            className={`${styles.chip} ${mod.type === 'select'
                                                ? (selections[modId]?.name === opt.name ? styles.active : '')
                                                : (selections[modId]?.find(o => o.name === opt.name) ? styles.active : '')
                                                }`}
                                            onClick={() => handleModifierChange(modId, opt, mod.type)}
                                        >
                                            {opt.name} {opt.price > 0 && `(+${opt.price})`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className={styles.footer}>
                    <div className={styles.priceTag}>
                        Total: Rs. {calculateTotal()}
                    </div>
                    <button className={styles.confirmBtn} onClick={handleConfirm}>
                        Add to Order
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModifierModal;
