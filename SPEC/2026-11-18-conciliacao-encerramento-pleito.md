# SPEC — Conciliação de encerramento do pleito

**Data:** 2026-11-18
**Status:** `proposed`
**SPEC Gate:** `NEW_SPEC`

## Objetivo

Disponibilizar uma conciliação operacional de encerramento por pleito: consolidar, em um único agregado auditável, ativos não devolvidos, entregas pendentes, despachos de campo abertos e evidências faltantes; permitir o registro de exceções justificadas com aprovação segregada; e exigir assinaturas de responsáveis antes do encerramento operacional do pleito.

A conciliação não substitui os domínios proprietários (`inventory`, `routes`, `field-teams`, `documents-evidence`). Ela é um agregado de verificação e decisão: lê o estado real desses domínios, classifica pendências, registra decisões formais e bloqueia o encerramento enquanto houver pendência impeditiva sem tratamento.

## Ownership e fronteiras

- Criar o plugin autônomo `plugins/operations/closure-reconciliation`, package `@eops/plugin-closure-reconciliation`, rotas web sob `/closure-reconciliation` e API sob `/closure-reconciliation`.
- O plugin é proprietário da conciliação, dos itens detectados, das exceções registradas, das assinaturas e do histórico.
- `inventory` continua proprietário de ativos, atribuições e devoluções; `routes` continua proprietário de rotas, entregas e comprovantes; `field-teams` continua proprietário de equipes e despachos; `documents-evidence` continua proprietário dos arquivos, versões e vínculos.
- Leituras cross-domain usam Prisma somente-leitura com `select` explícito, IDs persistidos ou API pública. Nenhum plugin importa `src/` de outro workspace nem escreve em tabela alheia.
- Nenhuma correção de domínio é feita pela conciliação: ativo, entrega, despacho ou evidência só muda de estado no plugin proprietário.

## Vocabulário e modelo operacional

- **conciliação:** agregado único por pleito (e, opcionalmente, por zona) que consolida pendências de encerramento.
- **item detectado:** pendência concreta derivada de uma fonte real, identificada por `categoria + tipo de origem + id de origem`.
- **pendência impeditiva:** item que impede encerramento enquanto não for resolvido, dispensado com justificativa ou aceito como exceção aprovada.
- **exceção justificada:** decisão formal de conviver com uma pendência, com justificativa, mitigação, risco, prazo de validade e aprovação por usuário diferente de quem registrou.
- **assinatura (signoff):** declaração de um responsável por papel operacional de que revisou a conciliação.
- **prontidão:** indicador derivado 0–100 de quão próximo o pleito está de poder ser encerrado; nunca substitui a regra de bloqueio.
- **detecção:** varredura idempotente das fontes reais que cria, mantém e encerra itens sem duplicar registros.

## Ciclo de vida

Estados persistidos:

```text
DRAFT → COLLECTING → IN_REVIEW → PENDING_EXCEPTIONS → READY → CLOSED
   └──────────────┴──────────────┴───────────────────→ CANCELLED

READY | CLOSED | IN_REVIEW → COLLECTING (reabertura motivada)
```

Regras:

1. Cada pleito possui no máximo uma conciliação ativa (não `CANCELLED` e não `CLOSED`); encerrada a anterior, uma nova pode ser aberta para reconciliação complementar.
2. `DRAFT` não aceita submissão; `COLLECTING` é o estado de detecção e tratamento.
3. Toda conciliação exige ao menos uma detecção (`lastRefreshedAt`) antes de submissão.
4. `IN_REVIEW` é alcançado pela submissão e exige zero pendência impeditiva aberta e as assinaturas mínimas.
5. `PENDING_EXCEPTIONS` representa conciliação com exceções registradas e ainda não aprovadas; não pode ser encerrada.
6. `READY` exige todas as exceções registradas aprovadas ou revogadas, nenhuma exceção aprovada vencida e pendência impeditiva zerada.
7. `CLOSED` exige `READY`, motivo/observação de encerramento e usuário distinto de quem registrou a última exceção aceita quando houver exceção aceita.
8. `CANCELLED` exige motivo e preserva todos os itens, exceções, assinaturas e histórico.
9. Reabertura exige motivo, volta para `COLLECTING` e preserva decisões anteriores no histórico.

