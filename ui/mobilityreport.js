// API_BASE / fetchJson removed — use Api.historyList() from /ui/lib/api.js

const ROM_CONFIG = {
    cervical_rotation: { title: "rom_cervical_rotation", normal: 80 },
    shoulder_flexion: { title: "rom_shoulder_flexion", normal: 180 },
    shoulder_abduction: { title: "rom_shoulder_abduction", normal: 180 },
    hip_flexion: { title: "rom_hip_flexion", normal: 120 },
    knee_flexion: { title: "rom_knee_flexion", normal: 140 },
    ankle_dorsiflexion: { title: "rom_ankle_dorsiflexion", normal: 20 }
};

const state = {
    subjectNo: "",
    romResults: {} // test_type -> { left: result, right: result }
};

const el = {
    container: document.getElementById("reportContainer"),
    subjectDisplay: document.getElementById("subjectDisplay")
};

function getStoredEmail() {
    if (window.BodyCheckUser && window.BodyCheckUser.getCurrentUserEmail) {
        return window.BodyCheckUser.getCurrentUserEmail();
    }
    return (localStorage.getItem("bodycheck_user_email") || "").trim();
}

async function loadData() {
    const lang = localStorage.getItem('appLang') || 'en';
    const t = window.translations?.[lang] || {};

    const email = getStoredEmail();
    if (!email) {
        renderEmpty(t.rp_login_req || "로그인이 필요합니다.");
        return;
    }
    state.subjectNo = email;
    el.subjectDisplay.textContent = `${t.rp_subject || '피검자'}: ${email}`;

    try {
        el.container.innerHTML = `<div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 100px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size: 32px; color: var(--intel-cyan);"></i><p style="margin-top: 16px; color: #94a3b8;">${t.rp_loading || '데이터를 불러오는 중...'}</p></div>`;

        const data = await Api.historyList(email);
        const items = data.items || data.history || data.data || [];

        const grouped = {};
        const romItems = items.filter(it => (it.module_name || "").toLowerCase() === "rom");
        romItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        romItems.forEach(item => {
            const type = item.test_type;
            const payload = item.result_payload || {};
            const side = (payload.side || payload.metrics?.direction || "right").toLowerCase();

            if (!grouped[type]) grouped[type] = {};
            if (!grouped[type][side]) {
                grouped[type][side] = {
                    angle: payload.angle || payload.metrics?.angle || payload.metrics?.rotation_angle || payload.metrics?.flexion_angle || 0,
                    image: item.artifacts?.overlay_public_url || item.artifacts?.raw_public_url,
                    date: item.created_at
                };
            }
        });

        state.romResults = grouped;
        renderReport();
    } catch (err) {
        console.error(err);
        const lang = localStorage.getItem('appLang') || 'en';
        const t = window.translations?.[lang] || {};
        renderEmpty(`${t.hist_fetch_fail || '데이터 로드 실패'}: ${err.message}`);
    }
}

