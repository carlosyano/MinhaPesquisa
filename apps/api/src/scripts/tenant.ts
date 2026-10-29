// Criação de tenant pelo administrador da plataforma (DEC-017: sem tela na v1; CA-035).
// Cria o tenant, os quatro perfis e o primeiro administrador em pendente_convite, com
// convite de 24 h enviado por e-mail. Roda como mp_manutencao e fica auditado (canal script).

import { sql, type Executor } from '../infra/banco.js';
import { normalizarEmail, SENHA_INDEFINIDA } from '../infra/cripto.js';
import { NOMES_PERFIL, PERFIS, type Nucleo } from '../nucleo.js';

export interface NovoTenant {
  nome: string;
  emailAdmin: string;
  nomeAdmin: string;
}

function slug(nome: string, sufixo: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'tenant'}-${sufixo}`;
}

export async function criarPerfis(n: Nucleo, tx: Executor, tenantId: string): Promise<void> {
  for (const codigo of PERFIS) {
    await tx.execute(sql`INSERT INTO perfil (id, tenant_id, codigo, nome) VALUES (${n.id()}, ${tenantId}, ${codigo}, ${NOMES_PERFIL[codigo]})`);
  }
}

export async function criarTenant(n: Nucleo, dados: NovoTenant): Promise<{ tenantId: string; adminId: string }> {
  const tenantId = n.id();
  const adminId = n.id();
  const agora = n.agora();
  await n.banco.manutencao(async (tx) => {
    await tx.execute(sql`INSERT INTO tenant (id, nome, slug, criado_em) VALUES (${tenantId}, ${dados.nome}, ${slug(dados.nome, tenantId.slice(0, 8))}, ${agora})`);
    await criarPerfis(n, tx, tenantId);
    await tx.execute(sql`
      INSERT INTO usuario (id, tenant_id, email, nome, senha_hash, situacao, todos_projetos, criado_em)
      VALUES (${adminId}, ${tenantId}, ${normalizarEmail(dados.emailAdmin)}, ${dados.nomeAdmin}, ${SENHA_INDEFINIDA},
              'pendente_convite', true, ${agora})`);
    await tx.execute(sql`
      INSERT INTO usuario_perfil (id, tenant_id, usuario_id, perfil_id, criado_em)
      SELECT ${n.id()}, ${tenantId}, ${adminId}, id, ${agora} FROM perfil WHERE tenant_id = ${tenantId} AND codigo = 'admin_tenant'`);
    await n.criarTokenComEmail(tx, tenantId, adminId, 'convite');
    await tx.execute(sql`
      INSERT INTO auditoria (id, tenant_id, usuario_id, acao, entidade, registro_id, canal, criado_em)
      VALUES (${n.id()}, ${tenantId}, NULL, 'CRIAR_TENANT', 'Tenant', ${tenantId}, 'script', ${agora})`);
  });
  await n.despacharOutbox();
  return { tenantId, adminId };
}
