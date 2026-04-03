// API_BASE / fetchJson removed — use Api.historyList() from /ui/lib/api.js

const MOVEMENT_CONFIG = {
    deep_squat: { title: "move_deep_squat", goal: 20, badge: "하체" },
    hurdle_step: { title: "move_hurdle_step", goal: 20, badge: "밸런스" },
    single_leg_balance: { title: "move_single_leg_balance", goal: 30, badge: "밸런스", unit: "초" },
    lunge: { title: "move_lunge", goal: 20, badge: "하체" },
    jump: { title: "move_jump", goal: 10, badge: "파워" },
    arm_raise: { title: "move_arm_raise", goal: 20, badge: "상지" }
};

const state = {
    subjectNo: "",
    moveResults: {}
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
    console.log("[PerfReport] loadData started");
    const lang = localStorage.getItem('appLang') || 'en';
    const t = window.translations?.[lang] || {};

    const email = getStoredEmail();
    console.log(`[PerfReport] Email: ${email}`);

    if (!email) {
        console.warn("[PerfReport] No email found");
        renderEmpty(t.rp_login_req || "로그인이 필요합니다.");
        return;
    }
    state.subjectNo = email;
    if (el.subjectDisplay) {
        el.subjectDisplay.textContent = `${t.rp_subject || '피검자'}: ${email}`;
    }

    try {
        if (el.container) {
            el.container.innerHTML = `<div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 100px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; color: var(--intel-cyan);"></i><p style="margin-top: 16px; color: #94a3b8;">${t.rp_analyzing || '데이터를 분석 중입니다...'}</p></div>`;
        }

        const data = await Api.historyList(email);
        console.log("[PerfReport] Data received", data);

        const items = data.items || data.history || data.data || [];
        console.log(`[PerfReport] Total items: ${items.length}`);

        const grouped = {};
        const moveItems = items.filter(it => (it.module_name || "").toLowerCase() === "movement");
        console.log(`[PerfReport] Movement items: ${moveItems.length}`);

        moveItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        moveItems.forEach(item => {
            const type = item.test_type;
            if (!grouped[type]) {
                const payload = item.result_payload || {};
                const analysis = item.analysis_payload || {};
                let pose = analysis.result?.pose || analysis.pose || null;
                if (!pose && analysis.landmarks) {
                    pose = { landmarks: analysis.landmarks, connections: analysis.connections, frame: analysis.frame };
                }
                grouped[type] = {
                    count: payload.count || payload.metrics?.count || 0,
                    metrics: payload.metrics || {},
                    image: item.artifacts?.raw_public_url || item.artifacts?.overlay_public_url,
                    date: item.created_at,
                    pose: pose
                };
            }
        });

        state.moveResults = grouped;
        console.log("[PerfReport] Grouped data:", state.moveResults);
        renderReport();
    } catch (err) {
        console.error("[PerfReport] Error in loadData:", err);
        const lang = localStorage.getItem('appLang') || 'en';
        const t = window.translations?.[lang] || {};
        renderEmpty(`${t.hist_fetch_fail || '데이터 로드 실패'}: ${err.message}`);
    }
}

