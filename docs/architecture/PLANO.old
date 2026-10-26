# PLANO.md — MinhaPesquisa

**Plano técnico e de incrementos · Fase 3 (cty-arq)**
**Fontes normativas:** REQ v1.2 (APROVADA, Gate 1 em 24/10/2026, CHG-001 aplicada) · docs/spec/BLOCO_P.md · Kit v3
**Nível de rigor:** Completo
**Responsável:** Carlos Yano
**Versão do plano:** 2.3
**Status:** EM REVISÃO — REV-PLANO-005 pendente
**Precedência:** decisões de negócio aprovadas → REQ aprovada → decisões técnicas e este plano → Bloco P → recomendações da IA.
**Este plano não altera regra de negócio.**

---

## 1. Objetivo e limites

SaaS multi-tenant que digitaliza pesquisas em papel do público 60+, lê campos por IA,
exige revisão humana quando necessário e produz dashboards anonimizados, com LGPD
desde o banco de dados.

**Dentro:** projetos, formulários/versões, PDF com QR, upload, leitura IA, revisão,
respondente por CPF, dashboards, exportação, direitos do titular, auditoria.

**Fora (v2):** editor visual de layout, biblioteca de perguntas, importação de
Forms/XLSForm, SPSS/R, permissão por linha, gestão de tenants por tela, cobrança.

**Restrições inegociáveis:** dados em região no Brasil (RNF-011); isolamento por
tenant desde a v1 (RN-001); nenhum dado real em desenvolvimento enquanto GX-001
estiver pendente (Q-001).

---

## 2. Stack e estrutura do monorepo (DEC-037)

Node.js 24 · TypeScript strict · NestJS + Fastify · Next.js + React + Tailwind +
shadcn/ui · PostgreSQL 17 + Drizzle + migrações SQL explícitas · pg-boss + Outbox ·
npm workspaces. Testes: Vitest, Testcontainers, Playwright + axe, Schemathesis,
fast-check, Stryker (mutação ≥ 80%). CI GitHub Actions: CodeQL, gitleaks, SBOM.



### 2.1 Regras de isolamento do motor (reutilização pelo MeuRemedio)

`packages/motor-leitura` é domain-agnostic e extraível sem refatoração (RN-045, RN-046):

- Não importa código de `apps/*` nem de `packages/db`.
- Não acessa banco, storage, rede ou `process.env` do produto.
- Recebe configuração por parâmetro; dependências por injeção.
- Assinatura: `lerRecorte(imagem: Buffer, schema: CampoSchema): Promise<LeituraCampo[]>`
  — devolve valor, confiança e bounding box (RN-045). O motor não decide revisão.
- Tem testes próprios, executáveis standalone no CI.
- Conjunto-ouro e limites de confiança pertencem ao domínio, não ao motor (RN-046).
- Gatilho de extração: só quando o MeuRemedio for consumir, com DEC própria naquela
  especificação (regra 44 da spec original). Até lá, permanece no monorepo (DEC-007).
- Verificação: regra de ESLint `no-restricted-imports` + teste de boundary no CI.

---

## 3. Componentes (CMP) e responsabilidades

| CMP | Responsabilidade | RF | Principais operationIds |
| --- | --- | --- | --- |
| CMP-Auth | sessão, MFA, reset de MFA, convites, concessões | RF-001, RF-002 | login, logout, resetPassword, setupMfa, resetMfa, createTenantUser, inviteUser, updateUser, revokeAccess |
| CMP-Projects | projetos, parâmetros, ciclo de vida | RF-003 | createProject, archiveProject, unarchiveProject |
| CMP-Forms | versões imutáveis, perguntas, regras de salto, PDF | RF-004 | createForm, createVersion, publishVersion, generatePdf |
| CMP-Upload | validação, antimalware, metadados, QR, storage | RF-006 | uploadImages |
| CMP-MotorIA | recorte, chamada ao provedor, confiança, cota | RF-007 | processAIReading (worker) |
| CMP-Respondents | unicidade por CPF, vínculo, criação, reversão | RF-005 | linkRespondent (interno) |
| CMP-Revisao | fila, reserva, revisão, conclusão, descarte, reabertura | RF-008 | openReview, saveReview, confirmApplication, discardApplication, reopenApplication |
| CMP-Dashboard | agregação, grupos dinâmicos, k-anonimato | RF-009 | getDashboardAggregated, createGroup, getIndividualRecord |
| CMP-LGPD | pedidos do titular, expurgo, portabilidade | RF-010 | exportData, executeDataSubjectRequest |
| CMP-Infra | banco, storage, KMS, filas, observabilidade, CI | todos | — |

