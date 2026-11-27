# Validação e conclusão da operação offline

Data: 2026-11-25. Papel principal: orquestração/revisão, `openai/gpt-6.1-sol`. Identificação confirmada posteriormente nos metadados locais `session_meta.model_provider` e `turn_context.model`; a declaração inicial de indisponibilidade foi corrigida com essa evidência. Autorização: usuário aprovou prosseguir com a prioridade de fechar a operação offline.

## Objetivo e SPEC Gate

`EXISTING_SPEC_OK`: `SPEC/2026-11-17-operacao-campo-offline.md`. Implementação existente em `354d1bd`; SPEC preexistente em `a046b39`. Conferir todos os critérios, corrigir divergências e produzir evidências honestas de unitário, integração e E2E. Sem ampliar o escopo a navegação offline integral ou novos domínios.

## Fases e responsáveis

1. Orquestração: ler SPEC/guides e construir matriz de aceite; verificar dependências, Prisma e infraestrutura local sem expor `.env`. Preservar modificações existentes em `.env.example`, README, AGENTS, documentação e migrations não versionadas.
2. Implementação: subagente `openai/gpt-6-astra` solicitado na variante `low`; revisar/corrigir `packages/api-client/src/offline.ts`, captura nos três plugins e integrações de autenticação/painel diretamente relacionadas. Ler guia de UI antes de alterações visuais. Procurar skill `caveman`; registrar indisponibilidade se não existir. Não alterar testes, SPEC ou permissões. Divergências de requisito voltam ao principal.
3. Testes: subagente com modelo herdado e identificação não exposta (`codex/model-unavailable`), pois o provedor de referência `opencode/deepseek-v4.1-flash-free` não está disponível na ferramenta. Manter suítes junto ao código e E2E em `tests/e2e`; definir cobertura de armazenamento, isolamento, retry, conflitos, idempotência, logout e concorrência. Não enfraquecer asserções. Coordenar com implementação sem editar os mesmos arquivos.
4. Orquestração/revisão: executar verificações globais e cenários com infraestrutura disponível, reconciliar evidências e issues, atualizar registro literal da sessão e medir LOC pelo comando do README se cloc disponível. Commit local atômico somente do escopo offline, com trailers e participação dos agentes; sem commit isolado de manutenção e sem push.

## Critérios de aceite e validações

- Cada critério da SPEC possui código e teste identificados, com PASS ou pendência explícita.
- Captura persistente confirma somente estado local; operações mantêm identidade, ordem, payload e erro. Falhas de transporte não perdem dados nem viram sucesso; erros definitivos não repetem indefinidamente.
- Mutação sincronizada passa pelo servidor, mantém regras/permissões/eventos, não duplica incidente e rejeita conflitos.
- Verificar desconexão/recarga/reconexão para os três fluxos, duas abas e troca de identidade quando infraestrutura permitir.
- Executar `spec:check`, `check:boundaries`, `db:validate`, `typecheck`, `lint`, `npm test`, `build` e E2E pertinentes. Distinguir mocks de integração real; nunca declarar sucesso não executado.

## Preflight, riscos e go/no-go

| Condição | Classificação | Decisão |
| --- | --- | --- |
| Dependências/Prisma locais falharam na análise anterior | `BLOCKS_CURRENT_TASK` para validação integral | Reavaliar; regularizar somente artefatos locais quando necessário |
| Banco/E2E ausentes nos registros anteriores | `BLOCKS_CURRENT_TASK` para PASS integral | Tentar infraestrutura de teste isolada; não escrever no banco remoto desconhecido |
| Alterações alheias e migration não versionada | `OUT_OF_SCOPE` | Preservar; nenhum staging abrangente ou aplicação em banco existente |
| Falta cloc e status documentais desatualizados | `RELATED_NON_BLOCKING` | Registrar medição indisponível e atualizar somente com evidência |
| Sandbox bloqueia `.git` e autorização anterior de staging foi recusada | `RELATED_NON_BLOCKING` até entrega | Não contornar bloqueio; novo escopo funcional autorizado permite tentativa normal, registrando eventual limitação sem repetir pedido recusado de manutenção |

Go: SPEC já existe no histórico, arquivos são isoláveis e correções seguem seus requisitos. No-go: mudança de contrato/requisito não coberta, escrita em banco sem alvo de teste comprovado, teste que mascara falha ou staging contaminado. Handoff com SPEC COMPLIANCE e EXECUTION ISSUES RECONCILIATION.

## Decisões de revisão e retomada

- O objetivo da SPEC já abrange API indisponível com rede ativa. Corrigir fallback dos três formulários em transporte/5xx; manter 4xx como falha visível. Não há requisito novo ou necessidade de nova SPEC.
- Adição compatível aprovada pelo orquestrador: terceiro argumento opcional `operationId` em `queueOffline`, sem alteração das chamadas existentes. Reutilizar ID, proprietário e payload da criação idempotente desde a primeira tentativa; impedir colisões e preservar estado de entradas já capturadas. Não adicionar endpoint/RBAC/backend.
- A sessão `offline_tests` atingiu limite de uso antes da conclusão dos testes de navegador. O agente `offline_tests_resume` assumiu o mesmo papel e os mesmos arquivos, com modelo exato não exposto (`codex/model-unavailable`). O orquestrador continua responsável pelo go/no-go; o papel de testes pode executar commits após sua autorização e revisão.
- Banco final de validação: schema `offline_tracked` num container exclusivo, migrado a partir somente dos 27 SQLs versionados. Não depender da migration local preexistente.
- Manutenção de métricas/documentação acompanha a entrega, sem nova SPEC nem commit isolado de cloc, conforme orientação do usuário.
- Modelos efetivos confirmados nos logs locais: principal e os dois agentes de testes `openai/gpt-6.1-sol`; implementação `openai/gpt-6-astra`, esforço `low`. O trailer de quem executar os commits deverá usar o modelo confirmado, não a declaração provisória `model-unavailable`.
