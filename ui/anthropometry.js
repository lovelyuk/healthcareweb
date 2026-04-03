// API_BASE / LOCAL_SERVER_DEPENDENCY removed — use Api.* from /ui/lib/api.js
const SELECTED_GLB_STORAGE_KEY = "selectedGlbModelPath";
const AI_SUMMARY_FALLBACK = "AI 분석을 불러올 수 없습니다";

// ----------------------------------------------------------------------
// AI Analysis Mock Data (replace with real API response)
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// AI Analysis Computation (from real measurement data)
// ----------------------------------------------------------------------
function computeAiAnalysisFromMeasurements(items, front, side) {
  // items = [[key, item], ...] from evaluatedItems
  // Derives all AI analysis sections from actual measured posture data

  function getMetric(key) {
    const pair = items.find(([k]) => k === key);
    return pair ? pair[1] : null;
  }

  function gradeToStatus(grade) {
    if (!grade || grade === "normal") return "정상";
    if (grade === "mild") return "경미";
    if (grade === "warning" || grade === "moderate") return "주의";
    return "개선 필요";
  }

  function gradeToConfidence(item) {
    return item?.confidence != null ? item.confidence : null;
  }

  // Compute overall score (0-100) from grades
  let deductions = 0;
  items.forEach(([, item]) => {
    if (!item || !item.grade) return;
    const g = String(item.grade).toLowerCase();
    if (g === "moderate" || g === "danger" || g === "severe") deductions += 10;
    else if (g === "mild" || g === "warning") deductions += 5;
  });
  const score = Math.max(0, 100 - deductions);
  const overallStatus = score >= 85 ? "정상" : score >= 70 ? "주의" : "개선 필요";

  // Build posture summary from real metrics
  const shoulderBalance = getMetric("shoulder_balance");
  const pelvicBalance = getMetric("pelvic_balance");
  const shoulderSlope = getMetric("shoulder_slope");
  const headTilt = getMetric("head_tilt");
  const headNeckShape = getMetric("head_neck_shape");
  const bodyCenter = getMetric("body_center");

  // Posture analysis from real data
  const posture = {
    shoulderTilt: {
      value: shoulderSlope ? `${formatMetric(shoulderSlope.value, shoulderSlope.unit)}` : "--",
      interpretation: shoulderSlope?.summary || (shoulderSlope ? `어깨 기울기: ${shoulderSlope.type || "알 수 없음"}` : "데이터 없음")
    },
    pelvicTilt: {
      value: pelvicBalance ? `${formatMetric(pelvicBalance.value, pelvicBalance.unit)}` : "--",
      interpretation: pelvicBalance?.summary || (pelvicBalance ? `골반 ${pelvicBalance.type || "불균형"}` : "데이터 없음")
    },
    neckTilt: {
      value: headNeckShape?.type || headTilt?.type || "중립",
      interpretation: headNeckShape?.summary || headTilt?.summary || "목/머리 정렬에 이상 없음"
    },
    balance: {
      value: bodyCenter?.type || shoulderBalance?.type || "중립",
      interpretation: bodyCenter?.summary || shoulderBalance?.summary || "체중 중심이 중앙에 위치합니다."
    }
  };

  // Detect issues from measured data
  const issues = [];
  if (headNeckShape && (headNeckShape.grade === "warning" || headNeckShape.grade === "moderate" || headNeckShape.grade === "mild")) {
    issues.push({
      name: "거북목",
      status: gradeToStatus(headNeckShape.grade),
      confidence: gradeToConfidence(headNeckShape),
      description: headNeckShape.summary || "목 정렬이 전방으로 이동한 경향이 있습니다."
    });
  }
  if (shoulderBalance && (shoulderBalance.grade === "warning" || shoulderBalance.grade === "moderate" || shoulderBalance.grade === "mild")) {
    issues.push({
      name: "라운드 숄더",
      status: gradeToStatus(shoulderBalance.grade),
      confidence: gradeToConfidence(shoulderBalance),
      description: shoulderBalance.summary || "어깨가 전방으로 말린 경향이 관찰됩니다."
    });
  }
  if (pelvicBalance && (pelvicBalance.grade === "warning" || pelvicBalance.grade === "moderate" || pelvicBalance.grade === "mild")) {
    issues.push({
      name: "골반 불균형",
      status: gradeToStatus(pelvicBalance.grade),
      confidence: gradeToConfidence(pelvicBalance),
      description: pelvicBalance.summary || "좌우 골반 높이에 차이가 있습니다."
    });
  }
  if (bodyCenter && (bodyCenter.grade === "warning" || bodyCenter.grade === "moderate" || bodyCenter.grade === "mild")) {
    issues.push({
      name: "체중 중심 불균형",
      status: gradeToStatus(bodyCenter.grade),
      confidence: gradeToConfidence(bodyCenter),
      description: bodyCenter.summary || "체중 중심이 한쪽으로 치우쳐 있습니다."
    });
  }
  const xoLeg = getMetric("xo_leg");
  if (xoLeg && xoLeg.value != null) {
    issues.push({
      name: xoLeg.type === "x_leg" ? "X다리" : "O다리",
      status: gradeToStatus(xoLeg.grade),
      confidence: gradeToConfidence(xoLeg),
      description: xoLeg.summary || `${xoLeg.type === "x_leg" ? "X" : "O"}형 다리 정렬이 관찰됩니다.`
    });
  }

  // Sort issues by severity
  const severityOrder = { "개선 필요": 0, "주의": 1, "경미": 2, "정상": 3 };
  issues.sort((a, b) => (severityOrder[a.status] || 9) - (severityOrder[b.status] || 9));

  // Generate one-line summary
  let summary = "전반적인 자세 정렬이 양호합니다.";
  if (issues.length > 0) {
    const topIssue = issues[0];
    summary = `${topIssue.name}이(가) 확인되었습니다.`;
  }

  // Recommendations based on detected issues
  const recommendations = [];
  const recMap = {
    "거북목": [
      { title: "턱 당기기 운동", description: "거북목 개선에 효과적인 경추 안정화 운동입니다.", duration: "10회 x 3세트" },
      { title: "목 앞쪽 이완 스트레칭", description: "목 앞쪽 근육의 긴장을 풀어줍니다.", duration: "30초 x 3세트" }
    ],
    "라운드 숄더": [
      { title: "가슴 열기 스트레칭", description: "말린 어깨와 상체 전면 근육을 이완합니다.", duration: "30초 x 3세트" },
      { title: "스크류 프레스", description: "뒤통수 아래 힘을 넣어 목을 중립位に 유지합니다.", duration: "10회 유지 x 3세트" }
    ],
    "골반 불균형": [
      { title: "일자 다리 스트레칭", description: "하지 정렬과 골반 균형에 도움이 되는 스트레칭입니다.", duration: "각 20초 x 3세트" },
      { title: "고양이 소매 자세", description: "척추 정렬과 골반 회전을 교정합니다.", duration: "10회 x 3세트" }
    ],
    "체중 중심 불균형": [
      { title: "한 발 스탠딩", description: "좌우 균형 감각과 하체 안정성을 높입니다.", duration: "각 30초 x 3세트" },
      { title: "스쿼트 자세 교정", description: "무릎과 발끝 방향을 맞춰 스쿼트 시 좌우 균형을 확인합니다.", duration: "15회 x 3세트" }
    ],
    "O다리": [
      { title: "외측 넓은근 강화", description: "둔근과 외측 넓은근을 통해 하체 정렬을 개선합니다.", duration: "15회 x 3세트" }
    ],
    "X다리": [
      { title: "내측 넓은근 강화", description: "내측 넓은근을 통해 무릎 정렬을 교정합니다.", duration: "15회 x 3세트" }
    ]
  };

  const addedRecs = new Set();
  for (const issue of issues) {
    const recs = recMap[issue.name] || [];
    for (const rec of recs) {
      if (!addedRecs.has(rec.title)) {
        recommendations.push({ ...rec, targetIssue: issue.name });
        addedRecs.add(rec.title);
      }
    }
  }
  if (recommendations.length === 0) {
    recommendations.push({ title: "기본 자세 가이드", description: "자주 스트레칭하고 올바른 자세를意识的으로 유지하세요.", duration: "하루 10분" });
  }

  // Progress tracking from localStorage history
  let progress = { hasHistory: false };
  try {
    const history = JSON.parse(localStorage.getItem("bodyCheckProgressHistory") || "[]");
    if (history.length > 0) {
      const last = history[history.length - 1];
      progress = {
        hasHistory: true,
        previousDate: last.date || "",
        previousScore: last.score || 0,
        currentScore: score,
        scoreChange: score - (last.score || 0),
        shoulderBalanceChange: last.shoulderBalance ? "이전 대비 변화 있음" : "변화 거의 없음",
        pelvicTiltChange: last.pelvicBalance ? "이전 대비 변화 있음" : "변화 거의 없음",
        forwardHeadChange: last.headNeck ? "이전 대비 변화 있음" : "변화 거의 없음"
      };
    }
    // Save current state to history
    history.push({
      date: new Date().toISOString().split("T")[0],
      score,
      shoulderBalance: shoulderBalance?.summary || null,
      pelvicBalance: pelvicBalance?.summary || null,
      headNeck: headNeckShape?.summary || null
    });
    // Keep last 10 entries
    if (history.length > 10) history.shift();
    localStorage.setItem("bodyCheckProgressHistory", JSON.stringify(history));
  } catch (_) {}

  return {
    score,
    status: overallStatus,
    summary,
    overviewComment: issues.length > 0
      ? `총 ${issues.length}개 항목에서 개선이 필요합니다.`
      : "측정 결과에서显著한异常가 발견되지 않았습니다.",
    posture,
    issues,
    recommendations: recommendations.slice(0, 5),
    lifestyleGuidance: computeLifestyleGuidance(issues),
    progress
  };
}

// ----------------------------------------------------------------------
// Personalized Lifestyle Guidance (AI-computed from measurement data)
// ----------------------------------------------------------------------
const LIFESTYLE_LIBRARY = {
  food: {
    거북목: [
      { title: "연어 음식 늘리기", description: "등푸드 등 생선, 견과류, 채소에 항산화물질이 풍부한 식품", severity: "주의" },
      { title: "칼슘·비타민D 섭취", description: "우유·치즈·두부로 칼슘 충족, 일광으로 비타민D 확보", severity: "주의" },
      { title: "인삼·녹차 적정 섭취", description: "체중 관리와 항산화에 도움", severity: "선호" }
    ],
    라운드숄더: [
      { title: "단백질 섭취 늘리기", description: "닭가슴살·콩·달걀로 근육 회복 도움", severity: "주의" },
      { title: "오메가3 섭취", description: "고등어·연어·호두로 근막 염증 완화", severity: "주의" },
      { title: "수분 8잔 이상", description: "근육·관절 조직의 대사 촉진", severity: "기본" }
    ],
    골반불균형: [
      { title: "철분·마그네슘 섭취", description: "시금치·바나나·견과류로 근육 이완 촉진", severity: "주의" },
      { title: "유산소 운동 병행", description: "주기적 걷기·조깅으로 골반 혈류 개선", severity: "주의" },
      { title: "무절제 지양", description: "장에 부담을 주지 않는 규칙적 식사", severity: "기본" }
    ],
    체중중심불균형: [
      { title: "체중 조절", description: "과체중 시 관절 부담 경감을 위해 단계적 감량", severity: "주의" },
      { title: "칼륨 섭취", description: "바나나·아보카도·콩으로 근육 기능 유지", severity: "선호" },
      { title: "짠 음식 줄이기", description: "나트륨 저감을 위한 가공식품 섭취 최소화", severity: "기본" }
    ],
    "O다리": [
      { title: "관절에 좋은 영양소", description: "닭꼬치·생선으로 콜라겐·글루코사민 섭취", severity: "주의" },
      { title: "칼슘·비타민C", description: "우유·귤·키위로 뼈·연골 건강 강화", severity: "주의" }
    ],
    "X다리": [
      { title: "단백질·콜라겐", description: "해물·채소로 연골 결합 조직 개선", severity: "주의" },
      { title: "엽산·비타민B", description: "블루베리·시금치·콩으로 조직 회복 촉진", severity: "선호" }
    ],
    기본: [
      { title: "하루 2L 이상 수분", description: "대사 촉진과 근육·관절 조직 수분 유지", severity: "기본" },
      { title: "규칙적 식사", description: "3시간 간격 균형 식사로 혈당·에너지 안정보", severity: "기본" },
      { title: "채소·과일 5가지 이상", description: "비타민·미네랄·식이섬유로 전신 건강 증진", severity: "기본" }
    ]
  },
  supplement: {
    거북목: [
      { title: "오메가3 (EPA/DHA)", description: "목·어깨 근막 염증 완화, 일 1,000mg 목표", severity: "주의", duration: "매일" },
      { title: "마그네슘", description: "근육 긴장 완화·수면 질 개선, 저녁 복용 권장", severity: "주의", duration: "매일" },
      { title: "비타민D + 칼슘", description: "경추 뼈 건강 유지, 일 800IU + 500mg", severity: "선호", duration: "매일" }
    ],
    라운드숄더: [
      { title: "커큐민", description: "항염증·통증 완화를 위한 항산화제", severity: "선호", duration: "매일" },
      { title: "글루코사민", description: "어깨 관절 연골 손상 방지·회복 지원", severity: "선호", duration: "매일" }
    ],
    골반불균형: [
      { title: "마그네슘", description: "장요근·둔근 이완, 신경 전달 개선", severity: "주의", duration: "매일" },
      { title: "아연 (Zinc)", description: "골반 근육 합성·회복 촉진", severity: "선호", duration: "매일" }
    ],
    체중중심불균형: [
      { title: "오메가3", description: "체지방 감소·항염증 효과, 일 2,000mg", severity: "주의", duration: "매일" },
      { title: "비타민B군", description: "에너지 대사·지구력 개선", severity: "선호", duration: "매일" }
    ],
    "O다리": [
      { title: "콜라겐 펩타이드", description: "무릎 연골 탄력성 개선", severity: "주의", duration: "매일" },
      { title: "MSM (메틸설포닐메탄)", description: "관절 통증 완화·조직 회복", severity: "주의", duration: "매일" }
    ],
    "X다리": [
      { title: "글루코사민 + MSM", description: "무릎 연골 지지·통증 완화", severity: "주의", duration: "매일" },
      { title: "비타민C + 히알루론산", description: "콜라겐 합성·관절 윤활 개선", severity: "선호", duration: "매일" }
    ],
    기본: [
      { title: "오메가3 (EPA/DHA)", description: "항염증·뇌 기능·눈 건강, 일 1,000mg", severity: "기본", duration: "매일" },
      { title: "비타민D3", description: "면역·뼈·근육 건강, 일 1,000~2,000IU", severity: "기본", duration: "매일" },
      { title: "마그네슘", description: "근육 이완·수면 질 개선, 취침 30분 전", severity: "기본", duration: "매일" }
    ]
  },
  habit: {
    거북목: [
      { title: "앉아서 30분마다 목 스트레칭", description: "목 힘을 빼고 귀를 어깨 쪽으로 부드럽게 기울이기", severity: "주의", duration: "30초 x 3" },
      { title: "책·모니터 눈높이 유지", description: "턱을 안쪽으로 넣고, 목을 중립 위치에 두기", severity: "주의", duration: "지속" },
      { title: "밤 베개 높낮이 조절", description: "목 정렬 유지, 너무 높지 않게", severity: "선호", duration: "수면" },
      { title: "핸드폰 사용할 때 목 각도 주의", description: "턱을 가슴 쪽으로 당기고, 15도 이하 유지", severity: "주의", duration: "지속" }
    ],
    라운드숄더: [
      { title: "앉은 자세 30분마다 일어서기", description: "기울어진 상체 세우기, 어깨 뒤로 끌어당기기", severity: "주의", duration: "1분" },
      { title: "가슴 열기 운동 하루 5분", description: "문틀에 기대어 양팔을 90도로 벌리기", severity: "주의", duration: "5분" },
      { title: "스트레칭 전 온罨包", description: "가슴·등 근육을 5분간温罨 후 운동 효과 배가", severity: "선호", duration: "5분" }
    ],
    골반불균형: [
      { title: "앉은 자세에서 고깔 넣고 교대", description: "엉덩이 근육 불균형 교정, 하루 10분", severity: "주의", duration: "10분" },
      { title: "계단 오르내리기", description: "좌우 다리 균형 감각 회복, 하루 5분", severity: "주의", duration: "5분" },
      { title: "서서看书時 체중 좌우 균등 분배", description: "발끝 방향同一, 5분마다 교대", severity: "선호", duration: "지속" }
    ],
    체중중심불균형: [
      { title: "한 발 서서 양치하기", description: "하지 근력·균형 감각 훈련, 하루 2분", severity: "주의", duration: "2분" },
      { title: "거울을 보며 자세 확인", description: "귀·어깨·골반이 한 줄 선상에 있는지 매일 확인", severity: "주의", duration: "1분" },
      { title: "무릎을 곧게 펴고 걷기", description: "발끝과 무릎 방향 일치, 의식적으로 걸으면 자연 교정", severity: "선호", duration: "지속" }
    ],
    "O다리": [
      { title: "앉아서 다리 모으기 운동", description: "무릎 사이 공간 줄이기 의식, 하루 5분", severity: "주의", duration: "5분" },
      { title: "수영", description: "관절 부담 없이 하지 근력 강화", severity: "선호", duration: "30분" }
    ],
    "X다리": [
      { title: "다리 십자 벌리기 운동", description: "트레이닝 밴드 활용, 무릎 정렬 회복", severity: "주의", duration: "5분" },
      { title: "굽 높은 신발 제한", description: "무릎 스트레스 감소, 낮게 안정적인 신발 우선", severity: "기본", duration: "지속" }
    ],
    기본: [
      { title: "하루 10분 스트레칭", description: "아침 눈 뜨고 뻗기·목 스트레칭 습관화", severity: "기본", duration: "10분" },
      { title: "8시간 수면 확보", description: "조직 회복·근성장 최적 시간 (22시~6시)", severity: "기본", duration: "8시간" },
      { title: "계단 사용 습관", description: "에스컬레이터 대신 계단, 하지 근육 자연 발달", severity: "기본", duration: "지속" },
      { title: "30분마다 물 한 잔", description: "수분 부족 예방, 작업 사이에喝水 리마인드", severity: "기본", duration: "매일 2L" }
    ]
  }
};

function computeLifestyleGuidance(issues) {
  const issueNames = new Set(issues.map(i => i.name));
  const issueSeverities = Object.fromEntries(issues.map(i => [i.name, i.status]));

  function pickFrom(category, key, count) {
    const severity = issueSeverities[key];
    const priority = severity === "개선 필요" ? 0 : severity === "주의" ? 1 : severity === "경미" ? 2 : 3;
    const src = LIFESTYLE_LIBRARY[category][key] || LIFESTYLE_LIBRARY[category]["기본"] || [];
    return src
      .filter(r => {
        const rPriority = r.severity === "주의" ? 0 : r.severity === "선호" ? 1 : 2;
        return rPriority <= priority + 1;
      })
      .slice(0, count);
  }

  // Gather recommendations per issue
  const food = [], supplement = [], habit = [];
  const seenFood = new Set(), seenSupp = new Set(), seenHabit = new Set();

  for (const issueName of issueNames) {
    const f = pickFrom("food", issueName, 2);
    const s = pickFrom("supplement", issueName, 1);
    const h = pickFrom("habit", issueName, 2);
    f.forEach(r => { if (!seenFood.has(r.title)) { food.push({ ...r, forIssue: issueName }); seenFood.add(r.title); } });
    s.forEach(r => { if (!seenSupp.has(r.title)) { supplement.push({ ...r, forIssue: issueName }); seenSupp.add(r.title); } });
    h.forEach(r => { if (!seenHabit.has(r.title)) { habit.push({ ...r, forIssue: issueName }); seenHabit.add(r.title); } });
  }

  // Fill up to 3 from each category from 기본 if not full
  for (const cat of ["food", "supplement", "habit"]) {
    const target = cat === "habit" ? habit : cat === "supplement" ? supplement : food;
    const seen = cat === "habit" ? seenHabit : cat === "supplement" ? seenSupp : seenFood;
    const src = LIFESTYLE_LIBRARY[cat]["기본"] || [];
    for (const r of src) {
      if (target.length >= 3) break;
      if (!seen.has(r.title)) { target.push({ ...r, forIssue: null }); seen.add(r.title); }
    }
  }

  return {
    food: food.slice(0, 3),
    supplement: supplement.slice(0, 3),
    habit: habit.slice(0, 3)
  };
}

