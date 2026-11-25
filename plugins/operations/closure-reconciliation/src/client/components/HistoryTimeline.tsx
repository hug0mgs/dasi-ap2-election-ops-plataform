import { Badge } from "@eops/ui";
import type { ClosureHistory } from "../../types";
import { HISTORY_ACTION, formatDate } from "../labels";
import styles from "../styles/closure-reconciliation.module.css";

export function HistoryTimeline({ entries }: { entries: ClosureHistory[] }) {
  if (!entries.length)
    return <p className={styles.empty}>Nenhum evento registrado.</p>;

  return (
    <ol className={styles.timeline}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <Badge>{HISTORY_ACTION[entry.action]}</Badge>
          <div>
            <strong>{entry.summary}</strong>
            <small>
              {formatDate(entry.createdAt)}
              {entry.actorId ? ` · ${entry.actorId}` : " · sistema"}
            </small>
            {entry.fromStatus || entry.toStatus ? (
              <small>
                {entry.fromStatus ?? "—"} → {entry.toStatus ?? "—"}
              </small>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
