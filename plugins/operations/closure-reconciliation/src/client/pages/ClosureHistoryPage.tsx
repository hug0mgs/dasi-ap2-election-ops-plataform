import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  useAsync,
} from "@eops/ui";
import { Link, useParams } from "react-router-dom";
import { ClosureNav } from "../components/ClosureNav";
import { HistoryTimeline } from "../components/HistoryTimeline";
import { STATUS, formatDate, statusTone } from "../labels";
import { closureReconciliationService as service } from "../services/closureReconciliationService";
import styles from "../styles/closure-reconciliation.module.css";

export function ClosureHistoryPage() {
  const { id = "" } = useParams();
  const detail = useAsync(() => service.get(id), [id]);
  const history = useAsync(() => service.history(id), [id]);

  if (detail.loading || history.loading)
    return (
      <section className={styles.page}>
        <ClosureNav />
        <Loading />
      </section>
    );

  if (detail.error)
    return (
      <section className={styles.page}>
        <ClosureNav />
        <ErrorState error={detail.error} onRetry={detail.reload} />
      </section>
    );

  if (history.error)
    return (
      <section className={styles.page}>
        <ClosureNav />
        <ErrorState error={history.error} onRetry={history.reload} />
      </section>
    );

  if (!detail.data)
    return (
      <section className={styles.page}>
        <ClosureNav />
        <EmptyState
          title="Conciliação não encontrada"
          description="Verifique o identificador informado."
        />
      </section>
    );

  const data = detail.data;

  return (
    <section className={styles.page}>
      <ClosureNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Histórico · {data.code}</h1>
          <p>
            {data.election.name} ({data.election.year}) ·{" "}
            {data.electoralZone
              ? `Zona ${data.electoralZone.number}`
              : "Todas as zonas"}{" "}
            · atualizada em {formatDate(data.updatedAt)}
          </p>
        </div>
        <div className={styles.inline}>
          <Badge tone={statusTone(data.status)}>{STATUS[data.status]}</Badge>
          <Link to={`/closure-reconciliation/${data.id}`}>
            Voltar para a conciliação
          </Link>
        </div>
      </header>

      <Card>
        <h2>Linha do tempo auditável</h2>
        <p className={styles.hint}>
          Cada detecção, decisão, exceção, assinatura e transição de estado é
          registrada com autor, data e resumo. Registros não são reescritos.
        </p>
        <HistoryTimeline entries={history.data ?? []} />
      </Card>
    </section>
  );
}
