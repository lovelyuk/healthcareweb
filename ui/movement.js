
function getCurrentSubjectNo() {
  return window.BodyCheckUser ? window.BodyCheckUser.getCurrentUserEmail() : (localStorage.getItem("bodycheck_user_email") || "").trim();
}

function syncSidebarLinks() {
  if (window.BodyCheckUser) {
    window.BodyCheckUser.syncNavLinks();
  }
}

// LOCAL_SERVER_DEPENDENCY: API_BASE 하드코딩 → 환경별 동적 설정으로 교체 필요
const API_BASE = "http://127.0.0.1:5000";  // LOCAL_SERVER_DEPENDENCY

/**
 * Helper to fetch localized strings from global translations
 */
function t(key) {
  const lang = localStorage.getItem('appLang') || 'kr';
  const pack = window.translations?.[lang] || {};
  return pack[key] || key;
}

const MOVEMENT_ITEMS = [
  {
    id: "deep_squat",
    name: "move_deep_squat",
    badge: "hc_tab_move",
    type: "move_deep_squat_type",
    focus: "move_focus_squat",
    posture: "posture_front_stand",
    summary: "move_deep_squat_sum",
    guideTitle: "move_deep_squat_guide_t",
    guideDesc: "move_deep_squat_guide_d",
    actionText: "move_deep_squat_action",
    icon: "squat.png",
    instructions: ["move_inst_squat_1", "move_inst_squat_2", "move_inst_squat_3", "move_inst_squat_4"]
  },
  {
    id: "hurdle_step",
    name: "move_hurdle_step",
    badge: "badge_balance",
    type: "move_hurdle_step_type",
    focus: "move_focus_step",
    posture: "posture_one_leg",
    summary: "move_hurdle_step_sum",
    guideTitle: "move_hurdle_step_guide_t",
    guideDesc: "move_hurdle_step_guide_d",
    actionText: "move_hurdle_step_action",
    icon: "step.png",
    instructions: ["move_inst_hurdle_1", "move_inst_hurdle_2", "move_inst_hurdle_3", "move_inst_hurdle_4"]
  },
  {
    id: "single_leg_balance",
    name: "move_single_leg_balance",
    badge: "badge_balance",
    type: "move_single_leg_type",
    focus: "move_focus_static",
    posture: "posture_slb",
    summary: "move_single_leg_balance_sum",
    guideTitle: "move_single_leg_balance_guide_t",
    guideDesc: "move_single_leg_balance_guide_d",
    actionText: "move_single_leg_balance_action",
    icon: "singleleg.png",
    instructions: ["move_inst_slb_1", "move_inst_slb_2", "move_inst_slb_3", "move_inst_slb_4"]
  },
  {
    id: "lunge",
    name: "move_lunge",
    badge: "badge_functional",
    type: "move_lunge_type",
    focus: "move_focus_lunge",
    posture: "posture_lunge",
    summary: "move_lunge_sum",
    guideTitle: "move_lunge_guide_t",
    guideDesc: "move_lunge_guide_d",
    actionText: "move_lunge_action",
    icon: "lunge.png",
    instructions: ["move_inst_lunge_1", "move_inst_lunge_2", "move_inst_lunge_3", "move_inst_lunge_4"]
  },
  {
    id: "jump",
    name: "move_jump",
    badge: "badge_power",
    type: "move_jump_type",
    focus: "move_focus_jump",
    posture: "posture_front_stand",
    summary: "move_jump_sum",
    guideTitle: "move_jump_guide_t",
    guideDesc: "move_jump_guide_d",
    actionText: "move_jump_action",
    icon: "jump.png",
    instructions: ["move_inst_jump_1", "move_inst_jump_2", "move_inst_jump_3", "move_inst_jump_4"]
  },
  {
    id: "arm_raise",
    name: "move_arm_raise",
    badge: "badge_upper",
    type: "move_arm_raise_type",
    focus: "move_focus_overhead",
    posture: "posture_front_stand",
    summary: "move_arm_raise_sum",
    guideTitle: "move_arm_raise_guide_t",
    guideDesc: "move_arm_raise_guide_d",
    actionText: "move_arm_raise_action",
    icon: "armraise.png",
    instructions: ["move_inst_arm_1", "move_inst_arm_2", "move_inst_arm_3", "move_inst_arm_4"]
  }
];

