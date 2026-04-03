'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState } from 'react';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const router = useRouter();
  const pathname = router.pathname;
  const [submenuOpen, setSubmenuOpen] = useState(false);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  function navigate(href: string) {
    router.push(href);
  }

  return (
    <aside className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brandHeader}>
        <div className={styles.logoIcon}>
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill="url(#grad2)" />
            <path d="M24 10C17.373 10 12 15.373 12 22c0 6.627 5.373 12 12 12s12-5.373 12-12c0-6.627-5.373-12-12-12zm0 22c-5.523 0-10-4.477-10-10S18.477 12 24 12s10 4.477 10 10-4.477 10-10 10z" fill="#00C7FD" opacity="0.9"/>
            <circle cx="24" cy="22" r="5" fill="#00C7FD"/>
            <defs>
              <linearGradient id="grad2" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#004585"/>
                <stop offset="1" stopColor="#0071C5"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className={styles.brandText} data-i18n="brand_name">BodyCheck</span>
      </div>

      {/* Nav */}
      <nav className={styles.navMenu}>
        {/* Dashboard */}
        <Link href="/dashboard" className={`${styles.navItem} ${isActive('/dashboard') ? styles.active : ''}`}>
          <i className="fa-solid fa-chart-pie" />
          <span data-i18n="nav_dash">Dashboard</span>
        </Link>

        {/* Statistics */}
        <Link href="/statistics" className={`${styles.navItem} ${isActive('/statistics') ? styles.active : ''}`}>
          <i className="fa-solid fa-chart-line" />
          <span data-i18n="nav_stats">Statistics</span>
        </Link>

        {/* Health Check dropdown */}
        <div className={`${styles.navItem} ${styles.hasDropdown}`}>
          <button
            className={styles.dropdownTrigger}
            onClick={() => setSubmenuOpen((v) => !v)}
            type="button"
          >
            <i className="fa-solid fa-heart-pulse" />
            <span data-i18n="nav_health">Health Check</span>
            <i className={`fa-solid fa-chevron-down chevron ${submenuOpen ? styles.chevronOpen : ''}`} />
          </button>
          <div className={`${styles.submenu} ${submenuOpen ? styles.submenuOpen : ''}`}>
            <Link href="/health-check" className={`${styles.submenuItem} ${isActive('/health-check') ? styles.active : ''}`} data-i18n="nav_bodycheck">bodycheck</Link>
            <Link href="/anthropometry" className={`${styles.submenuItem} ${isActive('/anthropometry') ? styles.active : ''}`} data-i18n="nav_anthropometry">anthropometry</Link>
            <Link href="/history" className={`${styles.submenuItem} ${isActive('/history') ? styles.active : ''}`} data-i18n="nav_history">history</Link>

            {/* NOT YET MIGRATED */}
            <button className={styles.submenuItem} onClick={() => navigate('/health-check')} data-i18n="nav_rom">rom</button>
            <button className={styles.submenuItem} onClick={() => navigate('/health-check')} data-i18n="nav_mobility">ROM Report</button>
            <button className={styles.submenuItem} onClick={() => navigate('/health-check')} data-i18n="nav_movement">Performance Analysis</button>
            <button className={styles.submenuItem} onClick={() => navigate('/health-check')} data-i18n="nav_perf">performancereport</button>
          </div>
        </div>

        {/* Prescriptions */}
        <Link href="/prescriptions" className={`${styles.navItem} ${isActive('/prescriptions') ? styles.active : ''}`}>
          <i className="fa-solid fa-prescription-bottle-medical" />
          <span data-i18n="nav_presc">Prescriptions</span>
        </Link>
      </nav>

      {/* Controls */}
      <div className={styles.sidebarControls}>
        <button id="themeToggleBtn" className={styles.iconBtn} aria-label="Toggle Theme">
          <i className="fa-solid fa-moon" />
        </button>
        <button id="langToggleBtn" className={styles.iconBtn} aria-label="Toggle Language">KO</button>
      </div>

      {/* User profile */}
      <div className={styles.userProfile}>
        <div className={styles.avatar}>
          <img src="https://ui-avatars.com/api/?name=Alex+Doe&background=0071C5&color=fff&size=100" alt="User Profile" />
        </div>
        <div className={styles.userInfo}>
          <h4 id="user-display-email">Alex Doe</h4>
          <p data-i18n="nav_plan">Standard Plan</p>
        </div>
        <button className={styles.logoutBtn} aria-label="Logout" onClick={() => window.location.href = '/'}>
          <i className="fa-solid fa-arrow-right-from-bracket" />
        </button>
      </div>
    </aside>
  );
}