// AI analysis state
const aiAnalysisState = {
  status: "idle", // idle | loading | success | error
  data: null,
  error: null
};

// ----------------------------------------------------------------------
// 1. Data Definitions (Anthropometry Focus)
// ----------------------------------------------------------------------
const DISPLAY_NAMES = {
  height: "anthro_height",
  shoulder_width: "anthro_shoulder",
  pelvis_width: "anthro_pelvis",
  arm_length: "anthro_arm",
  leg_length: "anthro_leg",
  torso_length: "anthro_torso",
  head_tilt: "hc_hd_tilt",
  shoulder_slope: "hc_sh_tilt",
  shoulder_balance: "hc_sh_balance",
  pelvic_balance: "hc_pl_balance",
  body_center: "hc_center_axis",
  lower_body_symmetry: "hc_leg_symmetry",
  knee_shape: "hc_knee_align",
  xo_leg: "hc_o_leg",
  head_neck_shape: "hc_turtle",
  cervical_alignment: "hc_cervical_align",
  shoulder_back_shape: "hc_round_shoulder",
  back_shape: "hc_sp_curv",
  lumbar_curve: "hc_lumbar_curve",
  pelvic_shape: "hc_pelvis_tilt",
  calf_shape: "hc_calf_shape",
  waist_shape: "hc_waist_shape"
};

const ANALYSIS_ORDER = [
  "height",
  "shoulder_width",
  "pelvis_width",
  "arm_length",
  "leg_length",
  "torso_length"
];

// Mini-Dashboard Elements (Mapping IDs to API keys)
const miniIds = {
  height: "mini_height",
  shoulder_width: "mini_shoulder_width",
  pelvis_width: "mini_pelvis_width",
  arm_length: "mini_arm_length",
  leg_length: "mini_leg_length",
  torso_length: "mini_torso_length"
};

const state = {
  enabled: false,
  data: null,
  livePoseData: null,
  overlayLandmarks: null,
  overlayAnalysis: null,
  overlayFrame: null,
  autoRotateModel: true,
  debugBoneOffsets: {},
  currentView: "front",
  selectedAnalysis: "head_tilt",
  showPoints: true,
  showLines: true,
  showGuides: true,
  livePoseTimer: null,
  livePoseBusy: false,
  aiSummary: "",
  aiSummaryLoading: false,
  aiSummaryError: false,
  aiSummaryRequestId: 0,
  workflow: {
    active: false,
    step: "idle",
    stableSince: null,
    frontCapture: null,
    sideCapture: null,
    requestedTurn: "right"
  },
  bodyModel: null,
  avatarModel: null
};

let modelScene = null;
let modelCamera = null;
let modelRenderer = null;
let modelMesh = null;
let modelWireframe = null;
let overlayGroup = null;
let avatarCache = null;
let isAvatarAnimating = false;
const overlayState = {
  boneDefaults: new Map()
};

const VIEW_NAMES = ["front", "right", "back", "left"];
const VIEW_LABELS = {
  front: "Front",
  right: "Right",
  back: "Back",
  left: "Left"
};
let multiViewCameras = {};
let multiViewRenderers = {};
let multiViewAnimationId = null;
let snapshotCaptureTimer = null;
let snapshotCaptureInFlight = false;
let snapshotCaptureQueuedReason = "";

const OVERLAY_COLORS = {
  normal: 0x22c55e,
  warning: 0xfacc15,
  bad: 0xef4444,
  reference: 0x38bdf8,
  text: "#f8fafc",
  halo: "rgba(8, 17, 31, 0.92)"
};

const OVERLAY_THRESHOLDS = {
  head_tilt: { warning: 4, bad: 8 },
  shoulder_slope: { warning: 3, bad: 6 },
  pelvic_balance: { warning: 3, bad: 6 },
  body_center: { warning: 0.035, bad: 0.07 }
};

const DEBUG_CONTROL_CONFIG = [
  { key: "twist_l", label: "Twist_l", bone: "Bip001_L_Thigh", mode: "position", axis: "x", min: -0.3, max: 0.3, step: 0.01, unit: "m" },
  { key: "twist_r", label: "Twist_r", bone: "Bip001_R_Thigh", mode: "position", axis: "x", min: -0.3, max: 0.3, step: 0.01, unit: "m" },
  { key: "shoulder_l_tilt", label: "Shoulder_l_tilt", bone: "Bip001_L_UpperArm", mode: "position", axis: "z", min: -0.3, max: 0.3, step: 0.01, unit: "m" },
  { key: "shoulder_r_tilt", label: "Shoulder_r_tilt", bone: "Bip001_R_UpperArm", mode: "position", axis: "z", min: -0.3, max: 0.3, step: 0.01, unit: "m" },
  { key: "clavicle_l", label: "Clavicle_l", bone: "Bip001_L_Clavicle", mode: "rotation", axis: "z", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "clavicle_r", label: "Clavicle_r", bone: "Bip001_R_Clavicle", mode: "rotation", axis: "z", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "shoulder_l", label: "Shoulder_l", bone: "Bip001_L_UpperArm", mode: "rotation", axis: "z", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "shoulder_r", label: "Shoulder_r", bone: "Bip001_R_UpperArm", mode: "rotation", axis: "z", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "head_pitch", label: "Head Pitch", bone: "Bip001_Head", mode: "rotation", axis: "z", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "head_roll", label: "Head Roll", bone: "Bip001_Head", mode: "rotation", axis: "y", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "neck_pitch", label: "Neck Pitch", bone: "Bip001_Neck", mode: "rotation", axis: "z", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "neck_roll", label: "Neck Roll", bone: "Bip001_Neck", mode: "rotation", axis: "y", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "pelvis_pitch", label: "Pelvis Pitch", bone: "Bip001_Pelvis", mode: "rotation", axis: "z", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "pelvis_roll", label: "Pelvis Roll", bone: "Bip001_Pelvis", mode: "rotation", axis: "y", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "l_thigh_roll", label: "L Thigh Roll", bone: "Bip001_L_Thigh", mode: "rotation", axis: "y", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "r_thigh_roll", label: "R Thigh Roll", bone: "Bip001_R_Thigh", mode: "rotation", axis: "y", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "l_calf_roll", label: "L Calf Roll", bone: "Bip001_L_Calf", mode: "rotation", axis: "y", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "r_calf_roll", label: "R Calf Roll", bone: "Bip001_R_Calf", mode: "rotation", axis: "y", min: -30, max: 30, step: 1, unit: "deg" },
  { key: "spine_roll", label: "Spine Roll", bone: "Bip001_Spine", mode: "rotation", axis: "y", min: -25, max: 25, step: 1, unit: "deg" },
  { key: "spine_pitch", label: "Spine Pitch", bone: "Bip001_Spine", mode: "rotation", axis: "z", min: -25, max: 25, step: 1, unit: "deg" },
  { key: "spine1_roll", label: "Spine1 Roll", bone: "Bip001_Spine1", mode: "rotation", axis: "y", min: -25, max: 25, step: 1, unit: "deg" },
  { key: "spine1_pitch", label: "Spine1 Pitch", bone: "Bip001_Spine1", mode: "rotation", axis: "z", min: -25, max: 25, step: 1, unit: "deg" },
  { key: "spine2_roll", label: "Spine2 Roll", bone: "Bip001_Spine2", mode: "rotation", axis: "y", min: -25, max: 25, step: 1, unit: "deg" },
  { key: "spine2_pitch", label: "Spine2 Pitch", bone: "Bip001_Spine2", mode: "rotation", axis: "z", min: -25, max: 25, step: 1, unit: "deg" }
];

const DEBUG_CONTROL_DEFAULTS = Object.fromEntries(DEBUG_CONTROL_CONFIG.map(item => [item.key, 0]));
state.debugBoneOffsets = { ...DEBUG_CONTROL_DEFAULTS };

const btnAgent = document.getElementById("btnAgent");
const actionMessageBox = document.getElementById("actionMessageBox");
const actionMessageText = document.getElementById("actionMessageText");
const actionMessageIcon = document.getElementById("actionMessageIcon");
const guideOverlayEl = document.getElementById("guideOverlay");



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
  analysisSelectEl.innerHTML = ANALYSIS_ORDER.map(key => `<option value="${key}">${t(DISPLAY_NAMES[key])}</option>`).join("");
  analysisSelectEl.value = state.selectedAnalysis;
}

function startLiveView() {
  setSystemStatus("Mock Live View");
}

function stopLiveView() {
  setSystemStatus("System Ready");
}

// fetchJson / startLivePosePolling removed — use Api.* from /ui/lib/api.js

/**
 * Helper to fetch localized strings from global translations
 */
function t(key) {
  const lang = localStorage.getItem('appLang') || 'kr';
  const pack = window.translations?.[lang] || {};
  return pack[key] || key;
}

function getStoredBodyCheckReport() {
  const saved = localStorage.getItem('bodyCheckReport');
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch (err) {
    console.error("Failed to parse bodyCheckReport", err);
    return null;
  }
}

function saveBodyCheckReport(reportData) {
  localStorage.setItem('bodyCheckReport', JSON.stringify(reportData));
}

function buildBodySummaryPayload(reportData) {
  const front = reportData?.front || {};
  const side = reportData?.side || {};

  return {
    module: "body",
    mode: "workflow_complete",
    requested_view: "front+side",
    front,
    side,
    analysis: reportData?.mergedAnalysis || {},
    body_model: reportData?.bodyModel || reportData?.body_model || null,
    summary: {
      front_view: front?.view_detection?.view || "unknown",
      side_view: side?.view_detection?.view || "unknown",
      front_capture_ok: !!front?.quality?.capture_ok,
      side_capture_ok: !!side?.quality?.capture_ok
    }
  };
}

function syncAiSummaryState(reportData) {
  const aiSummary = reportData?.aiSummary || {};
  state.aiSummary = typeof aiSummary.summary === "string" ? aiSummary.summary : "";
  state.aiSummaryLoading = aiSummary.status === "loading";
  state.aiSummaryError = aiSummary.status === "error";
}

function renderAiSummarySection() {
  const statusEl = document.getElementById("aiSummaryStatus");
  const statusTextEl = statusEl?.querySelector("span");
  const loadingEl = document.getElementById("aiSummaryLoading");
  const contentEl = document.getElementById("anthroAiSummaryContent");
  if (!statusEl || !statusTextEl || !loadingEl || !contentEl) return;

  statusEl.classList.remove("error");
  contentEl.classList.remove("error");

  if (state.aiSummaryLoading) {
    statusTextEl.textContent = "분석 중";
    loadingEl.classList.remove("hidden");
    contentEl.textContent = "AI 분석 결과를 준비중입니다.";
    return;
  }

  loadingEl.classList.add("hidden");

  if (state.aiSummaryError || !state.aiSummary) {
    statusEl.classList.add("error");
    contentEl.classList.add("error");
    statusTextEl.textContent = "불러오기 실패";
    contentEl.textContent = AI_SUMMARY_FALLBACK;
    return;
  }

  statusTextEl.textContent = "분석 완료";
  contentEl.textContent = state.aiSummary;
}

async function ensureAiSummary(reportData) {
  if (!reportData) return;

  const cachedSummary = reportData?.aiSummary?.summary;
  if (reportData?.aiSummary?.status === "done" && typeof cachedSummary === "string" && cachedSummary.trim()) {
    state.aiSummary = cachedSummary.trim();
    state.aiSummaryLoading = false;
    state.aiSummaryError = false;
    renderAiSummarySection();
    return;
  }

  const requestId = Date.now();
  state.aiSummaryRequestId = requestId;
  state.aiSummary = "";
  state.aiSummaryLoading = true;
  state.aiSummaryError = false;
  reportData.aiSummary = {
    status: "loading",
    summary: "",
    error: null
  };
  saveBodyCheckReport(reportData);
  renderAiSummarySection();

  try {
    const summaryData = await Api.bodySummary(buildBodySummaryPayload(reportData));

    if (state.aiSummaryRequestId !== requestId) return;

    const summaryText = typeof summaryData?.summary === "string" ? summaryData.summary.trim() : "";
    state.aiSummary = summaryText || AI_SUMMARY_FALLBACK;
    state.aiSummaryLoading = false;
    state.aiSummaryError = !summaryData?.success || !summaryText;
    reportData.aiSummary = {
      status: state.aiSummaryError ? "error" : "done",
      summary: state.aiSummary,
      error: summaryData?.error || null
    };
    saveBodyCheckReport(reportData);
    renderAiSummarySection();
  } catch (err) {
    if (state.aiSummaryRequestId !== requestId) return;

    state.aiSummary = AI_SUMMARY_FALLBACK;
    state.aiSummaryLoading = false;
    state.aiSummaryError = true;
    reportData.aiSummary = {
      status: "error",
      summary: AI_SUMMARY_FALLBACK,
      error: err.message
    };
    saveBodyCheckReport(reportData);
    renderAiSummarySection();
  }
}

async function analyze(view = "front") {
  if (!state.enabled) {
    showToast(t("hc_turn_on_agent") || "에이전트를 먼저 켜주세요.");
    return null;
  }
  try {
    state.currentView = view;
    setSystemStatus("Analysis Complete");
    const resLabel = t("hc_analysis_complete") || "Analysis Complete";
    showToast(`${resLabel}`);
    return { ok: true, view: view };
  } catch (err) {
    console.error(err);
    setSystemStatus("Error");
    showToast(t("hc_analysis_fail") || "분석 중 오류가 발생했습니다.");
    logLine(`analyze error: ${err.message}`);
    return null;
  }
}

// WEBCAM_MEASURE: reads from localStorage — no server call needed
async function loadLatest() {
  const saved = Api.loadMeasurementFromLocal();
  if (saved?.mergedAnalysis) {
    state.workflow._mergedAnalysis = saved.mergedAnalysis;
    logLine('[anthropometry] loadLatest: loaded from localStorage');
  } else {
    logLine('[anthropometry] loadLatest: no saved measurement found');
  }
}

async function applyData(data, view = "front") {
  state.data = data;
  state.currentView = view;
  renderAnalysisList();
  renderMiniValues();
}


function renderMiniValues() {
  const analysis = state.data?.analysis || {};
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
  const analysis = state.data?.analysis || {};

  analysisListEl.innerHTML = ANALYSIS_ORDER.map(key => {
    const item = analysis[key];
    const active = state.selectedAnalysis === key ? "active" : "";
    const nameKey = DISPLAY_NAMES[key];
    const name = t(nameKey);

    if (!item) return `<div class="analysis-item ${active}" data-key="${key}"><div class="analysis-top"><div class="analysis-name">${name}</div><div class="analysis-badge">no data</div></div></div>`;
    const badgeStr = item.enabled ? t("hc_badge_ready") : t("hc_badge_pending");
    const badge = item.enabled ? "ready" : "pending";
    return `
      <div class="analysis-item ${active}" data-key="${key}">
        <div class="analysis-top">
          <div class="analysis-name">${name}</div>
          <div class="analysis-badge">${badgeStr}</div>
        </div>
        <div class="analysis-meta">
          <div>view: ${item.view || "-"}</div>
          <div>type: ${item.type && t(`type_${item.type}`) !== `type_${item.type}` ? t(`type_${item.type}`) : item.type || "-"}</div>
          <div>grade: ${t(`grade_${item.grade}`) !== `grade_${item.grade}` ? t(`grade_${item.grade}`) : ({ "normal": "양호", "mild": "경미", "warning": "주의", "danger": "주의", "severe": "주의" }[item.grade] || item.grade || "-")}</div>
        </div>
        <div class="analysis-meta">
          <div>value: ${formatMetric(item.value, item.unit)}</div>
          <div>conf: ${formatNumber(item.confidence, 2)}</div>
          <div>${item.enabled ? t("hc_badge_available") : t("hc_badge_need_view")}</div>
        </div>
        <div class="analysis-summary">${item.summary || ""}</div>
      </div>`;
  }).join("");

  // Re-apply static translations if any
  if (window.applyTranslations) window.applyTranslations();

  document.querySelectorAll(".analysis-item").forEach(node => {
    node.addEventListener("click", () => {
      state.selectedAnalysis = node.dataset.key;
      const analysisSelectEl = document.getElementById("analysisSelect");
      if (analysisSelectEl) analysisSelectEl.value = state.selectedAnalysis;
      renderAnalysisList();
    });
  });
}

function formatNumber(v, digits = 1) {
  if (typeof v !== "number" || Number.isNaN(v)) return "-";
  return v.toFixed(digits);
}

function setupTabs() {
  const tabs = document.querySelectorAll("#hcCategoryTabs .nav-tab");
  const contents = document.querySelectorAll(".tab-content");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(tabEl => tabEl.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      const key = tab.dataset.tab;
      document.getElementById(`tab-${key}`)?.classList.add("active");
    });
  });
}

function resetUiState() {
  state.data = null;
  state.livePoseData = null;
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
  if (!["front", "unknown"].includes(view)) return false;

  const by = getByName(data);
  const ls = by.left_shoulder;
  const rs = by.right_shoulder;
  const lh = by.left_hip;
  const rh = by.right_hip;
  const nose = by.nose;

  if (!ls || !rs || !lh || !rh || !nose) return false;
  if (![ls, rs, lh, rh, nose].every(isVisible)) return false;

  const shoulderDiff = Math.abs(ls.y - rs.y);
  const hipDiff = Math.abs(lh.y - rh.y);
  const centerX = (ls.x + rs.x + lh.x + rh.x) / 4;
  const frameMidX = (data.frame?.width || 640) / 2;
  const centerDiff = Math.abs(centerX - frameMidX);

  return shoulderDiff < 24 && hipDiff < 26 && centerDiff < 120;
}

function isStableSidePose(data) {
  if (!data?.ok) return false;
  const view = data.view_detection?.view || "unknown";
  if (!["left_side", "right_side"].includes(view)) return false;

  const by = getByName(data);
  const nose = by.nose;
  const leftSet = [by.left_ear, by.left_shoulder, by.left_hip, by.left_knee, by.left_ankle].filter(Boolean);
  const rightSet = [by.right_ear, by.right_shoulder, by.right_hip, by.right_knee, by.right_ankle].filter(Boolean);
  const chain = leftSet.length >= rightSet.length ? leftSet : rightSet;

  if (!nose || chain.length < 4) return false;
  if (![nose, ...chain].every(isVisible)) return false;

  const shoulder = chain.find(p => p.name.includes("shoulder"));
  const hip = chain.find(p => p.name.includes("hip"));
  if (!shoulder || !hip) return false;

  return Math.abs(shoulder.x - hip.x) < 90;
}

function setWorkflowMessage(message, sub = "", icon = "fa-circle-info") {
  if (actionMessageText) {
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
    idle: t.hc_step_idle || "Idle",
    prepare: t.hc_step_prep_front || "Step 1: Prepare front capture",
    front_hold: t.hc_step_front_hold || "Step 1: Hold front pose",
    turn: t.hc_step_turn || "Step 2: Turn to side",
    side_hold: t.hc_step_side_hold || "Step 2: Hold side pose",
    analyzing: t.hc_step_analyzing || "Step 3: Analyzing",
    result: t.hc_step_result || "Done"
  };
  if (currentStepText) currentStepText.textContent = texts[step] || "";

  if (step === "idle" || step === "result" || step === "prepare" || step === "turn") {
    if (countdownOverlay) countdownOverlay.style.display = "none";
  }
}

function resetStableTimer() {
  state.workflow.stableSince = null;
  setWorkflowProgress(0);
}

