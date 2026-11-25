import { Badge, Card, ErrorState, Loading, Select, useAsync } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { InspectionFitness, InspectionStatus } from "../../types";
import { InspectionsNav } from "../components/InspectionsNav";
import { FITNESS, STATUS } from "../labels";
import { pollingPlaceInspectionsService as service } from "../services/pollingPlaceInspectionsService";
import styles from "../styles/inspections.module.css";
export function InspectionsListPage() {
  const [status, setStatus] = useState("");
  const [fitness, setFitness] = useState("");
  const items = useAsync(
    () =>
      service.list({
        status: (status || undefined) as InspectionStatus | undefined,
        fitness: (fitness || undefined) as InspectionFitness | undefined,
      }),
    [status, fitness],
  );
  return (
    <section className={styles.page}>
      <InspectionsNav />
      <header className={styles.header}>
        <div>
          <span>ACOMPANHAMENTO</span>
          <h1>Vistorias</h1>
          <p>Acompanhe execução, aptidão e pendências por local.</p>
        </div>
        <Link className={styles.primary} to="/polling-place-inspections/new">
          Nova vistoria
        </Link>
      </header>
      <Card>
        <div className={styles.filters}>
          <label>
            Status
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Aptidão
            <Select
              value={fitness}
              onChange={(e) => setFitness(e.target.value)}
            >
              <option value="">Todas</option>
              {Object.entries(FITNESS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>
      {items.loading && <Loading />}
      {items.error && (
        <ErrorState error={items.error} onRetry={items.reload} />
      )}{" "}
      {items.data &&
        (items.data.length ? (
          <Card>
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>Local</th>
                    <th>Pleito / zona</th>
                    <th>Estado</th>
                    <th>Aptidão</th>
                    <th>Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {items.data.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <Link to={`/polling-place-inspections/${i.id}`}>
                          {i.pollingPlace.name}
                        </Link>
                        <small>Rodada {i.round}</small>
                      </td>
                      <td>
                        {i.election.name}
                        <small>Zona {i.electoralZone.number}</small>
                      </td>
                      <td>
                        <Badge>{STATUS[i.status]}</Badge>
                      </td>
                      <td>{FITNESS[i.fitness]}</td>
                      <td>{i.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <p className={styles.empty}>Nenhuma vistoria encontrada.</p>
          </Card>
        ))}
    </section>
  );
}
