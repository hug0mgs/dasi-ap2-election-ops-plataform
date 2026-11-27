# Instruções para agentes de IA — Election Ops Platform

Este repositório foi estruturado para permitir trabalho com contexto limitado. Não carregue o monorepo inteiro por padrão.

## Finalidade do projeto

A **Election Ops Platform** é uma plataforma acadêmica modular, em monorepo, para gestão, acompanhamento e simulação de operações eleitorais: autenticação e RBAC → pleito → zona → local de votação → seções e ativos → incidentes → Event Bus → auditoria e notificações, com shell operacional e plugins isolados.

O objetivo de todo agente é **evoluir essa plataforma preservando** arquitetura por plugins, fronteiras entre workspaces, contratos públicos, permissões, banco e comportamento existente. A finalidade do repositório não muda por conveniência de ferramenta, prompt ou modelo: o que não estiver coberto por uma SPEC não é escopo.

A próxima tarefa funcional do projeto ainda **não foi definida** pelo usuário. Enquanto isso, planeje e prepare infraestrutura documental, mas não invente escopo de produto.

## Ordem de trabalho

1. Leia `SPEC/README.md`.
2. Identifique e leia apenas a SPEC relacionada à tarefa.
3. Leia `docs/AI-PLUGIN-GUIDE.md`.
4. Leia `docs/COMMIT-GUIDE.md` antes de sugerir ou criar commits.
5. Se houver alteração de frontend/UI, leia `docs/UI-DESIGN-GUIDE.md`.
6. Abra somente os arquivos diretamente necessários ao escopo.
7. Para funcionalidade nova ou mudança material de comportamento, crie/atualize a SPEC e faça o commit da SPEC antes do código.
8. Preserve arquitetura, rotas, permissões e funcionalidades existentes, salvo quando a SPEC determinar mudança.

## SPEC Gate obrigatório

Antes da primeira alteração de implementação, declare exatamente uma classificação e a evidência correspondente:

- `NEW_SPEC`: não existe SPEC normativa; crie e commite a SPEC antes da implementação;
- `UPDATE_SPEC`: a SPEC existe, mas os requisitos mudaram; atualize-a e commite antes da implementação afetada;
- `EXISTING_SPEC_OK`: a SPEC existente cobre integralmente a tarefa; informe seu caminho;
- `SPEC_EXEMPT`: não há mudança funcional ou normativa; registre uma justificativa objetiva.

`SPEC/README.md` é a referência canônica do gate. Documentos em `docs/modules/`, prompts e código existente não substituem uma SPEC normativa. Commits locais de SPEC e implementação do escopo solicitado possuem autorização permanente, sem nova confirmação por commit. Uma restrição explícita do usuário prevalece. Push e reescrita de histórico exigem autorização própria.

## Contexto mínimo

### Tarefa em um plugin

Leia:

- `plugins/AGENTS.md`;
- pasta do plugin afetado;
- manifest do plugin;
- packages efetivamente importados por ele;
- contratos globais que precisar alterar.

Não abra todos os outros plugins. Consulte no máximo um plugin semelhante quando precisar de referência estrutural.

### Tarefa no shell/global UI

Leia:

- `apps/web/src/App.tsx`;
- `apps/web/src/pluginRegistry.ts`;
- componentes do shell diretamente afetados;
- `apps/web/src/styles/global.css`;
- `@eops/plugin-sdk` e `@eops/ui` quando necessários;
- manifests por meio do registry, sem abrir implementação interna de todos os plugins.

Para dados agregados na home, use APIs públicas e contratos compartilhados. Não importe services/components internos de plugins.

## Fronteiras entre workspaces

- nenhum workspace pode importar fisicamente `src/` de outro workspace;
- imports cross-workspace devem usar o nome público do package, como `@eops/database`, `@eops/event-bus`, `@eops/security`, `@eops/shared`, `@eops/plugin-sdk` e `@eops/ui`;
- `apps/api` é o composition root server-side e registra plugins exclusivamente pelo entrypoint público `@eops/plugin-<slug>/server`;
- imports relativos que escapem do workspace produtor são proibidos, ainda que o arquivo alvo esteja exportado por outro caminho;
- alterações em barrels e `exports` devem manter a superfície pública mínima e intencional.

