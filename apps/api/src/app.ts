// Montagem da API (NestJS + Fastify, DEC-037) a partir de uma Config.

import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { AuthController, NUCLEO } from './auth/auth.controller.js';
import type { Config } from './config.js';
import { ExportacaoController } from './exportacao/exportacao.controller.js';
import { FormulariosController } from './formularios/formularios.controller.js';
import { ImportacaoController } from './formularios/importacao.controller.js';
import { FiltroErros, type Req } from './http.js';
import { Nucleo } from './nucleo.js';
import { ProjetosController } from './projetos/projetos.controller.js';
import { LIMITE_BYTES } from './regras/upload.js';
import { RevisaoController } from './revisao/revisao.controller.js';
import { UploadController } from './upload/upload.controller.js';

export interface Api {
  app: NestFastifyApplication;
  nucleo: Nucleo;
  url: string;
  fechar(): Promise<void>;
}

export async function criarApi(config: Config, porta = 0, host = '127.0.0.1'): Promise<Api> {
  const nucleo = new Nucleo(config);

  @Module({
    controllers: [AuthController, ProjetosController, FormulariosController, ImportacaoController, UploadController, RevisaoController, ExportacaoController],
    providers: [{ provide: NUCLEO, useValue: nucleo }],
  })
  class ModuloApi {}

  const adaptador = new FastifyAdapter({
    trustProxy: config.confiarProxy,
    bodyLimit: 1_048_576,
    logger: false, // logs de requisição sem corpo nem dados pessoais entram com a observabilidade (PLANO §9.3)
  });
  const app = await NestFactory.create<NestFastifyApplication>(ModuloApi, adaptador, { logger: false });
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyCookie as never);
  // Upload (RF-006, DEC-029) e importação (RF-011, DEC-136): até 50 arquivos de 20 MB por envio e
  // no máximo 2 campos de texto (a confirmação da assinatura de attachSignaturePage, RN-044; o nome
  // do formulário e a declaração da importação). Cada operação recusa o campo que não é seu.
  await fastify.register(fastifyMultipart as never, {
    limits: { fileSize: LIMITE_BYTES, files: 50, fields: 2, parts: 52, fieldSize: 1024 },
    throwFileSizeLimit: true,
  });
  fastify.addHook('onRequest', async (req, reply) => {
    const id = randomUUID();
    (req as unknown as Req).correlationId = id;
    reply.header('X-Correlation-ID', id);
  });
  const filtro = new FiltroErros(nucleo);
  app.useGlobalFilters(filtro);
  await app.listen(porta, host);
  const endereco = fastify.server.address();
  const url = typeof endereco === 'object' && endereco ? `http://${host}:${endereco.port}` : '';
  return {
    app,
    nucleo,
    url,
    async fechar() {
      await app.close();
      await nucleo.fechar();
    },
  };
}
