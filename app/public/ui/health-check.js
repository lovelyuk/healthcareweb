// API_BASE moved to /ui/lib/api.js — use Api.getApiBase(), Api.fetch(), etc.

const MOBILE_BREAKPOINT = 900;

function isMobileClient() {
  const hasTouchDeviceUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  return window.innerWidth <= MOBILE_BREAKPOINT || hasTouchDeviceUa;
}

const DISPLAY_NAMES = {
  "head_tilt": "hc_hd_tilt",
  "shoulder_slope": "hc_sh_tilt",
  "shoulder_balance": "hc_sh_balance",
  "pelvic_balance": "hc_pl_balance",
  "body_center": "hc_center_axis",
  "lower_body_symmetry": "hc_leg_symmetry",
  "knee_shape": "hc_knee_align",
  "xo_leg": "hc_o_leg",
  "head_neck_shape": "hc_turtle",
  "cervical_alignment": "hc_cervical_align",
  "shoulder_back_shape": "hc_round_shoulder",
  "back_shape": "hc_sp_curv",
  "lumbar_curve": "hc_lumbar_curve",
  "pelvic_shape": "hc_pelvis_tilt",
  "calf_shape": "hc_calf_shape",
  "waist_shape": "hc_waist_shape"
};

const ANALYSIS_ORDER = [
  "head_tilt",
  "shoulder_slope",
  "shoulder_balance",
  "pelvic_balance",
  "body_center",
  "lower_body_symmetry",
  "knee_shape",
  "xo_leg",
  "head_neck_shape",
  "cervical_alignment",
  "shoulder_back_shape",
  "back_shape",
  "lumbar_curve",
  "pelvic_shape",
  "calf_shape",
  "waist_shape"
];

const miniIds = {};

const state = {
  mobileMode: false,
  enabled: false,
  data: null,
  livePoseData: null,
  mergedAnalysis: {},
  currentView: "front",
  selectedAnalysis: "head_tilt",
  showPoints: true,
  showLines: true,
  showGuides: true,
  livePoseTimer: null,
  livePoseBusy: false,
  // WEBCAM_CANDIDATE: webcam state management
  webcamStream: null,      // MediaStream object
  webcamActive: false,     // webcam is running
  webcamError: null,       // error message if failed
  // MEASURE_FLOW: measurement capture state
  measureState: {
    active: false,           // measurement in progress
    step: "idle",            // idle | wait_ready | prepare | front_hold | turn | side_hold | analyzing | result
    stableSince: null,       // timestamp when current stable pose started
    frontCapture: null,      // { imageDataUrl, landmarks, timestamp, view }
    sideCapture: null,       // { imageDataUrl, landmarks, timestamp, view }
    requestedTurn: "right",  // which side to turn to
    _retakeRequested: null,  // 'front' | 'side' | null
  },
  workflow: {
    active: false,
    step: "idle",
    stableSince: null,
    frontCapture: null,
    sideCapture: null,
    requestedTurn: "right"
  }
};

const photoEl = document.getElementById("photo");
const overlayEl = document.getElementById("overlayCanvas");
// WEBCAM_CANDIDATE: webcam video element reference
const webcamVideoEl = document.getElementById("webcamVideo");
const webcamStatusOverlay = document.getElementById("webcamStatusOverlay");
const webcamLoadingOverlay = document.getElementById("webcamLoadingOverlay");
const cameraErrorOverlay = document.getElementById("cameraErrorOverlay");
const btnRetryCamera = document.getElementById("btnRetryCamera");
const feedWindowEl = document.getElementById("feedWindow");
const btnAgent = document.getElementById("btnAgent");
const btnMeasureStart = document.getElementById("btnMeasureStart");

const currentStepText = document.getElementById("currentStepText");
const overallProgress = document.getElementById("overallProgress");

const trackingIcon = document.getElementById("trackingIcon");
const trackingText = document.getElementById("trackingText");
const badgeView = document.getElementById("badgeView");
const viewText = document.getElementById("viewText");

const levelerBox = document.getElementById("levelerBox");
const shoulderLevelText = document.getElementById("shoulderLevelText");
const shoulderLevelIndicator = document.getElementById("shoulderLevelIndicator");
const pelvisLevelText = document.getElementById("pelvisLevelText");
const pelvisLevelIndicator = document.getElementById("pelvisLevelIndicator");
const centerAlignText = document.getElementById("centerAlignText");
const centerAlignIndicator = document.getElementById("centerAlignIndicator");

const actionMessageBox = document.getElementById("actionMessageBox");
const actionMessageText = document.getElementById("actionMessageText");
const actionMessageIcon = document.getElementById("actionMessageIcon");

const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNumber = document.getElementById("countdownNumber");
const stepMask = document.getElementById("stepMask");

const guideOverlayEl = document.getElementById("guideOverlay");
const systemStatusEl = document.getElementById("systemStatus");

function logLine(line) {
  const statusEl = document.getElementById("status");
  if (!statusEl) return;
  statusEl.textContent += `\n> ${line}`;
  statusEl.scrollTop = statusEl.scrollHeight;
}

function setGuideWaiting(on) {
  if (!guideOverlayEl) return;
  guideOverlayEl.style.display = on ? "flex" : "none";
}

function setSystemStatus(text) {
  if (systemStatusEl) systemStatusEl.textContent = text;
}

function showToast(text) {
  setWorkflowMessage(text);
}

function buildAnalysisSelect() {
  const analysisSelectEl = document.getElementById("analysisSelect");
  if (!analysisSelectEl) return;
  analysisSelectEl.innerHTML = ANALYSIS_ORDER.map(key => `<option value="${key}">${DISPLAY_NAMES[key]}</option>`).join("");
  analysisSelectEl.value = state.selectedAnalysis;
}

// WEBCAM_CANDIDATE: startLiveView uses browser webcam instead of RealSense MJPEG
function startLiveView() {
  // Legacy: RealSense MJPEG stream (kept for reference, not used in webcam mode)
  // photoEl.src = `${API_BASE}/video_feed?t=${Date.now()}`;
  feedWindowEl?.classList.add("scanning-active");
  setSystemStatus("Live View");
}

// WEBCAM_CANDIDATE: stopLiveView stops webcam stream
function stopLiveView() {
  stopWebcam();
  feedWindowEl?.classList.remove("scanning-active");
  setSystemStatus("System Ready");
}

// =============================================================================
// WEBCAM_CANDIDATE: Browser webcam functions (getUserMedia)
// =============================================================================

/**
 * Initialize browser webcam via getUserMedia.
 * Shows loading state, handles permission denial, camera not found, and generic errors.
 * @returns {Promise<MediaStream|null>} MediaStream if successful, null if failed
 */
async function initWebcam() {
  // Show loading overlay
  showWebcamLoading(true);
  hideCameraError();

  try {
    // Request camera access - prefer environment-facing camera (back camera on mobile)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user", // prefer front-facing for selfie-style measurement
        frameRate: { ideal: 30 }
      },
      audio: false
    });

    state.webcamStream = stream;
    state.webcamActive = true;
    state.webcamError = null;

    // Attach stream to video element
    if (webcamVideoEl) {
      webcamVideoEl.srcObject = stream;
      webcamVideoEl.src = ""; // clear any previous src
      webcamVideoEl.style.display = "block";
      webcamVideoEl.style.display = "block";
      photoEl.style.display = "none"; // hide RealSense img
    }

    // Show webcam status badge
    showWebcamStatus(true);

    // Hide loading
    showWebcamLoading(false);

    logLine("[Webcam] Camera initialized successfully");
    return stream;

  } catch (err) {
    state.webcamStream = null;
    state.webcamActive = false;
    state.webcamError = err.name;

    // Hide loading
    showWebcamLoading(false);

    // Show error overlay
    showCameraError(err);

    logLine(`[Webcam] Error: ${err.name} - ${err.message}`);
    return null;
  }
}

/**
 * Stop the webcam stream and release camera.
 */
function stopWebcam() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach(track => track.stop());
    state.webcamStream = null;
  }
  state.webcamActive = false;

  // Detach from video element
  if (webcamVideoEl) {
    webcamVideoEl.srcObject = null;
    webcamVideoEl.style.display = "none";
  }

  // Restore photo element
  if (photoEl) {
    photoEl.style.display = "block";
  }

  // Hide webcam status
  showWebcamStatus(false);
}

// =============================================================================
// MEASURE_FLOW: Webcam-based measurement capture system
// =============================================================================

/**
 * Capture current video frame + landmarks as a data URL + landmark snapshot.
 * Uses canvas to snapshot the current video frame.
 * @param {string} view - 'front' or 'side'
 * @returns {Object} capture object with imageDataUrl, landmarks, view, timestamp
 */
// =============================================================================
// MEASURE_MODEL: Webcam-based measurement data model
//
// WebcamMeasureCapture: Single-view capture
//   - imageDataUrl  : JPEG data URL of the captured frame
//   - landmarks     : MediaPipe landmark array
//   - view          : "front" | "side"
//   - timestamp
//   - frameWidth / frameHeight
//   - poseOk        : pose detection succeeded
//   - analysis      : computed metrics from 2D landmarks
//
// WebcamMeasureReport: Full measurement result
//   - front : WebcamMeasureCapture
//   - side  : WebcamMeasureCapture
//   - postureScore  : 0-100 overall posture score
//   - analysisReady  : true when analysis is computed
//   - timestamp
// =============================================================================

/**
 * Compute posture analysis metrics directly from 2D landmarks.
 * This replaces RealSense depth-based measurements with 2D approximations.
 * Uses the same landmark names as the backend pose_engine.
 *
 * @param {Array} landmarks - MediaPipe landmark array with {name, x, y, z, visibility}
 * @param {string} view - "front" | "side"
 * @returns {Object} analysis dict keyed by metric name
 */
