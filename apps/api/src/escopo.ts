// Escopo de acesso e parâmetros compartilhados pelos módulos do IMP-002.
// Recurso fora do escopo (outro tenant ou inexistente) → 404 auditado (PLANO §6.1). Sem
// perfis nem vínculo a projetos desde o IMP-005 (DEC-109).

import { linha, sql, type Executor } from './infra/banco.js';
import { naoEncontrado } from './infra/erros.js';
import { ehUuid } from './nucleo.js';

export interface LinhaProjeto {
  id: string;
  /** Código sequencial do projeto no tenant, de 1 a 99999 (DEC-217). */
  codigo: number;
  nome: string;
  descricao: string | null;
  objetivo: string | null;
  coordenador: string | null;
  coleta_inicio: string | null;
  coleta_fim: string | null;
  status: 'ativo' | 'arquivado';
  criado_em: Date;
  versao: number;
  padrao_data_aplicacao: string | null;
  /** Cifrado (RN-028). */
  padrao_local_aplicacao: string | null;
}

export const etag = (versao: number) => `"${versao}"`;

/** Colunas de LinhaProjeto, com as datas do ciclo de coleta como YYYY-MM-DD (DEC-137). */
export const COLUNAS_PROJETO = sql.raw(
  `id, codigo, nome, descricao, objetivo, coordenador, to_char(coleta_inicio, 'YYYY-MM-DD') AS coleta_inicio,
   to_char(coleta_fim, 'YYYY-MM-DD') AS coleta_fim, status, criado_em, versao,
   to_char(padrao_data_aplicacao, 'YYYY-MM-DD') AS padrao_data_aplicacao, padrao_local_aplicacao`,
);

/** Projeto do tenant da sessão (a RLS limita ao tenant, RN-004); senão 404 auditado. */
export async function projetoNoEscopo(tx: Executor, id: string, bloquear = false): Promise<LinhaProjeto> {
  if (!ehUuid(id)) throw naoEncontrado('Projeto', null);
  const p = await linha<LinhaProjeto>(
    tx,
    bloquear
      ? sql`SELECT ${COLUNAS_PROJETO} FROM projeto WHERE id = ${id} FOR UPDATE`
      : sql`SELECT ${COLUNAS_PROJETO} FROM projeto WHERE id = ${id}`,
  );
  if (!p) throw naoEncontrado('Projeto', id);
  return p;
}

/** Valores-padrão da seção 2.9 da REQ para os parâmetros usados do IMP-002 ao IMP-008. */
export const PADRAO_PARAMETRO: Record<string, string> = {
  custo_ia_teto: '500.00', // R$ por tenant e mês civil (CA-030, DEC-035)
  retencao_exportacao_dias: '7', // dias até apagar o arquivo da exportação (DEC-069)
  limite_confianca: '1.00', // sem confirmação automática até a calibração (DEC-127); depois, 0,90 (DEC-028)
  limite_confianca_localizacao: '0.50', // página reconhecida pela localização, até a calibração (DEC-178)
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