const MOVEMENT_CONFIG = {
  deep_squat: {
    title: "move_deep_squat",
    guideMessage: "move_deep_squat_guide_d",
    guideImage: "/ui/images/guides/deep_squat.png",
    overlayType: "FRONT_BODY",
    targetMetric: "knee_angle",
    targetLandmarks: [23, 24, 25, 26, 27, 28],
    threshold: 120, // Bottom triggered when angle < 120
    isTimed: true,
    duration: 30
  },
  hurdle_step: {
    title: "move_hurdle_step",
    guideMessage: "move_hurdle_step_guide_d",
    guideImage: "/ui/images/guides/hurdle_step.png",
    overlayType: "FRONT_BODY",
    targetMetric: "step_height",
    targetLandmarks: [23, 25, 27],
    threshold: 15,
    normalRange: { min: 0, max: 50 }
  },
  single_leg_balance: {
    title: "move_single_leg_balance",
    guideMessage: "move_single_leg_balance_guide_d",
    guideImage: "/ui/images/guides/single_leg_balance.png",
    overlayType: "FRONT_BODY",
    targetMetric: "sway_velocity",
    targetLandmarks: [0, 11, 12, 23, 24],
    threshold: 10,
    normalRange: { min: 0, max: 5 }
  },
  lunge: {
    title: "move_lunge",
    guideMessage: "move_lunge_guide_d",
    guideImage: "/ui/images/guides/lunge.png",
    overlayType: "SIDE_BODY",
    targetMetric: "lunge_depth",
    targetLandmarks: [23, 25, 27],
    threshold: 15,
    normalRange: { min: 0, max: 100 }
  },
  jump: {
    title: "move_jump",
    guideMessage: "move_jump_guide_d",
    guideImage: "/ui/images/guides/jump.png",
    overlayType: "FRONT_BODY",
    targetMetric: "jump_height",
    targetLandmarks: [23, 24],
    threshold: 10,
    normalRange: { min: 0, max: 60 }
  },
  arm_raise: {
    title: "move_arm_raise",
    guideMessage: "move_arm_raise_guide_d",
    guideImage: "/ui/images/guides/arm_raise.png",
    overlayType: "FRONT_BODY",
    targetMetric: "raise_angle",
    targetLandmarks: [11, 13, 15],
    threshold: 10,
    normalRange: { min: 0, max: 180 }
  }
};

const movementState = {
  agentOn: false,
  selectedItem: null,
  poseTimer: null,
  movementTimer: null,
  poseBusy: false,
  movementBusy: false,
  livePose: null,
  liveResult: null,
  isMeasuring: false,
  measureAbort: null,
  peakHold: {
    maxValue: 0,
    startTime: null,
    isTriggered: false
  },
  // New state for Deep Squat
  repCount: 0,
  timeLeft: 0,
  countdownLeft: 0,
  isCountingDown: false,
  measureTimer: null,
  countdownTimer: null,
  squatPrevState: "standing",
  hasReachedBottom: false,
  snapshotCaptured: false,
  sessionMetrics: {
    maxDepth: 180, // Initialize to standing angle
    balances: [],
    tilts: []
  },
  // Interactive Guideline States
  isInReadyZone: false,
  readyStartTime: 0,
  depthThresholdY: 0,
  standingHipsY: 0,
  lastPoseTime: 0,
  isWaitingForPosition: false
};

