// Cliente HTTP que se comporta como um navegador: guarda cookies, envia o token CSRF
// (double-submit: cookie mp_csrf + cabeçalho X-CSRF-Token) e o cabeçalho Origin em mutações.

import { randomInt } from 'node:crypto';

export interface Resposta {
  status: number;
  headers: Headers;
  corpo: any;
  texto: string;
}

export interface OpcoesRequisicao {
  corpo?: unknown;
  headers?: Record<string, string>;
  /** Em mutações o token CSRF vai por padrão; false omite (teste de CSRF). */
  csrf?: boolean;
}

let proximoIp = 0;

export class Cliente {
  readonly cookies = new Map<string, string>();
  /** IP sintético exclusivo deste cliente, na faixa de documentação 2001:db8::/32 (ver harness.ts). */
  readonly ip = `2001:db8::${(++proximoIp).toString(16)}`;

  constructor(private readonly baseUrl: string) {}

  temCookie(nome: string): boolean {
    return this.cookies.has(nome);
  }

  async get(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<Resposta> {
    return this.requisitar('GET', caminho, opcoes);
  }

  async post(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<Resposta> {
    return this.requisitar('POST', caminho, opcoes);
  }

  async patch(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<Resposta> {
    return this.requisitar('PATCH', caminho, opcoes);
  }

  async delete(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<Resposta> {
    return this.requisitar('DELETE', caminho, opcoes);
  }

  async requisitar(metodo: string, caminho: string, opcoes: OpcoesRequisicao = {}): Promise<Resposta> {
    const headers: Record<string, string> = {
      accept: 'application/json, application/problem+json',
      'x-forwarded-for': this.ip,
      ...opcoes.headers,
    };
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (metodo !== 'GET') {
      headers.origin = this.baseUrl;
      const csrf = this.cookies.get('mp_csrf');
      if (opcoes.csrf !== false && csrf) headers['x-csrf-token'] = csrf;
    }
    let body: string | undefined;
    if (opcoes.corpo !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opcoes.corpo);
    }

    const res = await fetch(this.baseUrl + caminho, { method: metodo, headers, body, redirect: 'manual' });
    this.guardarCookies(res.headers.getSetCookie());
    const texto = await res.text();
    let corpo: any = undefined;
    if (texto) {
      try {
        corpo = JSON.parse(texto);
      } catch {
        corpo = texto;
      }
    }
    return { status: res.status, headers: res.headers, corpo, texto };
  }

  private guardarCookies(setCookies: string[]): void {
    for (const sc of setCookies) {
      const [par, ...atributos] = sc.split(';').map((s) => s.trim());
      const i = par.indexOf('=');
      const nome = par.slice(0, i);
      const valor = par.slice(i + 1);
      const expirado = atributos.some(
        (a) => /^max-age=0$/i.test(a) || (/^expires=/i.test(a) && new Date(a.slice(8)).getTime() < Date.now()),
      );
      if (expirado || valor === '') this.cookies.delete(nome);
      else this.cookies.set(nome, valor);
    }
  }
}

/** Chave de idempotência nova (16 a 64 caracteres, P.8). */
export function chaveIdempotencia(): string {
  return `teste-${Date.now()}-${randomInt(1e9)}`.padEnd(16, '0');
}
