// Roda a suíte (ou os arquivos dados) e grava, além da saída normal no terminal:
// - reports/testes/vitest.json: o relatório completo do Vitest;
// - reports/testes/falhas.md: só as falhas, curtas (arquivo, teste e as primeiras linhas do erro),
//   para colar ou para a IA ler sem percorrer a saída inteira.
// Uso: npm run test:relatorio [-- arquivos ou filtros do vitest]
// Sai com o mesmo código do Vitest. A pasta reports/ não vai para o repositório (.gitignore).

import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import process from 'node:process';

const PASTA = 'reports/testes';
const JSON_SAIDA = `${PASTA}/vitest.json`;
const FALHAS = `${PASTA}/falhas.md`;
const LINHAS_POR_ERRO = 6;

mkdirSync(PASTA, { recursive: true });
const inicio = new Date();
const r = spawnSync('npx', ['vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${JSON_SAIDA}`, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const ESC = String.fromCharCode(27);
const semCor = (t) => t.replaceAll(new RegExp(`${ESC}\\[[0-9;]*m`, 'g'), '');
const curto = (t) =>
  semCor(t)
    .split('\n')
    .filter((l) => l.trim() && !/^\s+at .*(node_modules|<anonymous>|node:internal)/.test(l))
    .slice(0, LINHAS_POR_ERRO)
    .map((l) => `    ${l.trimEnd()}`)
    .join('\n');

if (!existsSync(JSON_SAIDA)) {
  writeFileSync(FALHAS, `# Testes — ${inicio.toISOString()}\n\nO Vitest não gerou o relatório (código ${r.status}). Veja a saída do terminal.\n`);
  console.error(`\nRelatório não gerado; veja ${FALHAS}`);
  process.exit(r.status ?? 1);
}

const rel = JSON.parse(readFileSync(JSON_SAIDA, 'utf8'));
const arquivosComFalha = rel.testResults.filter((a) => a.status === 'failed').length;
const linhas = [
  `# Testes — ${inicio.toISOString()}`,
  '',
  `Arquivos: ${arquivosComFalha} com falha de ${rel.testResults.length}. Testes: ${rel.numFailedTests} falharam, ${rel.numPassedTests} passaram, ${rel.numPendingTests} pulados, de ${rel.numTotalTests}.`,
  `Argumentos: ${process.argv.slice(2).join(' ') || '(suíte inteira)'}`,
  '',
];

for (const arq of rel.testResults) {
  const falhas = arq.assertionResults.filter((t) => t.status === 'failed');
  if (arq.status !== 'failed' && falhas.length === 0) continue;
  linhas.push(`## ${relative(process.cwd(), arq.name).replaceAll('\\', '/')} — ${falhas.length} teste(s) com falha`, '');
  // Falha fora de um teste (import, beforeAll): vem na mensagem do arquivo.
  if (arq.message && falhas.length === 0) linhas.push('- (falha do arquivo, fora de um teste)', curto(arq.message), '');
  // Mesma mensagem em vários testes (ex.: harness ausente): mostra uma vez, com a contagem.
  const porErro = new Map();
  for (const t of falhas) {
    const erro = curto((t.failureMessages ?? []).join('\n') || '(sem mensagem)');
    if (!porErro.has(erro)) porErro.set(erro, []);
    porErro.get(erro).push(t.fullName);
  }
  for (const [erro, nomes] of porErro) {
    for (const n of nomes.slice(0, 3)) linhas.push(`- ${n}`);
    if (nomes.length > 3) linhas.push(`- … e mais ${nomes.length - 3} com o mesmo erro`);
    linhas.push(erro, '');
  }
}
if (rel.numFailedTests === 0 && arquivosComFalha === 0) linhas.push('Nenhuma falha.');

writeFileSync(FALHAS, `${linhas.join('\n')}\n`);
console.log(`\nResumo das falhas: ${FALHAS}`);
process.exit(r.status ?? 1);
