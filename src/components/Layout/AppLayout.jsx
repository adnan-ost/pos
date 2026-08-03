'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

// The signed-in role, computed once server-side in layout.js. Exposed here
// rather than re-fetched per page — e.g. the receipt needs it to print who
// was on the till.
const RoleContext = createContext(null);
export const useRole = () => useContext(RoleContext);

const COLLAPSE_KEY = 'fbi.sidebarCollapsed';

/*
 * The collapse preference lives in localStorage so it survives reloads and stays
 * in step across tabs. Reading it through a store (rather than an effect) keeps
 * the server-rendered markup matching the first client render.
 */
const listeners = new Set();

const collapseStore = {
    subscribe(onChange) {
        listeners.add(onChange);
        window.addEventListener('storage', onChange);
        return () => {
            listeners.delete(onChange);
            window.removeEventListener('storage', onChange);
        };
    },
    getSnapshot: () => window.localStorage.getItem(COLLAPSE_KEY) === '1',
    getServerSnapshot: () => false,
    set(collapsed) {
        window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
        listeners.forEach(onChange => onChange());
    }
};

export default function AppLayout({ children, role }) {
    const pathname = usePathname();
    const isCustomerView = pathname?.startsWith('/customer');
    const isLoginView = pathname?.startsWith('/login');
    // The KDS runs fullscreen on a kitchen screen, so it drops the sidebar
    const isKdsView = pathname?.startsWith('/kds');

    const collapsed = useSyncExternalStore(
        collapseStore.subscribe,
        collapseStore.getSnapshot,
        collapseStore.getServerSnapshot
    );

    const toggleSidebar = () => collapseStore.set(!collapsed);

    if (isCustomerView || isLoginView || isKdsView) {
        return (
            <RoleContext.Provider value={role}>
                <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
                    {children}
                </main>
            </RoleContext.Provider>
        );
    }

    return (
        <RoleContext.Provider value={role}>
            <div style={{ display: 'flex', '--sidebar-width': collapsed ? '84px' : '280px' }}>
                <Sidebar collapsed={collapsed} onToggle={toggleSidebar} role={role} />
                <main style={{
                    marginLeft: 'var(--sidebar-width)',
                    width: 'calc(100% - var(--sidebar-width))',
                    minHeight: '100vh',
                    backgroundColor: 'var(--background)',
                    transition: 'margin-left 0.2s ease, width 0.2s ease'
                }}>
                    {children}
                </main>
            </div>
        </RoleContext.Provider>
    );
}
