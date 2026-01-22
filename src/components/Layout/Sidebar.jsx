import Link from 'next/link';
import Image from 'next/image';
import { Utensils, ClipboardList, ChefHat, BarChart3, Settings } from 'lucide-react';
import styles from './Sidebar.module.css';

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
                <Link href="/pos" className={`${styles.link} ${styles.active}`}>
                    <Utensils className={styles.icon} size={20} />
                    POS
                </Link>
                <Link href="/orders" className={styles.link}>
                    <ClipboardList className={styles.icon} size={20} />
                    Orders
                </Link>
                <Link href="/menu" className={styles.link}>
                    <ChefHat className={styles.icon} size={20} />
                    Menu
                </Link>
                <Link href="/reports" className={styles.link}>
                    <BarChart3 className={styles.icon} size={20} />
                    Reports
                </Link>

                <div className={styles.spacer}></div>

                <Link href="/settings" className={styles.link}>
                    <Settings className={styles.icon} size={20} />
                    Settings
                </Link>
            </nav>

            <div className={styles.footer}>
                <p>User: Admin</p>
                <div className={styles.status}>Online</div>
            </div>
        </aside>
    );
};

export default Sidebar;
