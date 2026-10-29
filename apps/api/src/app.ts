// Montagem da API (NestJS + Fastify, DEC-037) a partir de uma Config.

import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { AdminController } from './admin/admin.controller.js';
import { AuthController, NUCLEO } from './auth/auth.controller.js';
import type { Config } from './config.js';
import { FiltroErros, type Req } from './http.js';
import { Nucleo } from './nucleo.js';

export interface Api {
  app: NestFastifyApplication;
  nucleo: Nucleo;
  url: string;
  fechar(): Promise<void>;
}

export async function criarApi(config: Config, porta = 0, host = '127.0.0.1'): Promise<Api> {
  const nucleo = new Nucleo(config);

  @Module({ controllers: [AuthController, AdminController], providers: [{ provide: NUCLEO, useValue: nucleo }] })
  class ModuloApi {}

  const adaptador = new FastifyAdapter({
    trustProxy: config.confiarProxy,
    bodyLimit: 1_048_576,
    logger: false, // logs de requisição sem corpo nem dados pessoais entram com a observabilidade (PLANO §9.3)
  });
  const app = await NestFactory.create<NestFastifyApplication>(ModuloApi, adaptador, { logger: false });
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyCookie as never);
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
