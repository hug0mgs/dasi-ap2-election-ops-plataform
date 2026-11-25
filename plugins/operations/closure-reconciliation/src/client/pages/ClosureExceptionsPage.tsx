import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ClosureNav } from "../components/ClosureNav";
import { ExceptionsPanel } from "../components/ExceptionsPanel";
import { CATEGORY, RISK, formatDate } from "../labels";
import type { ClosureCategory, ClosureRisk } from "../../types";
import { closureReconciliationService as service } from "../services/closureReconciliationService";
import styles from "../styles/closure-reconciliation.module.css";

export function ClosureExceptionsPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => service.get(id), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [revokeTarget, setRevokeTarget] = useState<string>();
  const [revokeReason, setRevokeReason] = useState("");
  const [justification, setJustification] = useState("");
  const [mitigation, setMitigation] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [risk, setRisk] = useState<ClosureRisk>("MEDIUM");
  const [category, setCategory] = useState<ClosureCategory>("EVIDENCE");

  const data = state.data;

  async function run(task: () => Promise<typeof data>) {
    setBusy(true);
    setError(undefined);
    try {
      const next = await task();
      if (next) state.setData(next);
      setRevokeTarget(undefined);
      setRevokeReason("");
      setJustification("");
      setMitigation("");
      setValidUntil("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível concluir a ação.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (state.loading)
    return (
      <section className={styles.page}>
        <ClosureNav />
        <Loading />
      </section>
    );

  if (state.error)
    return (
      <section className={styles.page}>
        <ClosureNav />
        <ErrorState error={state.error} onRetry={state.reload} />
      </section>
    );

  if (!data)
    return (
      <section className={styles.page}>
        <ClosureNav />
        <EmptyState
          title="Conciliação não encontrada"
          description="Verifique o identificador informado."
        />
      </section>
    );

  const editable = ["DRAFT", "COLLECTING", "IN_REVIEW", "PENDING_EXCEPTIONS"].includes(data.status);

  return (
    <section className={styles.page}>
      <ClosureNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>Exceções · {data.code}</h1>
          <p>
            {data.election.name} · atualizada em {formatDate(data.updatedAt)}
          </p>
        </div>
      </header>

      {error && <p className={styles.alert}>{error}</p>}

      {editable && (
        <Card>
          <h2>Registrar exceção sem item específico</h2>
          <p className={styles.hint}>
            Use esta opção para justificar uma condição transversal à
            conciliação. Para exceções por pendência, use a ação “Exceção” na
            tabela de itens.
          </p>
          <div className={styles.form}>
            <Field label="Categoria">
              <Select value={category} onChange={(event) => setCategory(event.target.value as ClosureCategory)}>
                {Object.entries(CATEGORY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Justificativa (mínimo 20 caracteres)">
              <Input
                value={justification}
                maxLength={4000}
                onChange={(event) => setJustification(event.target.value)}
              />
            </Field>
            <Field label="Risco">
              <Select
                value={risk}
                onChange={(event) => setRisk(event.target.value as ClosureRisk)}
              >
                {Object.entries(RISK).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Mitigação (opcional)">
              <Input
                value={mitigation}
                maxLength={4000}
                onChange={(event) => setMitigation(event.target.value)}
              />
            </Field>
            <Field label="Validade (opcional)">
              <Input
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </Field>
            <Button
              disabled={busy || justification.trim().length < 20}
              onClick={() =>
                run(() =>
                  service.registerException(id, {
                    expectedUpdatedAt: data.updatedAt,
                    category,
                    risk,
                    justification,
                    mitigation: mitigation || undefined,
                    validUntil: validUntil || undefined,
                  }),
                )
              }
            >
              Registrar exceção
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h2>Exceções da conciliação</h2>
        <ExceptionsPanel
          exceptions={data.exceptions}
          busy={busy}
          onAccept={
            editable
              ? (exception) =>
                  run(() =>
                    service.acceptException(id, exception.id, {
                      expectedUpdatedAt: data.updatedAt,
                    }),
                  )
              : undefined
          }
          onRevoke={
            editable
              ? (exception) => {
                  setRevokeTarget(exception.id);
                  setRevokeReason("");
                }
              : undefined
          }
        />
        {revokeTarget && (
          <div className={styles.form}>
            <Field label="Motivo da revogação">
              <Input
                value={revokeReason}
                maxLength={2000}
                onChange={(event) => setRevokeReason(event.target.value)}
              />
            </Field>
            <div className={styles.inline}>
              <Button
                disabled={busy || revokeReason.trim().length < 5}
                onClick={() =>
                  run(() =>
                    service.revokeException(id, revokeTarget, {
                      expectedUpdatedAt: data.updatedAt,
                      reason: revokeReason,
                    }),
                  )
                }
              >
                Confirmar revogação
              </Button>
              <Button secondary onClick={() => setRevokeTarget(undefined)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
