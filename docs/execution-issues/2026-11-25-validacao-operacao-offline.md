# Execution issues — validação da operação offline

Data: 2026-11-25. SPEC Gate: `EXISTING_SPEC_OK`; SPEC: `SPEC/2026-11-17-operacao-campo-offline.md`. Plano: `docs/plans/2026-11-25-validacao-operacao-offline.md`. Sessão literal: `prompts/sessoes/2026-11-25-codex-ambiente-specs-loc.md`.

## EXECUTION ISSUES PREFLIGHT

| Issue | Estado inicial | Classificação |
| --- | --- | --- |
| Dependências e Prisma locais | Falha na análise anterior | `BLOCKS_CURRENT_TASK` para validação integral |
| Integração/E2E offline sem infraestrutura comprovada | Pendente no registro de 2026-11-24 | `BLOCKS_CURRENT_TASK` para PASS integral |
| Alterações alheias, inclusive migration local | Existentes e não commitadas | `OUT_OF_SCOPE` |
| cloc ausente | Pendente | `RELATED_NON_BLOCKING` |
| Modelos de referência e caveman | Não disponíveis integralmente na ferramenta | `RELATED_NON_BLOCKING` |

## ISSUE-001 — divergência de modelos/skill

- Categoria: `TOOL_LIMITATION`; severidade: non-blocking; estado: `not-actionable` nesta execução.
- Papel principal: orquestração/revisão; subagente `offline_implementation`: produto; subagente `offline_tests`: testes. A ferramenta permitiu solicitar `gpt-6-astra`/`low` para implementação, mas o executor não recebeu identificação exata do modelo. Todos registram `codex/model-unavailable`, sem simular os modelos GLM/DeepSeek de referência.
- Skill `caveman` não encontrada nos caminhos locais pesquisados; não foi declarada como utilizada. Código e artefatos seguem PT-BR técnico. Papéis e propriedade de arquivos foram separados.
- Impacto: a configuração de referência não pode ser atestada; os executores reais e as validações ficam registrados sem falsa conformidade.

### Identificação posterior por metadados locais

O registro provisório de modelo indisponível foi reconciliado pela leitura de `session_meta.model_provider` e `turn_context.model` dos logs locais. Principal, `offline_tests` e `offline_tests_resume` executaram `openai/gpt-6.1-sol`; `offline_implementation` executou `openai/gpt-6-astra` com `turn_context.effort=low`. Usar esses valores nos commits e handoff. A implementação cumpriu o modelo/esforço solicitado; os modelos de referência GLM/DeepSeek e a skill caveman continuam indisponíveis. A declaração provisória permanece acima como histórico, sem substituir a evidência posterior.

### Retomada após limite de uso

O agente `offline_tests` atingiu o limite de uso antes de concluir os E2E. O usuário solicitou continuar. O agente `offline_tests_resume` assumiu os testes e a correção do cenário de revogação de permissão, preservando as asserções e a propriedade dos arquivos. Ambos participaram efetivamente e devem aparecer na lista de agentes dos commits. Não houve substituição de asserções de autorização por respostas simuladas: a confirmação de 403 usa a API real com a identidade cujo acesso foi revogado.

## ISSUE-002 — retenção residual do armazenamento legado

- Categoria: `REPO_DIVERGENCE`; severidade: non-blocking; estado: `partially-resolved`.
- O array legado compartilhado permitia perda de capturas concorrentes. Novas operações usam chaves independentes; tombstones impedem ressurreição lógica de descartes.
- Evidência: revisão de `packages/api-client/src/offline.ts` e testes de armazenamento/legado. Descarte individual remove payload da chave própria e limpa o array legado, com falhas expostas.
- Limitação: duas limpezas síncronas concorrentes do array antigo podem reter bytes de outra operação já descartada até nova limpeza. Não há ressurreição lógica; novas capturas não usam o array. A limitação está documentada em `docs/modules/offline.md`.
- Próxima ação: avaliar migração física integral sob lock se a remoção física transacional de dados legados entre abas for exigida. Não confundir esse limite com garantia de apagamento seguro do dispositivo.

