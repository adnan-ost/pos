import Link from 'next/link';
import Image from 'next/image';
import { Utensils, ClipboardList, ChefHat, BarChart3, Settings, ExternalLink, User, LogOut } from 'lucide-react';
import styles from './Sidebar.module.css';
import { logout } from '@/app/logout/actions';

const Sidebar = () => {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <Image
                    src="/flames-by-the-indus-logo.svg"
                    alt="Flames by the Indus"
                    width={160}
                    height={48}
                    priority
                />
            </div>

            <nav className={styles.nav}>
                <Link href="/pos" className={`${styles.link}`}>
                    <Utensils className={styles.icon} size={20} />
                    POS
                </Link>
                <Link href="/orders" className={styles.link}>
                    <ClipboardList className={styles.icon} size={20} />
                    Orders
                </Link>
                <Link href="/menu" className={styles.link}>
                    <ChefHat className={styles.icon} size={20} />
                    Menu Management
                </Link>
                <Link href="/customer" className={styles.link} target="_blank">
                    <ExternalLink className={styles.icon} size={20} />
                    Customer View
                </Link>
                <Link href="/reports" className={styles.link}>
                    <BarChart3 className={styles.icon} size={20} />
                    Reports
                </Link>

                <div className={styles.spacer}></div>

                <Link href="/profile" className={styles.link}>
                    <User className={styles.icon} size={20} />
                    Profile
                </Link>

                <form action={logout}>
                    <button type="submit" className={`${styles.link} w-full text-left`}>
                        <LogOut className={styles.icon} size={20} />
                        Logout
                    </button>
                </form>
            </nav>

            <div className={styles.footer}>
                <p>User: Admin</p>
                <div className={styles.status}>Online</div>
            </div>
        </aside>
    );
};

export default Sidebar;