---

## 4. Fluxos críticos

### 4.1 Upload → leitura → revisão → conclusão

- API valida tipo/tamanho (JPEG/PNG/PDF, ≤ 20 MB, ≤ 50 páginas — DEC-029).
- Antimalware (ClamAV sidecar) e remoção de metadados EXIF/GPS (sharp) antes do storage (DEC-042).
- QR validado contra tenant + projeto + versão + página; falha → `identificacao_pendente` (ERR-004/ERR-039).
- Imagem gravada em bucket privado; acesso apenas por link assinado de 5 min (DEC-034).
- Outbox registra `leitura.solicitada` na mesma transação.
- Worker lê páginas em paralelo, em recortes; identificação e saúde em chamadas separadas, sem identificador do respondente (DEC-022, RN-038, RN-039).
- Saída validada contra schema. Regra de autoconfirmação:
  - **Confiança > limite** (estritamente maior; 0,90 exato NÃO confirma — vai para `a_revisar`) **e** valor dentro do schema → `confirmado_automaticamente`.
  - **Confiança ≤ limite** ou valor fora do schema → `a_revisar`.
  - **Exceções sempre revisáveis** (independentes da confiança): CPF (RN-012); campo com valor fora da faixa/tipo mesmo com confiança alta (CA-006).
  - Teste de fronteira obrigatório: confiança exatamente igual ao limite (0,90) → `a_revisar` (CA-005, CA-006, TS-003).
- Regra de salto dependente de campo não resolvido → `aguardando_condicao` (CA-018).
- Revisão humana com reserva de 30 min e ETag/If-Match (RN-043, DEC-034).
- Conclusão exige CPF válido, data, local e assinatura conferida (RN-044); vínculo por CPF é feito aqui — CPF existente vincula, CPF novo cria respondente (CA-014b).
- Falta de campo obrigatório na conclusão → ERR-006 (REQ v1.2, CHG-001 aplicada).

### 4.2 Falha e cota

Timeout e retentativas conforme tabela abaixo. Após 3 falhas consecutivas em chamada idempotente → `erro_leitura` (ERR-041). Cota mensal atingida → `aguardando_cota` (ERR-003) + aviso ao administrador; nada é descartado (DEC-035).

#### 4.2.1 Tabela de timeouts por operação

| Operação | Timeout | Retentativa | Estado final de falha | Referência |
| --- | --- | --- | --- | --- |
| Chamada ao provedor de IA (leitura de recorte) | 30 s | 1, 2, 4 s (só idempotente) | `erro_leitura` após 3 falhas | RF-007, CA-041, P.7 |
| Envio de e-mail transacional (convite, recuperação, aviso de cota) | 30 s | 1, 2, 4 s | auditoria registra falha; usuário notificado na tela | RF-001, RF-002, CA-030 |
| Upload/download no storage de objetos | 30 s | 1, 2, 4 s | ERR-001 ou ERR-029 | RF-006, CA-029 |
| Job de exportação (CSV/XLSX) e PedidoTitular | 60 s | sem retentativa (job enfileirado) | PedidoTitular em `em_andamento` com auditoria de falha | RF-010, CA-022, CA-024 |
| Geração de PDF imprimível | 30 s | 1, 2, 4 s | ERR-001; versão permanece em `rascunho` | RF-004, CA-028 |

### 4.3 Eliminação (RF-010)

Bloqueio imediato do acesso → anonimização do respondente e sobrescrita dos valores
de resposta → apagamento de exportações pendentes → descarte de aplicações em
andamento → registro em `lista_eliminacoes` (180 dias) → expurgo físico em até
30 dias. Auditoria guarda só referências. Restauração de backup reaplica a
eliminação via lista (DEC-033, P.13).

**Vínculo com continuidade (§9.2):** a reaplicação da eliminação após restore é obrigatória no runbook, cobrindo a janela de RPO de 24 h e a retenção de backup de 90 dias (DEC-033). O teste de restauração (TS-008 + restore) é executado a cada incremento e mede o RTO alvo de 4 h.

