// Pasta local de imagens do notebook (DEC-113), pela interface Armazenamento (DEC-101). A chave
// vira um caminho sob a raiz só se for composta de segmentos simples, para que nenhuma chave
// escape da pasta. A gravação é atômica (arquivo temporário e renomeação) e os links assinados
// de 5 min saem do mesmo servidor local da implementação em memória (RN-029, DEC-034).

import { randomUUID } from 'node:crypto';
import { readdir, readFile, rename, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { ServidorLinks, type Armazenamento } from './armazenamento.js';

const CHAVE_VALIDA = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*(?:\.[A-Za-z0-9]+)?$/;
const TEMPORARIO = '.parcial';
const TIPOS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  // Arquivos da exportação (DEC-165).
  '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Caminho do arquivo da chave sob a raiz; recusa qualquer chave que não seja segmentos simples. */
export function caminhoNoDisco(raiz: string, chave: string): string {
  if (!CHAVE_VALIDA.test(chave)) throw new Error('chave de armazenamento inválida');
  const base = resolve(raiz);
  const p = resolve(base, ...chave.split('/'));
  if (!p.startsWith(base + sep)) throw new Error('chave de armazenamento inválida');
  return p;
}

async function contarArquivos(dir: string, filtro: (rel: string) => boolean, raiz: string): Promise<number> {
  let entradas;
  try {
    entradas = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw e;
  }
  let n = 0;
  for (const e of entradas) {
    if (!e.isFile() || e.name.endsWith(TEMPORARIO)) continue;
    const rel = join(e.parentPath, e.name).slice(raiz.length + 1).split(sep).join('/');
    if (filtro(rel)) n++;
  }
  return n;
}

export class ArmazenamentoEmDisco implements Armazenamento {
  private readonly raiz: string;
  private readonly links: ServidorLinks;

  constructor(raiz: string, agora: () => Date) {
    this.raiz = resolve(raiz);
    this.links = new ServidorLinks(agora, async (chave) => {
      try {
        return { bytes: await readFile(caminhoNoDisco(this.raiz, chave)), tipo: TIPOS[extname(chave)] ?? 'application/octet-stream' };
      } catch {
        return undefined;
      }
    });
  }

  /** Sobe o servidor dos links em 127.0.0.1 (porta 0 = qualquer livre). */
  iniciar(porta = 0): Promise<void> {
    return this.links.iniciar(porta);
  }

  fechar(): Promise<void> {
    return this.links.fechar();
  }

  /** O tipo vem da extensão da chave na leitura (imagens e arquivos da exportação). */
  async gravar(chave: string, bytes: Buffer, _tipo?: string): Promise<void> {
    const destino = caminhoNoDisco(this.raiz, chave);
    await mkdir(dirname(destino), { recursive: true });
    const temp = `${destino}.${randomUUID()}${TEMPORARIO}`;
    try {
      await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
      await rename(temp, destino);
    } finally {
      await rm(temp, { force: true });
    }
  }

  async ler(chave: string): Promise<Buffer> {
    return readFile(caminhoNoDisco(this.raiz, chave));
  }

  async apagar(chave: string): Promise<void> {
    await rm(caminhoNoDisco(this.raiz, chave), { force: true });
  }

  async urlAssinada(chave: string, expira: Date): Promise<string> {
    caminhoNoDisco(this.raiz, chave);
    return this.links.url(chave, expira);
  }

  async contar(prefixo: string): Promise<number> {
    // Varre só a pasta mais funda que o prefixo garante (ex.: `tenant/<id>/` → tenant/<id>).
    const pasta = prefixo.slice(0, prefixo.lastIndexOf('/') + 1).replace(/\/$/, '');
    const dir = pasta ? caminhoNoDisco(this.raiz, pasta) : this.raiz;
    return contarArquivos(dir, (rel) => rel.startsWith(prefixo), this.raiz);
  }
}