## Detecção de pendências

A varredura é idempotente e cobre quatro categorias:

### 1. `ASSET_RETURN` — ativos não devolvidos

- Origem: atribuição de ativo (`AssetAssignment`) sem `endedAt`/`returnedAt`.
- Severidade: `HIGH` quando `expectedReturnAt` já venceu, `CRITICAL` quando o ativo está `LOST`, `MEDIUM` nos demais casos.
- Impeditivo por padrão.
- Rótulo de referência inclui etiqueta do ativo, nome do ativo, destino e responsável nominal quando existir.
- Concluir a devolução no domínio de inventário encerra o item na próxima detecção.

### 2. `DELIVERY` — entregas pendentes

- Origem: entrega (`Delivery`) em `PENDING`, `IN_TRANSIT` ou `FAILED` de rota do pleito.
- Severidade: `HIGH` para `FAILED`, `MEDIUM` para `PENDING`/`IN_TRANSIT`.
- Impeditivo por padrão; entrega `RETURNED` ou `DELIVERED` encerra o item.

### 3. `DISPATCH` — despachos abertos

- Origem: despacho de campo (`FieldDispatch`) fora de `COMPLETED`, `REJECTED` e `CANCELLED`.
- Severidade: `HIGH` quando o despacho está em `IN_PROGRESS`/`ARRIVED` sem conclusão, `MEDIUM` nos estados iniciais.
- Impeditivo por padrão.

### 4. `EVIDENCE` — evidências faltantes

- Origem A: entrega `DELIVERED` sem `proofUrl` e sem vínculo de evidência do tipo `DELIVERY`.
- Origem B: atribuição de ativo encerrada com `problemDetected = true` sem vínculo de evidência do tipo `ASSET` para o ativo.
- Severidade: `MEDIUM` nas duas origens; não impeditivo por si só, mas entra no cálculo de prontidão.
- A conciliação não cria evidência: apenas aponta a ausência e aceita exceção justificada.

Regras da detecção:

1. Item é identificado por `(reconciliationId, category, sourceType, sourceId)`; a varredura faz upsert e atualiza rótulo, severidade, detalhe e `lastSeenAt`.
2. Item previamente `PENDING` cuja origem não é mais detectada passa a `RESOLVED` com nota automática e autor nulo (`system`), sem apagar o registro.
3. Item `EXCEPTION`, `ACCEPTED` ou `DISMISSED` não é reaberto por detecção; a única saída é decisão explícita do operador.
4. Um item `PENDING` que reaparece após ter sido `RESOLVED` volta a `PENDING` e registra histórico.
5. A varredura nunca apaga itens e nunca altera dados dos domínios de origem.
6. A varredura recalcula contadores e prontidão no mesmo agregado.

## Exceções justificadas

- Registrar exceção exige justificativa mínima de 20 caracteres, risco `LOW | MEDIUM | HIGH`, mitigação opcional, validade opcional e vínculo com um item ou com uma categoria.
- Exceção vinculada a item move o item para `EXCEPTION`; ao ser aprovada, o item passa a `ACCEPTED`.
- Aprovação exige usuário diferente de quem registrou a exceção e resulta em `ACCEPTED`, com `approvedById` e `approvedAt`.
- Revogação exige motivo, registra `REVOKED` e devolve o item para `PENDING`.
- Exceção `ACCEPTED` com `validUntil` vencida é considerada vencida na avaliação de prontidão e bloqueia `READY`.
- Exceção não pode ser registrada em conciliação `CLOSED` ou `CANCELLED`.
- Toda exceção é imutável quanto a autoria: troca de decisão gera novo estado histórico, nunca reescrita silenciosa.
- A conciliação mantém contagem de exceções registradas, aceitas e vencidas.

## Assinaturas (signoff)

