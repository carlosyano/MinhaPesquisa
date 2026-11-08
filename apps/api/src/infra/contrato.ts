// Contrato e catálogo de erros carregados das fontes de verdade (DEC-049):
// - contracts/openapi.yaml valida o corpo de cada operação (additionalProperties: false);
// - registros/catalogo_erros.csv dá status e mensagem exata de cada ERR (Bloco P P.6);
// - o título de cada ERR vem dos exemplos do próprio contrato.

import { Ajv, type ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const addFormats = addFormatsModule as unknown as (ajv: Ajv) => void;

export interface DefErro {
  status: number;
  mensagem: string;
  titulo: string;
}

function lerCsv(texto: string): string[][] {
  const out: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') {
      linha.push(campo);
      campo = '';
    } else if (c === '\n') {
      linha.push(campo);
      out.push(linha);
      linha = [];
      campo = '';
    } else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) out.push([...linha, campo]);
  return out;
}

function titulosDosExemplos(no: unknown, acc: Map<string, string>): void {
  if (Array.isArray(no)) no.forEach((x) => titulosDosExemplos(x, acc));
  else if (no && typeof no === 'object') {
    const o = no as Record<string, unknown>;
    if (typeof o.errorCode === 'string' && typeof o.title === 'string' && !acc.has(o.errorCode)) {
      acc.set(o.errorCode, o.title);
    }
    Object.values(o).forEach((x) => titulosDosExemplos(x, acc));
  }
}

/**
 * OpenAPI 3.0: `nullable: true` aceita null mesmo com `enum` (3.0.3); no AJV o null precisa estar no
 * enum. Sem isso o conteúdo devolvido pelo GET (campo_aplicacao: null) não volta no updateVersion.
 */
function nuloNoEnum(no: unknown): void {
  if (Array.isArray(no)) no.forEach(nuloNoEnum);
  else if (no && typeof no === 'object') {
    const o = no as Record<string, unknown>;
    if (o.nullable === true && Array.isArray(o.enum) && !o.enum.includes(null)) o.enum = [...o.enum, null];
    Object.values(o).forEach(nuloNoEnum);
  }
}

export class Contrato {
  readonly erros = new Map<string, DefErro>();
  private readonly validadores = new Map<string, ValidateFunction>();

  constructor(raiz: string) {
    const doc = parse(readFileSync(join(raiz, 'contracts/openapi.yaml'), 'utf8')) as {
      paths: Record<string, Record<string, { operationId?: string; requestBody?: { content?: Record<string, { schema?: unknown }> } }>>;
      components: unknown;
    };

    // Sem allErrors: um corpo hostil não pode gerar uma lista ilimitada de erros (DoS).
    nuloNoEnum(doc);
    const ajv = new Ajv({ strict: false, allErrors: false });
    addFormats(ajv);
    ajv.addFormat('password', true);
    ajv.addSchema({ $id: 'openapi', components: doc.components });
    for (const ops of Object.values(doc.paths)) {
      for (const op of Object.values(ops)) {
        const schema = op?.requestBody?.content?.['application/json']?.schema;
        if (op?.operationId && schema) {
          const s = JSON.parse(JSON.stringify(schema).replace(/"#\/components\//g, '"openapi#/components/'));
          this.validadores.set(op.operationId, ajv.compile(s));
        }
      }
    }

    const titulos = new Map<string, string>();
    titulosDosExemplos(doc.components, titulos);
    const [cab, ...dados] = lerCsv(readFileSync(join(raiz, 'registros/catalogo_erros.csv'), 'utf8'));
    const col = (n: string) => cab.indexOf(n);
    for (const l of dados) {
      if (l[col('status')] !== 'ativo') continue;
      const id = l[col('err_id')];
      this.erros.set(id, {
        status: Number(l[col('http_status')]),
        mensagem: l[col('mensagem_ao_usuario')],
        titulo: titulos.get(id) ?? l[col('codigo')],
      });
    }
  }

  /** Valida o corpo pelo schema da operação; devolve os campos inválidos ou null. */
  validarCorpo(operationId: string, corpo: unknown): string[] | null {
    const v = this.validadores.get(operationId);
    if (!v) throw new Error(`operação sem corpo no contrato: ${operationId}`);
    if (v(corpo)) return null;
    const campos = new Set<string>();
    for (const e of v.errors ?? []) {
      const extra = (e.params as { additionalProperty?: string; missingProperty?: string }) ?? {};
      const nome = extra.additionalProperty ?? extra.missingProperty ?? e.instancePath.split('/')[1];
      if (nome) campos.add(nome);
    }
    return [...campos];
  }
}
