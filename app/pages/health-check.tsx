'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import { useMeasureFlow } from '../lib/hooks/useMeasureFlow';
import { useWebcam } from '../lib/hooks/useWebcam';
import { useMediaPipePose, POSE_CONNECTIONS, Landmark } from '../lib/hooks/useMediaPipePose';
import { 
  computeAnalysisFromLandmarks, 
  computePostureScore,
  type PostureAnalysis 
} from '../lib/postureAnalysis';
import styles from './health-check.module.css';

interface CaptureResult {
  imageDataUrl: string;
  landmarks: Landmark[];
  timestamp: number;
  view: 'front' | 'side';
  analysis?: PostureAnalysis;
}

// ─── Guide text map (React-native friendly — no DOM IDs needed) ───────────────
const GUIDE_TEXTS = {
  idle:        { title: '에이전트 연결 대기 중',          desc: '좌측 상단의 에이전트 켜기 버튼을 눌러주세요.', icon: 'fa-robot' },
  wait_ready:  { title: '준비하세요',                     desc: '카메라 앞에 서서 전신이 보이도록 하세요.',   icon: 'fa-person' },
  prepare:     { title: '정면 측정 준비',                  desc: '정면을 바라보며 어깨를 자연스럽게 내려주세요.', icon: 'fa-person' },
  front_hold:  { title: '정면 촬영 중',                   desc: '자세를 유지하세요...',                     icon: 'fa-camera' },
  turn:        { title: '측면으로 전환',                  desc: '우측면이 카메라를 향하도록 천천히 돌아주세요.', icon: 'fa-rotate-right' },
  side_hold:   { title: '측면 촬영 중',                   desc: '자세를 유지하세요...',                     icon: 'fa-camera' },
  analyzing:   { title: '결과 분석 중',                   desc: '데이터를 처리하고 있습니다...',             icon: 'fa-spinner fa-spin' },
  result:      { title: '측정 완료',                      desc: '결과를 확인하세요.',                       icon: 'fa-clipboard-check' },
} as const;

const STEP_TEXT: Record<string, string> = {
  idle:        '대기',
  wait_ready:  '준비하세요...',
  prepare:     'Step 1: 정면 측정 준비',
  front_hold:  'Step 1: 정면 측정 중',
  turn:        'Step 2: 측면 전환',
  side_hold:   'Step 2: 측면 측정 중',
  analyzing:   'Step 3: 결과 분석 중...',
  result:      '분석 완료',
};

// ─── Leveler config ─────────────────────────────────────────────────────────
const LEVELER_ITEMS = [
  { label: '어깨 수평', key: 'shoulder' as const, color: '#4ade80' },
  { label: '골반 수평', key: 'pelvis' as const,   color: '#facc15' },
  { label: '중심 정렬', key: 'center' as const,   color: '#f87171' },
];

// ─── DISQ: RealSense stub — removed from scope ──────────────────────────────
// RealSense MJPEG streaming, depth mesh capture, and Pylon capture are
// not implemented. All camera access uses browser WebRTC via useWebcam hook.
// Remaining RealSense deps in ui/health-check.js:
//   - startMeshCapture() → not implemented
//   - buildCompositeReport() → not implemented
//   - Pylon / rs2_pipeline → not implemented

