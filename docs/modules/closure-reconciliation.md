# Conciliação de encerramento do pleito

> Documento descritivo. O contrato normativo está em
> `SPEC/2026-11-18-conciliacao-encerramento-pleito.md`.

## Estado implementado

O plugin público `@eops/plugin-closure-reconciliation` é composto estaticamente
no backend e no frontend. Ele é owner somente da conciliação, dos itens
detectados, das exceções justificadas, das assinaturas e do histórico. Inventory
continua owner de ativos e atribuições; Routes continua owner de rotas, entregas
e comprovantes; Field Teams continua owner de equipes e despachos; Documents &
Evidence continua owner de arquivos, versões e vínculos.

A conciliação é um agregado de verificação e decisão: ela lê o estado real dos
domínios de origem, classifica pendências e bloqueia o encerramento enquanto
houver pendência impeditiva sem tratamento. Nenhuma escrita é feita nas tabelas
dos domínios de origem.

## Ciclo de vida

```text
DRAFT -> COLLECTING -> IN_REVIEW -> PENDING_EXCEPTIONS -> READY -> CLOSED
   +----------+-------------+--------------+---------------+
                            +-------------------------------> CANCELLED

READY | CLOSED | IN_REVIEW | PENDING_EXCEPTIONS -> COLLECTING (reabertura)
```

- no máximo uma conciliação ativa por pleito e escopo (zona opcional);
- submissão exige detecção registrada, zero pendência impeditiva aberta e as
  assinaturas obrigatórias de liderança de operações e logística;
- quando há exceção registrada, a submissão leva a conciliação para
  `PENDING_EXCEPTIONS` até a aprovação segregada;
- `READY` exige exceções aprovadas ou revogadas, nenhuma exceção aprovada
  vencida e pendência impeditiva zerada;
- encerramento exige `READY`, motivo textual e usuário distinto de todos os
  aprovadores das exceções aceitas;
- cancelamento e reabertura exigem motivo e preservam todo o histórico.

## Detecção

A varredura é idempotente e cobre quatro categorias:

| Categoria | Origem | Impeditivo |
| --- | --- | --- |
| `ASSET_RETURN` | `AssetAssignment` sem `endedAt`/`returnedAt` | sim |
| `DELIVERY` | `Delivery` em `PENDING`, `IN_TRANSIT` ou `FAILED` | sim |
| `DISPATCH` | `FieldDispatch` fora de `COMPLETED`, `REJECTED`, `CANCELLED` | sim |
| `EVIDENCE` | entrega `DELIVERED` sem comprovante e devolução com problema sem evidência | não |

Regras:

- a chave do item é `(reconciliationId, categoria, tipo de origem, id de
  origem)`;
- a varredura atualiza rótulo, severidade, detalhe, prazo e `lastSeenAt`;
- item `PENDING` cuja origem desapareceu passa a `RESOLVED` com nota automática;
- item `EXCEPTION`, `ACCEPTED` ou `DISMISSED` só muda por decisão explícita do
  operador;
- item `RESOLVED` que reaparece volta a `PENDING`;
- ativo perdido é `CRITICAL`; prazo vencido escala para `HIGH`; entrega falha é
  `HIGH`; despacho em campo é `HIGH`.

## Exceções justificadas

- justificativa mínima de 20 caracteres, risco `LOW | MEDIUM | HIGH`, mitigação
  e validade opcionais;
- exceção vinculada move o item para `EXCEPTION`; aprovação move para
  `ACCEPTED`;
- aprovação exige usuário diferente de quem registrou;
- revogação exige motivo e devolve o item para `PENDING`;
- exceção aprovada com validade vencida bloqueia `READY` e o encerramento.

## Prontidão

- peso por severidade: `CRITICAL = 4`, `HIGH = 3`, `MEDIUM = 2`, `LOW = 1`;
- item tratado não penaliza; exceção aprovada ou registrada penaliza 40% do peso;
- assinaturas obrigatórias ausentes descontam 10 pontos cada; recomendadas
  (`FIELD`, `AUDIT`) descontam 5 cada;
