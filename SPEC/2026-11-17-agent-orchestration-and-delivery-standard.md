# Orquestração de agentes, SDD e padrão de entrega

## Status

`approved`

## Contexto

A Election Ops Platform já possui governança de SPEC Gate, fronteiras de workspace, protocolo de execution issues e handoff `SPEC COMPLIANCE`, formalizados em [`2026-10-04-agent-governance-and-spec-enforcement.md`](2026-10-04-agent-governance-and-spec-enforcement.md). Essas regras são neutras quanto a ferramenta e respondem **o que** um agente deve fazer, mas não definem **quem** executa cada etapa, com qual modelo, a partir de qual plano e sob quais limites de autoria.

Com a adoção de sessões multiagentes, surgem riscos concretos:

- o mesmo agente acumular planejamento, implementação e commit, perdendo a revisão independente;
- planos ficarem apenas na conversa e não sobreviverem à sessão;
- commits registrarem modelos de IA como autores do repositório humano;
- mensagens de commit em idioma diferente do restante da documentação do projeto;
- estilo de resposta econômico de uma skill de implementação vazar para código, SPECs ou mensagens de commit;
- escopo funcional ser inventado quando a tarefa ainda não foi definida.

## Problema

Sem uma política operacional de orquestração, agentes podem: executar implementação sem plano verificável, trocar de modelo sem registrar o modelo real, atribuir autoria indevida a um modelo, produzir commits fora do padrão SDD, ou tratar como requisito algo que o usuário nunca definiu.

## Objetivos

- definir papéis e modelos por etapa, com registro do modelo real em cada entrega;
- tornar o plano de execução um artefato versionado, distinto de SPEC e de prompt;
- manter a SPEC como fonte normativa e preservar a ordem SPEC antes do código;
- padronizar commits em português do Brasil, com autoria humana e rastreabilidade por trailers;
- garantir que o estilo de resposta do implementador não altere artefatos do repositório;
- vedar invenção de escopo quando a tarefa não estiver definida;
- manter cobertura de testes mapeada para a estrutura real do monorepo;
- reforçar a higiene de segredos e o registro literal de sessões.

## Escopo

- `AGENTS.md` (entrada comum de agentes);
- esta SPEC como referência normativa da orquestração;
- convenção de plano em `docs/plans/`;
- política de idioma e autoria de commits, complementando `docs/COMMIT-GUIDE.md`;
- mapeamento de cobertura de testes para unitário, integração e E2E;
- requisitos de README (URL pública, ferramentas/modelos de IA, saída real de `cloc`);
- registro de sessões em `prompts/sessoes/`.

## Fora de escopo

- criar, alterar ou implementar funcionalidade de produto, plugin, API, banco, RBAC, UI ou Event Bus;
- definir a próxima tarefa funcional do projeto (ainda não definida pelo usuário);
- criar `SPEC/2026-10-01-threat-analyzer.md` ou qualquer SPEC de domínio de análise de ameaças;
- reformatar a árvore de testes existente para `tests/unit` e `tests/integration`;
- criar scripts, jobs de CI ou enforcement automático novo;
- commitar implementação, fazer push, rebase, squash, reset ou force-push.

## Papéis e modelos

Cada sessão declara exatamente um papel e o **modelo real** em uso.

| Papel | Modelo de referência | Responsabilidades |
| --- | --- | --- |
| Orquestrador | `opencode/glm-5.3-flash-free` | ler SPEC e guides, decompor a tarefa, produzir o plano de execução, despachar implementação, revisar resultado, decidir go/no-go, autorizar commit |
| Especificador e commitador | `opencode/deepseek-v4.1-flash-free` | criar/atualizar a SPEC conforme SDD, redigir mensagens de commit em PT-BR, conferir trailers e rastreabilidade, executar validações de entrega |
| Implementador | Codex com a skill `caveman` | escrever código e testes, executar build/testes/lint, corrigir defeitos dentro do escopo aprovado |

