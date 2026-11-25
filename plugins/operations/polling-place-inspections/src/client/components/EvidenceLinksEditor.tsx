import { Button, Input, Select } from "@eops/ui";
import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  InspectionEvidenceLink,
  InspectionEvidenceTarget,
} from "../../types";
import styles from "../styles/inspections.module.css";

interface EvidenceLinksEditorProps {
  links: InspectionEvidenceLink[];
  targetType: InspectionEvidenceTarget;
  targetId: string;
  disabled?: boolean;
  onChange: (evidenceId: string, remove?: boolean) => void;
}

export function EvidenceLinksEditor({
  links,
  targetType,
  targetId,
  disabled,
  onChange,
}: EvidenceLinksEditorProps) {
  const [evidenceId, setEvidenceId] = useState("");
  const targetLinks = links.filter(
    (link) => link.targetType === targetType && link.targetId === targetId,
  );

  return (
    <div className={styles.evidenceEditor}>
      <strong>Evidências</strong>
      {targetLinks.length === 0 && (
        <span className={styles.empty}>Nenhuma evidência vinculada.</span>
      )}
      {targetLinks.map((link) => (
        <div className={styles.inlineActions} key={link.id}>
          <Link to={`/evidence/${link.evidenceId}`}>{link.evidenceId}</Link>
          <Button
            secondary
            disabled={disabled}
            onClick={() => onChange(link.evidenceId, true)}
          >
            Remover
          </Button>
        </div>
      ))}
      <div className={styles.inlineActions}>
        <Input
          aria-label={`ID da evidência para ${targetType.toLowerCase()}`}
          disabled={disabled}
          value={evidenceId}
          onChange={(event) => setEvidenceId(event.target.value)}
          placeholder="ID da evidência"
        />
        <Select aria-label="Destino da evidência" disabled value={targetType}>
          <option value={targetType}>{targetType}</option>
        </Select>
        <Button
          disabled={disabled || !evidenceId.trim()}
          onClick={() => {
            onChange(evidenceId.trim());
            setEvidenceId("");
          }}
        >
          Vincular
        </Button>
        <Link to="/evidence">Consultar evidências</Link>
      </div>
    </div>
  );
}
