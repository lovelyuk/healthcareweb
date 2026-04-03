import { useState } from 'react';

export function useWebcam(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorName, setErrorName] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  const start = async (): Promise<MediaStream | null> => {
    setIsLoading(true);
    setHasError(false);
    setErrorName(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      setStream(mediaStream);
      setIsActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
      setIsLoading(false);
      return mediaStream;
    } catch (err: any) {
      setHasError(true);
      setErrorName(err.name || 'UnknownError');
      setIsActive(false);
      setIsLoading(false);
      return null;
    }
  };

  const stop = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  return { stream, isLoading, hasError, errorName, isActive, start, stop };
}
