'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, Plus, Loader2 } from 'lucide-react';
import styles from './CategorySelect.module.css';

/*
 * Replaces a native <select> for picking a category.
 *
 * The native control renders its popup through the OS, which ignores the app's
 * dark theme, sits awkwardly over the field, and gives fat-finger targets on a
 * till screen. With 13+ categories it also needs a filter, which a native
 * select can't offer. This is a plain listbox: full keyboard support, big rows,
 * and type-to-filter once the list gets long.
 *
 * When `onCreate` is supplied the popup can also add a category inline, so a
 * missing category doesn't mean abandoning a half-filled item form.
 */
export default function CategorySelect({ id, categories, value, onChange, hasError, onCreate }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    const [createError, setCreateError] = useState('');

    const rootRef = useRef(null);
    const searchRef = useRef(null);
    const listRef = useRef(null);
    const createRef = useRef(null);

    const selected = categories.find(c => String(c.id) === String(value)) || null;
    const showSearch = categories.length > 7;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return categories;
        return categories.filter(c => c.name.toLowerCase().includes(q));
    }, [categories, query]);

    // Open/close reset the transient state directly rather than through an
    // effect keyed on `open` — one place to reason about, and no extra render
    // between "opened" and "highlight moved to the current selection".
    const openMenu = () => {
        setQuery('');
        setActiveIndex(categories.findIndex(c => String(c.id) === String(value)));
        setOpen(true);
    };

    const closeMenu = () => {
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
        setCreating(false);
        setNewName('');
        setCreateError('');
    };

    // Close on any click that lands outside, so the popup never strands itself
    // open behind the rest of the form.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e) => {
            if (!rootRef.current?.contains(e.target)) closeMenu();
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (creating) createRef.current?.focus();
        else if (showSearch) searchRef.current?.focus();
    }, [open, creating, showSearch]);

    // Keep the highlighted row in view during keyboard navigation.
    useEffect(() => {
        if (!open || activeIndex < 0) return;
        listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, open]);

    const commit = (category) => {
        onChange(category ? category.id : '');
        closeMenu();
    };

    const submitNewCategory = async () => {
        const name = newName.trim();
        if (!name) {
            setCreateError('Enter a category name');
            return;
        }
        // Case-insensitive, because "BBQ" and "bbq" as separate categories is
        // always a mistake rather than an intent.
        const clash = categories.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
        if (clash) {
            setCreateError('That category already exists');
            return;
        }

        setSaving(true);
        setCreateError('');
        try {
            const created = await onCreate(name);
            commit(created);
        } catch (error) {
            console.error('Failed to create category:', error);
            setCreateError(error.message || 'Could not create category');
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e) => {
        if (!open) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                openMenu();
            }
            return;
        }

        // While the create input is focused it owns Enter and Escape.
        if (creating) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!saving) submitNewCategory();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setCreating(false);
                setCreateError('');
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                closeMenu();
                break;
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(i => (filtered.length ? (i + 1) % filtered.length : -1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(i => (filtered.length ? (i - 1 + filtered.length) % filtered.length : -1));
                break;
            case 'Home':
                e.preventDefault();
                setActiveIndex(filtered.length ? 0 : -1);
                break;
            case 'End':
                e.preventDefault();
                setActiveIndex(filtered.length - 1);
                break;
            case 'Enter':
                e.preventDefault();
                if (filtered[activeIndex]) commit(filtered[activeIndex]);
                break;
            case 'Tab':
                closeMenu();
                break;
            default:
                break;
        }
    };

    return (
        <div className={styles.root} ref={rootRef} onKeyDown={handleKeyDown}>
            <button
                type="button"
                id={id}
                className={`${styles.trigger} ${open ? styles.triggerOpen : ''} ${hasError ? styles.triggerError : ''}`}
                onClick={() => (open ? closeMenu() : openMenu())}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={selected ? styles.value : styles.placeholder}>
                    {selected
                        ? selected.name
                        : categories.length === 0
                            ? 'No categories yet'
                            : 'Select category'}
                </span>
                <ChevronDown size={18} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
            </button>

            {open && (
                <div className={styles.popup}>
                    {showSearch && !creating && (
                        <div className={styles.searchRow}>
                            <Search size={15} className={styles.searchIcon} />
                            <input
                                ref={searchRef}
                                type="text"
                                className={styles.searchInput}
                                placeholder="Filter categories"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                            />
                        </div>
                    )}

                    {!creating && (
                        <ul className={styles.list} role="listbox" ref={listRef}>
                            {filtered.map((cat, i) => {
                                const isSelected = String(cat.id) === String(value);
                                return (
                                    <li
                                        key={cat.id}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`${styles.option} ${i === activeIndex ? styles.optionActive : ''}`}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        onClick={() => commit(cat)}
                                    >
                                        <span>{cat.name}</span>
                                        {isSelected && <Check size={16} className={styles.optionCheck} />}
                                    </li>
                                );
                            })}

                            {filtered.length === 0 && (
                                <li className={styles.noMatch}>
                                    {categories.length === 0
                                        ? 'No categories yet — create the first one below.'
                                        : <>No category matches &ldquo;{query}&rdquo;</>}
                                </li>
                            )}
                        </ul>
                    )}

                    {onCreate && (creating ? (
                        <div className={styles.createPanel}>
                            <input
                                ref={createRef}
                                type="text"
                                className={styles.createInput}
                                placeholder="New category name"
                                value={newName}
                                onChange={(e) => { setNewName(e.target.value); setCreateError(''); }}
                                maxLength={40}
                                disabled={saving}
                            />
                            {createError && <span className={styles.createError}>{createError}</span>}
                            <div className={styles.createActions}>
                                <button
                                    type="button"
                                    className={styles.createCancel}
                                    onClick={() => { setCreating(false); setCreateError(''); }}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className={styles.createSave}
                                    onClick={submitNewCategory}
                                    disabled={saving}
                                >
                                    {saving ? <Loader2 size={13} className={styles.spin} /> : <Plus size={13} />}
                                    {saving ? 'Adding...' : 'Add category'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className={styles.createTrigger}
                            onClick={() => {
                                // Seed with whatever was typed into the filter — if it
                                // matched nothing, that text is the category they want.
                                setNewName(filtered.length === 0 ? query.trim() : '');
                                setCreating(true);
                            }}
                        >
                            <Plus size={14} />
                            New category
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
