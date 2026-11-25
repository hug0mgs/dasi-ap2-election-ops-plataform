# Execution issues — operação de campo sem conexão

## Contexto

- Data: 2026-11-17
- Sessão: `prompts/sessoes/2026-11-17-cline-operacao-campo-offline.md`
- SPEC: `SPEC/2026-11-17-operacao-campo-offline.md`
- Escopo: captura offline de incidentes, despachos e checklists

## ISSUE-001 — instalação local incompleta

- Categoria: `ENVIRONMENT`
- Severidade: `blocking`
- Etapa: validação
- Problema: `node_modules/.bin/tsc.cmd` e `node_modules/.bin/vitest.cmd` não existem; o histórico da execução anterior também registra pacote TypeScript incompleto. `npm ci --offline --ignore-scripts --no-audit --no-fund` permaneceu em execução sem saída nem restauração dos executáveis e foi encerrado para evitar processo órfão.
- Impacto: não é possível executar typecheck, testes nem build dos três fluxos críticos; não se pode confirmar integridade de sincronização/idempotência.
- Contorno: descoberta de contratos e verificação de boundaries sem editar código de produto.
- Correção sugerida: restaurar dependências do lockfile em terminal capaz de concluir `npm ci`; confirmar os executáveis e executar validações oficiais antes de implementar/entregar mutações offline.
- Estado: `open`.

### Reavaliação em 2026-11-17

- `npm ci --ignore-scripts --no-audit --no-fund --loglevel=error` concluiu com 581 pacotes instalados; `npm run db:generate` gerou o Prisma Client v6.19.3.
- Verificados `node_modules/.bin/tsc.cmd`, `node_modules/.bin/vitest.cmd` e `node_modules/rxjs/operators`.
- `npm run typecheck` e `npm run lint` passaram; 41 testes focados de incidentes, despachos e checklists passaram.
- Estado: `resolved` para a instalação local. A suíte completa ainda falha em testes de `reports` no working tree preexistente; o build excedeu o tempo da ferramenta, sem resultado final confirmado.

## ISSUE-002 — trailer do commit inicial da SPEC

- Categoria: `SPEC_TRACEABILITY`
- Severidade: `blocking`
- Etapa: gate
- Problema: o commit `df5e43f` contém `Agent:` e `Spec:` em parágrafos separados; `npm run spec:check` reporta `expected exactly one Agent trailer, found 0`.
- Impacto: a SPEC está cronologicamente antes de qualquer código da tarefa, mas a verificação automatizada de rastreabilidade falha.
- Contorno: nenhum commit de implementação foi feito. Não reescrever histórico sem pedido específico; solução aditiva precisa ser definida antes de prosseguir.
- Estado: `open`.

### Reavaliação em 2026-11-17

- O usuário autorizou explicitamente a reescrita; `df5e43f` foi substituído por `a046b39` com trailers adjacentes e os espaços finais da SPEC foram retirados.
- `npm run spec:check` passou para `HEAD` após o amend; `git diff --cached --check` não reportou problemas antes do amend.
- Estado: `resolved`. O hash antigo é preservado neste registro somente como evidência histórica; não representa o commit atual.

## Reavaliação de validação em 2026-11-24

- Os testes focados dos três fluxos e da fila local passaram: 49 testes em 4 arquivos.
- `npm test` global passou com 789 testes em 78 arquivos; os testes de `reports` foram corrigidos pela configuração de decorators do próprio plugin, sem relaxar cobertura.
- `npm run typecheck`, `npm run lint`, `npm run check:boundaries`, `npm run build` e `npm run db:validate` passaram.
- Integração com API/PostgreSQL real e E2E continuam pendentes por ausência de infraestrutura determinística; não há evidência de execução desses cenários.