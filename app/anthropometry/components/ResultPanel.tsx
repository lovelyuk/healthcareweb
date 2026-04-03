import styles from "../anthropometry.module.css";
import type { AnalyzeBodyResponse } from "../../lib/api";

interface ResultPanelProps {
  result: AnalyzeBodyResponse | null;
}

export default function ResultPanel({ result }: ResultPanelProps) {
  if (!result) {
    return <div className={styles.emptyCard}>Run a measurement to see AI analysis.</div>;
  }

  return (
    <section className={styles.resultGrid}>
      <article className={styles.card}>
        <h3>Summary</h3>
        <p>{result.summary || "No summary returned."}</p>
      </article>

      <article className={styles.card}>
        <h3>Risk Points</h3>
        {result.risk_points.length > 0 ? (
          <ul>
            {result.risk_points.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No major risk points identified.</p>
        )}
      </article>

      <article className={styles.card}>
        <h3>Guide</h3>
        {result.guide.length > 0 ? (
          <ul>
            {result.guide.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No guide available.</p>
        )}
      </article>
    </section>
  );
}
