#!/usr/bin/env node
/**
 * Conta o total de linhas de codigo do projeto com cloc.
 *
 * O checkpoint inicial registra o tamanho do repositorio quando a contagem
 * continua comecou (2026-11-17, commit 5aa147c, 83.517 linhas). A partir dele
 * o relatorio acompanha o TOTAL, nao apenas o codigo novo.
 *
 * Uso:
 *   npm run loc:total                     # mede, grava checkpoint e regera LOC.md
 *   $env:LOC_NO_RECORD=1; npm run loc:total   # apenas mede
 *
 * Variavel opcional: CLOC_BIN=/caminho/para/cloc
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const metricsDir = path.join(repoRoot, 'docs', 'metrics');
const checkpointsPath = path.join(metricsDir, 'loc-checkpoints.json');
const reportPath = path.join(metricsDir, 'LOC.md');

const EXCLUDES = [
  '--exclude-dir=node_modules,vendor,dist,build,prompts,graphify-out,.git',
  '--exclude-lang=Markdown,JSON,YAML,CSV,Text,SVG',
  '--not-match-f=(lock|\\.min\\.)'
];

const args = process.argv.slice(2);
// `npm run ... -- --no-record` nao funciona: o npm trata `--no-*` como configuracao
// propria e nao repassa a flag. Por isso a medicao seca tambem aceita LOC_NO_RECORD=1.
const record = !(
  args.includes('--no-record') ||
  args.includes('--dry-run') ||
  process.env.LOC_NO_RECORD === '1'
);

function fail(message) {
  console.error(`erro: ${message}`);
  process.exit(1);
}

function resolveCloc() {
  const candidates = [
    process.env.CLOC_BIN,
    'cloc',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Programs', 'cloc', 'cloc.exe')
      : undefined,
    '/usr/bin/cloc',
    '/usr/local/bin/cloc'
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const version = execFileSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      if (version) return { bin: candidate, version };
    } catch {
      // tenta o proximo candidato
    }
  }

  fail(
    'cloc nao encontrado. Instale (ex.: winget/choco cloc, ou baixe cloc-*.exe) e defina CLOC_BIN se necessario.'
  );
}

function runCloc(clocBin, reportFile) {
  execFileSync(clocBin, ['.', ...EXCLUDES, '--json', '--quiet', `--report-file=${reportFile}`], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(fs.readFileSync(reportFile, 'utf8'));
}

if (!fs.existsSync(checkpointsPath)) {
  fail(`checkpoints ausentes: ${path.relative(repoRoot, checkpointsPath)}`);
}
const data = JSON.parse(fs.readFileSync(checkpointsPath, 'utf8'));
const initial = data.initial;
if (!initial?.code || !Array.isArray(data.checkpoints)) {
  fail('arquivo de checkpoints invalido: faltam "initial.code" ou "checkpoints"');
}

const { bin: clocBin, version: clocVersion } = resolveCloc();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eops-loc-'));
const reportFile = path.join(tmpDir, 'current.json');

try {
  const report = runCloc(clocBin, reportFile);
  const totals = {
    code: Number(report?.SUM?.code ?? 0),
    comment: Number(report?.SUM?.comment ?? 0),
    blank: Number(report?.SUM?.blank ?? 0),
    files: Number(report?.SUM?.nFiles ?? 0)
  };
  if (!totals.code) fail('cloc nao retornou linhas de codigo');

  const languages = Object.entries(report)
    .filter(([key, value]) => key !== 'header' && key !== 'SUM' && value?.code)
    .map(([language, value]) => ({
      language,
      files: Number(value.nFiles ?? 0),
      code: Number(value.code ?? 0)
    }))
    .sort((a, b) => b.code - a.code);

  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;

  const previous = data.checkpoints.at(-1) ?? initial;
  const checkpoint = {
    date: new Date().toISOString(),
    commit: headSha,
    workingTreeDirty: dirty,
    clocVersion,
    code: totals.code,
    files: totals.files,
    deltaSincePrevious: totals.code - previous.code
  };

  if (record) {
    data.checkpoints.push(checkpoint);
    fs.writeFileSync(checkpointsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.writeFileSync(reportPath, renderReport(initial, checkpoint, data, languages), 'utf8');
  }

  printSummary(initial, checkpoint, previous, totals);
  console.log(
    record
      ? `Checkpoint registrado em ${path.relative(repoRoot, checkpointsPath)} e ${path.relative(repoRoot, reportPath)}.`
      : 'Checkpoint nao registrado (LOC_NO_RECORD=1).'
  );
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function printSummary(base, current, previous, totals) {
  const sign = (value) => `${value >= 0 ? '+' : ''}${value}`;
  console.log(`cloc ${current.clocVersion}`);
  console.log('');
  console.log(
    `Checkpoint inicial : ${base.code} linhas de codigo em ${base.files} arquivos (${String(base.commit).slice(0, 7)}, ${base.date})`
  );
  console.log(`Total atual        : ${totals.code} linhas de codigo em ${totals.files} arquivos`);
  console.log(`Variacao           : ${sign(totals.code - base.code)} desde o checkpoint inicial`);
  console.log(
    `Ultimo checkpoint  : ${previous.code} linhas (${previous.date}) | variacao ${sign(totals.code - previous.code)}`
  );
}

function renderReport(base, current, data, languages) {
  const sign = (value) => `${value >= 0 ? '+' : ''}${value}`;
  const lines = [];
  lines.push('# Linhas de código (cloc)');
  lines.push('');
  lines.push('Relatório gerado por `npm run loc:total` (`scripts/count-loc-total.mjs`). Não edite à mão.');
  lines.push('');
  lines.push('## Checkpoint inicial');
  lines.push('');
  lines.push(`- Data: ${base.date}`);
  lines.push(`- Commit: \`${base.commit}\``);
  lines.push(`- Tamanho registrado: ${base.code} linhas de código em ${base.files} arquivos`);
  lines.push(`- Regra: ${base.note}`);
  lines.push('');
  lines.push('## Total atual');
  lines.push('');
  lines.push(`- Data: ${current.date}`);
  lines.push(`- Commit: \`${current.commit.slice(0, 7)}\`${current.workingTreeDirty ? ' (working tree com alterações)' : ''}`);
  lines.push(`- Total: **${current.code} linhas de código em ${current.files} arquivos**`);
  lines.push(`- Variação desde o checkpoint inicial: ${sign(current.code - base.code)}`);
  lines.push(`- Variação desde o checkpoint anterior: ${sign(current.deltaSincePrevious)}`);
  lines.push('');
  lines.push('| Linguagem | Arquivos | Linhas de código |');
  lines.push('| --- | --- | --- |');
  for (const row of languages) {
    lines.push(`| ${row.language} | ${row.files} | ${row.code} |`);
  }
  lines.push('');
  lines.push('## Checkpoints');
  lines.push('');
  lines.push('| Data | Commit | Linhas de código | Arquivos | Variação |');
  lines.push('| --- | --- | --- | --- | --- |');
  lines.push(`| ${base.date} | \`${String(base.commit).slice(0, 7)}\` | ${base.code} | ${base.files} | — |`);
  for (const entry of data.checkpoints) {
    lines.push(
      `| ${entry.date} | \`${String(entry.commit).slice(0, 7)}\` | ${entry.code} | ${entry.files} | ${sign(
        entry.deltaSincePrevious ?? 0
      )} |`
    );
  }
  lines.push('');
  lines.push('## Como medir');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run loc:total                          # mede e registra checkpoint');
  lines.push('LOC_NO_RECORD=1 npm run loc:total          # apenas mede');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}
