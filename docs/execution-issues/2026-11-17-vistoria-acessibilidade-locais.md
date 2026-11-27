# Execution issues — Vistoria e acessibilidade dos locais

## Contexto

- Data: 2026-11-17
- Prompt/sessão: `prompts/sessoes/2026-11-17-cline-vistoria-acessibilidade-locais.md`
- SPEC: `SPEC/2026-11-17-vistoria-acessibilidade-locais.md`
- Agente: orquestração `openai/gpt-6-astra`; implementador/testes alternativos com modelo não exposto
- Escopo: plugin de vistorias, persistência, RBAC, eventos, composição, UI e testes

---

## ISSUE-001

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

implementação

### Problema observado

O subagente previsto para implementação encerrou antes de executar a tarefa porque o provedor informou saldo de créditos igual a zero. O runtime alternativo concluiu a implementação, mas não expôs o modelo efetivamente utilizado.

### Evidência

Mensagem do subagente: `Insufficient balance. Your Cline Credits balance is $0.00`. O executor alternativo retornou `model-unavailable`.

### O que era esperado

Executar o papel Implementador com o modelo designado pela governança e registrar o modelo real no handoff.

### Impacto

Não foi possível comprovar aderência ao modelo de referência. A implementação pôde prosseguir por executor alternativo e foi revisada por validações locais.

### Contorno utilizado

Uso do executor alternativo com papel, escopo e proibições explícitos. O modelo foi registrado como indisponível, sem alegar conformidade inexistente.

### Correção estrutural sugerida

Disponibilizar créditos para subagentes ou expor o modelo real do executor alternativo.

### Estado

not-actionable

### Decisão e evidência de encerramento

Limitação externa à árvore do repositório. O contorno preservou papéis e escopo; typecheck, lint, fronteiras, builds e testes focados passaram. Reavaliar quando o provedor disponibilizar créditos e identificação de modelo.

---

## ISSUE-002

### Categoria

DATA_OR_INFRA

### Severidade

non-blocking

### Etapa

validação

### Problema observado

Não foi fornecido banco PostgreSQL descartável para aplicar e reverter a nova migration nem executar o fluxo E2E completo.

### Evidência

`prisma validate` passou com URL sintética sem abertura de conexão. Testes de service usam doubles do Prisma. Nenhuma migration foi aplicada em banco real.

### O que era esperado

Banco de integração migrável e semeável para validar constraints, relacionamentos e fluxo HTTP/browser.

### Impacto

Schema e migration foram revisados estaticamente, mas aplicação real, rollback e E2E permanecem sem evidência.

### Contorno utilizado

Validação do schema, geração do Prisma Client, testes unitários/service/controller, typecheck e builds separados.

### Correção estrutural sugerida

Disponibilizar banco PostgreSQL efêmero para CI e execução local de integração/E2E.

### Estado

resolved

### Decisão e evidência de encerramento

Validação concluída em 2026-11-27 com PostgreSQL 17 descartável. O Prisma aplicou as 27 migrations, incluindo `202611170001_polling_place_inspections`, e o seed concluiu. Em um segundo banco com as migrations anteriores, o SQL da vistoria foi aplicado em transação e revertido com `ROLLBACK`. Essa verificação cobre a transação antes do commit.

O teste `tests/e2e/flows/polling-place-inspections.spec.ts` passou via Playwright contra a API real. A cobertura inclui criação, agendamento, execução, vínculo de evidência, impeditivo, bloqueio de aprovação, pedido de ajustes, resolução, nova submissão e aprovação por outro usuário. A execução conferiu HTTP 401 sem sessão, HTTP 403 para consulta nas ações protegidas e a rejeição da autoaprovação. Uma nova leitura confirmou respostas, achado resolvido, vínculo, decisões e histórico. A consulta ao PostgreSQL também confirmou `APPROVED` e `FIT`.

## Reavaliação em 2026-11-24

- A suíte global passou com 789 testes em 78 arquivos; a falha anterior de decorators em `plugins/analytics/reports` foi resolvida com `tsconfig.json` local do plugin.
- Os 14 testes focados da vistoria, o typecheck, o lint, as fronteiras, o build e a validação Prisma passaram.
- A aplicação da migration em PostgreSQL real, rollback e E2E continuam sem execução; o ISSUE-002 permanece `open`.