function computeAnalysisFromLandmarks(landmarks, view) {
  if (!landmarks || landmarks.length === 0) return {};

  // Build name→landmark lookup
  const byName = {};
  landmarks.forEach(lm => { byName[lm.name] = lm; });

  const lm = (name) => byName[name];

  const vis = (name) => {
    const l = byName[name];
    return l ? (l.visibility ?? 1.0) : 0;
  };

  const isVis = (name) => vis(name) >= 0.4;

  function angleBetween(p1, p2, p3) {
    // angle at p2 formed by p1-p2-p3
    const a = { x: float(p1?.x) - float(p2?.x), y: float(p1?.y) - float(p2?.y) };
    const b = { x: float(p3?.x) - float(p2?.x), y: float(p3?.y) - float(p2?.y) };
    const dot = a.x * b.x + a.y * b.y;
    const mag = Math.sqrt(a.x * a.x + a.y * a.y) * Math.sqrt(b.x * b.x + b.y * b.y) + 1e-9;
    return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * (180 / Math.PI);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function gradeFromDiff(diff, warnThresh, severeThresh) {
    if (diff <= warnThresh) return "normal";
    if (diff <= severeThresh) return "mild";
    return "moderate";
  }

  function confidence(landmarks) {
    const visible = landmarks.filter(l => (l.visibility ?? 1.0) >= 0.4).length;
    return Math.min(1.0, visible / 12);
  }

  const analysis = {};
  const imgW = landmarks._frameWidth || 640;
  const imgH = landmarks._frameHeight || 480;

  if (view === "front") {
    // ── head_tilt ── horizontal tilt of head (nose vs chin vertical)
    const nose = lm("nose");
    const chin = lm("nose"); // use nose as head center proxy
    const le = lm("left_ear");
    const re = lm("right_ear");
    if (nose && le && re) {
      const earMidX = (float(le.x) + float(re.x)) / 2;
      const tiltDeg = Math.abs(float(nose.x) - earMidX) / imgW * 30; // approx degrees
      analysis.head_tilt = {
        value: Math.round(tiltDeg * 10) / 10,
        unit: "°", type: "tilt", grade: gradeFromDiff(tiltDeg, 3, 8),
        confidence: confidence(landmarks), summary: `머리 기울기: 약 ${Math.round(tiltDeg)}°`,
        view: "front", enabled: true,
      };
    }

    // ── shoulder_slope ── left vs right shoulder height diff
    const ls = lm("left_shoulder");
    const rs = lm("right_shoulder");
    if (ls && rs && isVis("left_shoulder") && isVis("right_shoulder")) {
      const slopeDeg = Math.abs(float(ls.y) - float(rs.y)) / imgH * 30;
      analysis.shoulder_slope = {
        value: Math.round(slopeDeg * 10) / 10,
        unit: "°", type: "slope", grade: gradeFromDiff(slopeDeg, 3, 8),
        confidence: confidence(landmarks), summary: `어깨 기울기: 약 ${Math.round(slopeDeg)}°`,
        view: "front", enabled: true,
      };
    }

    // ── shoulder_balance ── shoulder level vs hip level combined
    const lh = lm("left_hip");
    const rh = lm("right_hip");
    if (ls && rs && lh && rh && isVis("left_hip") && isVis("right_hip")) {
      const sDiff = Math.abs(float(ls.y) - float(rs.y));
      const hDiff = Math.abs(float(lh.y) - float(rh.y));
      const combined = (sDiff + hDiff) / 2;
      analysis.shoulder_balance = {
        value: Math.round(combined / imgH * 100),
        unit: "px", type: "balance", grade: gradeFromDiff(combined, imgH * 0.05, imgH * 0.1),
        confidence: confidence(landmarks), summary: `어깨-골반的水平: ${combined < imgH * 0.05 ? "양호" : "주의"}`,
        view: "front", enabled: true,
      };
    }

    // ── pelvic_balance ── left vs right hip height diff
    if (lh && rh && isVis("left_hip") && isVis("right_hip")) {
      const pDiff = Math.abs(float(lh.y) - float(rh.y));
      analysis.pelvic_balance = {
        value: Math.round(pDiff / imgH * 100),
        unit: "px", type: "balance", grade: gradeFromDiff(pDiff, imgH * 0.04, imgH * 0.09),
        confidence: confidence(landmarks), summary: `골반 균형: ${pDiff < imgH * 0.04 ? "양호" : "주의"}`,
        view: "front", enabled: true,
      };
    }

    // ── body_center ── shoulder-hip center X deviation from frame center
    if (ls && rs && lh && rh) {
      const centerX = (float(ls.x) + float(rs.x) + float(lh.x) + float(rh.x)) / 4;
      const devPx = Math.abs(centerX - imgW / 2);
      analysis.body_center = {
        value: Math.round(devPx),
        unit: "px", type: "center", grade: gradeFromDiff(devPx, imgW * 0.05, imgW * 0.12),
        confidence: confidence(landmarks), summary: `중심선 정렬: ${devPx < imgW * 0.05 ? "양호" : "偏移"}`,
        view: "front", enabled: true,
      };
    }

    // ── knee_shape ── knee valgus/varus approximation from knee X spread
    const lk = lm("left_knee");
    const rk = lm("right_knee");
    const la = lm("left_ankle");
    const ra = lm("right_ankle");
    if (lk && rk && la && ra && isVis("left_knee") && isVis("right_knee")) {
      const kneeSpread = Math.abs(float(lk.x) - float(rk.x));
      const ankleSpread = Math.abs(float(la.x) - float(ra.x));
      const ratio = ankleSpread > 0 ? kneeSpread / ankleSpread : 1;
      analysis.knee_shape = {
        value: Math.round(ratio * 100) / 100,
        unit: "", type: "shape", grade: ratio > 1.15 ? "mild" : ratio < 0.85 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: ratio > 1.15 ? "약간 O자 형태" : ratio < 0.85 ? "약간 X자 형태" : "양호",
        view: "front", enabled: true,
      };
    }

    // ── xo_leg ── front knee-knee-ankle angle as proxy for X/O leg
    if (lk && rk && la && ra) {
      const lAngle = angleBetween(la, lk, { x: float(lk.x) + 50, y: float(lk.y) });
      const rAngle = angleBetween(ra, rk, { x: float(rk.x) - 50, y: float(rk.y) });
      const avgAngle = (lAngle + rAngle) / 2;
      analysis.xo_leg = {
        value: Math.round(avgAngle * 10) / 10,
        unit: "°", type: "angle", grade: avgAngle < 160 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: avgAngle < 150 ? "X자倾向" : "양호",
        view: "front", enabled: true,
      };
    }

    // ── lower_body_symmetry ── left vs right side length comparison
    if (lk && lh && isVis("left_knee") && isVis("left_hip")) {
      const leftLeg = Math.sqrt((float(lk.x) - float(lh.x)) ** 2 + (float(lk.y) - float(lh.y)) ** 2);
      const rightLeg = lm("right_knee") && lm("right_hip")
        ? Math.sqrt((float(lm("right_knee").x) - float(lm("right_hip").x)) ** 2 + (float(lm("right_knee").y) - float(lm("right_hip").y)) ** 2)
        : leftLeg;
      const sym = 1 - Math.abs(leftLeg - rightLeg) / (Math.max(leftLeg, rightLeg) + 1e-9);
      analysis.lower_body_symmetry = {
        value: Math.round(sym * 100),
        unit: "%", type: "symmetry", grade: sym > 0.9 ? "normal" : sym > 0.8 ? "mild" : "moderate",
        confidence: confidence(landmarks), summary: `하체 대칭성: ${Math.round(sym * 100)}%`,
        view: "front", enabled: true,
      };
    }

    // ── waist_shape ── waist width vs hip width ratio
    if (ls && rs && lh && rh) {
      const waistW = Math.abs(float(ls.x) - float(rs.x));
      const hipW = Math.abs(float(lh.x) - float(rh.x));
      const ratio = hipW > 0 ? waistW / hipW : 1;
      analysis.waist_shape = {
        value: Math.round(ratio * 100) / 100,
        unit: "", type: "ratio", grade: ratio < 0.7 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: `허리-골반 비율: ${Math.round(ratio * 100)}%`,
        view: "front", enabled: true,
      };
    }

    // ── calf_shape ── calf width vs ankle width
    const lca = lm("left_ankle");
    const rca = lm("right_ankle");
    if (lk && lca && isVis("left_ankle")) {
      const calfW = Math.abs(float(lk.x) - float(lm("right_knee")?.x || 0));
      const ankleW = Math.abs(float(lca.x) - float(rca?.x || 0));
      const ratio = ankleW > 0 ? calfW / ankleW : 1;
      analysis.calf_shape = {
        value: Math.round(ratio * 100) / 100,
        unit: "", type: "ratio", grade: ratio > 1.5 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: ratio > 1.5 ? "종아리 발달 주의" : "양호",
        view: "front", enabled: true,
      };
    }

  } else if (view === "side") {
    // ── head_neck_shape ── forward head posture: ear vs shoulder X deviation
    const nose = lm("nose");
    const shoulder = lm("right_shoulder");
    if (nose && shoulder && isVis("right_shoulder")) {
      const fwdPx = Math.abs(float(nose.x) - float(shoulder.x));
      analysis.head_neck_shape = {
        value: Math.round(fwdPx / imgW * 100),
        unit: "px", type: "forward_head", grade: fwdPx > imgW * 0.15 ? "moderate" : fwdPx > imgW * 0.08 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: fwdPx > imgW * 0.15 ? "전방머리 자세" : "양호",
        view: "side", enabled: true,
      };
    }

    // ── cervical_alignment ── neck alignment from ear-shoulder horizontal offset
    const le = lm("left_ear");
    const rs2 = lm("right_shoulder");
    if (le && rs2) {
      const cervDeg = Math.abs(float(le.x) - float(rs2.x)) / imgW * 20;
      analysis.cervical_alignment = {
        value: Math.round(cervDeg * 10) / 10,
        unit: "°", type: "alignment", grade: cervDeg > 10 ? "moderate" : cervDeg > 5 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: cervDeg > 10 ? "경추 부정렬 주의" : "양호",
        view: "side", enabled: true,
      };
    }

    // ── shoulder_back_shape ── shoulder protraction: shoulder X vs hip X
    if (rs2 && lm("right_hip")) {
      const protraction = float(rs2.x) - float(lm("right_hip").x);
      analysis.shoulder_back_shape = {
        value: Math.round(protraction / imgW * 100),
        unit: "px", type: "protraction", grade: protraction > imgW * 0.1 ? "moderate" : protraction > imgW * 0.05 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: protraction > 0 ? "어깨 전굴" : "양호",
        view: "side", enabled: true,
      };
    }

    // ── back_shape ── spinal curvature proxy: shoulder-hip center deviation from vertical
    const lsS = lm("left_shoulder");
    const lhS = lm("left_hip");
    if (lsS && lhS) {
      const curvePx = Math.abs(float(lsS.x) - float(lhS.x));
      analysis.back_shape = {
        value: Math.round(curvePx),
        unit: "px", type: "curvature", grade: curvePx > imgW * 0.08 ? "moderate" : curvePx > imgW * 0.04 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: curvePx < imgW * 0.04 ? "양호" : "등_curve 주의",
        view: "side", enabled: true,
      };
    }

    // ── lumbar_curve ── lumbar flexion angle from hip-knee-ankle
    const rkS = lm("right_knee");
    const raS = lm("right_ankle");
    if (lm("right_hip") && rkS && raS) {
      const lumbarAngle = angleBetween(lm("right_hip"), rkS, raS);
      analysis.lumbar_curve = {
        value: Math.round(lumbarAngle * 10) / 10,
        unit: "°", type: "angle", grade: lumbarAngle < 140 ? "moderate" : lumbarAngle < 160 ? "mild" : "normal",
        confidence: confidence(landmarks), summary: lumbarAngle < 140 ? "요추 굽힘 주의" : "양호",
        view: "side", enabled: true,
      };
    }

    // ── pelvic_shape ── pelvic tilt from hip-shoulder vertical alignment
    if (rs2 && lm("right_hip")) {
      const tiltPx = float(rs2.y) - float(lm("right_hip").y);
      analysis.pelvic_shape = {
        value: Math.round(tiltPx / imgH * 100),
        unit: "px", type: "tilt", grade: Math.abs(tiltPx) > imgH * 0.08 ? "moderate" : "normal",
        confidence: confidence(landmarks), summary: tiltPx > 0 ? "골반 전굴" : "양호",
        view: "side", enabled: true,
      };
    }
  }

  return analysis;
}

/**
 * Compute overall posture score (0-100) from analysis metrics.
 * @param {Object} merged - merged analysis dict
 * @returns {number}
 */
function computePostureScore(merged) {
  if (!merged || Object.keys(merged).length === 0) return 0;
  let deductions = 0;
  Object.values(merged).forEach(item => {
    if (!item || !item.grade) return;
    const g = String(item.grade).toLowerCase();
    if (g === "moderate" || g === "severe") deductions += 10;
    else if (g === "mild" || g === "warning") deductions += 5;
  });
  return Math.max(0, 100 - deductions);
}

function captureCurrentFrame(view) {
  if (!webcamVideoEl) return null;

  try {
    // Snapshot the video frame to a canvas
    const canvas = document.createElement("canvas");
    canvas.width = webcamVideoEl.videoWidth || 640;
    canvas.height = webcamVideoEl.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(webcamVideoEl, 0, 0);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.92);

    // Deep clone current landmarks and attach frame dimensions
    const landmarks = state.livePoseData
      ? JSON.parse(JSON.stringify(state.livePoseData.pose?.landmarks || []))
      : [];
    landmarks._frameWidth = canvas.width;
    landmarks._frameHeight = canvas.height;

    const poseOk = !!(state.livePoseData?.pose?.detected);

    // MEASURE_MODEL: compute analysis from 2D landmarks immediately on capture
    const analysis = poseOk ? computeAnalysisFromLandmarks(landmarks, view) : {};

    const capture = {
      imageDataUrl,
      landmarks,
      view,
      timestamp: new Date().toISOString(),
      frameWidth: canvas.width,
      frameHeight: canvas.height,
      poseOk,
      // MEASURE_MODEL: include analysis and quality in capture for result screens
      analysis, // dict keyed by metric name
      quality: {
        capture_ok: poseOk,
        pose_ok: poseOk,
        body_in_frame: landmarks.length >= 12,
        confidence: poseOk ? 0.85 : 0,
        missing_points: [],
      },
      view_detection: detectViewTypeFromLandmarks(landmarks),
    };

    logLine(`[Capture] ${view} captured (${landmarks.length} landmarks, ${Object.keys(analysis).length} metrics)`);
    return capture;
  } catch (err) {
    logLine(`[Capture] Error: ${err.message}`);
    return null;
  }
}

