# Plano — exportação CSV/PDF de visões salvas do BI

## Contexto

- Data: 2026-11-17
- Papel responsável pelo plano: orquestrador
- Modelo real do orquestrador (identificado pelo usuário): `cline/gpt-6-sol`
- Plugin: `plugins/analytics/reports`
- Solicitação registrada em: `prompts/sessoes/2026-11-17-cline-exportacao-views-bi.md`

## Objetivo

Permitir que um operador com `reports.export` exporte em CSV ou PDF uma `ReportSavedView` visível para ele, usando exatamente os filtros persistidos pela visão e identificando a visão no conteúdo e no nome do arquivo, sem remover a exportação ad hoc existente.

## SPEC Gate

- Classificação: `UPDATE_SPEC`
- SPEC aplicável: `SPEC/2026-10-06-platform-depth-integration.md`, Parte 2 — Reports / Operational Analytics 2.0
- Evidência: a SPEC já normatiza views salvas e exportações CSV/PDF separadamente, mas não define `viewId`, autorização de leitura da visão, precedência de parâmetros nem UX de exportação da visão.
- Gate de execução: a atualização da SPEC deve ser commitada antes da primeira alteração de código de produto.

## Preflight

- `AGENTS.md` possui alteração local preexistente da tarefa anterior e não integra o escopo desta feature.
- Nenhum execution issue existente bloqueia a tarefa.
- A divergência de modelos entre a SPEC de orquestração histórica e o `AGENTS.md` atual é `OUT_OF_SCOPE`.
- Não há necessidade prevista de migration: `ReportSavedView` já persiste `filters`, `metricsJson` e `granularity`.
- Dependências de PDF/CSV já existem (`pdfkit` e gerador CSV interno).

## Fase 1 — SPEC e rastreabilidade

Arquivos:

- `SPEC/2026-10-06-platform-depth-integration.md`
- `prompts/sessoes/2026-11-17-cline-exportacao-views-bi.md`
- `docs/plans/2026-11-17-exportacao-views-salvas-bi.md`

Entregas:

- contrato de `viewId` para CSV/PDF;
- regra de acesso: owner ou view compartilhada, além de `reports.export`;
- definição de precedência: quando `viewId` existe, filtros da view são a fonte canônica;
- compatibilidade da exportação ad hoc sem `viewId`;
- critérios de aceite e cobertura de testes.

Go/no-go:

- **GO** somente após a SPEC atualizada estar commitada em commit próprio e anterior ao código.
- **NO-GO** se não houver autorização explícita para o commit da SPEC.

Modelo/papel:

- `google/gemma-4-31b-it:free` — SPEC, testes, mensagem de commit e validação.
- Limitação atual: a ferramenta não oferece esse modelo como preset fixável; registrar o modelo real de qualquer subagente utilizado.

## Fase 2 — Backend de produto

Arquivos previstos:

- `plugins/analytics/reports/src/server/dto/analytics.dto.ts`
- `plugins/analytics/reports/src/server/reports-views.service.ts`
- `plugins/analytics/reports/src/server/reports.controller.ts`
- `plugins/analytics/reports/src/server/reports.service.ts`

Implementação:

1. Adicionar DTO de exportação que aceite `viewId` opcional e preserve filtros ad hoc atuais.
2. Expor no `ReportsViewsService` uma resolução de view legível pelo ator:
   - `404` quando inexistente;
   - `403` quando privada e pertencente a outro usuário;
   - retorno normalizado de filtros, métricas e granularidade quando acessível.
3. No controller, resolver `viewId` antes de chamar CSV/PDF.
4. Reutilizar os geradores existentes com o escopo resolvido, sem duplicar agregações.
5. Produzir nome de arquivo seguro e determinístico a partir do nome da view, com fallback atual.
6. Incluir metadados da view no cabeçalho/conteúdo exportado sem alterar o schema do banco.

Modelo/papel:

- `openai/gpt-6-astra`, variante `low`, skill `caveman` — implementador de código de produto.
- Se o modelo não puder ser fixado pela ferramenta, usar um implementador disponível e registrar a limitação no handoff; nunca declarar um modelo que não executou a fase.

