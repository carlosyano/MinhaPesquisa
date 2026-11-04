// Preparação de cenários com dados 100% sintéticos (Q-001, GX-001).
// E-mails no domínio reservado .test; nomes fictícios; senhas que cumprem a política do P.2.
// Desde o IMP-005 cada tenant tem uma só usuária, com todas as permissões (DEC-109).

import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { Cliente } from './cliente.js';
import type { Harness } from './harness.js';

export const SENHA = 'Qv7mLt2pRx9w';
export const OUTRA_SENHA = 'Hn4sWc8kZe3j';
export const SENHA_ERRADA = 'Errada0000Xy';

let seq = 0;
export function emailSintetico(prefixo: string): string {
  seq += 1;
  return `${prefixo}.${seq}.${randomUUID().slice(0, 8)}@exemplo.test`;
}

export interface Pessoa {
  usuarioId: string;
  email: string;
  nome: string;
  senha: string;
}

export interface TenantPronto {
  tenantId: string;
  usuaria: Pessoa;
}

/** Tenant com a sua única usuária, já ativa (atalho `seed.tenant`, ver harness.ts). */
export async function tenantComUsuaria(h: Harness, nome = 'Tenant'): Promise<TenantPronto> {
  const email = emailSintetico('usuaria');
  const nomeUsuaria = 'Usuária Fictícia';
  const { tenantId, usuarioId } = await h.seed.tenant({
    nome: `${nome} ${randomUUID().slice(0, 6)}`,
    email,
    nomeUsuaria,
    senha: SENHA,
  });
  return { tenantId, usuaria: { usuarioId, email, nome: nomeUsuaria, senha: SENHA } };
}

/** Login com senha num cliente novo; falha o teste se não chegar à sessão (DEC-108). */
export async function entrar(h: Harness, p: Pick<Pessoa, 'email' | 'senha'>): Promise<Cliente> {
  const c = new Cliente(h.baseUrl);
  const login = await c.post('/auth/login', { corpo: { email: p.email, senha: p.senha } });
  expect(login.status, login.texto).toBe(200);
  expect(c.temCookie('mp_session')).toBe(true);
  return c;
}

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;