function startWorkflow() {
  if (!state.enabled) {
    const lang = localStorage.getItem('appLang') || 'en';
    showToast(window.translations?.[lang]?.hc_turn_on_agent || "에이전트를 먼저 켜주세요.");
    return;
  }
  if (state.workflow.active) {
    stopWorkflow();
    return;
  }

  // Ensure report is hidden when starting new workflow
  document.getElementById("reportContainer")?.classList.add("hidden");
  document.getElementById("anthroStandardView")?.classList.remove("hidden");

  state.workflow.active = true;
  state.workflow.step = "prepare";
  state.workflow.frontCapture = null;
  state.workflow.sideCapture = null;
  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  btnMeasureStart.innerHTML = `<i class="fa-solid fa-stop"></i> <span id="btnMeasureText">${t.hc_measure_stop || "측정을 중지하면"}</span>`;
  btnMeasureStart.style.background = "rgba(239, 68, 68, 0.15)";
  btnMeasureStart.style.color = "#ef4444";
  btnMeasureStart.style.borderColor = "rgba(239, 68, 68, 0.4)";

  resetStableTimer();
  updateWorkflowUi("prepare");
  setWorkflowMessage("hc_guide_prep_pos", "", "fa-person");
  showToast(t.hc_track_waiting || "측정 위치에 서주세요.");
}

function stopWorkflow() {
  state.workflow.active = false;
  state.workflow.step = "idle";
  state.workflow.frontCapture = null;
  state.workflow.sideCapture = null;
  const lang = localStorage.getItem('appLang') || 'en';
  const t = window.translations?.[lang] || {};

  btnMeasureStart.innerHTML = `<i class="fa-solid fa-play"></i> <span id="btnMeasureText">${t.hc_measure_start || "측정을 다시 시작하세요"}</span>`;
  btnMeasureStart.style.background = "rgba(34, 197, 94, 0.15)";
  btnMeasureStart.style.color = "#4ade80";
  btnMeasureStart.style.borderColor = "rgba(34, 197, 94, 0.4)";

  resetStableTimer();
  updateWorkflowUi("idle");
  setWorkflowMessage("hc_turn_on_agent", "", "fa-hand-pointer");
}

async function tickWorkflow() {
  if (!state.workflow.active) return;
  const live = state.livePoseData;
  const now = Date.now();

  if (state.workflow.step === "prepare") {
    const liveOk = !!live?.ok;
    const landmarks = live?.pose?.landmarks || [];
    const detected = live?.pose?.detected;

    if (liveOk && detected && landmarks.length >= 8) {
      state.workflow.step = "front_hold";
      resetStableTimer();
      updateWorkflowUi("front_hold");
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
      setWorkflowMessage("hc_guide_shake", "", "fa-triangle-exclamation");
      if (countdownNumber) countdownNumber.textContent = "3";
      if (stepMask) stepMask.style.background = "rgba(239,68,68,0.3)";
      return;
    }
    if (stepMask) stepMask.style.background = "rgba(0,0,0,0.5)";
    if (!state.workflow.stableSince) state.workflow.stableSince = now;
    const elapsed = now - state.workflow.stableSince;
    setWorkflowProgress((elapsed / 3000) * 100);

    // Update countdown number
    let remain = Math.ceil((3000 - elapsed) / 1000);
    if (remain < 1) remain = 1;
    if (countdownNumber) countdownNumber.textContent = remain;

    if (elapsed >= 3000) {
      setWorkflowProgress(100);
      setWorkflowMessage("hc_guide_front_ok", "", "fa-check-circle");
      if (countdownOverlay) countdownOverlay.style.display = "none";
      if (stepMask) stepMask.style.background = "rgba(0,255,0,0.3)";

      const front = await analyze("front");
      state.workflow.frontCapture = front;
      state.workflow.step = "turn";
      resetStableTimer();
      updateWorkflowUi("turn");
      if (stepMask) setTimeout(() => stepMask.style.background = "transparent", 500);
    }
    return;
  }

  if (state.workflow.step === "turn") {
    setWorkflowMessage("hc_guide_turn_right", "", "fa-rotate-right");
    if (isStableSidePose(live)) {
      state.workflow.step = "side_hold";
      resetStableTimer();
      updateWorkflowUi("side_hold");
      setWorkflowMessage("hc_guide_side_hold", "", "fa-camera");
      if (countdownOverlay) countdownOverlay.style.display = "flex";
    }
    return;
  }

  if (state.workflow.step === "side_hold") {
    if (!isStableSidePose(live)) {
      resetStableTimer();
      setWorkflowMessage("hc_guide_side_shake", "", "fa-triangle-exclamation");
      if (countdownNumber) countdownNumber.textContent = "3";
      if (stepMask) stepMask.style.background = "rgba(239,68,68,0.3)";
      return;
    }
    if (stepMask) stepMask.style.background = "rgba(0,0,0,0.5)";
    if (!state.workflow.stableSince) state.workflow.stableSince = now;
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
      updateWorkflowUi("analyzing");
      setWorkflowMessage("hc_guide_analyzing", "", "fa-spinner fa-spin");

      const side = await analyze("side");
      state.workflow.sideCapture = side;
      buildCompositeReport();

      state.workflow.step = "result";
      updateWorkflowUi("result");
      setWorkflowMessage("hc_guide_done", "", "fa-clipboard-check");
      state.workflow.active = false;
      resetStableTimer();
      if (stepMask) setTimeout(() => stepMask.style.background = "transparent", 500);

      setTimeout(() => stopWorkflow(), 3000);

      // Save to Database
      await saveWorkflowResult(state.workflow.frontCapture, state.workflow.sideCapture);
    }
  }
}

function buildCompositeReport() {
  const front = state.workflow.frontCapture?.analysis || {};
  const side = state.workflow.sideCapture?.analysis || {};

  const merged = state.workflow._mergedAnalysis || {};

  function getBest(key) {
    const allCandidates = [front[key], side[key], merged[key]];
    if (state.data && state.data.analysis) {
      allCandidates.push(state.data.analysis[key]);
    }
    const valid = allCandidates.filter(Boolean);
    return valid.find(c => c.enabled === true) || valid.find(c => c.value != null) || valid[0];
  }

  const allItems = [
    "head_tilt", "shoulder_slope", "shoulder_balance", "pelvic_balance",
    "body_center", "knee_shape", "xo_leg", "waist_shape", "calf_shape",
    "head_neck_shape", "cervical_alignment", "shoulder_back_shape",
    "back_shape", "pelvic_shape", "lumbar_curve"
  ].map(k => [k, getBest(k)]);

  const evaluatedItems = allItems.filter(([, item]) => item && item.value != null && item.grade);
  if (evaluatedItems.length === 0 && state.data && state.data.analysis) {
    const backupAll = [
      "head_tilt", "shoulder_slope", "shoulder_balance", "pelvic_balance",
      "body_center", "knee_shape", "xo_leg", "waist_shape", "calf_shape",
      "head_neck_shape", "cervical_alignment", "shoulder_back_shape",
      "back_shape", "pelvic_shape", "lumbar_curve"
    ].map(k => [k, state.data.analysis[k]]);
    evaluatedItems.push(...backupAll.filter(([, item]) => item && item.value != null && item.grade));
  }

  renderReportView(evaluatedItems, front, side, merged);
}

const POSTURE_FRONT_KEYS = [
  "head_tilt", "shoulder_slope", "shoulder_balance", "pelvic_balance",
  "body_center", "lower_body_symmetry", "knee_shape", "xo_leg", "waist_shape", "calf_shape"
];

const POSTURE_SIDE_KEYS = [
  "head_neck_shape", "cervical_alignment", "shoulder_back_shape",
  "back_shape", "pelvic_shape", "lumbar_curve"
];

// Normal ranges and display metadata for anthropometric measurements
// Based on general adult reference ranges (Korean/Asian population averages)
const ANTHRO_NORMALS = {
  height:         { min: 155, max: 185, unit: "cm", label: "신장",       avg: 170, decimals: 1, description: "Height" },
  shoulder_width: { min: 38,  max: 48,  unit: "cm", label: "어깨 너비",  avg: 43,  decimals: 1, description: "Shoulder Width" },
  pelvis_width:   { min: 26,  max: 34,  unit: "cm", label: "골반 너비",  avg: 30,  decimals: 1, description: "Pelvis Width" },
  arm_length:     { min: 52,  max: 68,  unit: "cm", label: "팔 길이",    avg: 60,  decimals: 1, description: "Arm Length" },
  leg_length:     { min: 75,  max: 98,  unit: "cm", label: "다리 길이",  avg: 86,  decimals: 1, description: "Leg Length" },
  torso_length:   { min: 68,  max: 84,  unit: "cm", label: "체간 길이",  avg: 76,  decimals: 1, description: "Torso Length" },
};

const ANTHRO_KEYS = [
  "height", "shoulder_width", "pelvis_width", "arm_length", "leg_length", "torso_length"
];

function renderReportView(_items, front, side, merged = {}) {
  const reportContainer = document.getElementById("reportContainer");
  const standardView = document.getElementById("anthroStandardView");
  if (!reportContainer || !standardView) return;

  standardView.classList.add("hidden");
  reportContainer.classList.remove("hidden");

  function getBestForView(key, ...sources) {
    const all = sources.map(src => src?.[key]).filter(Boolean);
    return all.find(c => c.enabled === true) ||
      all.find(c => c.value != null) ||
      all[0];
  }

  renderAnthroMetricCards(front, side, merged);

  const frontAnalysisItems = POSTURE_FRONT_KEYS
    .map(k => [k, getBestForView(k, front, merged, state.data?.analysis)])
    .filter(([k, v]) => v && (v.enabled || v.value != null));
  renderMetricList("frontMetricsList", frontAnalysisItems);

  const sideAnalysisItems = POSTURE_SIDE_KEYS
    .map(k => [k, getBestForView(k, side, merged, state.data?.analysis)])
    .filter(([k, v]) => v && (v.enabled || v.value != null));
  renderMetricList("sideMetricsList", sideAnalysisItems);

  // 3. Posture Grid - SHOW ALL 16 METRICS
  const allPostureItems = [...POSTURE_FRONT_KEYS, ...POSTURE_SIDE_KEYS].map(k => {
    const primarySrc = POSTURE_SIDE_KEYS.includes(k) ? [side, front] : [front, side];
    const data = getBestForView(k, ...primarySrc, merged, state.data?.analysis);
    return [k, data];
  }).filter(([k, v]) => v && (v.enabled || v.value != null));

  renderPostureCards(allPostureItems);

  // 4. Visual Analysis (Images)
  drawReportImages();

  // 5. Recommendations
  renderRecommendations();

  // 6. Request AI Analysis (computed from real measured posture data)
  requestAiAnalysis({
    evaluatedItems: allPostureItems,
    front: state.workflow.frontCapture?.analysis || {},
    side: state.workflow.sideCapture?.analysis || {}
  });

  // Sync static elements
  if (window.applyTranslations) window.applyTranslations();
}

