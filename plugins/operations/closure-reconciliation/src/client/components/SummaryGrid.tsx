import { Card } from "@eops/ui";
import styles from "../styles/closure-reconciliation.module.css";

export interface SummaryMetric {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
}

export function SummaryGrid({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <div className={styles.metrics}>
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className={`${styles.metric} ${metric.tone ? styles[metric.tone] : ""}`}
        >
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          {metric.hint && <small>{metric.hint}</small>}
        </Card>
      ))}
    </div>
  );
}
