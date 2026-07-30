'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    Utensils, ClipboardList, ChefHat, BarChart3, ExternalLink, User, LogOut,
    MonitorPlay, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { logout } from '@/app/logout/actions';

const NAV_LINKS = [
    { href: '/pos', label: 'POS', Icon: Utensils },
    { href: '/orders', label: 'Orders', Icon: ClipboardList },
    { href: '/kds', label: 'Kitchen Display', Icon: MonitorPlay, newTab: true },
    { href: '/menu', label: 'Menu Management', Icon: ChefHat },
    { href: '/customer', label: 'Customer View', Icon: ExternalLink, newTab: true },
    { href: '/reports', label: 'Reports', Icon: BarChart3 }
];

const Sidebar = ({ collapsed = false, onToggle }) => {
    const pathname = usePathname();
    // Icons carry the whole nav once the labels are gone, so scale them up
    const iconSize = collapsed ? 26 : 20;

    const navLink = ({ href, label, Icon, newTab }) => (
        <Link
            key={href}
            href={href}
            className={`${styles.link} ${pathname === href ? styles.active : ''}`}
            title={collapsed ? label : undefined}
            {...(newTab ? { target: '_blank' } : {})}
        >
            <Icon className={styles.icon} size={iconSize} />
            {!collapsed && <span className={styles.label}>{label}</span>}
        </Link>
    );

    return (
        <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
            <div className={styles.header}>
                <Link href="/pos" className={styles.logo} aria-label="Go to POS home">
                    {collapsed ? (
                        // Crop the wordmark down to the flame mark on the left
                        <span className={styles.logoMark}>
                            <Image
                                src="/flames-by-the-indus-logo.svg"
                                alt="Flames by the Indus"
                                width={146}
                                height={52}
                                priority
                            />
                        </span>
                    ) : (
                        <Image
                            src="/flames-by-the-indus-logo.svg"
                            alt="Flames by the Indus"
                            width={160}
                            height={48}
                            priority
                        />
                    )}
                </Link>

                {!collapsed && (
                    <button
                        type="button"
                        className={styles.toggle}
                        onClick={onToggle}
                        title="Hide menu"
                        aria-label="Hide menu"
                    >
                        <PanelLeftClose size={20} />
                    </button>
                )}
            </div>

            <nav className={styles.nav}>
                {collapsed && (
                    <button
                        type="button"
                        className={`${styles.link} ${styles.toggleRow}`}
                        onClick={onToggle}
                        title="Show menu"
                        aria-label="Show menu"
                    >
                        <PanelLeftOpen className={styles.icon} size={iconSize} />
                    </button>
                )}

                {NAV_LINKS.map(navLink)}

                <div className={styles.spacer}></div>

                {navLink({ href: '/profile', label: 'Profile', Icon: User })}

                <form action={logout} className={styles.logoutForm}>
                    <button
                        type="submit"
                        className={styles.link}
                        title={collapsed ? 'Logout' : undefined}
                    >
                        <LogOut className={styles.icon} size={iconSize} />
                        {!collapsed && <span className={styles.label}>Logout</span>}
                    </button>
                </form>
            </nav>

            <div className={styles.footer}>
                {!collapsed && <p>User: Admin</p>}
                <div className={styles.status} title={collapsed ? 'Online' : undefined}>
                    {!collapsed && 'Online'}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
