// Vínculo do respondente pelo CPF (RF-005, RN-015, CA-002, CA-014, CA-014b), assinatura anexada
// depois (CA-044, DEC-064) e reabertura com reversão do cadastro e anonimização (CA-042, DEC-078,
// PLANO §4.4). A auditoria leva só o atributo afetado, nunca o valor (RN-027, CA-008).

import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { DIA, somar } from '../infra/relogio.js';
import type { Ator, Nucleo } from '../nucleo.js';
import {
  ATRIBUTOS,
  atributosLidos,
  cadastroPorCpf,
  carregarItens,
  cpfDaAplicacao,
  type Atributo,
  type Item,
  type LinhaAplicacao,
} from '../leitura/dominio.js';

export type ManterCadastro = Partial<Record<Atributo, 'existente' | 'aplicacao'>>;

/** Validade do registro na lista de eliminações (ENT-019). */
const VALIDADE_LISTA = 180 * DIA;

/**
 * Vincula a aplicação ao respondente do CPF: cria o respondente se o CPF é novo (CA-014b) ou
 * aplica `manter` a cada atributo divergente do cadastro existente (CA-014), guardando o valor
 * anterior para a reversão (ENT-023). Se a aplicação já esteve vinculada a outro respondente
 * (reabertura com CPF corrigido), esse fica anonimizado quando não lhe resta aplicação concluída.
 */
export async function vincular(n: Nucleo, tx: Executor, ator: Ator, aplicacaoId: string, itens: Item[], manter: ManterCadastro): Promise<string> {
  const cpf = cpfDaAplicacao(itens);
  if (!cpf) throw new Error('vínculo sem CPF válido');
  const lidos = atributosLidos(itens);
  const existente = await cadastroPorCpf(n, tx, cpf);
  let id: string;
  if (existente) {
    id = existente.id;
    let mudou = false;
    for (const a of ATRIBUTOS) {
      const novo = lidos[a];
      if (novo === undefined || novo === existente[a]) continue;
      if (manter[a] === 'aplicacao') {
        await tx.execute(sql`
          INSERT INTO historico_atributo_respondente (id, tenant_id, respondente_id, aplicacao_id, atributo, valor_anterior_cifrado, valor_gravado_hash, criado_em)
          VALUES (${n.id()}, ${ator.tenantId}, ${id}, ${aplicacaoId}, ${a}, ${n.cifrar(existente[a])}, ${n.hmac(novo)}, ${n.agora()})`);
        await tx.execute(sql`UPDATE respondente SET ${sql.raw(a)} = ${novo} WHERE id = ${id}`);
        await n.auditar(tx, ator, 'ALTERAR_CADASTRO', 'Respondente', id, { origem: 'aplicacao' }, a);
        mudou = true;
      } else {
        await n.auditar(tx, ator, 'MANTER_CADASTRO', 'Aplicacao', aplicacaoId, undefined, a);
      }
    }
    if (mudou) await tx.execute(sql`UPDATE respondente SET versao = versao + 1 WHERE id = ${id}`);
  } else {
    id = n.id();
    await tx.execute(sql`
      INSERT INTO respondente (id, tenant_id, nome, data_nascimento, cpf_cifrado, cpf_hash, endereco, criado_em)
      VALUES (${id}, ${ator.tenantId}, ${lidos.nome ?? ''}, ${lidos.data_nascimento ?? null}::date, ${n.cifrar(cpf)}, ${n.hmac(cpf)},
              ${lidos.endereco ?? null}, ${n.agora()})`);
    await n.auditar(tx, ator, 'CRIAR_RESPONDENTE', 'Respondente', id);
  }
  const anterior = (await linha<{ r: string | null }>(tx, sql`SELECT respondente_anterior_id AS r FROM aplicacao WHERE id = ${aplicacaoId}`))?.r;
  if (anterior && anterior !== id) await anonimizarSemAplicacao(n, tx, ator, anterior, aplicacaoId);
  return id;
}

/** Respondente sem nenhuma aplicação concluída é anonimizado (DEC-078), com registro na ListaEliminacoes. */
async function anonimizarSemAplicacao(n: Nucleo, tx: Executor, ator: Ator, respondenteId: string, exceto: string): Promise<void> {
  const outras = await linha<{ n: number }>(
    tx,
    sql`SELECT count(*)::int AS n FROM aplicacao WHERE respondente_id = ${respondenteId} AND estado = 'concluida' AND id <> ${exceto}`,
  );
  if (outras!.n > 0) return;
  await tx.execute(sql`
    UPDATE respondente SET nome = 'ANONIMIZADO', data_nascimento = NULL, cpf_cifrado = NULL, cpf_hash = NULL, endereco = NULL,
                           anonimizado = true, versao = versao + 1
     WHERE id = ${respondenteId} AND NOT anonimizado`);
  await tx.execute(sql`DELETE FROM historico_atributo_respondente WHERE respondente_id = ${respondenteId}`);
  const agora = n.agora();
  await tx.execute(sql`
    INSERT INTO lista_eliminacoes (id, tenant_id, motivo, respondente_id_original, eliminado_em, valido_ate)
    VALUES (${n.id()}, ${ator.tenantId}, 'anonimizacao_reabertura', ${respondenteId}, ${agora}, ${somar(agora, VALIDADE_LISTA)})
    ON CONFLICT DO NOTHING`);
  await n.auditar(tx, ator, 'ANONIMIZAR_RESPONDENTE', 'Respondente', respondenteId, { motivo: 'anonimizacao_reabertura' });
}

