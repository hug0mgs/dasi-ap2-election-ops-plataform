import {
  Badge,
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
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ClosureNav } from "../components/ClosureNav";
import { ExceptionsPanel, SignoffPanel } from "../components/ExceptionsPanel";
import { HistoryTimeline } from "../components/HistoryTimeline";
import { ItemActions } from "../components/ItemActions";
import { ItemsTable } from "../components/ItemsTable";
import { SummaryGrid } from "../components/SummaryGrid";
import {
  CATEGORY,
  ITEM_STATUS,
  SEVERITY,
  SIGNOFF_ROLE,
  STATUS,
  formatDate,
  statusTone,
} from "../labels";
import { closureReconciliationService as service } from "../services/closureReconciliationService";
import type {
  ClosureCategory,
  ClosureDetail,
  ClosureItemStatus,
  ClosureSeverity,
  ClosureSignoffRole,
} from "../../types";
import styles from "../styles/closure-reconciliation.module.css";

type Transition = "close" | "reopen" | "cancel";

export function ClosureDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => service.get(id), [id]);
  const rules = useAsync(() => service.rules(), []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [category, setCategory] = useState<ClosureCategory | "">("");
  const [severity, setSeverity] = useState<ClosureSeverity | "">("");
  const [itemStatus, setItemStatus] = useState<ClosureItemStatus | "">("");
  const [transition, setTransition] = useState<Transition>();
  const [transitionText, setTransitionText] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<string>();
  const [revokeReason, setRevokeReason] = useState("");
  const [signRole, setSignRole] = useState<ClosureSignoffRole>();
  const [signStatement, setSignStatement] = useState("");

  const data = state.data;

  const filteredItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter(
      (item) =>
        (!category || item.category === category) &&
        (!severity || item.severity === severity) &&
        (!itemStatus || item.status === itemStatus),
    );
  }, [data, category, severity, itemStatus]);

  async function mutate(run: () => Promise<ClosureDetail>): Promise<boolean> {
    setBusy(true);
    setError(undefined);
    try {
      const next = await run();
      state.setData(next);
      setTransition(undefined);
      setTransitionText("");
      setRevokeTarget(undefined);
      setRevokeReason("");
      setSignRole(undefined);
      setSignStatement("");
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível concluir a ação.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (state.loading) {
    return (
      <section className={styles.page}>
        <ClosureNav />
        <Loading />
      </section>
    );
  }

  if (state.error) {
    return (
      <section className={styles.page}>
        <ClosureNav />
        <ErrorState error={state.error} onRetry={state.reload} />
      </section>
    );
  }

  if (!data) {
    return (
      <section className={styles.page}>
        <ClosureNav />
        <EmptyState
          title="Conciliação não encontrada"
          description="Verifique o identificador ou volte para a listagem."
        />
      </section>
    );
  }

  const editable = ["DRAFT", "COLLECTING", "IN_REVIEW", "PENDING_EXCEPTIONS"].includes(data.status);
  const removableSignoff = data.status === "DRAFT" || data.status === "COLLECTING";
  const minimumRoles = rules.data?.minimumSignoffRoles ?? [
    "OPERATIONS_LEAD",
    "LOGISTICS",
  ];
  const recommendedRoles = rules.data?.recommendedSignoffRoles ?? [
    "FIELD",
    "AUDIT",
  ];

  return (
    <section className={styles.page}>
      <ClosureNav />
      <header className={styles.header}>
        <div>
          <span>OPERAÇÕES</span>
          <h1>{data.code}</h1>
          <p>
            {data.election.name} ({data.election.year}) ·{" "}
            {data.electoralZone
              ? `Zona ${data.electoralZone.number}`
              : "Todas as zonas"}{" "}
            · Atualizada em {formatDate(data.updatedAt)}
          </p>
        </div>
        <div className={styles.inline}>
          <Badge tone={statusTone(data.status)}>{STATUS[data.status]}</Badge>
          <Badge tone={data.readinessScore >= 90 ? "success" : "warning"}>
            Prontidão {data.readinessScore}%
          </Badge>
        </div>
      </header>

      {error && <p className={styles.alert}>{error}</p>}

      <SummaryGrid
        metrics={[
          { label: "Ativos não devolvidos", value: data.assetsUnreturned },
          { label: "Entregas pendentes", value: data.deliveriesPending },
          { label: "Despachos abertos", value: data.dispatchesOpen },
          { label: "Evidências faltantes", value: data.evidenceMissing },
          {
            label: "Impeditivos",
            value: data.blockingItems,
            tone: data.blockingItems ? "danger" : "success",
          },
          {
            label: "Exceções abertas",
            value: data.exceptionsOpen,
            tone: data.exceptionsOpen ? "warning" : "default",
          },
          {
            label: "Exceções aprovadas",
            value: data.exceptionsAccepted,
            hint: `${data.exceptionsExpired} vencida(s)`,
          },
          { label: "Última detecção", value: formatDate(data.lastRefreshedAt) },
        ]}
      />

      <Card>
        <h2>Ações da conciliação</h2>
        <div className={styles.inline}>
          <Button
            disabled={busy || !editable}
            onClick={() => mutate(() => service.refresh(id, data.updatedAt))}
          >
            Atualizar pendências
          </Button>
          <Button
            disabled={busy || data.status !== "COLLECTING"}
            secondary
            onClick={() => mutate(() => service.submit(id, data.updatedAt))}
          >
            Submeter
          </Button>
          <Button
            disabled={busy || data.status !== "IN_REVIEW"}
            secondary
            onClick={() => mutate(() => service.approve(id, data.updatedAt))}
          >
            Aprovar como pronta
          </Button>
          <Button
            disabled={busy || data.status !== "READY"}
            onClick={() => setTransition("close")}
          >
            Encerrar pleito
          </Button>
          <Button
            disabled={busy || !["READY", "CLOSED", "IN_REVIEW", "PENDING_EXCEPTIONS"].includes(data.status)}
            secondary
            onClick={() => setTransition("reopen")}
          >
            Reabrir
          </Button>
          <Button
            disabled={busy || data.status === "CLOSED" || data.status === "CANCELLED"}
            secondary
            onClick={() => setTransition("cancel")}
          >
            Cancelar conciliação
          </Button>
        </div>

        {transition && (
          <div className={styles.form}>
            <Field
              label={
                transition === "close"
                  ? "Motivo do encerramento (mínimo 20 caracteres)"
                  : "Motivo"
              }
            >
              <Input
                maxLength={transition === "close" ? 4000 : 2000}
                value={transitionText}
                onChange={(event) => setTransitionText(event.target.value)}
                placeholder="Registre o motivo objetivo"
              />
            </Field>
            <div className={styles.inline}>
              <Button
                disabled={busy || transitionText.trim().length < (transition === "close" ? 20 : 5)}
                onClick={() =>
                  mutate(() =>
                    transition === "close"
                      ? service.close(id, data.updatedAt, transitionText)
                      : transition === "reopen"
                        ? service.reopen(id, data.updatedAt, transitionText)
                        : service.cancel(id, data.updatedAt, transitionText),
                  )
                }
              >
                Confirmar
              </Button>
              <Button secondary onClick={() => setTransition(undefined)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {data.evaluation.blockers.length > 0 && (
          <ul className={styles.blockers}>
            {data.evaluation.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        )}

        {data.closureReason && (
          <p className={styles.hint}>
            <strong>Motivo do encerramento:</strong> {data.closureReason}
          </p>
        )}
      </Card>

      <Card>
        <header className={styles.sectionHeader}>
          <h2>Pendências detectadas</h2>
          <div className={styles.filters}>
            <Field label="Categoria">
              <Select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ClosureCategory | "")
                }
              >
                <option value="">Todas</option>
                {Object.entries(CATEGORY).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Severidade">
              <Select
                value={severity}
                onChange={(event) =>
                  setSeverity(event.target.value as ClosureSeverity | "")
                }
              >
                <option value="">Todas</option>
                {Object.entries(SEVERITY).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estado do item">
              <Select
                value={itemStatus}
                onChange={(event) =>
                  setItemStatus(event.target.value as ClosureItemStatus | "")
                }
              >
                <option value="">Todos</option>
                {Object.entries(ITEM_STATUS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </header>
        <ItemsTable
          items={filteredItems}
          renderActions={
            editable
              ? (item) => (
                  <ItemActions
                    item={item}
                    busy={busy}
                    onResolve={(note) =>
                      mutate(() =>
                        service.resolveItem(id, item.id, {
                          expectedUpdatedAt: data.updatedAt,
                          resolutionNote: note,
                        }),
                      )
                    }
                    onDismiss={(reason) =>
                      mutate(() =>
                        service.dismissItem(id, item.id, {
                          expectedUpdatedAt: data.updatedAt,
                          reason,
                        }),
                      )
                    }
                    onReopen={(reason) =>
                      mutate(() =>
                        service.reopenItem(id, item.id, {
                          expectedUpdatedAt: data.updatedAt,
                          reason,
                        }),
                      )
                    }
                    onException={(input) =>
                      mutate(() =>
                        service.registerException(id, {
                          expectedUpdatedAt: data.updatedAt,
                          itemId: item.id,
                          ...input,
                        }),
                      )
                    }
                  />
                )
              : undefined
          }
        />
      </Card>

      <Card>
        <h2>Exceções justificadas</h2>
        <Link to={`/closure-reconciliation/${data.id}/exceptions`}>Ver exceções e registrar por categoria</Link>
        <ExceptionsPanel
          exceptions={data.exceptions}
          busy={busy}
          onAccept={
            editable
              ? (exception) =>
                  mutate(() =>
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
                  mutate(() =>
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

      <Card>
        <h2>Assinaturas</h2>
        <SignoffPanel
          signoffs={data.signoffs}
          gaps={
            data.evaluation.signoffGaps.length
              ? data.evaluation.signoffGaps
              : (minimumRoles.filter(
                  (role) =>
                    !data.signoffs.some((signoff) => signoff.role === role),
                ) as ClosureSignoffRole[])
          }
          recommended={recommendedRoles as ClosureSignoffRole[]}
          roleLabels={SIGNOFF_ROLE}
          busy={busy}
          onSign={
            editable
              ? (role) => {
                  setSignRole(role);
                  setSignStatement("");
                }
              : undefined
          }
          onRemove={
            removableSignoff
              ? (signoffId) =>
                  mutate(() =>
                    service.removeSignoff(id, signoffId, data.updatedAt),
                  )
              : undefined
          }
        />
        {signRole && (
          <div className={styles.form}>
            <Field label={`Declaração de ${SIGNOFF_ROLE[signRole]}`}>
              <Input
                value={signStatement}
                maxLength={2000}
                onChange={(event) => setSignStatement(event.target.value)}
                placeholder="Declaro que revisei as pendências desta conciliação"
              />
            </Field>
            <div className={styles.inline}>
              <Button
                disabled={busy || signStatement.trim().length < 10}
                onClick={() =>
                  mutate(() =>
                    service.signoff(id, {
                      expectedUpdatedAt: data.updatedAt,
                      role: signRole,
                      statement: signStatement,
                    }),
                  )
                }
              >
                Registrar assinatura
              </Button>
              <Button secondary onClick={() => setSignRole(undefined)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <header className={styles.sectionHeader}>
          <h2>Histórico recente</h2>
          <Link to={`/closure-reconciliation/${data.id}/history`}>
            Ver histórico completo
          </Link>
        </header>
        <HistoryTimeline entries={data.history.slice(0, 10)} />
      </Card>
    </section>
  );
}