/**
 * Detect view type (front / left_side / right_side) from landmarks alone.
 * Mirrors pose_engine.detect_view_type in the browser.
 * @param {Array} landmarks - pose landmark array
 * @returns {{ view: string, confidence: number, reason: string }}
 */
function detectViewTypeFromLandmarks(landmarks) {
  const byName = {};
  landmarks.forEach(lm => { byName[lm.name] = lm; });

  const ls = byName.left_shoulder;
  const rs = byName.right_shoulder;
  const lh = byName.left_hip;
  const rh = byName.right_hip;

  if (!ls || !rs || !lh || !rh) {
    return { view: "unknown", confidence: 0.2, reason: "required torso landmarks missing" };
  }

  const shoulderDx = Math.abs(float(ls.x) - float(rs.x));
  const hipDx = Math.abs(float(lh.x) - float(rh.x));

  // front: both shoulder and hip width are large
  if (shoulderDx >= 90 && hipDx >= 70) {
    return { view: "front", confidence: 0.92, reason: `front sdx=${shoulderDx.toFixed(1)}, hdx=${hipDx.toFixed(1)}` };
  }

  // side: both shoulder and hip width are narrow
  if (shoulderDx <= 55 && hipDx <= 45) {
    // Determine left vs right side by ear visibility
    const le = byName.left_ear;
    const re = byName.right_ear;
    const lv = le ? float(le.visibility || 0) : 0;
    const rv = re ? float(re.visibility || 0) : 0;
    const side = lv > rv + 0.15 ? "left_side" : "right_side";
    return { view: side, confidence: 0.82, reason: `side sdx=${shoulderDx.toFixed(1)}, hdx=${hipDx.toFixed(1)}` };
  }

  return { view: "unknown", confidence: 0.5, reason: `ambiguous sdx=${shoulderDx.toFixed(1)}, hdx=${hipDx.toFixed(1)}` };
}

function float(v) { return Number(v) || 0; }

/**
 * Start the measurement workflow.
 * Called when user clicks "측정 시작".
 */
function startMeasureWorkflow() {
  const ms = state.measureState;
  if (ms.active) return;

  // Reset capture state
  state.measureState = {
    active: true,
    step: "wait_ready",
    stableSince: Date.now(),
    frontCapture: null,
    sideCapture: null,
    requestedTurn: "right",
    _retakeRequested: null,
  };

  // Also reset legacy workflow state to stay compatible
  state.workflow.active = true;
  state.workflow.step = "wait_ready";
  state.workflow.stableSince = Date.now();

  updateMeasureUi("wait_ready");
  logLine("[Measure] Workflow started");
}

/**
 * Stop the measurement workflow and reset all captures.
 */
function stopMeasureWorkflow(clearCaptures = true) {
  const ms = state.measureState;
  ms.active = false;
  ms.step = "idle";
  ms.stableSince = null;
  if (clearCaptures) {
    ms.frontCapture = null;
    ms.sideCapture = null;
  }
  state.workflow.active = false;
  state.workflow.step = "idle";
  updateMeasureUi("idle");
  logLine("[Measure] Workflow stopped");
}

/**
 * Retake a captured view.
 * @param {'front'|'side'} view
 */
function retakeCapture(view) {
  const ms = state.measureState;
  if (view === "front") {
    ms.frontCapture = null;
    ms.step = "turn"; // go back to turn prompt (user needs to re-pose)
    ms._retakeRequested = "front";
    logLine("[Measure] Retake requested for front");
  } else if (view === "side") {
    ms.sideCapture = null;
    // Stay at side_hold, just clear the capture
    ms._retakeRequested = "side";
    logLine("[Measure] Retake requested for side");
  }

  // Reset stable timer so countdown restarts
  ms.stableSince = Date.now();
  updateMeasureUi(ms.step);

  // Hide completion modal if shown
  const modal = document.getElementById("completionModal");
  if (modal) modal.classList.add("hidden");
}

/**
 * Advance the measurement step to front capture.
 */
function advanceToFrontCapture() {
  const ms = state.measureState;
  const capture = captureCurrentFrame("front");
  if (!capture) return;
  ms.frontCapture = capture;
  logLine(`[Measure] Front captured`);
}

/**
 * Advance the measurement step to side capture.
 */
function advanceToSideCapture() {
  const ms = state.measureState;
  const capture = captureCurrentFrame("side");
  if (!capture) return;
  ms.sideCapture = capture;
  logLine(`[Measure] Side captured`);
}

/**
 * Check if both captures are ready.
 */
function isMeasureReady() {
  const ms = state.measureState;
  return ms.frontCapture && ms.sideCapture;
}

/**
 * Build a complete measure report from captured frames.
 * Data shape is compatible with existing results screens (localStorage bodyCheckReport).
 */
function buildMeasureReport() {
  const ms = state.measureState;
  const front = ms.frontCapture;
  const side = ms.sideCapture;

  if (!front || !side) return null;

  // Merge front and side analyses into a single dict keyed by metric name
  const mergedAnalysis = {};
  if (front.analysis) {
    Object.entries(front.analysis).forEach(([key, val]) => {
      mergedAnalysis[key] = { ...val, view: val.view || "front" };
    });
  }
  if (side.analysis) {
    Object.entries(side.analysis).forEach(([key, val]) => {
      mergedAnalysis[key] = { ...val, view: val.view || "side" };
    });
  }

  const postureScore = computePostureScore(mergedAnalysis);

  return {
    front,
    side,
    frontImage: front.imageDataUrl,
    sideImage: side.imageDataUrl,
    frontLandmarks: front.landmarks,
    sideLandmarks: side.landmarks,
    headTilt: front.analysis?.head_tilt?.value ?? null,
    shoulderTilt: front.analysis?.shoulder_slope?.value ?? null,
    pelvicTilt: side.analysis?.pelvic_shape?.value ?? null,
    postureScore,
    analysisReady: true,
    mergedAnalysis,
    timestamp: new Date().toISOString(),
    view: {
      front: detectViewTypeFromLandmarks(front.landmarks),
      side: detectViewTypeFromLandmarks(side.landmarks),
    }
  };
}

/**
 * Update UI to reflect current measurement step.
 * Manages guide overlay, step text, and retake buttons.
 */