export default function HealthCheckPage() {
  // ─── DOM refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // ─── Webcam state (useWebcam hook) ─────────────────────────────────────────
  const { stream, isLoading: isWebcamLoading, hasError: hasWebcamError, errorName: webcamErrorName, isActive: isWebcamActive, start: startWebcam, stop: stopWebcam } =
    useWebcam(videoRef);

  // ─── Agent UI state (declared early — consumed by useMediaPipePose below) ──
  const [agentOn, setAgentOn] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [showCameraError, setShowCameraError] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    '> System initialized.',
    '> Waiting for user input...',
  ]);
  const [showPoints, setShowPoints] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const [showGuides, setShowGuides] = useState(true);

  // ─── Terminal logging (uses state setters declared above) ──────────────────
  function logTerminal(msg: string) {
    setTerminalLines((prev) => [...prev.slice(-80), `> ${msg}`]);
  }

  // ─── Pose detection state (useMediaPipePose hook) ──────────────────────────
  // landmarksRef gives direct access to latest landmarks without triggering re-renders
  const { landmarksRef: poseLandmarksRef, isReady: poseReady } = useMediaPipePose({
    videoRef,
    isActive: agentOn,
    onLog: (msg) => logTerminal(msg),
  });

  // ─── Measurement step state (useMeasureFlow hook) ────────────────────────────
  const {
    step,
    progress,
    isActive,
    hasFrontCapture,
    hasSideCapture,
    levelerValues,
    isCountdownVisible,
    countdownNum,
    isRetakeVisible,
    showCompletionModal,
    setShowCompletionModal,
    startWorkflow,
    stopWorkflow,
    retakeCapture: handleRetake,
    updateLeveler,
    onCountdownTick,
    onCountdownComplete,
  } = useMeasureFlow({
    onWebcamStart: startWebcam,
    onWebcamStop: stopWebcam,
    onLog: (msg: string) => logTerminal(msg),
    onCaptureFrame: (view: 'front' | 'side') => captureFrameStub(view),
    onBuildReport: (front: any, side: any) => buildReportStub(front, side),
  });

  // ─── Derived state ──────────────────────────────────────────────────────────
  const guideInfo = (GUIDE_TEXTS as any)[step] ?? GUIDE_TEXTS.idle;
  const stepBarText = STEP_TEXT[step] ?? step;
  const actionMsg = guideInfo.desc;
  const showCountdownOverlay = step === 'front_hold' || step === 'side_hold';

  // ─── Camera error handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (hasWebcamError) {
      setShowCameraError(true);
      logTerminal(`[Webcam] Error: ${webcamErrorName ?? 'Unknown'}`);
    } else {
      setShowCameraError(false);
    }
  }, [hasWebcamError, webcamErrorName]);

  // ─── Canvas dimension sync ───────────────────────────────────────────────────
  // Keep overlay canvas sized to match the video element each time stream starts
  useEffect(() => {
    const syncCanvas = () => {
      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;
      if (!video || !canvas) return;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };

    syncCanvas();
    const video = videoRef.current;
    if (video) {
      video.addEventListener('resize', syncCanvas);
      return () => video.removeEventListener('resize', syncCanvas);
    }
  }, [stream]);

  // ─── Skeleton canvas draw loop ───────────────────────────────────────────────
  // Draws pose skeleton overlay on each animation frame.
  // Uses real landmarks from useMediaPipePose when agent is running.
  // Only activates when agentOn && (showPoints || showLines).
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Only draw when agent is on and skeleton display is enabled
    if (!agentOn || (!showPoints && !showLines)) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let rafId: number;

    function drawSkeleton() {
      const canvasEl = overlayCanvasRef.current;
      const videoEl = videoRef.current;
      const ctx = canvasEl?.getContext('2d');
      if (!ctx || !canvasEl || !videoEl) { rafId = requestAnimationFrame(drawSkeleton); return; }

      const w = canvasEl.width;
      const h = canvasEl.height;
      if (w === 0 || h === 0) { rafId = requestAnimationFrame(drawSkeleton); return; }

      // 1. Clear canvas
      ctx.clearRect(0, 0, w, h);

      // 2. Draw video frame mirrored (to match CSS display)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-w, 0);
      ctx.drawImage(videoEl, 0, 0, w, h);
      ctx.restore();

      // 3. Show status overlay when pose is initializing or no person detected
      if (!poseReady || poseLandmarksRef.current.length === 0) {
        if (!poseReady) {
          // MediaPipe still loading
          ctx.fillStyle = 'rgba(0,220,255,0.85)';
          ctx.font = '14px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('pose 초기화 중...', w / 2, h / 2);
        } else {
          // Pose ready but no person in frame
          ctx.fillStyle = 'rgba(255,100,0,0.7)';
          ctx.font = '13px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('카메라에 사람을 위치시켜주세요', w / 2, h / 2);
        }
        rafId = requestAnimationFrame(drawSkeleton);
        return;
      }

      // 4. Draw real skeleton from MediaPipe PoseLandmarker
      // Webcam is mirrored: raw lm.x=0 appears at visual right, lm.x=1 at visual left.
      // Canvas x transform: x_canvas = (1 - lm.x) * w  → correctly mirrors landmark to match video
      const mx = (nx: number) => (1 - nx) * w;
      const my = (ny: number) => ny * h;

      // Draw connections (lines)
      if (showLines) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (const [a, b] of POSE_CONNECTIONS) {
          const la = poseLandmarksRef.current.find(lm => lm.index === a);
          const lb = poseLandmarksRef.current.find(lm => lm.index === b);
          if (!la || !lb || la.visibility < 0.3 || lb.visibility < 0.3) continue;
          ctx.beginPath();
          ctx.moveTo(mx(la.x), my(la.y));
          ctx.lineTo(mx(lb.x), my(lb.y));
          ctx.stroke();
        }
      }

      // Draw landmark points
      if (showPoints) {
        for (const lm of (poseLandmarksRef.current as Landmark[])) {
          if (lm.visibility < 0.3) continue;
          const cx = mx(lm.x);
          const cy = my(lm.y);
          const r = lm.visibility > 0.6 ? 5 : 3; // larger if high confidence
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = lm.visibility > 0.6 ? '#ff4df0' : '#ff88cc';
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      rafId = requestAnimationFrame(drawSkeleton);
    }

    rafId = requestAnimationFrame(drawSkeleton);
    return () => cancelAnimationFrame(rafId);
  }, [stream, agentOn, showPoints, showLines, poseLandmarksRef, poseReady]);

  // ─── Agent toggle ───────────────────────────────────────────────────────────
  async function handleAgentToggle() {
    if (!agentOn) {
      // START agent
      setShowGuide(false);
      logTerminal('> Agent starting...');

      const mediaStream = await startWebcam();
      if (!mediaStream) {
        logTerminal('> Agent start aborted — webcam error');
        setShowGuide(true);
        return;
      }

      setAgentOn(true);
      setIsTracking(true);
      logTerminal('> Agent started (webcam mode)');
      startWorkflow();
    } else {
      // STOP agent
      stopWebcam();
      stopWorkflow();
      setAgentOn(false);
      setIsTracking(false);
      setShowGuide(true);
      logTerminal('> Agent stopped');
    }
  }

  // ─── Measure start button (separate from agent) ───────────────────────────────
  function handleMeasureStart() {
    if (!agentOn) return;
    if (isActive) {
      stopWorkflow();
      logTerminal('> Measurement stopped');
    } else {
      startWorkflow();
      logTerminal('> Measurement started');
    }
  }

  // ─── Retake handlers ─────────────────────────────────────────────────────────
  function handleRetakeFront() {
    handleRetake('front');
    logTerminal('> Retake front capture');
  }

  function handleRetakeSide() {
    handleRetake('side');
    logTerminal('> Retake side capture');
  }

  // ─── Stub: capture frame from video ─────────────────────────────────────────
  // TODO: Replace with actual MediaPipe pose capture when pose detection is wired
  function captureFrameStub(view: 'front' | 'side'): { imageDataUrl: string; landmarks: any[]; timestamp: number; view: 'front' | 'side' } | null {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      logTerminal(`[Capture] ${view} capture skipped — video not ready`);
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    
    // Use real landmarks from MediaPipe
    const landmarks = Array.from(poseLandmarksRef.current || []);
    logTerminal(`[Capture] ${view} frame captured with ${landmarks.length} landmarks (${canvas.width}x${canvas.height})`);
    
    return { 
      imageDataUrl, 
      landmarks, 
      timestamp: Date.now(), 
      view,
      analysis: computeAnalysisFromLandmarks(landmarks, view, canvas.width, canvas.height)
    } as CaptureResult;
  }

  // ─── Stub: build report ─────────────────────────────────────────────────────
  // TODO: Replace with actual analysis computation via computeAnalysisFromLandmarks
  async function buildReportStub(front: any, side: any) {
    if (!front || !side) {
      logTerminal('> Build report failed: Missing front or side capture');
      return;
    }
    logTerminal('> Building measure report...');
    try {
      const mergedAnalysis = {
        ...front.analysis,
        ...side.analysis
      };
      const postureScore = computePostureScore(mergedAnalysis);

      const report = {
        frontImage: front.imageDataUrl,
        sideImage: side.imageDataUrl,
        frontLandmarks: front.landmarks,
        sideLandmarks: side.landmarks,
        front,
        side,
        headTilt: mergedAnalysis.head_tilt?.value ?? null,
        shoulderTilt: mergedAnalysis.shoulder_slope?.value ?? null,
        pelvicTilt: mergedAnalysis.pelvic_shape?.value ?? null,
        postureScore,
        mergedAnalysis,
        analysisReady: true,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem('bodyCheckReport', JSON.stringify(report));
      logTerminal(`> Report saved. Posture Score: ${postureScore}`);
      
      // Save to server
      try {
        const res = await fetch('/api/measurements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...report,
            subjectNo: 'test-user@example.com' // Placeholder
          })
        });
        if (res.ok) logTerminal('> Report synced to server');
      } catch (err) {
        logTerminal('> Server sync failed');
      }

    } catch (err: any) {
      logTerminal(`> Report build failed: ${err.message}`);
    }
  }

  // ─── Leveler indicator position (CSS left %) ──────────────────────────────────
  function levelerPosition(value: number): string {
    // value: -50..50 → 0%..100%, with 50 being center
    const pct = Math.max(0, Math.min(100, ((value + 50) / 100) * 100));
    return `${pct}%`;
  }

  // ─── Tracking badge color ────────────────────────────────────────────────────
  const trackingBadgeClass = isTracking ? styles.good : '';

  // ─── Step mask: which overlays to show ───────────────────────────────────────
  const showWebcamStatusBadge = agentOn && stream != null;
  const showGuideOverlay = agentOn && step !== 'result';
  const guideOverlayBg = step === 'result' ? 'rgba(0,100,0,0.5)' : 'rgba(0,0,0,0.6)';

  return (
    <div className={styles.appShell}>
      {/* Background glows */}
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glow} ${styles.glow1}`} />
        <div className={`${styles.glow} ${styles.glow2}`} />
      </div>

      <Sidebar />

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.checkGrid}>

          {/* ===================== LEFT: Active Feed ===================== */}
          <div className={`${styles.activeFeedContainer} ${styles.gridCard}`}>

            {/* 1. Top Status Bar */}
            <div className={styles.topStatusBar}>

              {/* Left: Controls */}
              <div className={styles.statusControls}>
                <button
                  id="btnAgent"
                  className={styles.btn}
                  onClick={handleAgentToggle}
                  style={
                    agentOn
                      ? { background: 'rgba(239,68,68,0.85)', boxShadow: '0 0 15px rgba(239,68,68,0.4)' }
                      : { background: 'var(--intel-blue)' }
                  }
                >
                  <i className={`fa-solid ${agentOn ? 'fa-stop' : 'fa-power-off'}`} />
                  <span id="btnAgentText">
                    {agentOn ? '에이전트 종료' : '에이전트 켜기'}
                  </span>
                </button>

                <button
                  id="btnMeasureStart"
                  className={styles.btn}
                  style={{
                    display: agentOn ? 'flex' : 'none',
                    background: isActive ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: isActive ? '#ef4444' : '#4ade80',
                    border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
                  }}
                  onClick={handleMeasureStart}
                >
                  <i className={`fa-solid ${isActive ? 'fa-stop' : 'fa-play'}`} />
                  <span id="btnMeasureText">
                    {isActive ? '측정 중지' : '측정 시작'}
                  </span>
                </button>
              </div>

              {/* Center: Step & Progress */}
              <div className={styles.statusProgress}>
                <div className={styles.statusProgressText}>{stepBarText}</div>
                <div className={styles.progressBarContainer}>
                  <div
                    id="overallProgress"
                    className={styles.overallProgress}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Right: Badges */}
              <div className={styles.statusBadges}>
                <div
                  id="badgeTracking"
                  className={`${styles.miniPill} ${trackingBadgeClass}`}
                  style={
                    isTracking
                      ? { borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.12)' }
                      : { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }
                  }
                >
                  <i className={`fa-solid ${isTracking ? 'fa-user-check' : 'fa-user-slash'}`} />
                  <span>{isTracking ? 'Tracking OK' : 'Tracking Off'}</span>
                </div>
                <div className={styles.miniPill}>
                  <i className="fa-solid fa-street-view" />
                  <span id="viewText">
                    {step === 'front_hold' ? 'Front' : step === 'side_hold' ? 'Side' : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Center Live View */}
            <div id="feedWindow" className={styles.feedWindow}>

              {/* Camera off: CSS placeholder */}
              <div className={`${styles.cameraPlaceholder} ${stream ? styles.hidden : ''}`}>
                <i className="fa-solid fa-video" />
                <p>카메라를 켜주세요</p>
                <span>에이전트 켜기 버튼을 눌러 시작하세요</span>
              </div>

              {/* Webcam video */}
              <video
                ref={videoRef}
                id="webcamVideo"
                autoPlay
                playsInline
                muted
                className={`${styles.webcamVideo} ${stream ? styles.videoVisible : ''}`}
              />

              {/* Pose overlay canvas — same dimensions as video, on top */}
              <canvas
                ref={overlayCanvasRef}
                id="overlayCanvas"
                className={styles.overlayCanvas}
              />

              {/* Webcam status badge */}
              <div
                id="webcamStatusOverlay"
                className={styles.webcamStatusOverlay}
                style={{ display: showWebcamStatusBadge ? 'flex' : 'none' }}
              >
                <div className={styles.webcamStatusBadge}>
                  <i className="fa-solid fa-camera" style={{ color: '#4ade80', fontSize: '16px' }} />
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>Webcam Active</span>
                </div>
              </div>

              {/* Camera error overlay */}
              <div
                id="cameraErrorOverlay"
                className={`${styles.cameraErrorOverlay} ${showCameraError ? styles.visible : ''}`}
              >
                <i className="fa-solid fa-video-slash" style={{ fontSize: '3rem', color: '#f87171', marginBottom: '16px' }} />
                <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '20px' }}>카메라 접근 실패</h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', maxWidth: '340px', lineHeight: 1.6 }}>
                  웹캠 접근이 거부되었습니다. 카메라 권한을 허용해주세요.
                </p>
                <button
                  id="btnRetryCamera"
                  className={styles.btnRetryCamera}
                  onClick={() => setShowCameraError(false)}
                >
                  다시 시도
                </button>
              </div>

              {/* Webcam loading overlay */}
              <div
                id="webcamLoadingOverlay"
                className={`${styles.webcamLoadingOverlay} ${isWebcamLoading ? styles.visible : ''}`}
              >
                <div className={styles.webcamSpinner} />
                <span className={styles.webcamLoadingText}>카메라 연결 중...</span>
              </div>

              {/* Step mask */}
              <div id="stepMask" className={styles.stepMask} />

              {/* Guide overlay */}
              {showGuideOverlay && (
                <div
                  id="guideOverlay"
                  className={styles.guideOverlay}
                  style={{ background: guideOverlayBg }}
                >
                  <i
                    className={`fa-solid ${guideInfo.icon}`}
                    style={{ fontSize: '4rem', color: 'var(--intel-cyan)', marginBottom: '20px', textShadow: '0 0 20px rgba(0,199,253,0.5)' }}
                  />
                  <h2
                    style={{ color: 'white', marginBottom: '12px', fontWeight: '700', fontSize: '26px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {guideInfo.title}
                  </h2>
                  <p
                    style={{ color: 'rgba(255,255,255,0.8)', maxWidth: '420px', lineHeight: 1.6, fontSize: '16px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  >
                    {guideInfo.desc}
                  </p>
                </div>
              )}

              {/* Countdown Overlay */}
              <div
                id="countdownOverlay"
                className={`${styles.countdownOverlay} ${isCountdownVisible ? styles.visible : ''}`}
              >
                <div
                  style={{ fontSize: '160px', fontWeight: '800', color: 'white', textShadow: '0 0 50px var(--intel-cyan), 0 4px 20px rgba(0,0,0,0.5)', lineHeight: 1, fontFamily: 'Inter, sans-serif' }}
                >
                  {countdownNum}
                </div>
                <div
                  style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginTop: '10px', textShadow: '0 2px 10px rgba(0,0,0,0.8)', background: 'rgba(0,199,253,0.2)', border: '1px solid rgba(0,199,253,0.4)', padding: '8px 24px', borderRadius: '30px', backdropFilter: 'blur(8px)' }}
                >
                  현재 자세를 유지하세요
                </div>
              </div>

              {/* 3. Realtime Feedback Area */}
              <div className={styles.realtimeFeedbackArea}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>

                  {/* A. Leveler */}
                  <div
                    id="levelerBox"
                    className={styles.levelerContainer}
                    style={{ display: agentOn && isActive ? 'block' : 'none' }}
                  >
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '700' }}>
                      <span>자세 균형</span>
                      <i className="fa-solid fa-scale-balanced" style={{ color: 'var(--intel-cyan)', fontSize: '16px' }} />
                    </h4>

                    {LEVELER_ITEMS.map((item) => (
                      <div key={item.key} className={styles.levelItem}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
                          <span style={{ color: 'rgba(255,255,255,0.8)' }}>{item.label}</span>
                          <span style={{ color: item.color }}>
                            {levelerValues[item.key].toFixed(1)}
                          </span>
                        </div>
                        <div className={styles.levelBarBg}>
                          <div className={styles.levelCenterMark} />
                          <div
                            className={styles.levelIndicator}
                            style={{ left: levelerPosition(levelerValues[item.key]) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* B. Action Message Box */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    id="actionMessageBox"
                    className={styles.actionMessageBox}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <i
                      id="actionMessageIcon"
                      className="fa-solid fa-circle-info"
                      style={{ color: 'var(--intel-cyan)', fontSize: '22px' }}
                    />
                    <span
                      id="actionMessageText"
                      style={{ color: 'white', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.5px' }}
                    >
                      {actionMsg}
                    </span>
                  </div>
                </div>

                {/* Retake buttons */}
                <div
                  id="retakeArea"
                  className={`${styles.retakeArea} ${isRetakeVisible ? styles.visible : ''}`}
                >
                  <button
                    id="btnRetakeFront"
                    className={styles.btnRetake}
                    onClick={handleRetakeFront}
                    style={{ display: hasFrontCapture ? 'inline-flex' : 'none' }}
                  >
                    <i className="fa-solid fa-rotate-right" /> 정면 재촬영
                  </button>
                  <button
                    id="btnRetakeSide"
                    className={styles.btnRetake}
                    onClick={handleRetakeSide}
                    style={{ display: hasSideCapture ? 'inline-flex' : 'none' }}
                  >
                    <i className="fa-solid fa-rotate-right" /> 측면 재촬영
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== RIGHT: Diagnostics Panel ===================== */}
          <div className={styles.diagnosticsPanel}>

            {/* Mobile results summary */}
            <section className={styles.mobileResultsSummary} aria-live="polite">
              <div className={styles.mobileResultsHeader}>
                <h3>Mobile Results Mode</h3>
                <span className={styles.mobilePill}>Read Only</span>
              </div>
              <p>Measurement controls are available on desktop. On mobile, you can review latest analysis and history.</p>
              <div className={styles.mobileResultsActions}>
                <a href="/history" className={styles.mobileActionLink}>
                  <i className="fa-solid fa-clock-rotate-left" />
                  <span>History</span>
                </a>
                <a href="/anthropometry" className={styles.mobileActionLink}>
                  <i className="fa-solid fa-chart-simple" />
                  <span>Analysis</span>
                </a>
              </div>
            </section>

            {/* Analysis toolbar + Body Check results */}
            <div className={`${styles.tabContent} ${styles.active}`} id="tab-body-check">

              {/* Analysis toolbar */}
              <div className={styles.analysisToolbar}>
                <select id="analysisSelect" className={styles.analysisSelect}>
                  <option value="latest">Latest Capture</option>
                </select>
                <select id="guideMode" className={styles.analysisSelect}>
                  <option value="auto">Auto Guide</option>
                  <option value="front">Front Only</option>
                  <option value="side">Side Only</option>
                </select>
                <button id="btnFront" className={styles.toolbarBtn} onClick={() => logTerminal('> btnFront (stub)')}>
                  <i className="fa-solid fa-person" /> Front
                </button>
                <button id="btnSide" className={styles.toolbarBtn} onClick={() => logTerminal('> btnSide (stub)')}>
                  <i className="fa-solid fa-person-rays" /> Side
                </button>
                <button id="btnRefresh" className={styles.toolbarBtn} onClick={() => logTerminal('> btnRefresh (stub)')}>
                  <i className="fa-solid fa-rotate" /> Refresh
                </button>
                <button
                  id="btnTogglePoints"
                  className={styles.toolbarBtn}
                  onClick={() => setShowPoints((p) => !p)}
                >
                  <i className="fa-solid fa-circle" /> Points
                </button>
                <button
                  id="btnToggleLines"
                  className={styles.toolbarBtn}
                  onClick={() => setShowLines((p) => !p)}
                >
                  <i className="fa-solid fa-lines-leaning" /> Lines
                </button>
                <button
                  id="btnToggleGuides"
                  className={styles.toolbarBtn}
                  onClick={() => setShowGuides((p) => !p)}
                >
                  <i className="fa-solid fa-arrows-to-eye" /> Guides
                </button>
              </div>

              {/* Body Check results card */}
              <div className={`${styles.gridCard} ${styles.diagCard}`}>
                <div className={styles.cardHeader}>
                  <h2 data-i18n="hc_rom_list_title">Body Check Results</h2>
                  <i className="fa-solid fa-list-check icon-faded" />
                </div>
                <div id="analysisList" className={styles.analysisList}>
                  <div className={styles.analysisEmpty}>
                    <i className="fa-solid fa-camera" style={{ fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }} />
                    <p>
                      {step === 'result'
                        ? '측정이 완료되었습니다. 리포트를 확인하세요.'
                        : '측정을 시작하면 결과가 여기에 표시됩니다.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Terminal card */}
              <div className={`${styles.gridCard} ${styles.terminalCard}`}>
                <div className={styles.terminalHeader}>
                  <span data-i18n="hc_term">Terminal Output</span>
                  <div className={styles.dots}>
                    <span className={`${styles.dot} ${styles.red}`} />
                    <span className={`${styles.dot} ${styles.yellow}`} />
                    <span className={`${styles.dot} ${styles.green}`} />
                  </div>
                </div>
                <pre id="status" className={styles.terminalBody}>
                  {terminalLines.join('\n')}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Completion Modal */}
      <div
        id="completionModal"
        className={`${styles.modalOverlay} ${showCompletionModal ? styles.visible : ''}`}
      >
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <i className="fa-solid fa-circle-check" />
            <h2 data-i18n="hc_modal_title">측정 완료</h2>
          </div>
          <p data-i18n="hc_modal_msg">측정이 성공적으로 완료되었습니다.</p>
          <div className={styles.modalActions}>
            <button
              id="btnViewReport"
              className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
              onClick={() => { window.location.href = '/anthropometry'; }}
            >
              리포트 확인
            </button>
            <button
              id="btnCloseModal"
              className={`${styles.modalBtn} ${styles.modalBtnSecondary}`}
              onClick={() => setShowCompletionModal(false)}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
