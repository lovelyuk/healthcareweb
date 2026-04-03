// API_BASE and fetchJson moved to /ui/lib/api.js — use Api.historyList, Api.historyDetail, etc.

const state = {
  subjectNo: "",
  items: [],
  selectedItem: null,
  selectedDetail: null,
  complementaryDetail: null // Store the paired ROM side
};

const el = {
  list: document.getElementById("historyList"),
  empty: document.getElementById("historyEmpty"),
  detail: document.getElementById("historyDetail"),
  detailEmpty: document.getElementById("historyDetailEmpty"),
  loading: document.getElementById("historyLoading"),
  detailLoading: document.getElementById("historyDetailLoading"),
  subjectText: document.getElementById("historySubjectText"),
  refreshBtn: document.getElementById("btnHistoryRefresh")
};

function getStoredEmail() {
  if (window.BodyCheckUser && window.BodyCheckUser.getCurrentUserEmail) {
    return window.BodyCheckUser.getCurrentUserEmail();
  }
  return (
    localStorage.getItem("bodycheck_user_email") ||
    localStorage.getItem("bodycheck_email") ||
    sessionStorage.getItem("bodycheck_email") ||
    ""
  ).trim();
}

// fetchJson removed — use Api.historyList, Api.historyDetail, Api.historyDelete

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const lang = localStorage.getItem('appLang') || 'en';
  const locale = lang === 'kr' ? 'ko-KR' : 'en-US';
  return d.toLocaleString(locale);
}


function moduleLabel(moduleName, testType) {
  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};
  const m = (moduleName || "").toLowerCase();
  const tt = (testType || "").toLowerCase();
  if (m.includes("body") || tt.includes("body")) return t.hc_tab_body || "Body";
  if (m.includes("rom") || tt.includes("rom")) return t.hc_tab_rom || "ROM";
  if (m.includes("movement") || tt.includes("movement")) return t.hc_tab_move || "Movement";
  return moduleName || testType || "Unknown";
}

function detectResultId(item) {
  return item?.result_id || item?.id || "";
}

function detectCreatedAt(item) {
  return item?.created_at || item?.result_created_at || item?.inserted_at || "";
}

function detectModuleName(item) {
  return item?.module_name || item?.module || "";
}

function detectTestType(item) {
  return item?.test_type || "";
}

function detectSide(item) {
  // Data is fetched from Supabase. Ensure side metadata is correctly identified.
  const payload = item?.result_payload || item?.analysis_payload || {};
  const metrics = payload.metrics || {};
  return (payload.side || metrics.direction || item.side || "right").toLowerCase();
}

function extractAngle(item) {
  const payload = item?.result_payload || {};
  const metrics = payload.metrics || {};
  // Check all possible keys used by various ROM analyzers
  return (
    payload.angle ||
    metrics.angle ||
    metrics.rotation_angle ||
    metrics.max_angle_deg ||
    metrics.flexion_angle ||
    0
  );
}

function detectSummaryText(item) {
  const lang = localStorage.getItem('appLang') || 'en';
  const dict = translations[lang] || {};

  if (item.isGroup) {
    return `${item.testTypeLabel} (${lang === 'kr' ? '좌/우 통합' : 'L/R Integrated'})`;
  }
  const payload = item?.analysis_payload || {};
  if (typeof payload?.summary === "string") return payload.summary;

  const moduleName = detectModuleName(item).toLowerCase();
  if (moduleName.includes("body")) return dict.hist_summary_integrated || "Integrated Result";
  if (moduleName.includes("rom")) {
    const side = detectSide(item).toUpperCase();
    return `${dict.hist_summary_rom || 'Result'} (${side})`;
  }
  if (moduleName.includes("movement")) {
    const testType = detectTestType(item).toLowerCase();
    const label = dict[`move_${testType}`] || testType;
    return `${label} ${dict.hist_summary_move || 'Result'}`;
  }
  return dict.hist_summary_move || "Result";
}

