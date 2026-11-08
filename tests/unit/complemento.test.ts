// Pré-regra 1b da FL-002 (item de complemento, RN-009, DEC-197) como função pura, ao lado de
// `estadoAposLeitura` (DEC-052). O item de complemento só vale com a opção marcada no valor da
// pergunta; a revisão humana dele é mantida enquanto a opção continua como estava (DEC-204, DEC-212).
//
// O IA-DEV acrescenta a `apps/api/src/regras/leitura.ts`:
//   export function estadoComplemento(e: EntradaComplemento): EstadoItem
// com a interface `EntradaComplemento` abaixo. O módulo é carregado por especificador em variável,
// para que o typecheck dos testes não dependa da função ainda por escrever.

import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import type { EstadoItem } from '../../apps/api/src/regras/leitura.js';

export interface EntradaComplemento {
  /** Código da opção com complemento. */
  opcao: string;
  /** Item da pergunta, depois da mudança que dispara a reavaliação. */
  pergunta: {
    estado: EstadoItem;
    /** Valor efetivo: o final ou, em `confirmado_automaticamente`, o lido; múltipla escolha separada por ";". */
    valor: string | null;
    /** `revisor_id` preenchido: a própria usuária aplicou a ação ao item (DEC-203 (11)). */
    pelaUsuaria: boolean;
  };
  /** Complemento lido; null = sem leitura (pergunta não lida pela regra 0, ou ausente na resposta). */
  lido: { valor: string | null; confianca: number } | null;
  limite: number;
  /** Estado atual do complemento; ausente na primeira avaliação, depois da leitura. */
  atual?: { estado: EstadoItem; pelaUsuaria: boolean; revisaoReaberta: boolean } | null;
}

type EstadoComplemento = (e: EntradaComplemento) => EstadoItem;

const MODULO = '../../apps/api/src/regras/leitura.js';
let estadoComplemento: EstadoComplemento;

beforeAll(async () => {
  const mod = (await import(MODULO)) as { estadoComplemento?: EstadoComplemento };
  if (typeof mod.estadoComplemento !== 'function') throw new Error('IA-TEST: regras/leitura.ts deve exportar estadoComplemento (pré-regra 1b, IMP-009)');
  estadoComplemento = mod.estadoComplemento;
});

const LIMITE = 0.9;
const LIDO = { valor: 'Maternidade', confianca: 0.95 };

function entrada(estado: EstadoItem, valor: string | null, lido: EntradaComplemento['lido'] = LIDO, extra: Partial<EntradaComplemento> = {}): EntradaComplemento {
  return { opcao: 'outros', pergunta: { estado, valor, pelaUsuaria: false }, lido, limite: LIMITE, ...extra };
}

const RESOLVIDOS_PELA_USUARIA: EstadoItem[] = ['confirmado', 'corrigido', 'em_branco', 'ilegivel', 'rasurado', 'nao_se_aplica'];

describe('pré-regra 1b (a): pergunta ainda não resolvida', () => {
  // @trace FL-002, DEC-197, CA-059
  it.each(['pendente_leitura', 'aguardando_condicao', 'a_revisar'] as const)('pergunta em %s → aguardando_condicao, com ou sem texto lido', (estado) => {
    expect(estadoComplemento(entrada(estado, 'outros'))).toBe('aguardando_condicao');
    expect(estadoComplemento(entrada(estado, 'dor'))).toBe('aguardando_condicao');
    expect(estadoComplemento(entrada(estado, null, null))).toBe('aguardando_condicao');
  });
});

