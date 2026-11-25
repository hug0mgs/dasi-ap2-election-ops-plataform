import { Badge, Card, ErrorState, LinkButton, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { ClosureNav } from "../components/ClosureNav";
import { SummaryGrid } from "../components/SummaryGrid";
import { CATEGORY, SEVERITY, STATUS, formatDate, statusTone } from "../labels";
import { closureReconciliationService as service } from "../services/closureReconciliationService";
import styles from "../styles/closure-reconciliation.module.css";

export function ClosureDashboardPage() {
  const state = useAsync(() => service.dashboard(), []);

  return (
    <section className={styles.page}>
      <ClosureNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Conciliação de encerramento</h1>
          <p>
            Ativos não devolvidos, entregas pendentes, despachos abertos e
            evidências faltantes antes do encerramento do pleito.
          </p>
        </div>
        <LinkButton to="/closure-reconciliation/new">
          Abrir conciliação
        </LinkButton>
      </header>

      {state.loading && <Loading />}
      {state.error && (
        <ErrorState error={state.error} onRetry={state.reload} />
      )}

      {state.data && (
        <>
          <SummaryGrid
            metrics={[
              {
                label: "Conciliações",
                value: state.data.totals.reconciliations,
                hint: `${state.data.totals.open} em andamento`,
              },
              {
                label: "Prontas",
                value: state.data.totals.ready,
                tone: "success",
              },
              {
                label: "Encerradas",
                value: state.data.totals.closed,
                tone: "success",
              },
              {
                label: "Impeditivos",
                value: state.data.pending.blockingItems,
                tone: state.data.pending.blockingItems ? "danger" : "success",
              },
              {
                label: "Ativos fora",
                value: state.data.pending.assetsUnreturned,
                tone: state.data.pending.assetsUnreturned
                  ? "warning"
                  : "default",
              },
              {
                label: "Entregas",
                value: state.data.pending.deliveriesPending,
                tone: state.data.pending.deliveriesPending
                  ? "warning"
                  : "default",
              },
              {
                label: "Despachos",
                value: state.data.pending.dispatchesOpen,
                tone: state.data.pending.dispatchesOpen
                  ? "warning"
                  : "default",
              },
              {
                label: "Evidências",
                value: state.data.pending.evidenceMissing,
                hint: `${state.data.pending.exceptionsOpen} exceção(ões) aberta(s)`,
                tone: state.data.pending.evidenceMissing ? "warning" : "default",
              },
              {
                label: "Prontidão média",
                value: `${state.data.averageReadiness}%`,
                tone:
                  state.data.averageReadiness >= 90 ? "success" : "warning",
              },
            ]}
          />

          <div className={styles.grid}>
            <Card>
              <h2>Por categoria</h2>
              <ul className={styles.list}>
                {Object.entries(CATEGORY).map(([key, label]) => (
                  <li key={key}>
                    <span>{label}</span>
                    <strong>
                      {state.data?.category[
                        key as keyof typeof state.data.category
                      ] ?? 0}
                    </strong>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2>Por severidade</h2>
              <ul className={styles.list}>
                {Object.entries(SEVERITY).map(([key, label]) => (
                  <li key={key}>
                    <span>{label}</span>
                    <strong>
                      {state.data?.severity[
                        key as keyof typeof state.data.severity
                      ] ?? 0}
                    </strong>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <h2>Exigem decisão</h2>
            {state.data.attention.length ? (
              <div className={styles.table}>
                <table>
                  <thead>
                    <tr>
                      <th>Conciliação</th>
                      <th>Pleito</th>
                      <th>Estado</th>
                      <th>Prontidão</th>
                      <th>Impeditivos</th>
                      <th>Exceções</th>
                      <th>Última detecção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.attention.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link to={`/closure-reconciliation/${row.id}`}>
                            {row.code}
                          </Link>
                        </td>
                        <td>
                          {row.election.name} ({row.election.year})
                        </td>
                        <td>
                          <Badge tone={statusTone(row.status)}>
                            {STATUS[row.status]}
                          </Badge>
                        </td>
                        <td>{row.readinessScore}%</td>
                        <td>{row.blockingItems}</td>
                        <td>{row.exceptionsOpen}</td>
                        <td>{formatDate(row.lastRefreshedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>
                Nenhuma conciliação exige decisão neste momento.
              </p>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
