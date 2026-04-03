import os, glob, re

replacement = """        <nav class=\"nav-menu\">
            <a href=\"/dashboard.html\" class=\"nav-item\">
                <i class=\"fa-solid fa-chart-pie\"></i>
                <span data-i18n=\"nav_dash\">Dashboard</span>
            </a>
            <a href=\"/statistics.html\" class=\"nav-item\">
                <i class=\"fa-solid fa-chart-line\"></i>
                <span data-i18n=\"nav_stats\">Statistics</span>
            </a>

            <div class=\"nav-item has-dropdown\">
                <div class=\"dropdown-trigger\">
                    <i class=\"fa-solid fa-heart-pulse\"></i>
                    <span data-i18n=\"nav_health\">Health Check</span>
                    <i class=\"fa-solid fa-chevron-down chevron\"></i>
                </div>
                <div class=\"submenu\">
                    <a href=\"/ui/health-check.html\" class=\"submenu-item\" data-i18n=\"nav_bodycheck\">bodycheck</a>
                    <a href=\"/ui/anthropometry.html\" class=\"submenu-item\"
                        data-i18n=\"nav_anthropometry\">anthropometry</a>
                    <a href=\"/ui/rom.html\" class=\"submenu-item\" data-i18n=\"nav_rom\">rom</a>
                    <a href=\"/ui/mobilityreport.html\" class=\"submenu-item\" data-i18n=\"nav_mobility\">ROM Report</a>
                    <a href=\"/ui/movement.html\" class=\"submenu-item\" data-i18n=\"nav_movement\">Performance Analysis</a>
                    <a href=\"/ui/performancereport.html\" class=\"submenu-item\" data-i18n=\"nav_perf\">performancereport</a>
                    <a href=\"/ui/history.html\" class=\"submenu-item\" data-i18n=\"nav_history\">history</a>
                </div>
            </div>

            <a href=\"/prescription.html\" class=\"nav-item\">
                <i class=\"fa-solid fa-prescription-bottle-medical\"></i>
                <span data-i18n=\"nav_presc\">Prescriptions</span>
            </a>
        </nav>

        <div class=\"sidebar-controls\"
            style=\"margin-top: auto; padding: 0 16px 16px; display: flex; gap: 10px; justify-content: center;\">
            <button id=\"themeToggleBtn\" class=\"icon-btn\" aria-label=\"Toggle Theme\"
                style=\"background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; transition: all 0.2s;\">
                <i class=\"fa-solid fa-moon\"></i>
            </button>
            <button id=\"langToggleBtn\" class=\"icon-btn\" aria-label=\"Toggle Language\"
                style=\"background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1); width: 36px; height: 36px; border-radius: 50%; cursor: pointer; transition: all 0.2s; font-weight: 600; font-size: 12px;\">
                KO
            </button>
        </div>

        <div class=\"user-profile\">
            <div class=\"avatar\">
                <img src=\"https://ui-avatars.com/api/?name=Alex+Doe&background=0071C5&color=fff&size=100\"
                    alt=\"User Profile\">
            </div>
            <div class=\"user-info\">
                <h4 id=\"user-display-email\">Alex Doe</h4>
                <p data-i18n=\"nav_plan\">Standard Plan</p>
            </div>
            <button class=\"logout-btn\" aria-label=\"Logout\" onclick=\"window.location.href='/index.html'\">
                <i class=\"fa-solid fa-arrow-right-from-bracket\"></i>
            </button>
        </div>
    </aside>"""

# REALSENSE_REMOVE_CANDIDATE: 잘못된 RealSense 경로 참조
files = glob.glob('g:/Healthcare/RealSense/ui/*.html')  # REALSENSE_REMOVE_CANDIDATE: 잘못된 경로
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # regex match from <nav class="nav-menu"> to </aside>
    pattern = re.compile(r'<nav class="nav-menu">.*?</aside>', re.DOTALL)
    
    if pattern.search(content):
        new_content = pattern.sub(replacement, content)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Replaced in {file}')
    else:
        print(f'Pattern not found in {file}')