function groupItems(items) {
  const grouped = [];
  const processed = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = detectResultId(item);
    if (processed.has(id)) continue;

    const moduleName = detectModuleName(item).toLowerCase();
    const testType = detectTestType(item);

    if (moduleName.includes("rom") && testType) {
      // Look for a neighbor
      let neighborIndex = -1;
      const time1 = new Date(detectCreatedAt(item)).getTime();

      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const other = items[j];
        const otherId = detectResultId(other);
        if (processed.has(otherId)) continue;
        if (detectModuleName(other).toLowerCase() !== moduleName) continue;
        if (detectTestType(other) !== testType) continue;

        const time2 = new Date(detectCreatedAt(other)).getTime();
        const diffMin = Math.abs(time1 - time2) / (1000 * 60);

        if (diffMin < 10) {
          neighborIndex = j;
          break;
        }
      }

      if (neighborIndex !== -1) {
        const neighbor = items[neighborIndex];
        processed.add(id);
        processed.add(detectResultId(neighbor));

        const config = ROM_CONFIG[testType] || { title: testType };
        grouped.push({
          isGroup: true,
          items: [item, neighbor],
          id: `${id}_${detectResultId(neighbor)}`,
          test_type: testType,
          module_name: "rom",
          created_at: time1 > new Date(detectCreatedAt(neighbor)).getTime() ? detectCreatedAt(item) : detectCreatedAt(neighbor),
          testTypeLabel: config.title
        });
        continue;
      }
    }

    processed.add(id);
    grouped.push(item);
  }
  return grouped;
}

function normalizeListItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.history)) return raw.history;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function normalizeDetail(raw) {
  if (!raw) return null;
  return raw?.item || raw?.result || raw?.data || raw;
}

function setSubjectText(text) {
  if (el.subjectText) el.subjectText.textContent = text || "-";
}

function renderListLoading(on) {
  if (el.loading) el.loading.style.display = on ? "inline-flex" : "none";
}

function renderDetailLoading(on) {
  if (el.detailLoading) el.detailLoading.style.display = on ? "inline-flex" : "none";
}

function renderEmptyList(message) {
  if (el.list) el.list.innerHTML = "";
  if (el.empty) {
    el.empty.style.display = "block";
    // If it's the specific message about login, we can prioritize i18n key or translate manually
    // But usually we trigger it with hist_email_prompt
    el.empty.textContent = message;
  }
}

function renderEmptyDetail(message) {
  if (el.detail) el.detail.innerHTML = "";
  if (el.detailEmpty) {
    el.detailEmpty.style.display = "flex";
    el.detailEmpty.textContent = message;
  }
}

function hideEmptyList() {
  if (el.empty) el.empty.style.display = "none";
}

function hideEmptyDetail() {
  if (el.detailEmpty) el.detailEmpty.style.display = "none";
}


