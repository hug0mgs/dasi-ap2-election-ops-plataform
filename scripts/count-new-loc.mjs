#!/usr/bin/env node
/**
 * Mede quantas linhas de codigo foram escritas desde a baseline de LOC.
 *
 * Baseline imutavel: docs/metrics/loc-baseline.json (commit 5aa147c, 2026-11-17).
 * Metodo: cloc --diff entre a arvore do commit da baseline e a arvore atual,
 * mais um cloc independente da arvore atual para o total autoritativo.
 *
 * Uso:
 *   npm run loc:new              # mede, grava no historico e regera NEW-LOC.md
 *   npm run loc:new -- --no-record   # apenas mede, sem gravar
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
const baselinePath = path.join(metricsDir, 'loc-baseline.json');
const historyPath = path.join(metricsDir, 'loc-history.json');
const reportPath = path.join(metricsDir, 'NEW-LOC.md');

const EXCLUDES = [
  '--exclude-dir=node_modules,vendor,dist,build,prompts,graphify-out,.git',
  '--exclude-lang=Markdown,JSON,YAML,CSV,Text,SVG',
  '--not-match-f=(lock|\\.min\\.)'
];

const args = process.argv.slice(2);
const record = !args.includes('--no-record');

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

function runCloc(clocBin, targets, reportFile) {
  execFileSync(clocBin, [...targets, ...EXCLUDES, '--json', '--quiet', `--report-file=${reportFile}`], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(fs.readFileSync(reportFile, 'utf8'));
}

function sumOf(report, section) {
  const block = report?.[section]?.SUM ?? report?.SUM?.[section];
  return {
    code: Number(block?.code ?? 0),
    comment: Number(block?.comment ?? 0),
    blank: Number(block?.blank ?? 0),
    files: Number(block?.nFiles ?? 0)
  };
}

if (!fs.existsSync(baselinePath)) fail(`baseline ausente: ${path.relative(repoRoot, baselinePath)}`);
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).baseline;
if (!baseline?.commit || !baseline?.totals?.code) fail('baseline invalida: faltam commit ou totais');

const { bin: clocBin, version: clocVersion } = resolveCloc();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eops-loc-'));
const baseTree = path.join(tmpDir, 'base');
const baseTar = path.join(tmpDir, 'base.tar');
const diffReportFile = path.join(tmpDir, 'diff.json');
const currentReportFile = path.join(tmpDir, 'current.json');

try {
  fs.mkdirSync(baseTree, { recursive: true });
  execFileSync('git', ['archive', '--format=tar', '-o', baseTar, baseline.commit], { cwd: repoRoot });
  execFileSync('tar', ['-xf', baseTar, '-C', baseTree], { cwd: repoRoot });

  const diffReport = runCloc(clocBin, ['--diff', baseTree, '.'], diffReportFile);
  const currentReport = runCloc(clocBin, ['.'], currentReportFile);

  const added = sumOf(diffReport, 'added');
  const modified = sumOf(diffReport, 'modified');
  const removed = sumOf(diffReport, 'removed');
  const currentTotals = {
    code: Number(currentReport?.SUM?.code ?? 0),
    comment: Number(currentReport?.SUM?.comment ?? 0),
    blank: Number(currentReport?.SUM?.blank ?? 0),
    files: Number(currentReport?.SUM?.nFiles ?? 0)
  };
  if (!currentTotals.code) fail('cloc nao retornou total de linhas de codigo da arvore atual');

  const netDelta = currentTotals.code - baseline.totals.code;
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;

  const perLanguage = [];
  for (const [language, addedBlock] of Object.entries(diffReport.added ?? {})) {
    if (language === 'SUM') continue;
    const addedCode = Number(addedBlock?.code ?? 0);
    const removedCode = Number(diffReport.removed?.[language]?.code ?? 0);
    const modifiedCode = Number(diffReport.modified?.[language]?.code ?? 0);
    if (!addedCode && !removedCode && !modifiedCode) continue;
    perLanguage.push({ language, added: addedCode, modified: modifiedCode, removed: removedCode });
  }
  perLanguage.sort((a, b) => b.added - a.added);

  const measurement = {
    date: new Date().toISOString(),
    commit: headSha,
    workingTreeDirty: dirty,
    clocVersion,
    baselineCommit: baseline.commit,
    added: added.code,
    modified: modified.code,
    removed: removed.code,
    netLines: netDelta,
    currentCode: currentTotals.code,
    currentFiles: currentTotals.files,
    languages: perLanguage
  };

  const history = fs.existsSync(historyPath)
    ? JSON.parse(fs.readFileSync(historyPath, 'utf8'))
    : { baselineDate: baseline.date, measurements: [] };
  if (!Array.isArray(history.measurements)) history.measurements = [];
  if (record) {
    history.measurements.push(measurement);
    fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  }

  const markdown = renderReport(baseline, measurement, history);
  if (record) fs.writeFileSync(reportPath, markdown, 'utf8');

  printSummary(baseline, measurement);
  console.log(
    record
      ? `Medicao registrada em ${path.relative(repoRoot, historyPath)} e ${path.relative(repoRoot, reportPath)}.`
      : 'Medicao nao registrada (--no-record).'
  );
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function printSummary(base, m) {
  const pad = (value, width) => String(value).padStart(width, ' ');
  console.log(`cloc ${m.clocVersion} | baseline ${base.commit.slice(0, 7)} (${base.date})`);
  console.log('');
  console.log('Linguagem            adicionadas  modificadas  removidas');
  for (const row of m.languages) {
    console.log(`${row.language.padEnd(20)} ${pad(row.added, 11)}  ${pad(row.modified, 11)}  ${pad(row.removed, 9)}`);
  }
  if (m.languages.length === 0) console.log('(nenhuma alteracao de codigo detectada)');
  console.log('');
  console.log(`Linhas adicionadas : ${m.added}`);
  console.log(`Linhas modificadas : ${m.modified}`);
  console.log(`Linhas removidas   : ${m.removed}`);
  console.log(`Liquido desde base : ${m.netLines >= 0 ? '+' : ''}${m.netLines}`);
  console.log(`Total atual        : ${m.currentCode} linhas de codigo em ${m.currentFiles} arquivos`);
  console.log(`Baseline           : ${base.totals.code} linhas de codigo em ${base.totals.files} arquivos`);
}

function renderReport(base, latest, history) {
  const lines = [];
  lines.push('# Linhas novas de código (cloc)');
  lines.push('');
  lines.push('Relatório gerado por `npm run loc:new` (`scripts/count-new-loc.mjs`). Não edite à mão.');
  lines.push('');
  lines.push('## Baseline imutável');
  lines.push('');
  lines.push(`- Data: ${base.date}`);
  lines.push(`- Commit: \`${base.commit}\``);
  lines.push(`- Totais: ${base.totals.code} linhas de código em ${base.totals.files} arquivos`);
  lines.push(`- Regra: ${base.scope}`);
  lines.push('');
  lines.push('| Linguagem | Arquivos | Linhas de código |');
  lines.push('| --- | --- | --- |');
  for (const [language, block] of Object.entries(base.languages ?? {})) {
    lines.push(`| ${language} | ${block.nFiles} | ${block.code} |`);
  }
  lines.push('');
  lines.push('## Última medição');
  lines.push('');
  lines.push(`- Data: ${latest.date}`);
  lines.push(
    `- Commit: \`${latest.commit.slice(0, 7)}\`${
      latest.workingTreeDirty ? ' (working tree com alterações)' : ''
    }`
  );
  lines.push(`- Adicionadas: ${latest.added} | Modificadas: ${latest.modified} | Removidas: ${latest.removed}`);
  lines.push(`- Líquido desde a baseline: ${latest.netLines >= 0 ? '+' : ''}${latest.netLines}`);
  lines.push(`- Total atual: ${latest.currentCode} linhas de código em ${latest.currentFiles} arquivos`);
  lines.push('');
  if (latest.languages?.length) {
    lines.push('| Linguagem | Adicionadas | Modificadas | Removidas |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of latest.languages) {
      lines.push(`| ${row.language} | ${row.added} | ${row.modified} | ${row.removed} |`);
    }
    lines.push('');
  }
  lines.push('## Histórico');
  lines.push('');
  lines.push('| Data | Commit | Adicionadas | Modificadas | Removidas | Líquido | Total |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const entry of history.measurements ?? []) {
    lines.push(
      `| ${entry.date} | \`${String(entry.commit).slice(0, 7)}\` | ${entry.added} | ${entry.modified} | ${entry.removed} | ${
        entry.netLines >= 0 ? '+' : ''
      }${entry.netLines} | ${entry.currentCode} |`
    );
  }
  lines.push('');
  lines.push('## Como medir');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run loc:new                 # mede e registra');
  lines.push('npm run loc:new -- --no-record  # apenas mede');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}
