# Linhas de código (cloc)

Relatório gerado por `npm run loc:total` (`scripts/count-loc-total.mjs`). Não edite à mão.

## Checkpoint inicial

- Data: 2026-11-17
- Commit: `5aa147c297a0e68a8201b6fe2408175b2c78aa3c`
- Tamanho registrado: 83517 linhas de código em 751 arquivos
- Regra: Checkpoint do repositório antes da contagem contínua. O total acompanha o código atual; o checkpoint serve de referência histórica.

## Total atual

- Data: 2026-11-17T06:08:44.473Z
- Commit: `8094cab` (working tree com alterações)
- Total: **83692 linhas de código em 752 arquivos**
- Variação desde o checkpoint inicial: +175
- Variação desde o checkpoint anterior: +175

| Linguagem | Arquivos | Linhas de código |
| --- | --- | --- |
| TypeScript | 685 | 73574 |
| CSS | 28 | 3680 |
| Prisma Schema | 1 | 3054 |
| SQL | 25 | 2218 |
| JavaScript | 9 | 1101 |
| PowerShell | 3 | 53 |
| HTML | 1 | 12 |

## Checkpoints

| Data | Commit | Linhas de código | Arquivos | Variação |
| --- | --- | --- | --- | --- |
| 2026-11-17 | `5aa147c` | 83517 | 751 | — |
| 2026-11-17T06:08:44.473Z | `8094cab` | 83692 | 752 | +175 |

## Como medir

```bash
npm run loc:total                          # mede e registra checkpoint
LOC_NO_RECORD=1 npm run loc:total          # apenas mede
```
