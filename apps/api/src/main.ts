// Ponto de entrada no notebook (DEC-113): lê a pasta de dados criada pela instalação
// (scripts/cli.ts), abre a chave mestra pelo DPAPI (DEC-114) e serve a API só em 127.0.0.1.
// Nenhum segredo fica no repositório nem no ambiente.

import { criarApi } from './app.js';
import { protetorDpapi } from './infra/chaves.js';
import { WorkerLeitura } from './leitura/worker.js';
import { lerConfigLocal, montarConfig, pastaDados } from './local.js';

const dir = pastaDados();
const local = await lerConfigLocal(dir);
const { config, armazenamento } = await montarConfig(dir, local, protetorDpapi);
await armazenamento.iniciar();
const api = await criarApi(config, local.porta, '127.0.0.1');
console.log(`MinhaPesquisa em ${api.url}`);

// Worker de leitura no mesmo processo (DEC-124): despacha o outbox e roda as tarefas vencidas.
const worker = new WorkerLeitura(api.nucleo);
let rodando = false;
const ciclo = setInterval(() => {
  if (rodando) return;
  rodando = true;
  worker
    .processar()
    .catch((e: unknown) => api.nucleo.log(`worker_erro tipo=${(e as Error)?.name ?? typeof e}`))
    .finally(() => (rodando = false));
}, 1000);

async function encerrar(): Promise<void> {
  clearInterval(ciclo);
  await api.fechar();
  await armazenamento.fechar();
  process.exit(0);
}
process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());