Regras:

1. se o modelo real divergir do modelo de referência, registrar o **modelo real** no trailer `Agent:` e no handoff; nenhum agente pode declarar um modelo que não executou;
2. o orquestrador não implementa código diretamente, salvo tarefa explicitamente trivial e registrada;
3. o implementador não altera SPEC, premissas, contrato público, RBAC ou escopo; divergência volta ao orquestrador;
4. quando a ferramenta não permitir fixar o modelo de um subagente, registrar a limitação no handoff em vez de supor que o modelo foi respeitado;
5. o papel de commitador não substitui a autorização explícita do usuário para `git add`/`git commit`.

## Plano de execução

Antes de implementação material, o orquestrador materializa um plano datado em `docs/plans/YYYY-MM-DD-<slug>.md`, contendo:

- objetivo e resultado esperado;
- `SPEC Gate` e caminho da SPEC aplicável;
- fases ordenadas, com arquivos/domínios por fase e dependências;
- critérios de aceite verificáveis e validações por fase;
- riscos, gatilhos go/no-go e o que fica fora de escopo;
- modelo designado para cada fase.

O plano é **descritivo e operacional**: não substitui a SPEC normativa, não cria requisito funcional e não autoriza commit. Enquanto a tarefa funcional do projeto não estiver definida pelo usuário, o orquestrador registra o bloqueio e solicita decisão em vez de propor escopo de produto por conta própria.

## Fluxo SDD

1. classificar o `SPEC Gate` antes da primeira alteração de implementação;
2. criar ou atualizar a SPEC datada em `SPEC/YYYY-MM-DD-<slug>.md`;
3. commitar a SPEC antes do código correspondente (com autorização);
4. gerar o plano de execução em `docs/plans/`;
5. implementar em escopo restrito;
6. validar conforme a matriz de comandos;
7. registrar a sessão literal em `prompts/sessoes/`;
8. entregar `SPEC COMPLIANCE` e `EXECUTION ISSUES RECONCILIATION`.

## Política de commits

- Título no formato `<tipo>(<escopo>): <resumo>` com resumo e corpo em **português do Brasil**.
- O `escopo` permanece estável e técnico (slug do plugin ou domínio compartilhado, por exemplo `shifts`, `handover`, `shell`, `security`); não traduzir slugs, pois `spec:check` e `check:boundaries` dependem deles.
- `author` e `committer` são a identidade humana configurada no Git local. Nenhum modelo de IA entra como autor, coautor, `Co-authored-by` ou e-mail de IA.
- O modelo executor aparece exclusivamente no trailer `Agent:` como metadado de ferramenta, no formato `<provedor>/<modelo>` (por exemplo `opencode/deepseek-v4.1-flash-free`).
- Todo commit de tarefa multiagente registra no **corpo** a participação completa: uma seção `Participação de agentes:` com um item por agente que realmente atuou e seu papel (orquestração/plano, SPEC/commit, implementação, revisão). Não registrar papéis que não ocorreram.
- O trailer `Agent:` permanece **único** e nomeia quem executou o commit; a lista de participantes vive no corpo porque `npm run spec:check` (V1) exige exatamente um `Agent:` e aceita apenas `provedor/modelo`.
- Commits `feat`, `fix`, `refactor` e `perf` exigem `Agent:` e `Spec:`; demais tipos seguem `docs/COMMIT-GUIDE.md`.
- Se a mensagem for gerada sem IA, usar `Agent: human/no-ai`; se o modelo não for exposto, registrar `model-unavailable`, sem inventar identificador.

## Execução de código

- O implementador usa Codex carregando a skill `caveman` para respostas curtas e economia de contexto.
- O estilo `caveman` vale apenas para a conversa: código, comentários, SPECs, documentação e mensagens de commit usam PT-BR técnico e o padrão do repositório.
- O implementador segue os padrões existentes do monorepo (NestJS, React, Prisma, ESLint, tipagem estrita) e não introduz biblioteca, estrutura de pastas ou convenção nova sem aprovação.