function updateMeasureUi(step) {
  const ms = state.measureState;

  const guideTexts = {
    idle:      { title: "에이전트 연결 대기 중", desc: "좌측 상단의 에이전트 켜기 버튼을 눌러주세요.", icon: "fa-robot" },
    wait_ready:{ title: "준비하세요", desc: "카메라 앞에 서서全身가 보이도록 하세요.", icon: "fa-person" },
    prepare:   { title: "정면 측정 준비", desc: "정면을 바라보며 어깨를 자연스럽게 내려주세요.", icon: "fa-person" },
    front_hold:{ title: "정면 촬영 중", desc: "자세를 유지하세요...", icon: "fa-camera" },
    turn:      { title: "측면으로 전환", desc: "우측면이 카메라를 향하도록 천천히 돌아주세요.", icon: "fa-rotate-right" },
    side_hold: { title: "측면 촬영 중", desc: "자세를 유지하세요...", icon: "fa-camera" },
    analyzing: { title: "결과 분석 중", desc: "데이터를 처리하고 있습니다...", icon: "fa-spinner fa-spin" },
    result:    { title: "측정 완료", desc: "결과를 확인하세요.", icon: "fa-clipboard-check" },
  };

  // Update guide overlay
  const guideTitleEl = document.getElementById("guideTitle");
  const guideDescEl = document.getElementById("guideDesc");
  const guideIconEl = document.getElementById("guideIcon");
  const guideOverlayEl = document.getElementById("guideOverlay");

  const info = guideTexts[step] || guideTexts.idle;
  if (guideTitleEl) guideTitleEl.textContent = info.title;
  if (guideDescEl) guideDescEl.textContent = info.desc;
  if (guideIconEl) guideIconEl.className = `fa-solid ${info.icon}`;

  // Show/hide guide overlay based on step
  const showGuide = ["idle", "wait_ready", "prepare", "front_hold", "turn", "side_hold", "analyzing", "result"].includes(step);
  if (guideOverlayEl) {
    guideOverlayEl.style.display = showGuide ? "flex" : "none";
    guideOverlayEl.style.background = step === "result"
      ? "rgba(0,100,0,0.5)"
      : "rgba(0,0,0,0.6)";
  }

  // Update step text in top bar
  const stepTextMap = {
    idle: "대기",
    wait_ready: "준비하세요...",
    prepare: "Step 1: 정면 측정 준비",
    front_hold: "Step 1: 정면 측정 중",
    turn: "Step 2: 측면 전환",
    side_hold: "Step 2: 측면 측정 중",
    analyzing: "Step 3: 결과 분석 중...",
    result: "분석 완료"
  };
  if (currentStepText) currentStepText.textContent = stepTextMap[step] || step;

  // Show/hide retake buttons
  const btnRetakeFront = document.getElementById("btnRetakeFront");
  const btnRetakeSide = document.getElementById("btnRetakeSide");
  const retakeArea = document.getElementById("retakeArea");

  if (retakeArea) {
    retakeArea.style.display = (ms.frontCapture || ms.sideCapture) ? "flex" : "none";
  }

  // Update retake button visibility
  if (btnRetakeFront) {
    btnRetakeFront.style.display = ms.frontCapture ? "inline-flex" : "none";
  }
  if (btnRetakeSide) {
    btnRetakeSide.style.display = ms.sideCapture ? "inline-flex" : "none";
  }

  // Show completion state if both captured
  if (isMeasureReady()) {
    logLine("[Measure] Both captures ready - report can be built");
  }
}

/**
 * Show or hide the webcam loading overlay.
 */
function showWebcamLoading(show) {
  if (webcamLoadingOverlay) {
    webcamLoadingOverlay.style.display = show ? "flex" : "none";
  }
}

/**
 * Show or hide the webcam status badge.
 */
function showWebcamStatus(show) {
  if (webcamStatusOverlay) {
    webcamStatusOverlay.style.display = show ? "flex" : "none";
  }
}

/**
 * Show camera error overlay with appropriate message.
 * @param {DOMException|Error} err
 */
function showCameraError(err) {
  if (!cameraErrorOverlay) return;

  const errorTitleEl = document.getElementById("cameraErrorTitle");
  const errorDescEl = document.getElementById("cameraErrorDesc");
  const errorIconEl = document.getElementById("cameraErrorIcon");

  let title = "카메라 접근 실패";
  let desc = "브라우저 카메라에 접근할 수 없습니다. 카메라 권한을 허용해주세요.";
  let icon = "fa-video-slash";

  switch (err.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      title = "카메라 권한 거부";
      desc = "브라우저 설정에서 카메라 권한을 허용해주세요.\nHTTPS 환경에서만 카메라를 사용할 수 있습니다.";
      icon = "fa-lock";
      break;
    case "NotFoundError":
    case "DevicesNotFoundError":
      title = "카메라를 찾을 수 없음";
      desc = "장치에 카메라가 없거나 연결되지 않았습니다.\n웹캠이 제대로 연결되어 있는지 확인해주세요.";
      icon = "fa-camera";
      break;
    case "NotReadableError":
    case "TrackStartError":
      title = "카메라 사용 중";
      desc = "카메라가 다른 앱에서 사용 중입니다.\n다른 프로그램에서 카메라를 해제하고 다시 시도해주세요.";
      icon = "fa-user-slash";
      break;
    case "OverconstrainedError":
      title = "카메라 설정 오류";
      desc = "요청한 카메라 해상도를 지원하지 않습니다.\n다시 시도해주세요.";
      icon = "fa-gear";
      break;
    default:
      title = "카메라 오류";
      desc = err.message || "알 수 없는 오류가 발생했습니다.";
      icon = "fa-triangle-exclamation";
  }

  if (errorTitleEl) errorTitleEl.textContent = title;
  if (errorDescEl) errorDescEl.textContent = desc;
  if (errorIconEl) errorIconEl.className = `fa-solid ${icon}`;

  cameraErrorOverlay.style.display = "flex";
}

/**
 * Hide camera error overlay.
 */
function hideCameraError() {
  if (cameraErrorOverlay) {
    cameraErrorOverlay.style.display = "none";
  }
}

/**
 * Retry webcam initialization.
 */
async function retryWebcam() {
  hideCameraError();
  await initWebcam();
}

// =============================================================================
// WEBCAM_POSE: Browser-based MediaPipe Pose Landmark detection
// =============================================================================

/**
 * MediaPipe PoseLandmarker name → our canonical landmark name mapping.
 * Matches LANDMARK_NAMES in pose_engine.py.
 */
const POSE_LANDMARK_NAME_MAP = {
  0:  "nose",
  11: "left_shoulder",
  12: "right_shoulder",
  13: "left_elbow",
  14: "right_elbow",
  15: "left_wrist",
  16: "right_wrist",
  23: "left_hip",
  24: "right_hip",
  25: "left_knee",
  26: "right_knee",
  27: "left_ankle",
  28: "right_ankle",
  31: "left_foot_index",
  32: "right_foot_index",
};

/**
 * Connections as [from_index, to_index] pairs for drawing skeleton lines.
 * Matches POSE_CONNECTIONS in pose_engine.py.
 */
const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28]
];

/**
 * WebcamPoseDetector: browser-based MediaPipe PoseLandmarker wrapper.
 * Detects pose from webcam video frames and feeds data into the existing
 * state.livePoseData pipeline so all existing render functions work unchanged.
 */
class WebcamPoseDetector {
  constructor() {
    this.landmarker = null;
    this.running = false;
    this.animationId = null;
    this.lastTimestamp = 0;
    this.detectIntervalMs = 100; // ~10 FPS for pose detection (lighter than every frame)
    this._lastDetectTime = 0;
    this._loadingPromise = null;
  }

  /**
   * Load MediaPipe model and create PoseLandmarker instance.
   * Called once when agent starts.
   * @returns {Promise<void>}
   */
  async load() {
    if (this.landmarker) return;
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = (async () => {
      try {
        logLine("[WebcamPose] Loading MediaPipe model...");

        const { PoseLandmarker, FilesetResolver } = window.VisionTasksVision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
        );

        this.landmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose/pose_landmarker/lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU" // GPU preferred, falls back to CPU automatically
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minPosePresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });

        logLine("[WebcamPose] MediaPipe model loaded successfully");
      } catch (err) {
        logLine(`[WebcamPose] Model load failed: ${err.message}`);
        this.landmarker = null;
        throw err;
      } finally {
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
  }

  /**
   * Start pose detection loop.
   * @param {HTMLVideoElement} videoEl - webcam video element
   */
  start(videoEl) {
    if (!this.landmarker) {
      logLine("[WebcamPose] Cannot start: model not loaded");
      return;
    }
    if (this.running) return;

    this.running = true;
    this.videoEl = videoEl;
    this._detectLoop();
  }

  /**
   * Stop pose detection loop.
   */
  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Internal detection loop using requestAnimationFrame.
   * Respects detectIntervalMs to limit detection frequency.
   */
  _detectLoop() {
    if (!this.running || !this.videoEl) return;

    this.animationId = requestAnimationFrame((timestamp) => {
      if (!this.running) return;

      const elapsed = timestamp - this._lastDetectTime;
      if (elapsed >= this.detectIntervalMs) {
        this._lastDetectTime = timestamp;
        this._detect();
      }

      // Always sync canvas each frame for smooth overlay
      this._syncAndRender();

      this._detectLoop();
    });
  }

  /**
   * Run pose detection on current video frame.
   */
  _detect() {
    if (!this.landmarker || !this.videoEl) return;
    if (this.videoEl.readyState < 2) return; // wait for video to have frames

    try {
      const timestampMs = performance.now();
      const result = this.landmarker.detectForVideo(this.videoEl, timestampMs);

      if (result && result.poseLandmarks && result.poseLandmarks.length > 0) {
        const poseData = this._buildPoseData(result.poseLandmarks[0]);
        state.livePoseData = poseData;
      } else {
        // No pose detected - keep last frame or set detected=false
        if (state.livePoseData) {
          state.livePoseData.pose = { ...state.livePoseData.pose, detected: false };
        }
      }
    } catch (err) {
      // Silent fail on detection errors to keep loop running
      console.warn("[WebcamPose] detect error:", err.message);
    }
  }

  /**
   * Build poseData object compatible with existing render functions.
   * @param {Array<Object>} landmarks - MediaPipe landmark array
   * @returns {Object}
   */
  _buildPoseData(landmarks) {
    const w = this.videoEl.videoWidth || 640;
    const h = this.videoEl.videoHeight || 480;

    const mapped = landmarks.map((lm, idx) => ({
      name: POSE_LANDMARK_NAME_MAP[idx] || `lm_${idx}`,
      index: idx,
      x: lm.x * w,
      y: lm.y * h,
      z: lm.z || 0,
      visibility: lm.visibility ?? 1.0,
      presence: lm.presence ?? 1.0,
    }));

    const detected = mapped.some(lm => lm.visibility >= 0.4 && lm.presence >= 0.4);

    // MEASURE_FLOW: compute view_detection client-side for workflow stability checks
    const viewInfo = detectViewTypeFromLandmarks(mapped);

    return {
      ok: detected,
      frame: { width: w, height: h },
      pose: {
        detected,
        landmarks: mapped,
        connections: POSE_CONNECTIONS,
      },
      view_detection: viewInfo,
    };
  }

