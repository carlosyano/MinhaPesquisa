# Arquitetura do Projeto MinhaPesquisa

> Mapa do repositório para pessoas e agentes de IA. Resume o que está decidido em
> `docs/architecture/PLANO.md` (v3.15) e aponta a fonte de verdade de cada artefato.
> Em conflito, vale a precedência do PLANO: decisões de negócio → REQ → PLANO/DEC técnicas → Bloco P.

## 1. Situação atual

IMP-001 aceito em 29/10/2026 (Gate 2), com o E2E com navegador pendente; IMP-002 aceito em
03/11/2026; IMP-005 (aplicação local, CHG-011) aceito em 04/11/2026; IMP-003 e IMP-006 aceitos em 05/11/2026;
próximo: IMP-007 (exportação em formato longo, CHG-015), antes do IMP-004 (DEC-164). Existem `apps/api`
(com o worker da leitura em `apps/api/src/leitura`, onde também entra o extrator de estrutura da
DEC-141, e com a exportação em `apps/api/src/exportacao`, DEC-167), `packages/db`, `packages/motor-leitura` e `tests/`; `apps/web`, `apps/worker`,
`packages/contratos` e `infra/` ainda não foram criados.

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
PostgreSQL 17 + Drizzle (SQL explícito) · Outbox + fila em tabela própria (DEC-124) · aplicação local num notebook Windows (DEC-107, DEC-113) ·
Vitest, Testcontainers, Playwright + axe, Schemathesis, fast-check, Stryker.

## 4. Estrutura planejada

```text
minhapesquisa/
├── apps/
│   ├── api/                 # HTTP, autenticação, autorização, validação pelo contrato
│   ├── web/                 # Telas TL-001 a TL-015
│   └── worker/              # Leitura IA, registro de imagem, cota, expurgo, expirações
├── packages/
│   ├── db/                  # Schemas Drizzle, migrações SQL, policies RLS, papéis (DEC-046)
│   ├── motor-leitura/       # Motor isolado e domain-agnostic (DEC-007, PLANO §2.1)
│   └── contratos/           # Tipos gerados de contracts/openapi.yaml
├── infra/                   # Scripts locais: instalação, redefinição de senha e backup (IMP-005)
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
- `apps/worker` e `apps/api` compartilham `packages/db`; comunicação assíncrona só por outbox + fila em tabela (DEC-124); no notebook o worker de leitura roda no processo da API.

## 6. Fluxos críticos (detalhe no PLANO §4)

1. Upload → validação, antimalware, remoção de metadados → QR e registro da imagem → estado inicial (FL-001).
2. Worker → reserva de orçamento (DEC-051) → recortes → ReadEngine → estado dos itens (FL-002).
3. Revisão sem reserva, com If-Match (DEC-112) → conclusão com vínculo por CPF.
4. Eliminação LGPD → anonimização, expurgo e lista de eliminações reaplicada após restore.
5. Login com senha local → sessão plena, sem MFA (DEC-108).

## 7. Segurança e dados

- Isolamento: FK composta + RLS com FORCE + `SET LOCAL app.tenant_id`; papéis em DEC-046.
- CPF: AES-256-GCM + HMAC com chave por tenant; chave mestra pelo DPAPI do Windows (DEC-114).
- Disco cifrado (BitLocker) e backup diário cifrado fora do notebook (DEC-107, DEC-117).
- Imagens em pasta local privada, link assinado local de 5 min; auditoria só com referências; logs sem dado pessoal.
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

## 9. Modo de demonstração local (DEC-104, DEC-125)

Para testar o upload com foto real antes das telas: `npm ci` e `npm run demo` (precisa de Docker,
ou de `MP_DEMO_DATABASE_URL` apontando para um PostgreSQL 17). O terminal mostra a página
(`http://127.0.0.1:8080`), o e-mail, a senha e o QR do MFA para o app autenticador. Na página:
entrar, baixar o PDF, imprimir, preencher **só com dados sintéticos** (GX-001), fotografar em
JPEG ou PNG (no iPhone, câmera em "Mais Compatível"; HEIC é recusado, RF-006 aceita JPEG, PNG e PDF) e enviar.
`MP_DEFENDER=true` troca o equivalente EICAR pelo Microsoft Defender (só no Windows).

Para ver a leitura por IA e a revisão (DEC-125), defina `MP_DEMO_CHAVE_IA` com uma chave da API
da Anthropic antes de `npm run demo`. A chave fica só na memória e nunca é gravada; cada página
lida gera custo real na conta. A cotação do dólar é fictícia (`MP_DEMO_COTACAO`, padrão 5.00) e o
modelo é o padrão da instalação (`MP_DEMO_MODELO` para trocar). Sem a chave, o envio funciona e a
leitura fica parada. Tudo escuta só em 127.0.0.1 e
some com Ctrl+C. Não é ambiente de piloto: o armazenamento é em memória e o e-mail só aparece
no terminal.
