// Conteúdo de versões no banco (RF-004): leitura no formato do contrato e gravação das perguntas,
// opções, linhas e regras de salto. Compartilhado pelo controlador de formulários, pela importação
// (RN-049) e pelo harness de teste.

import { linhas, sql, type Executor } from '../infra/banco.js';
import type { Nucleo } from '../nucleo.js';
import type { Pergunta, RegraEntrada } from '../regras/formularios.js';

const TIPOS_COM_OPCOES = ['escolha_unica', 'multipla_escolha', 'escala', 'matriz', 'sim_nao'];

/** Conteúdo gravado da versão, no formato do contrato (VersionContent). */
export async function lerConteudo(tx: Executor, versaoId: string): Promise<{ perguntas: Pergunta[]; regras_salto: RegraEntrada[] }> {
  const ps = await linhas<Omit<Pergunta, 'opcoes' | 'linhas'> & { id: string; valor_min: string | null; valor_max: string | null }>(
    tx,
    sql`SELECT id, codigo, tipo, enunciado, ordem, pagina, obrigatorio, campo_respondente, campo_aplicacao, sensibilidade,
               valor_min, valor_max, unidade
          FROM pergunta WHERE versao_id = ${versaoId} ORDER BY ordem, codigo`,
  );
  const ops = await linhas<{ pergunta_id: string; codigo: string; rotulo: string; ordem: number }>(
    tx,
    sql`SELECT o.pergunta_id, o.codigo, o.rotulo, o.ordem FROM opcao o JOIN pergunta p ON p.id = o.pergunta_id
         WHERE p.versao_id = ${versaoId} ORDER BY o.ordem, o.codigo`,
  );
  const lms = await linhas<{ pergunta_id: string; codigo: string; rotulo: string; ordem: number }>(
    tx,
    sql`SELECT l.pergunta_id, l.codigo, l.rotulo, l.ordem FROM linha_matriz l JOIN pergunta p ON p.id = l.pergunta_id
         WHERE p.versao_id = ${versaoId} ORDER BY l.ordem, l.codigo`,
  );
  const regras = await linhas<RegraEntrada>(
    tx,
    sql`SELECT o.codigo AS pergunta_origem_codigo, d.codigo AS pergunta_destino_codigo, r.opcao_codigo
          FROM regra_salto r JOIN pergunta o ON o.id = r.pergunta_origem_id JOIN pergunta d ON d.id = r.pergunta_destino_id
         WHERE r.versao_id = ${versaoId} ORDER BY r.posicao`,
  );
  const perguntas = ps.map((p): Pergunta => {
    const opcoes = ops.filter((o) => o.pergunta_id === p.id).map(({ codigo, rotulo, ordem }) => ({ codigo, rotulo, ordem }));
    const linhasM = lms.filter((l) => l.pergunta_id === p.id).map(({ codigo, rotulo, ordem }) => ({ codigo, rotulo, ordem }));
    return {
      codigo: p.codigo,
      tipo: p.tipo,
      enunciado: p.enunciado,
      ordem: p.ordem,
      pagina: p.pagina,
      obrigatorio: p.obrigatorio,
      campo_respondente: p.campo_respondente,
      campo_aplicacao: p.campo_aplicacao,
      sensibilidade: p.sensibilidade,
      linhas: p.tipo === 'matriz' ? linhasM : null,
      valor_min: p.valor_min === null ? null : Number(p.valor_min),
      valor_max: p.valor_max === null ? null : Number(p.valor_max),
      unidade: p.unidade,
      opcoes: opcoes.length || TIPOS_COM_OPCOES.includes(p.tipo) ? opcoes : null,
    };
  });
  return { perguntas, regras_salto: regras };
}

/** Substitui o conteúdo da versão (perguntas já normalizadas, códigos únicos). */
export async function gravarConteudo(n: Nucleo, tx: Executor, tenantId: string, versaoId: string, perguntas: readonly Pergunta[], regras: readonly RegraEntrada[]): Promise<void> {
  await tx.execute(sql`DELETE FROM regra_salto WHERE versao_id = ${versaoId}`);
  await tx.execute(sql`DELETE FROM pergunta WHERE versao_id = ${versaoId}`);
  const ids = new Map<string, string>();
  for (const p of perguntas) {
    const id = n.id();
    ids.set(p.codigo, id);
    await tx.execute(sql`
      INSERT INTO pergunta (id, tenant_id, versao_id, codigo, tipo, enunciado, ordem, pagina, obrigatorio,
                            campo_respondente, campo_aplicacao, sensibilidade, valor_min, valor_max, unidade)
      VALUES (${id}, ${tenantId}, ${versaoId}, ${p.codigo}, ${p.tipo}, ${p.enunciado}, ${p.ordem}, ${p.pagina},
              ${p.obrigatorio}, ${p.campo_respondente}, ${p.campo_aplicacao}, ${p.sensibilidade},
              ${p.valor_min}, ${p.valor_max}, ${p.unidade})`);
    for (const o of p.opcoes ?? []) {
      await tx.execute(sql`
        INSERT INTO opcao (id, tenant_id, pergunta_id, codigo, rotulo, ordem)
        VALUES (${n.id()}, ${tenantId}, ${id}, ${o.codigo}, ${o.rotulo}, ${o.ordem})`);
    }
    for (const l of p.linhas ?? []) {
      await tx.execute(sql`
        INSERT INTO linha_matriz (id, tenant_id, pergunta_id, codigo, rotulo, ordem)
        VALUES (${n.id()}, ${tenantId}, ${id}, ${l.codigo}, ${l.rotulo}, ${l.ordem})`);
    }
  }
  for (const [posicao, r] of regras.entries()) {
    await tx.execute(sql`
      INSERT INTO regra_salto (id, tenant_id, versao_id, pergunta_origem_id, pergunta_destino_id, opcao_codigo, posicao, criado_em)
      VALUES (${n.id()}, ${tenantId}, ${versaoId}, ${ids.get(r.pergunta_origem_codigo)}, ${ids.get(r.pergunta_destino_codigo)},
              ${r.opcao_codigo}, ${posicao + 1}, ${n.agora()})`);
  }
}

/** Formulário novo com a versão 1 em rascunho, ainda sem conteúdo. */
export async function criarFormularioRascunho(n: Nucleo, tx: Executor, d: { tenantId: string; projetoId: string; nome: string }): Promise<{ formId: string; versaoId: string }> {
  const formId = n.id();
  await tx.execute(sql`
    INSERT INTO formulario (id, tenant_id, projeto_id, nome, criado_em)
    VALUES (${formId}, ${d.tenantId}, ${d.projetoId}, ${d.nome}, ${n.agora()})`);
  const versaoId = n.id();
  await tx.execute(sql`
    INSERT INTO versao (id, tenant_id, formulario_id, numero, status, criada_em)
    VALUES (${versaoId}, ${d.tenantId}, ${formId}, 1, 'rascunho', ${n.agora()})`);
  return { formId, versaoId };
}