  /**
   * Sync canvas size and trigger all render functions.
   * Called every animation frame for smooth UI even between detections.
   */
  _syncAndRender() {
    if (!state.enabled) return;
    try {
      syncCanvas();
      renderPills();
      renderLeveler();
      renderOverlay();
      tickWorkflow();
    } catch (err) {
      console.warn("[WebcamPose] render error:", err.message);
    }
  }
}

/** Singleton instance of WebcamPoseDetector */
const poseDetector = new WebcamPoseDetector();

/**
 * Start browser-based pose detection on the active webcam stream.
 */
async function startPoseDetection() {
  if (!webcamVideoEl) return;
  try {
    await poseDetector.load();
    if (poseDetector.landmarker) {
      poseDetector.start(webcamVideoEl);
      logLine("[WebcamPose] Pose detection started");
    }
  } catch (err) {
    logLine(`[WebcamPose] Start failed: ${err.message}`);
  }
}

/**
 * Stop browser-based pose detection.
 */
function stopPoseDetection() {
  poseDetector.stop();
  logLine("[WebcamPose] Pose detection stopped");
}

// WEBCAM_MEASURE: RealSense /api/body/live polling removed —
// MediaPipe pose detection runs entirely in-browser. No polling interval needed.
function stopLivePosePolling() {
  // no-op: RealSense polling timer is gone; kept so callers don't ReferenceError
  if (state.livePoseTimer) {
    clearInterval(state.livePoseTimer);
    state.livePoseTimer = null;
  }
}

// WEBCAM_MEASURE: reads from localStorage (bodyCheckReport) — no server needed
async function loadLatest() {
  const saved = Api.loadMeasurementFromLocal();
  if (saved?.mergedAnalysis) {
    state.workflow._mergedAnalysis = saved.mergedAnalysis;
    logLine('[health-check] loadLatest: merged analysis loaded from localStorage');
  } else {
    logLine('[health-check] loadLatest: no saved measurement found');
  }
}

// WEBCAM_MEASURE: reads from localStorage — no server needed
async function loadLatestForMobile() {
  const saved = Api.loadMeasurementFromLocal();
  if (saved) {
    state.workflow._mergedAnalysis = saved.mergedAnalysis || {};
    logLine('[health-check] mobile: latest report loaded from localStorage');
    setWorkflowMessage("최근 측정 결과를 불러왔습니다.", "", "fa-chart-line");
  } else {
    logLine('[health-check] mobile: no saved measurement found');
    setWorkflowMessage("최근 측정 결과를 찾을 수 없습니다.", "", "fa-circle-info");
  }
}

function initMergedAnalysis() {
  state.mergedAnalysis = {};
  ANALYSIS_ORDER.forEach(key => {
    state.mergedAnalysis[key] = {
      enabled: false,
      view: "unknown",
      value: null,
      unit: null,
      type: "unknown",
      grade: "unknown",
      confidence: 0,
      summary: window.translations?.[localStorage.getItem('appLang') || 'en']?.hc_unknown_view || "아직 측정되지 않았습니다."
    };
  });
}

async function applyData(data, view = "front") {
  state.data = data;
  state.currentView = view;

  if (!state.mergedAnalysis || !Object.keys(state.mergedAnalysis).length) {
    initMergedAnalysis();
  }

  if (data && data.analysis) {
    Object.keys(data.analysis).forEach(k => {
      const incoming = data.analysis[k];
      const current = state.mergedAnalysis[k];

      if (!incoming) return;

      // 새 값이 실제 계산 결과면 무조건 반영
      if (incoming.enabled === true) {
        state.mergedAnalysis[k] = incoming;
        return;
      }

      // 기존 값이 없으면 disabled라도 저장
      if (!current) {
        state.mergedAnalysis[k] = incoming;
        return;
      }

      // 기존 값도 disabled면 새 값으로 갱신
      if (current.enabled !== true) {
        state.mergedAnalysis[k] = incoming;
        return;
      }

      // 기존 값이 enabled이고, 새 값이 disabled면 덮어쓰지 않음
    });
  }

  logLine(`applyData via ${view}: mergedAnalysis contains ${Object.keys(state.mergedAnalysis).length} keys`);
  console.log("incoming analysis", view, data?.analysis);
  console.log("mergedAnalysis after merge", state.mergedAnalysis);

  renderPills();
  renderAnalysisList();
  renderMiniValues();
  syncCanvas();
  renderOverlay();
}

function syncCanvas() {
  if (!overlayEl || !feedWindowEl) return;
  const rect = feedWindowEl.getBoundingClientRect();
  overlayEl.width = Math.round(rect.width);
  overlayEl.height = Math.round(rect.height);
}

function clearOverlay() {
  const ctx = overlayEl?.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);
}

function getContainFit(imgW, imgH, boxW, boxH) {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = (boxW - drawW) / 2;
  const offsetY = 0;
  return { scale, drawW, drawH, offsetX, offsetY };
}

function mapPoint(x, y, fit) {
  return { x: fit.offsetX + x * fit.scale, y: fit.offsetY + y * fit.scale };
}

function isVisible(lm) {
  const v = lm?.visibility ?? 1.0;
  const p = lm?.presence ?? 1.0;
  return v >= 0.4 && p >= 0.4;
}

function renderOverlay() {
  const ctx = overlayEl?.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);

  const poseData = state.livePoseData || state.data;
  if (!poseData?.frame?.width || !poseData?.frame?.height) return;

  const fit = getContainFit(poseData.frame.width, poseData.frame.height, overlayEl.width, overlayEl.height);
  drawWorkflowGuide(ctx, fit);
  if (state.showLines) drawPoseLines(ctx, poseData, fit);
  if (state.showPoints) drawPosePoints(ctx, poseData, fit);
  if (state.showGuides && state.data) drawGuides(ctx, state.data, fit);
}

function drawWorkflowGuide(ctx, fit) {
  const step = state.workflow.step;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";

  if (step === "prepare" || step === "front_hold") {
    const marginX = fit.drawW * 0.22;
    const top = fit.offsetY + fit.drawH * 0.1;
    const bottom = fit.offsetY + fit.drawH * 0.92;
    const left = fit.offsetX + marginX;
    const right = fit.offsetX + fit.drawW - marginX;
    ctx.strokeRect(left, top, right - left, bottom - top);
  }

  if (step === "turn") {
    const cx = fit.offsetX + fit.drawW * 0.5;
    const cy = fit.offsetY + fit.drawH * 0.35;
    const r = Math.min(fit.drawW, fit.drawH) * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.1, Math.PI * 1.55, false);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(56,189,248,0.95)";
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.95, cy + r * 0.3);
    ctx.lineTo(cx + r * 1.35, cy + r * 0.2);
    ctx.lineTo(cx + r * 1.08, cy - r * 0.12);
    ctx.closePath();
    ctx.fill();
  }

  if (step === "side_hold") {
    const x = fit.offsetX + fit.drawW * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, fit.offsetY + fit.drawH * 0.08);
    ctx.lineTo(x, fit.offsetY + fit.drawH * 0.92);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPoseLines(ctx, data, fit) {
  const landmarks = data.pose?.landmarks || [];
  const connections = data.pose?.connections || [];
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,255,140,0.88)";
  ctx.setLineDash([]);
  for (const [a, b] of connections) {
    const p1 = landmarks.find(l => l.index === a);
    const p2 = landmarks.find(l => l.index === b);
    if (!p1 || !p2 || !isVisible(p1) || !isVisible(p2)) continue;
    const c1 = mapPoint(p1.x, p1.y, fit);
    const c2 = mapPoint(p2.x, p2.y, fit);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();
  }
}

function drawPosePoints(ctx, data, fit) {
  const landmarks = data.pose?.landmarks || [];
  for (const lm of landmarks) {
    if (!isVisible(lm)) continue;
    const p = mapPoint(lm.x, lm.y, fit);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 80, 80, 0.96)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.stroke();
  }
}

function drawGuides(ctx, data, fit) {
  const guides = data.guides || {};
  const guideModeEl = document.getElementById("guideMode");
  const mode = guideModeEl?.value || "all";
  const selectedKey = state.selectedAnalysis;
  let items = [];
  if (mode === "all") items = [...(guides.all || []), ...(guides[selectedKey] || [])];
  else if (mode === "selected") items = guides[selectedKey] || [];
  for (const guide of items) drawGuideItem(ctx, guide, fit);
}

function drawGuideItem(ctx, guide, fit) {
  // All guide lines (including red dashed) are hidden
  return;
}

function renderPills() {
  const src = state.livePoseData || state.data || {};
  const p = src.pose || {};
  const frame = src.frame || {};
  const detected = p.detected || false;

  const badgeTracking = document.getElementById("badgeTracking");
  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  if (trackingIcon && trackingText && btnMeasureStart && badgeTracking) {
    if (!state.enabled) {
      trackingIcon.className = "fa-solid fa-user-slash";
      trackingText.textContent = t.hc_track_off || "Tracking 비활성";
      badgeTracking.style.borderColor = "rgba(255,255,255,0.1)";
      badgeTracking.style.background = "rgba(255,255,255,0.05)";
      btnMeasureStart.style.display = "none";
      state._lastDetected = false;
    } else {
      btnMeasureStart.style.display = "flex";
      if (detected) {
        trackingIcon.className = "fa-solid fa-user-check";
        trackingText.textContent = t.hc_track_ok || "Tracking OK";
        badgeTracking.style.borderColor = "rgba(34, 197, 94, 0.35)";
        badgeTracking.style.background = "rgba(34, 197, 94, 0.12)";
        state._lastDetected = true;
      } else {
        const modal = document.getElementById("completionModal");
        const isModalShowing = modal && !modal.classList.contains("hidden");
        if (state._lastDetected && window.AudioManager && !isModalShowing) {
          window.AudioManager.playVoice('sys_track_lost');
        }
        state._lastDetected = false;
        trackingIcon.className = "fa-solid fa-spinner fa-spin";
        trackingText.textContent = t.hc_track_waiting || "대기 중";
        badgeTracking.style.borderColor = "rgba(245, 158, 11, 0.35)";
        badgeTracking.style.background = "rgba(245, 158, 11, 0.12)";
      }
    }
  }

  if (viewText) {
    const v = frame.view || src.view_detection?.view || state.currentView;
    const vKey = `posture_${v}`;
    const vLabel = t[vKey] || t[`hc_${v}`] || v;
    viewText.textContent = vLabel;
  }
}