describe('pré-regra 1b (b): opção não marcada', () => {
  // @trace FL-002, DEC-205, DEC-209, CA-059
  it.each(['confirmado_automaticamente', 'confirmado'] as const)('pergunta %s sem a opção e texto lido → a_revisar, como inconsistência', (estado) => {
    expect(estadoComplemento(entrada(estado, 'dor'))).toBe('a_revisar');
    expect(estadoComplemento(entrada(estado, 'dor', LIDO, { pergunta: { estado, valor: 'dor', pelaUsuaria: true } }))).toBe('a_revisar');
  });

  // @trace FL-002, DEC-209, CA-059
  it('pergunta nao_se_aplica pela regra de salto (revisor nulo) e texto lido → a_revisar', () => {
    expect(estadoComplemento(entrada('nao_se_aplica', null))).toBe('a_revisar');
  });

  // @trace FL-002, DEC-209, CA-059
  it.each(['corrigido', 'em_branco', 'ilegivel', 'rasurado', 'nao_se_aplica'] as const)('pergunta resolvida pela usuária como %s, sem a opção → nao_se_aplica, mesmo com texto lido', (estado) => {
    const valor = estado === 'corrigido' ? 'rotina' : null;
    expect(estadoComplemento(entrada(estado, valor, LIDO, { pergunta: { estado, valor, pelaUsuaria: true } }))).toBe('nao_se_aplica');
  });

  // @trace FL-002, DEC-205, CA-059
  it('sem a opção e complemento lido em branco ou sem leitura → nao_se_aplica', () => {
    expect(estadoComplemento(entrada('confirmado_automaticamente', 'dor', { valor: null, confianca: 0.99 }))).toBe('nao_se_aplica');
    expect(estadoComplemento(entrada('confirmado_automaticamente', 'dor', null))).toBe('nao_se_aplica');
    expect(estadoComplemento(entrada('nao_se_aplica', null, null))).toBe('nao_se_aplica');
  });

  // @trace FL-002, DEC-197
  it('múltipla escolha: a opção conta como marcada só quando está entre os códigos separados por ";"', () => {
    const e = (valor: string) => ({ ...entrada('confirmado_automaticamente', valor), opcao: 'outra' });
    expect(estadoComplemento(e('diabetes;outra'))).toBe('confirmado_automaticamente');
    expect(estadoComplemento(e('diabetes'))).toBe('a_revisar');
    expect(estadoComplemento(e('outras'))).toBe('a_revisar');
  });

  // @trace FL-002, DEC-212, CA-059
  it('nao_se_aplica marcado pela usuária no complemento é mantido enquanto a opção continua não marcada', () => {
    const atual = { estado: 'nao_se_aplica' as const, pelaUsuaria: true, revisaoReaberta: false };
    expect(estadoComplemento(entrada('confirmado', 'dor', LIDO, { atual }))).toBe('nao_se_aplica');
    // A opção passa a estar marcada: a 1b volta a valer.
    expect(estadoComplemento(entrada('corrigido', 'outros', LIDO, { atual, pergunta: { estado: 'corrigido', valor: 'outros', pelaUsuaria: true } }))).toBe('confirmado_automaticamente');
  });
});