function renderAnthroMetricCards(front, side, merged = {}) {
  const container = document.getElementById("anthroMetricCards");
  if (!container) return;

  function getBestMetric(key) {
    const candidates = [merged?.[key], front?.[key], side?.[key], state.data?.analysis?.[key]].filter(Boolean);
    return candidates.find(item => item.enabled === true) ||
      candidates.find(item => item.value != null) ||
      candidates[0] ||
      null;
  }

  container.innerHTML = ANTHRO_KEYS.map((key, idx) => {
    const item = getBestMetric(key);
    const ref = ANTHRO_NORMALS[key] || {};
    const label = t(DISPLAY_NAMES[key]) !== DISPLAY_NAMES[key] ? t(DISPLAY_NAMES[key]) : DISPLAY_NAMES[key];
    const rawValue = item?.value != null ? parseFloat(item.value) : null;
    const viewLabel = item?.view === "front" ? "정면" : item?.view === "side" ? "측면" : "병합";

    // Value display
    const valueStr = rawValue != null ? rawValue.toFixed(ref.decimals ?? 1) : "--";

    // Range indicator
    let barPct = 50;
    let barColor = "#4ade80"; // default green
    let deviationLabel = "";

    if (rawValue != null && ref.min != null && ref.max != null) {
      const range = ref.max - ref.min;
      const normalized = (rawValue - ref.min) / range;
      barPct = Math.round(4 + normalized * 92);
      barPct = Math.max(4, Math.min(96, barPct));

      // Color: green if in range, warm amber if outside
      if (rawValue < ref.min || rawValue > ref.max) {
        barColor = "#fb923c"; // amber — value outside normal range
        if (rawValue < ref.min) {
          deviationLabel = `정상보다 ${(ref.min - rawValue).toFixed(1)}${ref.unit} 낮음 ↓`;
        } else {
          deviationLabel = `정상보다 ${(rawValue - ref.max).toFixed(1)}${ref.unit} 높음 ↑`;
        }
      } else {
        barColor = "#4ade80"; // green — in normal range
        const avg = ref.avg;
        const diff = rawValue - avg;
        if (Math.abs(diff) < 0.5) {
          deviationLabel = "정상 범위 내 · 평균과 유사";
        } else if (diff > 0) {
          deviationLabel = `정상 범위 내 · 평균보다 ${diff.toFixed(1)}${ref.unit} 높음`;
        } else {
          deviationLabel = `정상 범위 내 · 평균보다 ${Math.abs(diff).toFixed(1)}${ref.unit} 낮음`;
        }
      }
    } else if (rawValue == null) {
      deviationLabel = "측정값 없음";
      barColor = "#334155"; // muted grey
    }

    const rangeLabel = ref.min != null && ref.max != null
      ? `정상 범위: ${ref.min}–${ref.max} ${ref.unit}`
      : "";

    return `
      <div class="anthro-metric-card" style="animation-delay: ${idx * 60}ms">
        <div class="anthro-card-top">
          <div class="anthro-card-label">${label}</div>
        </div>
        <div class="anthro-card-value" style="color: ${barColor}">
          ${valueStr}
          <span class="anthro-unit">${ref.unit || ""}</span>
        </div>
        <div class="anthro-card-source">${viewLabel} 측정값</div>
        <div class="anthro-range-bar">
          <div class="anthro-range-zones">
            <div class="anthro-zone zone-low" title="낮은 범위"></div>
            <div class="anthro-zone zone-normal" title="정상 범위"></div>
            <div class="anthro-zone zone-high" title="높은 범위"></div>
          </div>
          <div class="anthro-range-pointer" style="left: ${barPct}%; background: ${barColor}; box-shadow: 0 0 8px ${barColor}66;"></div>
          <div class="anthro-range-labels">
            <span>${ref.min ?? 0}${ref.unit || ""}</span>
            <span class="anthro-avg-label">${ref.avg ?? ""}${ref.unit || ""}</span>
            <span>${ref.max ?? 100}${ref.unit || ""}</span>
          </div>
        </div>
        <div class="anthro-deviation">${deviationLabel}</div>
        ${rangeLabel ? `<div class="anthro-range-note">${rangeLabel}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderMetricList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = items.map(([key, item]) => {
    const nameKey = DISPLAY_NAMES[key] || key;
    const nameStrFallback = t(nameKey) !== nameKey ? t(nameKey) : nameKey;
    const name = nameStrFallback;
    const gradeClass = item.grade === "normal" ? "grade-normal" : (item.grade === "mild" || item.grade === "warning" ? "grade-mild" : "grade-moderate");
    const gradeTextFallback = { "normal": "양호", "mild": "경미", "warning": "주의", "danger": "주의", "severe": "주의" }[item.grade] || item.grade || "";
    const gradeText = t(`grade_${item.grade}`) !== `grade_${item.grade}` ? t(`grade_${item.grade}`) : gradeTextFallback;

    const isPosture = [...POSTURE_FRONT_KEYS, ...POSTURE_SIDE_KEYS].includes(key);
    const formattedVal = formatMetric(item.value, item.unit);

    const typeTranslations = { "neutral": "중립", "turtle": "거북목", "straight": "일자목" };
    const displayType = typeTranslations[item.type] || item.type || "";
    let sliderHtml = '';

    if (isPosture) {
      let pointerPos = 50;
      if (item.value != null && !Number.isNaN(parseFloat(item.value))) {
        const val = parseFloat(item.value);
        let displayVal = val;
        const type = item.type || "";
        if (type.includes("left") || type.includes("forward") || type.includes("front")) displayVal = -Math.abs(val);
        else if (type.includes("right") || type.includes("backward") || type.includes("back")) displayVal = Math.abs(val);

        const sign = displayVal < 0 ? -1 : (displayVal > 0 ? 1 : 0);
        if (item.grade === "normal") {
          pointerPos = 50 + (sign * 8);
          if (Math.abs(val) < 0.1) pointerPos = 50;
        } else if (item.grade === "mild" || item.grade === "warning") {
          pointerPos = 50 + (sign * 25);
        } else {
          pointerPos = 50 + (sign * 42);
        }
      }

      const isLR = (key.includes("tilt") || key.includes("balance") || key.includes("slope"));
      const leftLabelFallback = isLR ? "왼쪽" : "전방";
      const rightLabelFallback = isLR ? "오른쪽" : "후방";
      const leftLabel = t(isLR ? "hc_left" : "hc_forward") !== (isLR ? "hc_left" : "hc_forward") ? t(isLR ? "hc_left" : "hc_forward") : leftLabelFallback;
      const rightLabel = t(isLR ? "hc_right" : "hc_backward") !== (isLR ? "hc_right" : "hc_backward") ? t(isLR ? "hc_right" : "hc_backward") : rightLabelFallback;

      const pointerLabelText = item.value != null ? `${formattedVal} ${gradeText}` : gradeText;

      sliderHtml = `
            <div class="metric-slider-container" style="flex:1;">
                <div class="metric-slider-pointer" style="left: ${pointerPos}%">
                    <div class="pointer-label">${pointerLabelText}</div>
                </div>
                <div class="metric-slider-bar"></div>
                <div class="metric-slider-labels">
                    <span>${leftLabel}</span>
                    <span>0</span>
                    <span>${rightLabel}</span>
                </div>
            </div>
            `;
    } else {

      sliderHtml = `
            <div class="metric-val-display" style="display:flex; align-items:center; justify-content:space-between; padding: 8px 0;">
                <div class="metric-val" style="color: var(--intel-cyan); font-size: 20px; font-weight: 700; font-family: 'Share Tech Mono', monospace;">${formattedVal}</div>
                <div class="metric-grade ${gradeClass}" style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${gradeText}</div>
            </div>
            `;
    }
    return `
            <div class="metric-card">
                <div class="metric-info">
                    <div class="metric-name" style="font-size: 14px; font-weight: 700; color: white;">${name}</div>
                    <div class="metric-label" style="font-size: 11px; color: rgba(255,255,255,0.5);">${item.type ? (t(`type_${item.type}`) !== `type_${item.type}` ? t(`type_${item.type}`) : displayType) : ""}</div>
                </div>
                ${sliderHtml}
            </div>
        `;
  }).join("");
}

function renderPostureCards(items) {
  const grid = document.getElementById("postureGrid");
  if (!grid) return;

  grid.innerHTML = items.map(([key, item]) => {
    const suffix = getPostureGradeSuffix(item, key);
    const imgSrc = `/ui/images/${key}_${suffix}.png`;
    const titleKey = DISPLAY_NAMES[key] || key;
    const title = t(titleKey);
    const gradeClass = item.grade === "normal" ? "grade-normal" : (item.grade === "mild" || item.grade === "warning" ? "grade-mild" : "grade-moderate");
    const gradeText = t(`grade_${item.grade}`);
    const valStr = formatMetric(item.value, item.unit);

    return `
            <div class="posture-card">
                <div class="posture-img-box">
                    <img class="posture-card-img" src="${imgSrc}" alt="${title}" onerror="this.src='/ui/images/body_check.png'">
                </div>
                <div class="posture-card-info">
                    <div class="posture-card-title">${title}</div>
                    <div class="posture-card-grade ${gradeClass}">${gradeText}</div>
                    <div class="posture-card-desc">${valStr} - ${item.summary || ""}</div>
                </div>
            </div>
        `;
  }).join("");
}

function getPostureGradeSuffix(item, key) {
  const type = item.type || "";
  const directionalMetrics = ["head_tilt", "pelvic_balance", "lower_body_symmetry", "body_center", "shoulder_balance", "shoulder_slope"];
  if (directionalMetrics.includes(key)) {
    if (type.includes("left") || type.includes("long") && type.includes("left")) return 1;
    if (type.includes("right") || type.includes("long") && type.includes("right")) return 3;
    if (type === "neutral" || type === "center" || type === "balanced" || type === "symmetric") return 2;
  }
  if (item.grade === "normal") return 2;
  if (item.grade === "mild" || item.grade === "warning") return 1;
  if (item.grade === "moderate" || item.grade === "danger") return 3;
  return 2;
}

function drawReportImages() {
  const frontImg = document.getElementById("frontReportImage");
  const sideImg = document.getElementById("sideReportImage");

  // WEBCAM_MEASURE: use captured images from localStorage; no RealSense server needed
  let reportData = null;
  try {
    const saved = localStorage.getItem('bodyCheckReport');
    if (saved) reportData = JSON.parse(saved);
  } catch {}

  const frontImgUrl = reportData?.frontImage || reportData?.front?.imageDataUrl;
  const sideImgUrl = reportData?.sideImage || reportData?.side?.imageDataUrl;

  if (frontImg) {
    if (frontImgUrl) {
      frontImg.src = frontImgUrl;
      frontImg.style.display = "";
    } else {
      frontImg.style.display = "none";
    }
  }
  if (sideImg) {
    if (sideImgUrl) {
      sideImg.src = sideImgUrl;
      sideImg.style.display = "";
    } else {
      sideImg.style.display = "none";
    }
  }
}

// drawReportCanvas — REMOVED (dead, was RealSense /frames/ server endpoint, webcam uses drawReportImages)

function renderCharts(items) {
  const container = document.getElementById("bodyPartCharts");
  if (!container) return;

  // Add 2-column grid styling dynamically if not in CSS
  container.style.display = "grid";
  container.style.gridTemplateColumns = "repeat(2, 1fr)";
  container.style.gap = "16px";

  container.innerHTML = items.map(([key, item]) => {
    const val = item.value || 0;
    const gradeClass = item.grade === "normal" ? "normal" : (item.grade === "mild" || item.grade === "warning" ? "warning" : "danger");
    // Health score bar width: 100% for normal, 60% for warning, 25% for danger.
    const percent = gradeClass === "normal" ? 100 : (gradeClass === "warning" ? 60 : 25);

    const typeStr = item.type && t(`type_${item.type}`) !== `type_${item.type}` ? t(`type_${item.type}`) : (item.type || "");
    const gradeStr = t(`grade_${item.grade}`) !== `grade_${item.grade}` ? t(`grade_${item.grade}`) : ({ "normal": "양호", "mild": "경미", "warning": "주의", "danger": "주의", "severe": "주의" }[item.grade] || item.grade || "");
    const nameStr = t(DISPLAY_NAMES[key] || key) !== (DISPLAY_NAMES[key] || key) ? t(DISPLAY_NAMES[key] || key) : (DISPLAY_NAMES[key] || key);

    return `
      <div class="chart-item">
        <div class="chart-header">
            <span>${nameStr}</span>
            <span>${formatMetric(item.value, item.unit)} ${typeStr ? `(${typeStr})` : ""} - <span class="grade-text-${gradeClass}">${gradeStr}</span></span>
        </div>
        <div class="chart-bar-bg">
            <div class="chart-bar-fill ${gradeClass}" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderRecommendations() {
  const thumbContainer = document.getElementById("exerciseThumbs");
  if (!thumbContainer) return;

  const exercises = [
    { title: t("anthro_exercise_neck") || "목 스트레칭", img: "https://img.youtube.com/vi/gchSew7gCCU/mqdefault.jpg", url: "https://www.youtube.com/shorts/gchSew7gCCU" },
    { title: t("anthro_exercise_back") || "등 스트레칭", img: "https://img.youtube.com/vi/aj8pFGcxSdE/mqdefault.jpg", url: "https://www.youtube.com/shorts/aj8pFGcxSdE" },
    { title: t("anthro_exercise_shoulder") || "어깨 교정 운동", img: "https://img.youtube.com/vi/Nltpc0dFPVA/mqdefault.jpg", url: "https://www.youtube.com/shorts/Nltpc0dFPVA" }
  ];

  thumbContainer.innerHTML = exercises.map(ex => `
    <a href="${ex.url}" target="_blank" class="thumb-item" style="text-decoration: none; display: block; position: relative; border-radius: 8px; overflow: hidden; background: #000; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s;">
        <img src="${ex.img}" alt="${ex.title}" style="width: 100%; height: auto; display: block; opacity: 0.8;">
        <div class="thumb-play" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 20px; text-shadow: 0 0 10px rgba(0,0,0,0.5);"><i class="fa-solid fa-circle-play"></i></div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 8px 4px 4px 4px; font-size: 11px; color: white; text-align: center; font-weight: 600;">${ex.title}</div>
    </a>
  `).join("");
}

// ----------------------------------------------------------------------
// AI Analysis Rendering Functions
// ----------------------------------------------------------------------
function showLoadingShimmer(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="ai-loading-shimmer">
      <div class="shimmer-row">
        <div class="shimmer-circle"></div>
        <div class="shimmer-block w-60"></div>
      </div>
      <div class="shimmer-block w-80"></div>
      <div class="shimmer-block w-100"></div>
      <div class="shimmer-row">
        <div class="shimmer-block w-40"></div>
        <div class="shimmer-block w-60"></div>
      </div>
    </div>
  `;
}

function showErrorState(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="ai-error-state">
      <i class="fa-solid fa-circle-exclamation"></i>
      <span>${message}</span>
    </div>
  `;
}

function showEmptyState(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="progress-empty-state">
      <i class="fa-solid fa-chart-line"></i>
      <p>${message}</p>
    </div>
  `;
}

function renderAiOverview(data) {
  const container = document.getElementById("aiOverviewContent");
  if (!container) return;

  const score = data.score || 0;
  const statusClass = score >= 85 ? "status-normal" : score >= 70 ? "status-caution" : "status-warning";
  const statusLabel = score >= 85 ? "정상" : score >= 70 ? "주의" : "개선 필요";
  const statusIcon = score >= 85 ? "fa-check-circle" : score >= 70 ? "fa-exclamation-circle" : "fa-xmark-circle";

  container.innerHTML = `
    <div class="ai-overview-score-row">
      <div class="ai-overview-score-circle" style="--score: ${score}">
        <div class="ai-overview-score-value">${score}</div>
        <div class="ai-overview-score-label">점</div>
      </div>
      <div class="ai-overview-meta">
        <div class="ai-overview-status-badge ${statusClass}">
          <i class="fa-solid ${statusIcon}"></i>
          <span>${statusLabel}</span>
        </div>
        <div class="ai-overview-summary">${data.summary || ""}</div>
        <div class="ai-overview-interpretation">${data.overviewComment || ""}</div>
      </div>
    </div>
  `;
}

function renderAiPostureAnalysis(data) {
  const container = document.getElementById("aiPostureAnalysisContent");
  if (!container || !data.posture) return;

  const postureItems = [
    { label: "어깨 기울기", ...data.posture.shoulderTilt },
    { label: "골반 기울기", ...data.posture.pelvicTilt },
    { label: "목/머리 정렬", ...data.posture.neckTilt },
    { label: "좌우 균형", ...data.posture.balance }
  ];

  container.innerHTML = `
    <div class="posture-analysis-grid">
      ${postureItems.map(item => `
        <div class="posture-analysis-item">
          <div class="posture-analysis-label">${item.label}</div>
          <div class="posture-analysis-value">${item.value || "--"}</div>
          <div class="posture-analysis-interpretation">${item.interpretation || ""}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAiProblemPoints(data) {
  const container = document.getElementById("aiProblemPointsContent");
  if (!container || !data.issues) return;

  if (!data.issues.length) {
    container.innerHTML = `
      <div class="problem-points-list">
        <div class="problem-point-item" style="justify-content: center; color: #4ade80;">
          <i class="fa-solid fa-check-circle" style="font-size: 18px; margin-right: 8px;"></i>
          <span style="font-size: 14px; font-weight: 600;">주요 문제가 발견되지 않았습니다.</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="problem-points-list">
      ${data.issues.map(issue => {
        const iconClass = issue.status === "정상" ? "icon-normal" : issue.status === "경미" ? "icon-mild" : issue.status === "주의" ? "icon-caution" : "icon-warning";
        const statusClass = issue.status === "정상" ? "status-normal" : issue.status === "경미" ? "status-mild" : issue.status === "주의" ? "status-caution" : "status-warning";
        const confidencePct = issue.confidence != null ? Math.round(issue.confidence * 100) : null;
        return `
          <div class="problem-point-item">
            <div class="problem-point-icon ${iconClass}">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="problem-point-body">
              <div class="problem-point-header">
                <span class="problem-point-name">${issue.name}</span>
                <span class="problem-point-status ${statusClass}">${issue.status}</span>
                ${confidencePct ? `<span class="problem-point-confidence">${confidencePct}%</span>` : ""}
              </div>
              <div class="problem-point-description">${issue.description || ""}</div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderAiRecommendations(data) {
  const container = document.getElementById("aiRecommendationsContent");
  if (!container || !data.recommendations) return;

  const recIcons = ["fa-person", "fa-child-reaching", "fa-arrows-spin", "fa-dumbbell", "fa-feather"];

  container.innerHTML = `
    <div class="recommendations-grid">
      ${data.recommendations.slice(0, 5).map((rec, idx) => `
        <div class="recommendation-card">
          <div class="recommendation-header">
            <div class="recommendation-icon">
              <i class="fa-solid ${recIcons[idx % recIcons.length]}"></i>
            </div>
            <div class="recommendation-title">${rec.title || ""}</div>
          </div>
          <div class="recommendation-meta">
            ${rec.targetIssue ? `<span class="recommendation-tag">${rec.targetIssue}</span>` : ""}
            ${rec.duration ? `<span class="recommendation-duration"><i class="fa-regular fa-clock" style="margin-right:3px;"></i>${rec.duration}</span>` : ""}
          </div>
          <div class="recommendation-description">${rec.description || ""}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAiProgress(data) {
  const container = document.getElementById("aiProgressContent");
  if (!container) return;

  if (!data.progress || !data.progress.hasHistory) {
    showEmptyState("aiProgressContent", "이전 측정 기록이 없어 변화 추적 데이터가 없습니다.\n다음 측정부터 변화 추적이 제공됩니다.");
    return;
  }

  const p = data.progress;
  const scoreChange = p.scoreChange || 0;
  const changeClass = scoreChange > 0 ? "positive" : scoreChange < 0 ? "negative" : "neutral";
  const changeIcon = scoreChange > 0 ? "fa-arrow-up" : scoreChange < 0 ? "fa-arrow-down" : "fa-minus";
  const changeSign = scoreChange > 0 ? "+" : "";

  const detailItems = [
    { label: "어깨 균형", value: p.shoulderBalanceChange },
    { label: "골반 기울기", value: p.pelvicTiltChange },
    { label: "거북목 경향", value: p.forwardHeadChange }
  ];

  container.innerHTML = `
    <div class="progress-comparison">
      <div class="progress-score-card">
        <div class="progress-score-label">이전 점수</div>
        <div class="progress-score-value">${p.previousScore || "--"}</div>
        <div class="progress-score-date">${p.previousDate || ""}</div>
      </div>
      <div class="progress-score-card">
        <div class="progress-score-label">현재 점수</div>
        <div class="progress-score-value">${p.currentScore || "--"}</div>
        <div class="progress-score-date">오늘</div>
        <div class="progress-score-change ${changeClass}">
          <i class="fa-solid ${changeIcon}"></i>
          <span>${changeSign}${scoreChange}</span>
        </div>
      </div>
    </div>
    <div class="progress-details">
      ${detailItems.map(item => {
        const valClass = item.value && (item.value.includes("개선") || item.value.includes("좋아짐")) ? "improved" :
                        item.value && (item.value.includes("나빠짐") || item.value.includes("악화")) ? "worsened" : "unchanged";
        const valIcon = valClass === "improved" ? "fa-arrow-up" : valClass === "worsened" ? "fa-arrow-down" : "fa-minus";
        return `
          <div class="progress-detail-item">
            <span class="progress-detail-label">${item.label}</span>
            <span class="progress-detail-value ${valClass}">
              <i class="fa-solid ${valIcon}" style="font-size:10px;"></i>
              ${item.value || "변화 없음"}
            </span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderLifestyleGuidance(data) {
  const container = document.getElementById("lifestyleGuidanceContent");
  if (!container || !data) return;

  const { food = [], supplement = [], habit = [] } = data;
  const severityBadge = (sev) => {
    if (sev === "주의") return '<span class="sev-badge sev-warn">주의</span>';
    if (sev === "선호") return '<span class="sev-badge sev-opt">추천</span>';
    return '<span class="sev-badge sev-base">기본</span>';
  };

  const catIcon = (cat) => {
    if (cat === "food") return '<i class="fa-solid fa-carrot"></i>';
    if (cat === "supplement") return '<i class="fa-solid fa-capsules"></i>';
    return '<i class="fa-solid fa-heart-pulse"></i>';
  };

  const catTitle = (cat) => {
    if (cat === "food") return "식단 가이드";
    if (cat === "supplement") return "보충제";
    return "생활 습관";
  };

  const catColor = (cat) => {
    if (cat === "food") return "color:#f97316";
    if (cat === "supplement") return "color:#a855f7";
    return "color:#22c55e";
  };

  const sections = [
    { key: "food", items: food },
    { key: "supplement", items: supplement },
    { key: "habit", items: habit }
  ];

  container.innerHTML = `
    <div class="lifestyle-grid">
      ${sections.map(sec => `
        <div class="lifestyle-cat-card">
          <div class="lifestyle-cat-header" style="${catColor(sec.key)}">
            ${catIcon(sec.key)}
            <span>${catTitle(sec.key)}</span>
          </div>
          <div class="lifestyle-items">
            ${sec.items.length === 0 ? '<div class="lifestyle-empty">추천 없음</div>' : sec.items.map(item => `
              <div class="lifestyle-item">
                <div class="lifestyle-item-header">
                  <span class="lifestyle-item-title">${item.title}</span>
                  ${severityBadge(item.severity)}
                </div>
                <div class="lifestyle-item-desc">${item.description}</div>
                ${item.duration ? `<div class="lifestyle-item-meta"><i class="fa-regular fa-clock"></i> ${item.duration}</div>` : ""}
                ${item.forIssue ? `<div class="lifestyle-item-issue"><i class="fa-solid fa-link"></i> ${item.forIssue}</div>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function requestAiAnalysis({ evaluatedItems, front, side }) {
  const cardIds = ["aiOverviewCard", "aiPostureAnalysisCard", "aiProblemPointsCard", "aiRecommendationsCard", "aiProgressCard", "lifestyleGuidanceCard"];

  // Show all cards and set loading state
  cardIds.forEach(id => {
    const card = document.getElementById(id);
    if (card) card.classList.remove("hidden");
  });

  showLoadingShimmer("aiOverviewContent");
  showLoadingShimmer("aiPostureAnalysisContent");
  showLoadingShimmer("aiProblemPointsContent");
  showLoadingShimmer("aiRecommendationsContent");
  showLoadingShimmer("aiProgressContent");
  showLoadingShimmer("lifestyleGuidanceContent");

  aiAnalysisState.status = "loading";
  aiAnalysisState.data = null;
  aiAnalysisState.error = null;

  try {
    // Compute AI analysis from actual measured posture data
    const computed = computeAiAnalysisFromMeasurements(evaluatedItems, front, side);
    aiAnalysisState.data = computed;
    aiAnalysisState.status = "success";
  } catch (err) {
    console.error("[AI Analysis] Computation error:", err.message);
    aiAnalysisState.data = null;
    aiAnalysisState.error = err.message;
    aiAnalysisState.status = "error";
  }

  // Render all sections
  if (aiAnalysisState.status === "success" && aiAnalysisState.data) {
    renderAiOverview(aiAnalysisState.data);
    renderAiPostureAnalysis(aiAnalysisState.data);
    renderAiProblemPoints(aiAnalysisState.data);
    renderAiRecommendations(aiAnalysisState.data);
    renderAiProgress(aiAnalysisState.data);
    renderLifestyleGuidance(aiAnalysisState.data.lifestyleGuidance);
  } else {
    const msg = "측정 데이터로 분석을 생성하지 못했습니다.";
    showErrorState("aiOverviewContent", msg);
    showErrorState("aiPostureAnalysisContent", msg);
    showErrorState("aiProblemPointsContent", "문제 포인트 진단을 생성하지 못했습니다.");
    showErrorState("aiRecommendationsContent", "맞춤 개선 가이드를 생성하지 못했습니다.");
    showErrorState("aiProgressContent", "변화 추적 데이터를 생성하지 못했습니다.");
    showErrorState("lifestyleGuidanceContent", "맞춤 생활 가이드를 생성하지 못했습니다.");
  }
}

function loadBodyCheckReport() {
  const saved = localStorage.getItem('bodyCheckReport');
  if (!saved) {
    const lang = localStorage.getItem('appLang') || 'en';
    showToast(window.translations?.[lang]?.anthro_need_body_check || "바디체크를 먼저 진행해주세요.");
    return;
  }
  try {
    const reportData = JSON.parse(saved);
    state.workflow.frontCapture = reportData.front || {};
    state.workflow.sideCapture = reportData.side || {};
    const mergedAnalysis = reportData.mergedAnalysis || {};
    state.workflow._mergedAnalysis = mergedAnalysis;
    const storedBodyModel = reportData.bodyModel || reportData.body_model || null;
    const shouldRegenerateModel = isLegacyBodyModel(storedBodyModel);
    state.bodyModel = shouldRegenerateModel
      ? buildBodyModelFromAnalysis(mergedAnalysis) || storedBodyModel || null
      : storedBodyModel || buildBodyModelFromAnalysis(mergedAnalysis) || null;

    if (shouldRegenerateModel && state.bodyModel) {
      localStorage.setItem('bodyCheckReport', JSON.stringify({
        ...reportData,
        bodyModel: state.bodyModel
      }));
    }

    console.log('[Anthro] loadBodyCheckReport:');
    console.log('  front keys:', Object.keys(reportData.front?.analysis || {}));
    console.log('  side keys:', Object.keys(reportData.side?.analysis || {}));
    console.log('  mergedAnalysis keys:', Object.keys(reportData.mergedAnalysis || {}));
    const sampleKey = Object.keys(reportData.mergedAnalysis || {})[0];
    if (sampleKey) console.log('  sample merged item:', sampleKey, JSON.stringify(reportData.mergedAnalysis[sampleKey]));

    buildCompositeReport();
    syncMetricsToDebugControl();
    renderBodyModel(state.bodyModel);
  } catch (e) {
    console.error("Failed to parse bodyCheckReport", e);
  }
}

async function loadBodyCheckReportWithAi() {
  const reportData = getStoredBodyCheckReport();
  if (!reportData) {
    const lang = localStorage.getItem('appLang') || 'en';
    showToast(window.translations?.[lang]?.anthro_need_body_check || "바디체크를 먼저 진행해주세요.");
    return;
  }

  state.workflow.frontCapture = reportData.front || {};
  state.workflow.sideCapture = reportData.side || {};
  const mergedAnalysis = reportData.mergedAnalysis || {};
  state.workflow._mergedAnalysis = mergedAnalysis;
  syncAiSummaryState(reportData);

  const storedBodyModel = reportData.bodyModel || reportData.body_model || null;
  const shouldRegenerateModel = isLegacyBodyModel(storedBodyModel);
  state.bodyModel = shouldRegenerateModel
    ? buildBodyModelFromAnalysis(mergedAnalysis) || storedBodyModel || null
    : storedBodyModel || buildBodyModelFromAnalysis(mergedAnalysis) || null;

  if (shouldRegenerateModel && state.bodyModel) {
    reportData.bodyModel = state.bodyModel;
    saveBodyCheckReport(reportData);
  }

  console.log('[Anthro] loadBodyCheckReportWithAi:');
  console.log('  front keys:', Object.keys(reportData.front?.analysis || {}));
  console.log('  side keys:', Object.keys(reportData.side?.analysis || {}));
  console.log('  mergedAnalysis keys:', Object.keys(reportData.mergedAnalysis || {}));
  const sampleKey = Object.keys(reportData.mergedAnalysis || {})[0];
  if (sampleKey) console.log('  sample merged item:', sampleKey, JSON.stringify(reportData.mergedAnalysis[sampleKey]));

  buildCompositeReport();
  renderAiSummarySection();
  syncMetricsToDebugControl();
  renderBodyModel(state.bodyModel);
  await ensureAiSummary(reportData);
}

function isLegacyBodyModel(bodyModel) {
  if (!bodyModel || typeof bodyModel !== "object") return true;
  const modelType = String(bodyModel.type || "").toLowerCase();
  // Support both STAR and SMPL humanoid body v2 models
  return !modelType.includes("humanoid_body_v2") && !modelType.includes("star_template_body");
}

function ensureOverlayGroup() {
  if (!modelScene || overlayGroup) return overlayGroup;
  overlayGroup = new THREE.Group();
  overlayGroup.name = "bodycheckOverlayGroup";
  modelScene.add(overlayGroup);
  return overlayGroup;
}

function disposeOverlayObject(object) {
  if (!object) return;
  object.traverse(node => {
    if (node.geometry?.dispose) node.geometry.dispose();
    if (Array.isArray(node.material)) {
      node.material.forEach(material => material?.dispose?.());
    } else if (node.material?.dispose) {
      node.material.dispose();
    }
    if (node.userData?.texture?.dispose) node.userData.texture.dispose();
  });
}

function clearOverlayGroup() {
  if (!overlayGroup) return;
  while (overlayGroup.children.length) {
    const child = overlayGroup.children[0];
    overlayGroup.remove(child);
    disposeOverlayObject(child);
  }
}

function isPlainOverlayLandmarks(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return [
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "left_ear",
    "right_ear",
    "nose"
  ].some(key => {
    const point = value[key];
    return point && typeof point === "object" && "x" in point && "y" in point;
  });
}

function toNamedLandmarkMap(source) {
  if (!source) return null;
  if (Array.isArray(source)) {
    return Object.fromEntries(source.map(lm => [lm.name, lm]).filter(([name]) => !!name));
  }
  if (isPlainOverlayLandmarks(source)) return source;
  if (Array.isArray(source.pose?.landmarks)) {
    return Object.fromEntries(source.pose.landmarks.map(lm => [lm.name, lm]).filter(([name]) => !!name));
  }
  return null;
}

function getOverlaySource() {
  const explicitLandmarks = toNamedLandmarkMap(state.overlayLandmarks);
  if (explicitLandmarks) {
    return {
      landmarks: explicitLandmarks,
      analysis: state.overlayAnalysis || state.workflow?._mergedAnalysis || state.data?.analysis || {},
      frame: state.overlayFrame || state.data?.frame || {}
    };
  }

  const liveLandmarks = toNamedLandmarkMap(state.livePoseData);
  if (liveLandmarks) {
    return {
      landmarks: liveLandmarks,
      analysis: state.livePoseData?.analysis || state.workflow?._mergedAnalysis || state.data?.analysis || {},
      frame: state.livePoseData?.frame || {}
    };
  }

  const dataLandmarks = toNamedLandmarkMap(state.data);
  if (!dataLandmarks) return null;

  return {
    landmarks: dataLandmarks,
    analysis: state.data?.analysis || state.workflow?._mergedAnalysis || {},
    frame: state.data?.frame || {}
  };
}

function getBoneRotationMetrics() {
  return (
    state.overlayAnalysis ||
    state.workflow?._mergedAnalysis ||
    state.data?.analysis ||
    state.workflow?.frontCapture?.analysis ||
    {}
  );
}

function rotateDisplayedModel() {
  if (!state.autoRotateModel) return;
  if (modelMesh) modelMesh.rotation.y += 0.008;
  if (state.avatarModel) state.avatarModel.rotation.y += 0.005;
}

function createDebugSliderRow(config) {
  return `
    <label style="display:grid; grid-template-columns: 72px 1fr 48px; gap:8px; align-items:center; color:#cbd5e1; font-size:12px;">
      <span>${config.label}</span>
      <input type="range" min="-30" max="30" step="1" value="0" data-debug-bone="${config.key}" style="width:100%;">
      <span id="debugBoneValue_${config.key}" style="text-align:right; color:#f8fafc;">0째</span>
    </label>
  `;
}

function updateRotationToggleButton() {
  const button = document.getElementById("btnToggleModelRotation");
  if (!button) return;
  button.textContent = state.autoRotateModel ? "Auto Rotate: ON" : "Auto Rotate: OFF";
  button.style.background = state.autoRotateModel ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)";
  button.style.borderColor = state.autoRotateModel ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)";
  button.style.color = state.autoRotateModel ? "#86efac" : "#fca5a5";
}

function updateDebugSliderValue(key) {
  const valueEl = document.getElementById(`debugBoneValue_${key}`);
  if (!valueEl) return;
  const value = Number(state.debugBoneOffsets[key] || 0);
  valueEl.textContent = `${value > 0 ? "+" : ""}${value}째`;
}

function syncDebugControls() {
  ["head", "neck", "spine", "pelvis"].forEach(key => {
    const input = document.querySelector(`[data-debug-bone="${key}"]`);
    if (input) input.value = String(state.debugBoneOffsets[key] || 0);
    updateDebugSliderValue(key);
  });
  updateRotationToggleButton();
}

function resetDebugBoneOffsets() {
  state.debugBoneOffsets = {
    head: 0,
    neck: 0,
    spine: 0,
    pelvis: 0
  };
  syncDebugControls();
}

function installModelDebugControls() {
  const metaEl = document.getElementById("bodyModelMeta");
  if (!metaEl || document.getElementById("bodyModelDebugControls")) return;

  const panel = document.createElement("div");
  panel.id = "bodyModelDebugControls";
  panel.style.marginTop = "14px";
  panel.style.paddingTop = "14px";
  panel.style.borderTop = "1px solid rgba(255,255,255,0.08)";
  panel.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;">
      <div style="color:#f8fafc; font-size:12px; font-weight:700; letter-spacing:0.04em;">MODEL DEBUG</div>
      <button id="btnToggleModelRotation" type="button" style="border:1px solid rgba(255,255,255,0.18); border-radius:8px; padding:7px 10px; font-size:12px; cursor:pointer;"></button>
    </div>
    <div style="display:grid; gap:8px;">
      ${createDebugSliderRow({ key: "head", label: "Head" })}
      ${createDebugSliderRow({ key: "neck", label: "Neck" })}
      ${createDebugSliderRow({ key: "spine", label: "Spine" })}
      ${createDebugSliderRow({ key: "pelvis", label: "Pelvis" })}
    </div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button id="btnResetBoneDebug" type="button" style="flex:1; background:rgba(56,189,248,0.16); color:#bae6fd; border:1px solid rgba(56,189,248,0.35); border-radius:8px; padding:8px 10px; font-size:12px; cursor:pointer;">Reset Bone Offsets</button>
      <button id="btnApplyMergedBoneDebug" type="button" style="flex:1; background:rgba(250,204,21,0.14); color:#fde68a; border:1px solid rgba(250,204,21,0.3); border-radius:8px; padding:8px 10px; font-size:12px; cursor:pointer;">Use Saved Result</button>
    </div>
  `;

  metaEl.appendChild(panel);

  document.getElementById("btnToggleModelRotation")?.addEventListener("click", () => {
    state.autoRotateModel = !state.autoRotateModel;
    updateRotationToggleButton();
  });

  document.getElementById("btnResetBoneDebug")?.addEventListener("click", () => {
    resetDebugBoneOffsets();
    applyBoneDebugState();
  });

  document.getElementById("btnApplyMergedBoneDebug")?.addEventListener("click", () => {
    state.overlayAnalysis = null;
    applyBoneDebugState();
  });

  panel.querySelectorAll("[data-debug-bone]").forEach(input => {
    input.addEventListener("input", event => {
      const key = event.target.dataset.debugBone;
      state.debugBoneOffsets[key] = Number(event.target.value || 0);
      updateDebugSliderValue(key);
      applyBoneDebugState();
    });
  });

  syncDebugControls();
}

function createDebugSliderRow(config) {
  return `
    <label style="display:grid; grid-template-columns: 78px 1fr 56px; gap:8px; align-items:center; color:#cbd5e1; font-size:12px;">
      <span>${config.label}</span>
      <input type="range" min="${config.min}" max="${config.max}" step="${config.step}" value="0" data-debug-bone="${config.key}" style="width:100%;">
      <span id="debugBoneValue_${config.key}" style="text-align:right; color:#f8fafc;">0</span>
    </label>
  `;
}

function updateDebugSliderValue(key) {
  const config = DEBUG_CONTROL_CONFIG.find(item => item.key === key);
  const valueEl = document.getElementById(`debugBoneValue_${key}`);
  if (!valueEl || !config) return;
  const value = Number(state.debugBoneOffsets[key] || 0);
  const formatted = config.step < 1 ? value.toFixed(1) : value.toFixed(0);
  valueEl.textContent = config.unit === "deg"
    ? `${value > 0 ? "+" : ""}${formatted}deg`
    : `${value > 0 ? "+" : ""}${formatted}`;
}

function syncDebugControls() {
  DEBUG_CONTROL_CONFIG.forEach(({ key }) => {
    const input = document.querySelector(`[data-debug-bone="${key}"]`);
    if (input) input.value = String(state.debugBoneOffsets[key] || 0);
    updateDebugSliderValue(key);
  });
  updateRotationToggleButton();
}

function resetDebugBoneOffsets() {
  state.debugBoneOffsets = { ...DEBUG_CONTROL_DEFAULTS };
  syncDebugControls();
}

function syncMetricsToDebugControl() {
  const metrics = getBoneRotationMetrics() || {};
  let mappedSomething = false;

  DEBUG_CONTROL_CONFIG.forEach(({ key }) => {
    if (metrics[key] && metrics[key].value != null) {
      state.debugBoneOffsets[key] = Number(metrics[key].value);
      mappedSomething = true;
    }
  });

  if (metrics.head_tilt && metrics.head_tilt.value != null) {
    const value = Number(metrics.head_tilt.value);
    const sign = String(metrics.head_tilt.type || "").toLowerCase().includes("left") ? -1 : 1;
    if ("head_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["head_roll"] = Number((value * sign * 0.5).toFixed(1));
    }
    if ("neck_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["neck_roll"] = Number((value * sign * 0.5).toFixed(1));
    }
    mappedSomething = true;
  }

  if (metrics.pelvic_balance && metrics.pelvic_balance.value != null) {
    const value = Number(metrics.pelvic_balance.value);
    const sign = String(metrics.pelvic_balance.type || "").toLowerCase().includes("left") ? -1 : 1;
    if ("spine_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["spine_roll"] = Number((value * sign * 0.12).toFixed(1));
    }
    if ("pelvis_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["pelvis_roll"] = Number((value * sign * 0.4).toFixed(1));
    }
    mappedSomething = true;
  }

  // 3. head_neck_shape -> head/neck pitch
  if (metrics.head_neck_shape && metrics.head_neck_shape.value != null) {
    const value = Number(metrics.head_neck_shape.value);
    if ("neck_pitch" in state.debugBoneOffsets) {
      state.debugBoneOffsets["neck_pitch"] = Number((value * 0.8).toFixed(1));
    }
    if ("head_pitch" in state.debugBoneOffsets) {
      state.debugBoneOffsets["head_pitch"] = Number((value * -0.4).toFixed(1));
    }
    mappedSomething = true;
  }

  if (metrics.xo_leg && metrics.xo_leg.value != null) {
    const value = Math.abs(Number(metrics.xo_leg.value));
    const type = String(metrics.xo_leg.type || "").toLowerCase();

    let l_sign = -1;
    let r_sign = 1;

    if (type.includes("x")) {
      l_sign = 1;
      r_sign = -1;
    }

    if ("l_thigh_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["l_thigh_roll"] = Number((value * l_sign).toFixed(1));
    }
    if ("l_calf_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["l_calf_roll"] = Number((value * l_sign).toFixed(1));
    }
    if ("r_thigh_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["r_thigh_roll"] = Number((value * r_sign).toFixed(1));
    }
    if ("r_calf_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["r_calf_roll"] = Number((value * r_sign).toFixed(1));
    }
    mappedSomething = true;
  }

  // 5. shoulder_balance -> Spine2 roll
  if (metrics.shoulder_balance && metrics.shoulder_balance.value != null) {
    const value = Math.abs(Number(metrics.shoulder_balance.value));
    const sign = String(metrics.shoulder_balance.type || "").toLowerCase().includes("left") ? -1 : 1;

    if ("spine2_roll" in state.debugBoneOffsets) {
      state.debugBoneOffsets["spine2_roll"] = Number((value * sign * 0.8).toFixed(1));
    }
    mappedSomething = true;
  }

  if (metrics.cervical_alignment && metrics.cervical_alignment.value != null) {
    const value = Math.abs(Number(metrics.cervical_alignment.value));
    const type = String(metrics.cervical_alignment.type || "").toLowerCase();
    const sign = type.includes("straight") ? 1 : -1;

    if ("neck_pitch" in state.debugBoneOffsets) {
      const existing = state.debugBoneOffsets["neck_pitch"] || 0;
      state.debugBoneOffsets["neck_pitch"] = Number((existing + (value * sign * 0.5)).toFixed(1));
    }
    mappedSomething = true;
  }

  if (metrics.back_shape && metrics.back_shape.value != null) {
    const value = Math.abs(Number(metrics.back_shape.value));
    const type = String(metrics.back_shape.type || "").toLowerCase();
    const sign = type.includes("kypho") ? 1 : (type.includes("flat") ? -1 : 1);

    if ("spine1_pitch" in state.debugBoneOffsets) {
      state.debugBoneOffsets["spine1_pitch"] = Number((value * sign * 0.5).toFixed(1));
    }
    if ("spine2_pitch" in state.debugBoneOffsets) {
      const existing = state.debugBoneOffsets["spine2_pitch"] || 0;
      state.debugBoneOffsets["spine2_pitch"] = Number((existing + (value * sign * 0.5)).toFixed(1));
    }
    mappedSomething = true;
  }

  if (metrics.lumbar_curve && metrics.lumbar_curve.value != null) {
    const value = Math.abs(Number(metrics.lumbar_curve.value));
    const type = String(metrics.lumbar_curve.type || "").toLowerCase();
    const sign = type.includes("lordo") ? -1 : (type.includes("flat") ? 1 : -1);

    if ("spine_pitch" in state.debugBoneOffsets) {
      state.debugBoneOffsets["spine_pitch"] = Number((value * sign * 0.8).toFixed(1));
    }
    mappedSomething = true;
  }

  if (metrics.shoulder_back_shape && metrics.shoulder_back_shape.value != null) {
    const value = Math.abs(Number(metrics.shoulder_back_shape.value));
    const type = String(metrics.shoulder_back_shape.type || "").toLowerCase();
    const sign = type.includes("round") ? -1 : (type.includes("flat") || type.includes("open") ? 1 : -1);

    if ("clavicle_l" in state.debugBoneOffsets) {
      state.debugBoneOffsets["clavicle_l"] = Number((value * sign).toFixed(1));
    }
    if ("clavicle_r" in state.debugBoneOffsets) {
      state.debugBoneOffsets["clavicle_r"] = Number((value * sign).toFixed(1));
    }
    mappedSomething = true;
  }

  const baseSpinePitch =
    (state.debugBoneOffsets["pelvis_pitch"] || 0) +
    (state.debugBoneOffsets["spine_pitch"] || 0) +
    (state.debugBoneOffsets["spine1_pitch"] || 0) +
    (state.debugBoneOffsets["spine2_pitch"] || 0);

  const l_PitchTotal = baseSpinePitch + (state.debugBoneOffsets["clavicle_l"] || 0);
  const r_PitchTotal = baseSpinePitch + (state.debugBoneOffsets["clavicle_r"] || 0);

  if (l_PitchTotal !== 0 || r_PitchTotal !== 0) {
    if ("shoulder_l" in state.debugBoneOffsets) {
      state.debugBoneOffsets["shoulder_l"] = Number((-l_PitchTotal).toFixed(1));
    }
    if ("shoulder_r" in state.debugBoneOffsets) {
      state.debugBoneOffsets["shoulder_r"] = Number((-r_PitchTotal).toFixed(1));
    }
    mappedSomething = true;
  }

  if (metrics.shoulder_balance && metrics.shoulder_balance.value != null) {
    const value = Math.abs(Number(metrics.shoulder_balance.value));
    const sign = String(metrics.shoulder_balance.type || "").toLowerCase().includes("left") ? -1 : 1;
    const offset = value * 0.02;

    if ("shoulder_l_tilt" in state.debugBoneOffsets) {
      state.debugBoneOffsets["shoulder_l_tilt"] = Number((offset * sign).toFixed(2));
    }
    if ("shoulder_r_tilt" in state.debugBoneOffsets) {
      state.debugBoneOffsets["shoulder_r_tilt"] = Number((offset * sign).toFixed(2));
    }
    mappedSomething = true;
  }

  if (metrics.pelvic_balance && metrics.pelvic_balance.value != null) {
    const value = Math.abs(Number(metrics.pelvic_balance.value));
    const sign = String(metrics.pelvic_balance.type || "").toLowerCase().includes("left") ? -1 : 1;
    const offset = value * 0.02;

    if ("twist_l" in state.debugBoneOffsets) {
      state.debugBoneOffsets["twist_l"] = Number((offset * sign).toFixed(2));
    }
    if ("twist_r" in state.debugBoneOffsets) {
      state.debugBoneOffsets["twist_r"] = Number((offset * -sign).toFixed(2));
    }
    mappedSomething = true;
  }

  if (mappedSomething) syncDebugControls();
}

function installModelDebugControls() {
  const metaEl = document.getElementById("bodyModelMeta");
  const existing = document.getElementById("bodyModelDebugControls");
  if (!metaEl) return;
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "bodyModelDebugControls";
  panel.style.marginTop = "14px";
  panel.style.paddingTop = "14px";
  panel.style.borderTop = "1px solid rgba(255,255,255,0.08)";
  panel.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;">
      <div style="color:#f8fafc; font-size:12px; font-weight:700; letter-spacing:0.04em;">MODEL DEBUG</div>
      <button id="btnToggleModelRotation" type="button" style="border:1px solid rgba(255,255,255,0.18); border-radius:8px; padding:7px 10px; font-size:12px; cursor:pointer;"></button>
    </div>
    <div style="display:grid; gap:8px; max-height:360px; overflow:auto; padding-right:4px;">
      ${DEBUG_CONTROL_CONFIG.map(createDebugSliderRow).join("")}
    </div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button id="btnResetBoneDebug" type="button" style="flex:1; background:rgba(56,189,248,0.16); color:#bae6fd; border:1px solid rgba(56,189,248,0.35); border-radius:8px; padding:8px 10px; font-size:12px; cursor:pointer;">Reset Bone Offsets</button>
      <button id="btnApplyMergedBoneDebug" type="button" style="flex:1; background:rgba(250,204,21,0.14); color:#fde68a; border:1px solid rgba(250,204,21,0.3); border-radius:8px; padding:8px 10px; font-size:12px; cursor:pointer;">Use Saved Result</button>
    </div>
  `;

  metaEl.appendChild(panel);

  document.getElementById("btnToggleModelRotation")?.addEventListener("click", () => {
    state.autoRotateModel = !state.autoRotateModel;
    updateRotationToggleButton();
  });

  document.getElementById("btnResetBoneDebug")?.addEventListener("click", () => {
    resetDebugBoneOffsets();
    renderPostureOverlay();
  });

  document.getElementById("btnApplyMergedBoneDebug")?.addEventListener("click", () => {
    state.overlayAnalysis = null;
    syncMetricsToDebugControl();
  });

  panel.querySelectorAll("[data-debug-bone]").forEach(input => {
    input.addEventListener("input", event => {
      const key = event.target.dataset.debugBone;
      state.debugBoneOffsets[key] = Number(event.target.value || 0);
      updateDebugSliderValue(key);
      renderPostureOverlay();
    });
  });

  syncDebugControls();
}

function getOverlayBounds() {
  const target = state.avatarModel || modelMesh;
  if (target) {
    const box = new THREE.Box3().setFromObject(target);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      return {
        width: Math.max(size.x, 28),
        height: Math.max(size.y, 120),
        depth: Math.max(size.z, 18),
        center,
        min: box.min.clone(),
        max: box.max.clone()
      };
    }
  }

  return {
    width: 32,
    height: 160,
    depth: 20,
    center: new THREE.Vector3(0, 0, 0),
    min: new THREE.Vector3(-16, -80, -10),
    max: new THREE.Vector3(16, 80, 10)
  };
}

function getOverlayView(frame = {}) {
  return frame.view || state.livePoseData?.view_detection?.view || state.data?.view_detection?.view || state.currentView || "front";
}

function normalizeLandmarkAxis(value, frameSize) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (frameSize && numeric > 1) return numeric / frameSize;
  return numeric;
}

function landmarkToOverlayPoint(landmark, frame, bounds) {
  if (!landmark) return null;
  const xNorm = THREE.MathUtils.clamp(normalizeLandmarkAxis(landmark.x, frame.width), 0, 1);
  const yNorm = THREE.MathUtils.clamp(normalizeLandmarkAxis(landmark.y, frame.height), 0, 1);
  const zValue = Number(landmark.z);
  const zNorm = Number.isFinite(zValue) ? zValue : 0;
  const left = bounds.min?.x ?? (bounds.center.x - bounds.width * 0.5);
  const right = bounds.max?.x ?? (bounds.center.x + bounds.width * 0.5);
  const bottom = bounds.min?.y ?? (bounds.center.y - bounds.height * 0.5);
  const top = bounds.max?.y ?? (bounds.center.y + bounds.height * 0.5);
  const front = bounds.max?.z ?? (bounds.center.z + bounds.depth * 0.5);
  const depthScale = bounds.depth * 0.35;

  return new THREE.Vector3(
    THREE.MathUtils.lerp(left, right, xNorm),
    THREE.MathUtils.lerp(top, bottom, yNorm),
    front - zNorm * depthScale
  );
}

function resolveOverlayColor(metricKey, angleDeg) {
  const thresholds = OVERLAY_THRESHOLDS[metricKey] || OVERLAY_THRESHOLDS.shoulder_slope;
  const magnitude = Math.abs(Number(angleDeg) || 0);
  if (magnitude >= thresholds.bad) return OVERLAY_COLORS.bad;
  if (magnitude >= thresholds.warning) return OVERLAY_COLORS.warning;
  return OVERLAY_COLORS.normal;
}

function formatAngleLabel(label, angleDeg) {
  return `${label}: ${Math.abs(angleDeg).toFixed(1)} deg`;
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createLineMaterial(color, opacity = 0.95) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false
  });
}

function drawLine(start, end, options = {}) {
  if (!overlayGroup || !start || !end) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    start.x, start.y, start.z,
    end.x, end.y, end.z
  ], 3));

  const line = new THREE.Line(
    geometry,
    createLineMaterial(options.color || OVERLAY_COLORS.reference, options.opacity ?? 0.95)
  );
  line.renderOrder = 1000;
  overlayGroup.add(line);
  return line;
}

function getTextSprite(text, color) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 384;
  canvas.height = 96;

  ctx.fillStyle = OVERLAY_COLORS.halo;
  drawRoundedRectPath(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 16);
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.font = "600 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = OVERLAY_COLORS.text;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(16, 4, 1);
  sprite.userData.texture = texture;
  return sprite;
}

function drawAngle(position, label, angleDeg, color) {
  if (!overlayGroup || !position) return null;
  const sprite = getTextSprite(formatAngleLabel(label, angleDeg), `#${color.toString(16).padStart(6, "0")}`);
  sprite.position.copy(position);
  sprite.renderOrder = 1001;
  overlayGroup.add(sprite);
  return sprite;
}

function drawArrow(start, end, color = OVERLAY_COLORS.reference) {
  if (!overlayGroup || !start || !end) return null;
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (length <= 1e-4) return null;
  direction.normalize();

  const arrow = new THREE.ArrowHelper(
    direction,
    start,
    length,
    color,
    Math.min(length * 0.28, 8),
    Math.min(length * 0.18, 5)
  );
  arrow.line.material.depthTest = false;
  arrow.line.material.depthWrite = false;
  arrow.cone.material.depthTest = false;
  arrow.cone.material.depthWrite = false;
  arrow.renderOrder = 1002;
  overlayGroup.add(arrow);
  return arrow;
}

function computeSignedAngleDeg(start, end) {
  return THREE.MathUtils.radToDeg(Math.atan2(end.y - start.y, end.x - start.x));
}

function computeMidpoint(start, end, offsetY = 2.5) {
  return new THREE.Vector3(
    (start.x + end.x) * 0.5,
    (start.y + end.y) * 0.5 + offsetY,
    (start.z + end.z) * 0.5
  );
}

function clampLabelPosition(position, bounds) {
  if (!position) return position;
  const clamped = position.clone();
  const padX = Math.max(bounds.width * 0.08, 1.5);
  const padY = Math.max(bounds.height * 0.06, 4);
  clamped.x = THREE.MathUtils.clamp(clamped.x, bounds.min.x + padX, bounds.max.x - padX);
  clamped.y = THREE.MathUtils.clamp(clamped.y, bounds.min.y + padY, bounds.max.y - padY);
  clamped.z = Math.min(clamped.z, bounds.max.z + 2);
  return clamped;
}

function getCenterLinePoints(landmarks, frame, bounds) {
  const nose = landmarkToOverlayPoint(landmarks.nose, frame, bounds);
  const leftHip = landmarkToOverlayPoint(landmarks.left_hip, frame, bounds);
  const rightHip = landmarkToOverlayPoint(landmarks.right_hip, frame, bounds);
  if (!nose || !leftHip || !rightHip) return null;

  const midHip = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
  return { nose, midHip };
}

function drawCenterLine(landmarks, frame, bounds) {
  const centerPoints = getCenterLinePoints(landmarks, frame, bounds);
  if (!centerPoints) return null;

  const actualLine = drawLine(centerPoints.nose, centerPoints.midHip, {
    color: OVERLAY_COLORS.reference,
    opacity: 0.92
  });

  const referenceTop = centerPoints.nose.clone();
  const referenceBottom = centerPoints.midHip.clone();
  const centerX = bounds.center.x;
  referenceTop.x = centerX;
  referenceBottom.x = centerX;
  const referenceLine = drawLine(referenceTop, referenceBottom, {
    color: 0xffffff,
    opacity: 0.5
  });

  const deltaX = centerPoints.midHip.x - centerPoints.nose.x;
  const arrowStart = centerPoints.midHip.clone();
  const arrowEnd = centerPoints.midHip.clone().add(new THREE.Vector3(Math.sign(deltaX || 1) * Math.min(Math.abs(deltaX), 14), 0, 0));
  if (Math.abs(deltaX) > 1) {
    drawArrow(arrowStart, arrowEnd, resolveOverlayColor("body_center", deltaX / Math.max(bounds.width, 1)));
  }

  return { actualLine, referenceLine };
}

function findBoneByKeywords(root, keywords) {
  if (!root) return null;
  let found = null;
  root.traverse(node => {
    if (found || !node.isBone) return;
    const boneName = String(node.name || "").toLowerCase();
    if (keywords.some(keyword => boneName.includes(keyword))) {
      found = node;
    }
  });
  return found;
}

function findBoneByName(root, boneName) {
  if (!root || !boneName) return null;
  let found = null;
  const target = String(boneName).trim().toLowerCase();
  root.traverse(node => {
    if (found) return;
    if (String(node.name || "").trim().toLowerCase() === target) found = node;
  });
  return found;
}

function rememberBoneDefault(bone) {
  if (!bone || overlayState.boneDefaults.has(bone.uuid)) return;
  overlayState.boneDefaults.set(bone.uuid, {
    rotation: bone.rotation.clone(),
    position: bone.position.clone()
  });
}

function resetOverlayBoneRotations() {
  overlayState.boneDefaults.forEach((defaults, uuid) => {
    const bone = state.avatarModel?.getObjectByProperty("uuid", uuid);
    if (!bone) return;
    if (defaults.rotation) bone.rotation.copy(defaults.rotation);
    if (defaults.position) bone.position.copy(defaults.position);
  });
}

function applyBoneDebugState() {
  if (!state.avatarModel) return;
  applyBoneRotation(state.avatarModel, getBoneRotationMetrics());
  state.avatarModel.updateMatrixWorld(true);
  if (modelRenderer && modelScene && modelCamera) {
    modelRenderer.render(modelScene, modelCamera);
  }
}

function applyBoneRotation(avatar, metrics = {}) {
  if (!avatar) return;
  resetOverlayBoneRotations();

  DEBUG_CONTROL_CONFIG.forEach(config => {
        // Lookup each bone
    let bone = findBoneByName(avatar, config.bone);
    if (!bone) {
      const kw = config.bone.split('_').pop().toLowerCase();
      bone = findBoneByKeywords(avatar, [kw]);
    }
    if (!bone) return;

    const totalValue = (metrics[config.key] || 0) + (state.debugBoneOffsets[config.key] || 0);
    if (totalValue !== 0) {
      rememberBoneDefault(bone);
      if (config.mode === "rotation") {
        bone.rotation[config.axis] += THREE.MathUtils.degToRad(totalValue);
      } else if (config.mode === "position") {
        bone.position[config.axis] += totalValue;
      }
    }
  });
}

function drawOverlayMetric(metricKey, label, a, b, bounds) {
  const angleDeg = computeSignedAngleDeg(a, b);
  const color = resolveOverlayColor(metricKey, angleDeg);
  drawLine(a, b, { color });
  drawAngle(clampLabelPosition(computeMidpoint(a, b, 3), bounds), label, angleDeg, color);

  const arrowLength = Math.min(bounds.width * 0.18, 4);
  if (Math.abs(angleDeg) >= 1) {
    const origin = clampLabelPosition(computeMidpoint(a, b, -1.5), bounds);
    const direction = new THREE.Vector3(Math.sign(angleDeg), 0, 0).multiplyScalar(arrowLength);
    drawArrow(origin, origin.clone().add(direction), color);
  }
}

function drawSkeletonOverlay(model, isGrey = false) {
  if (!model || !overlayGroup) return;

  const bones = [];
  model.traverse(node => {
    if (node.isBone) {
      const name = (node.name || "").toLowerCase();
      if (!name.includes("finger") && !name.includes("thumb")) {
        bones.push(node);
      }
    }
  });
  if (bones.length === 0) return;

  const linePositions = [];
  const pointPositions = [];

  bones.forEach(bone => {
    const pos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    pointPositions.push(pos.x, pos.y, pos.z);

    if (bone.parent && bone.parent.isBone) {
      const parentName = (bone.parent.name || "").toLowerCase();
      if (!parentName.includes("finger") && !parentName.includes("toe") && !parentName.includes("thumb")) {
        const parentPos = new THREE.Vector3().setFromMatrixPosition(bone.parent.matrixWorld);
        linePositions.push(parentPos.x, parentPos.y, parentPos.z);
        linePositions.push(pos.x, pos.y, pos.z);
      }
    }
  });

  if (state.showLines && linePositions.length > 0) {
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const color = isGrey ? 0x60a5fa : 0xfb923c;
    const opacity = isGrey ? 0.42 : 0.95;
    const lineMat = new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.renderOrder = isGrey ? 996 : 998;
    overlayGroup.add(lines);
  }

  if (state.showPoints && pointPositions.length > 0) {
    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    const color = isGrey ? 0x93c5fd : 0xfdba74;
    const opacity = isGrey ? 0.40 : 0.95;
    const size = isGrey ? 3 : 6;
    const pointMat = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, opacity });
    const points = new THREE.Points(pointGeo, pointMat);
    points.renderOrder = isGrey ? 997 : 999;
    overlayGroup.add(points);
  }
}

