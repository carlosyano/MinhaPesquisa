// Worker da importação de formulário (RF-011, FL-004, DEC-142), rodado pelo worker da leitura
// (DEC-124), com o mesmo relógio, as mesmas retentativas (1 e 2 s, DEC-129) e a mesma reserva de
// custo (DEC-051, DEC-130).
//
// - Tarefa: lê a página da pasta da importação, reduz para no máximo 2000 px no lado maior, reserva
//   o custo estimado, chama o extrator fora da transação, ajusta pelo custo real e guarda a
//   estrutura em `tarefa_importacao.resultado`. Página que não se lê do disco ou não se converte
//   em imagem é falha da tarefa, como a chamada (FL-004).
// - Cota: teto atingido ou mês sem cotação → `aguardando_cota`, com as tarefas restantes suspensas
//   e as páginas já lidas mantidas; a retomada roda a cada `processar`.
// - Fim: com todas as páginas lidas, uma só transação aplica a RN-049 e a RN-050, cria o formulário
//   e a versão 1 em rascunho e audita; a 3ª falha de uma página leva a `falhou` (ERR-044). Nos dois
//   casos as tarefas e os arquivos são apagados.
//
// Nada do conteúdo lido entra no log nem na auditoria (RN-028): só IDs, páginas e contagens.

import { ErroLeitura } from '@minhapesquisa/motor-leitura';
import sharp from 'sharp';
import { criarFormularioRascunho, gravarConteudo } from '../formularios/conteudo.js';
import { bloco, fonteDeMedida, limiteInferior, A, TOPO } from '../formularios/layout.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { MINUTO, somar } from '../infra/relogio.js';
import type { Nucleo } from '../nucleo.js';
import { reaplicarCampos } from '../regras/campos-padrao.js';
import { normalizarConteudo, type PerguntaEntrada } from '../regras/formularios.js';
import { montarVersao, montarVersaoAntiga, validarEstrutura, type PerguntaLida } from '../regras/importacao.js';
import { ajustar, cotaDoTenant, reservar } from './dominio.js';
import type { ExtratorEstrutura } from './extrator.js';
import { ESPERAS_MS } from './worker.js';

/** Maior lado da página enviada ao extrator (PLANO §4.8). */
export const LADO_EXTRATOR = 2000;

/** Pasta da importação na pasta privada de imagens, fora das pastas de aplicação (PLANO §4.8). */
export const pastaImportacao = (tenantId: string, importacaoId: string) => `tenant/${tenantId}/importacao/${importacaoId}/`;
export const chavePaginaImportacao = (tenantId: string, importacaoId: string, pagina: number) => `${pastaImportacao(tenantId, importacaoId)}${pagina}.jpg`;

interface Tarefa {
  id: string;
  tenant_id: string;
  importacao_id: string;
  pagina: number;
  tentativas: number;
}

interface LinhaImportacao {
  id: string;
  projeto_id: string;
  nome_formulario: string;
  estado: string;
  total_paginas: number;
  criada_por: string;
  papel_antigo?: boolean;
}

interface Preparada {
  extrator: ExtratorEstrutura;
  imagem: Buffer;
  estimadoUsd: number;
  inicio: string;
  cotacao: string;
}

const TERMINADA = ['concluida', 'falhou'];

export class WorkerImportacao {
  constructor(private readonly n: Nucleo) {}

  /** Tarefas suspensas pela cota voltam quando o mês tem cotação e o teto não foi atingido (FL-004). */
  async retomarCota(): Promise<void> {
    const aguardando = await this.n.banco.manutencao((tx) =>
      linhas<{ id: string; tenant_id: string }>(tx, sql`SELECT id, tenant_id FROM importacao_formulario WHERE estado = 'aguardando_cota' ORDER BY criada_em, id`),
    );
    for (const i of aguardando) {
      await this.n.banco.noTenant(i.tenant_id, async (tx) => {
        const cota = await cotaDoTenant(this.n, tx, i.tenant_id);
        if (!cota.cotacao || cota.atingido) return;
        await tx.execute(sql`
          UPDATE tarefa_importacao SET situacao = 'pendente', executar_em = ${this.n.agora()}
           WHERE importacao_id = ${i.id} AND situacao = 'suspensa'`);
        this.n.log(`importacao_retomada importacao=${i.id}`);
      });
    }
  }

