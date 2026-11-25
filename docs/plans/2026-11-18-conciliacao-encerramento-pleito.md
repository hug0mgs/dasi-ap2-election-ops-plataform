# Plano — Conciliação de encerramento do pleito

**Data:** 2026-11-18
**Papel/modelo da fase atual:** `opencode/deepseek-v4.1-flash-free` (consolidação, testes e commit) e `openai/gpt-6-astra` (retomada da implementação)
**SPEC Gate:** `NEW_SPEC` — `SPEC/2026-11-18-conciliacao-encerramento-pleito.md`

## Objetivo e condição de início

Entregar o plugin `closure-reconciliation` cobrindo detecção de ativos não devolvidos, entregas pendentes, despachos abertos e evidências faltantes; exceções justificadas com aprovação segregada; assinaturas; e encerramento operacional bloqueado enquanto houver pendência impeditiva.

O pedido de maximizar linhas de código é atendido exclusivamente por profundidade funcional legítima: domínio completo, regras, validações, API, persistência, UI, histórico, eventos, permissões e testes. Não há criação de código morto, duplicado, gerado artificialmente ou reimplementação de biblioteca aprovada.

## Preflight

| Condição | Classificação | Decisão |
|---|---|---|
| Working tree contém alterações de outra sessão (offline, relatórios, vistoria, métricas) | `BLOCKS_CURRENT_TASK` para commit isolado | Preservar integralmente; nenhum arquivo alheio é revertido ou incluído em staging. |
| Ausência de SPEC para o novo domínio | `BLOCKS_CURRENT_TASK` | SPEC criada antes da implementação. Commit depende de autorização explícita do usuário. |
| Papéis de agente definidos no `AGENTS.md` (implementação em `openai/gpt-6-astra`) | `RELATED_NON_BLOCKING` | O modelo executor desta sessão é `opencode/deepseek-v4.1-flash-free`; a divergência fica registrada no handoff, sem declarar modelo que não executou a tarefa. |
| `cloc` disponível e contagem total em 83.692 | `OUT_OF_SCOPE` | Medir ao final, sem inflar nem editar checkpoint à mão. |

## Fases

### 1. SPEC e rastreabilidade

- `SPEC/2026-11-18-conciliacao-encerramento-pleito.md` criada com ciclo de vida, detecção, exceções, prontidão, API, UI, RBAC, persistência e critérios de aceite.
- Commit sugerido (dependente de autorização): `docs(spec): define conciliação de encerramento do pleito`.

**No-go:** SPEC rejeitada pelo usuário ou conflito material de escopo.

### 2. Persistência e contratos globais

Arquivos:

- `packages/database/prisma/schema.prisma` (8 enums, 5 modelos, back-relations em `Election`/`ElectoralZone`);
- `packages/database/prisma/migrations/202611180001_closure_reconciliation/migration.sql`;
- `packages/security/src/permissions.ts` (7 permissões);
- `packages/event-bus/src/contracts.ts` (6 eventos + catálogo de notificação).

### 3. Backend do plugin

Arquivos:

- `plugins/operations/closure-reconciliation/src/server/closure-rules.ts` (regras puras);
- `.../dto/closure-reconciliation.dto.ts`;
- `.../closure-reconciliation.service.ts` (detecção, exceções, assinaturas, transições);
- `.../closure-reconciliation.controller.ts`;
- `.../closure-reconciliation.module.ts`, `.../server/index.ts`.

### 4. Frontend do plugin

Arquivos:

- `src/types.ts`, `src/manifest.ts`, `src/index.ts`;
- `src/client/services/closureReconciliationService.ts`;
- páginas: painel, listagem, abertura, detalhe, exceções, histórico;
- componentes: navegação, resumo, tabela de itens, painel de exceções, painel de assinaturas, timeline;
- `src/client/styles/closure-reconciliation.module.css`.

### 5. Composição

- `apps/api/src/app.module.ts` registra o módulo;
- `apps/web/src/pluginRegistry.ts` registra o plugin;
- `docs/modules/closure-reconciliation.md` documenta o domínio.

### 6. Testes e validação

