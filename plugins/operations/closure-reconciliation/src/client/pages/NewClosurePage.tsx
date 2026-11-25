import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClosureNav } from "../components/ClosureNav";
import { closureReconciliationService as service } from "../services/closureReconciliationService";
import styles from "../styles/closure-reconciliation.module.css";

export function NewClosurePage() {
  const navigate = useNavigate();
  const references = useAsync(() => service.references(), []);
  const [electionId, setElectionId] = useState("");
  const [electoralZoneId, setElectoralZoneId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const zones = (references.data?.zones ?? []).filter(
    (zone) => zone.electionId === electionId,
  );

  async function submit() {
    if (!electionId) {
      setError("Selecione o pleito da conciliação.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const created = await service.create({
        electionId,
        electoralZoneId: electoralZoneId || undefined,
        notes: notes || undefined,
      });
      navigate(`/closure-reconciliation/${created.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível abrir a conciliação.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <ClosureNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Nova conciliação</h1>
          <p>
            Uma conciliação ativa por pleito e escopo. A detecção só acontece
            depois da criação.
          </p>
        </div>
      </header>

      {references.loading && <Loading />}
      {references.error && (
        <ErrorState error={references.error} onRetry={references.reload} />
      )}

      {references.data && (
        <Card>
          <div className={styles.form}>
            <Field label="Pleito">
              <Select
                value={electionId}
                onChange={(event) => {
                  setElectionId(event.target.value);
                  setElectoralZoneId("");
                }}
              >
                <option value="">Selecione o pleito</option>
                {references.data.elections.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.name} ({election.year}) · {election.status}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Zona (opcional)">
              <Select
                value={electoralZoneId}
                disabled={!electionId}
                onChange={(event) => setElectoralZoneId(event.target.value)}
              >
                <option value="">Todas as zonas do pleito</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.number} · {zone.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Observações (opcional)">
              <Input
                value={notes}
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Contexto operacional do encerramento"
              />
            </Field>
            {error && <p className={styles.alert}>{error}</p>}
            <div className={styles.inline}>
              <Button disabled={busy} onClick={submit}>
                {busy ? "Abrindo…" : "Abrir conciliação"}
              </Button>
              <Button
                secondary
                onClick={() => navigate("/closure-reconciliation/list")}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}
