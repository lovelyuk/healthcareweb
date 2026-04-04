import { useState, useRef, useCallback, useEffect } from 'react';
import { computeAnalysisFromLandmarks, computePostureScore, type MergedAnalysis } from '../postureAnalysis';

export type FlowStep = 'idle' | 'wait_ready' | 'prepare' | 'front_hold' | 'turn' | 'side_hold' | 'analyzing' | 'result';

interface UseMeasureFlowArgs {
  onWebcamStart: () => Promise<MediaStream | null>;
  onWebcamStop: () => void;
  onLog: (msg: string) => void;
  onCaptureFrame: (view: 'front' | 'side') => any | null;
  onBuildReport: (front: any, side: any) => void;
}

export function useMeasureFlow({ onWebcamStart, onWebcamStop, onLog, onCaptureFrame, onBuildReport }: UseMeasureFlowArgs) {
  const [step, setStep] = useState<FlowStep>('idle');
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasFrontCapture, setHasFrontCapture] = useState(false);
  const [hasSideCapture, setHasSideCapture] = useState(false);
  const [isCountdownVisible, setIsCountdownVisible] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [isRetakeVisible, setIsRetakeVisible] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [levelerValues, setLevelerValues] = useState<Record<string, number>>({
    shoulder: 0,
    pelvis: 0,
    center: 0
  });

  const frontCaptureRef = useRef<any>(null);
  const sideCaptureRef = useRef<any>(null);
  const stableSinceRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startWorkflow = useCallback(() => {
    onLog('> Starting measurement workflow...');
    setIsActive(true);
    setStep('wait_ready');
    setProgress(0);
    setHasFrontCapture(false);
    setHasSideCapture(false);
    frontCaptureRef.current = null;
    sideCaptureRef.current = null;
    
    // Initial wait
    setTimeout(() => {
      setStep('prepare');
    }, 2000);
  }, [onLog]);

  const stopWorkflow = useCallback(() => {
    setIsActive(false);
    setStep('idle');
    setProgress(0);
    setIsCountdownVisible(false);
    stableSinceRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    onLog('> Measurement workflow stopped.');
  }, [onLog]);

  const retakeCapture = useCallback((view: 'front' | 'side') => {
    onLog(`> Retaking ${view} capture...`);
    if (view === 'front') {
      setHasFrontCapture(false);
      frontCaptureRef.current = null;
      setStep('prepare');
    } else {
      setHasSideCapture(false);
      sideCaptureRef.current = null;
      setStep('turn');
    }
  }, [onLog]);

  const updateLeveler = useCallback((values: Record<string, number>) => {
    setLevelerValues(prev => ({ ...prev, ...values }));
  }, []);

  const onCountdownTick = useCallback((num: number) => {
    setCountdownNum(num);
  }, []);

  const onCountdownComplete = useCallback(() => {
    setIsCountdownVisible(false);
  }, []);

  // Main tick-like effect (simplified for React, usually driven by pose detection loop)
  // In a real app, this would be triggered by new landmarks.
  // For now, we'll use a timer to simulate the flow progression if data is "stable".
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const now = Date.now();

      if (step === 'prepare') {
        // In real app, check if pose is detected and stable
        onLog('> Step 1: Front measurement preparation');
        setStep('front_hold');
        stableSinceRef.current = now;
        setIsCountdownVisible(true);
      }

      if (step === 'front_hold') {
        const elapsed = now - (stableSinceRef.current || now);
        const p = Math.min(100, (elapsed / 3000) * 100);
        setProgress(p);
        setCountdownNum(Math.ceil((3000 - elapsed) / 1000));
        
        if (elapsed >= 3000) {
          const cap = onCaptureFrame('front');
          if (cap) {
            frontCaptureRef.current = cap;
            setHasFrontCapture(true);
            onLog('> Front captured. Turn to the side.');
            setStep('turn');
            setIsCountdownVisible(false);
            stableSinceRef.current = null;
          }
        }
      }

      if (step === 'turn') {
        // Wait for user to turn
        // In real app, detect side view
        setStep('side_hold');
        stableSinceRef.current = now;
        setIsCountdownVisible(true);
      }

      if (step === 'side_hold') {
        const elapsed = now - (stableSinceRef.current || now);
        const p = Math.min(100, (elapsed / 3000) * 100);
        setProgress(p);
        setCountdownNum(Math.ceil((3000 - elapsed) / 1000));
        
        if (elapsed >= 3000) {
          const cap = onCaptureFrame('side');
          if (cap) {
            sideCaptureRef.current = cap;
            setHasSideCapture(true);
            onLog('> Side captured. Analyzing...');
            setStep('analyzing');
            setIsCountdownVisible(false);
            stableSinceRef.current = null;
          }
        }
      }

      if (step === 'analyzing') {
        clearInterval(interval);
        setTimeout(() => {
          onBuildReport(frontCaptureRef.current, sideCaptureRef.current);
          setStep('result');
          setShowCompletionModal(true);
          setIsActive(false);
        }, 1500);
      }

    }, 100);

    return () => clearInterval(interval);
  }, [isActive, step, onCaptureFrame, onBuildReport, onLog]);

  return {
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
    retakeCapture,
    updateLeveler,
    onCountdownTick,
    onCountdownComplete,
  };
}
