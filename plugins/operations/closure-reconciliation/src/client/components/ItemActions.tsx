import { Button, Field, Input, Select } from "@eops/ui";
import { useState } from "react";
import type { ClosureCategory, ClosureItem, ClosureRisk } from "../../types";
import styles from "../styles/closure-reconciliation.module.css";

type Action = "resolve" | "dismiss" | "reopen" | "exception";

export function ItemActions({
  item,
  busy,
  onResolve,
  onDismiss,
  onReopen,
  onException,
}: {
  item: ClosureItem;
  busy: boolean;
  onResolve: (note: string) => Promise<boolean>;
  onDismiss: (reason: string) => Promise<boolean>;
  onReopen: (reason: string) => Promise<boolean>;
  onException: (input: {
    category: ClosureCategory;
    risk: ClosureRisk;
    justification: string;
    mitigation?: string;
    validUntil?: string;
  }) => Promise<boolean>;
}) {
  const [action, setAction] = useState<Action>();
  const [text, setText] = useState("");
  const [risk, setRisk] = useState<ClosureRisk>("MEDIUM");
  const [mitigation, setMitigation] = useState("");
  const [validUntil, setValidUntil] = useState("");

  const treated = item.status === "RESOLVED" || item.status === "DISMISSED";

  async function run() {
    let success = false;
    if (action === "resolve") success = await onResolve(text);
    if (action === "dismiss") success = await onDismiss(text);
    if (action === "reopen") success = await onReopen(text);
    if (action === "exception")
      success = await onException({
        category: item.category,
        risk,
        justification: text,
        mitigation: mitigation || undefined,
        validUntil: validUntil || undefined,
      });
    if (!success) return;
    setAction(undefined);
    setText("");
    setMitigation("");
    setValidUntil("");
  }

  return (
    <div className={styles.actions}>
      {!action && (
        <>
          {!treated && (
            <>
              <Button
                secondary
                disabled={busy}
                onClick={() => setAction("resolve")}
              >
                Resolver
              </Button>
              <Button
                secondary
                disabled={busy}
                onClick={() => setAction("dismiss")}
              >
                Dispensar
              </Button>
              <Button
                secondary
                disabled={busy}
                onClick={() => setAction("exception")}
              >
                Exceção
              </Button>
            </>
          )}
          {item.status !== "PENDING" && (
            <Button
              secondary
              disabled={busy}
              onClick={() => setAction("reopen")}
            >
              Reabrir
            </Button>
          )}
        </>
      )}
      {action && (
        <div className={styles.form}>
          <Field
            label={
              action === "resolve"
                ? "Descrição da resolução"
                : action === "exception"
                  ? "Justificativa da exceção (mínimo 20 caracteres)"
                  : "Motivo"
            }
          >
            <Input
              value={text}
              maxLength={action === "exception" ? 4000 : 2000}
              onChange={(event) => setText(event.target.value)}
              placeholder="Registre o motivo objetivo"
            />
          </Field>
          {action === "exception" && (
            <>
              <Field label="Risco">
                <Select
                  value={risk}
                  onChange={(event) =>
                    setRisk(event.target.value as ClosureRisk)
                  }
                >
                  <option value="LOW">Baixo</option>
                  <option value="MEDIUM">Médio</option>
                  <option value="HIGH">Alto</option>
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
            </>
          )}
          <div className={styles.inline}>
            <Button disabled={busy || text.trim().length < (action === "exception" ? 20 : 5)} onClick={run}>
              Confirmar
            </Button>
            <Button secondary onClick={() => setAction(undefined)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
