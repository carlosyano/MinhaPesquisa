// Scripts locais da usuária (RF-001, CA-035, CA-037, RN-006, RN-007; PLANO §4.5; DEC-108).
// A instalação cria o único tenant e a conta; a redefinição troca a senha esquecida, encerra
// as sessões e audita. Rodam como mp_manutencao e escrevem no terminal só mensagens fixas,
// sem nome, e-mail nem senha (RN-028). Ficam aqui como funções para que o harness de teste
// e o script de linha de comando usem o mesmo código.

import { linha, sql, type Executor } from '../infra/banco.js';
import { hashSenha, hmacEmail, normalizarEmail, senhaAceita } from '../infra/cripto.js';
import type { Nucleo } from '../nucleo.js';

export interface SaidaScript {
  codigo: number;
  saida: string;
}

export interface DadosInstalacao {
  instituicao: string;
  nome: string;
  email: string;
  senha: string;
}

export const MENSAGEM = {
  instalada: 'Instalação concluída. Entre no MinhaPesquisa com o e-mail e a senha informados.',
  jaInstalada: 'Instalação recusada: o MinhaPesquisa já está instalado neste computador. Nada foi alterado.',
  semInstalacao: 'Redefinição recusada: o MinhaPesquisa ainda não foi instalado neste computador.',
  dadosInvalidos: 'Instalação recusada: informe o nome da instituição, o seu nome e um e-mail válido. Nada foi criado.',
  senhaFora:
    'Senha recusada: use de 10 a 72 caracteres, com letra minúscula, letra maiúscula e dígito, e evite senhas conhecidas. Nada foi alterado.',
  redefinida: 'Senha redefinida. As sessões abertas foram encerradas.',
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Trava única dos scripts: duas execuções simultâneas não criam dois tenants. */
async function travar(tx: Executor): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('minhapesquisa.instalacao'))`);
}

/**
 * Tenant ativo com a sua única usuária, sem a checagem de instalação única. Usado pela
 * instalação e, nos testes, para preparar vários tenants (DEC-116).
 */
export async function criarTenantComUsuaria(
  n: Nucleo,
  tx: Executor,
  dados: { nome: string; nomeUsuaria: string; email: string; senha: string },
): Promise<{ tenantId: string; usuarioId: string }> {
  const tenantId = n.id();
  const usuarioId = n.id();
  const agora = n.agora();
  const hash = await hashSenha(dados.senha);
  await tx.execute(sql`INSERT INTO tenant (id, nome, slug, criado_em) VALUES (${tenantId}, ${dados.nome}, ${slug(dados.nome, tenantId.slice(0, 8))}, ${agora})`);
  await tx.execute(sql`
    INSERT INTO usuario (id, tenant_id, email, nome, senha_hash, situacao, todos_projetos, criado_em)
    VALUES (${usuarioId}, ${tenantId}, ${normalizarEmail(dados.email)}, ${dados.nomeUsuaria}, ${hash}, 'ativo', true, ${agora})`);
  await tx.execute(sql`
    INSERT INTO auditoria (id, tenant_id, usuario_id, acao, entidade, registro_id, canal, criado_em)
    VALUES (${n.id()}, ${tenantId}, NULL, 'CRIAR_TENANT', 'Tenant', ${tenantId}, 'script', ${agora})`);
  return { tenantId, usuarioId };
}

/** Script de instalação (CA-035): recusa sem gravar nada se já houver tenant ou se a senha não servir. */
export async function instalar(n: Nucleo, d: DadosInstalacao): Promise<SaidaScript> {
  if (!d.instituicao.trim() || !d.nome.trim() || !EMAIL.test(normalizarEmail(d.email))) return { codigo: 2, saida: MENSAGEM.dadosInvalidos };
  if (!senhaAceita(d.senha)) return { codigo: 2, saida: MENSAGEM.senhaFora };
  return n.banco.manutencao(async (tx) => {
    await travar(tx);
    const existe = await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM tenant`);
    if (existe!.n > 0) return { codigo: 1, saida: MENSAGEM.jaInstalada };
    await criarTenantComUsuaria(n, tx, { nome: d.instituicao.trim(), nomeUsuaria: d.nome.trim(), email: d.email, senha: d.senha });
    return { codigo: 0, saida: MENSAGEM.instalada };
  });
}

/**
 * Script de redefinição de senha (CA-037): troca a senha da única usuária, encerra todas as
 * sessões, limpa o bloqueio por tentativas e audita REDEFINICAO_SENHA, sem a senha. Sem
 * e-mail nem link (DEC-108).
 */
export async function redefinirSenha(n: Nucleo, novaSenha: string): Promise<SaidaScript> {
  const conta = await n.banco.manutencao((tx) =>
    linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM usuario`),
  );
  if (conta!.n !== 1) return { codigo: 1, saida: MENSAGEM.semInstalacao };
  if (!senhaAceita(novaSenha)) return { codigo: 2, saida: MENSAGEM.senhaFora };
  const hash = await hashSenha(novaSenha);
  return n.banco.manutencao(async (tx) => {
    await travar(tx);
    const u = await linha<{ id: string; tenant_id: string; email: string }>(tx, sql`SELECT id, tenant_id, email FROM usuario FOR UPDATE`);
    if (!u) return { codigo: 1, saida: MENSAGEM.semInstalacao };
    const agora = n.agora();
    await tx.execute(sql`UPDATE usuario SET senha_hash = ${hash}, versao = versao + 1 WHERE id = ${u.id}`);
    await n.revogarSessoes(tx, u.id, 'senha_redefinida');
    await tx.execute(sql`DELETE FROM falha_login WHERE email_hmac = ${hmacEmail(n.config.chaveHmacEmail, u.email)}`);
    await tx.execute(sql`
      INSERT INTO auditoria (id, tenant_id, usuario_id, acao, entidade, registro_id, canal, criado_em)
      VALUES (${n.id()}, ${u.tenant_id}, NULL, 'REDEFINICAO_SENHA', 'Usuario', ${u.id}, 'script', ${agora})`);
    return { codigo: 0, saida: MENSAGEM.redefinida };
  });
}