## Infraestrutura desta execução

- Container exclusivo `eops-offline-validation-20261125`, PostgreSQL 17, publicado somente em loopback na porta 55435. Banco de teste `eops_offline_test`; sem uso do banco atual da aplicação.
- `db:migrate:deploy` aplicou 28 migrations e o seed terminou. A execução incluiu a migration local preexistente `20261105150127`, previamente inspecionada: remoção de default de `FieldShift.updatedAt` e renomeação de índice. Ela foi preservada sem staging; portanto esta evidência é do working tree informado, não de um checkout limpo só com arquivos versionados.
- API e frontend de teste usam portas 3101/4273 para evitar reutilização de serviços do usuário. Configuração temporária em pasta ignorada e variáveis locais de processo, sem editar `.env`.
- Seed exigiu execução fora do sandbox porque `tsx` falhou em `os.userInfo` no Windows; a repetição contra o banco isolado concluiu. Não há alteração do runtime por contorno de teste.
- cloc oficial 2.12 obtido do release upstream, com SHA-256 conferido: `b800034063ae3e3733ce34579d5d74cacd4dc4b842534d3f4b910d5a03ef63b1`. Artefato binário em pasta ignorada, não versionado.

### Verificação independente das migrations versionadas

Para remover a dependência da migration local, foi criado outro schema vazio, `offline_tracked`, no mesmo PostgreSQL isolado. Copiaram-se apenas `schema.prisma` e os SQLs retornados por `git ls-files` para uma pasta temporária ignorada. `prisma migrate deploy` aplicou **27 migrations versionadas** com sucesso, e o seed nesse schema concluiu com 1 pleito, 4 zonas, 32 locais e 208 seções. A rodada final do navegador deve usar esse schema; a execução inicial de 28 migrations fica preservada como evidência histórica distinta.

## ISSUE-003 — comparação relativa do cloc omite arquivos novos nesta execução

- Categoria: `VALIDATION`; severidade: non-blocking; estado: `resolved`.
- Evidência: cloc 2.12 com `--git --diff` entre `5aa147c` e `bd29ba0` reportou 904 linhas adicionadas e nenhum arquivo novo. Com `--git-diff-all`, nas mesmas exclusões, reportou 56 arquivos adicionados, 10.544 linhas adicionadas, 119 modificadas e 0 removidas. O total é consistente com 83.517 linhas anteriores e 94.061 no destino.
- Ação: README, AGENTS e relatório AP2 usam a comparação completa `--git --git-diff-all --diff`. A documentação upstream diferencia estratégia relativa de comparação completa de árvores. Não estimar métricas a partir do primeiro resultado incompleto.
- Impacto: a métrica do período passa a incluir arquivos novos sem contar linhas anteriores inalteradas como produção. A atualização é manutenção autorizada pelo usuário, sem nova SPEC ou commit isolado de métricas.

## Validação

| Verificação | Resultado final |
| --- | --- |
| Unitários globais | PASS, 822 testes em 78 arquivos |
| Fila offline | PASS, 36 testes junto ao código |
| E2E offline | PASS, 13 cenários, exit code 0, 26,3 segundos, API/PostgreSQL reais |
| Typecheck API/web | PASS |
| Lint | PASS |
| Prisma validate | PASS |
| Fronteiras | PASS, 38 workspaces |
| Migrations versionadas/seed | PASS, 27 migrations em schema vazio `offline_tracked` |
| Build final API/web | PASS; Vite mantém aviso de bundle acima de 500 kB, sem falha |
| SPEC traceability | Commit de produto `50fe519` PASS; validar também a sequência com o handoff documental |

As rodadas iniciais revelaram erros de seletores/fixture nos testes, corrigidos sem relaxar asserções: combobox por papel acessível, timestamp obtido pelo GET do detalhe e conferência de 403 com token real do usuário revogado. Nenhum caso foi excluído. A matriz funcional está em `docs/modules/offline.md`.

