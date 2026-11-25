# Operação de campo sem conexão

Referência normativa: `SPEC/2026-11-17-operacao-campo-offline.md`. Retomada de validação: 2026-11-25.

## Fluxos suportados

Com a aplicação autenticada e as referências já carregadas, o operador pode criar um incidente, solicitar uma transição de despacho existente ou atualizar um item de checklist existente durante a desconexão. A confirmação inicial é de persistência neste navegador, não de conclusão no servidor. Não há cache integral, service worker, anexos offline ou promessa de inicialização da aplicação desconectada.

Se a rede continuar ativa, mas a requisição de mutação falhar por transporte ou resposta 5xx, os três formulários também capturam a operação localmente. Respostas 4xx permanecem erros visíveis e não geram captura automática. A criação de incidente usa o endpoint idempotente existente desde a primeira tentativa, mantendo o UUID enquanto usuário e payload forem iguais. Assim, perda de resposta depois da gravação não cria outro incidente no fallback. Despachos/checklists guardam o snapshot original: se a tentativa já tiver sido aplicada, a repetição pode exigir revisão por conflito, preservando a decisão do servidor.

A fila mostra pendentes, sincronização em andamento, erros que exigem revisão e confirmações do servidor. Reconexão inicia sincronização; o operador também pode tentar manualmente. Cada envio usa as APIs e permissões atuais do domínio. Uma falha definitiva preserva a operação e bloqueia posteriores do mesmo recurso até revisão/descarte; outros recursos continuam elegíveis. Erros de transporte mantêm todas as modalidades pendentes.

## Persistência, identidade e concorrência

- Novas operações são armazenadas em chaves independentes de `localStorage`, evitando que capturas de abas diferentes sobrescrevam o array inteiro.
- O array legado `eops.offline.v1` continua legível; alterações por chave prevalecem. O descarte grava primeiro um marcador sem payload e limpa o payload legado antes de sinalizar conclusão. Falhas de armazenamento são expostas, sem confirmar gravação inexistente.
- A fila fica isolada por usuário e permanece neste dispositivo após logout. Somente a mesma identidade reautenticada pode reenviar. O descarte é explícito; não há credenciais, token ou anexos na fila.
- Web Locks serializam sincronizações da mesma identidade entre abas. Navegador sem esse recurso informa a limitação e não tenta envio inseguro.
- Logout invalida a identidade imediatamente. Mudança da sessão em outra aba invalida o contexto local. Uma resposta de sessão anterior não confirma operações da sessão nova.
- Reenvio de criação usa o UUID da operação como chave persistente no servidor. Despachos e checklists enviam estado e versão observados: divergência gera conflito revisável, sem sobrescrever o estado remoto.
- `queueOffline(ownerId, action, operationId?)` mantém compatibilidade com chamadas anteriores. O identificador opcional permite preservar a primeira tentativa online. Uma entrada existente compatível é reutilizada sem zerar tentativas/estado; colisões de proprietário, recurso ou payload e IDs já descartados são rejeitados.
- Depois de confirmação, as telas afetadas reconsultam o estado real; enfileirar ou começar a transmitir não produz essa confirmação.

Limite do legado: a limpeza do array antigo é síncrona e não transacional entre abas. Marcadores impedem ressurreição lógica, mas duas limpezas concorrentes podem reter bytes antigos até nova limpeza. Novas operações não usam esse array. Esta limitação deve permanecer explícita no handoff; não implica perda de fila ou autorização de reenvio por outra identidade.

## Matriz de critérios e evidências

| Critério da SPEC | Implementação | Validação |
| --- | --- | --- |
| 1 — capturar os três tipos com confirmação local | `queueOffline` e formulários dos plugins | Unitários de persistência e três cenários de captura UI em `tests/e2e/offline.spec.ts` |
| 2 — persistir, listar, tentar novamente e descartar | API pública `@eops/api-client/offline` e painel `OfflineQueue` | Unitários de quota, corrupção, isolamento e legado; E2E de recarga com mutações indisponíveis |
| 3 — reenviar e reconsultar sem perda silenciosa | `synchronizeOffline`, erro pendente por transporte e observadores nas telas | Unitários das três rotas e falhas; E2E conferindo estado real via API |
| 4 — retry, concorrência, identidade, autorização e conflitos | Lock por usuário, revisão de sessão e controle otimista/idempotência dos servidores | Unitários e E2E de replay concorrente, duas abas, RBAC, troca de usuário e versões obsoletas |
| 5 — preservar fluxos e fronteiras | Rotas de domínio existentes, API cliente estendida de forma compatível; nenhuma permissão ou migration nova | Verificações globais, testes de domínio e `check:boundaries` |

Os testes unitários estão junto ao código em `packages/api-client/src/offline.test.ts`; os de domínio permanecem nos plugins. Os testes E2E usam navegador e API/PostgreSQL reais, com mutações bloqueadas temporariamente somente para simular perda de conexão. A recarga ocorre com leituras/autenticação disponíveis, conforme o limite explícito da SPEC.

Resultados finais e pendências: `docs/execution-issues/2026-11-25-validacao-operacao-offline.md`. O documento distingue execução com banco real de testes com doubles.