### 4.4 Reabertura com reversão de cadastro (CA-042, REQ v1.2)

Reabertura de aplicação concluída volta a `em_revisao`; se o CPF for corrigido, o
vínculo é refeito e as alterações de cadastro feitas por essa aplicação são
revertidas, com registro em auditoria. Implementação: job transacional único que
(i) muda estado da aplicação, (ii) desfaz atributos de Respondente alimentados pela
aplicação retornando ao valor anterior ou a NULL se não havia valor prévio,
(iii) preserva auditoria da reversão.

### 4.5 Reset de MFA pelo administrador (CA-037b, REQ v1.2)

Admin reseta MFA do usuário → todas as sessões ativas são encerradas (invalidação em
banco e em cache) → usuário cadastra novo MFA no próximo login (fluxo equivalente ao
primeiro acesso, CA-035) → reset registrado em auditoria com acao=RESET_MFA,
entidade=Usuario, registro_id=<usuario_id>.

---

## 5. Modelo de dados físico

### 5.1 Convenções

- Tabelas correspondem a ENT-001 a ENT-021, em `snake_case`.
- Toda tabela com dado de tenant carrega `tenant_id`; filhas usam FK composta `(id, tenant_id)`.
- Constraints nomeadas: `pk_`, `fk_`, `uq_`, `ck_` + contexto.
- Instantes `timestamptz` UTC; datas civis (`data_nascimento`, `data_aplicacao`) como `date`.
- Dinheiro `numeric(10,2)`; UTF-8; paginação 20, máximo 100.

### 5.2 Isolamento (DEC-040)

