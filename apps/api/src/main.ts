// Ponto de entrada em produção. Todos os segredos vêm do ambiente (preenchido pelo
// gerenciador de segredos da nuvem); nada fica no repositório.

import { randomUUID } from 'node:crypto';
import { criarApi } from './app.js';
import { relogioDoSistema } from './infra/relogio.js';
import { AntimalwareClamd } from './infra/antimalware.js';
import type { Armazenamento } from './infra/armazenamento.js';

function obrigatoria(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`variável de ambiente ausente: ${nome}`);
  return v;
}

function chave32(nome: string): Buffer {
  const b = Buffer.from(obrigatoria(nome), 'base64');
  if (b.length !== 32) throw new Error(`${nome} deve ter 32 bytes em base64`);
  return b;
}

// O adaptador do S3 (sa-east-1) entra com o ambiente na nuvem (DEC-101), como o e-mail.
const armazenamento: Armazenamento = {
  async gravar() {
    throw new Error('armazenamento de imagens não configurado (DEC-101)');
  },
  async apagar() {
    throw new Error('armazenamento de imagens não configurado (DEC-101)');
  },
  async urlAssinada() {
    throw new Error('armazenamento de imagens não configurado (DEC-101)');
  },
  async contar() {
    throw new Error('armazenamento de imagens não configurado (DEC-101)');
  },
};

const api = await criarApi(
  {
    urlBancoApp: obrigatoria('MP_DB_APP_URL'),
    urlBancoManutencao: obrigatoria('MP_DB_MANUTENCAO_URL'),
    raizRepositorio: obrigatoria('MP_RAIZ'),
    chaveHmacEmail: chave32('MP_CHAVE_HMAC_EMAIL'),
    origensPermitidas: obrigatoria('MP_ORIGENS').split(','),
    cookiesSeguros: true,
    confiarProxy: process.env.MP_CONFIAR_PROXY === 'true',
    relogio: relogioDoSistema,
    armazenamento,
    // ClamAV como sidecar (DEC-042, DEC-102).
    antimalware: new AntimalwareClamd(obrigatoria('MP_CLAMD_HOST'), Number(process.env.MP_CLAMD_PORTA ?? 3310)),
    gerarId: randomUUID,
  },
  Number(process.env.PORT ?? 3000),
  process.env.HOST ?? '0.0.0.0',
);
console.log(`api ouvindo em ${api.url}`);