## Cobertura de testes

O repositório mantém testes colocados junto ao código-fonte. O mapeamento normativo é:

| Camada | Local real | Comando |
| --- | --- | --- |
| Unitário | `*.test.ts` ao lado do arquivo testado (plugins e packages) | `npm test` |
| Integração | testes de service/rota com banco e plugins reais, também colocados junto ao código | `npm test` |
| E2E | `tests/e2e/*.spec.ts` e `tests/e2e/flows/*.spec.ts` | `npm run e2e` |

Se um domínio novo não tiver casa natural ao lado do código, os testes podem ir para `tests/unit/` ou `tests/integration/`, explicitando o motivo na SPEC correspondente. Não criar árvores duplicadas de teste para o mesmo módulo.

Toda SPEC de funcionalidade deve declarar quais camadas cobre e quais ficam pendentes de infraestrutura.

## Higiene e segurança

- Nenhum segredo, chave, senha, token ou string de conexão real pode ser commitado; `core` de configuração usa variáveis de ambiente e `.env.example`.
- Antes de qualquer commit, revisar `git status --short` e o diff staged, procurando credenciais.
- Exportações de sessão vão para `prompts/sessoes/` com nome `YYYY-MM-DD-<ferramenta>-<slug>.md`; revisar segredos antes de versionar. Arquivos em `prompts/resumos/` não substituem exportações literais.
- Não versionar artefatos de build, caches locais ou dumps de banco.

## README e métricas

- `README.md` deve manter, no início, a URL pública do projeto como link clicável; se indisponível, registrar `PENDENTE` de forma explícita.
- `README.md` deve listar as ferramentas e modelos de IA efetivamente utilizados.
- `README.md` deve conter a saída real do comando oficial de `cloc` documentado nele.
- A meta de rubrica de pelo menos 100.000 linhas contabilizadas só pode ser declarada após medição real com o comando oficial. É proibido inflar contagem com código gerado artificialmente, arquivos duplicados ou exclusões seletivas para maquiar o número; se a medição ficar abaixo da meta, registrar a pendência.

## Critérios de aceite

1. `AGENTS.md` declara a finalidade do projeto como Election Ops Platform e mantém as regras vigentes de SPEC Gate, fronteiras, execution issues, validação e handoff.
2. `AGENTS.md` define papéis e modelos de orquestração, especificação/commit e implementação, com obrigação de registrar o modelo real.
3. Existe convenção de plano em `docs/plans/` distinta de SPEC e de prompt.
4. A política de commits exige PT-BR, autoria humana, modelo apenas no trailer `Agent:` e seção de participação de todos os agentes no corpo.
5. O uso da skill `caveman` está restrito à conversa do implementador.
6. A cobertura de testes está mapeada para a estrutura real do monorepo, sem duplicar árvores.
7. As regras de higiene de segredos e de registro de sessão estão explícitas.
8. Os requisitos de README (URL, ferramentas/modelos, `cloc`) estão documentados com proibição de número fabricado.
9. A ausência de tarefa funcional definida não é preenchida com escopo inventado.
10. Nenhuma funcionalidade, plugin, contrato, banco, UI ou automação de CI é alterada por esta SPEC.

## Validação

- conferir que `AGENTS.md` preserva as seções de SPEC Gate, contexto mínimo, fronteiras, validação, handoff e feedback de execução;
- executar `git diff --check` nos arquivos alterados;
- verificar que o caminho citado (`docs/plans/`) é apenas convenção e não exige criação imediata de diretório;
- executar `npm run check:boundaries` como controle arquitetural compatível;
- confirmar que nenhum arquivo de produto, teste, banco ou CI foi modificado;
- registrar no handoff os comandos não executados e o motivo.
