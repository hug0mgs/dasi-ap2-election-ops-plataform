import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  Loading,
  Select,
  useAsync,
} from "@eops/ui";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  InspectionAnswer,
  InspectionAssigneeRole,
  InspectionFitness,
  InspectionResponse,
} from "../../types";
import { EvidenceLinksEditor } from "../components/EvidenceLinksEditor";
import { InspectionsNav } from "../components/InspectionsNav";
import { ANSWER, DIMENSION, FITNESS, STATUS } from "../labels";
import { pollingPlaceInspectionsService as service } from "../services/pollingPlaceInspectionsService";
import styles from "../styles/inspections.module.css";
export function InspectionDetailPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => service.get(id), [id]);
  const references = useAsync(() => service.references(), []);
  const [error, setError] = useState<Error>();
  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      state.setData(await service.get(id));
      setError(undefined);
    } catch (x) {
      setError(x instanceof Error ? x : new Error("Operação não concluída."));
    }
  }
  const i = state.data;
  return (
    <section className={styles.page}>
      <InspectionsNav />
      <p className={styles.breadcrumb}>
        <Link to="/polling-place-inspections/list">Vistorias</Link> / Detalhes
      </p>
      {state.loading && <Loading />}
      {(state.error || error) && (
        <ErrorState error={error ?? state.error} onRetry={state.reload} />
      )}{" "}
      {i && (
        <>
          <header className={styles.header}>
            <div>
              <span>
                {i.election.name} · ZONA {i.electoralZone.number}
              </span>
              <h1>{i.pollingPlace.name}</h1>
              <p>
                {i.pollingPlace.address} · rodada {i.round}
              </p>
            </div>
            <div className={styles.badges}>
              <Badge>{STATUS[i.status]}</Badge>
              <Badge
                tone={
                  i.fitness === "UNFIT"
                    ? "danger"
                    : i.fitness === "FIT"
                      ? "success"
                      : "warning"
                }
              >
                {FITNESS[i.fitness]}
              </Badge>
            </div>
          </header>
          <div className={styles.metrics}>
            <Card>
              <span>Progresso</span>
              <strong>{i.progress}%</strong>
            </Card>
            <Card>
              <span>Impedimentos</span>
              <strong>{i.openBlockingFindings}</strong>
            </Card>
            <Card>
              <span>Responsáveis</span>
              <strong>{i.assignees.filter((x) => x.active).length}</strong>
            </Card>
          </div>
          <Card>
            <div className={styles.actions}>
              {i.status === "DRAFT" && (
                <ScheduleForm
                  onSubmit={(plannedAt) =>
                    act(() =>
                      service.schedule(id, {
                        plannedAt,
                        expectedUpdatedAt: i.updatedAt,
                      }),
                    )
                  }
                />
              )}{" "}
              {(i.status === "SCHEDULED" ||
                i.status === "REOPENED" ||
                i.status === "CHANGES_REQUESTED") && (
                <Button
                  onClick={() =>
                    act(() =>
                      service.start(id, { expectedUpdatedAt: i.updatedAt }),
                    )
                  }
                >
                  Iniciar execução
                </Button>
              )}
              {i.status === "IN_PROGRESS" && (
                <Button
                  onClick={() =>
                    act(() =>
                      service.submit(id, { expectedUpdatedAt: i.updatedAt }),
                    )
                  }
                >
                  Enviar para revisão
                </Button>
              )}
              {i.status === "SUBMITTED" && (
                <ReviewForm
                  onApprove={(fitness, reason) =>
                    act(() =>
                      service.approve(id, {
                        fitness,
                        reason,
                        expectedUpdatedAt: i.updatedAt,
                      }),
                    )
                  }
                  onChanges={(reason) =>
                    act(() =>
                      service.requestChanges(id, {
                        reason,
                        expectedUpdatedAt: i.updatedAt,
                      }),
                    )
                  }
                />
              )}
            </div>
          </Card>
          <div className={styles.detailGrid}>
            <main className={styles.list}>
              <h2>Formulário por dimensão</h2>
              {Object.keys(DIMENSION).map((d) => (
                <Card key={d}>
                  <h3>{DIMENSION[d as keyof typeof DIMENSION]}</h3>
                  {i.responses
                    .filter((r) => r.dimension === d)
                    .map((r) => (
                      <ResponseRow
                        key={r.id}
                        response={r}
                        evidenceLinks={i.evidenceLinks}
                        locked={i.status !== "IN_PROGRESS"}
                        onEvidence={(evidenceId, remove) =>
                          act(() =>
                            service.evidence(id, {
                              evidenceId,
                              remove,
                              targetType: "RESPONSE",
                              targetId: r.id,
                              expectedUpdatedAt: i.updatedAt,
                            }),
                          )
                        }
                        onSave={(answer, observation, justification) =>
                          act(() =>
                            service.respond(id, r.id, {
                              answer,
                              observation,
                              justification,
                              expectedUpdatedAt: i.updatedAt,
                            }),
                          )
                        }
                      />
                    ))}
                </Card>
              ))}
            </main>
            <aside className={styles.list}>
              <Card>
                <h2>Achados</h2>
                {i.findings.length ? (
                  i.findings.map((f) => (
                    <article className={styles.finding} key={f.id}>
                      <div>
                        <strong>{f.title}</strong>
                        <Badge tone={f.blocking ? "danger" : "warning"}>
                          {f.severity}
                        </Badge>
                      </div>
                      <p>{f.description}</p>
                      <small>
                        {DIMENSION[f.dimension]} · {f.status}
                      </small>
                    </article>
                  ))
                ) : (
                  <p className={styles.empty}>Nenhum achado registrado.</p>
                )}
              </Card>
              <Card>
                <h2>Responsáveis</h2>
                <AssigneesEditor
                  assignees={i.assignees}
                  users={references.data?.users ?? []}
                  onAssign={(userId, role) =>
                    act(() =>
                      service.assign(id, {
                        userId,
                        role,
                        expectedUpdatedAt: i.updatedAt,
                      }),
                    )
                  }
                  onRemove={(assignmentId) =>
                    act(() =>
                      service.unassign(id, assignmentId, {
                        expectedUpdatedAt: i.updatedAt,
                      }),
                    )
                  }
                />
              </Card>
              <Card>
                <EvidenceLinksEditor
                  links={i.evidenceLinks}
                  targetType="INSPECTION"
                  targetId={i.id}
                  onChange={(evidenceId, remove) =>
                    act(() =>
                      service.evidence(id, {
                        evidenceId,
                        remove,
                        targetType: "INSPECTION",
                        targetId: i.id,
                        expectedUpdatedAt: i.updatedAt,
                      }),
                    )
                  }
                />
              </Card>
              <Card>
                <h2>Histórico</h2>
                <Link to={`/polling-place-inspections/${id}/history`}>
                  Ver trilha completa
                </Link>
              </Card>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
function ResponseRow({
  response,
  evidenceLinks,
  locked,
  onSave,
  onEvidence,
}: {
  response: InspectionResponse;
  evidenceLinks: import("../../types").InspectionEvidenceLink[];
  locked: boolean;
  onSave: (a: InspectionAnswer, o: string, j: string) => void;
  onEvidence: (evidenceId: string, remove?: boolean) => void;
}) {
  const [a, setA] = useState(response.answer);
  const [o, setO] = useState(response.observation ?? "");
  const [j, setJ] = useState(response.justification ?? "");
  return (
    <article className={styles.response}>
      <div>
        <strong>{response.title}</strong>
        <span>
          {response.required && "Obrigatório "}
          {response.critical && "· Crítico "}
          {response.evidenceRequired && "· Evidência"}
        </span>
      </div>
      {response.description && <p>{response.description}</p>}
      <div className={styles.responseControls}>
        <Select
          disabled={locked}
          value={a}
          onChange={(e) => setA(e.target.value as InspectionAnswer)}
        >
          {Object.entries(ANSWER).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input
          disabled={locked}
          value={o}
          onChange={(e) => setO(e.target.value)}
          placeholder="Observação"
        />
        <Input
          disabled={locked}
          value={j}
          onChange={(e) => setJ(e.target.value)}
          placeholder="Justificativa"
        />
        <Button disabled={locked} onClick={() => onSave(a, o, j)}>
          Salvar
        </Button>
      </div>
      <EvidenceLinksEditor
        links={evidenceLinks}
        targetType="RESPONSE"
        targetId={response.id}
        disabled={locked}
        onChange={onEvidence}
      />
    </article>
  );
}

function AssigneesEditor({
  assignees,
  users,
  onAssign,
  onRemove,
}: {
  assignees: import("../../types").InspectionAssignee[];
  users: Array<{ id: string; name: string; email: string }>;
  onAssign: (userId: string, role: InspectionAssigneeRole) => void;
  onRemove: (assignmentId: string) => void;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<InspectionAssigneeRole>("INSPECTOR");
  return (
    <div className={styles.list}>
      {assignees.map((assignee) => (
        <div className={styles.inlineActions} key={assignee.id}>
          <span>
            {assignee.userNameSnapshot}
            <small>{assignee.role}</small>
          </span>
          <Button secondary onClick={() => onRemove(assignee.id)}>
            Remover
          </Button>
        </div>
      ))}
      <div className={styles.inlineActions}>
        <Select
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value="">Selecione o usuário</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} · {user.email}
            </option>
          ))}
        </Select>
        <Select
          value={role}
          onChange={(event) =>
            setRole(event.target.value as InspectionAssigneeRole)
          }
        >
          {["LEAD", "INSPECTOR", "TECHNICAL_SUPPORT", "REVIEWER"].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </Select>
        <Button disabled={!userId} onClick={() => onAssign(userId, role)}>
          Atribuir
        </Button>
      </div>
    </div>
  );
}
function ScheduleForm({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <>
      <Input
        aria-label="Data planejada"
        type="datetime-local"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <Button disabled={!v} onClick={() => onSubmit(new Date(v).toISOString())}>
        Agendar
      </Button>
    </>
  );
}
function ReviewForm({
  onApprove,
  onChanges,
}: {
  onApprove: (f: InspectionFitness, r: string) => void;
  onChanges: (r: string) => void;
}) {
  const [f, setF] = useState<InspectionFitness>("FIT");
  const [r, setR] = useState("");
  return (
    <>
      <Select
        value={f}
        onChange={(e) => setF(e.target.value as InspectionFitness)}
      >
        {Object.entries(FITNESS)
          .filter(([v]) => v !== "NOT_ASSESSED")
          .map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
      </Select>
      <Input
        value={r}
        onChange={(e) => setR(e.target.value)}
        placeholder="Justificativa da revisão"
      />
      <Button onClick={() => onApprove(f, r)}>Aprovar</Button>
      <Button secondary disabled={!r.trim()} onClick={() => onChanges(r)}>
        Solicitar ajustes
      </Button>
    </>
  );
}