function renderReport() {
    const lang = localStorage.getItem('appLang') || 'en';
    const t = window.translations?.[lang] || {};

    const types = Object.keys(state.romResults);
    if (types.length === 0) {
        renderEmpty(t.rp_no_rom || "측정된 ROM 기록이 없습니다.");
        return;
    }

    el.container.innerHTML = "";
    types.forEach(type => {
        const results = state.romResults[type];
        const config = ROM_CONFIG[type] || { title: type, normal: 90 };
        const left = results.left;
        const right = results.right;

        const leftVal = left ? left.angle : 0;
        const rightVal = right ? right.angle : 0;
        const normal = config.normal;
        const leftRate = Math.min(100, Math.round((leftVal / normal) * 100));
        const rightRate = Math.min(100, Math.round((rightVal / normal) * 100));
        const imbalance = Math.abs(leftVal - rightVal);

        const card = document.createElement("div");
        card.className = "rom-card";
        const titleText = t[config.title] || config.title;
        const reachText = t.hist_reach || "Reach";

        card.innerHTML = `
            <div class="rom-card-header">
                <span class="rom-card-title">${titleText}</span>
                <span style="font-size: 11px; color: #94a3b8;">${new Date(left?.date || right?.date).toLocaleDateString()}</span>
            </div>
            <div class="rom-visual-row">
                <div class="rom-visual-item">
                    <span class="side-label">${t.hc_left || 'LEFT'}</span>
                    <div class="rom-canvas-container">
                        <canvas id="canvas_${type}_left"></canvas>
                    </div>
                </div>
                <div class="rom-visual-item">
                    <span class="side-label">${t.hc_right || 'RIGHT'}</span>
                    <div class="rom-canvas-container">
                        <canvas id="canvas_${type}_right"></canvas>
                    </div>
                </div>
            </div>
            <div class="rom-data-card">
                <div class="rom-stats-row">
                    <div class="rom-stat-box">
                        <div class="rom-stat-label">${t.rp_left_meas || 'Left Measurement'}</div>
                        <div class="rom-stat-value">${leftVal.toFixed(1)}°</div>
                        <div class="rom-progress-container"><div class="rom-progress-bar" style="width: ${leftRate}%"></div></div>
                        <div style="font-size:10px; color:#94a3b8; margin-top:4px;">${reachText}: ${leftRate}%</div>
                    </div>
                    <div style="width: 1px; height: 40px; background: rgba(255,255,255,0.1); margin: 0 16px;"></div>
                    <div class="rom-stat-box">
                        <div class="rom-stat-label">${t.rp_right_meas || 'Right Measurement'}</div>
                        <div class="rom-stat-value">${rightVal.toFixed(1)}°</div>
                        <div class="rom-progress-container"><div class="rom-progress-bar" style="width: ${rightRate}%"></div></div>
                        <div style="font-size:10px; color:#94a3b8; margin-top:4px;">${reachText}: ${rightRate}%</div>
                    </div>
                </div>
                <div style="margin-top: 8px;">
                    <div class="rom-stat-label">${t.rp_normal_range || 'Normal Range'}: ${normal}°</div>
                </div>
                ${imbalance > 10 ? `
                    <div class="imbalance-alert">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>${t.hist_imbalance_warn || '좌우 불균형 주의: 측정치 차이가'} ${imbalance.toFixed(1)}° ${t.hc_unit_deg_is || "입니다."}</span>
                    </div>
                ` : ""}
            </div>
        `;
        el.container.appendChild(card);

        if (left) drawFanOverlay(`canvas_${type}_left`, left.image, leftVal, true);
        if (right) drawFanOverlay(`canvas_${type}_right`, right.image, rightVal, false);
    });
}

function drawFanOverlay(canvasId, imageUrl, angle, isLeft) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
        canvas.width = 400;
        canvas.height = 300;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.4;
        const radius = 80;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = isLeft ? "rgba(239, 68, 68, 0.4)" : "rgba(59, 130, 246, 0.4)";
        ctx.strokeStyle = isLeft ? "#ef4444" : "#3b82f6";
        ctx.lineWidth = 2;
        const startRad = -Math.PI / 2;
        const diffRad = (angle * Math.PI) / 180;
        const endRad = isLeft ? (startRad - diffRad) : (startRad + diffRad);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startRad, endRad, isLeft);
        ctx.lineTo(cx, cy);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Inter";
        ctx.textAlign = "center";
        const midRad = (startRad + endRad) / 2;
        const tx = cx + Math.cos(midRad) * (radius + 20);
        const ty = cy + Math.sin(midRad) * (radius + 20);
        ctx.fillText(`${angle.toFixed(1)}°`, tx, ty);
        ctx.restore();
    };
}

function renderEmpty(msg) {
    el.container.innerHTML = `
        <div class="empty-report" style="grid-column: 1/-1;">
            <i class="fa-solid fa-folder-open"></i>
            <p>${msg}</p>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", loadData);
