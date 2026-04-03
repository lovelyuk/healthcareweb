'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import Sidebar from './components/Sidebar';
import styles from './anthropometry.module.css';

export default function AnthropometryPage() {
  const [showStandardView, setShowStandardView] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [anthroStatus, setAnthroStatus] = useState('Awaiting Scan');

  // Mini data values for the Standard View card
  const [miniHeight, setMiniHeight] = useState('-- cm');
  const [miniShoulderWidth, setMiniShoulderWidth] = useState('-- cm');
  const [miniPelvisWidth, setMiniPelvisWidth] = useState('-- cm');
  const [miniArmLength, setMiniArmLength] = useState('-- cm');
  const [miniLegLength, setMiniLegLength] = useState('-- cm');
  const [miniTorsoLength, setMiniTorsoLength] = useState('-- cm');

  function handleMeasureStart() {
    console.log('[anthropometry] measure start');
    setAnthroStatus('Measuring...');
    if (typeof window !== 'undefined' && (window as any).startAnthroMeasure) {
      (window as any).startAnthroMeasure();
    }
  }

  useEffect(() => {
    // Initialize translations fallback if missing
    if (typeof window !== 'undefined' && !(window as any).translations) {
      (window as any).translations = {
        ko: {
          brand_name: "BodyCheck",
          hc_hd_tilt: "머리 기울기",
          hc_sh_tilt: "어깨 기울기",
          hc_sh_balance: "어깨 균형",
          hc_pl_balance: "골반 균형",
          hc_center_axis: "몸의 중심축",
          hc_leg_symmetry: "하체 대칭",
          hc_knee_align: "무릎 정렬",
          hc_o_leg: "O/X 다리",
          hc_turtle: "거북목/일자목",
          hc_cervical_align: "경추 정렬",
          hc_round_shoulder: "라운드 숄더",
          hc_sp_curv: "척추 측만",
          hc_lumbar_curve: "요추 전만",
          hc_pelvis_tilt: "골반 경사",
          hc_calf_shape: "종아리 형태",
          hc_waist_shape: "허리 라인",
          grade_normal: "정상",
          grade_mild: "주의",
          grade_moderate: "심함",
          grade_warning: "주의",
          desc_head_tilt: "머리가 한쪽으로 기울어져 있는지 확인합니다.",
          desc_shoulder_slope: "좌우 어깨의 높이 차이를 분석합니다.",
          desc_shoulder_balance: "어깨의 앞뒤 균형 상태를 체크합니다.",
          desc_pelvic_balance: "골반의 좌우 높이와 균형을 측정합니다.",
          desc_body_center: "신체 중심선에서 벗어난 정도를 확인합니다.",
          desc_lower_body_symmetry: "다리 길이와 근육 대칭을 분석합니다.",
          desc_knee_shape: "무릎의 비정상적인 정렬 여부를 확인합니다.",
          desc_xo_leg: "휜 다리 활성화를 체크합니다.",
          desc_head_neck_shape: "목의 전방 돌출 정도를 분석합니다.",
          desc_cervical_alignment: "경추 곡선의 상태를 정밀 분석합니다.",
          desc_shoulder_back_shape: "어깨가 굽어있는 정도를 확인합니다.",
          desc_back_shape: "척추의 좌우 굽음 정도를 측정합니다.",
          desc_lumbar_curve: "허리 뼈의 곡선 상태를 확인합니다.",
          desc_pelvic_shape: "골반의 전방/후방 경사 각도를 분석합니다.",
          desc_calf_shape: "종아리 근육의 발달 대칭을 확인합니다.",
          desc_waist_shape: "좌우 허리 라인의 비대칭을 분석합니다."
        }
      };
    }

    async function initData() {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');

      if (id) {
        try {
          const res = await fetch(`/api/measurements/${id}`);
          if (res.ok) {
            const json = await res.json();
            const merged = json.mergedAnalysis || json.merged_analysis;
            if (json && merged) {
              // Standardize keys (camelCase -> snake_case) to match legacy JS expectations
              const standardized: any = { ...merged };
              
              if (merged.shoulderWidth && !standardized.shoulder_width) standardized.shoulder_width = merged.shoulderWidth;
              if (merged.pelvisWidth && !standardized.pelvis_width) standardized.pelvis_width = merged.pelvisWidth;
              if (merged.armLength && !standardized.arm_length) standardized.arm_length = merged.armLength;
              if (merged.legLength && !standardized.leg_length) standardized.leg_length = merged.legLength;
              if (merged.torsoLength && !standardized.torso_length) standardized.torso_length = merged.torsoLength;

              // Ensure grade and value exists for all metrics
              Object.keys(standardized).forEach(key => {
                if (standardized[key] && typeof standardized[key] === 'object') {
                  standardized[key].enabled = true;
                  if (standardized[key].grade === undefined) standardized[key].grade = 'normal';
                  if (standardized[key].value === undefined) standardized[key].value = 0;
                }
              });

              const reportData = {
                front: {
                  imageDataUrl: json.frontImage || json.front_image,
                  landmarks: json.frontLandmarks || json.front_landmarks,
                  analysis: standardized
                },
                side: {
                  imageDataUrl: json.sideImage || json.side_image,
                  landmarks: json.sideLandmarks || json.side_landmarks,
                  analysis: standardized
                },
                frontImage: json.frontImage || json.front_image,
                sideImage: json.sideImage || json.side_image,
                mergedAnalysis: standardized,
                postureScore: json.postureScore || 85,
                bodyModel: json.bodyModel || json.body_model,
                aiSummary: json.aiAnalysisSummary || json.aiSummary || json.ai_summary
              };
              localStorage.setItem('bodyCheckReport', JSON.stringify(reportData));
              
              // Local state update
              setMiniHeight(`${standardized.height?.value ?? '--'} cm`);
              setMiniShoulderWidth(`${standardized.shoulder_width?.value ?? '--'} cm`);
              setMiniPelvisWidth(`${standardized.pelvis_width?.value ?? '--'} cm`);
              setMiniArmLength(`${standardized.arm_length?.value ?? '--'} cm`);
              setMiniLegLength(`${standardized.leg_length?.value ?? '--'} cm`);
              setMiniTorsoLength(`${standardized.torso_length?.value ?? '--'} cm`);
              
              setShowReport(true);
              setShowStandardView(false);
            }
          }
        } catch (err) {
          console.error('[anthropometry] Failed to load DB data:', err);
        }
      }

      // Final Render Trigger
      setTimeout(() => {
        if ((window as any).loadBodyCheckReportWithAi) {
          (window as any).loadBodyCheckReportWithAi();
        }
      }, 500);
    }
    
    initData();
  }, []);

  return (
    <div className={styles.container}>
      {/* Background Effects */}
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glow} ${styles.glow1}`}></div>
        <div className={`${styles.glow} ${styles.glow2}`}></div>
        <div className={`${styles.glow} ${styles.glow3}`}></div>
      </div>

      <Sidebar />

      <main className={styles.main}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h1 data-i18n="anthro_title">Anthropometry</h1>
            <p data-i18n="anthro_subtitle">Measurement-based 3D body reconstruction & balance analysis</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={() => window.location.reload()}>
              <i className="fa-solid fa-arrows-rotate" />
            </button>
          </div>
        </div>

        <div className="check-grid">
          <div className="diagnostics-panel" style={{ gridColumn: '1 / -1' }}>
            
            {/* Tab Content (from legacy html) */}
            <div className="tab-content active" id="tab-anthro">
                
                {/* Standard View */}
                <div id="anthroStandardView" className={`${!showStandardView ? 'hidden' : ''}`}>
                <div className={styles.gridCard}>
                    <div className={styles.cardHeader}>
                    <h2 data-i18n="nav_anthropometry">Anthropometry</h2>
                    <i className="fa-solid fa-ruler-combined icon-faded"></i>
                    </div>
                    <div className={`${styles.liveData} ${styles.scrollableData}`}>
                    <div className={styles.dataRow}><span data-i18n="anthro_height">Height</span><span className={styles.monoValue} id="mini_height">{miniHeight}</span></div>
                    <div className={styles.dataRow}><span data-i18n="anthro_shoulder">Shoulder Width</span><span className={styles.monoValue} id="mini_shoulder_width">{miniShoulderWidth}</span></div>
                    <div className={styles.dataRow}><span data-i18n="anthro_pelvis">Pelvis Width</span><span className={styles.monoValue} id="mini_pelvis_width">{miniPelvisWidth}</span></div>
                    <div className={styles.dataRow}><span data-i18n="anthro_arm">Arm Length</span><span className={styles.monoValue} id="mini_arm_length">{miniArmLength}</span></div>
                    <div className={styles.dataRow}><span data-i18n="anthro_leg">Leg Length</span><span className={styles.monoValue} id="mini_leg_length">{miniLegLength}</span></div>
                    <div className={styles.dataRow}><span data-i18n="anthro_torso">Torso Length</span><span className={styles.monoValue} id="mini_torso_length">{miniTorsoLength}</span></div>
                    </div>
                    <div className={`${styles.statusBadge} ${styles.pending}`} id="anthroStatus" data-i18n="hc_await">{anthroStatus}</div>
                    <div style={{ marginTop: '20px' }}>
                    <button id="btnMeasureStart" className={styles.primaryBtn} onClick={handleMeasureStart} style={{ width: '100%', justifyContent: 'center' }}>
                        <i className="fa-solid fa-play"></i>
                        <span id="btnMeasureText" data-i18n="hc_measure_start">측정 시작</span>
                    </button>
                    </div>
                </div>
                </div>

                {/* Final Result Report (Legacy Target) */}
                <div id="reportContainer" className={`report-container ${!showReport ? 'hidden' : ''}`} style={{ position: 'relative' }}>
                
                    {/* 1. AI Summary Section */}
                    <div className="report-section anthro-ai-summary-card">
                        <div className="section-title"><i className="fa-solid fa-sparkles"></i> <span>AI 분석 결과</span></div>
                        <div id="aiSummaryStatus" className="anthro-ai-summary-status">
                            <i className="fa-solid fa-wave-square"></i>
                            <span>분석 대기중</span>
                        </div>
                        <div id="aiSummaryLoading" className="anthro-ai-summary-loading hidden">
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <span>측정 결과를 분석중입니다...</span>
                        </div>
                        <div id="anthroAiSummaryContent" className="anthro-ai-summary-content">AI 분석 결과를 준비중입니다.</div>
                    </div>

                    {/* AI Overview Card */}
                    <div className="report-section ai-overview-card hidden" id="aiOverviewCard">
                        <div className="section-title"><i className="fa-solid fa-chart-line"></i> <span>종합 평가</span></div>
                        <div id="aiOverviewContent"></div>
                    </div>

                    {/* Posture Analysis Card */}
                    <div className="report-section ai-posture-analysis-card hidden" id="aiPostureAnalysisCard">
                        <div className="section-title"><i className="fa-solid fa-magnifying-glass-chart"></i> <span>자세 분석</span></div>
                        <div id="aiPostureAnalysisContent"></div>
                    </div>

                    {/* Problem Points Card */}
                    <div className="report-section ai-problem-points-card hidden" id="aiProblemPointsCard">
                        <div className="section-title"><i className="fa-solid fa-triangle-exclamation"></i> <span>문제 포인트 진단</span></div>
                        <div id="aiProblemPointsContent"></div>
                    </div>

                    {/* Specialized AI Cards (Recommendations, Progress, etc) */}
                    <div className="report-section ai-recommendations-card hidden" id="aiRecommendationsCard">
                        <div className="section-title"><i className="fa-solid fa-wand-magic-sparkles"></i> <span>맞춤 개선 가이드</span></div>
                        <div id="aiRecommendationsContent"></div>
                    </div>
                    <div className="report-section ai-progress-card hidden" id="aiProgressCard">
                        <div className="section-title"><i className="fa-solid fa-clock-rotate-left"></i> <span>변화 추적</span></div>
                        <div id="aiProgressContent"></div>
                    </div>
                    <div className="report-section lifestyle-guidance-card hidden" id="lifestyleGuidanceCard">
                        <div className="section-title"><i className="fa-solid fa-leaf"></i> <span>맞춤 생활 가이드</span></div>
                        <div id="lifestyleGuidanceContent"></div>
                    </div>

                    {/* 주요 체형 측정값 */}
                    <div className="report-section">
                        <div className="section-title"><i className="fa-solid fa-ruler-combined"></i> <span>주요 체형 측정값</span></div>
                        <div id="anthroMetricCards" className="anthro-metric-grid"></div>
                    </div>

                    {/* Front View Section */}
                    <div className="report-section">
                        <div className="section-title">
                            <i className="fa-solid fa-person"></i> <span data-i18n="hist_front_view">정면 분석</span> & <span data-i18n="anthro_meas_report">Measurement Report</span>
                        </div>
                        <div className="visual-analysis-row">
                            <div className="visual-img-container">
                                <img id="frontReportImage" alt="Front Capture" />
                            </div>
                            <div className="visual-metrics-container" id="frontMetricsList">
                                {/* Dynamic Front Metrics */}
                            </div>
                        </div>
                    </div>

                    {/* Side View Section */}
                    <div className="report-section">
                        <div className="section-title">
                            <i className="fa-solid fa-person-walking-arrow-right"></i> <span data-i18n="hist_side_view">측면 분석</span> & <span data-i18n="anthro_meas_report">Measurement Report</span>
                        </div>
                        <div className="visual-analysis-row">
                            <div className="visual-img-container">
                                <img id="sideReportImage" alt="Side Capture" />
                            </div>
                            <div className="visual-metrics-container" id="sideMetricsList">
                                {/* Dynamic Side Metrics */}
                            </div>
                        </div>
                    </div>

                    {/* Posture Analysis Integration */}
                    <div className="report-section">
                        <div className="section-title">
                            <i className="fa-solid fa-magnifying-glass-chart"></i> <span data-i18n="anthro_posture_summary">자세 분석 Summary</span>
                        </div>
                        <div className="posture-grid" id="postureGrid">
                            {/* Cards will be injected via JS */}
                        </div>
                    </div>

                </div> {/* reportContainer */}

                {/* Body Model Section (Always Visible) */}
                <div className="report-section" style={{ marginTop: '20px' }}>
                    <div className="section-title"><i className="fa-solid fa-cube"></i> <span>Body Model</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '20px', alignItems: 'stretch' }}>
                        <div className="multi-view-grid" id="multiViewGrid">
                            <div className="multi-view-cell" id="viewCell_front">
                                <div className="view-label">Front</div>
                                <img id="snapshotImg_front" className="multi-view-image" alt="Front snapshot" />
                                <div id="snapshotStatus_front" className="snapshot-status loading">
                                    <div className="snapshot-status-primary">Front view waiting...</div>
                                    <div className="snapshot-status-secondary">모델 로딩 대기 중</div>
                                </div>
                                <canvas id="canvas_front" className="multi-view-canvas"></canvas>
                            </div>
                            <div className="multi-view-cell" id="viewCell_right">
                                <div className="view-label">Right</div>
                                <img id="snapshotImg_right" className="multi-view-image" alt="Right snapshot" />
                                <div id="snapshotStatus_right" className="snapshot-status loading">
                                    <div className="snapshot-status-primary">Right view waiting...</div>
                                    <div className="snapshot-status-secondary">모델 로딩 대기 중</div>
                                </div>
                                <canvas id="canvas_right" className="multi-view-canvas"></canvas>
                            </div>
                            <div className="multi-view-cell" id="viewCell_back">
                                <div className="view-label">Back</div>
                                <img id="snapshotImg_back" className="multi-view-image" alt="Back snapshot" />
                                <div id="snapshotStatus_back" className="snapshot-status loading">
                                    <div className="snapshot-status-primary">Back view waiting...</div>
                                    <div className="snapshot-status-secondary">모델 로딩 대기 중</div>
                                </div>
                                <canvas id="canvas_back" className="multi-view-canvas"></canvas>
                            </div>
                            <div className="multi-view-cell" id="viewCell_left">
                                <div className="view-label">Left</div>
                                <img id="snapshotImg_left" className="multi-view-image" alt="Left snapshot" />
                                <div id="snapshotStatus_left" className="snapshot-status loading">
                                    <div className="snapshot-status-primary">Left view waiting...</div>
                                    <div className="snapshot-status-secondary">모델 로딩 대기 중</div>
                                </div>
                                <canvas id="canvas_left" className="multi-view-canvas"></canvas>
                            </div>
                        </div>
                        
                        <div id="bodyModelMeta" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.7' }}>
                            <div id="bodyModelInfo">No body model loaded.</div>
                            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                            <select id="glbFileSelect" style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px 14px', color: 'white', fontSize: '13px', cursor: 'pointer' }}>
                                <option value="">-- GLB 파일 선택 --</option>
                            </select>
                            <button id="btnLoadGLB" className={styles.primaryBtn} style={{ background: 'var(--intel-blue)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <i className="fa-solid fa-upload"></i> GLB 로드
                            </button>
                            </div>
                            <div style={{ marginTop: '12px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <label style={{ color: 'white', fontSize: '13px', cursor: 'pointer' }}><input type="radio" name="glbViewMode" value="original" id="radioGlbOriginal" /> 원본 보여주기</label>
                                <label style={{ color: 'white', fontSize: '13px', cursor: 'pointer' }}><input type="radio" name="glbViewMode" value="measured" id="radioGlbMeasured" defaultChecked /> 측정값 적용</label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recommendations Guide */}
                <div className="report-section recommendations">
                    <div className="section-title"><i className="fa-solid fa-wand-magic-sparkles"></i> <span data-i18n="rp_rec_routine">추천 교정 가이드</span></div>
                    <div className="rec-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div className="rec-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                            <div className="rec-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--intel-cyan)', fontWeight: 700, fontSize: '16px' }}>
                                <i className="fa-solid fa-person-walking"></i>
                                <span data-i18n="rp_rec_routine">추천 교정 운동</span>
                            </div>
                            <div className="rec-thumbnails" id="exerciseThumbs" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                                {/* Exercise thumbnails injected by JS */}
                            </div>
                        </div>
                        <div className="rec-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px' }}>
                            <div className="rec-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', color: '#fbbf24', fontWeight: 700, fontSize: '16px' }}>
                                <i className="fa-solid fa-lightbulb"></i>
                                <span data-i18n="anthro_tip_title">생활 건강 팁</span>
                            </div>
                            <ul className="rec-list" id="lifestyleTips" style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                {/* Lifestyle tips injected by JS */}
                            </ul>
                        </div>
                    </div>
                </div>

            </div> {/* tab-anthro */}
          </div>
        </div>
      </main>

      {/* Scripts (Load in order matching anthropometry.html as closely as possible) */}
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" strategy="beforeInteractive" />
      
      <Script src="/ui/lib/api.js?v=20240321" strategy="lazyOnload" />
      <Script src="/ui/user-context.js" strategy="lazyOnload" />
      <Script src="/ui/anthropometry.js?v=20260403_snapshotfix" strategy="lazyOnload" />
    </div>
  );
}
