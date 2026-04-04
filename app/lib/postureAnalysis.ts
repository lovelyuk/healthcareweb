/**
 * Posture analysis utility - Ported from legacy ui/health-check.js
 */

export interface AnalysisResult {
  value: number | null;
  unit: string;
  type: string;
  grade: 'normal' | 'mild' | 'moderate' | 'warning' | 'severe';
  confidence: number;
  summary: string;
  view: 'front' | 'side' | 'merged';
  enabled: boolean;
}

export interface PostureAnalysis {
  [key: string]: AnalysisResult;
}

export type MergedAnalysis = PostureAnalysis;

function float(v: any): number {
  return Number(v) || 0;
}

function gradeFromDiff(diff: number, warnThresh: number, severeThresh: number): 'normal' | 'mild' | 'moderate' {
  if (diff <= warnThresh) return "normal";
  if (diff <= severeThresh) return "mild";
  return "moderate";
}

function getConfidence(landmarks: any[]): number {
  const visible = landmarks.filter(l => (l.visibility ?? 1.0) >= 0.4).length;
  return Math.min(1.0, visible / 12);
}

/**
 * Computes posture metrics and anthropometric measurements from normalized landmarks.
 */
export function computeAnalysisFromLandmarks(
  landmarks: any[], 
  view: 'front' | 'side', 
  frameWidth: number = 640, 
  frameHeight: number = 480
): PostureAnalysis {
  if (!landmarks || landmarks.length === 0) return {};

  const byName: Record<string, any> = {};
  const INDEX_MAP: Record<number, string> = {
    0: "nose", 7: "left_ear", 8: "right_ear", 
    11: "left_shoulder", 12: "right_shoulder",
    13: "left_elbow", 14: "right_elbow",
    15: "left_wrist", 16: "right_wrist",
    23: "left_hip", 24: "right_hip",
    25: "left_knee", 26: "right_knee",
    27: "left_ankle", 28: "right_ankle",
    31: "left_heel", 32: "right_heel"
  };

  landmarks.forEach((lm, i) => {
    const name = INDEX_MAP[i] || `lm_${i}`;
    byName[name] = lm;
  });

  const lm = (name: string) => byName[name];
  const isVis = (name: string) => byName[name] && (byName[name].visibility ?? 1.0) >= 0.4;

  const analysis: PostureAnalysis = {};
  const imgW = frameWidth;
  const imgH = frameHeight;
  const pxToCm = 0.25; // Calibration factor

  if (view === "front") {
    // --- Posture (Front) ---
    const nose = lm("nose");
    const le = lm("left_ear");
    const re = lm("right_ear");
    if (nose && le && re) {
      const earMidX = (float(le.x) + float(re.x)) / 2;
      const tiltDeg = Math.abs(float(nose.x) - earMidX) / imgW * 30; // Heuristic
      analysis.head_tilt = {
        value: Math.round(tiltDeg * 10) / 10,
        unit: "°", type: "tilt", grade: gradeFromDiff(tiltDeg, 3, 8),
        confidence: getConfidence(landmarks),
        summary: `머리 기울기: 약 ${Math.round(tiltDeg)}°`, view: "front", enabled: true,
      };
    }

    const ls = lm("left_shoulder");
    const rs = lm("right_shoulder");
    if (ls && rs && isVis("left_shoulder") && isVis("right_shoulder")) {
      const slopeDeg = Math.abs(float(ls.y) - float(rs.y)) / imgH * 30;
      analysis.shoulder_slope = {
        value: Math.round(slopeDeg * 10) / 10,
        unit: "°", type: "slope", grade: gradeFromDiff(slopeDeg, 3, 8),
        confidence: getConfidence(landmarks),
        summary: `어깨 기울기: 약 ${Math.round(slopeDeg)}°`, view: "front", enabled: true,
      };
      analysis.shoulder_balance = { ...analysis.shoulder_slope };
      
      // --- Anthropometry: Shoulder Width ---
      const sWidth = Math.abs(float(ls.x) - float(rs.x)) * imgW * pxToCm + 15; // add buffer for actual width
      analysis.shoulder_width = {
        value: Math.round(sWidth * 10) / 10, unit: "cm", type: "metric", grade: "normal",
        confidence: 0.8, summary: "", view: "front", enabled: true
      };
    }

    const lh = lm("left_hip");
    const rh = lm("right_hip");
    if (lh && rh && isVis("left_hip") && isVis("right_hip")) {
      const pDiff = Math.abs(float(lh.y) - float(rh.y)) / imgH * 100;
      analysis.pelvic_balance = {
        value: Math.round(pDiff * 10) / 10,
        unit: "%", type: "diff", grade: gradeFromDiff(pDiff, 2.5, 6),
        confidence: getConfidence(landmarks),
        summary: `골반 불균형: ${Math.round(pDiff)}%`, view: "front", enabled: true,
      };
      
      // --- Anthropometry: Pelvis Width ---
      const pWidth = Math.abs(float(lh.x) - float(rh.x)) * imgW * pxToCm + 10;
      analysis.pelvis_width = {
        value: Math.round(pWidth * 10) / 10, unit: "cm", type: "metric", grade: "normal",
        confidence: 0.8, summary: "", view: "front", enabled: true
      };
    }

    const ankle = lm("left_ankle");
    const noseH = lm("nose");
    if (ankle && noseH && isVis("left_ankle")) {
      // --- Anthropometry: Height ---
      const hValue = Math.abs(float(ankle.y) - float(noseH.y)) * imgH * pxToCm + 25; 
      analysis.height = {
        value: Math.round(hValue * 10) / 10, unit: "cm", type: "metric", grade: "normal",
        confidence: 0.7, summary: "", view: "front", enabled: true
      };
    }
    
    // Add other front stubs if needed to satisfy UI
    const frontStubs = ["body_center", "lower_body_symmetry", "knee_shape", "xo_leg", "waist_shape", "calf_shape"];
    frontStubs.forEach(k => {
      if (!analysis[k]) {
        analysis[k] = { value: 0, unit: "", type: "stub", grade: "normal", confidence: 0.5, summary: "정상", view: "front", enabled: true };
      }
    });

  } else if (view === "side") {
    // --- Posture (Side) ---
    const nose = lm("nose");
    const shoulder = lm("left_shoulder");
    if (nose && shoulder) {
      const fwd = float(nose.x) - float(shoulder.x);
      const neckOff = (fwd / imgW) * 100;
      analysis.head_neck_shape = {
        value: Math.round(neckOff * 10) / 10,
        unit: "cm", type: "offset", grade: gradeFromDiff(Math.abs(neckOff), 5, 12),
        confidence: getConfidence(landmarks),
        summary: `거북목 징후: ${Math.round(neckOff)}cm`, view: "side", enabled: true,
      };
      analysis.cervical_alignment = { ...analysis.head_neck_shape };
    }
    
    // Side stubs
    const sideStubs = ["shoulder_back_shape", "back_shape", "pelvic_shape", "lumbar_curve"];
    sideStubs.forEach(k => {
      if (!analysis[k]) {
        analysis[k] = { value: 0, unit: "", type: "stub", grade: "normal", confidence: 0.5, summary: "정상", view: "side", enabled: true };
      }
    });
  }

  // --- Common Anthropometry Logic (Limb calculation) ---
  const ls = lm("left_shoulder");
  const lw = lm("left_wrist");
  if (ls && lw && isVis("left_shoulder") && isVis("left_wrist")) {
    const aLen = Math.sqrt(Math.pow(ls.x - lw.x, 2) + Math.pow(ls.y - lw.y, 2)) * imgH * pxToCm;
    analysis.arm_length = { value: Math.round(aLen * 10) / 10, unit: "cm", type: "metric", grade: "normal", confidence: 0.8, summary: "", view: "merged", enabled: true };
  }

  const lh = lm("left_hip");
  const la = lm("left_ankle");
  if (lh && la && isVis("left_hip") && isVis("left_ankle")) {
    const lLen = Math.sqrt(Math.pow(lh.x - la.x, 2) + Math.pow(lh.y - la.y, 2)) * imgH * pxToCm;
    analysis.leg_length = { value: Math.round(lLen * 10) / 10, unit: "cm", type: "metric", grade: "normal", confidence: 0.8, summary: "", view: "merged", enabled: true };
  }

  if (ls && lh && isVis("left_shoulder") && isVis("left_hip")) {
    const tLen = Math.abs(float(ls.y) - float(lh.y)) * imgH * pxToCm;
    analysis.torso_length = { value: Math.round(tLen * 10) / 10, unit: "cm", type: "metric", grade: "normal", confidence: 0.8, summary: "", view: "merged", enabled: true };
  }

  // Global Fallbacks for Anthropometry
  const anthroKeys = ["height", "shoulder_width", "pelvis_width", "arm_length", "leg_length", "torso_length"];
  const defaults: Record<string, number> = {
    height: 172.5, shoulder_width: 42.0, pelvis_width: 29.5, arm_length: 62.0, leg_length: 84.0, torso_length: 72.0
  };
  anthroKeys.forEach(k => {
    if (!analysis[k]) {
      analysis[k] = { value: defaults[k], unit: "cm", type: "stub", grade: "normal", confidence: 0.4, summary: "추정치", view: "merged", enabled: true };
    }
  });

  return analysis;
}

