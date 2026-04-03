import styles from "../anthropometry.module.css";

interface MeasureButtonProps {
  onMeasure: () => void;
  disabled?: boolean;
}

export default function MeasureButton({ onMeasure, disabled = false }: MeasureButtonProps) {
  return (
    <button className={styles.measureButton} onClick={onMeasure} disabled={disabled}>
      {disabled ? "Preparing..." : "Measure Body"}
    </button>
  );
}