/** Versão do cadastro do CPF da aplicação (0 quando ainda não há respondente): base da conferência da CA-044. */
export async function versaoDoCadastro(n: Nucleo, tx: Executor, itens: Item[]): Promise<number> {
  const cpf = cpfDaAplicacao(itens);
  return cpf ? ((await cadastroPorCpf(n, tx, cpf))?.versao ?? 0) : 0;
}

/**
 * Página 1 assinada anexada (CA-044): se o cadastro não mudou desde a conclusão sem assinatura,
 * vincula com o `manter_cadastro` gravado e conclui; senão volta a em_revisao com aviso ERR-018,
 * para a usuária conferir as divergências de novo (FL-001).
 */
export async function anexarAssinatura(n: Nucleo, tx: Executor, ator: Ator, a: LinhaAplicacao): Promise<void> {
  const itens = await carregarItens(n, tx, a.id);
  if ((await versaoDoCadastro(n, tx, itens)) !== (a.cadastro_versao ?? 0)) {
    await tx.execute(sql`
      UPDATE aplicacao SET estado = 'em_revisao', aviso = 'ERR-018', assinatura = 'presente', manter_cadastro = NULL,
                           cadastro_versao = NULL, versao = versao + 1
       WHERE id = ${a.id}`);
    await n.auditar(tx, ator, 'ANEXAR_ASSINATURA', 'Aplicacao', a.id, { resultado: 'cadastro_alterado' });
    return;
  }
  const respondenteId = await vincular(n, tx, ator, a.id, itens, a.manter_cadastro ?? {});
  await tx.execute(sql`
    UPDATE aplicacao SET estado = 'concluida', aviso = NULL, assinatura = 'presente', respondente_id = ${respondenteId},
                         respondente_anterior_id = NULL, concluida_em = ${n.agora()}, versao = versao + 1
     WHERE id = ${a.id}`);
  await n.auditar(tx, ator, 'ANEXAR_ASSINATURA', 'Aplicacao', a.id, { resultado: 'concluida' });
}

/**
 * Reabertura (CA-042, PLANO §4.4): volta ao valor anterior cada atributo que a aplicação alterou,
 * desde que nenhuma outra aplicação o tenha alterado depois e que o valor atual ainda seja o
 * gravado por ela.
 */
export async function reverterCadastro(n: Nucleo, tx: Executor, ator: Ator, aplicacaoId: string): Promise<void> {
  const alteracoes = await linhas<{ id: string; respondente_id: string; atributo: Atributo; valor_anterior_cifrado: string | null; valor_gravado_hash: Buffer; seq: string }>(
    tx,
    sql`SELECT id, respondente_id, atributo, valor_anterior_cifrado, valor_gravado_hash, seq::text AS seq
          FROM historico_atributo_respondente
         WHERE aplicacao_id = ${aplicacaoId} AND revertido_em IS NULL ORDER BY seq DESC`,
  );
  for (const h of alteracoes) {
    const col = sql.raw(h.atributo);
    const r = await linha<{ atual: string | null; depois: boolean }>(
      tx,
      sql`SELECT ${h.atributo === 'data_nascimento' ? sql`to_char(data_nascimento, 'YYYY-MM-DD')` : col} AS atual,
                 EXISTS (SELECT 1 FROM historico_atributo_respondente x
                          WHERE x.respondente_id = ${h.respondente_id} AND x.atributo = ${h.atributo}
                            AND x.seq > ${h.seq}::bigint AND x.aplicacao_id <> ${aplicacaoId}) AS depois
            FROM respondente WHERE id = ${h.respondente_id} AND NOT anonimizado`,
    );
    if (r && !r.depois && r.atual !== null && n.hmac(r.atual).equals(h.valor_gravado_hash)) {
      await tx.execute(sql`UPDATE respondente SET ${col} = ${n.decifrar(h.valor_anterior_cifrado)}, versao = versao + 1 WHERE id = ${h.respondente_id}`);
      await n.auditar(tx, ator, 'REVERTER_CADASTRO', 'Respondente', h.respondente_id, { aplicacao_id: aplicacaoId }, h.atributo);
    }
    await tx.execute(sql`UPDATE historico_atributo_respondente SET revertido_em = ${n.agora()} WHERE id = ${h.id}`);
  }
}
