import { Card, ErrorState, Loading, useAsync } from "@eops/ui";
import { Link, useParams } from "react-router-dom";
import { InspectionsNav } from "../components/InspectionsNav";
import { pollingPlaceInspectionsService as service } from "../services/pollingPlaceInspectionsService";
import styles from "../styles/inspections.module.css";
export function InspectionHistoryPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => service.history(id), [id]);
  return (
    <section className={styles.page}>
      <InspectionsNav />
      <p className={styles.breadcrumb}>
        <Link to={`/polling-place-inspections/${id}`}>Vistoria</Link> /
        Histórico
      </p>
      <h1>Histórico operacional</h1>
      {state.loading && <Loading />}
      {state.error && (
        <ErrorState error={state.error} onRetry={state.reload} />
      )}{" "}
      {state.data && (
        <Card>
          {state.data.length ? (
            <ol className={styles.history}>
              {state.data.map((x) => (
                <li key={x.id}>
                  <strong>{x.action}</strong>
                  <span>
                    {new Date(x.createdAt).toLocaleString("pt-BR")} · ator{" "}
                    {x.actorId}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>Nenhum evento registrado.</p>
          )}
        </Card>
      )}
    </section>
  );
}