## ISSUE-004 — teardown do Playwright no Windows

- Categoria: `ENVIRONMENT`; severidade: non-blocking após contorno; estado: `partially-resolved`.
- Evidência: o caso isolado de HTTP 403 concluiu as asserções, consulta de API e fechamento do navegador, mas o processo ficou aguardando o encerramento dos webServers. O trace diagnóstico confirmou que o bloqueio era posterior a `browser.close`.
- Contorno: os mesmos servidores exclusivos 3101/4273, iniciados explicitamente com o schema de testes, foram validados por uma configuração temporária ignorada com `webServer: []`. Os 13 cenários concluíram com exit 0 em 26,3 s. Nenhuma configuração versionada do Playwright foi alterada e nenhum serviço do usuário foi reutilizado.
- Cleanup: os servidores exclusivos foram encerrados ao final. Processos órfãos de uma execução anterior foram identificados pelas portas e comandos antes do encerramento. Traces/logs de diagnóstico com cabeçalhos de autenticação ficaram fora do staging e da exportação literal da conversa.
- O container PostgreSQL temporário foi identificado pelo ID criado nesta tarefa, parado e removido após a validação; o container original `election-ops-postgres` foi preservado.
- Impacto: não impede validação funcional offline; o teardown automatizado local no Windows permanece questão de infraestrutura para tarefa própria. A suíte global E2E da plataforma não foi executada nesta entrega.

## EXECUTION ISSUES RECONCILIATION

| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
| --- | --- | --- | --- | --- | --- |
| Dependências/Prisma locais | Falha histórica | Verificações passaram | Reavaliado ambiente fornecido pelo usuário, sem reinstalação incidental | Typecheck, build inicial e 822 testes | Não |
| Banco/E2E offline | Sem evidência real | Validado no recorte | PostgreSQL exclusivo, 27 migrations versionadas, seed e navegador | 13 E2E PASS/26,3 s | Não para offline; outros plugins ainda requerem seus próprios fluxos |
| Modelos/caveman | Identificação provisória, referências indisponíveis | Modelos reais identificados; skill ausente | Logs locais e papéis separados; retomada de testes após limite | ISSUE-001 | Não; desvio de ferramenta preservado |
| Armazenamento legado | Array sujeito a sobrescrita | Novas operações independentes; limpeza física concorrente limitada | Chaves por operação e tombstones | ISSUE-002 e testes de legado | Não para filas novas; pendência do legado documentada |
| LOC | Ferramenta ausente e comando incompleto | Executável verificado, comparação completa | Medição entre árvores com `--git-diff-all` | ISSUE-003 e `docs/metrics/LOC-ap2.md` | Não; meta acadêmica depende do resultado real |
| Teardown Windows | Bloqueio após conclusão dos testes | Contornado; correção estrutural pendente | Serviços externos exclusivos em configuração ignorada | ISSUE-004, exit 0 | Não para este recorte |
| Alterações preexistentes | Não commitadas | Preservadas | `.env.example` e migrations fora da entrega de produto | Status Git revisado | Não |

## SPEC COMPLIANCE

```text
SPEC COMPLIANCE: PASS
SPEC Gate: EXISTING_SPEC_OK
SPEC: SPEC/2026-11-17-operacao-campo-offline.md
Evidence: commit 50fe519; 36 testes da fila; 822 testes globais/78 arquivos; 13 E2E reais/26,3 s; 27 migrations versionadas e seed; typecheck, lint, boundaries, Prisma validate e build PASS. Matriz em docs/modules/offline.md.
Deviations: modelos de orquestração/testes diferem das referências, com executores reais identificados; caveman indisponível; teardown Windows contornado com configuração temporária; limpeza física concorrente do legado limitada e documentada. Sem ampliação dos requisitos funcionais.
```

O commit documental final acompanha a implementação e inclui estado/evidências da SPEC, matriz, sessão literal e métricas; não é commit isolado de LOC. Nenhum push ou reescrita de histórico foi realizado.