function renderLeveler() {
  if (!levelerBox || !state.workflow.active || state.workflow.step === "idle" || state.workflow.step === "result" || state.workflow.step === "analyzing") {
    if (levelerBox) levelerBox.style.display = "none";
    return;
  }

  const src = state.livePoseData;
  if (!src || !src.ok || !src.pose?.detected) {
    levelerBox.style.display = "none";
    return;
  }

  levelerBox.style.display = "block";

  const by = getByName(src);
  const ls = by.left_shoulder;
  const rs = by.right_shoulder;
  const lh = by.left_hip;
  const rh = by.right_hip;

  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  if (ls && rs && isVisible(ls) && isVisible(rs)) {
    const sDiff = Math.abs(ls.y - rs.y);
    let sColor = "#4ade80", sLabelKey = "hc_level_normal";
    if (sDiff > 32) { sColor = "#f87171"; sLabelKey = "hc_level_warn"; }
    else if (sDiff > 16) { sColor = "#facc15"; sLabelKey = "hc_level_caution"; }

    shoulderLevelText.style.color = sColor;
    shoulderLevelText.textContent = t[sLabelKey] || "Normal";
    shoulderLevelIndicator.style.background = sColor;
    shoulderLevelIndicator.style.boxShadow = `0 0 8px ${sColor}`;
    const dir = ls.y > rs.y ? 1 : -1;
    const offset = (Math.min(sDiff, 40) / 40) * 40 * dir;
    shoulderLevelIndicator.style.left = `calc(50% + ${offset}%)`;
  } else {
    shoulderLevelText.style.color = "#94a3b8";
    shoulderLevelText.textContent = "--";
    shoulderLevelIndicator.style.background = "rgba(255,255,255,0.3)";
    shoulderLevelIndicator.style.left = "50%";
    shoulderLevelIndicator.style.boxShadow = "none";
  }

  if (lh && rh && isVisible(lh) && isVisible(rh)) {
    const hDiff = Math.abs(lh.y - rh.y);
    let hColor = "#4ade80", hLabelKey = "hc_level_normal";
    if (hDiff > 35) { hColor = "#f87171"; hLabelKey = "hc_level_warn"; }
    else if (hDiff > 20) { hColor = "#facc15"; hLabelKey = "hc_level_caution"; }

    pelvisLevelText.style.color = hColor;
    pelvisLevelText.textContent = t[hLabelKey] || "Normal";
    pelvisLevelIndicator.style.background = hColor;
    pelvisLevelIndicator.style.boxShadow = `0 0 8px ${hColor}`;
    const dir = lh.y > rh.y ? 1 : -1;
    const offset = (Math.min(hDiff, 40) / 40) * 40 * dir;
    pelvisLevelIndicator.style.left = `calc(50% + ${offset}%)`;
  } else {
    pelvisLevelText.style.color = "#94a3b8";
    pelvisLevelText.textContent = "--";
    pelvisLevelIndicator.style.background = "rgba(255,255,255,0.3)";
    pelvisLevelIndicator.style.left = "50%";
    pelvisLevelIndicator.style.boxShadow = "none";
  }

  if (ls && rs && lh && rh && [ls, rs, lh, rh].every(isVisible)) {
    const centerX = (ls.x + rs.x + lh.x + rh.x) / 4;
    const frameMidX = (src.frame?.width || 640) / 2;
    const cDiff = Math.abs(centerX - frameMidX);

    let cColor = "#4ade80", cLabelKey = "hc_level_normal";
    if (cDiff > 160) { cColor = "#f87171"; cLabelKey = "hc_level_warn"; }
    else if (cDiff > 80) { cColor = "#facc15"; cLabelKey = "hc_level_caution"; }

    centerAlignText.style.color = cColor;
    centerAlignText.textContent = t[cLabelKey] || "Normal";
    centerAlignIndicator.style.background = cColor;
    centerAlignIndicator.style.boxShadow = `0 0 8px ${cColor}`;
    const dir = centerX > frameMidX ? 1 : -1;
    const offset = (Math.min(cDiff, 150) / 150) * 40 * dir;
    centerAlignIndicator.style.left = `calc(50% + ${offset}%)`;
  } else {
    centerAlignText.style.color = "#94a3b8";
    centerAlignText.textContent = "--";
    centerAlignIndicator.style.background = "rgba(255,255,255,0.3)";
    centerAlignIndicator.style.left = "50%";
    centerAlignIndicator.style.boxShadow = "none";
  }
}

function renderMiniValues() {
  const analysis = (state.mergedAnalysis && Object.keys(state.mergedAnalysis).length)
    ? state.mergedAnalysis
    : (state.data?.analysis || {});
  Object.entries(miniIds).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const item = analysis[key];
    el.textContent = !item || item.value == null ? "--" : formatMetric(item.value, item.unit);
  });
}

function renderAnalysisList() {
  const analysisListEl = document.getElementById("analysisList");
  if (!analysisListEl) return;

  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  const analysis = (state.mergedAnalysis && Object.keys(state.mergedAnalysis).length)
    ? state.mergedAnalysis
    : (state.data?.analysis || {});

  analysisListEl.innerHTML = ANALYSIS_ORDER.map(key => {
    const item = analysis[key];
    const active = state.selectedAnalysis === key ? "active" : "";
    const nameLabel = t[DISPLAY_NAMES[key]] || key;

    if (!item) {
      return `<div class="analysis-item ${active}" data-key="${key}"><div class="analysis-top"><div class="analysis-name">${nameLabel}</div><div class="analysis-badge">no data</div></div></div>`;
    }
    const badge = item.enabled ? "ready" : "pending";
    const typeLabel = item.type ? (t[`type_${item.type}`] || item.type) : "-";
    const gradeLabel = t[`grade_${item.grade}`] || item.grade || "-";

    return `
      <div class="analysis-item ${active}" data-key="${key}">
        <div class="analysis-top">
          <div class="analysis-name">${nameLabel}</div>
          <div class="analysis-badge">${badge}</div>
        </div>
        <div class="analysis-meta">
          <div>view: ${item.view || "-"}</div>
          <div>type: ${typeLabel}</div>
          <div>grade: ${gradeLabel}</div>
        </div>
        <div class="analysis-meta">
          <div>value: ${formatMetric(item.value, item.unit)}</div>
          <div>conf: ${formatNumber(item.confidence, 2)}</div>
          <div>${item.enabled ? "available" : "need view"}</div>
        </div>
        <div class="analysis-summary">${item.summary || ""}</div>
      </div>`;
  }).join("");

  document.querySelectorAll(".analysis-item").forEach(node => {
    node.addEventListener("click", () => {
      state.selectedAnalysis = node.dataset.key;
      const analysisSelectEl = document.getElementById("analysisSelect");
      if (analysisSelectEl) analysisSelectEl.value = state.selectedAnalysis;
      renderAnalysisList();
      renderOverlay();
    });
  });

  // Re-apply translations for static elements if any were missed
  if (window.applyTranslations) {
    window.applyTranslations(localStorage.getItem('appLang') || 'en');
  }
}

function formatNumber(v, digits = 1) {
  if (typeof v !== "number" || Number.isNaN(v)) return "-";
  return v.toFixed(digits);
}

function formatMetric(value, unit) {
  if (value == null || Number.isNaN(value)) return "-";
  return unit ? `${formatNumber(value, 1)} ${unit}` : `${value}`;
}

function setupTabs() {
  const tabs = document.querySelectorAll("#hcCategoryTabs .nav-tab");
  const contents = document.querySelectorAll(".tab-content");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      const key = tab.dataset.tab;
      document.getElementById(`tab-${key}`)?.classList.add("active");

      if (key === "body-check" || !key) {
        setTimeout(renderAnalysisList, 50);
      }
    });
  });
}

function resetUiState() {
  state.data = null;
  state.livePoseData = null;
  initMergedAnalysis();
  clearOverlay();
  renderPills();
  renderLeveler();
  renderAnalysisList();
  renderMiniValues();
  updateWorkflowUi("idle");
}

function getByName(data) {
  const landmarks = data?.pose?.landmarks || [];
  return Object.fromEntries(landmarks.map(lm => [lm.name, lm]));
}

function isStableFrontPose(data) {
  if (!data?.ok) return false;
  const view = data.view_detection?.view || "unknown";
  if (view.includes("side")) return false;

  const landmarks = data.pose?.landmarks || [];
  const visiblePoints = landmarks.filter(lm => isVisible(lm));
  if (visiblePoints.length < 12) return false;

  const imgW = data.frame?.width || 640;
  const imgH = data.frame?.height || 480;

  // Strict visual box: X [22%, 78%], Y [10%, 92%]
  const box = {
    xMin: imgW * 0.22,
    xMax: imgW * 0.78,
    yMin: imgH * 0.10,
    yMax: imgH * 0.92
  };

  // Rule: EVERY visible point must be inside the box
  for (const lm of visiblePoints) {
    if (lm.x < box.xMin || lm.x > box.xMax || lm.y < box.yMin || lm.y > box.yMax) {
      return false;
    }
  }

  const by = getByName(data);
  const ls = by.left_shoulder;
  const rs = by.right_shoulder;
  const lh = by.left_hip;
  const rh = by.right_hip;
  if (!ls || !rs || !lh || !rh) return false;

  const shoulderDiff = Math.abs(ls.y - rs.y);
  const hipDiff = Math.abs(lh.y - rh.y);
  const centerX = (ls.x + rs.x + lh.x + rh.x) / 4;
  const centerDiff = Math.abs(centerX - (imgW / 2));

  // Balanced strictness: 50px for level, 45px for hip, 140px for centering
  return shoulderDiff < 50 && hipDiff < 45 && centerDiff < 140;
}

function isStableSidePose(data) {
  if (!data?.ok) return false;
  const view = data.view_detection?.view || "unknown";
  if (!["left_side", "right_side"].includes(view)) return false;

  const by = getByName(data);

  // New Rule: Ear, Shoulder, Elbow, Wrist, Knee, Ankle must have at least one visible joint
  const requiredCategories = [
    ["left_ear", "right_ear"],
    ["left_shoulder", "right_shoulder"],
    ["left_elbow", "right_elbow"],
    ["left_wrist", "right_wrist"],
    ["left_knee", "right_knee"],
    ["left_ankle", "right_ankle"]
  ];

  for (const [left, right] of requiredCategories) {
    const lPoint = by[left];
    const rPoint = by[right];
    const leftVisible = lPoint && isVisible(lPoint);
    const rightVisible = rPoint && isVisible(rPoint);

    if (!leftVisible && !rightVisible) {
      return false; // Category missing visibility
    }
  }

  // Vertical alignment check (Shoulder-Hip)
  const leftSet = [by.left_shoulder, by.left_hip].filter(Boolean);
  const rightSet = [by.right_shoulder, by.right_hip].filter(Boolean);

  let shoulder, hip;
  if (leftSet.every(isVisible)) {
    [shoulder, hip] = leftSet;
  } else if (rightSet.every(isVisible)) {
    [shoulder, hip] = rightSet;
  }

  if (!shoulder || !hip) return false;
  return Math.abs(shoulder.x - hip.x) < 120; // Loosened from 90
}

