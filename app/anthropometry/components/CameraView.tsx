"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import styles from "../anthropometry.module.css";
import type { NormalizedLandmark } from "../../lib/bodyAnalysis";

export interface CameraViewHandle {
  captureFrame: () => string | null;
  getVideoElement: () => HTMLVideoElement | null;
  getFrameSize: () => { width: number; height: number };
}

interface CameraViewProps {
  landmarks: NormalizedLandmark[];
  isCameraReady: boolean;
  onCameraReady: (ready: boolean) => void;
}

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28],
];

const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(function CameraView(
  { landmarks, isCameraReady, onCameraReady },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.92);
    },
    getVideoElement: () => videoRef.current,
    getFrameSize: () => ({
      width: videoRef.current?.videoWidth ?? 0,
      height: videoRef.current?.videoHeight ?? 0,
    }),
  }));

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          onCameraReady(true);
        }
      } catch {
        onCameraReady(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [onCameraReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(94, 234, 212, 0.9)";
    ctx.lineWidth = 2;

    for (const [a, b] of POSE_CONNECTIONS) {
      const p1 = landmarks[a];
      const p2 = landmarks[b];
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(56, 189, 248, 0.95)";
    for (const point of landmarks) {
      if (!point) continue;
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks]);

  return (
    <div className={styles.cameraWrap}>
      <video ref={videoRef} className={styles.video} muted playsInline />
      <canvas ref={canvasRef} className={styles.overlay} />
      {!isCameraReady && <div className={styles.cameraStatus}>Initializing camera...</div>}
    </div>
  );
});

export default CameraView;
