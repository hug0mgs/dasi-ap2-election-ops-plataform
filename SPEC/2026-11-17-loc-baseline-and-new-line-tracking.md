# Baseline de LOC e contagem de linhas novas

## Status

`superseded`

> Substituída em 2026-11-17 por decisão do usuário: a contagem passou a acompanhar o **total** de linhas de código, mantendo o checkpoint histórico de 83.517 linhas (commit `5aa147c`). A norma vigente está em `AGENTS.md` §Contagem de linhas de código. Não existe SPEC sucessora registrada, conforme pedido explícito do usuário.

## Contexto

A rubrica da atividade usa `cloc` como comando oficial de contagem de linhas de código, e o `README.md` precisa publicar a saída real. A partir desta data o projeto também precisa acompanhar **apenas o código escrito a partir de agora**: tudo que já existia antes não entra na contagem.

Não existe hoje registro de baseline, nem forma reproduzível de medir quanto código novo cada tarefa adicionou. A execução manual de `cloc` sobre a árvore corrente mede o repositório inteiro, não a produção nova.

## Problema

Sem baseline versionada e sem comando reproduzível:

- cada medição mistura código histórico com código novo, impedindo afirmar quanto foi produzido;
- o número muda conforme arquivos são renomeados, removidos ou reformatados;
- o resultado depende de flags digitadas à mão;
- o agente não tem obrigação explícita de atualizar a contagem ao fim de cada tarefa.

## Objetivos

- fixar uma baseline imutável de linhas de código, ancorada em um commit;
- medir acréscimo, modificação e remoção desde a baseline usando `cloc --diff`;
- registrar o histórico de medições em artefato versionado;
- tornar obrigatória a atualização da contagem ao fim de cada tarefa;
- manter paridade com o comando oficial de `cloc` documentado no `README.md`.

## Escopo

- `SPEC/2026-11-17-loc-baseline-and-new-line-tracking.md` (esta SPEC);
- `docs/metrics/loc-baseline.json` — baseline imutável;
- `docs/metrics/loc-history.json` — histórico de medições;
- `docs/metrics/NEW-LOC.md` — relatório legível gerado pelo script;
- `scripts/count-new-loc.mjs` — medição reproduzível;
- `package.json` — script `loc:new`;
- `AGENTS.md` — obrigação de o papel Especificador/commitador atualizar a contagem ao fim da tarefa.

## Fora de escopo

- alterar `scripts/count-loc.mjs` ou o script `npm run count:loc`;
- alterar o comando oficial de `cloc` documentado no `README.md`;
- declarar que a meta de rubrica de 100.000 linhas foi atingida (a medição real atual está abaixo e continua registrada como pendência);
- instalar `cloc` automaticamente em CI, alterar pipelines ou criar enforcement automático;
- qualquer alteração de produto, plugin, API, banco ou UI.

## Baseline

- Data da fixação: 2026-11-17.
- Commit de referência: `5aa147c297a0e68a8201b6fe2408175b2c78aa3c` (último commit de código anterior a esta SPEC).
- Totais medidos: 83.517 linhas de código em 751 arquivos.
- Regra: a baseline é **imutável**. Ela não é recalculada, renumerada ou "atualizada para cima"; qualquer alteração exige SPEC nova e registro do motivo.

## Método de medição

1. extrair a árvore do commit da baseline com `git archive` em diretório temporário;
2. rodar `cloc --diff <arvore-base> .` com as mesmas exclusões do comando oficial;
3. rodar `cloc` na árvore corrente para obter o total atual autoritativo;
4. reportar linhas **adicionadas**, **modificadas**, **removidas**, **líquidas** (`atual − baseline`) e total atual;
5. anexar a medição a `docs/metrics/loc-history.json` e regerar `docs/metrics/NEW-LOC.md`.

O script aceita `--no-record` (ou `LOC_NEW_DRY=1`) para medir sem gravar (útil em inspeção). Atenção: `npm run loc:new -- --no-record` não funciona, porque o npm intercepta flags `--no-*` como configuração própria; use a variável de ambiente ou chame o script direto. Nunca editar `loc-history.json` à mão para maquiar números.

## Regras de honestidade

- linha gerada, duplicada ou copiada para inflar contagem é proibida;
- arquivo removido reduz a contagem líquida; remoção não é "código novo";
- a contagem inclui o próprio ferramental criado depois da baseline;
- se `cloc` não estiver disponível, registrar exatamente o que não pôde ser medido, sem estimar.

## Critérios de aceite

1. `docs/metrics/loc-baseline.json` existe, cita commit, data, comando e totais.
2. `npm run loc:new` mede a diferença desde a baseline e imprime tabela por linguagem.
3. Cada execução sem `--no-record` acrescenta uma entrada datada ao histórico e atualiza `docs/metrics/NEW-LOC.md`.
4. O total atual é obtido por medição própria, não derivado por aritmética do diff.
5. `AGENTS.md` determina que o papel Especificador/commitador (`opencode/deepseek-v4.1-flash-free`) atualize a contagem ao fim de cada tarefa.
6. Nenhum arquivo de produto é alterado.
7. A baseline não é reescrita por execuções posteriores.

## Validação

- executar `npm run loc:new` e conferir a tabela gerada;
- conferir que `docs/metrics/NEW-LOC.md` reflete a última medição;
- executar `git diff --check`;
- executar `npm run check:boundaries` como controle arquitetural;
- registrar comandos não executados e o motivo.