describe('pré-regra 1b (c) e (d): opção marcada', () => {
  // @trace FL-002, DEC-203, CA-059
  it('(c) complemento sem leitura → a_revisar', () => {
    expect(estadoComplemento(entrada('confirmado_automaticamente', 'outros', null))).toBe('a_revisar');
    expect(estadoComplemento(entrada('corrigido', 'outros', null))).toBe('a_revisar');
  });

  // @trace FL-002, DEC-074, DEC-199, CA-059
  it('(d) regra 6a: complemento lido em branco → a_revisar', () => {
    expect(estadoComplemento(entrada('confirmado_automaticamente', 'outros', { valor: null, confianca: 0.99 }))).toBe('a_revisar');
  });

  // @trace FL-002, REQ §5.4, CA-059
  it('(d) regra 7: texto acima de 200 caracteres → a_revisar; com 200, segue para a confiança', () => {
    expect(estadoComplemento(entrada('confirmado_automaticamente', 'outros', { valor: 'a'.repeat(201), confianca: 0.99 }))).toBe('a_revisar');
    expect(estadoComplemento(entrada('confirmado_automaticamente', 'outros', { valor: 'a'.repeat(200), confianca: 0.99 }))).toBe('confirmado_automaticamente');
  });

  // @trace FL-002, DEC-200, DEC-028, CA-059
  it('(d) regras 8 e 9: confiança estritamente acima do limite confirma; igual ou abaixo vai à revisão (sem a regra 6)', () => {
    expect(estadoComplemento(entrada('confirmado', 'outros', { valor: 'Maternidade', confianca: 0.9001 }))).toBe('confirmado_automaticamente');
    expect(estadoComplemento(entrada('confirmado', 'outros', { valor: 'Maternidade', confianca: 0.9 }))).toBe('a_revisar');
    expect(estadoComplemento(entrada('confirmado', 'outros', { valor: 'Matrnidade', confianca: 0.6 }))).toBe('a_revisar');
  });

  // @trace FL-002, DEC-204, CA-059
  it.each(RESOLVIDOS_PELA_USUARIA)('complemento %s pela usuária é mantido quando a pergunta muda e continua com a opção', (estado) => {
    const atual = { estado, pelaUsuaria: true, revisaoReaberta: false };
    expect(estadoComplemento(entrada('confirmado', 'outros', LIDO, { atual }))).toBe(estado);
  });

  // @trace FL-002, DEC-204, DEC-209, CA-059
  it.each(RESOLVIDOS_PELA_USUARIA)('complemento %s pela usuária vai a nao_se_aplica quando a usuária tira a opção da pergunta', (estado) => {
    const atual = { estado, pelaUsuaria: true, revisaoReaberta: false };
    expect(estadoComplemento(entrada('corrigido', 'rotina', LIDO, { atual, pergunta: { estado: 'corrigido', valor: 'rotina', pelaUsuaria: true } }))).toBe('nao_se_aplica');
  });

  // @trace FL-002, DEC-203, CA-059
  it('a_revisar vindo da reabertura fica a_revisar com a opção marcada, mesmo com leitura confiante; sem a opção, segue a 1b (b)', () => {
    const atual = { estado: 'a_revisar' as const, pelaUsuaria: false, revisaoReaberta: true };
    expect(estadoComplemento(entrada('confirmado', 'outros', LIDO, { atual }))).toBe('a_revisar');
    expect(estadoComplemento(entrada('corrigido', 'rotina', LIDO, { atual, pergunta: { estado: 'corrigido', valor: 'rotina', pelaUsuaria: true } }))).toBe('nao_se_aplica');
  });

  // @trace FL-002, DEC-200
  it('complemento confirmado automaticamente pelo worker é reavaliado, não mantido', () => {
    const atual = { estado: 'confirmado_automaticamente' as const, pelaUsuaria: false, revisaoReaberta: false };
    expect(estadoComplemento(entrada('confirmado', 'dor', LIDO, { atual }))).toBe('a_revisar');
  });
});

describe('pré-regra 1b — propriedades', () => {
  const estados: EstadoItem[] = [
    'pendente_leitura', 'aguardando_condicao', 'confirmado_automaticamente', 'a_revisar', 'confirmado', 'corrigido', 'em_branco', 'ilegivel', 'rasurado', 'nao_se_aplica',
  ];
  const arbEntrada = fc.record({
    estado: fc.constantFrom(...estados),
    valor: fc.option(fc.constantFrom('outros', 'dor', 'rotina', 'dor;outros'), { nil: null }),
    pelaUsuaria: fc.boolean(),
    lido: fc.option(fc.record({ valor: fc.option(fc.string({ minLength: 1, maxLength: 250 }).filter((t) => t.trim().length > 0), { nil: null }), confianca: fc.double({ min: 0, max: 1, noNaN: true }) }), { nil: null }),
  });

  // @trace FL-002, DEC-197
  it('na primeira avaliação, o resultado é sempre um dos 4 estados da 1b', () => {
    fc.assert(
      fc.property(arbEntrada, (x) => {
        const r = estadoComplemento({ opcao: 'outros', pergunta: { estado: x.estado, valor: x.valor, pelaUsuaria: x.pelaUsuaria }, lido: x.lido, limite: LIMITE });
        expect(['aguardando_condicao', 'nao_se_aplica', 'a_revisar', 'confirmado_automaticamente']).toContain(r);
      }),
    );
  });

  // @trace FL-002, DEC-200, DEC-028
  it('confirmado_automaticamente só com a opção marcada, texto de 1 a 200 caracteres e confiança acima do limite', () => {
    fc.assert(
      fc.property(arbEntrada, (x) => {
        const r = estadoComplemento({ opcao: 'outros', pergunta: { estado: x.estado, valor: x.valor, pelaUsuaria: x.pelaUsuaria }, lido: x.lido, limite: LIMITE });
        if (r !== 'confirmado_automaticamente') return;
        expect((x.valor ?? '').split(';')).toContain('outros');
        expect(x.lido?.valor).toBeTruthy();
        expect(x.lido!.valor!.length).toBeLessThanOrEqual(200);
        expect(x.lido!.confianca).toBeGreaterThan(LIMITE);
      }),
    );
  });
});
