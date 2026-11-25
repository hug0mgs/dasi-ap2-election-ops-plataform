export const STATUS = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em execução",
  SUBMITTED: "Em revisão",
  APPROVED: "Aprovada",
  CHANGES_REQUESTED: "Ajustes solicitados",
  CANCELLED: "Cancelada",
  REOPENED: "Reaberta",
} as const;
export const FITNESS = {
  NOT_ASSESSED: "Não avaliada",
  FIT: "Apto",
  FIT_WITH_RESTRICTIONS: "Apto com restrições",
  UNFIT: "Inapto",
} as const;
export const DIMENSION = {
  ACCESS: "Acesso",
  ENERGY: "Energia",
  CONNECTIVITY: "Conectividade",
  SIGNAGE: "Sinalização",
  INFRASTRUCTURE: "Infraestrutura",
} as const;
export const ANSWER = {
  COMPLIANT: "Conforme",
  PARTIALLY_COMPLIANT: "Parcialmente conforme",
  NON_COMPLIANT: "Não conforme",
  NOT_APPLICABLE: "Não aplicável",
  NOT_VERIFIED: "Não verificado",
} as const;