function renderReport() {
    console.log("[PerfReport] renderReport started");
    const lang = localStorage.getItem('appLang') || 'en';
    const t = window.translations?.[lang] || {};

    const types = Object.keys(state.moveResults);
    console.log(`[PerfReport] Types to render: ${types.length}`);

    if (types.length === 0) {
        renderEmpty(t.rp_no_move || "측정된 Movement 기록이 없습니다.");
        return;
    }

    if (!el.container) {
        console.error("[PerfReport] Report container not found");
        return;
    }

    el.container.innerHTML = "";
    types.forEach(type => {
        try {
            const res = state.moveResults[type];
            const config = MOVEMENT_CONFIG[type] || { title: type, goal: 20, badge: "운동" };
            const card = document.createElement("div");
            card.className = "perf-card";
            const titleText = t[config.title] || config.title;

            if (type === "deep_squat") {
                const count = res.metrics?.count || res.count || 0;
                const maxDepth = res.metrics?.max_depth || res.metrics?.knee_angle || 0;
                const balLeft = res.metrics?.avg_balance_left || res.metrics?.balance_left || 50;
                const balRight = 100 - balLeft;
                const depthState = maxDepth < 110 ? "Excellent" : (maxDepth < 140 ? "Good" : "Normal");
                const repState = count >= 15 ? "Excellent" : (count >= 10 ? "Good" : "Normal");
                const balDiff = Math.abs(balLeft - balRight);
                const balState = balDiff < 5 ? "Excellent" : (balDiff < 10 ? "Good" : "Normal");

                const getTState = (st) => {
                    if (st === "Excellent") return t.rp_excellent || "Excellent";
                    if (st === "Good") return t.rp_good || "Good";
                    return t.rp_normal_label || "Normal";
                };

                card.innerHTML = `
                    <div class="perf-card-header">
                        <div>
                            <span class="perf-card-title">${titleText}</span>
                            <span class="tag-pill" style="margin-left:8px; background: rgba(0, 199, 253, 0.2); color: #00c7fd;">${config.badge}</span>
                        </div>
                        <span style="font-size: 11px; color: #94a3b8;">${new Date(res.date).toLocaleString()}</span>
                    </div>
                    <div class="perf-visual-area">
                        <div class="perf-canvas-container">
                            <canvas id="canvas_${type}"></canvas>
                        </div>
                    </div>
                    <div class="perf-data-card" style="gap: 12px;">
                        <div style="font-size: 14px; font-weight: 700; color: white; margin-bottom: 4px;">${t.rp_summary || '측정 결과 요약'}</div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <th style="padding: 8px 0; text-align: left; color: #94a3b8;">${t.rp_table_item || 'Item'}</th>
                                <th style="padding: 8px 0; text-align: left; color: #94a3b8;">${t.rp_table_res || 'Result'}</th>
                                <th style="padding: 8px 12px; text-align: right; color: #94a3b8;">${t.rp_table_status || 'Status'}</th>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #e2e8f0;">${t.rp_max_depth || '최대 깊이'}</td>
                                <td style="padding: 10px 0; color: white; font-weight: 700;">${Math.round(maxDepth)}° (${t.rp_gluteal || 'Gluteal'})</td>
                                <td style="padding: 10px 12px; text-align: right;"><span class="tag-pill" style="background:${getStateColor(depthState)}">${getTState(depthState)}</span></td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #e2e8f0;">${t.rp_rep_count || '반복 횟수'}</td>
                                <td style="padding: 10px 0; color: white; font-weight: 700;">${count}${t.unit_reps || 'reps'} (${t.rp_30s || '30s'})</td>
                                <td style="padding: 10px 12px; text-align: right;"><span class="tag-pill" style="background:${getStateColor(repState)}">${getTState(repState)}</span></td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #e2e8f0;">${t.rp_side_balance || '좌우 밸런스'}</td>
                                <td style="padding: 10px 0; color: white; font-weight: 700;">${t.hc_left_short || 'L'} ${Math.round(balLeft)}% / ${t.hc_right_short || 'R'} ${Math.round(balRight)}%</td>
                                <td style="padding: 10px 12px; text-align: right;"><span class="tag-pill" style="background:${getStateColor(balState)}">${getTState(balState)}</span></td>
                            </tr>
                        </table>

                        <div class="perf-comment-box" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
                            <div style="font-weight: 700; color: var(--intel-cyan); margin-bottom: 6px;">${t.rp_overall_grade || '종합 평점'}</div>
                            <p style="margin-bottom: 12px;">${t.rp_squat_summary || '"상위 15%의 하체 유연성을 가지고 계시네요! 전반적인 가동성이 매우 뛰어납니다."'}</p>
                            
                            <div style="font-weight: 700; color: #ffb800; margin-bottom: 4px;">${t.rp_key_comment || '핵심 코멘트'}</div>
                            <p style="margin-bottom: 12px; font-size: 12px;">${t.rp_squat_balance_msg ? t.rp_squat_balance_msg.replace("{side}", balLeft < balRight ? (t.hc_right || 'right') : (t.hc_left || 'left')).replace("{diff}", Math.round(balDiff / 2)) : `"Tendency to lean ${balLeft < balRight ? 'right' : 'left'} by ${Math.round(balDiff / 2)}% during descent. More range will help balance."`}</p>
                            
                            <div style="font-weight: 700; color: #ff5050; margin-bottom: 4px;">${t.rp_safety_warn || '안전 주의'}</div>
                            <p style="margin-bottom: 4px; font-size: 12px;">${t.rp_squat_safety_msg || '"최하단 지점에서 요추 후만(허리 말림)이 살짝 관찰되었습니다. 복압 유지에 더 신경 써보세요."'}</p>
                        </div>

                        <div style="padding: 12px; background: linear-gradient(90deg, rgba(0, 199, 253, 0.1), transparent); border-radius: 10px; border-left: 3px solid var(--intel-cyan);">
                            <span style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 4px;">${t.rp_rec_routine || '추천 루틴'}</span>
                            <span style="font-size: 13px; color: white;">${t.rp_squat_rec_msg || `오늘 측정 결과를 바탕으로, <strong>'고관절 가동성 스트레칭'</strong>과 <strong>'중둔근 강화 운동'</strong>을 10분간 진행해보는 건 어떨까요?`}</span>
                        </div>
                    </div>
                `;
            } else {
                const count = res.count;
                const goal = config.goal;
                const rate = Math.min(100, Math.round((count / goal) * 100));
                const unit = config.unit || t.unit_reps || (lang === 'kr' ? "회" : "reps");

                let comment = t.rp_move_comment_excellent || "Excellent! Keep working towards your goal.";
                if (rate < 50) comment = t.rp_move_comment_poor || "Need to improve basic fitness. Try to increase reps daily.";
                else if (rate < 80) comment = t.rp_move_comment_good || "Keep trying with stable posture to reach your goal!";

                card.innerHTML = `
                    <div class="perf-card-header">
                        <div>
                            <span class="perf-card-title">${titleText}</span>
                            <span class="tag-pill" style="margin-left:8px;">${config.badge}</span>
                        </div>
                        <span style="font-size: 11px; color: #94a3b8;">${new Date(res.date).toLocaleDateString()}</span>
                    </div>
                    <div class="perf-visual-area">
                        <div class="perf-canvas-container">
                            <canvas id="canvas_${type}"></canvas>
                        </div>
                    </div>
                    <div class="perf-data-card">
                        <div class="perf-stats-main">
                            <div class="perf-value-group">
                                <span class="perf-value-label">${t.rp_perf_count || 'Performance Count'}</span>
                                <div class="perf-value-big">${count}<span>/ ${goal}${unit}</span></div>
                            </div>
                            <div class="perf-gauge-area">
                                <svg width="80" height="80" viewBox="0 0 80 80">
                                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6" />
                                    <circle cx="40" cy="40" r="34" fill="none" stroke="var(--intel-cyan)" stroke-width="6" 
                                        stroke-dasharray="${2 * Math.PI * 34}" stroke-dashoffset="${2 * Math.PI * 34 * (1 - rate / 100)}" 
                                        stroke-linecap="round" transform="rotate(-90 40 40)" />
                                    <text x="40" y="45" text-anchor="middle" fill="white" font-size="14" font-weight="800">${rate}%</text>
                                </svg>
                            </div>
                        </div>
                        <div class="perf-comment-box">
                            <i class="fa-solid fa-comment-dots" style="color:var(--intel-cyan); margin-right:8px;"></i>
                            ${comment}
                        </div>
                    </div>
                `;
            }
            el.container.appendChild(card);
            setTimeout(() => drawPoseOverlay(`canvas_${type}`, res.image, res.pose), 50);
        } catch (cardErr) {
            console.error(`[PerfReport] Error rendering card for ${type}:`, cardErr);
        }
    });
}