- `closure-rules.test.ts`, `closure-reconciliation.service.test.ts`, `closure-reconciliation.controller.test.ts`;
- `npx prisma generate --schema packages/database/prisma/schema.prisma`;
- `npm run db:validate`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:boundaries`, `npm run spec:check`;
- `npm run loc:total` ao final, com medição real.

## Critérios de aceite

Os dez critérios da SPEC. Em especial: detecção idempotente e sem escrita cross-domain, exceção com aprovação segregada, bloqueio de submissão/encerramento e RBAC por rota.

## Riscos

| Risco | Mitigação |
|---|---|
| Migration não aplicada em banco local/remoto | Validar schema e gerar client; registrar pendência real se não houver banco. |
| Typecheck quebrar por enums novos não gerados | Executar `prisma generate` antes do typecheck. |
| Alterações não commitadas de outra sessão falharem validações | Registrar resultado real, sem corrigir código alheio. |
| LOC crescer por repetição | Reutilizar componentes e serviços do próprio plugin; nada de código morto. |

## Gatilhos go/no-go

- **No-go:** SPEC rejeitada, `prisma generate` indisponível, ou necessidade de alterar domínio de origem.
- **Go:** schema válido, geração de client concluída e suítes do plugin verdes.

## Retomada de 2026-11-18

- Orquestrador real: `openai/gpt-6-astra`. O registro acima descreve a sessão anterior, não a identidade desta retomada.
- SPEC Gate da retomada: `UPDATE_SPEC`, revisão normativa commitada em `64cbd7c` antes das correções restantes.
- Commit inicial da SPEC: `71ca0f2`, autorizado pelo usuário. O código parcial já existia antes; o commit não fabrica anterioridade à escrita.
- Política de commits locais atualizada por solicitação do usuário em `1ece6d4` e aplicada em `804e4c6`.
- Delegação autorizada pelas regras de orquestração: investigação funcional somente leitura concluída por subagente `openai/gpt-6-astra`.
- Modelos de referência não foram fixados nos subagentes; registrar seus modelos reais no handoff. A variante `low` não foi fixada pela ferramenta nesta retomada.

### Fases restantes

1. Implementador delegado: corrigir `closure-reconciliation.service.ts`, `closure-rules.ts` se necessário, DTOs e UI do próprio plugin, conforme a revisão normativa. Sem alterar testes, SPEC, contratos globais ou outros plugins. Usar skill `caveman`.
2. Papel de testes delegado: criar e manter testes funcionais junto ao código do plugin, cobrindo ciclo completo, paginação, códigos entre pleitos, decisões de exceções e formulários quando houver infraestrutura existente. Registrar modelo real em vez de presumir DeepSeek.
3. Orquestrador: conferir composição, dependências públicas, migration e seleção de staging somente dos trechos de conciliação em arquivos compartilhados; atualizar documentação descritiva e sessão.
   - Exceção trivial registrada: adicionar a dependência pública já importada `@eops/plugin-closure-reconciliation` em `apps/api/package.json` e `apps/web/package.json`, atualizando o lockfile pelo npm. São duas entradas declarativas de composição, sem regra de negócio.
   - Exceção mecânica registrada: alinhar o nome do índice composto da migration ainda não versionada ao SQL emitido por `prisma migrate diff`; o identificador manual excedia o limite de nomes do PostgreSQL e diferia do esperado pelo Prisma. Colunas e unicidade permanecem idênticas.
4. Executar schema validation, geração do cliente se necessária, boundaries, typecheck, lint, testes, build e medição oficial de LOC. Verificar a rastreabilidade do intervalo de commits criado.

### Execution issues preflight

| Issue | Estado inicial | Classificação |
| --- | --- | --- |
| Código parcial anterior ao commit da SPEC | open | RELATED_NON_BLOCKING, autorizado o prosseguimento pelo usuário e preservada a cronologia |
| Ambiguidades da SPEC de conciliação | open | BLOCKS_CURRENT_TASK, resolvidas pela revisão `64cbd7c` antes da implementação afetada |
| Modelo de referência dos papéis não fixado | open | RELATED_NON_BLOCKING, informar modelos reais |
| Suite global reports com falha em decorators registrada na sessão anterior | open | OUT_OF_SCOPE, revalidar e registrar sem modificar o plugin de outra tarefa |
| Alterações preexistentes de offline, BI e vistorias | open | OUT_OF_SCOPE, preservar sem staging incidental |

Go apenas com correções funcionais validadas. Falhas comprovadamente externas podem permanecer documentadas. Integração real e E2E permanecem pendentes conforme a SPEC, sem alegar execução.

### Encerramento da retomada

- Fases 1 a 5 concluídas: produto, composição, migration, testes e documentação descritiva prontos.
- Suíte do plugin: 80 testes aprovados. Typecheck, lint, boundaries, validação Prisma e build aprovados.
- A suíte global permanece parcial por falha externa de decorators em `plugins/analytics/reports`; o arquivo de teste não pertence a esta tarefa.
- Aplicação da migration em banco real, integração PostgreSQL e E2E continuam pendentes; não há evidência de execução.
- O commit da implementação é local e isolado do trabalho preexistente de offline, BI e vistorias. Push e reescrita de histórico não foram executados.