function setWorkflowMessage(message, sub = "", icon = "fa-circle-info") {
  if (actionMessageText) {
    // If message is a key, translate it.
    const lang = localStorage.getItem('appLang') || 'en';
    const translated = window.translations?.[lang]?.[message] || message;
    actionMessageText.textContent = translated;
  }
  if (actionMessageIcon) actionMessageIcon.className = `fa-solid ${icon}`;
}

function setWorkflowProgress(pct) {
  if (overallProgress) overallProgress.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function updateWorkflowUi(step) {
  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  const texts = {
    idle: t.hc_step_idle || "대기",
    wait_ready: t.hc_step_wait || "준비하세요...",
    prepare: t.hc_step_prep_front || "Step 1: 정면 측정 준비",
    front_hold: t.hc_step_front_hold || "Step 1: 정면 측정 중",
    turn: t.hc_step_turn || "Step 2: 측면 전환",
    side_hold: t.hc_step_side_hold || "Step 2: 측면 측정 중",
    analyzing: t.hc_step_analyzing || "Step 3: 결과 분석 중...",
    result: t.hc_step_result || "분석 완료"
  };
  if (currentStepText) currentStepText.textContent = texts[step] || "";

  if (step === "idle" || step === "result" || step === "prepare" || step === "turn" || step === "wait_ready") {
    if (countdownOverlay) countdownOverlay.style.display = "none";
  }
}

function resetStableTimer() {
  state.workflow.stableSince = null;
  state.measureState.stableSince = null;
  setWorkflowProgress(0);
}

function startWorkflow() {
  if (!state.enabled) {
    const lang = localStorage.getItem('appLang') || 'en';
    showToast(window.translations?.[lang]?.hc_turn_on_agent || "먼저 에이전트를 켜주세요.");
    return;
  }
  if (state.workflow.active) {
    stopWorkflow();
    return;
  }

  initMergedAnalysis();
  localStorage.removeItem('bodyCheckReport');

  // Initialize both legacy workflow and new measureState
  state.measureState = {
    active: true,
    step: "wait_ready",
    stableSince: Date.now(),
    frontCapture: null,
    sideCapture: null,
    requestedTurn: "right",
    _retakeRequested: null,
  };

  state.workflow.active = true;
  state.workflow.step = "wait_ready";
  state.workflow.frontCapture = null;
  state.workflow.sideCapture = null;
  state.workflow.stableSince = Date.now();

  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  if (btnMeasureStart) {
    btnMeasureStart.innerHTML = `<i class="fa-solid fa-stop"></i> <span id="btnMeasureText">${t.hc_measure_stop || "측정 중지"}</span>`;
    btnMeasureStart.style.background = "rgba(239, 68, 68, 0.15)";
    btnMeasureStart.style.color = "#ef4444";
    btnMeasureStart.style.borderColor = "rgba(239, 68, 68, 0.4)";
  }

  resetStableTimer();
  updateWorkflowUi("wait_ready");
  updateMeasureUi("wait_ready");
  setWorkflowMessage("hc_track_waiting", "", "fa-hourglass-start");
  state.workflow.stableSince = Date.now();
}

function stopWorkflow(clearCaptures = true) {
  state.workflow.active = false;
  state.workflow.step = "idle";

  // Also stop measureState
  const ms = state.measureState;
  ms.active = false;
  ms.step = "idle";

  // Only clear captures if explicitly requested (default: true)
  if (clearCaptures) {
    state.workflow.frontCapture = null;
    state.workflow.sideCapture = null;
    ms.frontCapture = null;
    ms.sideCapture = null;
  }

  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  if (btnMeasureStart) {
    btnMeasureStart.innerHTML = `<i class="fa-solid fa-play"></i> <span id="btnMeasureText">${t.hc_measure_start || "측정 시작"}</span>`;
    btnMeasureStart.style.background = "rgba(34, 197, 94, 0.15)";
    btnMeasureStart.style.color = "#4ade80";
    btnMeasureStart.style.borderColor = "rgba(34, 197, 94, 0.4)";
  }

  resetStableTimer();
  updateWorkflowUi("idle");
  updateMeasureUi("idle");
  setWorkflowMessage("hc_turn_on_agent", "", "fa-hand-pointer");
}

async function tickWorkflow() {
  if (!state.workflow.active) return;
  if (state.workflow._tickBusy) return;
  state.workflow._tickBusy = true;
  try {
    const live = state.livePoseData;
    const now = Date.now();
    const ms = state.measureState;

    if (state.workflow.step === "wait_ready") {
      const elapsed = now - state.workflow.stableSince;
      if (elapsed >= 2000) {
        state.workflow.step = "prepare";
        ms.step = "prepare";
        if (window.AudioManager) window.AudioManager.playVoice('bc_pos_front');
        updateWorkflowUi("prepare");
        updateMeasureUi("prepare");
        setWorkflowMessage("hc_guide_prep_pos", "", "fa-person");
      }
      return;
    }

    if (state.workflow.step === "prepare") {
      const liveOk = !!live?.ok;
      const landmarks = live?.pose?.landmarks || [];
      const detected = live?.pose?.detected;

      if (liveOk && detected && landmarks.length >= 8) {
        state.workflow.step = "front_hold";
        ms.step = "front_hold";
        resetStableTimer();
        updateWorkflowUi("front_hold");
        updateMeasureUi("front_hold");
        setWorkflowMessage("hc_guide_front_hold", "", "fa-camera");
        if (countdownOverlay) countdownOverlay.style.display = "flex";
      } else {
        setWorkflowMessage("hc_guide_prep_pos", "", "fa-person");
        if (countdownOverlay) countdownOverlay.style.display = "none";
      }
      return;
    }

    if (state.workflow.step === "front_hold") {
      if (!isStableFrontPose(live)) {
        resetStableTimer();
        ms.stableSince = null;
        setWorkflowMessage("hc_guide_shake", "", "fa-triangle-exclamation");
        if (countdownNumber) countdownNumber.textContent = "3";
        if (stepMask) stepMask.style.background = "rgba(239,68,68,0.3)";
        return;
      }
      if (stepMask) stepMask.style.background = "rgba(0,0,0,0.5)";
      if (!state.workflow.stableSince) {
        state.workflow.stableSince = now;
        ms.stableSince = now;
        if (window.AudioManager) window.AudioManager.playVoice('bc_keep_still');
      }
      const elapsed = now - state.workflow.stableSince;
      setWorkflowProgress((elapsed / 3000) * 100);

      let remain = Math.ceil((3000 - elapsed) / 1000);
      if (remain < 1) remain = 1;
      if (countdownNumber) countdownNumber.textContent = remain;

      if (elapsed >= 3000) {
        setWorkflowProgress(100);
        setWorkflowMessage("hc_guide_front_ok", "", "fa-check-circle");
        if (countdownOverlay) countdownOverlay.style.display = "none";
        if (stepMask) stepMask.style.background = "rgba(0,255,0,0.3)";

        // WEBCAM_MEASURE: capture frame client-side instead of server analyze()
        advanceToFrontCapture();
        const frontCapture = ms.frontCapture;
        state.workflow.frontCapture = frontCapture; // keep legacy compat

        state.workflow.step = "turn";
        ms.step = "turn";
        if (window.AudioManager) window.AudioManager.playVoice('bc_pos_side');
        resetStableTimer();
        ms.stableSince = null;
        updateWorkflowUi("turn");
        updateMeasureUi("turn");
        if (stepMask) setTimeout(() => stepMask.style.background = "transparent", 500);
      }
      return;
    }

    if (state.workflow.step === "turn") {
      setWorkflowMessage("hc_guide_turn_right", "", "fa-rotate-right");
      updateMeasureUi("turn");
      if (isStableSidePose(live)) {
        state.workflow.step = "side_hold";
        ms.step = "side_hold";
        resetStableTimer();
        ms.stableSince = now;
        updateWorkflowUi("side_hold");
        updateMeasureUi("side_hold");
        setWorkflowMessage("hc_guide_side_hold", "", "fa-camera");
        if (countdownOverlay) countdownOverlay.style.display = "flex";
      }
      return;
    }

    if (state.workflow.step === "side_hold") {
      if (!isStableSidePose(live)) {
        resetStableTimer();
        ms.stableSince = null;
        setWorkflowMessage("hc_guide_side_shake", "", "fa-triangle-exclamation");
        if (countdownNumber) countdownNumber.textContent = "3";
        if (stepMask) stepMask.style.background = "rgba(239,68,68,0.3)";
        return;
      }
      if (stepMask) stepMask.style.background = "rgba(0,0,0,0.5)";
      if (!state.workflow.stableSince) {
        state.workflow.stableSince = now;
        ms.stableSince = now;
        if (window.AudioManager) window.AudioManager.playVoice('bc_keep_still');
      }
      const elapsed = now - state.workflow.stableSince;
      setWorkflowProgress((elapsed / 3000) * 100);

      let remain = Math.ceil((3000 - elapsed) / 1000);
      if (remain < 1) remain = 1;
      if (countdownNumber) countdownNumber.textContent = remain;

      if (elapsed >= 3000) {
        setWorkflowProgress(100);
        if (countdownOverlay) countdownOverlay.style.display = "none";
        if (stepMask) stepMask.style.background = "rgba(0,255,0,0.3)";

        state.workflow.step = "analyzing";
        ms.step = "analyzing";
        state.workflow.active = false; // Stop new ticks from entering side_hold again
        updateWorkflowUi("analyzing");
        updateMeasureUi("analyzing");
        setWorkflowMessage("hc_guide_analyzing", "", "fa-spinner fa-spin");

        // WEBCAM_MEASURE: capture frame client-side instead of server analyze()
        advanceToSideCapture();
        const sideCapture = ms.sideCapture;
        state.workflow.sideCapture = sideCapture; // keep legacy compat

        // WEBCAM_MEASURE: build measure report from captured frames
        const report = buildMeasureReport();
        if (report) {
          localStorage.setItem('bodyCheckReport', JSON.stringify(report));
          logLine("[Measure] Report saved to localStorage");
        }

        // buildCompositeReport(); // skipped - needs server analysis

        state.workflow.step = "result";
        ms.step = "result";
        if (window.AudioManager) window.AudioManager.playVoice('bc_complete');
        updateWorkflowUi("result");
        updateMeasureUi("result");
        setWorkflowMessage("hc_guide_done", "", "fa-clipboard-check");
        resetStableTimer();
        if (stepMask) setTimeout(() => stepMask.style.background = "transparent", 500);

        // WEBCAM_MEASURE: skip server save for now - report is in localStorage
        // await saveWorkflowResult(frontCapture, sideCapture); // TODO: connect to API later

        // Reset UI after a delay, but preserve captures
        setTimeout(() => {
          stopMeasureWorkflow(false); // keep captures
          stopWorkflow(false);
        }, 6000);

        // Show Completion Modal
        showCompletionModal("측정 및 분석이 완료되었습니다. 리포트에서 상세 내용을 확인하세요.", "/ui/anthropometry.html");
      }
    }
  } finally {
    state.workflow._tickBusy = false;
  }
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
      // MEASURE_FLOW: show retake buttons after modal close
      updateMeasureUi(state.measureState.step || "result");
    };
  }

  modal.classList.remove("hidden");

  // MEASURE_FLOW: if captures exist, don't auto-redirect - let user choose retake or view report
  const hasCaptures = state.measureState.frontCapture || state.measureState.sideCapture;
  if (!hasCaptures) {
    setTimeout(() => {
      if (!modal.classList.contains("hidden")) {
        window.location.href = reportUrl;
      }
    }, 8000);
  }
}