A convenção completa está em `docs/PLUGIN_ARCHITECTURE.md` e é verificada por `npm run check:boundaries`.

## Orquestração de agentes e modelos

A SPEC normativa é [`SPEC/2026-11-17-agent-orchestration-and-delivery-standard.md`](SPEC/2026-11-17-agent-orchestration-and-delivery-standard.md). Cada sessão declara **um** papel e o **modelo real** em uso.

| Papel | Modelo de referência | Responsabilidades |
| --- | --- | --- |
| Orquestrador | `opencode/glm-5.3-flash-free` | ler SPEC e guides, decompor a tarefa, produzir o plano, despachar implementação, revisar, decidir go/no-go e autorizar commit |
| Especificador, commitador e testes | `opencode/deepseek-v4.1-flash-free` | criar/atualizar a SPEC conforme SDD, redigir commits em PT-BR, conferir trailers e rastreabilidade, **criar e manter os testes** (unitário, integração e E2E) e rodar as validações de entrega |
| Implementador | `openai/gpt-6-astra` (variante `low`, a mais rápida) com a skill `caveman` | escrever o código de produto, executar build/testes/lint dentro do escopo aprovado |

Regras:

- registre o **modelo real** no trailer `Agent:` e no handoff; nunca declare um modelo que não executou a tarefa;
- o orquestrador não implementa código, salvo tarefa trivial explicitamente registrada;
- o implementador não altera SPEC, premissas, contrato público, RBAC ou escopo; divergência volta ao orquestrador;
- **testes têm dono:** `opencode/deepseek-v4.1-flash-free` escreve e mantém as suítes (incluindo E2E); o implementador pode rodar e corrigir falha de teste, mas não redefinir o que a suíte cobre sem alinhamento com o orquestrador;
- se a ferramenta não permitir fixar o modelo do subagente, registre a limitação no handoff em vez de supor conformidade;
- o commitador executa `git add`/`git commit` locais do escopo solicitado sem pedir nova autorização, respeitando restrições explícitas do usuário e a política de `SPEC/README.md`.

## Plano de execução

Antes de implementação material, o orquestrador grava um plano datado em `docs/plans/YYYY-MM-DD-<slug>.md` com: objetivo, `SPEC Gate` e SPEC aplicável, fases e arquivos por fase, critérios de aceite, validações, riscos, gatilhos go/no-go e modelo designado por fase.

O plano é operacional e descritivo: **não** substitui a SPEC normativa, **não** cria requisito funcional e **não** autoriza commit. Sem tarefa funcional definida pelo usuário, o orquestrador registra o bloqueio e pede decisão; não propõe escopo de produto por conta própria.

## Execução de código

- O implementador usa `openai/gpt-6-astra` (variante `low`) com a skill `caveman` para respostas curtas e economia de contexto.
- O implementador escreve **código de produto**. Os testes são escritos e mantidos pelo papel de testes (`opencode/deepseek-v4.1-flash-free`).
- O estilo `caveman` vale **somente na conversa**: código, comentários, SPECs, testes, documentação e mensagens de commit seguem PT-BR técnico e o padrão do repositório.
- Siga os padrões existentes (NestJS, React, Prisma, ESLint, tipagem estrita). Não introduza biblioteca, estrutura de pastas ou convenção nova sem aprovação.

## Cobertura de testes

**Dono da suíte:** `opencode/deepseek-v4.1-flash-free` (papel Especificador, commitador e testes) cria e mantém os testes unitários, de integração e E2E. O implementador escreve o código de produto e pode corrigir uma falha de teste, mas não redefine a cobertura sem alinhamento com o orquestrador.

Os testes ficam colocados junto ao código-fonte. O mapeamento normativo é:

| Camada | Local real | Comando |
| --- | --- | --- |
| Unitário | `*.test.ts` ao lado do arquivo testado, em `plugins/` e `packages/` | `npm test` |
| Integração | testes de service/rota com banco e plugins reais, também junto ao código | `npm test` |
| E2E | `tests/e2e/*.spec.ts` e `tests/e2e/flows/*.spec.ts` | `npm run e2e` |

Não crie árvores duplicadas de teste para o mesmo módulo. Se um domínio novo não tiver casa natural ao lado do código, use `tests/unit/` ou `tests/integration/` e justifique na SPEC correspondente. Toda SPEC funcional declara as camadas cobertas e as pendências de infraestrutura.

## Higiene e segurança

- Nenhum segredo, chave, senha, token ou string de conexão real pode ser commitado; use variáveis de ambiente e `.env.example`.
- Antes de qualquer commit, revise `git status --short` e o diff staged procurando credenciais.
- Exportações de sessão vão para `prompts/sessoes/` como `YYYY-MM-DD-<ferramenta>-<slug>.md`, revisadas contra segredos. Arquivos em `prompts/resumos/` não substituem exportações literais.
- Não versione artefatos de build, caches locais ou dumps de banco.

## README e métricas

- `README.md` mantém no início a URL pública como link clicável; se indisponível, registre `PENDENTE` objetivamente.
- `README.md` lista as ferramentas e modelos de IA efetivamente utilizados.
- `README.md` contém a saída real do comando oficial de `cloc` documentado nele.
- A meta de rubrica de pelo menos 100.000 linhas contabilizadas só pode ser declarada após medição real. É proibido inflar a contagem com código artificial, arquivos duplicados ou exclusões seletivas; se a medição ficar abaixo da meta, registre a pendência.

## Contagem de linhas de código (cloc)

Por decisão explícita do usuário em 2026-11-25, a métrica principal passa a medir **somente as mudanças desde o primeiro commit de ThiagoRM**, inclusive. Esse ajuste é manutenção, sem nova SPEC nem commit isolado, conforme correção registrada em `prompts/sessoes/2026-11-25-codex-ambiente-specs-loc.md`. O comando oficial está no `README.md`.

- **Checkpoint inicial:** `docs/metrics/loc-checkpoints.json`, commit `5aa147c` (2026-11-17): **83.517 linhas de código em 751 arquivos**. Ele é referência histórica e não é reescrito.
- **Recorte:** primeiro commit `5bed0ad7aebf96538457a5f4e68833085a6976e5`; comparar seu pai `5aa147c297a0e68a8201b6fe2408175b2c78aa3c` com `HEAD` usando `cloc --git --git-diff-all --diff`. Incluir todos os autores e arquivos novos no período; não incluir a árvore de trabalho nem linhas anteriores inalteradas na produção do período.
- **Métrica principal:** linhas de código adicionadas, modificadas e removidas no recorte, discriminadas. Acréscimo líquido = adicionadas − removidas. Não somar modificações como linhas novas nem apresentar o total do repositório como produção do período.
- **Obrigação ao fim de cada tarefa:** o papel Especificador/commitador executa o comando oficial do README e registra saída real, versão do cloc e hash de destino em `docs/metrics/LOC-ap2.md`. Se indisponível, registrar pendência sem estimar.
- **Métrica auxiliar:** `npm run loc:total` e `docs/metrics/LOC.md` preservam o total e seus checkpoints históricos; não substituem a medição do recorte.
- `LOC_NO_RECORD=1 npm run loc:total` (PowerShell: `$env:LOC_NO_RECORD=1; npm run loc:total`) mede sem gravar; use apenas em inspeção. `--no-record` só funciona chamando `node scripts/count-loc-total.mjs --no-record` direto, porque o npm intercepta flags `--no-*`.
- Nunca editar `loc-checkpoints.json` à mão, e nunca inflar a contagem com código artificial, duplicado ou copiado.
- Se `cloc` não estiver disponível (ou `CLOC_BIN` não apontar para ele), registre a pendência no handoff sem estimar números.

## Validação

Após implementar, execute o conjunto compatível com a mudança:

```bash
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
```

Se algum comando depender de infraestrutura indisponível, registre exatamente o que não pôde ser validado; não invente sucesso.

