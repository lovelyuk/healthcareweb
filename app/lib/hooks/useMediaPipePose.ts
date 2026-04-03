import { useState, useRef, useEffect } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  index: number;
}

export const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15],
  [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20],
  [16, 22], [18, 20], [11, 23], [12, 24],
  [23, 24], [23, 25], [24, 26], [25, 27],
  [26, 28], [27, 29], [28, 30], [29, 31],
  [30, 32], [27, 31], [28, 32]
];

interface UseMediaPipePoseArgs {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  onLog: (msg: string) => void;
}

export function useMediaPipePose({ videoRef, isActive, onLog }: UseMediaPipePoseArgs) {
  const [isReady, setIsReady] = useState(false);
  const landmarksRef = useRef<Landmark[]>([]);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const reqRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (active) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
          onLog("PoseLandmarker loaded");
        }
      } catch (err: any) {
        if (active) onLog("Failed to load PoseLandmarker: " + err.message);
      }
    };
    init();
    return () => {
      active = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    }
  }, [onLog]);

  useEffect(() => {
    if (!isActive || !isReady || !videoRef.current || !landmarkerRef.current) {
      if (reqRef.current !== null) {
        cancelAnimationFrame(reqRef.current);
        reqRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    
    const detect = () => {
      if (!isActive || !video) return;
      if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        try {
          const result = landmarkerRef.current!.detectForVideo(video, performance.now());
          if (result.landmarks && result.landmarks.length > 0) {
            landmarksRef.current = result.landmarks[0].map((lm, i) => ({
              x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility || 0, index: i
            }));
          } else {
            landmarksRef.current = [];
          }
        } catch (e) {
          // Ignore
        }
      }
      reqRef.current = requestAnimationFrame(detect);
    };
    
    reqRef.current = requestAnimationFrame(detect);
    return () => {
      if (reqRef.current !== null) cancelAnimationFrame(reqRef.current);
    }
  }, [isActive, isReady, videoRef]);

  return { landmarksRef, isReady };
}
