import {
  Badge,
  Card,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClosureNav } from "../components/ClosureNav";
import { CATEGORY, SEVERITY, STATUS, formatDate, statusTone } from "../labels";
import type { ClosureCategory, ClosureSeverity, ClosureStatus } from "../../types";
import { closureReconciliationService as service } from "../services/closureReconciliationService";
import styles from "../styles/closure-reconciliation.module.css";

export function ClosureListPage() {
  const [electionId, setElectionId] = useState("");
  const [status, setStatus] = useState<ClosureStatus | "">("");
  const [electoralZoneId, setElectoralZoneId] = useState("");
  const [category, setCategory] = useState<ClosureCategory | "">("");
  const [severity, setSeverity] = useState<ClosureSeverity | "">("");
  const [blocking, setBlocking] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const references = useAsync(() => service.references(), []);
  const state = useAsync(
    () =>
      service.list({
        electionId: electionId || undefined,
        status: status || undefined,
        electoralZoneId: electoralZoneId || undefined,
        category: category || undefined,
        severity: severity || undefined,
        blocking: blocking === "" ? undefined : blocking === "true",
        from: from ? `${from}T00:00:00.000Z` : undefined,
        to: to ? `${to}T23:59:59.999Z` : undefined,
      }),
    [electionId, status, electoralZoneId, category, severity, blocking, from, to],
  );

  const elections = useMemo(
    () => references.data?.elections ?? [],
    [references.data],
  );

  return (
    <section className={styles.page}>
      <ClosureNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Conciliações</h1>
          <p>Histórico de conciliações por pleito, escopo e estado.</p>
        </div>
        <Link className={styles.primary} to="/closure-reconciliation/new">
          Nova conciliação
        </Link>
      </header>

      <Card>
        <div className={styles.filters}>
          <Field label="Pleito">
            <Select
              value={electionId}
              onChange={(event) => { setElectionId(event.target.value); setElectoralZoneId(""); }}
            >
              <option value="">Todos os pleitos</option>
              {elections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.name} ({election.year})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estado">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as ClosureStatus | "")}
            >
              <option value="">Todos os estados</option>
              {Object.entries(STATUS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Zona">
            <Select value={electoralZoneId} onChange={(event) => setElectoralZoneId(event.target.value)}>
              <option value="">Todas</option>
              {(references.data?.zones ?? []).filter((zone) => !electionId || zone.electionId === electionId).map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.number} · {zone.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={category} onChange={(event) => setCategory(event.target.value as ClosureCategory | "")}>
              <option value="">Todas</option>
              {Object.entries(CATEGORY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Severidade">
            <Select value={severity} onChange={(event) => setSeverity(event.target.value as ClosureSeverity | "")}>
              <option value="">Todas</option>
              {Object.entries(SEVERITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Impeditivo">
            <Select value={blocking} onChange={(event) => setBlocking(event.target.value)}>
              <option value="">Todos</option><option value="true">Sim</option><option value="false">Não</option>
            </Select>
          </Field>
          <Field label="Atualizada desde (UTC)"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
          <Field label="Atualizada até (UTC)"><Input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></Field>
        </div>
      </Card>

      {state.loading && <Loading />}
      {references.error && <ErrorState error={references.error} onRetry={references.reload} />}
      {state.error && (
        <ErrorState error={state.error} onRetry={state.reload} />
      )}

      {state.data && (
        <Card>
          {state.data.length === 0 ? (
            <p className={styles.empty}>
              Nenhuma conciliação encontrada para os filtros atuais.
            </p>
          ) : (
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Pleito</th>
                    <th>Zona</th>
                    <th>Estado</th>
                    <th>Prontidão</th>
                    <th>Impeditivos</th>
                    <th>Exceções</th>
                    <th>Atualizada</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`/closure-reconciliation/${row.id}`}>
                          {row.code}
                        </Link>
                      </td>
                      <td>{row.election.name}</td>
                      <td>{row.electoralZone?.number ?? "Todas"}</td>
                      <td>
                        <Badge tone={statusTone(row.status)}>
                          {STATUS[row.status]}
                        </Badge>
                      </td>
                      <td>{row.readinessScore}%</td>
                      <td>{row.blockingItems}</td>
                      <td>{row.exceptionsOpen}</td>
                      <td>{formatDate(row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
