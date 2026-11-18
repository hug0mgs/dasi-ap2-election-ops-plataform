# Guia de commits e rastreabilidade

Este repositório usa **Spec-Driven Development (SDD)** e arquitetura modular por plugins. O histórico Git deve preservar essa rastreabilidade: a SPEC vem antes da implementação e cada commit deve ter escopo claro.

## 1. Regra principal

Qualquer mudança que altere comportamento do produto, contrato, banco, API, UI, permissão ou regra operacional deve estar associada a uma SPEC válida.

Fluxo obrigatório:

1. criar ou atualizar `SPEC/<data>-<feature>.md`;
2. fazer o commit da SPEC **antes** do primeiro commit de implementação;
3. registrar/atualizar o prompt ou plano quando aplicável;
4. implementar em commits pequenos e coerentes;
5. validar;
6. usar trailers `Agent:` e `Spec:` nos commits de implementação;
7. registrar a sessão/prompt real sem reescrever o histórico para fabricar anterioridade.

Não use rebase, squash ou force-push para fingir que uma SPEC existia antes de código já commitado.

## 2. Formato do título do commit

Use o formato:

```text
<tipo>(<escopo>): <resumo objetivo>
```

Tipos preferenciais:

- `docs` — documentação, SPECs e prompts;
- `feat` — nova funcionalidade ou comportamento;
- `fix` — correção de defeito;
- `refactor` — reorganização sem mudança funcional intencional;
- `test` — testes;
- `perf` — melhoria de desempenho;
- `chore` — manutenção que não altera comportamento do produto;
- `build` — build/dependências;
- `ci` — automação/CI.

O resumo deve dizer o que o commit realmente entrega. Evite mensagens genéricas como `update`, `changes`, `fix stuff`, `final`, `ajustes` ou `wip`.

## 3. Escopo

O escopo deve refletir o menor domínio responsável pela mudança.

Para plugins, prefira o slug do plugin:

```text
feat(shifts): add coverage alerts
fix(handover): wire reverse prisma relations
feat(incidents): add critical incident filters
```

Para infraestrutura compartilhada, use um escopo explícito:

```text
feat(shell): redesign operational home and sidebar
docs(spec): define operational shell redesign
refactor(shared-incidents): isolate incident contracts
fix(security): enforce permission catalog mapping
chore(database): align local migration metadata
```

Não use um escopo amplo como `platform` quando a mudança pertence a um único plugin.

## 4. Commit da SPEC

A SPEC deve ser commitada antes do código correspondente.

Formato recomendado:

```text
docs(spec): define operational shell redesign

Agent: chatgpt/gpt-5.6-sol
Spec: SPEC/2026-10-03-operational-shell-ui.md
```

Se a SPEC foi escrita sem auxílio de IA, não invente um modelo. Use:

```text
Agent: human/no-ai
```

Se a ferramenta de IA foi usada mas o modelo não é exposto, registre isso literalmente, por exemplo:

```text
Agent: codex/model-unavailable
```

O trailer `Spec:` do commit da própria SPEC pode apontar para o arquivo que está sendo introduzido.

## 5. Commit de implementação

Todo commit que altera comportamento do produto deve incluir, após uma linha em branco:

```text
Agent: <ferramenta/modelo-real-ou-indisponivel>
Spec: SPEC/<arquivo>.md
```

Exemplo:

```text
feat(shell): simplify operational dashboard hierarchy

Agent: codex/model-unavailable
Spec: SPEC/2026-10-03-operational-shell-ui.md
```

Outro exemplo:

```text
feat(shifts): add on-call substitution workflow

Agent: claude/<modelo-real-ou-indisponivel>
Spec: SPEC/2026-10-01-shifts.md
```

Quando mais de uma SPEC for realmente necessária, podem existir múltiplas linhas `Spec:`, mas prefira dividir a mudança em commits menores sempre que os domínios forem independentes.

### Participação de agentes (tarefas multiagente)

Quando a tarefa envolver mais de um agente, registre no **corpo** da mensagem quem atuou e em qual papel. A lista é corpo, não trailer: `npm run spec:check` (V1) exige exatamente um `Agent:` e aceita apenas o formato `provedor/modelo`.

```text
feat(tooling): mede linhas novas com cloc desde a baseline

Participação de agentes:
- opencode/glm-5.3-flash-free — orquestração, plano e go/no-go
- opencode/deepseek-v4.1-flash-free — SPEC, mensagem de commit e validação
- openai/gpt-6-astra — implementação de código

Agent: opencode/deepseek-v4.1-flash-free
Spec: SPEC/2026-11-17-loc-baseline-and-new-line-tracking.md
```

Regras: registrar apenas agentes que realmente atuaram; o trailer `Agent:` nomeia quem executou o commit; a autoria (`author`/`committer`) continua humana e sem coautoria de modelo.

## 6. Atomicidade e isolamento

Um commit deve representar **uma unidade lógica revisável**.

Regras:

- não misture redesign do shell com correção interna de um plugin não relacionado;
- não misture dois plugins independentes no mesmo commit;
- mudanças necessárias em `packages/shared`, `packages/database`, `packages/security`, Event Bus ou pontos de composição podem acompanhar o commit do plugin quando forem inseparáveis da feature;
- se essas mudanças compartilhadas tiverem valor independente, faça commit separado e mantenha a mesma SPEC ou a SPEC apropriada;
- o commit não deve exigir que o revisor carregue todo o monorepo para entender a intenção;
- preserve as fronteiras verificadas por `npm run check:boundaries`.

A mesma regra de baixo contexto usada pelos agentes vale para o histórico Git: pelo título, escopo, SPEC e diff deve ser possível entender qual domínio mudou.

## 7. Mudança de SPEC durante a implementação

Se durante a implementação surgir uma mudança material de requisito:

1. atualize a SPEC primeiro;
2. faça um novo commit `docs(spec): ...` contendo somente a mudança documental relevante;
3. depois continue e faça o commit de implementação associado à nova versão da SPEC.

Não deixe o código definir silenciosamente um comportamento que a SPEC não descreve.

## 8. Commits não funcionais

Manutenção puramente técnica que não altera comportamento de produto pode não exigir uma nova SPEC, por exemplo:

```text
chore(tooling): update local validation script
ci(checks): run plugin boundary validation
```

Mesmo nesses casos, não use `Spec: none` para esconder uma mudança funcional. Se a alteração muda comportamento observável, contrato, banco, permissão ou UI, ela precisa de SPEC.

Quando houver uma SPEC relacionada mesmo em manutenção técnica, referencie-a normalmente.

### Isenção explícita

Na política automatizada V1, commits `feat`, `fix`, `refactor` e `perf` exigem `Agent:` e `Spec:`. Quando um desses commits for legitimamente `SPEC_EXEMPT`, use:

```text
Agent: <identificador>
Spec: EXEMPT
Spec-Exempt-Reason: <justificativa curta>
```

Não use `EXEMPT` como substituto de uma SPEC necessária. O checker valida a presença da justificativa, não seu mérito.

## 9. Antes de criar o commit

Verifique:

- a SPEC relevante já está commitada e aparece antes da implementação no histórico;
- somente arquivos do escopo pretendido estão staged;
- não há segredos, `.env`, credenciais ou artefatos de build;
- não há imports proibidos entre plugins;
- validações compatíveis foram executadas;
- o título descreve a entrega real;
- trailers `Agent:` e `Spec:` estão corretos quando exigidos.

Valide a rastreabilidade do commit ou range pretendido:

```bash
npm run spec:check
npm run spec:check -- <base>..HEAD
```

O primeiro comando analisa `HEAD`. O segundo é apropriado para uma série local ou futura integração em CI.

Para mudanças relevantes, execute conforme o escopo:

```bash
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
```

Não declare um comando como aprovado se ele não foi executado.

## 10. Agentes de IA e Git

Agentes devem executar `git add` e `git commit` locais das alterações da tarefa solicitada sem pedir confirmação a cada commit, conforme a revisão de 2026-11-18 de `SPEC/2026-11-17-agent-orchestration-and-delivery-standard.md`. A autorização abrange SPEC, implementação, testes e documentação pertinentes. Uma instrução explícita posterior que proíba commits ou limite a autorização à SPEC prevalece.

A autorização permanente não permite incluir alterações de outras tarefas. Em arquivos compartilhados, selecione apenas os trechos pertinentes; se não puder isolá-los com confiança, registre o bloqueio. A entrega informa hashes reais dos commits criados. Quando o commit estiver impedido por restrição explícita ou validação relevante pendente, informe a causa e uma mensagem sugerida.

Antes de cada commit local, o agente deve:

1. confirmar a SPEC associada;
2. revisar `git status --short`, os arquivos staged e o diff staged, conferindo escopo e ausência de credenciais;
3. executar as validações aplicáveis;
4. criar o commit no formato deste documento;
5. não fazer push automaticamente, salvo pedido explícito.

`git push`, `git reset`, `git restore`, `git rebase`, `git merge --squash`, `git push --force` e operações equivalentes continuam exigindo autorização explícita própria. Falhas de validação relevantes para a tarefa impedem o commit da implementação afetada; falhas comprovadamente externas devem ser documentadas com evidência e decisão do orquestrador.

## 11. Exemplos para este projeto

### Redesign do shell

```text
docs(spec): define operational shell redesign

Agent: chatgpt/gpt-5.6-sol
Spec: SPEC/2026-10-03-operational-shell-ui.md
```

```text
feat(shell): redesign home and collapsible sidebar

Agent: codex/model-unavailable
Spec: SPEC/2026-10-03-operational-shell-ui.md
```

### Plugin isolado

```text
feat(documents-evidence): add immutable evidence storage

Agent: codex/model-unavailable
Spec: SPEC/2026-10-01-documents-evidence.md
```

### Correção de integração

```text
fix(handover): complete prisma reverse relations

Agent: codex/model-unavailable
Spec: SPEC/<spec-do-handover>.md
```

O objetivo não é produzir muitos commits artificiais; é manter um histórico cronológico, auditável e coerente com a arquitetura e com as SPECs reais.