`npm run spec:check` valida `HEAD` por padrão. Para uma sequência de commits, use `npm run spec:check -- <base>..HEAD`. A política objetiva e as limitações da V1 estão em `SPEC/README.md`.

## Handoff obrigatório

Toda entrega de implementação deve incluir `SPEC COMPLIANCE` com resultado `PASS`, `PARTIAL`, `BLOCKED`, `FAIL` ou `N/A`, além da classificação do SPEC Gate, caminho da SPEC (ou justificativa da isenção), evidências e desvios. Use o formato canônico de `SPEC/README.md`.

## Feedback de execução

Problemas estruturais encontrados durante uma tarefa devem seguir `docs/execution-issues/README.md`. Registre divergências relevantes de prompt, SPEC, guides, repositório, ambiente, dependências ou validação; não esconda falhas. Não registre debugging trivial ou erros intermediários corrigidos na própria execução.

Antes de implementação material, classifique os execution issues relevantes como `BLOCKS_CURRENT_TASK`, `RELATED_NON_BLOCKING` ou `OUT_OF_SCOPE`. Todo handoff material deve conter `EXECUTION ISSUES RECONCILIATION`, comparando estado anterior e final, ação, evidência e impacto na próxima fase. A definição normativa e o formato canônico permanecem centralizados em `docs/execution-issues/README.md`.


## Commits e rastreabilidade

Siga `docs/COMMIT-GUIDE.md`. Mudanças funcionais devem usar título `tipo(escopo): resumo`, possuir uma SPEC previamente commitada e incluir trailers `Agent:` e `Spec:`. Commits devem permanecer atômicos por plugin/domínio; não misture plugins independentes nem shell com mudanças não relacionadas.

- **Idioma:** título, corpo e trailers descritivos em português do Brasil.
- **Escopo estável:** mantenha o slug técnico do plugin/domínio (`shifts`, `handover`, `shell`, `security`); não traduza slugs, porque `spec:check` e `check:boundaries` dependem deles.
- **Autoria:** `author` e `committer` são a identidade humana configurada no Git local. Nenhum modelo de IA entra como autor, coautor, `Co-authored-by` ou e-mail de IA. O modelo executor aparece apenas no trailer `Agent:` como metadado de ferramenta, por exemplo `Agent: opencode/deepseek-v4.1-flash-free`.
- **Fonte do trailer:** registre o modelo que realmente executou a tarefa; se o modelo não for exposto, use `model-unavailable`; se não houve IA, `human/no-ai`.
- **Participação de todos os agentes:** todo commit de tarefa multiagente lista, no corpo, cada agente que atuou e seu papel — orquestração, SPEC/commit, implementação, revisão. Só entra quem realmente atuou; não invente papel.

```text
feat(tooling): mede linhas novas com cloc desde a baseline

Participação de agentes:
- opencode/glm-5.3-flash-free — orquestração, plano e go/no-go
- opencode/deepseek-v4.1-flash-free — SPEC, testes, mensagem de commit e validação
- openai/gpt-6-astra — implementação de código

Agent: opencode/deepseek-v4.1-flash-free
Spec: SPEC/2026-11-17-loc-baseline-and-new-line-tracking.md
```

O bloco `Participação de agentes:` é **corpo da mensagem**, separado por linha em branco dos trailers. `npm run spec:check` exige exatamente **um** trailer `Agent:` — o valor aceito é apenas `provedor/modelo` (`[A-Za-z0-9._-]`, uma única barra). Por isso não se cria um trailer por agente: a lista completa vive no corpo e o trailer nomeia quem executou o commit.

Execute commits locais atômicos do escopo solicitado após as validações aplicáveis, sem pedir confirmação a cada commit. Inclua apenas arquivos ou trechos pertinentes, preservando alterações de outras tarefas. Se o usuário proibir commits ou limitar a autorização à SPEC, respeite a restrição. Informe os hashes criados no handoff; quando houver bloqueio, registre a causa e a mensagem sugerida. Push, rebase, squash, reset, restore e force-push continuam exigindo pedido explícito próprio.