async function saveWorkflowResult(front, side) {
  if (!front) { logLine("[SAVE ERROR] front payload is null/undefined - skipping save"); return; }
  if (!side) { logLine("[SAVE ERROR] side payload is null/undefined - skipping save"); return; }

  // WEBCAM_MEASURE: Primary save is localStorage (bodyCheckReport).
  // Server save (/api/body/complete) is optional backup — not required for result display.
  const email = window.BodyCheckUser?.getCurrentUserEmail() || "unknown@user.com";

  const fCaptureOk = front.quality?.capture_ok;
  const sCaptureOk = side.quality?.capture_ok;

  logLine(`[SAVE] subject=${email} webcam_mode=true`);
  logLine(`[SAVE] front → capture_ok=${fCaptureOk}, has_analysis=${!!front.analysis}`);
  logLine(`[SAVE] side  → capture_ok=${sCaptureOk}, has_analysis=${!!side.analysis}`);

  // 1. Primary: save to localStorage (available immediately to anthropometry.js)
  const report = buildMeasureReport();
  if (report) {
    Api.saveMeasurementToLocal(report);
    logLine('[SAVE] localStorage save done');
  } else {
    logLine('[SAVE ERROR] buildMeasureReport returned null — skipping localStorage save');
    return;
  }

  // 2. Optional: persist to server (fails silently — localStorage is source of truth)
  try {
    const data = await Api.bodyComplete(email, front, side);
    if (data?.ok) {
      logLine(`[SAVE] server save successful. session_id=${data.cloud?.session_id}`);
    } else {
      logLine(`[SAVE] server save skipped/failed: ${data?.cloud?.reason || 'unknown'}`);
    }
  } catch (err) {
    logLine(`[SAVE] server save error (non-fatal): ${err.message}`);
  }

  // Mesh capture removed — RealSense depth required; no equivalent for webcam-only mode
}

// 3D 메시 캡처 자동 시작 함수
// WEBCAM_MEASURE: RealSense depth mesh capture removed —
// startMeshCapture and buildCompositeReport removed — RealSense-only, no callers.

function syncUi() {
  const btnText = document.getElementById("btnAgentText");
  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  if (state.enabled) {
    if (btnText) btnText.textContent = t.hc_agent_stop || "에이전트 종료";
  } else {
    if (btnText) btnText.textContent = t.hc_agent_start || "에이전트 켜기";
  }

  // Also sync other dynamic elements if needed
  if (typeof renderAnalysisList === 'function') renderAnalysisList();
}

function bindEvents() {
  window.addEventListener('languageChanged', syncUi);

  if (state.mobileMode) {
    window.addEventListener("resize", () => { syncCanvas(); renderOverlay(); });
    return;
  }

  btnAgent?.addEventListener("click", async () => {
    state.enabled = !state.enabled;
    const btnText = document.getElementById("btnAgentText");
    const btnIcon = btnAgent.querySelector("i");
    const lang = localStorage.getItem('appLang') || 'en';
    const t = window.translations?.[lang] || {};

    if (state.enabled) {
      if (btnText) btnText.textContent = t.hc_agent_stop || "에이전트 종료";
      if (btnIcon) btnIcon.className = "fa-solid fa-stop";
      btnAgent.style.background = "rgba(239, 68, 68, 0.85)";
      btnAgent.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.4)";
      if (window.AudioManager) window.AudioManager.playVoice('sys_agent_on');
      setGuideWaiting(false);
      // WEBCAM_CANDIDATE: initialize browser webcam instead of RealSense MJPEG
      const stream = await initWebcam();
      if (!stream) {
        // Webcam failed - revert agent state
        state.enabled = false;
        if (btnText) btnText.textContent = t.hc_agent_start || "에이전트 켜기";
        if (btnIcon) btnIcon.className = "fa-solid fa-power-off";
        btnAgent.style.background = "var(--intel-blue)";
        btnAgent.style.boxShadow = "0 0 15px rgba(0, 113, 197, 0.4)";
        setGuideWaiting(true);
        setSystemStatus("Camera Error");
        logLine("agent start aborted - webcam error");
        return;
      }
      // WEBCAM_POSE: start browser-based pose detection (no server polling needed)
      await startPoseDetection();
      // MEASURE_FLOW: initialize measureState idle UI
      updateMeasureUi("idle");
      startLiveView();
      setSystemStatus("Agent Connected");
      logLine("agent connected (webcam + browser pose)");
      await loadLatest();
      setWorkflowMessage("hc_agent_ok");
    } else {
      if (btnText) btnText.textContent = t.hc_agent_start || "에이전트 켜기";
      if (btnIcon) btnIcon.className = "fa-solid fa-power-off";
      btnAgent.style.background = "var(--intel-blue)";
      btnAgent.style.boxShadow = "0 0 15px rgba(0, 113, 197, 0.4)";
      if (window.AudioManager) window.AudioManager.playVoice('sys_agent_off');
      // WEBCAM_POSE: stop browser-based pose detection
      stopPoseDetection();
      stopLivePosePolling();
      stopLiveView();
      stopWorkflow();
      stopMeasureWorkflow();
      setGuideWaiting(true);
      setSystemStatus("System Ready");
      resetUiState();
      logLine("agent disconnected (webcam)");
      setWorkflowMessage("hc_turn_on_agent", "", "fa-power-off");
      updateMeasureUi("idle");
    }
  });

  document.getElementById("btnMeasureStart")?.addEventListener("click", startWorkflow);

  const btnFront = document.getElementById("btnFront");
  const btnSide = document.getElementById("btnSide");
  const btnRefresh = document.getElementById("btnRefresh");
  const btnTogglePoints = document.getElementById("btnTogglePoints");
  const btnToggleLines = document.getElementById("btnToggleLines");
  const btnToggleGuides = document.getElementById("btnToggleGuides");
  const analysisSelectEl = document.getElementById("analysisSelect");
  const guideModeEl = document.getElementById("guideMode");

  btnFront?.addEventListener("click", () => advanceToFrontCapture());
  btnSide?.addEventListener("click", () => advanceToSideCapture());
  btnRefresh?.addEventListener("click", loadLatest);
  btnTogglePoints?.addEventListener("click", () => { state.showPoints = !state.showPoints; renderOverlay(); });
  btnToggleLines?.addEventListener("click", () => { state.showLines = !state.showLines; renderOverlay(); });
  btnToggleGuides?.addEventListener("click", () => { state.showGuides = !state.showGuides; renderOverlay(); });
  analysisSelectEl?.addEventListener("change", e => {
    state.selectedAnalysis = e.target.value;
    renderAnalysisList();
    renderOverlay();
  });
  guideModeEl?.addEventListener("change", renderOverlay);
  window.addEventListener("resize", () => { syncCanvas(); renderOverlay(); });

  photoEl?.addEventListener("error", () => {
    logLine("video/image load error");
    showToast("영상 로드 실패 - 재시도 중");
    if (state.enabled) setTimeout(startLiveView, 800);
  });

  // WEBCAM_CANDIDATE: retry button for camera error
  btnRetryCamera?.addEventListener("click", async () => {
    if (state.enabled) {
      await retryWebcam();
    }
  });
}

function init() {
  state.mobileMode = isMobileClient();
  document.body.classList.toggle("mobile-ui-mode", state.mobileMode);

  initMergedAnalysis();
  buildAnalysisSelect();
  setupTabs();
  bindEvents();
  syncCanvas();
  setGuideWaiting(true);
  stopLiveView();
  resetUiState();
  syncUi(); // Apply correct language to agent button on load
  if (state.mobileMode) {
    if (btnAgent) {
      btnAgent.disabled = true;
      btnAgent.style.opacity = "0.55";
      btnAgent.style.cursor = "not-allowed";
    }
    if (btnMeasureStart) {
      btnMeasureStart.disabled = true;
      btnMeasureStart.style.display = "none";
    }
    setGuideWaiting(false);
    setSystemStatus("Results View");
    setWorkflowMessage("모바일에서는 결과 조회 모드로 동작합니다.", "", "fa-mobile-screen");
    loadLatestForMobile();
  } else {
    setWorkflowMessage("hc_turn_on_agent", "", "fa-power-off");
  }
  logLine("UI initialized");
}

function startup() {
  setTimeout(() => {
    init();
    renderAnalysisList();

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      renderAnalysisList();
      const analysisListEl = document.getElementById("analysisList");
      if (analysisListEl && !analysisListEl.innerHTML.trim()) {
        analysisListEl.innerHTML = `<div style="color:white; padding: 20px;">[Debug] List rendered empty. Wait for measurement.</div>`;
      }
      if (attempts > 5) clearInterval(interval);
    }, 400);

  }, 100);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startup);
} else {
  startup();
}
