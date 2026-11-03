# Arquitetura do Projeto MinhaPesquisa

> Mapa do repositório para pessoas e agentes de IA. Resume o que está decidido em
> `docs/architecture/PLANO.md` (v2.14) e aponta a fonte de verdade de cada artefato.
> Em conflito, vale a precedência do PLANO: decisões de negócio → REQ → PLANO/DEC técnicas → Bloco P.

## 1. Situação atual

IMP-001 aceito em 29/10/2026 (Gate 2), com o E2E com navegador pendente; IMP-002 na etapa
IA-TEST. Existem `apps/api`, `packages/db` e `tests/`; `apps/web`, `apps/worker`,
`packages/motor-leitura`, `packages/contratos` e `infra/` ainda não foram criados.

## 2. Fontes de verdade (DEC-049)

| Artefato | Fonte de verdade | Derivados (nunca editar à mão) |
|---|---|---|
| Regras de negócio, CAs, dicionário, ERR, matriz | `docs/spec/REQ.md` | `registros/*.csv` (via `tools/gerar_registros.py`) |
| Decisões técnicas, incrementos, ameaças | `docs/architecture/PLANO.md` | `registros/registro_decisoes.csv`, `registros/plano_incrementos.csv` |
| Contrato HTTP | `contracts/openapi.yaml` | `packages/contratos` (só tipos gerados, IMP-001) |
| Perfil de plataforma | `docs/spec/BLOCO_P.md` | — |
| Registro de mudanças normativas | `registros/controle_mudancas.csv` | — |

`tools/validar_consistencia.py` cruza todos esses artefatos e roda no CI
(`.github/workflows/ci.yml`). Documentos antigos ficam em `docs/historico/` e não são normativos.

## 3. Stack (DEC-037, Bloco P P.1)

Node.js 24 · TypeScript strict · NestJS + Fastify · Next.js + React + Tailwind + shadcn/ui ·
PostgreSQL 17 + Drizzle (SQL explícito) · pg-boss + Outbox · AWS sa-east-1 (DEC-038) ·
Terraform · Vitest, Testcontainers, Playwright + axe, Schemathesis, fast-check, Stryker.

## 4. Estrutura planejada

```text
minhapesquisa/
├── apps/
│   ├── api/                 # HTTP, autenticação, autorização, validação pelo contrato
│   ├── web/                 # Telas TL-001 a TL-014
│   └── worker/              # Leitura IA, registro de imagem, cota, expurgo, expirações
├── packages/
│   ├── db/                  # Schemas Drizzle, migrações SQL, policies RLS, papéis (DEC-046)
│   ├── motor-leitura/       # Motor isolado e domain-agnostic (DEC-007, PLANO §2.1)
│   └── contratos/           # Tipos gerados de contracts/openapi.yaml
├── infra/                   # Terraform: rede, KMS, S3, banco, filas
├── contracts/openapi.yaml   # Contrato (fonte de verdade)
├── docs/spec/               # REQ e Bloco P
├── docs/architecture/       # PLANO
├── registros/               # CSVs gerados + controle de mudanças
├── tools/                   # Gerador e validador de consistência
└── tests/                   # unit, integracao, e2e, contrato, mutacao
```

## 5. Regras de dependência

```text
apps/web ──HTTP──> apps/api ──> packages/db
                       │            ▲
                       └──outbox──> apps/worker ──> packages/motor-leitura
packages/contratos <── apps/api, apps/web (tipos)
```

- `packages/motor-leitura` não importa `apps/*` nem `packages/db`, não acessa banco, rede,
  storage nem `process.env` (ESLint `no-restricted-imports` + teste de boundary).
- `apps/web` só fala com `apps/api` por HTTP; nunca acessa banco.
- `apps/worker` e `apps/api` compartilham `packages/db`; comunicação assíncrona só por outbox + pg-boss.

## 6. Fluxos críticos (detalhe no PLANO §4)

1. Upload → validação, antimalware, remoção de metadados → QR e registro da imagem → estado inicial (FL-001).
2. Worker → reserva de orçamento (DEC-051) → recortes → ReadEngine → estado dos itens (FL-002).
3. Revisão com reserva de 30 min e If-Match → conclusão com vínculo por CPF.
4. Eliminação LGPD → anonimização, expurgo e lista de eliminações reaplicada após restore.
5. Login → pré-sessão → MFA → sessão plena (DEC-050).

## 7. Segurança e dados

- Isolamento: FK composta + RLS com FORCE + `SET LOCAL app.tenant_id`; papéis em DEC-046.
- CPF: AES-256-GCM com envelope no KMS + HMAC com chave por tenant (DEC-041).
- Imagens privadas, link assinado de 5 min; auditoria só com referências; logs sem dado pessoal.
- Nenhum dado real em desenvolvimento enquanto GX-001 estiver pendente.

## 8. Referência rápida

```text
Preciso alterar...                     Procurar primeiro em...
────────────────────────────────────────────────────────────────
Regra de negócio / CA / ERR            docs/spec/REQ.md (via CHG)
Decisão técnica / incremento           docs/architecture/PLANO.md
Endpoint / schema                      contracts/openapi.yaml
Registros CSV                          não editar; rodar tools/gerar_registros.py
Regras para agentes de IA              AGENTS.md
```
