import { Badge, Button } from "@eops/ui";
import type { ClosureException, ClosureSignoffRole } from "../../types";
import {
  CATEGORY,
  EXCEPTION_STATUS,
  RISK,
  exceptionTone,
  formatDate,
} from "../labels";
import styles from "../styles/closure-reconciliation.module.css";

export function ExceptionsPanel({
  exceptions,
  busy,
  onAccept,
  onRevoke,
}: {
  exceptions: ClosureException[];
  busy: boolean;
  onAccept?: (exception: ClosureException) => void;
  onRevoke?: (exception: ClosureException) => void;
}) {
  if (!exceptions.length)
    return (
      <p className={styles.empty}>
        Nenhuma exceção registrada nesta conciliação.
      </p>
    );

  return (
    <div className={styles.stack}>
      {exceptions.map((exception) => (
        <article key={exception.id} className={styles.panel}>
          <header>
            <div>
              <strong>
                {exception.item?.referenceLabel ??
                  CATEGORY[exception.category]}
              </strong>
              <small>{CATEGORY[exception.category]}</small>
            </div>
            <div className={styles.inline}>
              <Badge tone={exceptionTone(exception.status)}>
                {EXCEPTION_STATUS[exception.status]}
              </Badge>
              <Badge tone={exception.risk === "HIGH" ? "danger" : "warning"}>
                Risco {RISK[exception.risk]}
              </Badge>
            </div>
          </header>
          <p>{exception.justification}</p>
          {exception.mitigation && (
            <p>
              <strong>Mitigação:</strong> {exception.mitigation}
            </p>
          )}
          <dl className={styles.meta}>
            <div>
              <dt>Registrada por</dt>
              <dd>{exception.registeredByName ?? exception.registeredById}</dd>
            </div>
            <div>
              <dt>Registrada em</dt>
              <dd>{formatDate(exception.createdAt)}</dd>
            </div>
            <div>
              <dt>Validade</dt>
              <dd>{formatDate(exception.validUntil)}</dd>
            </div>
            {exception.approvedAt && (
              <div>
                <dt>Aprovada em</dt>
                <dd>{formatDate(exception.approvedAt)}</dd>
              </div>
            )}
            {exception.approvedById && (
              <div>
                <dt>Aprovada por</dt>
                <dd>{exception.approvedById}</dd>
              </div>
            )}
            {exception.revokedAt && (
              <div>
                <dt>Revogada em</dt>
                <dd>{formatDate(exception.revokedAt)}</dd>
              </div>
            )}
          </dl>
          {exception.revokeReason && (
            <p>
              <strong>Motivo da revogação:</strong> {exception.revokeReason}
            </p>
          )}
          <footer className={styles.inline}>
            {exception.status === "REGISTERED" && <p className={styles.hint}>A aprovação exige usuário diferente de quem registrou.</p>}
            {onAccept && exception.status === "REGISTERED" && (
              <Button disabled={busy} onClick={() => onAccept(exception)}>
                Aprovar exceção
              </Button>
            )}
            {onRevoke &&
              (exception.status === "REGISTERED" ||
                exception.status === "ACCEPTED") && (
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => onRevoke(exception)}
                >
                  Revogar exceção
                </Button>
              )}
          </footer>
        </article>
      ))}
    </div>
  );
}

export function SignoffPanel({
  signoffs,
  gaps,
  recommended,
  roleLabels,
  busy,
  onSign,
  onRemove,
}: {
  signoffs: Array<{
    id: string;
    role: ClosureSignoffRole;
    userNameSnapshot: string;
    statement: string;
    signedAt: string;
  }>;
  gaps: ClosureSignoffRole[];
  recommended: ClosureSignoffRole[];
  roleLabels: Record<ClosureSignoffRole, string>;
  busy: boolean;
  onSign?: (role: ClosureSignoffRole) => void;
  onRemove?: (signoffId: string) => void;
}) {
  const missingRecommended = recommended.filter(
    (role) => !signoffs.some((signoff) => signoff.role === role),
  );

  return (
    <div className={styles.stack}>
      {gaps.length > 0 && (
        <p className={styles.alert}>
          Assinaturas obrigatórias ausentes:{" "}
          {gaps.map((role) => roleLabels[role]).join(", ")}.
        </p>
      )}
      {missingRecommended.length > 0 && gaps.length === 0 && (
        <p className={styles.hint}>
          Assinaturas recomendadas ainda ausentes:{" "}
          {missingRecommended.map((role) => roleLabels[role]).join(", ")}.
        </p>
      )}
      {signoffs.length === 0 && (
        <p className={styles.empty}>Nenhuma assinatura registrada.</p>
      )}
      {signoffs.map((signoff) => (
        <article key={signoff.id} className={styles.panel}>
          <header>
            <div>
              <strong>{roleLabels[signoff.role]}</strong>
              <small>
                {signoff.userNameSnapshot} · {formatDate(signoff.signedAt)}
              </small>
            </div>
            {onRemove && (
              <Button
                secondary
                disabled={busy}
                onClick={() => onRemove(signoff.id)}
              >
                Remover
              </Button>
            )}
          </header>
          <p>{signoff.statement}</p>
        </article>
      ))}
      {onSign && (
        <div className={styles.inline}>
          {(Object.keys(roleLabels) as ClosureSignoffRole[]).map((role) => (
            <Button
              key={role}
              secondary
              disabled={busy}
              onClick={() => onSign(role)}
            >
              Assinar como {roleLabels[role]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
