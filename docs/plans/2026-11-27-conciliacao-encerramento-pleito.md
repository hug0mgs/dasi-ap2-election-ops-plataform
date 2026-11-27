# Plano de execução — Validação e conclusão da conciliação de encerramento do pleito

Data: 2026-11-27.
Papel: Orquestrador.
Modelo real em uso: Gemini 3.8 Flash (declarado como `google/gemini-3.8-flash`).

## Objetivo e SPEC Gate

- **SPEC Gate:** `EXISTING_SPEC_OK`
- **SPEC aplicável:** `SPEC/2026-11-18-conciliacao-encerramento-pleito.md` (estado atual: `approved`).
- **Objetivo:** Concluir a validação integral da SPEC de conciliação de encerramento (`plugins/operations/closure-reconciliation`), confrontando os 10 critérios de aceitação da SPEC com as suítes unitárias, frontend, checagem de fronteiras, tipagem e lint; documentar a conformidade técnica para atualização do status da SPEC para `implemented` quando respaldado por evidência completa.

## Fases e arquivos por fase

### Fase 1: Preflight e verificação estática
- **Responsável:** Orquestrador (`google/gemini-3.8-flash`).
- **Ações:**
  - Preservar arquivos de trabalho externos e não relacionados (ex: `.env.example`, migrations não commitadas de outras tarefas).
  - Executar preflight de fronteiras (`npm run check:boundaries`), tipos (`npm run typecheck`), lint (`npm run lint`) e rastreabilidade (`npm run spec:check`).
- **Arquivos:** nenhum modificado.

### Fase 2: Auditoria de critérios da SPEC vs implementação
- **Responsável:** Orquestrador (`google/gemini-3.8-flash`).
- **Ações:**
  - Confrontar critérios 1 a 10 da SPEC com o código e testes existentes:
    - Critérios 1-2: Fontes reais e detecção idempotente (`closure-reconciliation.service.ts` e `closure-reconciliation.service.test.ts`).
    - Critérios 3-4: Tratamento, motivo obrigatório e exceções justificadas segregadas.
    - Critérios 5-6: Assinaturas mínimas, bloqueios de submissão, prontidão e encerramento.
    - Critério 7: Concorrência com verificação de `expectedUpdatedAt` e lock transacional.
    - Critério 8: Frontend (6 rotas, painel, lista, detalhe, exceções, histórico, acessibilidade, loading/erro/vazio).
    - Critério 9: Isolamento de plugins e fronteiras de workspace (`npm run check:boundaries`).
    - Critério 10: Cobertura unitária de regras, serviço e RBAC do controller (80 testes aprovados).
- **Arquivos:**
  - `plugins/operations/closure-reconciliation/src/server/closure-rules.ts`
  - `plugins/operations/closure-reconciliation/src/server/closure-reconciliation.service.ts`
  - `plugins/operations/closure-reconciliation/src/server/closure-reconciliation.controller.ts`
  - Telas e componentes em `plugins/operations/closure-reconciliation/src/client/`

### Fase 3: Criação de suíte E2E / Integração de fluxo
- **Responsável:** Papel de Especificador/Testes (`google/gemini-3.8-flash` como modelo executor real disponível).
- **Ações:**
  - Criar teste de fluxo em `tests/e2e/flows/closure-reconciliation.spec.ts` validando ciclo de vida: abertura → detecção → tratamento/exceção → assinaturas mínimas → submissão → encerramento via API pública.
  - Verificar compatibilidade com Playwright sem quebrar timeouts.
- **Arquivos:**
  - `tests/e2e/flows/closure-reconciliation.spec.ts`

### Fase 4: Atualização normativa e registro de evidências
- **Responsável:** Especificador / Commitador (`google/gemini-3.8-flash`).
- **Ações:**
  - Se todos os critérios forem comprovados com evidências de teste, atualizar a SPEC para `implemented` em `SPEC/2026-11-18-conciliacao-encerramento-pleito.md`.
  - Executar suite completa (`vitest`, `check:boundaries`, `typecheck`, `lint`).
  - Redigir relatório e handoff com `SPEC COMPLIANCE: PASS`.

## Critérios de aceite

1. 80 testes unitários de regras, serviço e controller permanecem 100% verdes.
2. `npm run check:boundaries`, `npm run typecheck` e `npm run lint` executam sem erros.
3. Fluxo de ponta a ponta coberto em testes e validado contra a API pública.
4. Nenhuma fronteira entre plugins violada.
5. Preservação estrita de arquivos alheios no repositório.

## Riscos e mitigações

| Risco | Classificação | Mitigação |
| --- | --- | --- |
| Teardown Playwright travar no Windows | RELATED_NON_BLOCKING | Isolar execução ou rodar testes focados via vitest / helpers diretos se infra local de browser apresentar travamento |
| Migrations locais de outros fluxos pendentes | OUT_OF_SCOPE | Não incluir arquivos de migrations não relacionadas no staging |
| Concorrência real com banco compartilhado | RELATED_NON_BLOCKING | Validação unitária com lock transacional e teste de versão já comprovam a guarda transacional |

## Gatilhos Go / No-Go

- **GO:** Validações de limites, tipos, lint e testes aprovadas sem regressão; critérios de aceitação comprovados.
- **NO-GO:** Falha em qualquer validação obrigatória ou regressão nas 38 fronteiras de workspace.
