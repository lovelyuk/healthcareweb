
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

const ROM_ITEMS = [
  {
    id: "cervical_rotation",
    name: "rom_cervical_rotation",
    badge: "badge_neck",
    joint: "joint_neck",
    direction: "dir_rotation",
    posture: "posture_front_stand",
    summary: "rom_cervical_rotation_sum",
    guideTitle: "rom_cervical_rotation_guide_t",
    guideDesc: "rom_cervical_rotation_guide_d",
    actionText: "rom_cervical_rotation_action",
    icon: "neck.png",
    instructions: [
      "rom_inst_neck_1",
      "rom_inst_neck_2",
      "rom_inst_neck_3",
      "rom_inst_neck_4"
    ]
  },
  {
    id: "shoulder_flexion",
    name: "rom_shoulder_flexion",
    badge: "badge_upper",
    joint: "joint_shoulder",
    direction: "dir_flexion_front",
    posture: "posture_front_stand",
    summary: "rom_shoulder_flexion_sum",
    guideTitle: "rom_shoulder_flexion_guide_t",
    guideDesc: "rom_shoulder_flexion_guide_d",
    actionText: "rom_shoulder_flexion_action",
    icon: "waist.png",
    instructions: [
      "rom_inst_sh_flex_1",
      "rom_inst_sh_flex_2",
      "rom_inst_sh_flex_3",
      "rom_inst_sh_flex_4"
    ]
  },
  {
    id: "shoulder_abduction",
    name: "rom_shoulder_abduction",
    badge: "badge_upper",
    joint: "joint_shoulder",
    direction: "dir_abduction",
    posture: "posture_front_stand",
    summary: "rom_shoulder_abduction_sum",
    guideTitle: "rom_shoulder_abduction_guide_t",
    guideDesc: "rom_shoulder_abduction_guide_d",
    actionText: "rom_shoulder_abduction_action",
    icon: "shoulder.png",
    instructions: [
      "rom_inst_sh_abd_1",
      "rom_inst_sh_abd_2",
      "rom_inst_sh_abd_3",
      "rom_inst_sh_abd_4"
    ]
  },
  {
    id: "hip_flexion",
    name: "rom_hip_flexion",
    badge: "badge_lower",
    joint: "joint_hip",
    direction: "dir_knee_raise",
    posture: "posture_front_stand",
    summary: "rom_hip_flexion_sum",
    guideTitle: "rom_hip_flexion_guide_t",
    guideDesc: "rom_hip_flexion_guide_d",
    actionText: "rom_hip_flexion_action",
    icon: "hipjoint.png",
    instructions: [
      "rom_inst_hip_flex_1",
      "rom_inst_hip_flex_2",
      "rom_inst_hip_flex_3",
      "rom_inst_hip_flex_4"
    ]
  },
  {
    id: "knee_flexion",
    name: "rom_knee_flexion",
    badge: "badge_lower",
    joint: "joint_knee",
    direction: "dir_flexion_back",
    posture: "posture_front_stand",
    summary: "rom_knee_flexion_sum",
    guideTitle: "rom_knee_flexion_guide_t",
    guideDesc: "rom_knee_flexion_guide_d",
    actionText: "rom_knee_flexion_action",
    icon: "knee.png",
    instructions: [
      "rom_inst_knee_flex_1",
      "rom_inst_knee_flex_2",
      "rom_inst_knee_flex_3",
      "rom_inst_knee_flex_4"
    ]
  },
  {
    id: "ankle_dorsiflexion",
    name: "rom_ankle_dorsiflexion",
    badge: "badge_lower",
    joint: "joint_ankle",
    direction: "dir_ankle_front",
    posture: "posture_split_stand",
    summary: "rom_ankle_dorsiflexion_sum",
    guideTitle: "rom_ankle_dorsiflexion_guide_t",
    guideDesc: "rom_ankle_dorsiflexion_guide_d",
    actionText: "rom_ankle_dorsiflexion_action",
    icon: "ankle.png",
    instructions: [
      "rom_inst_ankle_1",
      "rom_inst_ankle_2",
      "rom_inst_ankle_3",
      "rom_inst_ankle_4"
    ]
  }
];

