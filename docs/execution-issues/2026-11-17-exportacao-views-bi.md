# Execution issues — exportação CSV/PDF de visões salvas do BI

## Contexto

- Data: 2026-11-17
- Prompt/sessão: `prompts/sessoes/2026-11-17-cline-exportacao-views-bi.md`
- SPEC: `SPEC/2026-10-06-platform-depth-integration.md`
- Agente: `cline/gpt-6-sol` (modelo identificado posteriormente pelo usuário)
- Escopo: `plugins/analytics/reports`

---

## ISSUE-001

### Categoria

ENVIRONMENT

### Severidade

non-blocking

### Etapa

validação

### Problema observado

A árvore local `node_modules` está incompleta: os shims em `node_modules/.bin` não existem, o pacote TypeScript não contém `lib/lib.es2022.d.ts`, e RxJS não contém o entrypoint `operators`. Os comandos oficiais de typecheck e teste não conseguem inicializar.

### Evidência

- `npm run typecheck` → `'tsc' não é reconhecido como um comando interno`.
- execução direta de TypeScript → `TS6053: File '.../node_modules/typescript/lib/lib.es2022.d.ts' not found`.
- execução direta de Vitest 3.2.7 → falha ao resolver `@eops/security` e `node_modules/rxjs/operators`.
- `npm ci --ignore-scripts` foi iniciado em processo separado, permaneceu sem saída/progresso verificável e foi encerrado para evitar processo órfão.

### O que era esperado

`npm ci` deve restaurar as versões do lockfile e permitir `npm run typecheck`, `npm test` e `npm run build`.

### Impacto

O código e os testes foram escritos e revisados estaticamente, mas typecheck, suíte Vitest e build não puderam ser comprovados nesta sessão. `check:boundaries`, `spec:check`, `git diff --check` e a medição LOC funcionaram.

### Contorno utilizado

Revisão manual do diff, uso dos binários parcialmente presentes para confirmar a corrupção da instalação, execução das validações independentes de dependências e cobertura de testes adicionada junto ao código.

### Correção estrutural sugerida

Remover a árvore local incompleta e executar `npm ci` em terminal sem limite curto de execução, confirmando a presença de `node_modules/.bin/tsc.cmd`, `node_modules/typescript/lib/lib.es2022.d.ts` e `node_modules/rxjs/operators` antes das validações.

### Estado

resolved

### Decisão e evidência de encerramento

Reavaliado em 2026-11-24. As dependências foram restauradas e os comandos oficiais executaram. A suíte do plugin passou com 47 testes; `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:boundaries` e `npm test` (789 testes em 78 arquivos) passaram. O teste de controller exigiu `plugins/analytics/reports/tsconfig.json` com decorators experimentais, adicionado nesta entrega. Integração com PostgreSQL real e E2E continuam não executados por ausência de infraestrutura.

---

## ISSUE-002

### Categoria

TOOL_LIMITATION

### Severidade

non-blocking

### Etapa

implementação

### Problema observado

Os modelos definidos em `AGENTS.md` não puderam executar subagentes: `openai/gpt-6-astra` e `google/gemma-4-31b-it:free` foram recusados como providers desabilitados; o preset implementador disponível exigia chave Anthropic ausente; o endpoint síncrono também recusou execução por configuração de API key.

### Evidência

- `Unknown or disabled provider "openai"`.
- `Unknown or disabled provider "google"`.
- `Anthropic API key is missing`.
- `API keys are not supported by this endpoint`.

### O que era esperado

O orquestrador deveria delegar código ao implementador e testes ao papel designado, com registro do modelo real.

### Impacto

O orquestrador precisou aplicar código e testes diretamente. Nenhum modelo indisponível será declarado como executor.

### Contorno utilizado

Implementação direta pelo agente principal, com escopo restrito e revisão explícita.

### Correção estrutural sugerida

Disponibilizar providers/modelos configurados para subagentes ou alinhar `AGENTS.md` aos modelos efetivamente executáveis no ambiente.

### Estado

open

### Decisão e evidência de encerramento

Pendente. Reavaliar quando o ambiente expuser os providers previstos.
