import { Badge, Card, ErrorState, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { InspectionsNav } from "../components/InspectionsNav";
import { pollingPlaceInspectionsService as service } from "../services/pollingPlaceInspectionsService";
import { STATUS } from "../labels";
import styles from "../styles/inspections.module.css";
export function InspectionsDashboardPage() {
  const state = useAsync(() => service.dashboard(), []);
  return (
    <section className={styles.page}>
      <InspectionsNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Vistorias de locais</h1>
          <p>
            Condições de acesso, energia, conectividade, sinalização e
            infraestrutura.
          </p>
        </div>
        <Link className={styles.primary} to="/polling-place-inspections/new">
          Nova vistoria
        </Link>
      </header>
      {state.loading && <Loading />}
      {state.error && (
        <ErrorState error={state.error} onRetry={state.reload} />
      )}{" "}
      {state.data && (
        <>
          <div className={styles.metrics}>
            {[
              ["Vistorias", state.data.total],
              ["Agendadas", state.data.scheduled],
              ["Em execução", state.data.inProgress],
              ["Em revisão", state.data.submitted],
              ["Aprovadas", state.data.approved],
              ["Inaptas", state.data.unfit],
              ["Impedimentos", state.data.openBlocking],
              ["Progresso médio", `${state.data.averageProgress}%`],
            ].map(([label, value]) => (
              <Card key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </Card>
            ))}
          </div>
          <Card>
            <h2>Exigem atenção</h2>
            {state.data.attention.length ? (
              <div className={styles.table}>
                <table>
                  <thead>
                    <tr>
                      <th>Local</th>
                      <th>Zona</th>
                      <th>Status</th>
                      <th>Progresso</th>
                      <th>Impedimentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.attention.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link to={`/polling-place-inspections/${i.id}`}>
                            {i.pollingPlace.name}
                          </Link>
                        </td>
                        <td>{i.electoralZone.number}</td>
                        <td>
                          <Badge>{STATUS[i.status]}</Badge>
                        </td>
                        <td>{i.progress}%</td>
                        <td>{i.openBlockingFindings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>Nenhuma vistoria exige atenção.</p>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