- Papéis: `OPERATIONS_LEAD`, `LOGISTICS`, `FIELD`, `AUDIT`.
- Submissão exige no mínimo `OPERATIONS_LEAD` e `LOGISTICS`; `FIELD` e `AUDIT` são recomendados e entram na prontidão.
- Assinatura é única por `(conciliação, papel, usuário)` e guarda `userNameSnapshot` e declaração textual.
- Remover assinatura é permitido apenas antes da submissão e gera histórico.
- A interface mostra papéis ausentes de forma explícita antes do envio.

## Prontidão e bloqueio

- Peso por severidade: `CRITICAL = 4`, `HIGH = 3`, `MEDIUM = 2`, `LOW = 1`.
- Item `RESOLVED`/`DISMISSED` não penaliza; item `EXCEPTION`/`ACCEPTED` penaliza 40% do peso (risco residual); `PENDING` penaliza integralmente.
- `readinessScore = max(0, 100 - round(100 * penalidade / max(1, pesoTotal)))`, onde `pesoTotal` considera todos os itens detectados.
- Assinaturas ausentes de `OPERATIONS_LEAD`/`LOGISTICS` reduzem 10 pontos cada; ausência de `AUDIT` reduz 5.
- O cálculo vive no backend (`src/server/closure-rules.ts`) e é reutilizado por dashboard, detalhe e testes; o frontend não recalcula como fonte de verdade.
- `blockingItems` conta apenas `PENDING` impeditivo; `readyToClose` é a conjunção de bloqueio zero, exceções sem pendência e assinaturas mínimas.

## API mínima

```http
GET    /closure-reconciliation/dashboard
GET    /closure-reconciliation/references
GET    /closure-reconciliation/rules
GET    /closure-reconciliation
POST   /closure-reconciliation
GET    /closure-reconciliation/:id
PATCH  /closure-reconciliation/:id
POST   /closure-reconciliation/:id/refresh
POST   /closure-reconciliation/:id/items/:itemId/resolve
POST   /closure-reconciliation/:id/items/:itemId/dismiss
POST   /closure-reconciliation/:id/items/:itemId/reopen
POST   /closure-reconciliation/:id/exceptions
POST   /closure-reconciliation/:id/exceptions/:exceptionId/accept
POST   /closure-reconciliation/:id/exceptions/:exceptionId/revoke
POST   /closure-reconciliation/:id/signoffs
DELETE /closure-reconciliation/:id/signoffs/:signoffId
POST   /closure-reconciliation/:id/submit
POST   /closure-reconciliation/:id/approve
POST   /closure-reconciliation/:id/close
POST   /closure-reconciliation/:id/reopen
POST   /closure-reconciliation/:id/cancel
GET    /closure-reconciliation/:id/history
```

Regras de contrato:

- DTOs validam enums, limites de texto, datas e campos obrigatórios; campos desconhecidos são rejeitados pela configuração global.
- Toda mutação de agregado envia `expectedUpdatedAt` e resposta divergente resulta em `409`.
- Listagens aceitam filtros por pleito, zona, estado, categoria, severidade, impeditivo e período.
- Erros usam mensagens em português, sem expor detalhe interno.

## Interface

Rotas:

```text
/closure-reconciliation                     painel de conciliações
/closure-reconciliation/list                listagem com filtros
/closure-reconciliation/new                 abertura de conciliação
/closure-reconciliation/:id                 conciliação, itens e ações
/closure-reconciliation/:id/exceptions      exceções justificadas
/closure-reconciliation/:id/history         histórico auditável
```

Requisitos:

- painel com prontidão, contagens por categoria, pendências impeditivas, exceções pendentes e conciliações que exigem decisão;
- listagem escaneável por pleito, zona, estado, prontidão e atualização;
- detalhe com resumo, itens filtráveis por categoria/severidade/estado, ações de resolver/dispensar/reabrir e formulário de exceção;
- exceções com justificativa, risco, mitigação, validade e aprovação segregada visível;
- assinaturas com papéis, quem assinou e o que falta;
- histórico com ação, autor, data, transição e resumo;
- estados de carregamento, erro, vazio e ausência de permissão explícitos;
- acessibilidade: foco visível, rótulos textuais, não depender apenas de cor, navegação por teclado;
- CSS específico em CSS Module do plugin; o shell recebe apenas o manifest.

