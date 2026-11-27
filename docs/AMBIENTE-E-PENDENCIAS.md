# Ambiente e pendências — develop

Inspeção em 2026-11-25, commit `bd29ba0`. Documento descritivo; não é SPEC nem aprovação de critérios funcionais. Papel desta sessão: especificação/documentação; modelo não exposto com precisão (`codex/model-unavailable`).

## Diagnóstico local

- Node `v24.18.0` disponível; satisfaz `engines.node >=22.22.3`. O README recomenda Node 22.23.3 no Windows.
- npm e cliente Docker disponíveis; não foi possível acessar o engine Docker pelo pipe local. A consulta também recebeu acesso negado à configuração do Docker no sandbox. Confirmar Docker Desktop em execução em terminal local.
- `.env` já existe: preservar e editar localmente, sem publicar seu conteúdo. `.env.example` já tinha alteração anterior à sessão.
- Ausentes os links de `@eops/plugin-polling-place-inspections` e `@eops/plugin-closure-reconciliation` em `node_modules`, embora ambos estejam declarados nos apps.
- Prisma Client local sem os tipos/enums dos dois domínios novos. É uma evidência de geração local desatualizada; ainda não comprova que atualizar o ambiente resolverá todas as falhas.
- Há uma migration local não versionada em `packages/database/prisma/migrations/20261105150127/migration.sql` e `migration_lock.toml` também não versionado. Revisar origem e SQL antes de aplicar migrations. Não foram alterados nesta sessão.

## Preparação em PowerShell

Executar na raiz, na branch `develop`. Os comandos abaixo são instruções, não execuções concluídas nesta sessão.

1. Abrir Docker Desktop e confirmar o engine:

```powershell
node --version
npm.cmd --version
docker info
```

2. Preservar `.env` existente. Somente se ele não existir:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

Para o PostgreSQL do Compose, usar localmente a URL de desenvolvimento de `.env.example`, compatível com o serviço `postgres` do `docker-compose.yml`. Definir `JWT_SECRET` próprio e senha de demonstração em `DEMO_ADMIN_PASSWORD`. `.env` não é versionado. Confirmar que a porta 5432 está livre; ajustar porta e URL juntas se necessário.

3. Reinstalar exatamente as dependências do lockfile e regenerar o cliente:

```powershell
npm.cmd ci
npm.cmd run db:generate
```

`npm ci` recria `node_modules` e os links dos workspaces. O postinstall já gera o Prisma Client; a geração explícita ajuda a verificar esta falha local. Não é necessário atualizar versões ou alterar o lockfile.

4. Depois de revisar a migration não versionada e confirmar o alvo de desenvolvimento, subir banco e aplicar o histórico existente:

```powershell
docker compose up -d postgres
docker compose ps
npx.cmd prisma migrate status --schema packages/database/prisma/schema.prisma
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
```

`migrate status` pode sinalizar migrations pendentes antes do deploy. Em banco novo de desenvolvimento isso é esperado. Para inicialização, usar `migrate deploy`, que aplica migrations existentes; `db:migrate` é o fluxo de desenvolvimento que pode criar migrations e solicitar reset. Não usar `db push` ou reset para contornar divergências.

Com PostgreSQL existente ou Neon, configurar `DATABASE_URL` para esse alvo e dispensar o Compose. A geração do cliente não comprova que o banco está migrado. Validar primeiro o histórico e consultar `docs/database/NEON.md` se houver divergência.

5. Conferir e iniciar:

```powershell
npm.cmd run db:validate
npm.cmd run check:boundaries
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Frontend: `http://localhost:5173`; health check: `http://localhost:3001/api/health`. Entrar com `admin@eops.local` e a senha definida em `DEMO_ADMIN_PASSWORD`.

