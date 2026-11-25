# Plano — Operação de campo sem conexão

**Data:** 2026-11-17
**Papel/modelo:** GPT-6 na orquestração, especificação, implementação, testes e revisão, sem subagentes.
**SPEC Gate:** `NEW_SPEC` — `SPEC/2026-11-17-operacao-campo-offline.md`.

## Objetivo e condição de início

Entregar captura offline das três operações especificadas, fila persistida visível e sincronização posterior segura, preservando fluxos online. **Não editar implementação antes de a SPEC estar commitada isoladamente com autorização explícita do usuário.** Preservar todos os arquivos previamente modificados, inclusive `AGENTS.md` e as mudanças pendentes em `reports`.

## Preflight dos execution issues

- `docs/execution-issues/2026-11-17-exportacao-views-bi.md` ISSUE-001 (`open`, dependências incompletas): `BLOCKS_CURRENT_TASK` para validação de código, não para documentação; confirmar estado atual antes de implementar e resolver ou pedir orientação se ainda impedir os testes necessários.
- ISSUE-002 (`open`, providers de subagentes): `RELATED_NON_BLOCKING` porque o usuário determinou execução pelo agente principal; não delegar.
- Alterações não commitadas de `reports`: `OUT_OF_SCOPE`; preservar sem staging.
- `docs/execution-issues/2026-11-17-operacao-campo-offline.md` ISSUE-002: `BLOCKS_CURRENT_TASK`; o commit inicial da SPEC não passa `spec:check` e não será reescrito sem autorização específica.

### Atualização do preflight

Em 2026-11-17, o usuário autorizou a reescrita do commit e a correção das dependências. ISSUE-001 e ISSUE-002 foram resolvidos com evidências no registro de execução: commit da SPEC `a046b39`, `spec:check`, instalação npm, geração Prisma, typecheck, lint e 41 testes focados. A suíte completa ainda apresenta falhas nas alterações preexistentes em `reports`, e o build não teve conclusão confirmada dentro do tempo da ferramenta; não afirmar validação global bem-sucedida.

## Fases

1. **SPEC e gate:** revisar contratos dos plugins, registrar esta SPEC e obter autorização para o commit **apenas da SPEC**. Arquivo: `SPEC/2026-11-17-operacao-campo-offline.md`. No-go se a autorização não vier.
2. **Descoberta mínima:** ler manifests, interfaces e serviços diretamente afetados em `plugins/monitoring/incidents`, `plugins/operations/field-teams`, `plugins/operations/preparation-checklists`; inspecionar `@eops/api-client`, autenticação e packages públicos necessários; fechar decisões de modelo de armazenamento, conflito e deduplicação.
3. **Infraestrutura de fila:** implementar persistência e sincronização com isolamento por usuário, tratamento de erro e concorrência, teste unitário e UI visível sem violar fronteiras. Arquivos exatos a definir após descoberta.
4. **Integração por domínio:** conectar criação de incidentes, transições de despacho e atualização de itens; preservar autorização, validação, auditoria e eventos; adicionar testes colocados junto ao código.
5. **Validação e entrega:** executar validações da SPEC, E2E se possível, atualizar `npm run loc:total`, revisar diff/status e reconciliar execution issues. Nenhum commit de implementação ou push sem autorização.

## Go/no-go e riscos

- **Go:** SPEC commitada antes de código; contratos de idempotência, identidade e conflito verificáveis; dependências e testes restaurados.
- **No-go:** falta de autorização de commit da SPEC, identidade de usuário não verificável, risco de duplicação sem deduplicação, ou incapacidade de validar fluxo crítico.
- Riscos: perda de conectividade no meio do envio; duas abas; logout; armazenamento indisponível; mudança remota do recurso; regras de transição e permissões alteradas entre captura e sincronização. Nenhum desses casos pode produzir sucesso fictício.

## Aceite

Atender os cinco critérios da SPEC, sem código artificial para elevar LOC; medir apenas código real, registrar desvios e entregar `SPEC COMPLIANCE` e `EXECUTION ISSUES RECONCILIATION`.