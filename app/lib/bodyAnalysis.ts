export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface BodyAngles {
  shoulderTiltDeg: number;
  pelvicTiltDeg: number;
  headTiltDeg: number;
}

export interface BodyPayload {
  landmarks: NormalizedLandmark[];
  angles: BodyAngles;
  meta: {
    capturedAt: string;
    frameWidth: number;
    frameHeight: number;
  };
}

const CLAMP_MIN = 0;
const CLAMP_MAX = 1;

function clamp01(v: number): number {
  if (v < CLAMP_MIN) return CLAMP_MIN;
  if (v > CLAMP_MAX) return CLAMP_MAX;
  return v;
}

function safePoint(point?: Partial<NormalizedLandmark>): NormalizedLandmark {
  return {
    x: clamp01(point?.x ?? 0),
    y: clamp01(point?.y ?? 0),
    z: point?.z ?? 0,
    visibility: point?.visibility ?? 0,
  };
}

function lineAngleDeg(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const rad = Math.atan2(b.y - a.y, b.x - a.x);
  return (rad * 180) / Math.PI;
}

export function normalizeLandmarks(landmarks: Partial<NormalizedLandmark>[]): NormalizedLandmark[] {
  return landmarks.map((point) => safePoint(point));
}

export function calculateAngles(landmarks: NormalizedLandmark[]): BodyAngles {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const nose = landmarks[0];

  const shoulderTiltDeg = leftShoulder && rightShoulder
    ? Math.abs(lineAngleDeg(leftShoulder, rightShoulder))
    : 0;

  const pelvicTiltDeg = leftHip && rightHip
    ? Math.abs(lineAngleDeg(leftHip, rightHip))
    : 0;

  const headTiltDeg = nose && leftShoulder && rightShoulder
    ? Math.abs(nose.x - (leftShoulder.x + rightShoulder.x) / 2) * 45
    : 0;

  return {
    shoulderTiltDeg: Number(shoulderTiltDeg.toFixed(2)),
    pelvicTiltDeg: Number(pelvicTiltDeg.toFixed(2)),
    headTiltDeg: Number(headTiltDeg.toFixed(2)),
  };
}

export function buildPayload(
  normalizedLandmarks: NormalizedLandmark[],
  frameSize: { width: number; height: number },
): BodyPayload {
  return {
    landmarks: normalizedLandmarks,
    angles: calculateAngles(normalizedLandmarks),
    meta: {
      capturedAt: new Date().toISOString(),
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
    },
  };
}
