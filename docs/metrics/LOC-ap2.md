# LOC desde o primeiro commit de ThiagoRM

Estado em 2026-11-25: medição executada com cloc 2.12 no commit de produto `50fe51972335babb5085e1f1a9530e670028165a`, após as correções offline desta sessão. O executável oficial foi baixado para uma pasta ignorada e seu SHA-256 foi conferido com o release upstream. Nenhum valor foi estimado. O handoff seguinte altera somente Markdown, excluído do comando, e não muda esta medição de código.

- Início inclusivo: `5bed0ad7aebf96538457a5f4e68833085a6976e5` (autor `ThiagoRM`, 2026-11-17).
- Base: `5aa147c297a0e68a8201b6fe2408175b2c78aa3c`, primeiro pai do commit inicial.
- Destino medido: `50fe51972335babb5085e1f1a9530e670028165a`.
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

Resumo real após a entrega offline: **11.315 linhas de código adicionadas, 131 modificadas e 0 removidas**. Acréscimo líquido: **11.315**. Código anterior inalterado: 83.386. A meta de 100.000 linhas no recorte não foi atingida. Os 94.061 registrados em `LOC.md` são o total histórico anterior do repositório e não servem como resultado desta medição. Preservar `LOC.md` e `loc-checkpoints.json` sem reescrever os checkpoints antigos.

`--git-diff-all` é necessário nesta execução: no HEAD anterior `bd29ba0`, a estratégia relativa do cloc 2.12 retornou somente 904 linhas adicionadas nos pares de arquivos modificados e omitiu os arquivos novos. A comparação completa daquele HEAD retornou 56 arquivos adicionados e 10.544 linhas adicionadas; após `50fe519`, são 57 arquivos adicionados e 11.315 linhas. Para reproduzir no Windows, manter o `tar.exe` do Windows antes do diretório Git `usr/bin` no PATH, mas disponibilizar também o `unzip.exe` do Git. Nesta máquina usou-se `C:\Windows\system32;C:\Program Files\Git\usr\bin` antes do PATH existente.

Saída literal da execução final (exit code 0):

```text
github.com/AlDanial/cloc v 2.12  T=33.07 s (24.4 files/s, 3152.3 lines/s)
-------------------------------------------------------------------------------
Language                     files          blank        comment           code
-------------------------------------------------------------------------------
TypeScript
 same                          652           4911           2030          73531
 modified                       33              0              0             43
 added                          51            482             48           9906
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
 added                          57            694            151          11315
 removed                         0              0              0              0
-------------------------------------------------------------------------------
```
