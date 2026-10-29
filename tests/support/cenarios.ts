// Preparação de cenários com dados 100% sintéticos (Q-001, GX-001).
// E-mails no domínio reservado .test; nomes fictícios; senhas que cumprem a política do P.2.

import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { Cliente } from './cliente.js';
import type { Harness, Perfil } from './harness.js';
import { codigoTotp } from './totp.js';

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
  senha: string;
  segredoTotp: string;
}

export interface TenantPronto {
  tenantId: string;
  admin: Pessoa;
}

/** Tenant criado pelo script, com um administrador ativo e MFA cadastrado. */
export async function tenantComAdmin(h: Harness, nome = 'Tenant'): Promise<TenantPronto> {
  const { tenantId } = await h.seed.tenant({
    nome: `${nome} ${randomUUID().slice(0, 6)}`,
    emailAdmin: emailSintetico('primeiro.admin'),
    nomeAdmin: 'Primeiro Admin Fictício',
  });
  const admin = await pessoa(h, tenantId, ['admin_tenant'], 'admin');
  return { tenantId, admin };
}

export async function pessoa(
  h: Harness,
  tenantId: string,
  perfis: Perfil[],
  prefixo: string,
  vinculo: { todosProjetos?: boolean; projetos?: string[] } = {},
): Promise<Pessoa> {
  const email = emailSintetico(prefixo);
  const { usuarioId, segredoTotp } = await h.seed.usuarioAtivo({
    tenantId,
    email,
    nome: `Pessoa Fictícia ${prefixo}`,
    senha: SENHA,
    perfis,
    ...vinculo,
  });
  return { usuarioId, email, senha: SENHA, segredoTotp };
}

/** Login completo (senha + TOTP) num cliente novo; falha o teste se não chegar à sessão plena. */
export async function entrar(h: Harness, p: Pessoa): Promise<Cliente> {
  const c = new Cliente(h.baseUrl);
  const login = await c.post('/auth/login', { corpo: { email: p.email, senha: p.senha } });
  expect(login.status, login.texto).toBe(200);
  expect(login.corpo).toEqual({ etapa: 'mfa_verificacao' });
  const mfa = await c.post('/auth/mfa/verify', { corpo: { codigo: codigoTotp(p.segredoTotp, h.clock.now()) } });
  expect(mfa.status, mfa.texto).toBe(200);
  expect(c.temCookie('mp_session')).toBe(true);
  // Próximo passo TOTP: a API pode recusar a reutilização do mesmo código (anti-replay).
  await h.clock.advance(30_000);
  return c;
}

/** Token do último e-mail do tipo enviado ao endereço. */
export function ultimoToken(h: Harness, para: string, tipo: 'convite' | 'recuperacao_senha' | 'reset_mfa'): string {
  const e = h.mail
    .enviados()
    .filter((m) => m.para === para && m.tipo === tipo)
    .at(-1);
  if (!e) throw new Error(`nenhum e-mail ${tipo} para ${para}`);
  return e.token;
}

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;
