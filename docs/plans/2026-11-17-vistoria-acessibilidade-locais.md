# Plano — Vistoria e acessibilidade dos locais

**Data:** 2026-11-17
**Papel/modelo da fase atual:** Orquestrador — `openai/gpt-6-astra`
**SPEC Gate:** `NEW_SPEC` — `SPEC/2026-11-17-vistoria-acessibilidade-locais.md`

## Objetivo e condição de início

Entregar um plugin autônomo para vistoria de locais, cobrindo acesso, energia, conectividade, sinalização, infraestrutura, evidências, responsáveis e pendências impeditivas. Nenhuma implementação pode começar antes de a SPEC ser revisada e commitada isoladamente com autorização explícita do usuário.

O pedido de ampliar LOC será atendido apenas por profundidade funcional legítima: domínio completo, validações, UI, API, persistência, histórico, eventos e testes. Não criar código morto, duplicado, artificial ou substituto de bibliotecas aprovadas.

## Preflight

| Condição | Classificação | Decisão |
|---|---|---|
| Working tree contém alterações de operação offline, relatórios, métricas e documentos globais | `BLOCKS_CURRENT_TASK` para commit/implementação não isolados | Preservar; o commit da SPEC, se autorizado, deve conter somente o arquivo normativo novo. Antes de implementar, confirmar estratégia segura para não misturar mudanças. |
| Ausência de SPEC para o novo domínio | `BLOCKS_CURRENT_TASK` | SPEC criada nesta fase; aguardar revisão e autorização explícita do commit. |
| Pedido de maximizar LOC/reimplementar bibliotecas | `RELATED_NON_BLOCKING` | Aplicar política do repositório: código de domínio próprio e completo, sem inflação nem reinvenção genérica. |
| Mudanças pendentes de outras tarefas falham ou limitam validação global | `OUT_OF_SCOPE`, salvo se impedirem os comandos desta entrega | Registrar resultados reais e nunca corrigir `reports`/offline incidentalmente. |

## Fases

### 1. SPEC e rastreabilidade

- revisar `SPEC/2026-11-17-vistoria-acessibilidade-locais.md` com o usuário;
- obter autorização explícita para `git add`/`git commit` apenas da SPEC;
- revisar status, diff staged, credenciais e trailers;
- commit sugerido: `docs(spec): define vistoria e acessibilidade dos locais`.

**No-go:** SPEC sem aprovação/commit, staging contaminado ou conflito material de requisitos.

### 2. Descoberta e desenho técnico

Arquivos/domínios:

- `plugins/operations/polling-places` para referências estruturais de local;
- `plugins/operations/documents-evidence` apenas para contrato público de vínculos/deep links;
- um plugin estrutural semelhante, preferencialmente `preparation-checklists`, para padrão de backend/UI;
- `packages/database/prisma/schema.prisma` e nova migration;
- `packages/security/src/permissions.ts`, `packages/event-bus/src/contracts.ts` e composição em API/web.

Saídas:

- entidades/constraints finais;
- catálogo inicial versionado;
- contratos REST, eventos e permissões;
- estratégia de seed e referência a usuários/locais.

### 3. Persistência e backend

- criar workspace/plugin e entrypoints públicos;
- implementar models, migration e seed idempotente;
- implementar DTOs, controller, services e regras de lifecycle;
- implementar cálculo de progresso/aptidão, conflitos otimistas, histórico e eventos;
- aplicar guards/permissões e leituras cross-domain com `select` explícito.

### 4. Frontend

- manifest, rotas e service público;
- dashboard, listagem, criação, execução guiada, achados e histórico;
- filtros, empty/error/loading, responsividade e acessibilidade;
- deep links para evidências e tarefas sem imports entre plugins;
- CSS Modules próprios e primitives já existentes em `@eops/ui`.

### 5. Testes

**Dono previsto:** papel Especificador/commitador/testes com modelo real disponível na execução; se a ferramenta não permitir fixar o modelo normativo, registrar a limitação.

- testes unitários de domínio;
- testes de service/controller e persistência quando possível;
- E2E do fluxo crítico;
- regressões de fronteiras, permissões e contratos.

### 6. Validação e entrega

Executar:

```text
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e
npm run loc:total
```

Revisar status/diff, excluir artefatos, reconciliar execution issues e entregar `SPEC COMPLIANCE`. Não commitar implementação nem fazer push sem autorização explícita posterior.

## Critérios go/no-go

**Go:** SPEC previamente commitada; working tree isolável; ownership de evidências/tarefas preservado; schema e permissões aprovados; testes críticos executáveis.

**No-go:** necessidade de escrever em tabelas de outro plugin, falta de autorização da SPEC, staging contaminado, requisito que transforme a vistoria em laudo profissional, ou impossibilidade de proteger histórico/RBAC.

## Riscos

- sobreposição com `preparation-checklists`: mitigar mantendo vistoria como diagnóstico formal e checklist como preparação operacional;
- evidência duplicada: armazenar apenas vínculo, mantendo arquivo no plugin proprietário;
- aptidão inconsistente: cálculo no backend e bloqueio por impeditivo aberto;
- catálogo evolutivo: snapshot por vistoria;
- working tree concorrente: staging estritamente seletivo e revisão antes de qualquer commit;
- volume funcional: entregar por fases coerentes, sem sacrificar validação para aumentar LOC.

## Resultado da execução

- SPEC commitada previamente em `edad0ac`.
- Plugin, schema, migration, seed, RBAC, eventos, API e frontend implementados.
- Testes adicionados pelo papel de testes: 14 casos focados aprovados.
- `spec:check`, fronteiras, typecheck, lint, build de API e build web aprovados.
- Suíte global passou com 789 testes em 78 arquivos após configurar decorators no plugin `reports`, sem alterar a cobertura.
- Schema Prisma validado estaticamente; migration e E2E aguardam banco PostgreSQL descartável.
- Executor principal de subagente ficou indisponível por créditos; executor alternativo não expôs modelo real. Registrado em `docs/execution-issues/2026-11-17-vistoria-acessibilidade-locais.md`.