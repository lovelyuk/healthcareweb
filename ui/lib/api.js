/**
 * lib/api.js — Centralized API client
 *
 * Single source of truth for all HTTP calls to the backend.
 * All URL construction happens here — files call the functions below,
 * never construct URLs directly.
 *
 * ENDPOINT CLASSIFICATION (for Vercel migration planning):
 *   REMOVE  — RealSense-only, no longer needed in webcam mode
 *   KEEP    — Still needed, will migrate to Vercel API Routes
 *   DIRECT  — Calls Python backend directly (no Vercel equivalent yet)
 *
 * Vercel migration target: all KEEP endpoints → /api/* Vercel functions
 * Python backend (scanner_server.py): kept running for DIRECT calls
 */

'use strict';

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate API base URL.
 *
 * Priority:
 *  1. VERCEL_API_BASE  — global override (JS variable set by embedding page)
 *  2. NEXT_PUBLIC_VERCEL_URL — Vercel deployment URL (set in Vercel project env)
 *  3. '' (empty string) — same-origin (works on Vercel standard, no config needed)
 *  4. LOCAL_API_URL or 'http://127.0.0.1:5000' — local Python dev server fallback
 */
function getApiBase() {
  // 1. Global override
  if (typeof VERCEL_API_BASE !== 'undefined' && VERCEL_API_BASE) {
    return VERCEL_API_BASE;
  }
  // 2. Vercel deployment URL (NEXT_PUBLIC_* vars are browser-accessible)
  if (typeof NEXT_PUBLIC_VERCEL_URL !== 'undefined' && NEXT_PUBLIC_VERCEL_URL) {
    return NEXT_PUBLIC_VERCEL_URL;
  }
  // 3. Same-origin — works automatically when deployed to Vercel
  if (
    window.location.origin &&
    !['127.0.0.1', 'localhost'].includes(window.location.hostname)
  ) {
    return ''; // same-origin /api/...
  }
  // 4. Local Python dev server
  return LOCAL_API_URL || 'http://127.0.0.1:5000';
}

const API_BASE = getApiBase();

// Expose for debugging in console (dev only)
if (typeof window !== 'undefined') {
  window.__apiBase = API_BASE;
}

// ---------------------------------------------------------------------------
// Low-level fetch wrappers
// ---------------------------------------------------------------------------

/**
 * JSON fetch with consistent error handling and timeout.
 * All API calls funnel through this.
 *
 * @param {string} path    — e.g. '/api/history/list'
 * @param {object} options — { method, headers, body, timeoutMs }
 * @returns {Promise<any>} — parsed JSON
 */
async function apiFetch(path, options = {}) {
  const { timeoutMs = 10000, ...fetchOpts } = options;
  const url = API_BASE ? `${API_BASE}${path}` : path;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
    });

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        errMsg = body?.detail?.message || body?.detail || body?.message || errMsg;
      } catch {}
      throw new ApiError(errMsg, res.status, path);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(`요청 시간 초과 (${timeoutMs}ms): ${path}`, 408, path);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