const ROM_CONFIG = {
  cervical_rotation: {
    title: "rom_cervical_rotation",
    guideMessage: "rom_cervical_rotation_guide_d",
    guideImage: "/ui/images/guides/neck_rotation.png",
    overlayType: "FACE_CENTER",
    targetMetric: "rotation_angle",
    targetLandmarks: [11, 12, 0],
    threshold: 15,
    normalRange: { min: 0, max: 80 }
  },
  shoulder_flexion: {
    title: "rom_shoulder_flexion",
    guideMessage: "rom_shoulder_flexion_guide_d",
    guideImage: "/ui/images/guides/shoulder_flexion.png",
    overlayType: "SIDE_BODY",
    targetMetric: "flexion_angle",
    targetLandmarks: [12, 14, 16],
    threshold: 10,
    normalRange: { min: 0, max: 180 }
  },
  shoulder_abduction: {
    title: "rom_shoulder_abduction",
    guideMessage: "rom_shoulder_abduction_guide_d",
    guideImage: "/ui/images/guides/shoulder_abduction.png",
    overlayType: "FRONT_BODY",
    targetMetric: "abduction_angle",
    targetLandmarks: [12, 14, 16],
    threshold: 10,
    normalRange: { min: 0, max: 180 }
  },
  hip_flexion: {
    title: "rom_hip_flexion",
    guideMessage: "rom_hip_flexion_guide_d",
    guideImage: "/ui/images/guides/hip_flexion.png",
    overlayType: "FRONT_BODY",
    targetMetric: "flexion_angle",
    targetLandmarks: [24, 26, 28],
    threshold: 15,
    normalRange: { min: 0, max: 120 }
  },
  knee_flexion: {
    title: "rom_knee_flexion",
    guideMessage: "rom_knee_flexion_guide_d",
    guideImage: "/ui/images/guides/knee_flexion.png",
    overlayType: "SIDE_BODY",
    targetMetric: "flexion_angle",
    targetLandmarks: [24, 26, 28],
    threshold: 15,
    normalRange: { min: 0, max: 140 }
  },
  ankle_dorsiflexion: {
    title: "rom_ankle_dorsiflexion",
    guideMessage: "rom_ankle_dorsiflexion_guide_d",
    guideImage: "/ui/images/guides/ankle_dorsiflexion.png",
    overlayType: "SIDE_BODY",
    targetMetric: "dorsiflexion_angle",
    targetLandmarks: [26, 28, 32],
    threshold: 10,
    normalRange: { min: 0, max: 20 }
  }
};

const romState = {
  agentOn: false,
  selectedItem: null,
  poseTimer: null,
  romTimer: null,
  poseBusy: false,
  romBusy: false,
  livePose: null,
  liveResult: null,
  isMeasuring: false,
  isCountingDown: false,
  isWaitingForPosition: false,
  isInReadyZone: false,
  readyStartTime: 0,
  lastPoseTime: 0,
  measurePhase: "READY", // READY, WAITING_FOR_POSITION, START_COUNTDOWN, WAITING_LEFT, LEFT_MEASURING, WAITING_RIGHT, RIGHT_MEASURING, FINALIZE
  measureAbort: null,
  countdown: 0,
  countdownTimer: null,
  results: {
    left: null,
    right: null
  },
  peakHold: {
    maxValue: 0,
    startTime: null,
    isTriggered: false
  }
};

