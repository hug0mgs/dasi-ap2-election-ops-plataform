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
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { InspectionsNav } from "../components/InspectionsNav";
import { pollingPlaceInspectionsService as service } from "../services/pollingPlaceInspectionsService";
import styles from "../styles/inspections.module.css";
export function NewInspectionPage() {
  const nav = useNavigate();
  const refs = useAsync(service.references, []);
  const catalog = useAsync(service.catalog, []);
  const [electionId, setElection] = useState("");
  const [zoneId, setZone] = useState("");
  const [error, setError] = useState<Error>();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const item = await service.create({
        electionId,
        electoralZoneId: zoneId,
        pollingPlaceId: String(f.get("place")),
        templateId: String(f.get("template")),
        inspectionType: String(f.get("type")),
      });
      nav(`/polling-place-inspections/${item.id}`);
    } catch (x) {
      setError(x instanceof Error ? x : new Error("Falha ao criar vistoria."));
    }
  }
  const zones =
    refs.data?.zones.filter((z) => z.electionId === electionId) ?? [];
  const places =
    refs.data?.places.filter((p) => p.electoralZoneId === zoneId) ?? [];
  return (
    <section className={styles.page}>
      <InspectionsNav />
      <header>
        <h1>Nova vistoria</h1>
        <p>Selecione o contexto e o formulário aplicável.</p>
      </header>
      {(refs.loading || catalog.loading) && <Loading />}
      {(refs.error || catalog.error || error) && (
        <ErrorState error={error ?? refs.error ?? catalog.error} />
      )}
      <Card>
        <form className={styles.form} onSubmit={submit}>
          <Field label="Pleito">
            <Select
              required
              value={electionId}
              onChange={(e) => {
                setElection(e.target.value);
                setZone("");
              }}
            >
              <option value="">Selecione</option>
              {refs.data?.elections.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Zona">
            <Select
              required
              value={zoneId}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="">Selecione</option>
              {zones.map((x) => (
                <option key={x.id} value={x.id}>
                  Zona {x.number} · {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Local">
            <Select name="place" required>
              <option value="">Selecione</option>
              {places.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Formulário">
            <Select name="template" required>
              <option value="">Selecione</option>
              {catalog.data
                ?.filter((x) => x.active)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · v{x.version}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Input
              name="type"
              required
              minLength={2}
              maxLength={80}
              placeholder="Inicial, revisita…"
            />
          </Field>
          <Button type="submit">Criar vistoria</Button>
        </form>
      </Card>
    </section>
  );
}