function setSnapshotCardState(view, mode, primaryText = "", secondaryText = "") {
  const statusEl = document.getElementById(`snapshotStatus_${view}`);
  const imgEl = document.getElementById(`snapshotImg_${view}`);
  if (!statusEl || !imgEl) return;

  statusEl.classList.remove("loading", "error", "ready");
  statusEl.classList.add(mode);

  if (mode === "ready") {
    statusEl.style.display = "none";
    return;
  }

  statusEl.style.display = "flex";
  statusEl.innerHTML = `
    <div class="snapshot-status-primary">${primaryText}</div>
    ${secondaryText ? `<div class="snapshot-status-secondary">${secondaryText}</div>` : ""}
  `;
}

function setSnapshotImage(view, src) {
  const imgEl = document.getElementById(`snapshotImg_${view}`);
  if (!imgEl) return;
  imgEl.src = src;
  imgEl.dataset.bound = "true";
  setSnapshotCardState(view, "ready");
}

function setSnapshotError(view, message) {
  const label = VIEW_LABELS[view] || view;
  setSnapshotCardState(view, "error", `${label} view failed`, message || "이미지 생성 실패");
}

function queueMultiViewSnapshotCapture(reason = "update") {
  snapshotCaptureQueuedReason = reason;
  if (snapshotCaptureTimer) clearTimeout(snapshotCaptureTimer);
  snapshotCaptureTimer = setTimeout(() => {
    captureMultiViewSnapshots(snapshotCaptureQueuedReason).catch((err) => {
      console.error("[MultiView] Snapshot capture failed:", err);
    });
  }, 140);
}

