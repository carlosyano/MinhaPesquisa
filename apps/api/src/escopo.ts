// Escopo de acesso e parâmetros compartilhados pelos módulos do IMP-002.
// Ordem de autorização (PLANO §6.1): recurso fora do escopo (outro tenant, inexistente ou de
// projeto não vinculado) → 404 auditado; depois, perfil sem permissão → 403.

import { linha, sql, type Executor } from './infra/banco.js';
import { naoEncontrado } from './infra/erros.js';
import { ehUuid, type Nucleo, type SessaoAtiva } from './nucleo.js';

export interface LinhaProjeto {
  id: string;
  nome: string;
  descricao: string | null;
  status: 'ativo' | 'arquivado';
  criado_em: Date;
  versao: number;
}

export const etag = (versao: number) => `"${versao}"`;

/** Projeto do tenant vinculado ao usuário (RN-004, DEC-068); senão 404 auditado. */
export async function projetoNoEscopo(n: Nucleo, tx: Executor, s: SessaoAtiva, id: string, bloquear = false): Promise<LinhaProjeto> {
  if (!ehUuid(id)) throw naoEncontrado('Projeto', null);
  const p = await linha<LinhaProjeto>(
    tx,
    bloquear
      ? sql`SELECT id, nome, descricao, status, criado_em, versao FROM projeto WHERE id = ${id} FOR UPDATE`
      : sql`SELECT id, nome, descricao, status, criado_em, versao FROM projeto WHERE id = ${id}`,
  );
  if (!p) throw naoEncontrado('Projeto', id);
  const vinculado = await linha<{ ok: boolean }>(
    tx,
    sql`SELECT (u.todos_projetos OR EXISTS (SELECT 1 FROM vinculo_usuario_projeto v
                                             WHERE v.usuario_id = u.id AND v.projeto_id = ${id})) AS ok
          FROM usuario u WHERE u.id = ${s.usuarioId}`,
  );
  if (!vinculado?.ok) throw naoEncontrado('Projeto', id);
  return p;
}

/** Valores-padrão da seção 2.9 da REQ para os parâmetros usados no IMP-002. */
export const PADRAO_PARAMETRO: Record<string, string> = {
  grupo_minimo: '5',
  termo_consentimento:
    'Termo de consentimento. Autorizo o uso das minhas respostas a este formulário, inclusive as de saúde, ' +
    'pela instituição responsável pela pesquisa, para fins de acompanhamento e análise, conforme a Lei Geral de ' +
    'Proteção de Dados (Lei 13.709/2018). Posso pedir acesso, correção ou eliminação dos meus dados a qualquer momento.',
};

/** Valor efetivo: projeto → tenant → plataforma → padrão da seção 2.9 (ENT-020). */
export async function parametro(tx: Executor, chave: string, tenantId: string, projetoId: string | null): Promise<string> {
  const r = await linha<{ valor: string }>(
    tx,
    sql`SELECT valor FROM parametro_configuracao
         WHERE chave = ${chave} AND competencia IS NULL
           AND (tenant_id IS NULL OR tenant_id = ${tenantId})
           AND (projeto_id IS NULL OR projeto_id = ${projetoId}::uuid)
         ORDER BY (projeto_id IS NOT NULL) DESC, (tenant_id IS NOT NULL) DESC
         LIMIT 1`,
  );
  const v = r?.valor ?? PADRAO_PARAMETRO[chave];
  if (v === undefined) throw new Error(`parâmetro sem valor nem padrão: ${chave}`);
  return v;
}