  /** Executa as tarefas já vencidas no relógio; devolve quantas encontrou. */
  async executarVencidas(): Promise<number> {
    const vencidas = await this.n.banco.manutencao((tx) =>
      linhas<Tarefa>(
        tx,
        sql`SELECT id, tenant_id, importacao_id, pagina, tentativas FROM tarefa_importacao
             WHERE situacao = 'pendente' AND executar_em <= ${this.n.agora()}
             ORDER BY executar_em, importacao_id, pagina`,
      ),
    );
    for (const t of vencidas) {
      try {
        await this.executar(t);
      } catch (e) {
        // Erro fora do extrator: conta como falha da tarefa, para não travar a fila nela (DEC-130).
        const nome = e instanceof Error ? e.name : 'erro';
        this.n.log(`worker_erro importacao=${t.importacao_id} pagina=${t.pagina} erro=${nome}`);
        await this.n.banco.noTenant(t.tenant_id, (tx) => this.registrarFalha(tx, t, new ErroLeitura('erro', nome)));
      }
    }
    return vencidas.length;
  }

  private async executar(t: Tarefa): Promise<void> {
    const preparada = await this.n.banco.noTenant(t.tenant_id, (tx) => this.prepararChamada(tx, t));
    if (!preparada) return;
    let resultado: Awaited<ReturnType<ExtratorEstrutura['extrairPagina']>> | undefined;
    let falha: ErroLeitura | undefined;
    try {
      resultado = await preparada.extrator.extrairPagina(preparada.imagem);
      const v = validarEstrutura(resultado); // RN-037: a saída é conferida qualquer que seja o extrator
      if ('erro' in v) throw new ErroLeitura('malformada', v.erro);
    } catch (e) {
      falha = e instanceof ErroLeitura ? e : new ErroLeitura('erro', e instanceof Error ? e.name : 'erro');
    }
    await this.n.banco.noTenant(t.tenant_id, async (tx) => {
      await ajustar(tx, t.tenant_id, preparada.inicio, preparada.cotacao, preparada.estimadoUsd, resultado?.custoUsd ?? 0);
      await tx.execute(sql`UPDATE tarefa_importacao SET custo_reservado_usd = NULL WHERE id = ${t.id}`);
      if (falha) await this.registrarFalha(tx, t, falha);
      else await this.gravarResultado(tx, t, resultado!.perguntas);
    });
  }