- o cálculo é do backend (`closure-rules.ts`) e alimenta painel, detalhe e
  testes; o frontend não mantém fonte alternativa.

## API

```http
GET    /closure-reconciliation/dashboard
GET    /closure-reconciliation/references
GET    /closure-reconciliation/rules
GET    /closure-reconciliation
POST   /closure-reconciliation
GET    /closure-reconciliation/:id
PATCH  /closure-reconciliation/:id
GET    /closure-reconciliation/:id/history
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
```

Toda mutação do agregado envia `expectedUpdatedAt`; divergência resulta em
`409` e exige recarregar antes de continuar.

## Interface

- `/closure-reconciliation` — painel com prontidão, contagens por categoria e
  severidade e conciliações que exigem decisão;
- `/closure-reconciliation/list` — listagem filtrável por pleito e estado;
- `/closure-reconciliation/new` — abertura por pleito e zona opcional;
- `/closure-reconciliation/:id` — resumo, itens filtráveis, exceções,
  assinaturas, ações de transição e histórico recente;
- `/closure-reconciliation/:id/exceptions` — registro e decisão de exceções;
- `/closure-reconciliation/:id/history` — linha do tempo auditável.

## RBAC

Permissões: `closure-reconciliation.read`, `.create`, `.refresh`, `.manage`,
`.exceptions`, `.approve` e `.close`. A autorização é feita no backend; o
frontend apresenta os estados aplicáveis e as respostas recebidas da API.

O seed usa `PLATFORM_PERMISSION_KEYS` para persistir o catálogo; novas chaves
são incluídas ao executar o seed com o package `@eops/security` compilado. A
conciliação não altera os papéis de usuário dos demais domínios.

## Eventos

`closure_reconciliation.created`, `.refreshed`, `.exception_registered`,
`.submitted`, `.approved`, `.closed` e `.reopened`. O catálogo de notificações
exige `closure-reconciliation.read` para observá-los.

## Persistência

Modelos Prisma: `ClosureReconciliation`, `ClosureReconciliationItem`,
`ClosureReconciliationException`, `ClosureReconciliationSignoff` e
`ClosureReconciliationHistory`. A migration está em
`packages/database/prisma/migrations/202611180001_closure_reconciliation`.

## Testes

- `closure-rules.test.ts` — pesos, prontidão, bloqueios e escalonamento;
- `closure-reconciliation.service.test.ts` — criação, detecção idempotente,
  reabertura, exceções, segregação de aprovação e transições;
- `closure-reconciliation.controller.test.ts` — RBAC por rota e encaminhamento
  do ator autenticado.

Integração com banco real e E2E permanecem pendentes de infraestrutura
determinística.

## Verificação operacional com banco de teste

Este roteiro descreve a validação ainda pendente; não é evidência de execução.

1. Configurar `DATABASE_URL` para o banco de teste e aplicar as migrations com
   `npx prisma migrate deploy --schema packages/database/prisma/schema.prisma`.
2. Executar `npm run db:generate` e preparar usuários com as permissões da
   conciliação. O registrador e o aprovador de exceções devem ser distintos.
3. Preparar um pleito com atribuição de ativo aberta, entrega pendente, despacho
   aberto e entrega concluída sem comprovante. Abrir uma conciliação e executar
   a detecção; conferir as quatro categorias e os IDs das origens.
4. Repetir a detecção e conferir que a quantidade de itens não aumenta por
   duplicação. Resolver uma origem no domínio proprietário e detectar novamente.
5. Registrar exceção justificada em um impeditivo e aprová-la com outro usuário.
   Registrar as assinaturas de liderança e logística. Submeter e aprovar a
   conciliação com usuário distinto do submitente.
6. Encerrar com motivo textual e usuário distinto dos aprovadores de exceções.
   Conferir histórico, estado final, evento emitido e ausência de escrita nas
   fontes de inventário, entregas, despachos e evidências.
7. Reabrir com motivo, recarregar e conferir a preservação dos registros de
   decisão anteriores. Validar também conflito entre duas versões abertas da
   mesma conciliação.