function renderAnalysisTable(analysis) {
  const lang = localStorage.getItem('appLang') || 'en';
  const dict = translations[lang] || {};
  if (!analysis || typeof analysis !== "object" || !Object.keys(analysis).length) {
    return `<div class="history-section-empty">${dict.hist_no_data || 'No data'}</div>`;
  }

  return `
    <div class="analysis-table">
      ${Object.entries(analysis)
      .filter(([_, item]) => item?.value != null && String(item.value).trim() !== "")
      .map(([key, item]) => `
        <div class="analysis-row">
          <div class="analysis-key">${escapeHtml(key)}</div>
          <div class="analysis-value">${escapeHtml(item.value)}${escapeHtml(item.unit ? ` ${item.unit}` : "")}</div>
          <div class="analysis-grade">${escapeHtml(item.grade || "-")}</div>
          <div class="analysis-summary">${escapeHtml(item.summary || "-")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderBodyFrontSide(frontPayload, sidePayload, frontArtifact, sideArtifact) {
  const lang = localStorage.getItem('appLang') || 'en';
  const dict = translations[lang] || {};
  return `
    <div class="body-analysis-container">
      <div class="body-analysis-row">
        <div class="analysis-visual">
          <div class="visual-label">${dict.hist_front_view || 'Front View'}</div>
          ${frontArtifact?.overlay_public_url ? `<img src="${escapeHtml(frontArtifact.overlay_public_url)}" alt="Front Overlay">` : `<div class="visual-placeholder">${dict.hist_no_image || 'No Image'}</div>`}
        </div>
        <div class="analysis-data">
          ${renderAnalysisTable(frontPayload?.analysis || {})}
        </div>
      </div>
      <div class="body-analysis-row">
        <div class="analysis-visual">
          <div class="visual-label">${dict.hist_side_view || 'Side View'}</div>
          ${sideArtifact?.overlay_public_url ? `<img src="${escapeHtml(sideArtifact.overlay_public_url)}" alt="Side Overlay">` : `<div class="visual-placeholder">${dict.hist_no_image || 'No Image'}</div>`}
        </div>
        <div class="analysis-data">
          ${renderAnalysisTable(sidePayload?.analysis || {})}
        </div>
      </div>
    </div>
  `;
}

const ROM_CONFIG = {
  cervical_rotation: { title: "rom_cervical_rotation", normal: 80 },
  shoulder_flexion: { title: "rom_shoulder_flexion", normal: 180 },
  shoulder_abduction: { title: "rom_shoulder_abduction", normal: 180 },
  hip_flexion: { title: "rom_hip_flexion", normal: 120 },
  knee_flexion: { title: "rom_knee_flexion", normal: 140 },
  ankle_dorsiflexion: { title: "rom_ankle_dorsi", normal: 20 }
};

const MOVE_LABELS = (function () {
  const lang = localStorage.getItem('appLang') || 'en';
  const dict = translations[lang] || {};
  return {
    deep_squat: dict.move_deep_squat || "Deep Squat",
    hurdle_step: dict.move_hurdle_step || "Hurdle Step",
    single_leg_balance: dict.move_single_leg_balance || "Single Leg Balance",
    lunge: dict.move_lunge || "Lunge",
    jump: dict.move_jump || "Jump",
    arm_raise: dict.move_arm_raise || "Arm Raise"
  };
})();

function renderRomSingleSide(detail, isLeft = false) {
  if (!detail) {
    const lang = localStorage.getItem('appLang') || 'en';
    const dict = translations[lang] || {};
    return `
      <div class="rom-side-col empty">
        <div class="visual-label">${isLeft ? (dict.hc_left || "LEFT") : (dict.hc_right || "RIGHT")} VIEW</div>
        <div class="rom-canvas-wrapper empty">
          <div class="visual-placeholder">${dict.hist_no_data || "데이터 없음"}</div>
        </div>
      </div>
    `;
  }

  const testType = detectTestType(detail);
  const artifacts = detail?.artifacts || {};
  const config = ROM_CONFIG[testType] || { title: testType, normal: 90 };
  const angle = extractAngle(detail);
  const side = detectSide(detail);
  const normal = config.normal;
  const reachRate = Math.min(100, Math.round((angle / normal) * 100));
  const imageUrl = artifacts.overlay_public_url || artifacts.raw_public_url;
  const canvasId = `rom_canvas_${detail.id || Math.random().toString(36).substr(2, 9)}`;

  const lang = localStorage.getItem('appLang') || 'en';
  const dict = translations[lang] || {};

  setTimeout(() => drawFanOverlay(canvasId, imageUrl, angle, side === "left"), 50);

  return `
    <div class="rom-side-col">
      <div class="visual-label">${side.toUpperCase()} VIEW</div>
      <div class="rom-canvas-wrapper">
        <canvas id="${canvasId}"></canvas>
        ${!imageUrl ? `<div class="visual-placeholder">${dict.hist_no_image || 'No Image'}</div>` : ''}
      </div>
      <div class="rom-side-stats">
        <div class="rom-main-stat">
          <span class="stat-value">${angle.toFixed(1)}°</span>
          <span class="stat-label">${dict.hist_summary_rom || 'Result'}</span>
        </div>
        <div class="rom-progress-container">
          <div class="rom-progress-bar" style="width: ${reachRate}%"></div>
        </div>
        <div class="rom-reach-label">${dict.hist_reach || 'Reach'}: ${reachRate}%</div>
      </div>
    </div>
  `;
}

function renderRomDetail(detail, complementary = null) {
  const testType = detectTestType(detail);
  const config = ROM_CONFIG[testType] || { title: testType, normal: 90 };

  // Decide which is left and which is right
  let left = null, right = null;
  const d1Side = detectSide(detail);
  const d2Side = complementary ? detectSide(complementary) : null;

  if (complementary) {
    if (d1Side === "left" && d2Side === "right") {
      left = detail; right = complementary;
    } else if (d1Side === "right" && d2Side === "left") {
      right = detail; left = complementary;
    } else {
      // Inconsistent metadata: force assignment so both show up
      if (d1Side === "left") {
        left = detail; right = complementary;
      } else {
        right = detail; left = complementary;
      }
    }
  } else {
    if (d1Side === "left") left = detail; else right = detail;
  }

  const lang = localStorage.getItem('appLang') || 'en';
  const dict = translations[lang] || {};

  const leftVal = left ? extractAngle(left) : 0;
  const rightVal = right ? extractAngle(right) : 0;
  const imbalance = (left && right) ? Math.abs(leftVal - rightVal) : 0;

  return `
    <div class="rom-multi-detail">
      <div class="rom-header-group">
        <div class="rom-info-title">${dict[config.title] || config.title}</div>
        <div class="rom-normal-ref">${lang === 'kr' ? '정상 범위' : 'Normal Range'}: ${config.normal}°</div>
      </div>

      <div class="rom-visual-row">
        ${renderRomSingleSide(left, true)}
        ${renderRomSingleSide(right, false)}
      </div>

      ${imbalance > 10 ? `
        <div class="rom-imbalance-alert">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${dict.hist_imbalance_warn || 'Imbalance Warning'}: ${imbalance.toFixed(1)}°</span>
        </div>
      ` : ""}
    </div>
  `;
}

function drawFanOverlay(canvasId, imageUrl, angle, isLeft) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !imageUrl) return;
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

function renderMovementDetail(detail) {
  const resultPayload = detail?.result_payload || {};
  const analysisPayload = detail?.analysis_payload || {};
  const artifacts = detail?.artifacts || {};
  const testType = detectTestType(detail).toLowerCase();

  // Try to find matching config from performancereport.js style
  const config = {
    title: testType === "deep_squat" ? "딥 스쿼트" : testType,
    badge: "운동"
  };

  const imageUrl = artifacts?.raw_public_url || artifacts?.overlay_public_url;
  const poseData = analysisPayload.result?.pose || analysisPayload.pose || null;
  const metrics = resultPayload.metrics || {};

  const count = metrics.count || resultPayload.count || 0;
  const dateStr = new Date(detectCreatedAt(detail)).toLocaleString();

  let detailHtml = "";

  if (testType === "deep_squat") {
    const maxDepth = metrics.max_depth || metrics.knee_angle || 0;
    const balLeft = metrics.avg_balance_left || metrics.balance_left || 50;
    const balRight = 100 - balLeft;

    const lang = localStorage.getItem('appLang') || 'en';
    const t = window.translations?.[lang] || {};

    const depthState = maxDepth < 110 ? "Excellent" : (maxDepth < 140 ? "Good" : "Normal");
    const repState = count >= 15 ? "Excellent" : (count >= 10 ? "Good" : "Normal");
    const balDiff = Math.abs(balLeft - balRight);
    const balState = balDiff < 5 ? "Excellent" : (balDiff < 10 ? "Good" : "Normal");

    detailHtml = `
          <div class="perf-data-card" style="margin-top:20px; background: rgba(0,0,0,0.2); border-radius:16px; padding:20px; display:flex; flex-direction:column; gap:16px;">
              <div style="font-size: 14px; font-weight: 700; color: white; margin-bottom: 4px;">${t.hist_analysis_result || "측정 결과 요약"}</div>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr style="border-bottom: 1px solid rgba(255,255,255,1); opacity: 0.1;">
                      <th style="padding: 8px 0; text-align: left; color: #94a3b8;">${t.hc_meta_joint || "항목"}</th>
                      <th style="padding: 8px 0; text-align: left; color: #94a3b8;">${t.hc_step_result || "결과"}</th>
                      <th style="padding: 8px 12px; text-align: right; color: #94a3b8;">${t.hc_meta_status || "상태"}</th>
                  </tr>
                  <tr>
                      <td style="padding: 10px 0; color: #e2e8f0;">${t.hc_meta_joint || "최대 깊이"}</td>
                      <td style="padding: 10px 0; color: white; font-weight: 700;">${Math.round(maxDepth)}도</td>
                      <td style="padding: 10px 12px; text-align: right;"><span class="tag-pill" style="background:${getStateColor(depthState)}">${depthState}</span></td>
                  </tr>
                  <tr>
                      <td style="padding: 10px 0; color: #e2e8f0;">${t.hc_step_result || "반복 횟수"}</td>
                      <td style="padding: 10px 0; color: white; font-weight: 700;">${count}회</td>
                      <td style="padding: 10px 12px; text-align: right;"><span class="tag-pill" style="background:${getStateColor(repState)}">${repState}</span></td>
                  </tr>
                  <tr>
                      <td style="padding: 10px 0; color: #e2e8f0;">${t.hc_meta_balance || "좌우 밸런스"}</td>
                      <td style="padding: 10px 0; color: white; font-weight: 700;">L ${Math.round(balLeft)}% / R ${Math.round(balRight)}%</td>
                      <td style="padding: 10px 12px; text-align: right;"><span class="tag-pill" style="background:${getStateColor(balState)}">${balState}</span></td>
                  </tr>
              </table>
          </div>
      `;
  } else {
    detailHtml = renderAnalysisTable(resultPayload);
  }

  const canvasId = `canvas_move_${detectResultId(detail)}`;

  // Set immediate timer to draw canvas after HTML is injected
  setTimeout(() => drawMovePoseOverlay(canvasId, imageUrl, poseData), 50);

  return `
    <div class="movement-detail-container">
      <div class="perf-visual-area" style="display:flex; flex-direction:column; align-items:center; gap:12px;">
         <div class="perf-canvas-container" style="width:100%; max-width:400px; aspect-ratio:4/3; background:#000; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.1);">
            <canvas id="${canvasId}" style="width:100%; height:100%; display:block;"></canvas>
         </div>
      </div>
      ${detailHtml}
    </div>
  `;
}

function getStateColor(state) {
  if (state === "Excellent") return "rgba(0, 255, 120, 0.2); color: #00ff78;";
  if (state === "Good") return "rgba(255, 184, 0, 0.2); color: #ffb800;";
  return "rgba(148, 163, 184, 0.2); color: #cbd5e1;";
}

function drawMovePoseOverlay(canvasId, imageUrl, poseData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !imageUrl) return;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageUrl;
  img.onload = () => {
    canvas.width = 400;
    canvas.height = 300;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (poseData && poseData.landmarks) {
      const sx = canvas.width / (poseData.frame?.width || 640);
      const sy = canvas.height / (poseData.frame?.height || 480);
      const landmarks = poseData.landmarks;
      const connections = poseData.connections || [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

      const byIndex = {};
      landmarks.forEach(lm => byIndex[lm.index] = lm);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0, 255, 120, 0.8)";
      connections.forEach(([a, b]) => {
        const p1 = byIndex[a];
        const p2 = byIndex[b];
        if (p1 && p2 && (p1.visibility || 1) > 0.5 && (p2.visibility || 1) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(p1.x * sx, p1.y * sy);
          ctx.lineTo(p2.x * sx, p2.y * sy);
          ctx.stroke();
        }
      });

      landmarks.forEach(lm => {
        if ((lm.visibility || 1) > 0.5) {
          ctx.beginPath();
          ctx.fillStyle = "#ff5050";
          ctx.arc(lm.x * sx, lm.y * sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  };
}

function renderList(items) {
  if (!el.list) return;

  if (!items.length) {
    const lang = localStorage.getItem('appLang') || 'en';
    const dict = translations[lang] || {};
    renderEmptyList(dict.hist_no_data || "조회된 이력이 없습니다.");
    return;
  }

  hideEmptyList();

  el.list.innerHTML = items.map((item) => {
    const resultId = item.isGroup ? item.id : detectResultId(item);
    const active = state.selectedItem && (state.selectedItem.id === resultId || detectResultId(state.selectedItem) === resultId) ? "active" : "";
    return `
      <div class="history-item-container">
        <button class="history-item ${active}" data-id="${escapeHtml(resultId)}">
          <div class="history-item-top">
            <div class="history-item-module">${escapeHtml(moduleLabel(detectModuleName(item), detectTestType(item)))}</div>
            <div class="history-item-date">${escapeHtml(formatDateTime(detectCreatedAt(item)))}</div>
          </div>
          <div class="history-item-summary">${escapeHtml(detectSummaryText(item))}</div>
        </button>
        <button class="history-item-delete" data-id="${escapeHtml(resultId)}" title="삭제">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join("");

  el.list.querySelectorAll(".history-item").forEach((node) => {
    node.addEventListener("click", async () => {
      const id = node.dataset.id;
      const item = items.find((x) => (x.isGroup ? x.id : detectResultId(x)) === id);
      state.selectedItem = item || null;
      renderList(items);

      if (item.isGroup) {
        // Load first item as primary, the other as complementary
        await loadHistoryDetail(detectResultId(item.items[0]));
      } else {
        await loadHistoryDetail(detectResultId(item));
      }
    });
  });

  el.list.querySelectorAll(".history-item-delete").forEach((node) => {
    node.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = node.dataset.id;
      const item = items.find((x) => (x.isGroup ? x.id : detectResultId(x)) === id);

      const lang = localStorage.getItem('appLang') || 'en';
      const dict = translations[lang] || {};
      const confirmMsg = item.isGroup ?
        (dict.hist_delete_group_confirm || "Delete group?") :
        (dict.hist_delete_confirm || "Delete item?");

      if (confirm(confirmMsg)) {
        if (item.isGroup) {
          for (const subItem of item.items) {
            await deleteHistoryItem(detectResultId(subItem), false);
          }
          await loadHistoryList(state.subjectNo);
        } else {
          await deleteHistoryItem(detectResultId(item));
        }
      }
    });
  });
}

function renderDetail(detail, complementary = null) {
  if (!el.detail) return;
  if (!detail) {
    const lang = localStorage.getItem('appLang') || 'en';
    const dict = translations[lang] || {};
    renderEmptyDetail(dict.hist_detail_fail || "상세 데이터를 불러오지 못했습니다.");
    return;
  }

  hideEmptyDetail();

  const createdAt = detectCreatedAt(detail);
  const moduleName = detectModuleName(detail).toLowerCase();
  const testType = detectTestType(detail).toLowerCase();
  const resultPayload = detail?.result_payload || {};
  const analysisPayload = detail?.analysis_payload || {};
  const artifacts = detail?.artifacts || {};

  const isBody = moduleName.includes("body") || testType.includes("body");
  const isRom = moduleName.includes("rom") || testType.includes("rom");

  const bodyFront = analysisPayload?.front || null;
  const bodySide = analysisPayload?.side || null;

  const lang = localStorage.getItem('appLang') || 'en';
  const dict = translations[lang] || {};

  el.detail.innerHTML = `
    <div class="history-detail-card">

      <div class="history-section">
        <div class="history-section-title">${dict.hist_basic_info || 'Basic Info'}</div>
        <div class="history-kv">
          <div><span>module</span><strong>${escapeHtml(moduleName || "-")}</strong></div>
          <div><span>test_type</span><strong>${escapeHtml(testType || "-")}</strong></div>
          <div><span>subject_no</span><strong>${escapeHtml(detail?.subject_no || state.subjectNo || "-")}</strong></div>
          <div><span>created_at</span><strong>${escapeHtml(formatDateTime(createdAt))}</strong></div>
        </div>
      </div>

      ${isBody && bodyFront && bodySide
      ? `
            <div class="history-section">
              <div class="history-section-title">${dict.hist_integrated_body || 'Body Result'}</div>
              ${renderBodyFrontSide(bodyFront, bodySide, artifacts?.front, artifacts?.side)}
            </div>
          `
      : isRom
        ? `
            <div class="history-section">
              <div class="history-section-title">${dict.hist_rom_comparison || 'ROM Analysis'}</div>
              ${renderRomDetail(detail, complementary)}
            </div>
          `
        : moduleName.includes("movement")
          ? `
            <div class="history-section">
              <div class="history-section-title">${dict.hist_movement_report || 'Movement Report'}</div>
              ${renderMovementDetail(detail)}
            </div>
          `
          : `
            <div class="history-section">
              <div class="history-section-title">${dict.hist_analysis_result || 'Result'}</div>
              ${renderAnalysisTable(resultPayload)}
            </div>
          `
    }

    </div>
  `;
}

async function loadHistoryList(subjectNo) {
  if (!subjectNo) {
    renderEmptyList("로그인 이메일이 없습니다. 처음 화면에서 다시 로그인해 주세요.");
    return;
  }

  renderListLoading(true);
  renderEmptyDetail("이력 항목을 선택해 주세요.");

  try {
    setSubjectText(subjectNo);
    const data = await Api.historyList(subjectNo);
    const rawItems = normalizeListItems(data).sort((a, b) => {
      const ta = new Date(detectCreatedAt(a)).getTime() || 0;
      const tb = new Date(detectCreatedAt(b)).getTime() || 0;
      return tb - ta;
    });

    const items = groupItems(rawItems);

    state.subjectNo = subjectNo;
    state.items = items;
    state.selectedItem = null;
    state.selectedDetail = null;
    state.complementaryDetail = null;

    renderList(items);

    if (items.length) {
      state.selectedItem = items[0];
      renderList(items);
      const firstId = items[0].isGroup ? detectResultId(items[0].items[0]) : detectResultId(items[0]);
      await loadHistoryDetail(firstId);
    } else {
      renderEmptyDetail("조회된 상세 이력이 없습니다.");
    }
  } catch (err) {
    const lang = localStorage.getItem('appLang') || 'en';
    const dict = translations[lang] || {};
    renderEmptyList(`${dict.hist_fetch_fail || 'Error'}: ${err.message}`);
    renderEmptyDetail(dict.hist_detail_fail || "상세 데이터를 불러오지 못했습니다.");
  } finally {
    renderListLoading(false);
  }
}

async function loadHistoryDetail(resultId) {
  if (!resultId) {
    renderEmptyDetail("result_id가 없습니다.");
    return;
  }

  renderDetailLoading(true);

  try {
    const data = await Api.historyDetail(resultId);
    const detail = normalizeDetail(data);
    state.selectedDetail = detail;
    state.complementaryDetail = null;

    // Check if it's ROM and find complementary side
    const moduleName = detectModuleName(detail).toLowerCase();
    if (moduleName.includes("rom")) {
      const testType = detectTestType(detail);
      const currentSide = detectSide(detail);
      const otherSide = currentSide === "left" ? "right" : "left";

      let compResultId = null;

      // 1. If currently selected item is a group and contains our resultId, 
      // the other half is already in the group.
      if (state.selectedItem?.isGroup) {
        const otherHalf = state.selectedItem.items.find(it => detectResultId(it) !== resultId);
        if (otherHalf) compResultId = detectResultId(otherHalf);
      }

      // 2. Fallback: search state.items (considering nested items in groups)
      if (!compResultId) {
        for (const it of state.items) {
          if (it.isGroup) {
            const match = it.items.find(sub =>
              detectTestType(sub) === testType &&
              detectSide(sub) === otherSide &&
              detectResultId(sub) !== resultId
            );
            if (match) {
              compResultId = detectResultId(match);
              break;
            }
          } else if (
            (it.module_name || "").toLowerCase() === "rom" &&
            it.test_type === testType &&
            detectSide(it) === otherSide &&
            detectResultId(it) !== resultId
          ) {
            compResultId = detectResultId(it);
            break;
          }
        }
      }

      if (compResultId) {
        try {
          const compData = await Api.historyDetail(compResultId);
          state.complementaryDetail = normalizeDetail(compData);
        } catch (e) {
          console.warn("Failed to load complementary side detail", e);
        }
      }
    }

    renderDetail(detail, state.complementaryDetail);
  } catch (err) {
    renderEmptyDetail(`상세 조회 실패: ${err.message}`);
  } finally {
    renderDetailLoading(false);
  }
}

async function deleteHistoryItem(resultId, refresh = true) {
  try {
    await Api.historyDelete(resultId);

    // If deleted item was the selected one (or part of it), clear detail
    if (state.selectedItem) {
      const isMatch = state.selectedItem.isGroup
        ? state.selectedItem.items.some(it => detectResultId(it) === resultId)
        : detectResultId(state.selectedItem) === resultId;

      if (isMatch) {
        state.selectedItem = null;
        state.selectedDetail = null;
        state.complementaryDetail = null;
        renderEmptyDetail("항목이 삭제되었습니다.");
      }
    }

    // Refresh the list if requested
    if (refresh) {
      await loadHistoryList(state.subjectNo);
    }
  } catch (err) {
    alert(`삭제 실패: ${err.message}`);
  }
}

function bindEvents() {
  el.refreshBtn?.addEventListener("click", async () => {
    const email = getStoredEmail();
    await loadHistoryList(email);
  });
}

async function init() {
  bindEvents();
  const email = getStoredEmail();
  state.subjectNo = email;
  setSubjectText(email || "로그인 필요");

  if (!email) {
    renderEmptyList("로그인 이메일이 없습니다. 처음 화면에서 다시 로그인해 주세요.");
    renderEmptyDetail("이력 항목을 선택해 주세요.");
    return;
  }

  await loadHistoryList(email);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}