function waitAnimationFrames(count = 1) {
  return new Promise((resolve) => {
    const step = (remain) => {
      if (remain <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remain - 1));
    };
    step(count);
  });
}

function ensureRendererSizeForSnapshot(view) {
  const renderer = multiViewRenderers[view];
  const camera = multiViewCameras[view];
  const canvas = document.getElementById(`canvas_${view}`);
  if (!renderer || !camera || !canvas) return false;

  const cell = document.getElementById(`viewCell_${view}`);
  const rect = cell?.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect?.width || canvas.clientWidth || canvas.width || 320));
  const h = Math.max(1, Math.floor(rect?.height || canvas.clientHeight || canvas.height || 260));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  return true;
}

async function captureMultiViewSnapshots(reason = "manual") {
  if (snapshotCaptureInFlight) {
    queueMultiViewSnapshotCapture(`${reason}:queued`);
    return;
  }

  snapshotCaptureInFlight = true;
  try {
    if (!state.avatarModel && !modelMesh) {
      VIEW_NAMES.forEach((view) => setSnapshotError(view, "이미지 생성 실패"));
      return;
    }

    VIEW_NAMES.forEach((view) => {
      setSnapshotCardState(view, "loading", `${VIEW_LABELS[view]} view rendering...`, "이미지 생성 중");
    });

    await waitAnimationFrames(2);
    updateMultiViewCameras();
    renderPostureOverlay();

    for (const view of VIEW_NAMES) {
      try {
        const renderer = multiViewRenderers[view];
        const camera = multiViewCameras[view];
        if (!renderer || !camera) {
          setSnapshotError(view, "이미지 생성 실패");
          continue;
        }

        ensureRendererSizeForSnapshot(view);
        renderer.render(modelScene, camera);
        await waitAnimationFrames(1);

        const dataUrl = renderer.domElement.toDataURL("image/png");
        const isValid = typeof dataUrl === "string" && dataUrl.startsWith("data:image/png;base64,") && dataUrl.length > 128;
        if (!isValid) {
          setSnapshotError(view, "이미지 생성 실패");
          continue;
        }

        setSnapshotImage(view, dataUrl);
      } catch (err) {
        console.error(`[MultiView] ${VIEW_LABELS[view]} snapshot failed:`, err);
        setSnapshotError(view, "이미지 생성 실패");
      }
    }
  } finally {
    snapshotCaptureInFlight = false;
  }
}

function renderPostureOverlay() {
  ensureOverlayGroup();
  clearOverlayGroup();

  const targetModel = state.avatarModel || modelMesh;

  // 1. Draw the baseline skeleton before measured rotations are applied.
  if (targetModel) {
    resetOverlayBoneRotations();
    targetModel.updateMatrixWorld(true);
    drawSkeletonOverlay(targetModel, true);
  }

  applyBoneRotation(state.avatarModel, getBoneRotationMetrics());

  // 3. Draw the measured skeleton after bone offsets are applied.
  if (targetModel) {
    targetModel.updateMatrixWorld(true);
    drawSkeletonOverlay(targetModel, false);
  }


}

function setOverlayLandmarks(landmarks, options = {}) {
  state.overlayLandmarks = landmarks || null;
  state.overlayAnalysis = options.analysis || null;
  state.overlayFrame = options.frame || null;
  renderPostureOverlay();
}

function initBodyModelViewer() {
  const canvas = document.getElementById("bodyModelCanvas");
  if (!canvas || !window.THREE) return;

  modelScene = new THREE.Scene();
  modelScene.background = new THREE.Color(0x08111f);
  ensureOverlayGroup();

  const clientHeight = canvas.clientHeight || 600;
  modelCamera = new THREE.PerspectiveCamera(34, (canvas.clientWidth || 400) / clientHeight, 0.1, 1000);
  modelCamera.position.set(0, 90, 180);

  modelRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  modelRenderer.setPixelRatio(window.devicePixelRatio);
  modelRenderer.setSize(canvas.clientWidth || 400, clientHeight);

  modelScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(80, 140, 100);
  modelScene.add(key);
  installModelDebugControls();

  function animateModel() {
    requestAnimationFrame(animateModel);
    rotateDisplayedModel();
    renderPostureOverlay();
    modelRenderer.render(modelScene, modelCamera);
  }

  animateModel();
}

function initMultiViewGrid() {
  if (!window.THREE) return;

  // Reuse or create shared scene
  if (!modelScene) {
    modelScene = new THREE.Scene();
    modelScene.background = new THREE.Color(0x08111f);
    ensureOverlayGroup();
    modelScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(80, 140, 100);
    modelScene.add(key);
    installModelDebugControls();
  }

  // Create one renderer + camera per view
  VIEW_NAMES.forEach(view => {
    const canvas = document.getElementById(`canvas_${view}`);
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth || 300, canvas.clientHeight || 260);
    multiViewRenderers[view] = renderer;

    const camera = new THREE.PerspectiveCamera(34, (canvas.clientWidth || 300) / (canvas.clientHeight || 260), 0.1, 1000);
    camera.position.set(0, 0, 5);
    multiViewCameras[view] = camera;
  });

  // Shared animation loop renders all 4 views
  function animateMultiView() {
    multiViewAnimationId = requestAnimationFrame(animateMultiView);
    try {
      rotateDisplayedModel();
      renderPostureOverlay();
      VIEW_NAMES.forEach(view => {
        const renderer = multiViewRenderers[view];
        const camera = multiViewCameras[view];
        if (!renderer || !camera) return;
        renderer.render(modelScene, camera);
      });
    } catch (err) {
      console.error("[MultiView] render loop error:", err);
    }
  }

  animateMultiView();
  VIEW_NAMES.forEach((view) => {
    setSnapshotCardState(view, "loading", `${VIEW_LABELS[view]} view waiting...`, "모델 로딩 대기 중");
  });
}

function updateMultiViewCameras() {
  // Support both GLB avatar model and procedural mesh
  const target = state.avatarModel || modelMesh;
  if (!target) return;

  target.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(target);
  const size = box.getSize(new THREE.Vector3());
  const dominantSize = Math.max(size.x, size.y, size.z) || 1.8;

  // Camera Y proportional to model height, same as single-view formula
  const camY = size.y * 0.46;
  const camDist = dominantSize * 1.38;

  multiViewCameras.front?.position.set(0, camY, camDist);
  multiViewCameras.right?.position.set(camDist, camY, 0);
  multiViewCameras.back?.position.set(0, camY, -camDist);
  multiViewCameras.left?.position.set(-camDist, camY, 0);

  VIEW_NAMES.forEach(view => {
    multiViewCameras[view]?.lookAt(0, 0, 0);

    const canvas = document.getElementById(`canvas_${view}`);
    const renderer = multiViewRenderers[view];
    if (canvas && renderer) {
      const w = canvas.clientWidth || 300;
      const h = canvas.clientHeight || 260;
      renderer.setSize(w, h);
      multiViewCameras[view].aspect = w / h;
      multiViewCameras[view].updateProjectionMatrix();
    }
  });

}

