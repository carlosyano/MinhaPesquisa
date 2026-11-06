// Armazenamento de imagens atrás de interface (DEC-101). No notebook, pasta local com links
// assinados de 5 min servidos só em 127.0.0.1 (DEC-113, RN-029, DEC-034; ver
// armazenamento-disco.ts); nos testes de integração, a implementação em memória daqui. As imagens
// entram no backup diário cifrado (DEC-117); o expurgo some dos backups pela retenção de 90 dias.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';

export interface Armazenamento {
  gravar(chave: string, bytes: Buffer, tipo: string): Promise<void>;
  /** Bytes do objeto (o worker recorta as páginas para a leitura, RN-038). */
  ler(chave: string): Promise<Buffer>;
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

/** Recorte de um item para a revisão lado a lado (CA-007), gerado sob demanda. */
export function chaveRecorte(tenantId: string, aplicacaoId: string, itemId: string): string {
  return `tenant/${tenantId}/aplicacao/${aplicacaoId}/recorte-${itemId}.jpg`;
}

/**
 * Servidor HTTP local dos links assinados (HMAC da chave e da expiração, segredo que só vive
 * na memória do processo). Só escuta em 127.0.0.1; a expiração segue o relógio injetado.
 */
export class ServidorLinks {
  private readonly segredo = randomBytes(32);
  private servidor?: Server;
  private base = '';

  constructor(
    private readonly agora: () => Date,
    private readonly ler: (chave: string) => Promise<{ bytes: Buffer; tipo: string } | undefined>,
  ) {}

  async iniciar(porta = 0): Promise<void> {
    this.servidor = createServer((req, res) => {
      void this.servir(req.url ?? '/').then(
        (obj) => (obj ? res.writeHead(200, this.cabecalhos(req.url ?? '/', obj)).end(obj.bytes) : res.writeHead(403).end()),
        () => res.writeHead(403).end(),
      );
    });
    await new Promise<void>((ok) => this.servidor!.listen(porta, '127.0.0.1', ok));
    const end = this.servidor.address();
    this.base = typeof end === 'object' && end ? `http://127.0.0.1:${end.port}` : '';
  }

  async fechar(): Promise<void> {
    await new Promise<void>((ok) => (this.servidor ? this.servidor.close(() => ok()) : ok()));
  }

  /** Imagem abre no navegador; arquivo da exportação desce como download, com o nome do objeto. */
  private cabecalhos(caminho: string, obj: { bytes: Buffer; tipo: string }): Record<string, string | number> {
    const h: Record<string, string | number> = { 'content-type': obj.tipo, 'content-length': obj.bytes.length };
    if (!obj.tipo.startsWith('image/')) {
      const nome = decodeURIComponent(new URL(caminho, 'http://local').pathname).split('/').pop() ?? 'arquivo';
      h['content-disposition'] = `attachment; filename="${nome.replace(/[^\w.-]/g, '_')}"`;
    }
    return h;
  }

  private async servir(caminho: string) {
    const url = new URL(caminho, 'http://local');
    const chave = decodeURIComponent(url.pathname.slice(1));
    const expira = Number(url.searchParams.get('expira'));
    const assinatura = Buffer.from(url.searchParams.get('assinatura') ?? '', 'hex');
    const esperada = this.assinar(chave, expira);
    const valida = assinatura.length === esperada.length && timingSafeEqual(assinatura, esperada) && expira > this.agora().getTime();
    return valida ? this.ler(chave) : undefined;
  }

  private assinar(chave: string, expira: number): Buffer {
    return createHmac('sha256', this.segredo).update(`${chave}\n${expira}`).digest();
  }

  url(chave: string, expira: Date): string {
    const t = expira.getTime();
    return `${this.base}/${encodeURIComponent(chave)}?expira=${t}&assinatura=${this.assinar(chave, t).toString('hex')}`;
  }
}

/** Implementação em memória, só para testes. */
export class ArmazenamentoEmMemoria implements Armazenamento {
  private readonly objetos = new Map<string, { bytes: Buffer; tipo: string }>();
  private readonly links: ServidorLinks;

  constructor(agora: () => Date) {
    this.links = new ServidorLinks(agora, async (chave) => this.objetos.get(chave));
  }

  iniciar(): Promise<void> {
    return this.links.iniciar();
  }

  fechar(): Promise<void> {
    return this.links.fechar();
  }

  async gravar(chave: string, bytes: Buffer, tipo: string): Promise<void> {
    this.objetos.set(chave, { bytes: Buffer.from(bytes), tipo });
  }

  async ler(chave: string): Promise<Buffer> {
    const o = this.objetos.get(chave);
    if (!o) throw new Error('objeto inexistente');
    return Buffer.from(o.bytes);
  }

  async apagar(chave: string): Promise<void> {
    this.objetos.delete(chave);
  }

  async urlAssinada(chave: string, expira: Date): Promise<string> {
    return this.links.url(chave, expira);
  }

  async contar(prefixo: string): Promise<number> {
    let n = 0;
    for (const k of this.objetos.keys()) if (k.startsWith(prefixo)) n++;
    return n;
  }
}
