# LOC desde o primeiro commit de ThiagoRM

Estado em 2026-11-27: medição executada com cloc 2.12 no commit de produto `28136b4`, após a conclusão dos testes E2E e validação integral da conciliação de encerramento do pleito (`SPEC/2026-11-18-conciliacao-encerramento-pleito.md`). O executável oficial em `test-results/cloc-2.12.exe` foi utilizado com `--git-diff-all --diff`. Nenhum valor foi estimado.

- Início inclusivo: `5bed0ad7aebf96538457a5f4e68833085a6976e5` (autor `ThiagoRM`, 2026-11-17).
- Base: `5aa147c297a0e68a8201b6fe2408175b2c78aa3c`, primeiro pai do commit inicial.
- Destino medido: `28136b4` (2026-11-27).
- Recorte inclui mudanças de todos os autores desde o início, apenas entre árvores commitadas. Não mede autoria exclusiva de ThiagoRM nem soma de trabalho intermediário depois removido.

## Comando oficial

Na raiz do repositório, com Git e cloc disponíveis:

```powershell
git rev-parse HEAD
cloc --version
cloc --git --git-diff-all --diff 5aa147c297a0e68a8201b6fe2408175b2c78aa3c HEAD `
  --exclude-dir=node_modules,vendor,dist,build,prompts `
  --exclude-lang=Markdown,JSON,YAML,CSV,Text,SVG `
  --not-match-f='(lock|\.min\.)'
```

O modo de comparação é documentado no [manual oficial do cloc](https://github.com/AlDanial/cloc#differences). Registrar a saída literal, incluindo as categorias adicionadas, modificadas, removidas e inalteradas. Somente as três primeiras descrevem mudanças no período; acréscimo líquido = adicionadas − removidas. Não usar `git diff --numstat` como substituto do cloc.

## Saída real

Resumo real após a conclusão da conciliação de encerramento: **11.743 linhas de código adicionadas, 131 modificadas e 0 removidas**. Acréscimo líquido: **11.743**. Código anterior inalterado: 83.386. A meta de 100.000 linhas no recorte permanece pendente. Os 94.061 registrados em `LOC.md` são o total histórico anterior do repositório e não servem como resultado desta medição. Preservar `LOC.md` e `loc-checkpoints.json` sem reescrever os checkpoints antigos.

`--git-diff-all` é necessário nesta execução: inclui todos os arquivos novos na comparação completa das árvores entre o commit base e o HEAD atual.

Saída literal da execução final (exit code 0):

```text
github.com/AlDanial/cloc v 2.12  T=36.95 s (21.9 files/s, 2833.8 lines/s)
-------------------------------------------------------------------------------
Language                     files          blank        comment           code
-------------------------------------------------------------------------------
TypeScript
 same                          652           4911           2030          73531
 modified                       33              0              0             43
 added                          53            517             64          10334
 removed                         0              0              0              0
CSS
 same                           27            366             48           3680
 modified                        1              0              0              0
 added                           3             52              0            533
 removed                         0              0              0              0
Prisma Schema
 same                            0              0             10           2966
 modified                        1              0              0             88
 added                           0             45              4            404
 removed                         0              0              0              0
SQL
 same                           25            568            446           2218
 modified                        0              0              0              0
 added                           2             95             83            297
 removed                         0              0              0              0
JavaScript
 same                            8            172             10            926
 modified                        0              0              0              0
 added                           1             20             16            175
 removed                         0              0              0              0
PowerShell
 same                            3              3              0             53
 modified                        0              0              0              0
 added                           0              0              0              0
 removed                         0              0              0              0
HTML
 same                            1              0              0             12
 modified                        0              0              0              0
 added                           0              0              0              0
 removed                         0              0              0              0
-------------------------------------------------------------------------------
SUM:
 same                          716           6020           2544          83386
 modified                       35              0              0            131
 added                          59            729            167          11743
 removed                         0              0              0              0
-------------------------------------------------------------------------------
```