const romEls = {
  analysisList: document.getElementById("analysisList"),
  selectedName: document.getElementById("selectedName"),
  selectedSummary: document.getElementById("selectedSummary"),
  metaJoint: document.getElementById("metaJoint"),
  metaDirection: document.getElementById("metaDirection"),
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
  btnMeasureText: document.getElementById("btnMeasureText"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  countdownNumber: document.getElementById("countdownNumber"),
  countdownText: document.getElementById("countdownText"),
  stepMask: document.getElementById("stepMask")
};

function t(key) {
  const lang = localStorage.getItem('appLang') || 'en';
  return (window.translations && window.translations[lang] && window.translations[lang][key]) ? window.translations[lang][key] : key;
}

function getSelectedSide(testId) {
  if (["shoulder_flexion", "shoulder_abduction", "hip_flexion", "knee_flexion", "ankle_dorsiflexion"].includes(testId)) {
    return "right";
  }
  return null;
}

function renderRomList() {
  romEls.analysisList.innerHTML = ROM_ITEMS.map((item) => `
    <div class="analysis-item ${romState.selectedItem?.id === item.id ? "active" : ""}" data-id="${item.id}">
      <div class="analysis-item-content">
        <div class="analysis-top">
          <div class="analysis-name">${t(item.name)}</div>
        </div>
        <div class="analysis-meta">
          <div><strong data-i18n="rom_joint">${t("rom_joint")}</strong><br>${t(item.joint)}</div>
          <div><strong data-i18n="rom_direction">${t("rom_direction")}</strong><br>${t(item.direction)}</div>
          <div><strong data-i18n="rom_posture">${t("rom_posture")}</strong><br>${t(item.posture)}</div>
        </div>
        <div class="analysis-summary">${t(item.summary)}</div>
      </div>
      <div class="analysis-item-visual">
        <div class="analysis-badge">${t(item.badge)}</div>
        <img src="/ui/images/${item.icon}" class="measurement-icon-img" alt="${t(item.name)}">
      </div>
    </div>
  `).join("");

  romEls.analysisList.querySelectorAll(".analysis-item").forEach((node) => {
    node.addEventListener("click", () => {
      const item = ROM_ITEMS.find(v => v.id === node.dataset.id);
      if (!item) return;
      romState.selectedItem = item;
      syncRomUi();
      if (romState.agentOn) {
        fetchRomLive();
      }
    });
  });
}

function syncButtons() {
  const enabled = romState.agentOn && !!romState.selectedItem;
  if (romEls.btnMeasureStart) {
    romEls.btnMeasureStart.disabled = !enabled;
    const btnText = romEls.btnMeasureStart.querySelector(".btn-text-content") || romEls.btnMeasureText;

    if (romState.isMeasuring || romState.isWaitingForPosition || romState.isCountingDown) {
      romEls.btnMeasureStart.classList.add("danger");
      if (btnText) btnText.textContent = t("hc_measure_stop");
      const icon = romEls.btnMeasureStart.querySelector("i");
      if (icon) icon.className = "fa-solid fa-stop";
    } else {
      romEls.btnMeasureStart.classList.remove("danger");
      if (btnText) btnText.textContent = t("hc_measure_start");
      const icon = romEls.btnMeasureStart.querySelector("i");
      if (icon) icon.className = "fa-solid fa-play";
    }
  }
}

function syncTrackingPill() {
  if (romState.agentOn && romState.liveResult?.tracking) {
    romEls.trackingIcon.className = "fa-solid fa-user-check";
    romEls.trackingText.textContent = t("hc_track_ok");
  } else {
    romEls.trackingIcon.className = "fa-solid fa-user-slash";
    romEls.trackingText.textContent = t("hc_track_off");
  }
}

let lastTrackStatus = true;
function syncRomUi() {
  const isTracking = !!(romState.agentOn && romState.liveResult?.tracking);
  if (romState.agentOn && !isTracking && lastTrackStatus) {
    const modal = document.getElementById("completionModal");
    const isModalShowing = modal && !modal.classList.contains("hidden");
    if (window.AudioManager && !isModalShowing) window.AudioManager.playVoice('sys_track_lost');
  }
  lastTrackStatus = isTracking;

  renderRomList();
  syncTrackingPill();
  syncButtons();

  // Agent Button
  if (romEls.btnAgentText) {
    romEls.btnAgentText.textContent = romState.agentOn ? t("hc_agent_stop") : t("hc_agent_start");
  }

  const item = romState.selectedItem;

  if (!item) {
    romEls.selectedName.textContent = t("hc_none_selected");
    romEls.selectedSummary.textContent = t("hc_selected_desc");
    romEls.metaJoint.textContent = "-";
    romEls.metaDirection.textContent = "-";
    romEls.metaPosture.textContent = "-";
    romEls.guideTitle.textContent = t("hc_guide_rom_title");
    romEls.guideDesc.textContent = t("hc_guide_rom_desc");
    romEls.instructionList.innerHTML = `
      <li>${t("rom_inst_select")}</li>
      <li>${t("rom_inst_pose")}</li>
      <li>${t("rom_inst_start")}</li>
    `;
    if (romEls.qualityBox) romEls.qualityBox.textContent = t("rom_status_awaiting");
    romEls.currentStepText.textContent = romState.agentOn ? t("hc_select_rom") : t("hc_guide_agent_title");
    romEls.actionMessageText.textContent = romState.agentOn ? t("hc_action_select") : t("hc_turn_on_agent");
    romEls.overallProgress.style.width = romState.agentOn ? "10%" : "0%";
  } else {
    romEls.selectedName.textContent = t(item.name);
    romEls.selectedSummary.textContent = t(item.summary);
    romEls.metaJoint.textContent = t(item.joint);
    romEls.metaDirection.textContent = t(item.direction);
    romEls.metaPosture.textContent = t(item.posture);
    romEls.guideTitle.textContent = t(item.guideTitle);
    romEls.guideDesc.textContent = t(item.guideDesc);
    romEls.instructionList.innerHTML = item.instructions.map(key => `<li>${t(key)}</li>`).join("");

    if (romEls.qualityBox) {
      if (romState.liveResult?.result) {
        const r = romState.liveResult.result;
        romEls.qualityBox.textContent = `${t("rom_status")}: ${r.status || "-"} | ${r.summary || ""}`;
      } else {
        romEls.qualityBox.textContent = romState.agentOn ? t("rom_status_ready") : t("rom_status_agent_needed");
      }
    }

    if (romState.isMeasuring || romState.isWaitingForPosition || romState.isCountingDown) {
      if (romEls.countdownOverlay) {
        if (romState.isCountingDown) {
          romEls.countdownOverlay.style.display = "flex";
          romEls.countdownNumber.textContent = romState.countdown;
        } else {
          romEls.countdownOverlay.style.display = "none";
        }
      }

      // Update UI based on measurement phase
      switch (romState.measurePhase) {
        case "WAITING_FOR_POSITION":
          romEls.currentStepText.textContent = t("rom_phase_wait_pos");
          romEls.actionMessageText.textContent = t("rom_msg_wait_pos");
          romEls.overallProgress.style.width = "20%";
          break;
        case "START_COUNTDOWN":
          romEls.currentStepText.textContent = t("rom_phase_prep");
          romEls.actionMessageText.textContent = t("rom_msg_prep");
          romEls.overallProgress.style.width = "40%";
          break;
        case "WAITING_LEFT":
          romEls.currentStepText.textContent = t("rom_phase_wait_left");
          romEls.actionMessageText.textContent = t("rom_msg_wait_left");
          romEls.overallProgress.style.width = "40%";
          break;
        case "LEFT_MEASURING":
          const leftVal = romState.peakHold.maxValue || 0;
          romEls.currentStepText.textContent = `${t("rom_phase_left_meas")} (${Math.round(leftVal)}°)`;
          romEls.actionMessageText.textContent = t("rom_msg_left_meas");
          romEls.overallProgress.style.width = "65%";
          break;
        case "WAITING_RIGHT":
          romEls.currentStepText.textContent = t("rom_phase_wait_right");
          romEls.actionMessageText.textContent = t("rom_msg_wait_right");
          romEls.overallProgress.style.width = "75%";
          break;
        case "RIGHT_MEASURING":
          const rightVal = romState.peakHold.maxValue || 0;
          romEls.currentStepText.textContent = `${t("rom_phase_right_meas")} (${Math.round(rightVal)}°)`;
          romEls.actionMessageText.textContent = t("rom_msg_right_meas");
          romEls.overallProgress.style.width = "90%";
          break;
        case "FINALIZE":
          romEls.currentStepText.textContent = t("rom_phase_finalize");
          romEls.actionMessageText.textContent = t("rom_msg_finalize");
          romEls.overallProgress.style.width = "100%";
          break;
      }
      checkAutoCapture();
    } else {
      if (romEls.countdownOverlay) romEls.countdownOverlay.style.display = "none";
      romEls.currentStepText.textContent = romState.agentOn ? t("rom_status_ready_short") : t("rom_status_item_sel");
      romEls.actionMessageText.textContent = romState.agentOn ? t("rom_msg_ready_short") : t("rom_msg_item_sel");
      romEls.overallProgress.style.width = romState.agentOn ? "15%" : "10%";
    }
  }

  const config = ROM_CONFIG[item?.id];
  if (config?.guideImage) {
    romEls.guideImg.src = config.guideImage;
    romEls.guideImg.style.display = "block";
  } else {
    romEls.guideImg.style.display = "none";
  }
}

function checkAutoCapture() {
  const item = romState.selectedItem;
  if (!item) return;

  const result = romState.liveResult?.result;
  const config = ROM_CONFIG[item.id];
  const pose = romState.livePose?.pose?.landmarks;

  if (romState.measurePhase === "WAITING_FOR_POSITION") {
    if (!pose) {
      romState.isInReadyZone = false;
      romState.readyStartTime = 0;
      return;
    }

    const byIndex = new Map(pose.map(lm => [Number(lm.index), lm]));
    const frame = romState.livePose?.pose?.frame || { width: 640, height: 480 };
    const srcW = frame.width;
    const srcH = frame.height;

    const required = [0, 11, 12];
    const box = { x: 0.3, y: 0.05, w: 0.4, h: 0.6 };

    let allIn = true;
    for (const idx of required) {
      const lm = byIndex.get(idx);
      if (!lm || (lm.visibility || 0) < 0.4) { allIn = false; break; }

      const nx = lm.x / srcW;
      const ny = lm.y / srcH;

      if (nx < box.x || nx > box.x + box.w || ny < box.y || ny > box.y + box.h) {
        allIn = false;
        break;
      }
    }

    if (allIn) {
      if (!romState.isInReadyZone) {
        romState.isInReadyZone = true;
        romState.readyStartTime = Date.now();
      } else if (Date.now() - romState.readyStartTime > 1500) {
        romState.isWaitingForPosition = false;
        romState.isMeasuring = true;
        romState.measurePhase = "WAITING_LEFT";
        romState.peakHold.maxValue = 0;
        syncRomUi();
      }
    } else {
      romState.isInReadyZone = false;
      romState.readyStartTime = 0;
    }
    return;
  }

  if (!romState.isMeasuring || !result || !config) return;

  const metricKey = config.targetMetric || 'rotation_angle';
  const rawMetric = result.metrics[metricKey];
  const currentVal = (typeof rawMetric === 'number') ? rawMetric : (result.metrics['angle'] || result.metrics['flexion_angle'] || 0);

  if (item.id === "cervical_rotation") {
    if (romState.measurePhase === "WAITING_LEFT") {
      const dir = result.metrics.direction || result.side;
      if (dir === "left" && currentVal > 50 && !romState.isCountingDown) {
        console.log("Turn LEFT detected:", currentVal);
        if (window.AudioManager) window.AudioManager.playVoice('rom_neck_left');
        startCountdown("LEFT_MEASURING", 3, async () => {
          romState.results.left = romState.peakHold.maxValue;
          await handlePhaseComplete("left", romState.results.left);
          romState.measurePhase = "WAITING_RIGHT";
          romState.peakHold.maxValue = 0;
          syncRomUi();
        });
      }
    } else if (romState.measurePhase === "WAITING_RIGHT") {
      const dir = result.metrics.direction || result.side;
      if (dir === "right" && currentVal > 50 && !romState.isCountingDown) {
        console.log("Turn RIGHT detected:", currentVal);
        startCountdown("RIGHT_MEASURING", 3, async () => {
          romState.results.right = romState.peakHold.maxValue;
          await handlePhaseComplete("right", romState.results.right);
          romState.measurePhase = "FINALIZE";
          finalizeSequentialMeasurement();
        });
      }
    }
  } else {
    if (romState.measurePhase === "WAITING_LEFT") {
      if (!romState.isCountingDown) {
        startCountdown("LEFT_MEASURING", 3, async () => {
          const val = romState.peakHold.maxValue;
          await handlePhaseComplete("right", val);
          romState.measurePhase = "FINALIZE";
          finalizeSequentialMeasurement();
        });
      }
    }
  }

  if (romState.measurePhase === "LEFT_MEASURING" || romState.measurePhase === "RIGHT_MEASURING") {
    if (currentVal > romState.peakHold.maxValue) {
      romState.peakHold.maxValue = currentVal;
    }
  }
}

function startCountdown(nextPhase, seconds, onComplete) {
  if (romState.countdownTimer) {
    clearInterval(romState.countdownTimer);
  }

  romState.measurePhase = nextPhase;
  romState.countdown = seconds;
  romState.isCountingDown = true;
  syncRomUi();

  romState.countdownTimer = setInterval(() => {
    romState.countdown--;
    if (romState.countdown <= 0) {
      clearInterval(romState.countdownTimer);
      romState.countdownTimer = null;
      romState.isCountingDown = false;
      if (onComplete) onComplete();
      syncRomUi();
    } else {
      syncRomUi();
    }
  }, 1000);
}

async function handlePhaseComplete(optSide, optValue) {
  const currentPhase = romState.measurePhase;
  const item = romState.selectedItem;

  try {
    const side = optSide || (currentPhase === "LEFT_MEASURING" ? "left" : "right");
    const value = optValue !== undefined ? optValue : (romState.peakHold.maxValue || 0);

    const subjectNo = getCurrentSubjectNo();
    const qs = new URLSearchParams({
      test_type: item.id,
      subject_no: subjectNo,
      side: side,
      value: Math.round(value)
    });

    console.log(`Saving ${side} side ROM (${value}°)...`);
    // LOCAL_SERVER_DEPENDENCY: /api/rom/analyze 엔드포인트 호출
    const data = await fetchJson(`${API_BASE}/api/rom/analyze?${qs.toString()}`, {
      method: "POST"
    });

    if (window.parent && window.parent.refreshHistory) {
      window.parent.refreshHistory();
    }

    if (currentPhase === "LEFT_MEASURING" && item.id === "cervical_rotation") {
      if (window.AudioManager) window.AudioManager.playVoice('rom_neck_right');
      syncRomUi();
    } else {
      romState.measurePhase = "FINALIZE";
      finalizeSequentialMeasurement();
    }
    syncRomUi();
  } catch (err) {
    console.error("Phase complete save error", err);
    alert(`${t("rom_save_fail")}: ${err.message}`);
    cancelMeasurement();
  }
}

async function finalizeSequentialMeasurement() {
  romState.isMeasuring = false;
  romState.measurePhase = "READY";
  if (window.AudioManager) window.AudioManager.playVoice('complete');
  syncRomUi();
  showCompletionModal(t("rom_complete_msg"), "/ui/mobilityreport.html");
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

function cancelMeasurement() {
  romState.isMeasuring = false;
  romState.isWaitingForPosition = false;
  romState.isCountingDown = false;
  romState.measurePhase = "READY";
  if (romState.countdownTimer) clearInterval(romState.countdownTimer);
  romState.countdownTimer = null;
  syncRomUi();
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
  if (!romEls.photo) return;
  // LOCAL_SERVER_DEPENDENCY: video_feed MJPEG 스트림 호출
  romEls.photo.src = `${API_BASE}/video_feed?t=${Date.now()}`;
}

function stopLiveView() {
  if (!romEls.photo) return;
  romEls.photo.src = `/ui/images/rom_visual.png?t=${Date.now()}`;
}

function resizeRomCanvas() {
  if (!romEls.overlayCanvas || !romEls.feedWindow) return;
  const rect = romEls.feedWindow.getBoundingClientRect();
  romEls.overlayCanvas.width = Math.round(rect.width);
  romEls.overlayCanvas.height = Math.round(rect.height);
}

function drawPoseOverlay() {
  const canvas = romEls.overlayCanvas;
  const poseData = romState.livePose;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = poseData?.pose?.landmarks || [];
  const connections = poseData?.pose?.connections || [];
  const frame = poseData?.frame || {};
  const srcW = frame.width || 640;
  const srcH = frame.height || 480;

  const sx = canvas.width / srcW;
  const sy = canvas.height / srcH;

  const byIndex = new Map(landmarks.map((lm) => [Number(lm.index), lm]));

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

  if (romState.selectedItem) {
    drawSpecificOverlay(ctx, sx, sy);
  }

  if (romState.measurePhase === "WAITING_FOR_POSITION") {
    const box = { x: 0.3, y: 0.05, w: 0.4, h: 0.6 };
    const bx = box.x * canvas.width;
    const by = box.y * canvas.height;
    const bw = box.w * canvas.width;
    const bh = box.h * canvas.height;

    ctx.strokeStyle = romState.isInReadyZone ? "rgba(74, 222, 128, 0.8)" : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = "white";
    ctx.font = "bold 16px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(romState.isInReadyZone ? t("rom_pos_ok") : t("rom_pos_guide"), bx + bw / 2, by + bh + 30);
    ctx.setLineDash([]);
  }
}

function drawSpecificOverlay(ctx, sx, sy) {
  const config = ROM_CONFIG[romState.selectedItem.id];
  if (!config) return;

  const type = config.overlayType;
  const landmarks = romState.livePose?.pose?.landmarks || [];
  const byIndex = new Map(landmarks.map(lm => [Number(lm.index), lm]));

  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(0, 199, 253, 0.5)";

  if (type === "FACE_CENTER") {
    const nose = byIndex.get(0);
    if (nose) {
      const nx = nose.x * sx;
      const ny = nose.y * sy;
      ctx.beginPath();
      ctx.moveTo(0, ny); ctx.lineTo(romEls.overlayCanvas.width, ny);
      ctx.moveTo(nx, 0); ctx.lineTo(nx, romEls.overlayCanvas.height);
      ctx.stroke();
    }
  } else if (type === "SIDE_BODY" || type === "FRONT_BODY") {
    const hip = byIndex.get(24) || byIndex.get(23);
    if (hip) {
      const hx = hip.x * sx;
      ctx.beginPath();
      ctx.moveTo(hx, 0); ctx.lineTo(hx, romEls.overlayCanvas.height);
      ctx.stroke();
    }
  }
  ctx.restore();
}

async function fetchBodyPose() {
  if (romState.poseBusy) return;
  romState.poseBusy = true;
  try {
    // LOCAL_SERVER_DEPENDENCY: /api/body/live 엔드포인트 호출
    romState.livePose = await fetchJson(`${API_BASE}/api/body/live`);
    drawPoseOverlay();
  } catch (err) {
    console.error("body live error", err);
  } finally {
    romState.poseBusy = false;
  }
}

async function fetchRomLive() {
  if (!romState.selectedItem || romState.romBusy) return;
  romState.romBusy = true;
  try {
    const side = getSelectedSide(romState.selectedItem.id);
    const qs = new URLSearchParams({ test_type: romState.selectedItem.id });
    if (side) qs.set("side", side);
    // LOCAL_SERVER_DEPENDENCY: /api/rom/live 엔드포인트 호출
    romState.liveResult = await fetchJson(`${API_BASE}/api/rom/live?${qs.toString()}`);
    syncRomUi();
  } catch (err) {
    console.error("rom live error", err);
  } finally {
    romState.romBusy = false;
  }
}

function startPolling() {
  stopPolling();
  romState.poseTimer = setInterval(() => {
    if (!romState.agentOn) return;
    fetchBodyPose();
  }, 150);

  romState.romTimer = setInterval(() => {
    if (!romState.agentOn || !romState.selectedItem) return;
    fetchRomLive();
  }, 350);
}

function stopPolling() {
  if (romState.poseTimer) clearInterval(romState.poseTimer);
  if (romState.romTimer) clearInterval(romState.romTimer);
  romState.poseTimer = null;
  romState.romTimer = null;
}

function setAgentState(on) {
  romState.agentOn = on;
  romEls.btnAgentText.textContent = on ? t("hc_agent_stop") : t("hc_agent_start");

  if (window.AudioManager) {
    window.AudioManager.playVoice(on ? 'agent_on' : 'sys_agent_off');
  }

  if (romEls.guideOverlay) {
    if (on) {
      romEls.guideOverlay.style.opacity = "0";
      romEls.guideOverlay.style.pointerEvents = "none";
    } else {
      romEls.guideOverlay.style.opacity = "1";
      romEls.guideOverlay.style.pointerEvents = "auto";
    }
  }

  if (on) {
    startLiveView();
    startPolling();
    fetchBodyPose();
    fetchRomLive();
  } else {
    stopPolling();
    stopLiveView();
    romState.livePose = null;
    romState.liveResult = null;
    drawPoseOverlay();
  }
  syncRomUi();
}

async function startRomMeasurement() {
  if (!romState.agentOn || !romState.selectedItem) return;

  if (window.AudioManager) {
    window.AudioManager.playVoice('rom_start');
  }

  if (romState.isMeasuring || romState.isWaitingForPosition || romState.isCountingDown) {
    if (confirm(t("hc_confirm_cancel"))) {
      cancelMeasurement();
    }
    return;
  }

  const item = romState.selectedItem;

  if (item.id === "cervical_rotation") {
    romState.isWaitingForPosition = true;
    romState.measurePhase = "WAITING_FOR_POSITION";
    romState.readyStartTime = 0;
    romState.isInReadyZone = false;
  } else {
    romState.isMeasuring = true;
    romState.measurePhase = "WAITING_LEFT";
  }

  romState.results = { left: null, right: null };
  romState.countdown = 0;
  syncRomUi();
}

function initRomPage() {
  syncSidebarLinks();
  renderRomList();
  syncRomUi();
  resizeRomCanvas();

  window.addEventListener("resize", resizeRomCanvas);
  romEls.btnAgent?.addEventListener("click", () => setAgentState(!romState.agentOn));
  romEls.btnMeasureStart?.addEventListener("click", startRomMeasurement);

  romEls.photo?.addEventListener("error", () => {
    if (romState.agentOn) {
      setTimeout(startLiveView, 1000);
    }
  });
}

document.addEventListener("DOMContentLoaded", initRomPage);