class ApiError extends Error {
  constructor(message, status, path) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

// ---------------------------------------------------------------------------
// KEEP — History endpoints (→ Vercel /api/history/*)
// ---------------------------------------------------------------------------

/**
 * List all measurement records for a subject.
 * GET /api/history/list?subject_no=<email>
 *
 * REMOVE_CANDIDATE note: if history is also stored in localStorage
 * (bodyCheckReport, bodyCheckProgressHistory), this can be replaced
 * with a client-side read.
 */
async function apiHistoryList(subjectNo) {
  return apiFetch(`/api/history/list?subject_no=${encodeURIComponent(subjectNo)}`);
}

/**
 * Get detail of a single measurement result.
 * GET /api/history/detail/:resultId
 */
async function apiHistoryDetail(resultId) {
  return apiFetch(`/api/history/detail/${encodeURIComponent(resultId)}`);
}

/**
 * Delete a measurement result.
 * DELETE /api/history/result/:resultId
 */
async function apiHistoryDelete(resultId) {
  return apiFetch(`/api/history/result/${encodeURIComponent(resultId)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// KEEP — Body measurement endpoints (→ Vercel /api/body/*)
// ---------------------------------------------------------------------------

/**
 * Save completed body measurement (front + side captures).
 * POST /api/body/complete { subject_no, front_payload, side_payload }
 *
 * In webcam-only mode this writes to localStorage first (see saveMeasurement).
 * This call is for optional server-side persistence and historical record.
 *
 * Vercel target: /api/body/complete → stores in KV (Upstash/Turso)
 */
async function apiBodyComplete(email, frontPayload, sidePayload) {
  return apiFetch('/api/body/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject_no: email, front_payload: frontPayload, side_payload: sidePayload }),
  });
}

// ---------------------------------------------------------------------------
// KEEP — AI summary endpoint (→ Vercel /api/body/summary or DIRECT to Ollama)
// ---------------------------------------------------------------------------

/**
 * Request AI posture summary from Ollama (Python backend).
 * POST /api/body/summary
 *
 * PRIMARY: client-side computeAiAnalysisFromMeasurements (always available)
 * FALLBACK: this call when client-side computation fails
 *
 * Vercel target: /api/body/summary → calls Ollama inside Vercel function
 * DIRECT note: scanner_server.py Ollama calls — kept for backward compat
 */
async function apiBodySummary(payload) {
  return apiFetch('/api/body/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// KEEP — 3D model generation (→ Vercel /api/body/viewer-model)
// ---------------------------------------------------------------------------

/**
 * Generate a 3D body model from measurement data.
 * POST /api/body/viewer-model
 *
 * In webcam-only mode, buildBodyModelFromAnalysis() creates a simple
 * parametric model client-side. This server call is for advanced GLB generation.
 */
async function apiBodyViewerModel(payload) {
  return apiFetch('/api/body/viewer-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// VERCEL — New measurement API routes (→ app/api/measurements/*)
// These use the new Vercel Next.js API routes.
// VERCEL_API_BASE or NEXT_PUBLIC_VERCEL_URL must be set for non-same-origin calls.
// ---------------------------------------------------------------------------

/**
 * Save a measurement to the Vercel backend (POST /api/measurements).
 *
 * @param {object} reportData — full bodyCheckReport from buildMeasureReport()
 * @returns {Promise<{id:string, createdAt:string, postureScore:number}>}
 */
async function apiMeasurementsCreate(reportData) {
  return apiFetch('/api/measurements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectNo: reportData.subjectNo || window.BodyCheckUser?.getCurrentUserEmail?.() || 'unknown',
      frontImage: reportData.frontImage,
      sideImage: reportData.sideImage,
      frontLandmarks: reportData.frontLandmarks,
      sideLandmarks: reportData.sideLandmarks,
      headTilt: reportData.headTilt,
      shoulderTilt: reportData.shoulderTilt,
      pelvicTilt: reportData.pelvicTilt,
      postureScore: reportData.postureScore,
      mergedAnalysis: reportData.mergedAnalysis,
      analysisReady: reportData.analysisReady,
      frontCapture: reportData.front,
      sideCapture: reportData.side,
      bodyModel: reportData.bodyModel || null,
    }),
  });
}

/**
 * List measurements for a subject from Vercel backend.
 * GET /api/measurements?subjectNo=alice@example.com&limit=20
 */
async function apiMeasurementsList(subjectNo, { limit = 20 } = {}) {
  return apiFetch(`/api/measurements?subjectNo=${encodeURIComponent(subjectNo)}&limit=${limit}`);
}

/**
 * Get a single measurement from Vercel backend.
 * GET /api/measurements/[id]
 */
async function apiMeasurementsGet(id) {
  return apiFetch(`/api/measurements/${encodeURIComponent(id)}`);
}

/**
 * Delete a measurement.
 * DELETE /api/measurements/[id]?subjectNo=alice@example.com
 */
async function apiMeasurementsDelete(id, subjectNo) {
  return apiFetch(
    `/api/measurements/${encodeURIComponent(id)}?subjectNo=${encodeURIComponent(subjectNo)}`,
    { method: 'DELETE' }
  );
}

/**
 * Request server-side AI posture summary (full LLM analysis).
 * POST /api/analyze
 *
 * Note: In webcam mode, computeAiAnalysisFromMeasurements() runs client-side
 * and is always available. This call is an optional server-side enhancement
 * using a full LLM (Ollama or OpenAI).
 */
async function apiAnalyze(mergedAnalysis, frontCapture, sideCapture, subjectNo) {
  return apiFetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mergedAnalysis,
      frontCapture,
      sideCapture,
      subjectNo: subjectNo || window.BodyCheckUser?.getCurrentUserEmail?.() || undefined,
    }),
  });
}

// ---------------------------------------------------------------------------
// UTIL — localStorage-based persistence (webcam-primary, server-secondary)
// ---------------------------------------------------------------------------

/**
 * Save measurement report to localStorage (primary store for webcam mode).
 * This is the primary persistence for bodyCheckReport.
 *
 * @param {object} reportData — the full report from buildMeasureReport()
 */
function saveMeasurementToLocal(reportData) {
  if (!reportData) return;
  try {
    localStorage.setItem('bodyCheckReport', JSON.stringify(reportData));
    logLine('[API] Measurement saved to localStorage');
  } catch (err) {
    console.error('[API] localStorage save failed:', err);
  }
}

/**
 * Load measurement report from localStorage.
 * @returns {object|null}
 */
function loadMeasurementFromLocal() {
  try {
    const saved = localStorage.getItem('bodyCheckReport');
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    console.error('[API] localStorage read failed:', err);
    return null;
  }
}

/**
 * Save body check progress history to localStorage.
 * Used by anthropometry.js for progress tracking.
 */
function saveProgressHistory(historyData) {
  if (!historyData) return;
  try {
    localStorage.setItem('bodyCheckProgressHistory', JSON.stringify(historyData));
  } catch (err) {
    console.error('[API] bodyCheckProgressHistory save failed:', err);
  }
}

/**
 * Load body check progress history from localStorage.
 */
function loadProgressHistory() {
  try {
    const saved = localStorage.getItem('bodyCheckProgressHistory');
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Exports — attach to window for easy access, also return as module
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.Api = {
    // --- Vercel measurement API (new — use these in preference to legacy routes)
    measurementsCreate: apiMeasurementsCreate,
    measurementsList: apiMeasurementsList,
    measurementsGet: apiMeasurementsGet,
    measurementsDelete: apiMeasurementsDelete,
    analyze: apiAnalyze,
    // --- Legacy / Python backend routes (keep for backward compat during transition)
    historyList: apiHistoryList,
    historyDetail: apiHistoryDetail,
    historyDelete: apiHistoryDelete,
    bodyComplete: apiBodyComplete,
    bodySummary: apiBodySummary,
    bodyViewerModel: apiBodyViewerModel,
    // --- localStorage utility
    saveMeasurementToLocal,
    loadMeasurementFromLocal,
    saveProgressHistory,
    loadProgressHistory,
    // --- base
    getApiBase,
    fetch: apiFetch,
    ApiError,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiFetch,
    // Vercel routes
    apiMeasurementsCreate, apiMeasurementsList, apiMeasurementsGet,
    apiMeasurementsDelete, apiAnalyze,
    // Legacy
    apiHistoryList, apiHistoryDetail, apiHistoryDelete,
    apiBodyComplete, apiBodySummary, apiBodyViewerModel,
    // Utils
    saveMeasurementToLocal, loadMeasurementFromLocal,
    saveProgressHistory, loadProgressHistory,
    getApiBase, ApiError,
  };
}