  /** Primeira fase, numa transação: confere o estado, lê a página, estima e reserva a cota. */
  private async prepararChamada(tx: Executor, t: Tarefa): Promise<Preparada | undefined> {
    const imp = await linha<LinhaImportacao>(tx, sql`SELECT id, estado FROM importacao_formulario WHERE id = ${t.importacao_id} FOR UPDATE`);
    const atual = await linha<{ situacao: string }>(tx, sql`SELECT situacao FROM tarefa_importacao WHERE id = ${t.id}`);
    if (!imp || TERMINADA.includes(imp.estado) || atual?.situacao !== 'pendente') return undefined;
    const extrator = this.n.config.extratorEstrutura?.({ importacaoId: t.importacao_id, pagina: t.pagina });
    if (!extrator) {
      // Sem chave do provedor configurada: a tarefa espera, sem contar tentativa.
      this.n.log(`importacao_sem_extrator importacao=${t.importacao_id}`);
      await tx.execute(sql`UPDATE tarefa_importacao SET executar_em = ${somar(this.n.agora(), MINUTO)} WHERE id = ${t.id}`);
      return undefined;
    }
    const cota = await cotaDoTenant(this.n, tx, t.tenant_id);
    if (!cota.cotacao || cota.atingido) {
      await this.pausarPorCota(tx, t.importacao_id, cota.cotacao ? 'teto' : 'sem_cotacao');
      return undefined;
    }
    let imagem: Buffer;
    try {
      imagem = await sharp(await this.n.config.armazenamento.ler(chavePaginaImportacao(t.tenant_id, t.importacao_id, t.pagina)))
        .resize({ width: LADO_EXTRATOR, height: LADO_EXTRATOR, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      // Arquivo sumido ou corrompido: falha da tarefa, com as mesmas retentativas (FL-004, DEC-130).
      await this.registrarFalha(tx, t, new ErroLeitura('erro', 'página ilegível'));
      return undefined;
    }
    const estimadoUsd = extrator.estimarCustoUsd(imagem);
    if (!(await reservar(tx, t.tenant_id, cota, estimadoUsd))) {
      await this.pausarPorCota(tx, t.importacao_id, 'teto');
      return undefined;
    }
    await tx.execute(sql`UPDATE tarefa_importacao SET custo_reservado_usd = ${String(estimadoUsd)}::numeric WHERE id = ${t.id}`);
    await tx.execute(sql`UPDATE importacao_formulario SET estado = 'em_andamento', aviso = NULL WHERE id = ${t.importacao_id}`);
    return { extrator, imagem, estimadoUsd, inicio: cota.inicio, cotacao: cota.cotacao };
  }

  private async gravarResultado(tx: Executor, t: Tarefa, perguntas: PerguntaLida[]): Promise<void> {
    const imp = await linha<LinhaImportacao>(tx, sql`SELECT estado FROM importacao_formulario WHERE id = ${t.importacao_id} FOR UPDATE`);
    this.n.log(`importacao importacao=${t.importacao_id} pagina=${t.pagina} resultado=ok tentativa=${t.tentativas + 1}`);
    if (!imp || TERMINADA.includes(imp.estado)) return;
    await tx.execute(sql`
      UPDATE tarefa_importacao SET situacao = 'concluida', tentativas = ${t.tentativas + 1}, resultado = ${JSON.stringify({ perguntas })}::jsonb
       WHERE id = ${t.id}`);
    await this.concluirSeCompleta(tx, t.tenant_id, t.importacao_id);
  }

  private async registrarFalha(tx: Executor, t: Tarefa, falha: ErroLeitura): Promise<void> {
    const tentativa = t.tentativas + 1;
    // O detalhe é texto fixo (classe do erro, status HTTP), nunca conteúdo lido (RN-028).
    this.n.log(`importacao importacao=${t.importacao_id} pagina=${t.pagina} resultado=${falha.tipo} tentativa=${tentativa} detalhe="${falha.message}"`);
    const imp = await linha<LinhaImportacao>(tx, sql`SELECT estado FROM importacao_formulario WHERE id = ${t.importacao_id} FOR UPDATE`);
    if (!imp || TERMINADA.includes(imp.estado)) return;
    if (tentativa <= ESPERAS_MS.length) {
      await tx.execute(sql`
        UPDATE tarefa_importacao SET tentativas = ${tentativa}, ultima_falha = ${falha.tipo},
               executar_em = ${somar(this.n.agora(), ESPERAS_MS[tentativa - 1])}
         WHERE id = ${t.id}`);
      return;
    }
    await this.encerrar(tx, t.tenant_id, t.importacao_id, 'IMPORTACAO_FALHOU', { pagina: t.pagina, tentativas: tentativa, falha: falha.tipo });
  }

  /** Teto atingido ou mês sem cotação: suspende as tarefas restantes, mantendo as páginas lidas (FL-004). */
  private async pausarPorCota(tx: Executor, importacaoId: string, motivo: 'teto' | 'sem_cotacao'): Promise<void> {
    await tx.execute(sql`UPDATE importacao_formulario SET estado = 'aguardando_cota', aviso = 'ERR-003' WHERE id = ${importacaoId}`);
    await tx.execute(sql`UPDATE tarefa_importacao SET situacao = 'suspensa' WHERE importacao_id = ${importacaoId} AND situacao = 'pendente'`);
    this.n.log(`importacao_aguardando_cota importacao=${importacaoId} motivo=${motivo}`);
  }

  /** Todas as páginas lidas: cria o formulário (ao menos uma pergunta lida) ou falha com ERR-044. */
  private async concluirSeCompleta(tx: Executor, tenantId: string, importacaoId: string): Promise<void> {
    const tarefas = await linhas<{ pagina: number; situacao: string; resultado: { perguntas: PerguntaLida[] } | null }>(
      tx,
      sql`SELECT pagina, situacao, resultado FROM tarefa_importacao WHERE importacao_id = ${importacaoId} ORDER BY pagina`,
    );
    if (tarefas.some((x) => x.situacao !== 'concluida')) return;
    const imp = (await linha<LinhaImportacao>(
      tx,
      sql`SELECT id, projeto_id, nome_formulario, estado, total_paginas, criada_por, papel_antigo FROM importacao_formulario WHERE id = ${importacaoId}`,
    ))!;
    const fonte = await fonteDeMedida();
    const lidas = tarefas.map((x) => x.resultado?.perguntas ?? []);
    // Papel antigo: a página do original, sem a medida da DEC-143 (DEC-181).
    const v = imp.papel_antigo
      ? montarVersaoAntiga(lidas)
      : montarVersao(lidas, {
          altura: (p: PerguntaEntrada) => bloco(fonte, normalizarConteudo([p], [])[0]).altura,
          topo: A - TOPO,
          limiteInferior,
        });
    if (v.lidas === 0) {
      await this.encerrar(tx, tenantId, importacaoId, 'IMPORTACAO_FALHOU', { paginas: imp.total_paginas, perguntas: 0 });
      return;
    }
    const perguntas = normalizarConteudo(reaplicarCampos(v.perguntas), []);
    const { formId, versaoId } = await criarFormularioRascunho(this.n, tx, { tenantId, projetoId: imp.projeto_id, nome: imp.nome_formulario });
    await gravarConteudo(this.n, tx, tenantId, versaoId, perguntas, []);
    // Papel antigo: a marca e o total com as páginas do original (DEC-181).
    if (imp.papel_antigo) await tx.execute(sql`UPDATE versao SET papel_antigo = true, total_paginas = ${imp.total_paginas} WHERE id = ${versaoId}`);
    await tx.execute(sql`
      UPDATE importacao_formulario SET estado = 'concluida', aviso = NULL, formulario_id = ${formId}, versao_id = ${versaoId},
             avisos = ${JSON.stringify(v.avisos)}::jsonb, concluida_em = ${this.n.agora()}, chave_storage = NULL
       WHERE id = ${importacaoId}`);
    await tx.execute(sql`DELETE FROM tarefa_importacao WHERE importacao_id = ${importacaoId}`);
    await this.n.auditar(tx, { tenantId, usuarioId: imp.criada_por, ip: null }, 'IMPORTACAO_FORMULARIO', 'ImportacaoFormulario', importacaoId, {
      formulario_id: formId,
      versao_id: versaoId,
      paginas: imp.total_paginas,
      perguntas: perguntas.length,
      avisos: v.avisos.length,
    });
    this.n.log(`importacao_concluida importacao=${importacaoId} perguntas=${perguntas.length} avisos=${v.avisos.length}`);
    await this.apagarArquivos(tenantId, importacaoId, imp.total_paginas);
  }

  /** Falha (ERR-044): cancela as tarefas restantes, apaga os arquivos e audita. */
  private async encerrar(tx: Executor, tenantId: string, importacaoId: string, acao: string, detalhes: Record<string, unknown>): Promise<void> {
    const imp = (await linha<LinhaImportacao>(tx, sql`SELECT total_paginas, criada_por FROM importacao_formulario WHERE id = ${importacaoId}`))!;
    await tx.execute(sql`
      UPDATE importacao_formulario SET estado = 'falhou', aviso = 'ERR-044', concluida_em = ${this.n.agora()}, chave_storage = NULL
       WHERE id = ${importacaoId}`);
    await tx.execute(sql`DELETE FROM tarefa_importacao WHERE importacao_id = ${importacaoId}`);
    await this.n.auditar(tx, { tenantId, usuarioId: imp.criada_por, ip: null }, acao, 'ImportacaoFormulario', importacaoId, detalhes);
    this.n.log(`importacao_falhou importacao=${importacaoId}`);
    await this.apagarArquivos(tenantId, importacaoId, imp.total_paginas);
  }

  private async apagarArquivos(tenantId: string, importacaoId: string, total: number): Promise<void> {
    await Promise.allSettled(Array.from({ length: total }, (_, i) => this.n.config.armazenamento.apagar(chavePaginaImportacao(tenantId, importacaoId, i + 1))));
  }
}
