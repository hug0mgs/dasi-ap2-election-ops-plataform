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
  FindingInput,
  InspectionDimension,
  InspectionSeverity,
} from "../../types";
import { EvidenceLinksEditor } from "../components/EvidenceLinksEditor";
import { InspectionsNav } from "../components/InspectionsNav";
import { DIMENSION } from "../labels";
import { pollingPlaceInspectionsService as service } from "../services/pollingPlaceInspectionsService";
import styles from "../styles/inspections.module.css";

export function InspectionFindingsPage() {
  const { id = "" } = useParams();
  const state = useAsync(() => service.get(id), [id]);
  const [error, setError] = useState<Error>();
  async function act(action: () => Promise<unknown>) {
    try {
      await action();
      state.setData(await service.get(id));
      setError(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause : new Error("Operação não concluída."),
      );
    }
  }
  const inspection = state.data;
  return (
    <section className={styles.page}>
      <InspectionsNav />
      <p className={styles.breadcrumb}>
        <Link to={`/polling-place-inspections/${id}`}>Vistoria</Link> / Achados
      </p>
      <header className={styles.header}>
        <div>
          <h1>Achados da vistoria</h1>
          <p>Criação, resolução e aceite formal de risco.</p>
        </div>
      </header>
      {state.loading && <Loading />}
      {(state.error || error) && (
        <ErrorState error={error ?? state.error} onRetry={state.reload} />
      )}
      {inspection && (
        <>
          <Card>
            <FindingForm
              responses={inspection.responses}
              onSubmit={(input) =>
                act(() =>
                  service.finding(id, {
                    ...input,
                    expectedUpdatedAt: inspection.updatedAt,
                  }),
                )
              }
            />
          </Card>
          <div className={styles.list}>
            {!inspection.findings.length && (
              <Card>
                <p className={styles.empty}>Nenhum achado registrado.</p>
              </Card>
            )}
            {inspection.findings.map((finding) => (
              <Card key={finding.id}>
                <article className={styles.findingDetail}>
                  <div className={styles.header}>
                    <div>
                      <h2>{finding.title}</h2>
                      <p>{finding.description}</p>
                    </div>
                    <div className={styles.badges}>
                      <Badge tone={finding.blocking ? "danger" : "warning"}>
                        {finding.severity}
                      </Badge>
                      <Badge>{finding.status}</Badge>
                    </div>
                  </div>
                  <small>
                    {DIMENSION[finding.dimension]}
                    {finding.dueAt
                      ? ` · prazo ${new Date(finding.dueAt).toLocaleDateString("pt-BR")}`
                      : ""}
                  </small>
                  {finding.resolution && (
                    <p>
                      <strong>Resolução:</strong> {finding.resolution}
                    </p>
                  )}
                  {!["RESOLVED", "ACCEPTED"].includes(finding.status) && (
                    <FindingDecisions
                      onResolve={(resolution) =>
                        act(() =>
                          service.resolve(id, finding.id, {
                            resolution,
                            expectedUpdatedAt: inspection.updatedAt,
                          }),
                        )
                      }
                      onAccept={(reason, validUntil) =>
                        act(() =>
                          service.acceptRisk(id, finding.id, {
                            reason,
                            validUntil,
                            expectedUpdatedAt: inspection.updatedAt,
                          }),
                        )
                      }
                    />
                  )}
                  <EvidenceLinksEditor
                    links={inspection.evidenceLinks}
                    targetType="FINDING"
                    targetId={finding.id}
                    onChange={(evidenceId, remove) =>
                      act(() =>
                        service.evidence(id, {
                          evidenceId,
                          remove,
                          targetType: "FINDING",
                          targetId: finding.id,
                          expectedUpdatedAt: inspection.updatedAt,
                        }),
                      )
                    }
                  />
                  {finding.status === "RESOLVED" && (
                    <EvidenceLinksEditor
                      links={inspection.evidenceLinks}
                      targetType="RESOLUTION"
                      targetId={finding.id}
                      onChange={(evidenceId, remove) =>
                        act(() =>
                          service.evidence(id, {
                            evidenceId,
                            remove,
                            targetType: "RESOLUTION",
                            targetId: finding.id,
                            expectedUpdatedAt: inspection.updatedAt,
                          }),
                        )
                      }
                    />
                  )}
                </article>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function FindingForm({
  responses,
  onSubmit,
}: {
  responses: Array<{ id: string; title: string }>;
  onSubmit: (input: Omit<FindingInput, "expectedUpdatedAt">) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dimension, setDimension] = useState<InspectionDimension>("ACCESS");
  const [severity, setSeverity] = useState<InspectionSeverity>("MEDIUM");
  const [responseId, setResponseId] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [blockingReason, setBlockingReason] = useState("");
  return (
    <div className={styles.form}>
      <h2>Novo achado</h2>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição"
      />
      <Select
        value={dimension}
        onChange={(e) => setDimension(e.target.value as InspectionDimension)}
      >
        {Object.entries(DIMENSION).map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        value={severity}
        onChange={(e) => setSeverity(e.target.value as InspectionSeverity)}
      >
        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </Select>
      <Select
        value={responseId}
        onChange={(e) => setResponseId(e.target.value)}
      >
        <option value="">Sem resposta associada</option>
        {responses.map((response) => (
          <option key={response.id} value={response.id}>
            {response.title}
          </option>
        ))}
      </Select>
      <label>
        <input
          type="checkbox"
          checked={blocking}
          onChange={(e) => setBlocking(e.target.checked)}
        />{" "}
        Impeditivo
      </label>
      {blocking && (
        <Input
          value={blockingReason}
          onChange={(e) => setBlockingReason(e.target.value)}
          placeholder="Motivo do impedimento"
        />
      )}
      <Button
        disabled={
          !title.trim() ||
          !description.trim() ||
          (blocking && !blockingReason.trim())
        }
        onClick={() =>
          onSubmit({
            title,
            description,
            dimension,
            severity,
            responseId: responseId || undefined,
            blocking,
            blockingReason: blockingReason || undefined,
          })
        }
      >
        Criar achado
      </Button>
    </div>
  );
}

function FindingDecisions({
  onResolve,
  onAccept,
}: {
  onResolve: (resolution: string) => void;
  onAccept: (reason: string, validUntil: string) => void;
}) {
  const [resolution, setResolution] = useState("");
  const [reason, setReason] = useState("");
  const [validUntil, setValidUntil] = useState("");
  return (
    <div className={styles.decisionGrid}>
      <div className={styles.inlineActions}>
        <Input
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="Descrição da resolução"
        />
        <Button
          disabled={!resolution.trim()}
          onClick={() => onResolve(resolution)}
        >
          Resolver
        </Button>
      </div>
      <div className={styles.inlineActions}>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Justificativa do aceite"
        />
        <Input
          aria-label="Validade do aceite"
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
        />
        <Button
          secondary
          disabled={!reason.trim() || !validUntil}
          onClick={() =>
            onAccept(reason, new Date(`${validUntil}T23:59:59`).toISOString())
          }
        >
          Aceitar risco
        </Button>
      </div>
    </div>
  );
}
