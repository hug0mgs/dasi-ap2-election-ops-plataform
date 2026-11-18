# Plano — Commits locais autônomos

**Data:** 2026-11-18
**Papel/modelo real:** Orquestrador — `openai/gpt-6-astra`
**SPEC Gate:** `UPDATE_SPEC`
**SPEC:** `SPEC/2026-11-17-agent-orchestration-and-delivery-standard.md`

## Objetivo

Aplicar a autorização permanente solicitada pelo usuário para commits locais do escopo da tarefa, sem confirmação individual. Preservar a exigência de SPEC anterior ao código, a autoria humana, os trailers e o isolamento das alterações.

## Fases e arquivos

1. Commit isolado da SPEC de conciliação já existente, autorizado expressamente pelo usuário. Registrar que o código parcial foi escrito antes desse commit.
2. Atualização normativa da política em `SPEC/2026-11-17-agent-orchestration-and-delivery-standard.md`, `SPEC/README.md` e SPECs de governança/verificação que exigiam autorização individual. Commit anterior à adaptação dos guias.
3. Alinhar `AGENTS.md`, `plugins/AGENTS.md`, `docs/AI-PLUGIN-GUIDE.md` e `docs/COMMIT-GUIDE.md`. Registrar o pedido literal em sessões.
4. Verificar diff, rastreabilidade do intervalo de commits e fronteiras. Medir LOC pelo comando oficial e informar resultados reais.

Modelo executor das fases documentais: `openai/gpt-6-astra`. Alteração documental direta pelo orquestrador; sem código de produto nesta fase. O modelo de referência do papel de commitador não foi selecionado nesta sessão; registrar o modelo real.

## Critérios de aceite

- Nenhum guia ativo exige confirmação individual para commits locais do escopo solicitado.
- Uma restrição explícita posterior do usuário prevalece.
- Push e reescrita do histórico continuam exigindo autorização própria.
- Trabalho preexistente de outras tarefas fica preservado e fora do staging.
- Handoff informa hashes, evidências e pendências sem fabricar anterioridade.

## Preflight e riscos

- `RELATED_NON_BLOCKING`: `AGENTS.md` contém mudanças anteriores sobre o dono dos testes. Selecionar somente os trechos desta alteração para o commit de governança.
- `RELATED_NON_BLOCKING`: o código parcial da conciliação antecedeu o commit da SPEC. Preservar o fato histórico; não reescrever histórico.
- `OUT_OF_SCOPE`: alterações de offline, BI e vistorias presentes na árvore. Não incluir nos commits desta tarefa.

## Go/no-go

Go após SPEC normativa commitada, diff documental revisado e validações compatíveis aprovadas. No-go se staging incluir trabalho alheio ou se uma restrição explícita posterior impedir o commit.
