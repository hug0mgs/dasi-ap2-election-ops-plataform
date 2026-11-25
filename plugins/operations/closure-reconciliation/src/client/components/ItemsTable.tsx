import { Badge } from "@eops/ui";
import type { ReactNode } from "react";
import type { ClosureItem } from "../../types";
import {
  CATEGORY,
  ITEM_STATUS,
  SEVERITY,
  formatDate,
  itemTone,
  severityTone,
} from "../labels";
import styles from "../styles/closure-reconciliation.module.css";

export function ItemsTable({
  items,
  renderActions,
}: {
  items: ClosureItem[];
  renderActions?: (item: ClosureItem) => ReactNode;
}) {
  if (!items.length)
    return (
      <p className={styles.empty}>
        Nenhuma pendência detectada para os filtros atuais.
      </p>
    );

  return (
    <div className={styles.table}>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Referência</th>
            <th>Severidade</th>
            <th>Estado</th>
            <th>Impede</th>
            <th>Prazo</th>
            <th>Última detecção</th>
            {renderActions && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{CATEGORY[item.category]}</td>
              <td>
                <strong>{item.referenceLabel}</strong>
                <small>{item.title}</small>
                {item.detail && <small>{item.detail}</small>}
                {item.resolutionNote && (
                  <small>Tratamento: {item.resolutionNote}</small>
                )}
              </td>
              <td>
                <Badge tone={severityTone(item.severity)}>
                  {SEVERITY[item.severity]}
                </Badge>
              </td>
              <td>
                <Badge tone={itemTone(item.status)}>
                  {ITEM_STATUS[item.status]}
                </Badge>
              </td>
              <td>{item.blocking ? "Sim" : "Não"}</td>
              <td>{formatDate(item.dueAt)}</td>
              <td>{formatDate(item.lastSeenAt)}</td>
              {renderActions && <td>{renderActions(item)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