## RBAC

Adicionar permissões:

```text
closure-reconciliation.read
closure-reconciliation.create
closure-reconciliation.refresh
closure-reconciliation.manage
closure-reconciliation.exceptions
closure-reconciliation.approve
closure-reconciliation.close
```

Leitura, criação, detecção, gestão de itens, registro de exceção, aprovação de exceção e encerramento são autorizados no backend. O runtime decide por permissão, nunca por nome de papel.

## Persistência

O schema deve representar:

- conciliação com pleito, zona opcional, estado, contadores, prontidão, marcos de tempo e autores;
- itens detectados com categoria, origem, rótulo, severidade, impeditivo, estado, payload e detecção;
- exceções com justificativa, risco, mitigação, validade, registro, aprovação e revogação;
- assinaturas por papel e usuário;
- histórico operacional.

Constraints:

- `code` único por conciliação;
- `(reconciliationId, category, sourceType, sourceId)` único para item;
- `(reconciliationId, role, userId)` único para assinatura;
- índices por pleito/estado, categoria/severidade e status/validade.

## Critérios de aceite

1. Usuário autorizado abre conciliação para um pleito e dispara detecção; itens reais de ativos, entregas, despachos e evidências aparecem com origem rastreável.
2. Detecção repetida não duplica itens; item cuja origem deixou de existir é resolvido automaticamente; item tratado não é reaberto sem ação explícita.
3. Resolver, dispensar e reabrir item exigem motivo e registram histórico com ator e data.
4. Exceção justificada exige justificativa, risco e aprovação por usuário diferente; exceção vencida bloqueia encerramento.
5. Submissão bloqueia com pendência impeditiva aberta ou assinaturas mínimas ausentes; mensagem identifica o que falta.
6. Encerramento exige `READY`, registro de motivo e ausência de exceção vencida; estado final preserva tudo que foi decidido.
7. Concorrência não sobrescreve atualização recente silenciosamente.
8. Frontend cobre painel, listagem, detalhe, exceções e histórico com loading/erro/vazio e acessibilidade por teclado.
9. Fronteiras de workspace permanecem válidas; nenhum domínio de origem é alterado pela conciliação.
10. Suítes unitárias cobrem regras puras, serviço e RBAC do controller; pendências de integração/E2E ficam registradas.

## Testes e validação

- Unitário junto ao código (`src/server/closure-rules.test.ts`): pesos, penalidade de exceção, assinaturas, bloqueio e prontidão.
- Unitário junto ao código (`src/server/closure-reconciliation.service.test.ts`): detecção idempotente, resolução automática, exceções, aprovação segregada, submissão e encerramento.
- Unitário junto ao código (`src/server/closure-reconciliation.controller.test.ts`): permissões por rota e encaminhamento do ator autenticado.
- Integração real (banco e plugins) e E2E permanecem pendentes de infraestrutura determinística; registrar em `docs/execution-issues/` quando bloquearem.
- Executar `npm run spec:check`, `npm run check:boundaries`, `npm run db:validate`, `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`; registrar exatamente o que não puder ser validado.
- Ao final, `npm run loc:total` com a medição real. Profundidade funcional é permitida; inflar contagem com código morto, duplicado ou artificial é proibido.

## Fora de escopo

- encerrar oficialmente o pleito no domínio eleitoral (`elections.status`);
- alterar ativo, entrega, despacho ou evidência a partir da conciliação;
- criar tarefa, incidente ou pedido de recurso automaticamente;
- geração de PDF, assinatura digital criptográfica ou certificação externa;
- integração com sistemas externos de prestação de contas;
- execução offline nesta versão;
- reescrever histórico ou apagar decisões anteriores.