- Autenticação extrai `tenant_id` da sessão.
- `SET LOCAL app.tenant_id = '<uuid>'` dentro da transação da requisição.
- Policy em toda tabela com tenant:
  `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
- `FORCE ROW LEVEL SECURITY`, inclusive para o dono da tabela.
- Fora de escopo → 404, sem revelar existência; tentativa auditada.
- Teste gerado do contrato cobre 100% das operações privadas (RN-023, TS-001).

### 5.3 Constraints de unicidade

| Tabela | Constraint |
| --- | --- |
| vinculo_usuario_projeto | (tenant_id, usuario_id, projeto_id) |
| concessao_acesso_individual | (tenant_id, usuario_id, projeto_id) WHERE ativo |
| regra_salto | (versao_id, pergunta_destino_id) |
| reserva_aplicacao | (aplicacao_id) WHERE ativa |
| lista_eliminacoes | (tenant_id, respondente_id_original) |
| parametro_configuracao | (tenant_id, projeto_id, chave) |
| respondente | (tenant_id, cpf_hash) |

### 5.4 Índices essenciais

- `aplicacao (tenant_id, projeto_id, estado)` — fila de revisão
- `item_resposta (tenant_id, aplicacao_id)` e `(tenant_id, pergunta_id)` — leitura/agregação
- `respondente (tenant_id, cpf_hash)` único — vínculo
- `auditoria (tenant_id, criado_em)` — consulta/retenção

### 5.5 CPF e chaves (DEC-041)

AES-256-GCM com envelope no KMS + HMAC-SHA256 dedicado para busca. Chave-mestre no
KMS; rotação anual com re-hash gradual via job. Segredos no gerenciador da nuvem,
nunca no repositório (gitleaks no CI).

### 5.6 Migrações, concorrência e retenção

Drizzle com SQL explícito versionado; migração idempotente, `down` testado.
Toda migração executa em CI contra PostgreSQL 17 real (Testcontainers).
Idempotency-Key em upload e mutações críticas; dedupe por `(aplicacao_id, pagina)`.
Reserva de aplicação com expiração; ETag/If-Match em `saveReview`.
Retenção por tenant; backups ≤ 90 dias (DEC-033); expurgo ≤ 30 dias; lista de
eliminações por 180 dias reaplicada após restauração de backup.

---

## 6. Contrato da API (contract-first)

`contracts/openapi.yaml` é fonte de validação de requisição e resposta.
Erros em Problem Details (RFC 9457), catálogo ERR fechado, `X-Correlation-ID`.
Rate limit: 100 req/min/usuário; 20 req/min/IP em rotas públicas (ERR-010).
Sessão em banco, cookie httpOnly + SameSite, CSRF double-submit; MFA obrigatório.
Rotas e operationIds conforme §3; operações internas do worker não são endpoints.
Conclusão de aplicação sem campos obrigatórios → ERR-006 (REQ v1.2, CHG-001 aplicada).
Nenhuma divergência normativa em aberto.

---

## 7. Assíncronos e integrações

Outbox transacional + pg-boss; nenhuma mutação crítica depende de chamada síncrona externa.
`ReadEngine` atrás de interface (DEC-043); adaptador mock enquanto GX-001 pendente.
Provedor real escolhido no conjunto-ouro (Fase 6); troca sem retrabalho no produto.
E-mail: convites 24 h uso único; recuperação 60 min uso único; avisos de cota.
Medidor de custo de IA por página/tenant; alerta e fila ao atingir o teto.

---

## 8. Análise de ameaças (nível Completo)

| ID | Ameaça | Controle | Verificação |
| --- | --- | --- | --- |
| T-01 | Acesso entre tenants | FK composta + RLS + 404 | TS-001 + contrato |
| T-02 | Injeção de instrução pela imagem | Validar saída contra schema; IA sem ações | TST IMP-003 |
| T-03 | Erro silencioso da IA | Conjunto-ouro; meta ≤ 0,5% (DEC-004) | Medição por mudança de modelo |
| T-04 | Dado sensível em log | Allowlist de campos; mascaramento | Teste que varre logs |
| T-05 | GPS/EXIF nas fotos | Remoção no ingresso | TST IMP-002 |
| T-06 | Transferência internacional sem base | GX-001; sintéticos até aprovação | Evidência contratual |
| T-07 | Sequestro de sessão / CSRF | MFA, cookie, double-submit, bloqueio | TS + TST auth |
| T-08 | Elevação para ficha individual | Concessão com justificativa, 90 dias, expiração | Teste por perfil |
| T-09 | Reidentificação por filtro | k-anon por célula, também na exportação | TS-004 + fast-check |
| T-10 | Replay / clique duplo | Idempotência + dedupe | TST concorrência |
| T-11 | Cadeia de suprimentos | SBOM, gitleaks, CodeQL, deps | CI bloqueante |
| T-12 | Backup ressuscita eliminados | Lista de eliminações + reaplicação | TS-008 + restore |
| T-13 | Esgotamento de cota | Teto + fila sem descarte | TS-007 |
| T-14 | QR forjado / de outro tenant | Validação tenant+projeto+versão | TST IMP-002 |

---

## 9. Operação

### 9.1 Nuvem (ADR-001, resolve DEC-036)

Alternativas: AWS sa-east-1 vs Azure Brazil South.
Proposta: AWS sa-east-1 — paridade com a stack já validada no MeuRemedio
(Bloco P [MR]), S3 presigned URL, KMS e Terraform maduros; região no Brasil atende
RNF-011. Custo sob controle do teto de IA. Detalhamento em ADR-001; registro DEC-038.

### 9.2 Continuidade (DEC-039)

- **RPO:** 24 h
- **RTO:** 4 h
- **Retenção de backup:** máxima de 90 dias (DEC-033)
- **Restauração testada:** a cada incremento, com runbook que inclui a reaplicação obrigatória de eliminações via `lista_eliminacoes`
- **Métricas e alertas:** idade do último backup bem-sucedido, duração do restore, taxa de sucesso da reaplicação de eliminações
- **Referências normativas:** P.13 (Bloco P), DEC-033, TS-008

### 9.3 Observabilidade

Logs estruturados com correlação; métricas de custo IA/página, p95 de leitura,
profundidade da fila e violações de isolamento; alertas de cota, falha de leitura,
isolamento e falha do job de expurgo.

### 9.4 CI/CD e rollback

typecheck → lint → unit → contrato (Spectral + oasdiff) → integração (Testcontainers)
→ E2E + axe → mutação ≥ 80% → CodeQL → gitleaks → SBOM → validador da matriz.
Migrações antes do código; rollback = migração `down` testada + imagem anterior.

---

## 10. Estratégia de testes por risco

| Risco | Camada | Ferramenta | Trace |
| --- | --- | --- | --- |
| Isolamento | contrato + integração | Testcontainers + Schemathesis | TS-001, RNF-001 |
| Upload seguro | integração | fixtures sintéticas | TS-002, CA-029 |
| Confiança/faixa + fronteira 0,90 | unidade + propriedade | Vitest + fast-check | TS-003, CA-005/CA-006 |
| k-anonimato | unidade + propriedade | fast-check | TS-004, RNF-004 |
| Eliminação + reaplicação em restore | integração + E2E | Testcontainers + Playwright | TS-005/TS-008 |
| Imutabilidade | integração | Testcontainers | TS-006, CA-001 |
| Cota IA | integração | mock do medidor | TS-007, CA-030 |
| Erro silencioso | conjunto-ouro | gabarito humano | DEC-004 |
| Acessibilidade | E2E | Playwright + axe | RNF-012 |
| Concorrência/reserva | integração | requisições paralelas | CA-043 |
| Autenticação/MFA/reset MFA | E2E + integração | Playwright + Testcontainers | CA-026, CA-037, CA-037b |
| Vínculo de respondente (novo/existente) | integração | Testcontainers | CA-002, CA-014, CA-014b |
| Reabertura com reversão | integração | Testcontainers | CA-042 |
| Dashboard com gráfico cruzado e k-anon | integração + propriedade | Testcontainers + fast-check | CA-017, CA-034 |
| Assinatura ausente fora de relatórios/exportações | integração + E2E | Testcontainers + Playwright | CA-021 |

Test-First: commit do teste vermelho antes do código verde. Todo teste com `@trace`
para RF/RN/CA/TS. Matriz atualizada a cada merge.

---

## 11. Incrementos
| IMP | Escopo | CAs cobertos | Entrada | Saída / evidência esperada |
| --- | --- | --- | --- | --- |
| IMP-001 | Repo, CI, banco com RLS, auth + MFA, esqueleto do contrato | CA-012, CA-016, CA-025, CA-026, CA-035, CA-037, CA-037b, CA-038 | Gate 1 aprovado; REQ e Bloco P no repo | CI verde; TS-001 passando; migração aplicada em PG17; E2E de login com MFA e reset de MFA |
| IMP-002 | Projetos, formulários/versões, PDF/QR, pipeline de upload, regras de salto | CA-001, CA-003, CA-004, CA-013, CA-015, CA-017, CA-018, CA-019, CA-020, CA-027, CA-028, CA-029, CA-036, CA-039, CA-040 | IMP-001 aceito | TS-002 e TS-006; PDF imprimível; metadados removidos; regra de salto avaliada |
| IMP-003 | Motor IA isolado, leitura, cota, revisão, vínculo por CPF, reabertura | CA-002, CA-005, CA-006, CA-007, CA-008, CA-014, CA-014b, CA-018, CA-019, CA-021, CA-030, CA-032, CA-033, CA-041, CA-042, CA-043, CA-044 | IMP-002 aceito | TS-003 e TS-007; FL-001/FL-002 cobertas; vínculo novo/existente; reversão na reabertura; fronteira 0,90 em `a_revisar` |
| IMP-004 | Dashboards, grupos, exportação, direitos do titular | CA-009, CA-010, CA-011, CA-017, CA-021, CA-022, CA-023, CA-024, CA-031, CA-034 | IMP-003 aceito | TS-004/TS-005/TS-008; k-anon por célula; expurgo reaplicável após restore; gráfico cruzado; exclusão de aplicação sem assinatura de relatórios/exportações; grupo mínimo entre projetos |

### 11.1 Cobertura dos 46 CAs da REQ v1.2

A soma dos CAs listados nos IMP-001 a IMP-004 cobre integralmente os 46 critérios
de aceite da REQ v1.2 (CA-001 a CA-044, incluindo CA-014b e CA-037b).

**CA-017** e **CA-021** aparecem em mais de um incremento porque a REQ v1.2 os
associa a mais de um RF:

- **CA-017**: gráfico cruzado — preparado no formulário (RF-004/IMP-002 via CA-017 da matriz de formulário) e efetivado no dashboard (RF-009/IMP-004).
- **CA-021**: assinatura ausente — marcada na revisão (RF-008/IMP-003) e excluída de relatórios/exportações (RF-009 e RF-010/IMP-004).

**CA-034** é coberto no IMP-004 porque o comportamento exigido é a aplicação do
maior `grupo_minimo` entre projetos em relatórios/exportações (RF-009).

A conferência unitária está no CSV canônico
`registros/MATRIZ_RASTREABILIDADE.csv`, validado pelo CI a cada merge.

---

## 12. Riscos, decisões, Q, GX e mudanças

| Item | Tipo | Status |
| --- | --- | --- |
| GX-001 parecer jurídico (DPA + Art. 33) | Gate externo | pendente; bloqueia só Fase 6 |
| Provedor de IA | dependência | escolha no conjunto-ouro; interface isolada |
| Retenção de produção | jurídico | aguarda GX-001; backups já definidos em 90 dias (DEC-033) |
| Risco aceito: páginas de pessoas distintas | risco | DEC-008; procedimento operacional na v1 (§2.8 da REQ) |
| Risco aceito: grupo mínimo 1 | risco | DEC-023; configurável por projeto |
| CHG-001 — CA-032 × catálogo ERR | mudança normativa | APLICADA na REQ v1.2 |

### 12.1 Histórico da errata da matriz inline da REQ v1.2

A matriz inline da REQ v1.2 **apresentava** três defeitos de formatação identificados
na REV-REQ-003:

1. Linha órfã: `| reopenApplication|CMP-Revisao|IMP-003||||||||`
2. Linha RF-008 truncada: faltavam `CMP-Revisao` e `IMP-003` nas colunas finais
3. RF-006 associado a `TS-004`; o teste correto para upload é `TS-002`

**Tratamento já aplicado:** a REQ v1.2 (REV-REQ-003) corrigiu a matriz inline, e este
plano adota como fonte canônica o CSV `registros/MATRIZ_RASTREABILIDADE.csv`, que
reproduz fielmente a versão corrigida:

- RF-006 → TS-002 (upload)
- RF-008 → sem TS (revisão humana coberta por CAs e TS-003/TS-007/TS-008 indiretamente)
- Sem linha órfã

A correção do texto inline da REQ foi editorial e já está consolidada na fonte
aprovada; não altera regra de negócio.

### 12.2 Decisões técnicas desta fase (registrar em REGISTRO_DECISOES.csv)

DEC-037 monorepo · DEC-038 AWS sa-east-1 · DEC-039 RPO 24h/RTO 4h ·
DEC-040 SET LOCAL + RLS FORCE · DEC-041 envelope KMS + HMAC ·
DEC-042 antimalware + remoção de metadados no ingresso ·
DEC-043 interface ReadEngine · DEC-044 sessão em banco + CSRF ·
DEC-045 k-anon na camada de consulta.

---

## 13. Critério de prontidão e ciclo de verificação

- [x] Todo RF tem tratamento técnico identificado
- [x] Modelo físico e contrato definidos (OpenAPI é artefato irmão deste plano)
- [x] Estratégia de testes cobre todos os 46 CAs da REQ v1.2
- [x] Dependências e GX explícitas; nenhuma suposição crítica oculta
- [ ] Ciclo de verificação independente convergido (REV-PLANO-005 registrada em registros/REVISOES.csv com 0 achados bloqueantes, 0 altos, 0 médios)

**Bloqueio de status:** este plano NÃO pode ser declarado PRONTO PARA IMPLEMENTAÇÃO
enquanto a REV-PLANO-005 não registrar 0 achados bloqueantes, altos e médios.

Histórico de rodadas em `registros/REVISOES.csv` (namespace REV-PLANO-xxx, distinto de REV-REQ-xxx).

---

## Bloco 2 — Matriz canônica (projeção legível)

A matriz canônica vive em `registros/MATRIZ_RASTREABILIDADE.csv`. A tabela abaixo
reproduz a matriz aprovada na REQ v1.2 e deve ser usada para gerar/atualizar o CSV.

| Requisito | Regra | Entidade | Fluxo | História | Critério | Teste Sentinela | Operation ID | Componente | Incremento |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | RN-001, RN-004 | ENT-002, ENT-003, ENT-014 | FL-001 | US-010 | CA-012, CA-016, CA-025, CA-035, CA-037, CA-037b, CA-038 | TS-001 | createTenantUser, inviteUser, updateUser, revokeAccess | CMP-Auth | IMP-001 |
| RF-002 | RN-025 | ENT-002 | FL-001 | US-010 | CA-026, CA-037, CA-037b | — | login, logout, resetPassword, setupMfa | CMP-Auth | IMP-001 |
| RF-003 | RN-027 | ENT-004, ENT-021 | FL-001 | US-006 | CA-027 | — | createProject, archiveProject, unarchiveProject | CMP-Projects | IMP-002 |
| RF-004 | RN-017, RN-018, RN-019, RN-021, RN-042 | ENT-005, ENT-006, ENT-007, ENT-008, ENT-016 | FL-001 | US-007 | CA-001, CA-015, CA-017, CA-018, CA-019, CA-020, CA-028, CA-036 | TS-006 | createForm, createVersion, publishVersion, generatePdf | CMP-Forms | IMP-002 |
| RF-005 | RN-011, RN-012, RN-014, RN-015 | ENT-009, ENT-010 | FL-001, FL-002 | US-003 | CA-002, CA-014, CA-014b, CA-032 | — | linkRespondent | CMP-Respondents | IMP-003 |
| RF-006 | RN-040 | ENT-010, ENT-011 | FL-001 | US-001 | CA-003, CA-004, CA-013, CA-029, CA-039, CA-040 | TS-002 | uploadImages | CMP-Upload | IMP-002 |
| RF-007 | RN-037, RN-038, RN-039 | ENT-011 | FL-001, FL-002 | US-002 | CA-005, CA-006, CA-018, CA-019, CA-030, CA-041 | TS-003, TS-007 | processAIReading | CMP-MotorIA | IMP-003 |
| RF-008 | RN-016, RN-043, RN-044 | ENT-010, ENT-011, ENT-017 | FL-001, FL-002 | US-002, US-003 | CA-007, CA-008, CA-021, CA-033, CA-042, CA-043, CA-044 | — | openReview, saveReview, confirmApplication, discardApplication, reopenApplication | CMP-Revisao | IMP-003 |
| RF-009 | RN-026 | ENT-012 | FL-001 | US-004, US-008 | CA-009, CA-010, CA-011, CA-017, CA-021, CA-031, CA-034 | TS-004 | getDashboardAggregated, createGroup, getIndividualRecord | CMP-Dashboard | IMP-004 |
| RF-010 | RN-030, RN-031 | ENT-009, ENT-018, ENT-019 | FL-001 | US-005, US-009 | CA-021, CA-022, CA-023, CA-024 | TS-005, TS-008 | exportData, executeDataSubjectRequest | CMP-LGPD | IMP-004 |

---

## Anexo — Registro de revisões independentes do plano (namespace REV-PLANO)

| id | data | revisor | versao_revisada | achados_bloqueantes | achados_altos | achados_medios | achados_baixos | status | resolucao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REV-PLANO-001 | 24/10/2026 | IA Revisora (Simulada) | 1.0 | 0 | 2 | 3 | 2 | Resolvido | Falta de §4.4 e §4.5; RPO/RTO não declarados; namespace colidia com REV-REQ. Resolvidos na v2.0. |
| REV-PLANO-002 | 27/10/2026 | IA Revisora (Simulada) | 2.0 | 0 | 0 | 3 | 1 | Resolvido | Errata desatualizada; RPO/RTO sem referência em §4.3; fronteira de confiança; namespace. |
| REV-PLANO-003 | 27/10/2026 | IA Revisora (Simulada) | 2.1 | 0 | 1 | 2 | 1 | Resolvido | §13 declarava PRONTO antes de revisão registrada; exceção `campo_respondente` além da REQ; CA-018/CA-019 duplicados; dicionário de dados parcial. Resolvidos na v2.2. |
| REV-PLANO-004 | 27/10/2026 | IA Revisora (Simulada) | 2.2 | 0 | 1 | 0 | 0 | Resolvido | Alocação de CA-017, CA-021 e CA-034 divergia da matriz canônica. Corrigido na v2.3 com inclusão explícita no IMP-004, manutenção justificada onde há múltiplos RFs e atualização do Bloco 2. |
| REV-PLANO-005 | 27/10/2026 | IA Revisora (Simulada) | 2.3 | 0 | 0 | 0 | 0 | Pendente | Aguardando verificação da v2.3. |

---

**Fim do documento `PLANO.md` v2.3**