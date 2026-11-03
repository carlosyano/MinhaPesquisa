// Armazenamento de imagens atrás de interface (DEC-101). Bucket privado, sem versionamento e
// fora do backup (PLANO §4.1, RN-030); acesso só por link assinado de 5 min (RN-029, DEC-034).
// O adaptador do Amazon S3 (sa-east-1) entra com o ambiente na nuvem, como o e-mail (DEC-088);
// até lá existe a implementação em memória usada nos testes.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';

export interface Armazenamento {
  gravar(chave: string, bytes: Buffer, tipo: string): Promise<void>;
  apagar(chave: string): Promise<void>;
  /** Link assinado de leitura, válido até `expira`. */
  urlAssinada(chave: string, expira: Date): Promise<string>;
  /** Quantos objetos existem com o prefixo (ex.: `tenant/<id>/`). */
  contar(prefixo: string): Promise<number>;
}

/** Chave do objeto: tenant, aplicação e página, sem nenhum dado pessoal no nome. */
export function chaveImagem(tenantId: string, aplicacaoId: string, imagemId: string): string {
  return `tenant/${tenantId}/aplicacao/${aplicacaoId}/${imagemId}.jpg`;
}

/**
 * Implementação em memória com um servidor HTTP local que serve os links assinados (HMAC da
 * chave e da expiração). Só para testes; a expiração segue o relógio injetado.
 */
export class ArmazenamentoEmMemoria implements Armazenamento {
  private readonly objetos = new Map<string, { bytes: Buffer; tipo: string }>();
  private readonly segredo = randomBytes(32);
  private servidor?: Server;
  private base = '';

  constructor(private readonly agora: () => Date) {}

  async iniciar(): Promise<void> {
    this.servidor = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://local');
      const chave = decodeURIComponent(url.pathname.slice(1));
      const expira = Number(url.searchParams.get('expira'));
      const assinatura = Buffer.from(url.searchParams.get('assinatura') ?? '', 'hex');
      const esperada = this.assinar(chave, expira);
      const valida = assinatura.length === esperada.length && timingSafeEqual(assinatura, esperada) && expira > this.agora().getTime();
      const obj = this.objetos.get(chave);
      if (!valida || !obj) {
        res.writeHead(403).end();
        return;
      }
      res.writeHead(200, { 'content-type': obj.tipo, 'content-length': obj.bytes.length }).end(obj.bytes);
    });
    await new Promise<void>((ok) => this.servidor!.listen(0, '127.0.0.1', ok));
    const end = this.servidor.address();
    this.base = typeof end === 'object' && end ? `http://127.0.0.1:${end.port}` : '';
  }

  async fechar(): Promise<void> {
    await new Promise<void>((ok) => (this.servidor ? this.servidor.close(() => ok()) : ok()));
  }

  private assinar(chave: string, expira: number): Buffer {
    return createHmac('sha256', this.segredo).update(`${chave}\n${expira}`).digest();
  }

  async gravar(chave: string, bytes: Buffer, tipo: string): Promise<void> {
    this.objetos.set(chave, { bytes: Buffer.from(bytes), tipo });
  }

  async apagar(chave: string): Promise<void> {
    this.objetos.delete(chave);
  }

  async urlAssinada(chave: string, expira: Date): Promise<string> {
    const t = expira.getTime();
    return `${this.base}/${encodeURIComponent(chave)}?expira=${t}&assinatura=${this.assinar(chave, t).toString('hex')}`;
  }

  async contar(prefixo: string): Promise<number> {
    let n = 0;
    for (const k of this.objetos.keys()) if (k.startsWith(prefixo)) n++;
    return n;
  }
}
