# Linhas de código (cloc)

Relatório gerado por `npm run loc:total` (`scripts/count-loc-total.mjs`). Não edite à mão.

## Checkpoint inicial

- Data: 2026-11-17
- Commit: `5aa147c297a0e68a8201b6fe2408175b2c78aa3c`
- Tamanho registrado: 83517 linhas de código em 751 arquivos
- Regra: Checkpoint do repositório antes da contagem contínua. O total acompanha o código atual; o checkpoint serve de referência histórica.

## Total atual

- Data: 2026-11-27T04:47:44.908Z
- Commit: `bd29ba0` (working tree com alterações)
- Total: **94290 linhas de código em 808 arquivos**
- Variação desde o checkpoint inicial: +10773
- Variação desde o checkpoint anterior: +229

| Linguagem | Arquivos | Linhas de código |
| --- | --- | --- |
| TypeScript | 736 | 82938 |
| CSS | 31 | 4213 |
| Prisma Schema | 1 | 3458 |
| SQL | 27 | 2515 |
| JavaScript | 9 | 1101 |
| PowerShell | 3 | 53 |
| HTML | 1 | 12 |

## Checkpoints

| Data | Commit | Linhas de código | Arquivos | Variação |
| --- | --- | --- | --- | --- |
| 2026-11-17 | `5aa147c` | 83517 | 751 | — |
| 2026-11-17T06:08:44.473Z | `8094cab` | 83692 | 752 | +175 |
| 2026-11-17T07:09:58.801Z | `d16ef38` | 83971 | 753 | +279 |
| 2026-11-17T14:16:18.847Z | `edad0ac` | 84932 | 778 | +961 |
| 2026-11-18T22:34:04.594Z | `edad0ac` | 93500 | 807 | +8568 |
| 2026-11-18T22:48:10.119Z | `64cbd7c` | 94061 | 807 | +561 |
| 2026-11-25T00:42:13.185Z | `324a66c` | 94061 | 807 | +0 |
| 2026-11-25T00:50:59.701Z | `dfd532f` | 94061 | 807 | +0 |
| 2026-11-27T04:47:44.908Z | `bd29ba0` | 94290 | 808 | +229 |

## Como medir

```bash
npm run loc:total                          # mede e registra checkpoint
LOC_NO_RECORD=1 npm run loc:total          # apenas mede
```