function getStateColor(state) {
    if (state === "Excellent") return "rgba(0, 255, 120, 0.2); color: #00ff78;";
    if (state === "Good") return "rgba(255, 184, 0, 0.2); color: #ffb800;";
    return "rgba(148, 163, 184, 0.2); color: #cbd5e1;";
}

function drawPoseOverlay(canvasId, imageUrl, poseData) {
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
        if (poseData && poseData.landmarks) {
            const frameW = poseData.frame?.width || (poseData.landmarks[0]?.x > 1 ? 640 : 1);
            const frameH = poseData.frame?.height || (poseData.landmarks[0]?.y > 1 ? 480 : 1);
            const sx = frameW > 1 ? (canvas.width / frameW) : canvas.width;
            const sy = frameH > 1 ? (canvas.height / frameH) : canvas.height;
            const landmarks = poseData.landmarks;
            const connections = poseData.connections || [
                [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
                [11, 23], [12, 24], [23, 24],
                [23, 25], [25, 27], [24, 26], [26, 28],
                [27, 31], [28, 32], [27, 29], [28, 30]
            ];
            const byIndex = {};
            landmarks.forEach(lm => byIndex[lm.index] = lm);
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0, 255, 120, 0.9)";
            ctx.shadowBlur = 4;
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            connections.forEach(([a, b]) => {
                const p1 = byIndex[a];
                const p2 = byIndex[b];
                if (p1 && p2 && (p1.visibility || 1) > 0.3 && (p2.visibility || 1) > 0.3) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x * sx, p1.y * sy);
                    ctx.lineTo(p2.x * sx, p2.y * sy);
                    ctx.stroke();
                }
            });
            ctx.shadowBlur = 0;
            landmarks.forEach(lm => {
                if ((lm.visibility || 1) > 0.3) {
                    ctx.beginPath();
                    ctx.fillStyle = "#ff5050";
                    ctx.strokeStyle = "white";
                    ctx.lineWidth = 1;
                    ctx.arc(lm.x * sx, lm.y * sy, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
        }
    };
    img.onerror = () => {
        console.error(`[PerfReport] Failed to load image: ${imageUrl}`);
    };
}

function renderEmpty(msg) {
    if (!el.container) return;
    el.container.innerHTML = `
        <div class="empty-report" style="grid-column: 1/-1;">
            <i class="fa-solid fa-person-running"></i>
            <p>${msg}</p>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("[PerfReport] DOMContentLoaded - initiating loadData");
    loadData();
});