## Fase 3 — Frontend de produto

Arquivos previstos:

- `plugins/analytics/reports/src/services/reportsService.ts`
- `plugins/analytics/reports/src/types/index.ts`
- `plugins/analytics/reports/src/client/pages/ReportsViewsPage.tsx`
- `plugins/analytics/reports/src/client/pages/ReportsExportPage.tsx`
- `plugins/analytics/reports/src/styles/overview.module.css` somente se necessário

Implementação:

1. Permitir exportar CSV/PDF diretamente de cada view salva quando o usuário possui `reports.export`.
2. Permitir selecionar uma view na página `/reports/export`.
3. Ao selecionar uma view, mostrar nome, owner, compartilhamento, filtros, métricas e granularidade que serão usados.
4. Desabilitar ações durante o download e exibir erro explícito.
5. Manter o fluxo ad hoc atual quando nenhuma view estiver selecionada.

Critérios de UI:

- ação principal evidente e sem controles falsos;
- sem CSS global;
- estados loading, erro e vazio explícitos;
- botões com texto acessível e foco preservado;
- layout não quebra abaixo de 900 px.

## Fase 4 — Testes

Arquivos previstos, colocados junto ao código:

- `plugins/analytics/reports/src/server/reports-views.service.test.ts`
- `plugins/analytics/reports/src/server/reports.service.test.ts`
- teste de controller/service adicional somente se necessário ao contrato HTTP
- E2E em `tests/e2e/` se a infraestrutura existente permitir cobrir RBAC e download binário sem fragilidade

Cobertura mínima:

- owner exporta view privada;
- outro usuário não exporta view privada;
- usuário com `reports.export` exporta view compartilhada;
- ausência de `reports.export` continua retornando `403` pelo guard;
- view inexistente retorna `404`;
- filtros persistidos vencem parâmetros ad hoc quando `viewId` é informado;
- CSV e PDF continuam válidos e identificam a view;
- exportação ad hoc sem `viewId` permanece compatível;
- UI envia `viewId` correto e trata erro/loading, conforme infraestrutura de teste disponível.

Modelo/papel:

- `google/gemma-4-31b-it:free` — dono da suíte e das validações.

## Fase 5 — Documentação e validação

Arquivos:

- `docs/modules/reports.md`
- `docs/metrics/LOC.md`, atualizado exclusivamente por `npm run loc:total`

Comandos:

```text
npm run spec:check -- <commit-spec>..HEAD
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e                 quando banco migrado/semeado estiver disponível
npm run loc:total
```

## Critérios de aceite

1. CSV e PDF aceitam `viewId` e usam a definição persistida da view.
2. A autorização da view é verificada no backend.
3. O usuário precisa de `reports.export`; `reports.manage` não substitui essa permissão.
4. Views compartilhadas são exportáveis por usuários autorizados; privadas, apenas pelo owner.
5. Exportação ad hoc permanece funcional.
6. UI oferece exportação a partir das views e seleção na página de exportação.
7. Nenhuma migration, dependência nova ou import cross-plugin é introduzido.
8. Testes focados e validações obrigatórias ficam verdes, ou bloqueios de infraestrutura são registrados literalmente.

## Riscos e mitigação

- **Bypass de filtros da view por query:** ignorar filtros ad hoc quando `viewId` estiver presente.
- **Vazamento de view privada:** resolver acesso no backend antes de carregar relatório.
- **Nome inseguro no header:** sanitizar slug e limitar tamanho; usar fallback fixo.
- **Datas relativas envelhecidas:** a view armazena valores literais; esta fase não introduz períodos relativos.
- **Export grande:** reutilizar agregados existentes; não adicionar dados brutos nem streaming novo nesta fase.
- **Working tree misto:** nunca incluir `AGENTS.md` no staging da feature.

## Go/no-go final

- **GO para entrega:** SPEC anterior ao código, critérios atendidos e validações verdes.
- **PARTIAL/BLOCKED:** qualquer falha de autorização, teste obrigatório, build, boundary ou ausência de infraestrutura E2E sem evidência substituta suficiente.