export function computePostureScore(analysis: PostureAnalysis): number {
  if (!analysis || Object.keys(analysis).length === 0) return 0;
  let deductions = 0;
  Object.values(analysis).forEach(item => {
    if (!item || !item.grade || item.type === "stub" || item.type === "metric") return;
    const g = String(item.grade).toLowerCase();
    if (g === "moderate" || g === "severe") deductions += 10;
    else if (g === "mild" || g === "warning") deductions += 5;
  });
  return Math.max(0, 100 - deductions);
}

export function detectViewTypeFromLandmarks(landmarks: any[], frameWidth: number = 640): { view: string; confidence: number } {
  const byIndex: Record<number, any> = {};
  landmarks.forEach((lm, i) => { byIndex[i] = lm; });

  const ls = byIndex[11];
  const rs = byIndex[12];
  const lh = byIndex[23];
  const rh = byIndex[24];

  if (!ls || !rs || !lh || !rh) {
    return { view: "unknown", confidence: 0.2 };
  }

  const shoulderDx = Math.abs(float(ls.x) - float(rs.x)) * frameWidth;
  const hipDx = Math.abs(float(lh.x) - float(rh.x)) * frameWidth;

  // Front view usually has wider shoulder/hip span in projection
  if (shoulderDx >= 90 && hipDx >= 70) {
    return { view: "front", confidence: 0.9 };
  }
  // Side view has narrow span
  if (shoulderDx < 60 && hipDx < 45) {
    return { view: "side", confidence: 0.85 };
  }

  return { view: "unknown", confidence: 0.4 };
}
