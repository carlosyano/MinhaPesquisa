// Ponto de entrada no notebook (DEC-113): lê a pasta de dados criada pela instalação
// (scripts/cli.ts), abre a chave mestra pelo DPAPI (DEC-114) e serve a API só em 127.0.0.1.
// Nenhum segredo fica no repositório nem no ambiente.

import { criarApi } from './app.js';
import { protetorDpapi } from './infra/chaves.js';
import { lerConfigLocal, montarConfig, pastaDados } from './local.js';

const dir = pastaDados();
const local = await lerConfigLocal(dir);
const { config, armazenamento } = await montarConfig(dir, local, protetorDpapi);
await armazenamento.iniciar();
const api = await criarApi(config, local.porta, '127.0.0.1');
console.log(`MinhaPesquisa em ${api.url}`);

async function encerrar(): Promise<void> {
  await api.fechar();
  await armazenamento.fechar();
  process.exit(0);
}
process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());