const moveEls = {
  analysisList: document.getElementById("analysisList"),
  selectedName: document.getElementById("selectedName"),
  selectedSummary: document.getElementById("selectedSummary"),
  metaType: document.getElementById("metaType"),
  metaFocus: document.getElementById("metaFocus"),
  metaPosture: document.getElementById("metaPosture"),
  instructionList: document.getElementById("instructionList"),
  qualityBox: document.getElementById("qualityBox"),
  guideTitle: document.getElementById("guideTitle"),
  guideDesc: document.getElementById("guideDesc"),
  actionMessageText: document.getElementById("actionMessageText"),
  currentStepText: document.getElementById("currentStepText"),
  overallProgress: document.getElementById("overallProgress"),
  btnAgent: document.getElementById("btnAgent"),
  btnAgentText: document.getElementById("btnAgentText"),
  btnMeasureStart: document.getElementById("btnMeasureStart"),
  trackingIcon: document.getElementById("trackingIcon"),
  trackingText: document.getElementById("trackingText"),
  overlayCanvas: document.getElementById("overlayCanvas"),
  photo: document.getElementById("photo"),
  feedWindow: document.getElementById("feedWindow"),
  guideOverlay: document.getElementById("guideOverlay"),
  guideImg: document.getElementById("guideImg"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  btnMeasureText: document.getElementById("btnMeasureText")
};

function renderMovementList() {
  moveEls.analysisList.innerHTML = MOVEMENT_ITEMS.map((item) => {
    const name = t(item.name);
    const summary = t(item.summary);
    const badge = t(item.badge);
    const focus = t(item.focus);
    const posture = t(item.posture);

    return `
    <div class="analysis-item ${movementState.selectedItem?.id === item.id ? "active" : ""}" data-id="${item.id}">
      <div class="analysis-item-content">
        <div class="analysis-top">
          <div class="analysis-name">${name}</div>
        </div>
        <div class="analysis-meta">
          <div><strong data-i18n="hc_meta_type">${t("hc_meta_type")}</strong><br>${t(item.type)}</div>
          <div><strong data-i18n="hc_meta_focus">${t("hc_meta_focus")}</strong><br>${focus}</div>
          <div><strong data-i18n="hc_meta_pose">${t("hc_meta_pose")}</strong><br>${posture}</div>
        </div>
        <div class="analysis-summary">${summary}</div>
      </div>
      <div class="analysis-item-visual">
         <div class="analysis-badge">${badge}</div>
         <img src="/ui/images/${item.icon}" class="measurement-icon-img" alt="${name}">
      </div>
    </div>
  `}).join("");

  moveEls.analysisList.querySelectorAll(".analysis-item").forEach((node) => {
    node.addEventListener("click", () => {
      const item = MOVEMENT_ITEMS.find(v => v.id === node.dataset.id);
      if (!item) return;
      movementState.selectedItem = item;
      movementState.isInReadyZone = false;
      movementState.readyStartTime = 0;
      syncMovementUi();
      syncMovementButtons();
      if (movementState.agentOn) {
        fetchMovementLive();
      }
    });
  });
}

function syncMovementButtons() {
  const enabled = movementState.agentOn && !!movementState.selectedItem;
  if (moveEls.btnMeasureStart) {
    moveEls.btnMeasureStart.disabled = !enabled;

    if (movementState.isMeasuring) {
      moveEls.btnMeasureStart.classList.add("danger");
      moveEls.btnMeasureText.textContent = t("hc_measure_stop");
      const icon = moveEls.btnMeasureStart.querySelector("i");
      if (icon) icon.className = "fa-solid fa-stop";
    } else {
      moveEls.btnMeasureStart.classList.remove("danger");
      moveEls.btnMeasureText.textContent = t("hc_measure_start");
      const icon = moveEls.btnMeasureStart.querySelector("i");
      if (icon) icon.className = "fa-solid fa-play";
    }
  }
}

function syncMovementTrackingPill() {
  if (movementState.agentOn) {
    moveEls.trackingIcon.className = "fa-solid fa-user-check";
    moveEls.trackingText.textContent = t("hc_track_ok");
  } else {
    moveEls.trackingIcon.className = "fa-solid fa-user-slash";
    moveEls.trackingText.textContent = t("hc_track_off");
  }
}

function syncMovementUi() {
  renderMovementList();
  syncMovementTrackingPill();
  syncMovementButtons();

  // Agent Button
  if (moveEls.btnAgentText) {
    moveEls.btnAgentText.textContent = movementState.agentOn ? t("hc_agent_stop") : t("hc_agent_start");
  }

  const item = movementState.selectedItem;

  if (!item) {
    moveEls.selectedName.textContent = t("hc_none_selected");
    moveEls.selectedSummary.textContent = t("hc_selected_desc_move");
    moveEls.metaType.textContent = "-";
    moveEls.metaFocus.textContent = "-";
    moveEls.metaPosture.textContent = "-";
    moveEls.guideTitle.textContent = t("hc_guide_move_title");
    moveEls.guideDesc.textContent = t("hc_guide_move_desc");
    moveEls.instructionList.innerHTML = `
      <li>${t("hc_action_select")}</li>
    `;
    if (moveEls.qualityBox) moveEls.qualityBox.textContent = t("rom_status_awaiting");
    moveEls.currentStepText.textContent = movementState.agentOn ? t("hc_select_move") : t("hc_guide_agent_title");
    moveEls.actionMessageText.textContent = movementState.agentOn ? t("hc_action_select") : t("hc_turn_on_agent");
    moveEls.overallProgress.style.width = movementState.agentOn ? "10%" : "0%";
    return;
  }

  moveEls.selectedName.textContent = t(item.name);
  moveEls.selectedSummary.textContent = t(item.summary);
  moveEls.metaType.textContent = t(item.type);
  moveEls.metaFocus.textContent = t(item.focus);
  moveEls.metaPosture.textContent = t(item.posture);
  moveEls.guideTitle.textContent = t(item.guideTitle);
  moveEls.guideDesc.textContent = t(item.guideDesc);
  moveEls.instructionList.innerHTML = item.instructions.map(key => `<li>${t(key)}</li>`).join("");

  if (moveEls.qualityBox) {
    if (movementState.liveResult?.result) {
      const r = movementState.liveResult.result;
      const metricsText = Object.entries(r.metrics || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(" / ");
      moveEls.qualityBox.textContent = [
        `Status: ${r.status || "-"}`,
        r.summary || "",
        metricsText,
        `Depth: ${r.depth_used ? "ON" : "OFF"}`
      ].filter(Boolean).join(" | ");
    } else {
      moveEls.qualityBox.textContent = movementState.agentOn ? t("hc_sys_ready") : t("rom_status_agent_needed");
    }
  }

  if (movementState.isCountingDown) {
    moveEls.currentStepText.textContent = t("hc_measure_start");
    moveEls.currentStepText.style.color = "#ffb800";
    moveEls.actionMessageText.textContent = t("hc_step_wait") + ` ${movementState.countdownLeft}...`;

    if (moveEls.countdownOverlay) {
      moveEls.countdownOverlay.textContent = movementState.countdownLeft;
      moveEls.countdownOverlay.style.display = "block";
    }
    return;
  } else {
    if (moveEls.countdownOverlay) moveEls.countdownOverlay.style.display = "none";
  }

  // Gated start logic for Deep Squat
  const isPoseFresh = (Date.now() - movementState.lastPoseTime) < 1000;
  if (movementState.isWaitingForPosition && item.id === "deep_squat") {
    if (movementState.isInReadyZone && isPoseFresh) {
      // Both button clicked AND user in position -> Start 3s Countdown
      movementState.isWaitingForPosition = false;
      startCountdownSequence(item, MOVEMENT_CONFIG[item.id]);
    }

    moveEls.currentStepText.textContent = t("hc_unknown_view");
    moveEls.currentStepText.style.color = "#ffb800";
    moveEls.actionMessageText.textContent = t("move_msg_pos_guide");
    moveEls.actionMessageText.style.color = "#ffb800";
    return;
  }

  if (movementState.isMeasuring) {
    const config = MOVEMENT_CONFIG[item.id];
    if (config?.isTimed) {
      moveEls.currentStepText.textContent = `${t(item.name)} ${t("hc_track_ok")} | ${t("hc_step_wait")}: ${movementState.timeLeft}`;
      moveEls.actionMessageText.textContent = `${t(item.name)} ${t("hc_step_result")}: ${movementState.repCount}`;
    } else {
      moveEls.currentStepText.textContent = `${t(item.name)} ${t("hc_track_ok")}`;
      moveEls.actionMessageText.textContent = t(item.actionText);
    }

    checkMovementAutoCapture();
    syncMovementButtons();
    return;
  }

  const config = MOVEMENT_CONFIG[item.id];
  moveEls.currentStepText.textContent = movementState.agentOn ? `${t(item.name)} ${t("hc_sys_ready")}` : `${t(item.name)} ${t("rom_status_item_sel")}`;

  if (movementState.agentOn) {
    if (item.id === "deep_squat") {
      moveEls.actionMessageText.textContent = t("rom_msg_ready_short");
    } else {
      moveEls.actionMessageText.textContent = t(item.guideDesc) || t(item.actionText);
    }
  } else {
    moveEls.actionMessageText.textContent = t("rom_msg_item_sel");
  }

  if (config?.guideImage) {
    moveEls.guideImg.src = config.guideImage;
    moveEls.guideImg.style.display = "block";
  } else {
    moveEls.guideImg.style.display = "none";
  }

  moveEls.overallProgress.style.width = movementState.agentOn ? "35%" : "18%";
}

function checkMovementAutoCapture() {
  if (!movementState.isMeasuring) return;

  const item = movementState.selectedItem;
  if (!item) return;

  const config = MOVEMENT_CONFIG[item.id];
  const result = movementState.liveResult?.result;
  if (!result || !config) return;

  // Real-time feedback and rep counting for timed tests like Deep Squat
  if (config.isTimed) {
    handleTimedtestLogic(item, config, result);
    return;
  }

  if (movementState.peakHold.isTriggered) return;
  const metricKey = config.targetMetric;
  const currentVal = result.metrics[metricKey] || result.metrics['value'] || result.metrics['score'] || 0;

  if (currentVal > movementState.peakHold.maxValue) {
    movementState.peakHold.maxValue = currentVal;
    movementState.peakHold.startTime = Date.now();
  } else if (currentVal >= movementState.peakHold.maxValue * 0.95 && currentVal > 5) {
    const holdTime = Date.now() - movementState.peakHold.startTime;
    if (holdTime >= 3000) {
      console.log("Movement auto-capture triggered!");
      movementState.peakHold.isTriggered = true;
      finalizeMovementAutoCapture();
    }
  }
}

function handleTimedtestLogic(item, config, result) {
  const metrics = result.metrics || {};

  if (item.id === "deep_squat") {
    const poseData = movementState.livePose?.pose;
    if (!poseData) return;

    const byIndex = new Map();
    (poseData.landmarks || []).forEach(lm => byIndex.set(Number(lm.index), lm));

    const angle = metrics.knee_angle || 0;
    const hipL = byIndex.get(23);
    const hipR = byIndex.get(24);
    const hips = (hipL && hipR) ? (hipL.y + hipR.y) / 2 : (hipL?.y || hipR?.y);

    // Rep counting: Only if measurement has actually started (not during 3s countdown)
    if (hips && movementState.depthThresholdY > 0 && !movementState.isCountingDown) {
      if (hips > movementState.depthThresholdY) {
        if (!movementState.hasReachedBottom) {
          movementState.hasReachedBottom = true;
          moveEls.actionMessageText.textContent = t("move_msg_target_reach");
          moveEls.currentStepText.style.color = "#00c7fd";
          console.log("Threshold depth reached.");
        }

        // Trigger snapshot capture for the report photo
        if (!movementState.snapshotCaptured) {
          const email = getCurrentSubjectNo();
          if (email) {
            // LOCAL_SERVER_DEPENDENCY: /api/movement/snapshot 엔드포인트 호출
            fetch(`${API_BASE}/api/movement/snapshot?subject_no=${encodeURIComponent(email)}`, { method: "POST" })
              .then(() => {
                movementState.snapshotCaptured = true;
                console.log("Sitting pose snapshot captured.");
              })
              .catch(err => console.error("Snapshot capture failed", err));
          }
        }
      } else if (hips < movementState.standingHipsY + 10) { // Buffer for "standing"
        if (movementState.hasReachedBottom) {
          movementState.repCount++;
          movementState.hasReachedBottom = false; // Reset
          moveEls.actionMessageText.textContent = t("move_msg_perfect");
          if (window.AudioManager && movementState.repCount <= 15) {
            window.AudioManager.playVoice(`mv_count_${movementState.repCount}`);
          }
          moveEls.currentStepText.style.color = "white";
          console.log(`Threshold Rep Count: ${movementState.repCount}`);
        }
      }
    }

    // Feedback based on metrics
    const balanceLeft = metrics.balance_left || 50;
    const balanceRight = metrics.balance_right || 50;
    if (Math.abs(balanceLeft - balanceRight) > 10) {
      if (moveEls.actionMessageText.textContent !== t("move_msg_unbalance")) {
        if (window.AudioManager) window.AudioManager.playVoice('mv_unbalance');
      }
      moveEls.actionMessageText.textContent = t("move_msg_unbalance");
      moveEls.actionMessageText.style.color = "#ffb800";
    } else {
      if (moveEls.actionMessageText.textContent === t("move_msg_unbalance")) {
         if (window.AudioManager) window.AudioManager.playVoice('mv_good_balance');
      }
      moveEls.actionMessageText.style.color = "#e2e8f0";
    }

    if (movementState.timeLeft < 5 && movementState.timeLeft > 0) {
      moveEls.actionMessageText.textContent = t("move_msg_last_one");
    }

    // Collect metrics for aggregate
    if (angle > 0) {
      // "Depth" is the minimum angle reached (deepest point)
      movementState.sessionMetrics.maxDepth = Math.min(movementState.sessionMetrics.maxDepth, angle);
      movementState.sessionMetrics.balances.push(balanceLeft);
    }
  }
}

async function finalizeMovementAutoCapture() {
  moveEls.currentStepText.textContent = t("rom_phase_finalize");
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return data;
}

function startLiveView() {
  if (!moveEls.photo) return;
  // LOCAL_SERVER_DEPENDENCY: video_feed MJPEG 스트림 호출
  moveEls.photo.src = `${API_BASE}/video_feed?t=${Date.now()}`;
}

function stopLiveView() {
  if (!moveEls.photo) return;
  moveEls.photo.src = `/ui/images/movement_visual.png?t=${Date.now()}`;
}

function resizeMovementCanvas() {
  if (!moveEls.overlayCanvas || !moveEls.feedWindow) return;
  const rect = moveEls.feedWindow.getBoundingClientRect();
  moveEls.overlayCanvas.width = Math.round(rect.width);
  moveEls.overlayCanvas.height = Math.round(rect.height);
}

function drawPoseOverlay() {
  const canvas = moveEls.overlayCanvas;
  const poseData = movementState.livePose;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Important: Reset detection state each frame to handle pose disappearance
  movementState.isInReadyZone = false;

  const landmarks = poseData?.pose?.landmarks || [];
  const connections = poseData?.pose?.connections || [];
  const frame = poseData?.frame || {};
  const srcW = frame.width || 640;
  const srcH = frame.height || 480;

  const sx = canvas.width / srcW;
  const sy = canvas.height / srcH;

  const byIndex = new Map();
  landmarks.forEach((lm) => byIndex.set(Number(lm.index), lm));

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0, 255, 120, 0.9)";
  connections.forEach(([a, b]) => {
    const p1 = byIndex.get(Number(a));
    const p2 = byIndex.get(Number(b));
    if (!p1 || !p2) return;
    if ((p1.visibility ?? 1) < 0.45 || (p2.visibility ?? 1) < 0.45) return;
    ctx.beginPath();
    ctx.moveTo(p1.x * sx, p1.y * sy);
    ctx.lineTo(p2.x * sx, p2.y * sy);
    ctx.stroke();
  });

  landmarks.forEach((lm) => {
    if ((lm.visibility ?? 1) < 0.45) return;
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 80, 80, 0.95)";
    ctx.arc(lm.x * sx, lm.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (movementState.selectedItem) {
    drawMovementSpecificOverlay(ctx, sx, sy, srcW, srcH);
  }
}

function drawMovementSpecificOverlay(ctx, sx, sy, srcW, srcH) {
  const item = movementState.selectedItem;
  const config = MOVEMENT_CONFIG[item.id];
  if (!config) return;

  const landmarks = movementState.livePose?.pose?.landmarks || [];
  const byIndex = new Map(landmarks.map(lm => [Number(lm.index), lm]));
  const cw = moveEls.overlayCanvas.width;
  const ch = moveEls.overlayCanvas.height;

  // 1. Deep Squat Interactive Guidelines
  if (item.id === "deep_squat") {
    // Draw Ready Zone (Central Box)
    const boxW = cw * 0.4;
    const boxH = ch * 0.7;
    const boxX = (cw - boxW) / 2;
    const boxY = (ch - boxH) / 2;

    ctx.save();
    ctx.lineWidth = 3;

    if (movementState.depthThresholdY > 0) {
      // Show depth line during active measurement
      ctx.setLineDash([10, 5]);
      ctx.strokeStyle = "rgba(255, 184, 0, 0.8)";
      ctx.beginPath();
      ctx.moveTo(0, movementState.depthThresholdY);
      ctx.lineTo(cw, movementState.depthThresholdY);
      ctx.stroke();

      ctx.font = "bold 14px Inter";
      ctx.fillStyle = "#ffb800";
      ctx.fillText("TARGET DEPTH", 20, movementState.depthThresholdY - 10);
    } else {
      // Show Ready Zone box during preparation OR waiting for recognition
      const inZone = checkUserInReadyPosition(byIndex, srcW, srcH);
      movementState.isInReadyZone = inZone;

      ctx.strokeStyle = inZone ? "rgba(74, 222, 128, 0.8)" : "rgba(255, 255, 255, 0.3)";
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.font = "bold 14px Inter";
      ctx.fillStyle = inZone ? "#4ade80" : "rgba(255, 255, 255, 0.5)";
      ctx.textAlign = "center";

      let label = t("move_msg_pos_guide");
      if (inZone) label = "READY!";
      else if (movementState.isWaitingForPosition) label = t("move_msg_pos_box");

      ctx.fillText(label, cw / 2, boxY - 15);
    }
    ctx.restore();
    return;
  }

  // Legacy Guidelines for others
  const type = config.overlayType;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(0, 199, 253, 0.5)";

  if (type === "SIDE_BODY" || type === "FRONT_BODY") {
    const hip = byIndex.get(24) || byIndex.get(23);
    if (hip) {
      const hx = hip.x * sx;
      ctx.beginPath();
      ctx.moveTo(hx, 0); ctx.lineTo(hx, ch);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Checks if ALL visible landmarks are within the central ready zone.
 */
function checkUserInReadyPosition(byIndex, srcW, srcH) {
  const landmarks = Array.from(byIndex.values());
  if (landmarks.length < 15) return false; // Basic detection check

  // Ready zone is 30% to 70% width, 15% to 85% height
  const minX = srcW * 0.3;
  const maxX = srcW * 0.7;
  const minY = srcH * 0.15;
  const maxY = srcH * 0.85;

  // Filter points with good visibility
  const visiblePoints = landmarks.filter(p => (p.visibility ?? 1) > 0.5);
  if (visiblePoints.length < 10) return false; // Require at least 10 visible points

  // Every single visible point must be inside the box
  return visiblePoints.every(p => {
    const x = p.x;
    const y = p.y;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });
}

async function fetchBodyPose() {
  if (movementState.poseBusy) return;
  movementState.poseBusy = true;
  try {
    // LOCAL_SERVER_DEPENDENCY: /api/body/live 엔드포인트 호출
    movementState.livePose = await fetchJson(`${API_BASE}/api/body/live`);
    movementState.lastPoseTime = Date.now();
    drawPoseOverlay();
  } catch (err) {
    console.error("body live error", err);
    movementState.isInReadyZone = false;
  } finally {
    movementState.poseBusy = false;
  }
}

async function fetchMovementLive() {
  if (!movementState.selectedItem || movementState.movementBusy) return;
  movementState.movementBusy = true;
  try {
    const qs = new URLSearchParams({
      test_type: movementState.selectedItem.id
    });
    // LOCAL_SERVER_DEPENDENCY: /api/movement/live 엔드포인트 호출
    movementState.liveResult = await fetchJson(`${API_BASE}/api/movement/live?${qs.toString()}`);
    syncMovementUi();
  } catch (err) {
    console.error("movement live error", err);
  } finally {
    movementState.movementBusy = false;
  }
}

function startPolling() {
  stopPolling();
  movementState.poseTimer = setInterval(() => {
    if (!movementState.agentOn) return;
    fetchBodyPose();
  }, 150);

  movementState.movementTimer = setInterval(() => {
    if (!movementState.agentOn || !movementState.selectedItem) return;
    fetchMovementLive();
  }, 350);
}

function stopPolling() {
  if (movementState.poseTimer) clearInterval(movementState.poseTimer);
  if (movementState.movementTimer) clearInterval(movementState.movementTimer);
  movementState.poseTimer = null;
  movementState.movementTimer = null;
}

function setMovementAgentState(on) {
  movementState.agentOn = on;
  moveEls.btnAgentText.textContent = on ? t("hc_agent_stop") : t("hc_agent_start");

  if (window.AudioManager) {
    window.AudioManager.playVoice(on ? 'agent_on' : 'sys_agent_off');
  }

  // Hide/Show guide overlay
  if (moveEls.guideOverlay) {
    if (on) {
      moveEls.guideOverlay.style.opacity = "0";
      moveEls.guideOverlay.style.pointerEvents = "none";
    } else {
      moveEls.guideOverlay.style.opacity = "1";
      moveEls.guideOverlay.style.pointerEvents = "auto";
    }
  }

  if (on) {
    startLiveView();
    startPolling();
    fetchBodyPose();
    fetchMovementLive();
  } else {
    stopPolling();
    stopLiveView();
    movementState.livePose = null;
    movementState.liveResult = null;
    drawPoseOverlay();
  }

  syncMovementUi();
}

async function startMovementMeasurement() {
  if (!movementState.agentOn || !movementState.selectedItem) return;

  // Toggle logic
  if (movementState.isMeasuring) {
    stopMovementSession();
    moveEls.currentStepText.textContent = t("hc_analysis_fail");
    moveEls.actionMessageText.textContent = t("hc_confirm_cancel");
    return;
  }

  const item = movementState.selectedItem;
  const config = MOVEMENT_CONFIG[item.id];
  console.log("Starting Movement measurement for:", item.id);
  if (window.AudioManager) window.AudioManager.playVoice('mov_start');

  movementState.isMeasuring = true;
  movementState.measureAbort = new AbortController();

  // Implementation of 3-second countdown
  if (item.id === "deep_squat") {
    movementState.isMeasuring = true;
    movementState.isWaitingForPosition = true;
    movementState.readyStartTime = 0;

    syncMovementButtons();
    syncMovementUi();
    return;
  }

  // Legacy flow for rest
  startCountdownSequence(item, config);
}

function startCountdownSequence(item, config) {
  if (movementState.isCountingDown) return;
  movementState.isMeasuring = true;
  movementState.isCountingDown = true;
  movementState.countdownLeft = 3;
  syncMovementUi();

  movementState.countdownTimer = setInterval(() => {
    movementState.countdownLeft--;
    if (movementState.countdownLeft <= 0) {
      clearInterval(movementState.countdownTimer);
      movementState.countdownTimer = null;
      movementState.isCountingDown = false;
      startActualMeasurement(item, config);
    }
    syncMovementUi();
  }, 1000);
}

async function startActualMeasurement(item, config) {
  // Initialize timer/reps for timed tests
  if (config.isTimed) {
    movementState.repCount = 0;
    movementState.timeLeft = config.duration || 30;
    movementState.snapshotCaptured = false;
    movementState.hasReachedBottom = false;
    movementState.sessionMetrics = { maxDepth: 180, balances: [], tilts: [] };
    movementState.squatPrevState = "standing";

    // Set baseline standing hip height for threshold line
    const landmarks = movementState.livePose?.pose?.landmarks || [];
    const byIndex = new Map(landmarks.map(lm => [Number(lm.index), lm]));
    const hip = byIndex.get(24) || byIndex.get(23);
    const knee = byIndex.get(26) || byIndex.get(25);

    if (hip && knee) {
      movementState.standingHipsY = hip.y;
      // 0.4 multiplier (slightly lower than previous 0.3)
      movementState.depthThresholdY = hip.y + (knee.y - hip.y) * 0.4;
      console.log(`Standing Hip Y: ${hip.y}, Depth Threshold Y: ${movementState.depthThresholdY}`);
    }

    movementState.measureTimer = setInterval(() => {
      movementState.timeLeft--;
      if (movementState.timeLeft <= 0) {
        finalizeMeasurementSession(item);
      }
      syncMovementUi();
    }, 1000);
  }

  syncMovementButtons();
  moveEls.currentStepText.textContent = `${t(item.name)} ${t("hc_track_waiting")}`;
  moveEls.overallProgress.style.width = "78%";

  // Reset peak hold for non-timed
  if (!config.isTimed) {
    movementState.peakHold = { maxValue: 0, startTime: Date.now(), isTriggered: false };
    // Call legacy analyze endpoint
    try {
      const subjectNo = getCurrentSubjectNo();
      const qs = new URLSearchParams({ test_type: item.id, subject_no: subjectNo });
      // LOCAL_SERVER_DEPENDENCY: /api/movement/analyze 엔드포인트 호출
      const data = await fetchJson(`${API_BASE}/api/movement/analyze?${qs.toString()}`, {
        method: "POST",
        signal: movementState.measureAbort.signal
      });
      finalizeMeasurementSession(item, data);
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
      stopMovementSession();
    }
  }
}

function stopMovementSession() {
  if (movementState.measureAbort) {
    movementState.measureAbort.abort();
    movementState.measureAbort = null;
  }
  if (movementState.measureTimer) {
    clearInterval(movementState.measureTimer);
    movementState.measureTimer = null;
  }
  if (movementState.countdownTimer) {
    clearInterval(movementState.countdownTimer);
    movementState.countdownTimer = null;
  }
  movementState.isMeasuring = false;
  movementState.isCountingDown = false;
  movementState.isWaitingForPosition = false;
  movementState.depthThresholdY = 0;
  movementState.standingHipsY = 0;
  movementState.readyStartTime = 0;
  movementState.isInReadyZone = false;
  syncMovementButtons();
  syncMovementUi(); // Ensure visual countdown/messages reset
}

async function finalizeMeasurementSession(item, data = null) {
  stopMovementSession();

  moveEls.currentStepText.textContent = `${t(item.name)} ${t("hc_analysis_complete")}`;
  moveEls.actionMessageText.textContent = t("rom_phase_finalize");
  moveEls.overallProgress.style.width = "100%";

  if (window.AudioManager) window.AudioManager.playVoice('complete');

  // For timed tests, we need to send the aggregate results
  const config = MOVEMENT_CONFIG[item.id];
  if (config.isTimed && !data) {
    try {
      const subjectNo = getCurrentSubjectNo();
      // Aggregate metrics
      const avgBal = movementState.sessionMetrics.balances.length > 0
        ? movementState.sessionMetrics.balances.reduce((a, b) => a + b, 0) / movementState.sessionMetrics.balances.length
        : 50;

      const summary = {
        count: movementState.repCount,
        max_depth: movementState.sessionMetrics.maxDepth,
        avg_balance_left: avgBal
      };

      const qs = new URLSearchParams({
        subject_no: subjectNo, // Assuming getCurrentSubjectNo() returns email or similar
        test_type: item.id,
        summary_data: JSON.stringify(summary),
        use_snapshot: "true"
      });

      // LOCAL_SERVER_DEPENDENCY: /api/movement/analyze 엔드포인트 호출
      data = await fetchJson(`${API_BASE}/api/movement/analyze?${qs.toString()}`, {
        method: "POST"
      });
    } catch (err) {
      console.error("Finalize error", err);
      alert(t("rom_save_fail") + ": " + err.message);
    }
  }

  syncMovementUi();
  moveEls.actionMessageText.textContent = `${t(item.name)} ${t("hc_analysis_complete")}`;

  // Auto refresh history if parent exists
  if (window.parent && window.parent.refreshHistory) {
    window.parent.refreshHistory();
  }

  // Show Completion Modal
  showCompletionModal(`${t(item.name)} ${t("rom_complete_msg")}`, "/ui/performancereport.html");
}

function showCompletionModal(message, reportUrl) {
  const modal = document.getElementById("completionModal");
  const msgEl = document.getElementById("modalMessage");
  const btnView = document.getElementById("btnViewReport");
  const btnClose = document.getElementById("btnCloseModal");

  if (!modal) return;

  if (msgEl) msgEl.textContent = message;

  if (btnView) {
    btnView.onclick = () => {
      window.location.href = reportUrl;
    };
  }

  if (btnClose) {
    btnClose.onclick = () => {
      modal.classList.add("hidden");
    };
  }

  modal.classList.remove("hidden");

  setTimeout(() => {
    if (!modal.classList.contains("hidden")) {
      window.location.href = reportUrl;
    }
  }, 6000);
}


function initMovementPage() {
  syncSidebarLinks();
  renderMovementList();
  syncMovementUi();
  resizeMovementCanvas();

  window.addEventListener("resize", resizeMovementCanvas);
  moveEls.btnAgent?.addEventListener("click", () => setMovementAgentState(!movementState.agentOn));
  moveEls.btnMeasureStart?.addEventListener("click", startMovementMeasurement);

  moveEls.photo?.addEventListener("error", () => {
    if (movementState.agentOn) {
      console.warn("Video feed error, retrying...");
      setTimeout(startLiveView, 1000);
    }
  });
}

document.addEventListener("DOMContentLoaded", initMovementPage);