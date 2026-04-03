import styles from "../anthropometry.module.css";

interface LoadingOverlayProps {
  visible: boolean;
}

export default function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null;
  return (
    <div className={styles.loadingOverlay} role="status" aria-live="polite">
      <div className={styles.loadingCard}>Analyzing...</div>
    </div>
  );
}
