# Execution issues — ambiente, SPECs e LOC

## Contexto

- Data: 2026-11-25; branch `develop`, HEAD inspecionado `bd29ba0`.
- Papel desta fase: especificação/documentação; modelo `openai/gpt-6.1-sol`, confirmado posteriormente nos metadados locais. A identificação inicialmente indisponível foi reconciliada sem alterar as mensagens literais da sessão.
- Escopo: diagnóstico e orientação de ambiente, recorte de LOC e sessão literal. Sem código de produto ou alterações de banco.
- SPEC Gate final: `SPEC_EXEMPT`, por instrução explícita do usuário: “isso não conta como spec e nem como um commit isolado”. A proposta inicial de nova SPEC foi removida; não houve commit.
- Sessão: `prompts/sessoes/2026-11-25-codex-ambiente-specs-loc.md`.

## ISSUE-001 — dependências locais e Prisma Client desatualizados

- Categoria: `ENVIRONMENT`; severidade: `non-blocking` para diagnóstico/documentação; estado: `open`.
- Evidências: dois links de workspace ausentes em `node_modules`; typecheck falhou com TS2307; build da API falhou com 159 erros; três suítes não carregaram enums Prisma (`ClosureSeverity`, `PollingPlaceInspectionFindingStatus`). Foram executados com sucesso 703 testes em 75 arquivos.
- Impacto: bloqueia declarar validação integral da aplicação local. Não prova ausência de implementação dos dois plugins, cujos arquivos e manifests existem.
- Contorno: diagnóstico sem alterar dependências, código ou `.env`; roteiro em `docs/AMBIENTE-E-PENDENCIAS.md`.
- Correção sugerida: executar `npm ci` e geração do Prisma, repetir verificações e validar banco/E2E isolados. Não executado nesta entrega de orientação.

## ISSUE-002 — cloc indisponível e regra histórica divergente

- Categoria: `DEPENDENCY`; severidade: `non-blocking` para documentação; estado: `partially-resolved`.
- Evidência: cloc não encontrado no PATH nem em `LOCALAPPDATA/Programs/cloc/cloc.exe`; regra anterior acompanhava total, contrariando o recorte solicitado agora.
- Ação inicial: README e AGENTS ajustados por instrução do usuário; registro de medição preparado com hashes. O artefato passou a se chamar `docs/metrics/LOC-ap2.md`. Não alterados scripts ou checkpoints históricos.
- Impacto: regra documentada; valor no recorte e meta acadêmica continuam sem comprovação. Instalação e execução do cloc pendentes.

## Permissão e correção de escopo

`git add` somente da SPEC inicialmente proposta falhou por acesso negado ao índice. A solicitação de execução com permissão ampliada foi recusada pelo usuário. Não houve staging ou commit. Em seguida, o usuário esclareceu que esta manutenção não conta como SPEC nem commit isolado. A SPEC recém-criada foi removida; nenhum arquivo preexistente foi removido. Não repetir a solicitação nesta tarefa.

## EXECUTION ISSUES PREFLIGHT

| Condição | Estado inicial | Classificação |
| --- | --- | --- |
| Validação real de offline, vistorias e conciliação | Pendente nos registros anteriores | `RELATED_NON_BLOCKING` para documentação |
| Dependências/Prisma locais | Falhas observadas na análise anterior | `RELATED_NON_BLOCKING` para documentação |
| Regra de LOC anterior | Incompatível com o pedido atual | `RELATED_NON_BLOCKING`, alteração documental autorizada |
| Alterações preexistentes de `.env.example` e migrations | Não commitadas | `OUT_OF_SCOPE` |

## EXECUTION ISSUES RECONCILIATION

| Condição | Estado final | Ação/evidência | Impacto na próxima fase |
| --- | --- | --- | --- |
| Validação real dos novos fluxos | Pendente | Preservada, documentada com SPECs/commits | Exigir banco e navegador antes de aprovação integral |
| Dependências/Prisma | `open` | Falhas e roteiro registrados; sem correção incidental | Reinstalar e regenerar antes de nova validação |
| LOC | `partially-resolved` | Comando entre o pai de `5bed0ad` e HEAD documentado; sem estimativa | Instalar cloc e registrar saída literal |
| Alterações preexistentes | Preservadas | Status Git conferido; nenhum staging | Revisar migration antes de aplicar banco |
| SPEC/commit desta manutenção | Não aplicável por decisão explícita | Proposta retirada; nenhuma reescrita ou commit | Manter trailers e anterioridade para próximas mudanças funcionais |

## Reavaliação após a implementação offline

O relato acima preserva a fase documental anterior à autorização funcional. Na fase seguinte, solicitada pelo usuário, a SPEC offline existente orientou o commit `50fe519`, com 822 testes globais e 13 E2E aprovados. O cloc foi obtido do release oficial e medido; a regra recebeu `--git-diff-all` para incluir arquivos novos. Resultado final e reconciliação: `docs/execution-issues/2026-11-25-validacao-operacao-offline.md`. A manutenção de ambiente, registro de sessão e LOC acompanha o handoff funcional, sem SPEC nova nem commit isolado de métricas.
