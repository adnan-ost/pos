'use client';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
    const pathname = usePathname();
    const isCustomerView = pathname?.startsWith('/customer');
    const isLoginView = pathname?.startsWith('/login');
    // The KDS runs fullscreen on a kitchen screen, so it drops the sidebar
    const isKdsView = pathname?.startsWith('/kds');

    if (isCustomerView || isLoginView || isKdsView) {
        return (
            <main style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
                {children}
            </main>
        );
    }

    return (
        <div style={{ display: 'flex' }}>
            <Sidebar />
            <main style={{
                marginLeft: 'var(--sidebar-width)',
                width: 'calc(100% - var(--sidebar-width))',
                minHeight: '100vh',
                backgroundColor: 'var(--background)'
            }}>
                {children}
            </main>
        </div>
    );
}