function renderBodyModel(bodyModel) {
  const metaEl = document.getElementById("bodyModelInfo");
  if (!metaEl) return;
  if (Object.keys(multiViewRenderers).length === 0) initMultiViewGrid();
  if (!window.THREE) {
    metaEl.textContent = "3D body model viewer is unavailable.";
    return;
  }

  if (state.avatarModel) {
    modelScene.remove(state.avatarModel);
    state.avatarModel = null;
  }
  if (modelMesh) {
    modelScene.remove(modelMesh);
    modelMesh.geometry.dispose();
    modelMesh.material.dispose();
    modelMesh = null;
  }
  if (modelWireframe) {
    modelScene.remove(modelWireframe);
    modelWireframe.geometry.dispose();
    modelWireframe.material.dispose();
    modelWireframe = null;
  }

  const selectedGlbPath = localStorage.getItem(SELECTED_GLB_STORAGE_KEY) || "/ui/models/male.glb";
  const isPreloadedGLB = bodyModel?.type === "glb_avatar" || bodyModel?.type === "client_humanoid_body_v2";
  const hasMeshGeometry = !!(bodyModel?.vertices && bodyModel?.faces);

  // WEBCAM_MEASURE: when bodyModel is null (webcam-only, no depth capture),
  // show a graceful placeholder instead of trying to load a non-existent GLB
  const hasWebcamCapture = !!(state.workflow._mergedAnalysis && Object.keys(state.workflow._mergedAnalysis).length > 0);
  if (!isPreloadedGLB && !hasMeshGeometry && (!bodyModel || !hasWebcamCapture)) {
    metaEl.textContent = "3D 모델은 측정 데이터 없이 생성할 수 없습니다.";
    return;
  }

  if (isPreloadedGLB || (!hasMeshGeometry && selectedGlbPath)) {
    const meta = bodyModel?.meta || {};
    metaEl.innerHTML = [
      `<div><strong>Model Type:</strong> ${bodyModel?.type || "client_humanoid_body_v2 (GLB)"}</div>`,
      `<div><strong>File:</strong> ${selectedGlbPath}</div>`,
      `<div><strong>Height:</strong> ${meta.height_cm || getAnalysisMetricValue(state.workflow._mergedAnalysis, "height") || "--"} cm</div>`,
      `<div><strong>Shoulder Width:</strong> ${meta.shoulder_width_cm || getAnalysisMetricValue(state.workflow._mergedAnalysis, "shoulder_width") || "--"} cm</div>`,
      `<div><strong>Pelvis Width:</strong> ${meta.pelvis_width_cm || getAnalysisMetricValue(state.workflow._mergedAnalysis, "pelvis_width") || "--"} cm</div>`
    ].join("");
    loadGLBFile(selectedGlbPath);
    return;
  }

  if (!hasMeshGeometry) {
    metaEl.textContent = "No body model loaded.";
    return;
  }

  if (bodyModel.vertices && bodyModel.faces) {
    // Render standard body model from vertices/faces
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bodyModel.vertices.flat()), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bodyModel.faces.flat()), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x97dffc,
      roughness: 0.84,
      metalness: 0.02,
      transparent: true,
      opacity: 0.96
    });

    modelMesh = new THREE.Mesh(geometry, material);
    modelScene.add(modelMesh);
    modelWireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 32),
      new THREE.LineBasicMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0.28 })
    );
    modelScene.add(modelWireframe);

    modelMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(modelMesh);
    const center = box.getCenter(new THREE.Vector3());
    modelMesh.position.sub(center);
    modelWireframe.position.copy(modelMesh.position);
    updateMultiViewCameras();
    queueMultiViewSnapshotCapture("renderBodyModel:mesh");

    const meta = bodyModel.meta || {};
    metaEl.innerHTML = [
      `<div><strong>Model Type:</strong> ${bodyModel.type || "-"}</div>`,
      `<div><strong>Height:</strong> ${meta.height_cm || "--"} cm</div>`,
      `<div><strong>Shoulder Width:</strong> ${meta.shoulder_width_cm || "--"} cm</div>`,
      `<div><strong>Pelvis Width:</strong> ${meta.pelvis_width_cm || "--"} cm</div>`,
      `<div><strong>Torso Depth:</strong> ${meta.torso_depth_cm || "--"} cm</div>`,
      `<div><strong>Arm Length:</strong> ${meta.arm_length_cm || "--"} cm</div>`,
      `<div><strong>Leg Length:</strong> ${meta.leg_length_cm || "--"} cm</div>`,
      `<div><strong>Torso Length:</strong> ${meta.torso_length_cm || "--"} cm</div>`
    ].join("");

  } else if (bodyModel.type === "star_template_body_v1") {
    // STAR model from API with vertices/faces
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bodyModel.vertices.flat()), 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bodyModel.faces.flat()), 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x97dffc,
      roughness: 0.84,
      metalness: 0.02,
      transparent: true,
      opacity: 0.96
    });

    modelMesh = new THREE.Mesh(geometry, material);
    modelScene.add(modelMesh);
    modelWireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 32),
      new THREE.LineBasicMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0.28 })
    );
    modelScene.add(modelWireframe);

    modelMesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(modelMesh);
    const center = box.getCenter(new THREE.Vector3());
    modelMesh.position.sub(center);
    modelWireframe.position.copy(modelMesh.position);
    updateMultiViewCameras();
    queueMultiViewSnapshotCapture("renderBodyModel:star");

    const meta = bodyModel.meta || {};
    metaEl.innerHTML = [
      `<div><strong>Model Type:</strong> ${bodyModel.type || "-"}</div>`,
      `<div><strong>Height:</strong> ${meta.height_cm || "--"} cm</div>`,
      `<div><strong>Shoulder Width:</strong> ${meta.shoulder_width_cm || "--"} cm</div>`,
      `<div><strong>Pelvis Width:</strong> ${meta.pelvis_width_cm || "--"} cm</div>`,
      `<div><strong>Torso Depth:</strong> ${meta.torso_depth_cm || "--"} cm</div>`,
      `<div><strong>Arm Length:</strong> ${meta.arm_length_cm || "--"} cm</div>`,
      `<div><strong>Leg Length:</strong> ${meta.leg_length_cm || "--"} cm</div>`,
      `<div><strong>Torso Length:</strong> ${meta.torso_length_cm || "--"} cm</div>`
    ].join("");
  }
}

function buildBodyModelFromAnalysis(analysis) {
  if (!analysis) return null;

  let height = getAnalysisMetricValue(analysis, "height");
  let shoulderWidth = getAnalysisMetricValue(analysis, "shoulder_width");
  let pelvisWidth = getAnalysisMetricValue(analysis, "pelvis_width");
  let armLength = getAnalysisMetricValue(analysis, "arm_length");
  let legLength = getAnalysisMetricValue(analysis, "leg_length");
  let torsoLength = getAnalysisMetricValue(analysis, "torso_length");
  let torsoDepth = getAnalysisMetricValue(analysis, "torso_depth") || (pelvisWidth ? pelvisWidth * 0.62 : null);

  if (![height, shoulderWidth, pelvisWidth, armLength, legLength, torsoLength, torsoDepth].every(v => typeof v === "number" && Number.isFinite(v))) {
    return null;
  }

  const normalized = normalizeBodyDimensions(
    height,
    shoulderWidth,
    pelvisWidth,
    armLength,
    legLength,
    torsoLength,
    torsoDepth
  );
  if (!normalized) return null;

  [height, shoulderWidth, pelvisWidth, armLength, legLength, torsoLength, torsoDepth] = normalized;

  const headHeight = height * 0.13;
  const neckHeight = height * 0.04;
  const chestY = height - headHeight - neckHeight;
  const waistY = chestY - torsoLength * 0.42;
  const pelvisY = chestY - torsoLength * 0.86;
  const shoulderY = chestY + torsoLength * 0.08;
  const kneeY = pelvisY - legLength * 0.48;
  const ankleY = Math.max(4, pelvisY - legLength * 0.96);

  const rings = [
    [chestY + neckHeight * 0.80, shoulderWidth * 0.16, torsoDepth * 0.12],
    [chestY + neckHeight * 0.40, shoulderWidth * 0.22, torsoDepth * 0.15],
    [shoulderY + torsoLength * 0.06, shoulderWidth * 0.58, torsoDepth * 0.37],
    [shoulderY, shoulderWidth * 0.60, torsoDepth * 0.36],
    [chestY, shoulderWidth * 0.54, torsoDepth * 0.33],
    [chestY - torsoLength * 0.15, shoulderWidth * 0.47, torsoDepth * 0.30],
    [waistY, shoulderWidth * 0.34, torsoDepth * 0.22],
    [pelvisY + torsoLength * 0.14, pelvisWidth * 0.44, torsoDepth * 0.26],
    [pelvisY + torsoLength * 0.05, pelvisWidth * 0.50, torsoDepth * 0.29],
    [pelvisY, pelvisWidth * 0.53, torsoDepth * 0.32]
  ];

  const segments = 26;
  const vertices = [];
  const faces = [];
  const headCenterY = height - headHeight * 0.52;
  appendEllipsoid(vertices, faces, [0, headCenterY, 0], shoulderWidth * 0.17, headHeight * 0.50, torsoDepth * 0.20, 12, segments);
  appendOrientedLimb(vertices, faces, [
    [0, chestY + neckHeight * 0.30, 0],
    [0, chestY + neckHeight * 0.72, 0],
    [0, headCenterY - headHeight * 0.38, 0]
  ], [
    shoulderWidth * 0.08,
    shoulderWidth * 0.07,
    shoulderWidth * 0.06
  ], [
    torsoDepth * 0.09,
    torsoDepth * 0.08,
    torsoDepth * 0.07
  ], segments);
  appendRingSurface(vertices, faces, rings, segments);

  const hipOffset = pelvisWidth * 0.19;
  const thighR = pelvisWidth * 0.125;
  const calfR = pelvisWidth * 0.085;
  const ankleR = pelvisWidth * 0.045;
  for (const side of [-1, 1]) {
    appendOrientedLimb(vertices, faces, [
      [side * shoulderWidth * 0.30, shoulderY + 1.0, torsoDepth * 0.02],
      [side * shoulderWidth * 0.44, shoulderY + 0.4, torsoDepth * 0.018],
      [side * shoulderWidth * 0.56, shoulderY - 1.0, torsoDepth * 0.012]
    ], [
      shoulderWidth * 0.08,
      shoulderWidth * 0.09,
      shoulderWidth * 0.07
    ], [
      torsoDepth * 0.11,
      torsoDepth * 0.10,
      torsoDepth * 0.08
    ], segments);

    appendOrientedLimb(vertices, faces, [
      [side * hipOffset * 0.72, pelvisY + 1.8, 0],
      [side * hipOffset * 0.92, pelvisY + 0.8, torsoDepth * 0.015],
      [side * hipOffset * 1.00, pelvisY - legLength * 0.14, torsoDepth * 0.018],
      [side * hipOffset * 0.94, kneeY, torsoDepth * 0.008],
      [side * hipOffset * 0.84, ankleY, 0],
      [side * hipOffset * 0.78, 2, torsoDepth * 0.035]
    ], [
      thighR * 1.08,
      thighR * 1.22,
      thighR * 1.16,
      calfR * 1.08,
      ankleR,
      ankleR * 0.74
    ], [
      thighR * 0.98,
      thighR * 1.05,
      thighR,
      calfR * 0.88,
      ankleR * 0.84,
      ankleR * 0.56
    ], segments);

    appendOrientedLimb(vertices, faces, [
      [side * hipOffset * 0.80, 2.4, torsoDepth * 0.03],
      [side * hipOffset * 0.92, 1.1, torsoDepth * 0.11],
      [side * hipOffset * 1.10, 0.7, torsoDepth * 0.18]
    ], [
      ankleR * 0.85,
      ankleR * 1.18,
      ankleR * 0.88
    ], [
      ankleR * 1.15,
      ankleR * 1.9,
      ankleR * 1.45
    ], segments);
  }

  const elbowY = shoulderY - (armLength * 0.52) * 0.55;
  const wristY = shoulderY - armLength * 0.52;
  const shoulderOffset = shoulderWidth * 0.58;
  const upperArmR = shoulderWidth * 0.065;
  const forearmR = shoulderWidth * 0.045;
  const handR = shoulderWidth * 0.03;
  for (const side of [-1, 1]) {
    appendOrientedLimb(vertices, faces, [
      [side * shoulderOffset * 0.86, shoulderY + 0.2, torsoDepth * 0.012],
      [side * shoulderOffset * 1.00, shoulderY - armLength * 0.52 * 0.16, torsoDepth * 0.015],
      [side * shoulderOffset * 1.08, elbowY, torsoDepth * 0.01],
      [side * shoulderOffset * 1.06, wristY, torsoDepth * 0.03]
    ], [
      upperArmR,
      upperArmR * 1.04,
      forearmR,
      handR * 0.92
    ], [
      upperArmR * 1.10,
      upperArmR * 1.05,
      forearmR * 0.82,
      handR * 0.60
    ], segments);

    appendOrientedLimb(vertices, faces, [
      [side * shoulderOffset * 1.08, wristY, torsoDepth * 0.03],
      [side * shoulderOffset * 1.10, wristY - armLength * 0.52 * 0.08, torsoDepth * 0.055],
      [side * shoulderOffset * 1.04, wristY - armLength * 0.52 * 0.16, torsoDepth * 0.07]
    ], [
      handR * 0.95,
      handR * 0.88,
      handR * 0.42
    ], [
      handR * 1.2,
      handR * 1.45,
      handR * 0.72
    ], segments);
  }

  return {
    ok: true,
    type: "client_humanoid_body_v2",
    unit: "cm",
    vertices,
    faces,
    meta: {
      height_cm: Number(height.toFixed(2)),
      shoulder_width_cm: Number(shoulderWidth.toFixed(2)),
      pelvis_width_cm: Number(pelvisWidth.toFixed(2)),
      torso_depth_cm: Number(torsoDepth.toFixed(2)),
      arm_length_cm: Number(armLength.toFixed(2)),
      leg_length_cm: Number(legLength.toFixed(2)),
      torso_length_cm: Number(torsoLength.toFixed(2))
    }
  };
}

function appendRingSurface(vertices, faces, rings, segments) {
  const start = vertices.length;
  for (const [y, rx, rz] of rings) {
    for (let i = 0; i < segments; i += 1) {
      const theta = (Math.PI * 2 * i) / segments;
      vertices.push([
        Number((Math.cos(theta) * rx).toFixed(3)),
        Number(y.toFixed(3)),
        Number((Math.sin(theta) * rz).toFixed(3))
      ]);
    }
  }

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    const baseA = start + ring * segments;
    const baseB = start + (ring + 1) * segments;
    for (let i = 0; i < segments; i += 1) {
      const ni = (i + 1) % segments;
      faces.push([baseA + i, baseB + i, baseB + ni]);
      faces.push([baseA + i, baseB + ni, baseA + ni]);
    }
  }
}

function appendOrientedLimb(vertices, faces, centers, radiiX, radiiZ, segments) {
  if (!Array.isArray(centers) || centers.length < 2) return;
  const start = vertices.length;

  for (let ringIndex = 0; ringIndex < centers.length; ringIndex += 1) {
    const center = centers[ringIndex];
    const prev = centers[Math.max(0, ringIndex - 1)];
    const next = centers[Math.min(centers.length - 1, ringIndex + 1)];
    let tangent = [
      next[0] - prev[0],
      next[1] - prev[1],
      next[2] - prev[2]
    ];
    let tangentLength = Math.hypot(tangent[0], tangent[1], tangent[2]);
    if (!tangentLength) {
      tangent = [0, 1, 0];
      tangentLength = 1;
    }
    tangent = tangent.map(v => v / tangentLength);

    let ref = [0, 1, 0];
    if (Math.abs(dotVec(ref, tangent)) > 0.92) {
      ref = [1, 0, 0];
    }
    let axisX = crossVec(ref, tangent);
    let axisXLength = Math.hypot(axisX[0], axisX[1], axisX[2]);
    if (!axisXLength) {
      axisX = [1, 0, 0];
      axisXLength = 1;
    }
    axisX = axisX.map(v => v / axisXLength);
    let axisZ = crossVec(tangent, axisX);
    const axisZLength = Math.max(1e-6, Math.hypot(axisZ[0], axisZ[1], axisZ[2]));
    axisZ = axisZ.map(v => v / axisZLength);

    const rx = radiiX[ringIndex];
    const rz = radiiZ[ringIndex];
    for (let i = 0; i < segments; i += 1) {
      const theta = (Math.PI * 2 * i) / segments;
      const shape = 0.88 + 0.12 * Math.cos(theta) * Math.cos(theta);
      const xOffset = Math.cos(theta) * rx * shape;
      const zOffset = Math.sin(theta) * rz;
      vertices.push([
        Number((center[0] + axisX[0] * xOffset + axisZ[0] * zOffset).toFixed(3)),
        Number((center[1] + axisX[1] * xOffset + axisZ[1] * zOffset).toFixed(3)),
        Number((center[2] + axisX[2] * xOffset + axisZ[2] * zOffset).toFixed(3))
      ]);
    }
  }

  for (let ring = 0; ring < centers.length - 1; ring += 1) {
    const baseA = start + ring * segments;
    const baseB = start + (ring + 1) * segments;
    for (let i = 0; i < segments; i += 1) {
      const ni = (i + 1) % segments;
      faces.push([baseA + i, baseB + i, baseB + ni]);
      faces.push([baseA + i, baseB + ni, baseA + ni]);
    }
  }
}

function appendEllipsoid(vertices, faces, center, radiusX, radiusY, radiusZ, latSegments, lonSegments) {
  const start = vertices.length;
  for (let lat = 0; lat <= latSegments; lat += 1) {
    const phi = Math.PI * lat / latSegments;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let lon = 0; lon < lonSegments; lon += 1) {
      const theta = (Math.PI * 2 * lon) / lonSegments;
      vertices.push([
        Number((center[0] + Math.cos(theta) * radiusX * sinPhi).toFixed(3)),
        Number((center[1] + radiusY * cosPhi).toFixed(3)),
        Number((center[2] + Math.sin(theta) * radiusZ * sinPhi).toFixed(3))
      ]);
    }
  }

  for (let lat = 0; lat < latSegments; lat += 1) {
    const baseA = start + lat * lonSegments;
    const baseB = start + (lat + 1) * lonSegments;
    for (let lon = 0; lon < lonSegments; lon += 1) {
      const nextLon = (lon + 1) % lonSegments;
      faces.push([baseA + lon, baseB + lon, baseB + nextLon]);
      faces.push([baseA + lon, baseB + nextLon, baseA + nextLon]);
    }
  }
}

