// RF-011: importação de formulário (CA-045, CA-047; RN-049, FL-004; DEC-133, DEC-136, DEC-142,
// DEC-146). O envio é validado inteiro em memória antes de gravar qualquer coisa, como no upload:
// um arquivo recusado recusa o envio e nada é gravado. A leitura da estrutura é do worker
// (leitura/importacao.ts).

import type { Multipart } from '@fastify/multipart';
import { Controller, Get, Headers, HttpCode, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { NUCLEO } from '../auth/auth.controller.js';
import { projetoNoEscopo } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao } from '../http.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { contarPaginasPdf, normalizarImagem, renderizarPdf } from '../infra/imagens.js';
import { chavePaginaImportacao, pastaImportacao } from '../leitura/importacao.js';
import { ehUuid, Nucleo } from '../nucleo.js';
import { paginacao } from '../regras/autorizacao.js';
import { LIMITE_BYTES, LIMITE_PAGINAS, MOTIVO, tipoPorConteudo } from '../regras/upload.js';

interface LinhaImportacao {
  id: string;
  projeto_id: string;
  nome_formulario: string;
  estado: string;
  aviso: string | null;
  total_paginas: number;
  formulario_id: string | null;
  versao_id: string | null;
  avisos: unknown[] | null;
  criada_em: Date;
  concluida_em: Date | null;
}

const COLUNAS = sql.raw(
  'id, projeto_id, nome_formulario, estado, aviso, total_paginas, formulario_id, versao_id, avisos, criada_em, concluida_em',
);

const recusa = (motivo: string) => new ErroApi('ERR-029', { motivo, substituir: motivo });

type ReqMultipart = Requisicao & { isMultipart(): boolean; parts(): AsyncIterableIterator<Multipart> };

