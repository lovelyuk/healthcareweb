/**
 * sidebar.js - Dropdown and navigation logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const MOBILE_BREAKPOINT = 900;
    const measurementLinks = [
        '/ui/health-check.html',
        '/ui/anthropometry.html',
        '/ui/rom.html'
    ];
    const measurementPages = new Set(measurementLinks);

    const isMobileViewport = () => {
        const hasTouchDeviceUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
        return window.innerWidth <= MOBILE_BREAKPOINT || hasTouchDeviceUa;
    };

    const applyMobileMenuMode = () => {
        const mobileMode = isMobileViewport();
        document.body.classList.toggle('mobile-ui-mode', mobileMode);

        measurementLinks.forEach((href) => {
            const item = document.querySelector(`a[href="${href}"]`);
            if (!item) return;
            item.style.display = mobileMode ? 'none' : '';
            item.setAttribute('aria-hidden', mobileMode ? 'true' : 'false');
            item.tabIndex = mobileMode ? -1 : 0;
        });

        enforceMobileMeasurementLock(mobileMode);
    };

    const enforceMobileMeasurementLock = (mobileMode) => {
        const currentPath = window.location.pathname;
        const onMeasurementPage = measurementPages.has(currentPath);
        const shouldRestrict = mobileMode && onMeasurementPage;

        document.body.classList.toggle('measurement-restricted-mobile', shouldRestrict);

        const lockTargets = document.querySelectorAll('#btnAgent, #btnMeasureStart, #btnFront, #btnSide, #btnRefresh');
        lockTargets.forEach((element) => {
            if (shouldRestrict) {
                element.disabled = true;
                element.classList.add('mobile-locked-control');
                if ('style' in element) {
                    element.style.pointerEvents = 'none';
                    element.style.opacity = '0.45';
                }
            } else {
                element.classList.remove('mobile-locked-control');
                if ('style' in element) {
                    element.style.pointerEvents = '';
                    element.style.opacity = '';
                }
            }
        });

        const existingNotice = document.querySelector('.mobile-measurement-notice');
        if (!shouldRestrict) {
            existingNotice?.remove();
            return;
        }

        if (existingNotice) return;

        const host = document.querySelector('main, .dashboard-main, .hc-page, .page-content') || document.body;
        const notice = document.createElement('div');
        notice.className = 'mobile-measurement-notice';
        notice.innerHTML = `
            <h3>Desktop Required for Measurement</h3>
            <p>On mobile, BodyCheck shows results, history, and analysis only.</p>
            <div class="mobile-measurement-links">
                <a href="/ui/history.html">View History</a>
                <a href="/ui/mobilityreport.html">ROM Report</a>
                <a href="/ui/performancereport.html">Performance Report</a>
            </div>
        `;
        host.prepend(notice);
    };

    applyMobileMenuMode();
    window.addEventListener('resize', applyMobileMenuMode);

    const dropdownTrigger = document.querySelector('.dropdown-trigger');
    const healthCheckItem = document.querySelector('.nav-item.has-dropdown');

    if (dropdownTrigger && healthCheckItem) {
        dropdownTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            healthCheckItem.classList.toggle('expanded');

            // Persist the state in localStorage
            const isExpanded = healthCheckItem.classList.contains('expanded');
            localStorage.setItem('healthCheckMenuExpanded', isExpanded);
        });

        // Restore state from localStorage
        const storedState = localStorage.getItem('healthCheckMenuExpanded');
        if (storedState === 'true') {
            healthCheckItem.classList.add('expanded');
        }
    }

    // Highlight active menu item based on current URL
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item:not(.has-dropdown), .submenu-item');

    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && (currentPath.includes(href) || (href === '/' && currentPath === '/'))) {
            item.classList.add('active');

            // If it's a submenu item, make sure the parent is expanded
            if (item.classList.contains('submenu-item')) {
                if (healthCheckItem) {
                    healthCheckItem.classList.add('expanded');
                }
            }
        }
    });
    // Use BodyCheckUser utility to show user email
    if (window.BodyCheckUser) {
        const userEmail = window.BodyCheckUser.getCurrentUserEmail();
        if (userEmail) {
            // Update email text
            const userEmailDisplay = document.getElementById('user-display-email') || document.querySelector('.user-info h4');
            if (userEmailDisplay) {
                userEmailDisplay.textContent = userEmail;
            }

            // Update greeting in dashboard if applicable
            const greetingName = document.getElementById('greeting-user-name');
            if (greetingName) {
                greetingName.textContent = userEmail.split('@')[0];
            }

            // Update avatar
            const userAvatar = document.querySelector('.user-profile .avatar img');
            if (userAvatar) {
                userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userEmail)}&background=0071C5&color=fff&size=100`;
            }
        }
    }
});