function crossVec(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dotVec(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function getAnalysisMetricValue(analysis, key) {
  const item = analysis?.[key];
  if (!item || item.value == null) return null;
  const value = Number(item.value);
  return Number.isFinite(value) ? value : null;
}

function normalizeBodyDimensions(height, shoulderWidth, pelvisWidth, armLength, legLength, torsoLength, torsoDepth) {
  const baseHeight = Math.max(
    height,
    legLength > 0 ? legLength / 0.50 : 0,
    torsoLength > 0 ? torsoLength / 0.30 : 0,
    armLength > 0 ? armLength / 0.38 : 0
  );

  const h = clampValue(baseHeight, 135, 210);
  return [
    Number(h.toFixed(2)),
    Number(clampValue(shoulderWidth, h * 0.18, h * 0.30).toFixed(2)),
    Number(clampValue(pelvisWidth, h * 0.14, h * 0.24).toFixed(2)),
    Number(clampValue(armLength, h * 0.30, h * 0.46).toFixed(2)),
    Number(clampValue(legLength, h * 0.43, h * 0.58).toFixed(2)),
    Number(clampValue(torsoLength, h * 0.24, h * 0.36).toFixed(2)),
    Number(clampValue(torsoDepth, h * 0.10, h * 0.20).toFixed(2))
  ];
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// WEBCAM_MEASURE: optional server save — primary storage is localStorage via saveMeasurementToLocal()
async function saveWorkflowResult(front, side) {
  if (!front || !side) return;
  const email = window.BodyCheckUser?.getCurrentUserEmail() || "unknown@user.com";
  console.log(`Saving results for ${email}...`);

  try {
    const data = await Api.bodyComplete(email, front, side);
    if (data?.ok) {
      console.log("Database save successful.");
    } else {
      console.error(`Save failed: ${data?.cloud?.reason || "unknown error"}`);
    }
  } catch (err) {
    console.error(`Save error (non-fatal): ${err.message}`);
  }
}

function bindEvents() {
  const btnMeasureStart = document.getElementById("btnMeasureStart");
  if (btnMeasureStart) {
    btnMeasureStart.addEventListener("click", () => {
      const saved = localStorage.getItem('bodyCheckReport');
      if (!saved) {
        showToast(t("anthro_need_body_check") || "바디체크를 먼저 진행해주세요.");
      } else {
        loadBodyCheckReportWithAi();
      }
    });
  }

}

function init() {
  setupTabs();
  bindEvents();
  initMultiViewGrid();
  window.addEventListener("resize", () => {
    updateMultiViewCameras();
    queueMultiViewSnapshotCapture("resize");
  });
  populateGLBFileDropdown();
  setupGLBLoadHandlers();

  window.addEventListener('languageChanged', () => {
    if (state.workflow.frontCapture && state.workflow.sideCapture) {
      buildCompositeReport();
    } else {
      renderAnalysisList();
      renderMiniValues();
    }
  });

  // Auto load report on init if available
  const savedReport = localStorage.getItem('bodyCheckReport');
  if (savedReport) {
    const btnText = document.getElementById("btnMeasureText");
    if (btnText) btnText.textContent = t("anthro_view_report") || "결과 리포트 보기";
    setTimeout(() => loadBodyCheckReportWithAi(), 100);
  }

  // Initial data population
  loadLatest();
  logLine("UI initialized");
}

function populateGLBFileDropdown() {
  const select = document.getElementById("glbFileSelect");
  if (!select) return;

  // Add GLB file options
  select.innerHTML = '<option value="">-- GLB 파일 선택 --</option>';

  // Available GLB files
  const glbFiles = [
    { name: "Male", path: "/ui/models/male.glb" },
    { name: "Female", path: "/ui/models/female.glb" }
  ];

  glbFiles.forEach(file => {
    const option = document.createElement("option");
    option.value = file.path;
    option.textContent = file.name;
    select.appendChild(option);
  });

  let savedPath = localStorage.getItem(SELECTED_GLB_STORAGE_KEY);
  // Default to the male model until gender-specific selection is wired in.
  if (!savedPath) {
    savedPath = "/ui/models/male.glb";
    localStorage.setItem(SELECTED_GLB_STORAGE_KEY, savedPath);
  }

  if (savedPath && glbFiles.some(file => file.path === savedPath)) {
    select.value = savedPath;

    // Auto-load the saved GLB after the selector is populated.
    setTimeout(() => {
      if (typeof loadGLBFile === 'function') {
        loadGLBFile(savedPath);
      }
    }, 300);
  }
}

function setupGLBLoadHandlers() {
  const loadBtn = document.getElementById("btnLoadGLB");
  const select = document.getElementById("glbFileSelect");

  const radioOriginal = document.getElementById("radioGlbOriginal");
  const radioMeasured = document.getElementById("radioGlbMeasured");

  if (radioOriginal) radioOriginal.addEventListener("change", applyGLBViewMode);
  if (radioMeasured) radioMeasured.addEventListener("change", applyGLBViewMode);

  if (!loadBtn || !select) return;

  loadBtn.addEventListener("click", () => {
    const selectedFile = select.value;
    if (!selectedFile) {
      console.warn("No GLB file selected");
      return;
    }

    console.log(`Loading GLB file: ${selectedFile}`);
    loadGLBFile(selectedFile);
    localStorage.setItem(SELECTED_GLB_STORAGE_KEY, selectedFile);
  });
}

function applyGLBViewMode() {
  if (!state.avatarModel || !state.avatarModel.userData.originalScales) return;

  state.avatarModel.traverse(child => {
    if (state.avatarModel.userData.originalScales[child.uuid]) {
      child.scale.copy(state.avatarModel.userData.originalScales[child.uuid]);
    }
  });

  // Apply subdued material (opacity 0.25) so skeleton overlay is clearly visible
  state.avatarModel.traverse((node) => {
    if (node.isMesh) {
      node.material = new THREE.MeshStandardMaterial({
        color: 0x97dffc,
        roughness: 0.84,
        metalness: 0.02,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide
      });
    }
  });

  if (modelMesh) modelMesh.visible = false;
  if (modelWireframe) modelWireframe.visible = false;

  modelScene.add(state.avatarModel);

  state.avatarModel.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(state.avatarModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Centre the model so its bounding-box centre is at world origin
  state.avatarModel.position.sub(center);
  // Slight vertical offset so the model sits naturally on the ground plane
  state.avatarModel.position.y -= size.y * 0.02;

  // Update all 4 multi-view cameras
  updateMultiViewCameras();
  queueMultiViewSnapshotCapture("applyGLBViewMode");

  startAvatarAnimation();
}


function loadGLBFile(path) {
  const metaEl = document.getElementById("bodyModelInfo");
  if (!metaEl) return;

  try {
    metaEl.innerHTML = `<div><i class="fa-solid fa-spinner fa-spin"></i> GLB 파일 로드 중...</div>`;

    if (state.avatarModel) {
      modelScene.remove(state.avatarModel);
      state.avatarModel = null;
    }
    if (modelMesh) {
      modelScene.remove(modelMesh);
      modelMesh.geometry.dispose();
      modelMesh.material.dispose();
      modelMesh = null;
    }
    if (modelWireframe) {
      modelScene.remove(modelWireframe);
      modelWireframe.geometry.dispose();
      modelWireframe.material.dispose();
      modelWireframe = null;
    }

    // Ensure multi-view grid is initialized
    if (Object.keys(multiViewRenderers).length === 0) {
      initMultiViewGrid();
    }

    if (!THREE.GLTFLoader) {
      console.warn("??GLTFLoader not found, loading script...");
      metaEl.innerHTML = `<div style="color:#facc15;">GLTFLoader 로드 중...</div>`;
      const script = document.createElement("script");
      script.src = "/ui/models/GLTFLoader.js";
      script.onload = () => {
        if (THREE.GLTFLoader) {
          loadGLBFile(path);
        } else {
          metaEl.innerHTML = `<div style="color:#ff6b6b;">GLTFLoader를 사용할 수 없습니다.</div>`;
        }
      };
      script.onerror = () => {
        metaEl.innerHTML = `<div style="color:#ff6b6b;">GLTFLoader 스크립트 로드 실패</div>`;
      };
      document.head.appendChild(script);
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      path,
      (gltf) => {
        console.log("??GLB file loaded successfully:", gltf);

        try {
          const root = gltf.scene;
          const glbMesh = root.children[0] || root;

          if (!glbMesh) {
            throw new Error("No mesh found in GLTF file");
          }

          // Log mesh structure for debugging
          let meshCount = 0, vertCount = 0;
          root.traverse(child => {
            if (child.isMesh) { meshCount++; if (child.geometry?.attributes?.position) vertCount += child.geometry.attributes.position.count; }
          });
          console.log(`[GLB Debug] scene children: ${root.children.length}, meshes: ${meshCount}, vertices: ${vertCount}`);

          // Save original scales for toggling without broken clone
          const originalScales = {};
          root.traverse(child => {
            originalScales[child.uuid] = child.scale.clone();
          });
          root.userData.originalScales = originalScales;

          state.avatarModel = root;
          avatarCache = true;

          // applyGLBViewMode handles rendering and scaling
          applyGLBViewMode();

          metaEl.innerHTML = [
            `<div><strong>Model Type:</strong> client_humanoid_body_v2 (GLB)</div>`,
            `<div><strong>File:</strong> ${path}</div>`,
            `<div><strong>Height:</strong> 180 cm</div>`,
            `<div><strong>Shoulder Width:</strong> 42 cm</div>`,
            `<div><strong>Pelvis Width:</strong> 34 cm</div>`
          ].join("");

          console.log("??GLB model rendered successfully");
        } catch (err) {
          console.error("??Error processing GLTF:", err);
          metaEl.innerHTML = `<div style="color:#ff6b6b;">GLB 모델 처리 실패: ${err.message}</div>`;
        }
      },
      (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
          const percent = (xhr.loaded / xhr.total * 100).toFixed(1);
          console.log(`로딩 진행: ${percent}%`);
        }
      },
      (err) => {
        console.error("??GLTFLoader error:", err);
        console.error("Error details:", err.message);
        const errorMsg = `GLB 파일 로드 중 오류 발생: ${err.message || "Unknown error"}`;
        metaEl.innerHTML = `<div style="color:#ff6b6b; padding:20px; line-height:1.6;">${errorMsg}</div>`;
      }
    );
  } catch (err) {
    console.error("??Error loading GLB file:", err);
    metaEl.innerHTML = `<div style="color:#ff6b6b;">파일 읽기 실패: ${err.message}</div>`;
  }
}
function isVisible(lm) {
  const v = lm?.visibility ?? 1.0;
  const p = lm?.presence ?? 1.0;
  return v >= 0.45 && p >= 0.45;
}

function formatMetric(val, unit) {
  if (val == null) return "--";
  if (typeof val === "number") {
    // If it's an angle or percentage, format accordingly
    if (unit === "deg") return `${val.toFixed(1)}°`;
    if (unit === "cm") return `${val.toFixed(1)} cm`;
    return val.toFixed(1);
  }
  return val;
}

/**
 * Caching and flag for Avatar
 */

/*
 * Loads a GLB avatar and scales its bones based on measurements
 */
async function loadAndScaleAvatar(meta, analysis = {}) {
  if (!modelScene || !meta) return;

  // Use cache if available
  if (state.avatarModel && state.avatarModel.userData.originalScales) {
    applyGLBViewMode();
    return;
  }

  // Hide cylinder
  if (modelMesh) modelMesh.visible = false;
  if (modelWireframe) modelWireframe.visible = false;

  if (!THREE.GLTFLoader) {
    console.error("??GLTFLoader is not available.");
    if (modelMesh) modelMesh.visible = true;
    return;
  }

  const loader = new THREE.GLTFLoader();
  const avatarUrl = '/ui/models/male.glb';

  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load(avatarUrl, resolve, undefined, reject);
    });

    const root = gltf.scene;
    const originalScales = {};
    root.traverse(child => {
      originalScales[child.uuid] = child.scale.clone();
    });
    root.userData.originalScales = originalScales;

    state.avatarModel = root;
    avatarCache = true;

    applyGLBViewMode();
  } catch (err) {
    console.error("Failed to load GLB avatar:", err);
    if (modelMesh) modelMesh.visible = true;
    if (modelWireframe) modelWireframe.visible = true;
  }
}

function startAvatarAnimation() {
  if (!isAvatarAnimating) {
    isAvatarAnimating = true;
  }
}

// Maps measured values to avatar bone/mesh scaling
function applyMeasurementsToAvatar(avatar, meta, analysis = {}) {
  const REF_HEIGHT_CM = 180.0;
  const REF_SHOULDER = 42.0;
  const REF_PELVIS = 34.0;
  const REF_ARM = REF_HEIGHT_CM * 0.40;
  const REF_LEG = REF_HEIGHT_CM * 0.50;
  const REF_TORSO = REF_HEIGHT_CM * 0.30;

  const heightScale = clampValue((meta.height_cm || REF_HEIGHT_CM) / REF_HEIGHT_CM, 0.82, 1.22);
  const shoulderScale = clampValue((meta.shoulder_width_cm || REF_SHOULDER) / REF_SHOULDER, 0.78, 1.28);
  const pelvisScale = clampValue((meta.pelvis_width_cm || REF_PELVIS) / REF_PELVIS, 0.80, 1.25);
  const armScale = clampValue((meta.arm_length_cm || REF_ARM) / REF_ARM, 0.82, 1.22);
  const legScale = clampValue((meta.leg_length_cm || REF_LEG) / REF_LEG, 0.82, 1.24);
  const torsoScale = clampValue((meta.torso_length_cm || REF_TORSO) / REF_TORSO, 0.84, 1.20);
  const depthScale = clampValue((meta.torso_depth_cm || (REF_PELVIS * 0.62)) / (REF_PELVIS * 0.62), 0.82, 1.22);

  avatar.scale.set(
    avatar.scale.x * heightScale,
    avatar.scale.y * heightScale,
    avatar.scale.z * heightScale
  );

  avatar.traverse((child) => {
    if (child.isBone) {
      const boneName = child.name.toLowerCase();

      const isShoulder = boneName.includes("shoulder") || boneName.includes("clavicle") || boneName.includes("collar");
      const isSpine = boneName.includes("spine") || boneName.includes("chest") || boneName.includes("upperchest");
      const isHip = boneName.includes("hip") || boneName.includes("pelvis");
      const isUpperArm = boneName.includes("upperarm") || (boneName.includes("arm") && !boneName.includes("forearm"));
      const isForearm = boneName.includes("forearm") || boneName.includes("lowerarm");
      const isHand = boneName.includes("hand");
      const isThigh = boneName.includes("thigh") || boneName.includes("upleg");
      const isCalf = boneName.includes("calf") || boneName.includes("shin") || boneName.includes("leg");
      const isFoot = boneName.includes("foot") || boneName.includes("toe");
      const isHead = boneName.includes("head") || boneName.includes("neck");

      if (isShoulder) {
        child.scale.x *= shoulderScale;
        child.scale.z *= depthScale;
      }
      if (isSpine) {
        child.scale.y *= torsoScale;
        child.scale.x *= shoulderScale;
        child.scale.z *= depthScale;
      }
      if (isHip) {
        child.scale.x *= pelvisScale;
        child.scale.y *= torsoScale;
        child.scale.z *= depthScale;
      }
      if (isUpperArm) {
        child.scale.y *= armScale;
        child.scale.x *= shoulderScale;
        child.scale.z *= depthScale;
      }
      if (isForearm) {
        child.scale.y *= armScale;
        child.scale.x *= shoulderScale;
        child.scale.z *= depthScale;
      }
      if (isHand) {
        child.scale.x *= shoulderScale;
        child.scale.y *= armScale;
        child.scale.z *= depthScale;
      }
      if (isThigh) {
        child.scale.y *= legScale;
        child.scale.x *= pelvisScale;
        child.scale.z *= depthScale;
      }
      if (isCalf) {
        child.scale.y *= legScale;
        child.scale.x *= pelvisScale;
        child.scale.z *= depthScale;
      }
      if (isFoot) {
        child.scale.x *= pelvisScale;
        child.scale.y *= legScale;
        child.scale.z *= depthScale;
      }
      if (isHead) {
        child.scale.x = shoulderScale * 0.96;
        child.scale.y = heightScale * 0.98;
        child.scale.z = depthScale * 0.98;
      }
    } else if (child.isMesh) {
      if (child.geometry) {
        child.geometry = child.geometry.clone();
        warpAvatarGeometry(child.geometry, meta, analysis);
      }
      child.scale.set(1, 1, 1);
      const meshName = (child.name || "").toLowerCase();
      if (meshName.includes("body") || meshName.includes("torso")) {
        child.scale.x = shoulderScale * 0.98;
        child.scale.y = torsoScale;
        child.scale.z = depthScale;
      }
    }
  });
}

function warpAvatarGeometry(geometry, meta, analysis = {}) {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  if (!bbox) return;

  const minY = bbox.min.y;
  const maxY = bbox.max.y;
  const height = Math.max(1e-6, maxY - minY);
  const shoulderY = minY + height * 0.78;
  const pelvisY = minY + height * 0.52;
  const kneeY = minY + height * 0.28;
  const pos = geometry.attributes.position;

  const headTilt = signedMetricRadians(analysis.head_tilt, 0.9);
  const shoulderSlope = signedMetricRadians(analysis.shoulder_slope, 0.65);
  const pelvicBalance = signedMetricRadians(analysis.pelvic_balance, 0.55);
  const lowerBodySym = signedMetricMagnitude(analysis.lower_body_symmetry, 0.035);
  const xoLeg = signedXoLeg(analysis.xo_leg, 0.07);
  const bodyCenterShift = signedMetricMagnitude(analysis.body_center, 0.045);
  const forwardHead = metricMagnitude(analysis.head_neck_shape, 0.16) + metricMagnitude(analysis.cervical_alignment, 0.12);
  const roundShoulder = metricMagnitude(analysis.shoulder_back_shape, 0.12) + metricMagnitude(analysis.back_shape, 0.10);
  const lumbarCurve = metricMagnitude(analysis.lumbar_curve, 0.10);
  const pelvicTilt = metricMagnitude(analysis.pelvic_shape, 0.08);
  const waistBias = signedMetricMagnitude(analysis.waist_shape, 0.03);

  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const yNorm = clampValue((y - minY) / height, 0, 1);
    const side = x >= 0 ? 1 : -1;

    const shoulderMask = smoothBand(yNorm, 0.68, 0.88);
    const torsoMask = smoothBand(yNorm, 0.44, 0.80);
    const pelvisMask = smoothBand(yNorm, 0.40, 0.60);
    const upperLegMask = smoothBand(yNorm, 0.18, 0.48);
    const lowerLegMask = smoothBand(yNorm, 0.02, 0.30);
    const headMask = smoothBand(yNorm, 0.84, 1.0);

    x += bodyCenterShift * shoulderMask * 0.35;
    x += waistBias * torsoMask * 0.45;

    y += side * shoulderSlope * shoulderMask * height * 0.08;
    y += side * pelvicBalance * pelvisMask * height * 0.06;

    if (side < 0) {
      y += lowerBodySym * (upperLegMask + lowerLegMask) * height;
    } else {
      y -= lowerBodySym * (upperLegMask + lowerLegMask) * height;
    }

    const kneeMask = smoothBand(yNorm, 0.14, 0.36);
    x += side * xoLeg * kneeMask * Math.abs(x) * 0.9;

    z += forwardHead * headMask * height * 0.12;
    z += roundShoulder * shoulderMask * height * 0.11;
    z += lumbarCurve * torsoMask * height * (y > pelvisY ? -0.04 : 0.07);
    z += pelvicTilt * pelvisMask * height * 0.06;

    if (headMask > 0.001) {
      const rotated = rotateAroundPoint2D(
        x,
        y,
        0,
        shoulderY + (maxY - shoulderY) * 0.52,
        headTilt * headMask
      );
      x = rotated.x;
      y = rotated.y;
    }

    if (y < pelvisY) {
      const legAnchor = y < kneeY ? kneeY : pelvisY;
      const legLengthScale = side < 0 ? (1 + lowerBodySym * 0.18) : (1 - lowerBodySym * 0.18);
      y = legAnchor + (y - legAnchor) * legLengthScale;
    }

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

function metricMagnitude(metric, maxScale) {
  const value = Number(metric?.value);
  if (!Number.isFinite(value)) return 0;
  const unit = metric?.unit || "";
  const normalized = unit === "score" || unit === "ratio"
    ? clampValue(value, 0, 1.5) / 1.5
    : clampValue(value, 0, 40) / 40;
  return normalized * maxScale;
}

function signedMetricMagnitude(metric, maxScale) {
  const magnitude = metricMagnitude(metric, maxScale);
  const type = String(metric?.type || "").toLowerCase();
  if (type.includes("left")) return -magnitude;
  if (type.includes("right")) return magnitude;
  return 0;
}

function signedMetricRadians(metric, multiplier) {
  const value = Number(metric?.value);
  if (!Number.isFinite(value)) return 0;
  const type = String(metric?.type || "").toLowerCase();
  const signed = type.includes("left") ? -value : type.includes("right") ? value : 0;
  return THREE.MathUtils.degToRad(signed * multiplier);
}

function signedXoLeg(metric, maxScale) {
  const magnitude = metricMagnitude(metric, maxScale);
  const type = String(metric?.type || "").toLowerCase();
  if (type.includes("o_")) return magnitude;
  if (type.includes("x_")) return -magnitude;
  if (type.includes("xo_")) return magnitude * 0.45;
  return 0;
}

function smoothBand(value, start, end) {
  if (value <= start || value >= end) return 0;
  const mid = (start + end) * 0.5;
  if (value <= mid) {
    return (value - start) / Math.max(1e-6, mid - start);
  }
  return (end - value) / Math.max(1e-6, end - mid);
}

function rotateAroundPoint2D(x, y, cx, cy, angleRad) {
  const dx = x - cx;
  const dy = y - cy;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  return {
    x: cx + dx * cosA - dy * sinA,
    y: cy + dx * sinA + dy * cosA
  };
}

window.BodyCheckOverlay3D = {
  drawLine,
  drawAngle,
  drawArrow,
  drawCenterLine,
  applyBoneRotation,
  renderPostureOverlay,
  clearOverlayGroup,
  setOverlayLandmarks,
  syncDebugControls,
  resetDebugBoneOffsets
};

init();
