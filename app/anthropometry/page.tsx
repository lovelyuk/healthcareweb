"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import CameraView, { type CameraViewHandle } from "./components/CameraView";
import MeasureButton from "./components/MeasureButton";
import ResultPanel from "./components/ResultPanel";
import LoadingOverlay from "./components/LoadingOverlay";
import { analyzeBody, type AnalyzeBodyResponse } from "../lib/api";
import {
  buildPayload,
  normalizeLandmarks,
  type NormalizedLandmark,
} from "../lib/bodyAnalysis";
import styles from "./anthropometry.module.css";

export default function AnthropometryPage() {
  const cameraRef = useRef<CameraViewHandle | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const loopRef = useRef<number | null>(null);

  const [landmarks, setLandmarks] = useState<NormalizedLandmark[]>([]);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeBodyResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const initPose = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm",
        );

        if (!mounted) return;

        poseRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch {
        setError("Failed to initialize pose model.");
      }
    };

    initPose();

    return () => {
      mounted = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      poseRef.current?.close();
      poseRef.current = null;
    };
  }, []);

  const runPoseLoop = useCallback(() => {
    const tick = () => {
      const video = cameraRef.current?.getVideoElement();
      const pose = poseRef.current;

      if (
        video &&
        pose &&
        video.readyState >= 2 &&
        video.videoWidth > 0
      ) {
        const detected = pose.detectForVideo(video, performance.now());
        const first = detected.landmarks?.[0] ?? [];
        setLandmarks(normalizeLandmarks(first));
      }

      loopRef.current = requestAnimationFrame(tick);
    };

    if (!loopRef.current) {
      loopRef.current = requestAnimationFrame(tick);
    }
  }, []);

  useEffect(() => {
    if (isCameraReady) {
      runPoseLoop();
    }
  }, [isCameraReady, runPoseLoop]);

  const onMeasure = useCallback(async () => {
    setError(null);

    if (!cameraRef.current) {
      setError("Camera is not initialized.");
      return;
    }

    if (landmarks.length === 0) {
      setError("No pose landmarks detected. Stand in frame and try again.");
      return;
    }

    try {
      setIsAnalyzing(true);

      const frameDataUrl = cameraRef.current.captureFrame();
      if (!frameDataUrl) throw new Error("Frame capture failed.");

      const payload = buildPayload(landmarks, cameraRef.current.getFrameSize());
      const response = await analyzeBody(payload);

      setResult({
        ...response,
        summary: response.summary || "Body analysis completed.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [landmarks]);

  return (
    <main className={styles.page}>
      <LoadingOverlay visible={isAnalyzing} />

      <header className={styles.header}>
        <h1>BodyCheck Anthropometry</h1>
        <p>Camera-based posture capture and AI analysis</p>
      </header>

      <section className={styles.layout}>
        <div className={styles.leftColumn}>
          <CameraView
            ref={cameraRef}
            landmarks={landmarks}
            isCameraReady={isCameraReady}
            onCameraReady={setIsCameraReady}
          />

          <MeasureButton onMeasure={onMeasure} disabled={!isCameraReady || isAnalyzing} />

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.rightColumn}>
          <ResultPanel result={result} />
        </div>
      </section>
    </main>
  );
}