@Controller()
export class ImportacaoController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private corpo(i: LinhaImportacao) {
    return {
      id: i.id,
      projeto_id: i.projeto_id,
      nome_formulario: i.nome_formulario,
      estado: i.estado,
      total_paginas: i.total_paginas,
      formulario_id: i.formulario_id,
      versao_id: i.versao_id,
      avisos: i.avisos ?? [],
      aviso: i.aviso,
      criada_em: new Date(i.criada_em).toISOString(),
      concluida_em: i.concluida_em ? new Date(i.concluida_em).toISOString() : null,
    };
  }

  private async importacao(tx: Executor, id: string): Promise<LinhaImportacao> {
    if (!ehUuid(id)) throw naoEncontrado('ImportacaoFormulario', null);
    const i = await linha<LinhaImportacao>(tx, sql`SELECT ${COLUNAS} FROM importacao_formulario WHERE id = ${id}`);
    if (!i) throw naoEncontrado('ImportacaoFormulario', id);
    return i;
  }

  /**
   * Recebe o multipart inteiro (o tamanho é conferido durante o recebimento); depois confere o
   * nome e a declaração `sem_dados_reais` (DEC-133); por fim cada arquivo, na ordem da DEC-042,
   * como no upload: antimalware, tipo pelo conteúdo, páginas (50 no envio, DEC-136); as páginas
   * saem recodificadas, sem metadados (RN-040).
   */
  private async receber(req: Requisicao): Promise<{ nome: string; paginas: Buffer[] }> {
    const r = req as ReqMultipart;
    if (typeof r.isMultipart !== 'function' || !r.isMultipart()) throw new ErroApi('ERR-001', { campos: ['arquivos'] });
    const arquivos: Buffer[] = [];
    const textos: Record<string, string> = {};
    try {
      for await (const parte of r.parts()) {
        if (parte.type === 'field') {
          if (!['nome_formulario', 'sem_dados_reais'].includes(parte.fieldname) || typeof parte.value !== 'string') throw new ErroApi('ERR-001', { campos: [parte.fieldname] });
          textos[parte.fieldname] = parte.value;
          continue;
        }
        if (parte.fieldname !== 'arquivos') throw new ErroApi('ERR-001', { campos: [parte.fieldname] });
        const bytes = await parte.toBuffer();
        if (bytes.length > LIMITE_BYTES || parte.file.truncated) throw recusa(MOTIVO.tamanho);
        arquivos.push(bytes);
      }
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      if (codigo === 'FST_REQ_FILE_TOO_LARGE') throw recusa(MOTIVO.tamanho);
      if (codigo === 'FST_FILES_LIMIT' || codigo === 'FST_FIELDS_LIMIT' || codigo === 'FST_PARTS_LIMIT') throw new ErroApi('ERR-001', { campos: ['arquivos'] });
      throw e;
    }
    const nome = textos.nome_formulario?.trim();
    if (!nome || nome.length > 200) throw new ErroApi('ERR-001', { campos: ['nome_formulario'] });
    if (textos.sem_dados_reais !== 'true') throw new ErroApi('ERR-001', { campos: ['sem_dados_reais'] });
    if (!arquivos.length) throw new ErroApi('ERR-001', { campos: ['arquivos'] });

    const imagens: Buffer[] = [];
    let total = 0;
    for (const bytes of arquivos) {
      if (!(await this.n.config.antimalware.limpo(bytes))) throw recusa(MOTIVO.malware);
      const tipo = tipoPorConteudo(bytes);
      if (!tipo) throw recusa(MOTIVO.tipo);
      let paginas: Buffer[];
      if (tipo === 'pdf') {
        const n = await contarPaginasPdf(bytes);
        if (n === null) throw recusa(MOTIVO.tipo);
        if (n > LIMITE_PAGINAS || total + n > LIMITE_PAGINAS) throw recusa(MOTIVO.paginas);
        total += n;
        paginas = await renderizarPdf(bytes);
      } else {
        if (total + 1 > LIMITE_PAGINAS) throw recusa(MOTIVO.paginas);
        total += 1;
        paginas = [bytes];
      }
      for (const p of paginas) {
        try {
          imagens.push(await normalizarImagem(p));
        } catch {
          throw recusa(MOTIVO.tipo); // imagem corrompida ou grande demais para decodificar
        }
      }
    }
    return { nome, paginas: imagens };
  }

  @Get('projects/:projectId/form-imports')
  async listFormImports(@Param('projectId') projetoId: string, @Query() q: Record<string, string | undefined>, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    const { pagina, limite } = paginacao(q);
    return this.n.comAtor(s, async (tx) => {
      await projetoNoEscopo(tx, projetoId);
      const total = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM importacao_formulario WHERE projeto_id = ${projetoId}`))!.n;
      const is = await linhas<LinhaImportacao>(
        tx,
        sql`SELECT ${COLUNAS} FROM importacao_formulario WHERE projeto_id = ${projetoId}
             ORDER BY criada_em DESC, id DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      );
      return { itens: is.map((i) => this.corpo(i)), meta: { pagina, limite, total } };
    });
  }

  @Post('projects/:projectId/form-imports')
  @HttpCode(202)
  async importForm(@Param('projectId') projetoId: string, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    if (!chave || chave.length < 16 || chave.length > 64) throw new ErroApi('ERR-001', { campos: ['Idempotency-Key'] });
    // Escopo e projeto ativo antes de receber os arquivos (DEC-146).
    await this.n.comAtor(s, async (tx) => {
      const p = await projetoNoEscopo(tx, projetoId);
      if (p.status !== 'ativo') throw new ErroApi('ERR-001', { campos: ['projeto'] });
    });
    const { nome, paginas } = await this.receber(req);

    const gravadas: string[] = [];
    try {
      return await this.n.comAtor(s, async (tx) => {
        const p = await projetoNoEscopo(tx, projetoId, true);
        if (p.status !== 'ativo') throw new ErroApi('ERR-001', { campos: ['projeto'] });
        const impressao = { projetoId, nome, paginas: paginas.map((x) => createHash('sha256').update(x).digest('hex')) };
        const feito = await this.n.idempotente(tx, s, 'importForm', chave, impressao, async () => {
          const id = this.n.id();
          const agora = this.n.agora();
          await tx.execute(sql`
            INSERT INTO importacao_formulario (id, tenant_id, projeto_id, nome_formulario, estado, total_paginas, chave_storage, criada_em, criada_por)
            VALUES (${id}, ${s.tenantId}, ${projetoId}, ${nome}, 'enfileirada', ${paginas.length}, ${pastaImportacao(s.tenantId, id)}, ${agora}, ${s.usuarioId})`);
          for (const [i, jpeg] of paginas.entries()) {
            const k = chavePaginaImportacao(s.tenantId, id, i + 1);
            await this.n.config.armazenamento.gravar(k, jpeg, 'image/jpeg');
            gravadas.push(k);
            await tx.execute(sql`
              INSERT INTO tarefa_importacao (id, tenant_id, importacao_id, pagina, executar_em, criada_em)
              VALUES (${this.n.id()}, ${s.tenantId}, ${id}, ${i + 1}, ${agora}, ${agora})`);
          }
          // Só referências e contagens: o nome do formulário não entra na auditoria (RN-028).
          await this.n.auditar(tx, s, 'SOLICITAR_IMPORTACAO', 'ImportacaoFormulario', id, { paginas: paginas.length });
          return { status: 202, recursoId: id };
        });
        return this.corpo(await this.importacao(tx, feito.recursoId));
      });
    } catch (e) {
      await Promise.allSettled(gravadas.map((k) => this.n.config.armazenamento.apagar(k)));
      throw e;
    }
  }

  @Get('form-imports/:importId')
  async getFormImport(@Param('importId') id: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.comAtor(s, async (tx) => this.corpo(await this.importacao(tx, id)));
  }
}