6. Em outro terminal, para validar navegador, com banco de testes/demonstração migrado e semeado:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npx.cmd playwright install chromium
npm.cmd run e2e
```

Os E2E criam dados via API; usar banco reservado para testes/demonstração. O repositório registra instabilidade em fluxos longos contra banco remoto. A CI já configura PostgreSQL local ao job, mas dispara em PRs para `main`, pushes de `main` ou manualmente; push simples em `develop` não dispara esse workflow.

## O que falta nas SPECs

Não há inventário confiável que permita chamar toda SPEC `proposed` de não implementada. Esta inspeção não auditou todos os critérios de aceite de todas as SPECs. Há evidências concretas de código para as entregas recentes, mas validação operacional pendente:

| SPEC | Evidência de implementação | Pendência verificável |
| --- | --- | --- |
| `2026-11-17-operacao-campo-offline.md` | `354d1bd`; fluxos e fila com testes focados registrados | API/PostgreSQL reais e E2E; status ainda `proposed` |
| `2026-11-17-vistoria-acessibilidade-locais.md` | `f1dd015`; plugin registrado na web e API | Aplicação da migration, constraints e fluxo E2E; status ainda `proposed` |
| `2026-11-18-conciliacao-encerramento-pleito.md` | `23fbe5c`; plugin registrado e testes existentes | Integração real e E2E previstos como pendentes; status `approved` |
| `2026-10-01-reports-bi.md` e contrato público de relatórios | `98d2a79` registra exportações de visões salvas em CSV/PDF | Validar exportações no fluxo completo com dados reais |
| `2026-10-20-agent-verification-loop.md` | `loop/ESTADO.md` registra `PASSOU`, com aprovação humana na segunda iteração | Não tratar checkboxes históricos não marcados como ausência de execução |
| `2026-10-05-platform-administration-work-improvements.md` | `49fd82e` para tarefas, `a3130e2` para preparação; suítes de roles existem | Estado `proposed` não reconciliado; falta auditoria critério a critério para afirmar implementação integral |

A SPEC antiga de baseline (`2026-11-17-loc-baseline-and-new-line-tracking.md`) está `superseded`: não é backlog funcional. A decisão de LOC desta sessão está no README/AGENTS, por orientação explícita do usuário, sem nova SPEC.

## Evidências executadas nesta conversa

| Comando | Resultado |
| --- | --- |
| `npm run spec:check` | PASS para o HEAD anterior às alterações documentais, um commit verificado |
| `npm run check:boundaries` | PASS, 38 workspaces |
| `npm run lint` | PASS |
| `npm run typecheck` | FAIL: API não resolve os dois plugins novos; etapa web não executada |
| `npm test` | FAIL: 75 arquivos passaram, 3 falharam ao carregar; 703 testes executados passaram |
| `npm run build` | FAIL na API, 159 erros envolvendo módulos e tipos do Prisma; build web não executado |
| Integração real, migrations e E2E | Não executados |
| cloc no recorte | Não executado: cloc indisponível |

As três suítes que falharam são `closure-rules.test.ts`, `closure-reconciliation.service.test.ts` e `polling-place-inspections.service.test.ts`, por enums do Prisma indisponíveis. O registro anterior de 789 testes aprovados não substitui este resultado local.

Prioridade: regularizar dependências/Prisma, repetir verificações, validar migrations em banco reservado, executar fluxos E2E e reconciliar status/aceites das SPECs com essas evidências. Publicação, URL pública no README e comprovação de LOC no novo recorte continuam pendentes.

## Reavaliação após a entrega offline — 2026-11-25

O diagnóstico acima preserva o estado inicial da conversa. Na retomada, os links e o Prisma Client já estavam disponíveis; typecheck, lint, schema, fronteiras e build passaram. A suíte global passou com **822 testes em 78 arquivos**. A SPEC offline passou a `implemented`, com **13 E2E aprovados em 26,3 segundos** contra um schema novo com apenas as 27 migrations versionadas. Os serviços e o banco temporário foram encerrados, sem alterar o banco original ou `.env`.

O cloc oficial foi obtido e verificado; o resultado real do recorte está em `docs/metrics/LOC-ap2.md`. A validação operacional de vistorias/conciliação, a publicação e a execução da suíte E2E global continuam tarefas próprias. O sucesso do recorte offline não encerra essas pendências.
