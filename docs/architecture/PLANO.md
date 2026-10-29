<!-- markdownlint-disable MD013 -->

# PLANO.md — MinhaPesquisa

**Plano técnico e de incrementos · Fase 3 (cty-arq)**
**Fontes normativas:** REQ v1.8 (CHG-006 aplicada, pendente de aceite) · docs/spec/BLOCO_P.md · Kit v3
**Nível de rigor:** Completo
**Responsável:** Carlos Yano
**Versão do plano:** 2.9
**Status:** EM REVISÃO — REV-PLANO-010 (verificação) pendente (critério da DEC-073)
**Precedência:** decisões de negócio aprovadas → REQ aprovada → decisões técnicas e este plano → Bloco P → recomendações da IA.
**Este plano não altera regra de negócio.** Lacunas de negócio são registradas como Q na REQ e só entram no plano depois de respondidas.

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
fast-check, Stryker (escopo da DEC-052). CI GitHub Actions: CodeQL, gitleaks, SBOM.

A estrutura de pastas e a fonte de verdade de cada artefato estão em `ARCHITECTURE.md`
(DEC-049). As pastas `apps/` e `packages/` são criadas no IMP-001.

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

O registro da imagem e o recorte (DEC-048) ficam no worker, não no motor: o motor
recebe o recorte já normalizado.

---

## 3. Componentes (CMP) e responsabilidades

| CMP | Responsabilidade | RF | Principais operationIds |
| --- | --- | --- | --- |
| CMP-Auth | sessão, MFA, reset de MFA, convites, perfis, vínculos, concessões | RF-001, RF-002 | login, verifyMfa, startMfaSetup, setupMfa, logout, getCurrentSession, resetPassword, confirmPasswordReset, acceptInvite, listUsers, createTenantUser, getUser, updateUser, inviteUser, resetMfa, grantIndividualAccess, listIndividualAccessGrants, revokeAccess |
| CMP-Projects | projetos, parâmetros, ciclo de vida | RF-003 | listProjects, getProject, createProject, updateProject, archiveProject, unarchiveProject |
| CMP-Forms | versões imutáveis, perguntas, regras de salto, PDF e mapa de layout | RF-004 | listForms, createForm, getVersion, createVersion, updateVersion, publishVersion, generatePdf |
| CMP-Upload | validação, antimalware, metadados, QR, registro da imagem, storage | RF-006 | uploadImages, identifyApplication, addApplicationPages, getPageImage |
| CMP-MotorIA | recorte, chamada ao provedor, confiança, cota | RF-007 | processAIReading (worker), getQuotaStatus |
| CMP-Respondents | unicidade por CPF, vínculo, criação, reversão | RF-005 | linkRespondent (interno) |
| CMP-Revisao | fila, reserva, revisão, conclusão, assinatura, descarte, reabertura | RF-008 | listReviewQueue, getApplication, openReview, getItemImage, saveReview, confirmApplication, attachSignaturePage, retryReading, discardApplication, reopenApplication |
| CMP-Dashboard | agregação, grupos dinâmicos, k-anonimato, ficha | RF-009 | getDashboardAggregated, listGroups, createGroup, deleteGroup, findRespondent, getIndividualRecord |
| CMP-LGPD | exportação, pedidos do titular, expurgo, portabilidade, auditoria | RF-010 | exportData, getExport, createDataSubjectRequest, listDataSubjectRequests, getDataSubjectRequest, executeDataSubjectRequest, cancelDataSubjectRequest, listAuditEvents |
| CMP-Infra | banco, storage, KMS, filas, observabilidade, CI | todos | — |

---

## 4. Fluxos críticos

### 4.1 Upload → leitura → revisão → conclusão

- Ordem de validação de cada arquivo (DEC-042), parando no primeiro motivo: (1) tamanho ≤ 20 MB, verificado durante o recebimento; (2) antimalware (ClamAV sidecar) sobre todo arquivo; (3) tipo por assinatura de conteúdo (magic bytes), não pelo MIME declarado — JPEG, PNG ou PDF; (4) ≤ 50 páginas (DEC-029). Recusa → ERR-029 com o motivo exato.
- Remoção de metadados EXIF/GPS (sharp) antes do storage (DEC-042).
- Bucket de imagens privado, sem versionamento e fora do backup: o expurgo físico apaga a única cópia (RN-030).
- QR validado contra tenant + projeto + versão + página; registro da imagem pelos marcadores (DEC-048). Estado inicial pela tabela de criação da FL-001 (ERR-004, ERR-039, ERR-003).
- Imagem gravada em bucket privado; acesso apenas por link assinado de 5 min (DEC-034), entregue por `getItemImage`.
- Outbox registra `leitura.solicitada` na mesma transação.
- Worker lê páginas em paralelo, em recortes; identificação e saúde em chamadas separadas, sem identificador do respondente (DEC-022, RN-038, RN-039).
- Antes de cada chamada, reserva atômica de orçamento (DEC-051); sem reserva → `aguardando_cota`.
- Saída validada contra schema; estado de cada item pela ordem de avaliação da FL-002 (REQ §6.4). Pontos de atenção:
  - Confiança comparada no valor bruto; **estritamente maior** que o limite confirma (0,90 exato vai para `a_revisar` — CA-005, CA-006, TS-003).
  - CPF sempre revisável (RN-012); valor fora do schema sempre revisável (CA-006); `texto_livre` sempre revisável (DEC-057).
  - Regra de salto dependente de campo não resolvido → `aguardando_condicao` (CA-018).
- Revisão humana com reserva de 30 min (ReservaAplicacao é a fonte única) e ETag/If-Match obrigatório (RN-043, DEC-034).
- Conclusão (`confirmApplication`) exige os 5 campos da DEC-020 e assinatura presente (RN-044); vínculo por CPF é feito aqui — CPF existente vincula, CPF novo cria respondente (CA-014b). Divergência de cadastro: o digitalizador escolhe o valor (CA-014).
- Falta de campo obrigatório → ERR-006 (CPF ausente/inválido → `aguardando_cpf`).

### 4.2 Falha e cota

Timeout e retentativas conforme tabela abaixo. Após 3 falhas consecutivas em chamada idempotente → `erro_leitura` (ERR-041). Cota mensal atingida → `aguardando_cota` (ERR-003) + aviso ao administrador por e-mail e na tela (`getQuotaStatus`); nada é descartado (DEC-035). Período e conversão de moeda: DEC-058.

#### 4.2.1 Tabela de timeouts por operação

| Operação | Timeout | Retentativa | Estado final de falha | Referência |
| --- | --- | --- | --- | --- |
| Chamada ao provedor de IA (leitura de recorte) | 30 s | 1, 2, 4 s (só idempotente) | `erro_leitura` após 3 falhas (ERR-041) | RF-007, CA-041, P.7 |
| Envio de e-mail transacional (convite, recuperação, aviso de cota) | 30 s | 1, 2, 4 s | auditoria registra falha; usuário notificado na tela | RF-001, RF-002, CA-030 |
| Upload/download no storage de objetos | 30 s | 1, 2, 4 s | ERR-020; nada é gravado | RF-006, CA-029 |
| Job de exportação (CSV/XLSX) e PedidoTitular | 60 s | sem retentativa automática (job enfileirado) | PedidoTitular em `falhou` (FL-003), com auditoria e alerta; exportação em `falhou` | RF-010, CA-022, CA-024 |
| Geração de PDF imprimível | 30 s | 1, 2, 4 s | ERR-020; versão permanece como está | RF-004, CA-028 |

### 4.3 Eliminação (RF-010)

Bloqueio imediato do acesso → anonimização do respondente (`nome` = "ANONIMIZADO";
`cpf_cifrado`, `cpf_hash`, `data_nascimento` e `endereco` = NULL) e sobrescrita dos
valores de resposta, de `motivo_descarte`/`motivo_reabertura` e da descrição do pedido →
apagamento do histórico de atributos (ENT-023) → cancelamento e apagamento de exportações
(ENT-026) → descarte de aplicações em andamento → registro em `lista_eliminacoes` (180 dias)
**e** no registro externo de eliminações (DEC-062) → expurgo físico em até 30 dias.
Auditoria guarda só referências. Restauração de backup reaplica a eliminação lendo o
registro externo, porque a tabela `lista_eliminacoes` restaurada é tão antiga quanto o
backup (DEC-033, P.13). `executeDataSubjectRequest` responde 202 e
executa em job; o pedido segue a FL-003 (falha → `falhou`, que pode ser executado de novo).
As chaves de idempotência (ENT-029) guardam só status e ID; nunca o corpo da resposta.

**Vínculo com continuidade (§9.2):** a reaplicação da eliminação após restore é obrigatória no runbook, sempre a partir do registro externo (DEC-062) e antes de reabrir o banco ao tráfego, cobrindo a janela de RPO de 24 h e a retenção de backup de 90 dias (DEC-033). O teste de restauração (TS-008 + restore) é executado a cada incremento, em staging, e mede o RTO alvo de 4 h.

### 4.4 Reabertura com reversão de cadastro (CA-042)

Reabertura de aplicação concluída volta a `em_revisao`; se o CPF for corrigido, o
vínculo é refeito e as alterações de cadastro feitas por essa aplicação são
revertidas, com registro em auditoria. Implementação: job transacional único que
(i) muda estado da aplicação, (ii) desfaz atributos de Respondente alimentados pela
aplicação retornando ao valor anterior ou a NULL se não havia valor prévio,
(iii) preserva auditoria da reversão. O valor anterior fica em HistoricoAtributoRespondente
(ENT-023, cifrado como o original, DEC-063), nunca na auditoria. A reversão de um atributo só
acontece se o valor atual ainda for o gravado por essa aplicação (`valor_gravado_hash`); se
outra aplicação posterior já o alterou, o atributo é mantido e a divergência auditada.

### 4.5 Reset de MFA pelo administrador (CA-037b)

Admin reseta MFA do usuário → todas as sessões ativas são encerradas (invalidação em
banco e em cache) → usuário cadastra novo MFA no próximo login (fluxo equivalente ao
primeiro acesso, CA-035) → reset registrado em auditoria com acao=RESET_MFA,
entidade=Usuario, registro_id=<usuario_id>.

### 4.6 Login e MFA (DEC-050)

1. `login` (rota pública) valida e-mail e senha. Falha → ERR-013; 5 falhas em 15 min para o mesmo e-mail (exista ou não a conta, contadas pelo HMAC do e-mail) → ERR-014.
2. Sucesso cria **pré-sessão** (cookie próprio, 5 min, válida só para `/auth/mfa/*`) e informa a etapa: `mfa_verificacao` ou `mfa_cadastro`.
3. `startMfaSetup` gera o segredo TOTP **no servidor**, grava cifrado e devolve a URI otpauth; `setupMfa` confirma com um código. `verifyMfa` valida o código para quem já tem MFA. Código errado → ERR-012 (conta como falha de login).
   - **Guarda de etapa (CA-026b):** a etapa fica gravada na pré-sessão no servidor (nunca vem do cliente). `startMfaSetup` e `setupMfa` exigem etapa `mfa_cadastro` **e** `mfa_ativo = false` relido do banco na chamada (na mesma transação que grava o segredo); `verifyMfa` exige `mfa_verificacao`. Fora disso → ERR-018, sem alterar o segredo nem criar sessão. Sem isso, quem tem só a senha cadastraria um novo TOTP e contornaria o MFA.
   - Ao concluir `setupMfa`, as demais pré-sessões do usuário são encerradas (evita a corrida entre duas pré-sessões em `mfa_cadastro`).
4. Só então a sessão plena é criada (30 min de inatividade, 24 h no máximo). Com 3 sessões ativas, a nova é recusada com ERR-021 (mesmo comportamento validado no MeuRemedio, Bloco P P.2).
5. Identificação do usuário: e-mail único global (DEC-054).

### 4.7 Papéis de banco e RLS fora da requisição (DEC-046)

| Contexto | Papel | Como obtém o tenant |
| --- | --- | --- |
| Resolução da sessão (toda requisição autenticada) | função `SECURITY DEFINER` `resolver_sessao(hash_do_cookie)` com `search_path` fixo, que devolve só `(tenant_id, usuario_id, tipo, expira)` e renova a atividade | a própria função |
| Requisição autenticada | `mp_app` (sujeito a RLS com FORCE) | resultado de `resolver_sessao` → `SET LOCAL app.tenant_id` na transação; escritas em Sessao (logout, encerramento de sessões) seguem pela RLS |
| Login e tokens públicos | função `SECURITY DEFINER` com `search_path` fixo, que só busca por HMAC de e-mail/token e devolve o mínimo | não precisa; a função devolve o tenant do usuário |
| Job do worker por aplicação | `mp_app` | job carrega `tenant_id`; worker faz `SET LOCAL` antes de qualquer consulta |
| Jobs entre tenants (expurgo, virada de cota, expiração de concessões, reaplicação de eliminações) | `mp_manutencao` (BYPASSRLS), só no processo de jobs agendados | itera tenants explicitamente; cada ação é auditada |
| Migrações | `mp_owner` (dono das tabelas; nunca usado pela aplicação) | — |

Sem `app.tenant_id` definido, `current_setting('app.tenant_id', true)` é NULL e as
policies não devolvem nada (falha fechada). Tabelas da fila (pg-boss) e do outbox não
guardam dado pessoal; o payload carrega apenas IDs.

---

## 5. Modelo de dados físico

### 5.1 Convenções

- Tabelas correspondem a ENT-001 a ENT-030, em `snake_case`.
- Toda tabela com dado de tenant carrega `tenant_id`; filhas usam FK composta `(id, tenant_id)`.
- Constraints nomeadas: `pk_`, `fk_`, `uq_`, `ck_` + contexto.
- Instantes `timestamptz` UTC; datas civis (`data_nascimento`, `data_aplicacao`) como `date`.
- Dinheiro `numeric(10,2)`; confiança `numeric(5,4)` com o valor bruto; UTF-8; paginação 20, máximo 100.

### 5.2 Isolamento (DEC-040, DEC-046)

- Autenticação extrai `tenant_id` da sessão.
- `SET LOCAL app.tenant_id = '<uuid>'` dentro da transação da requisição.
- Policy em toda tabela com tenant:
  `FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)`.
- `auditoria` é imutável: `mp_app` só tem `INSERT` e `SELECT` (sem `UPDATE`/`DELETE`), e um trigger recusa alteração mesmo pelo dono; expurgo por retenção só por `mp_manutencao`.
- `parametro_configuracao`: policy adicional que permite **ler** linhas com `tenant_id IS NULL` (nível plataforma); escrita nelas só por `mp_manutencao`.
- `FORCE ROW LEVEL SECURITY`, inclusive para o dono da tabela.
- Fora de escopo (outro tenant ou projeto não vinculado) → 404 ERR-002, sem revelar existência; tentativa auditada. Vale para IDs no caminho, no corpo e para ID que não pertença ao recurso pai (ex.: `item_id` de outra aplicação, `imagem_id` de outra aplicação, `grupo_id` de outro dono).
- Teste gerado do contrato cobre 100% das operações privadas (RN-023, TS-001), com IDs de outro tenant no caminho e no corpo (projetos, usuario_id, versao_id, projeto_ids, copiar_de_versao_id).

### 5.3 Constraints de unicidade

| Tabela | Constraint |
| --- | --- |
| usuario | (email) — global (DEC-054) |
| usuario_perfil | (tenant_id, usuario_id, perfil_id) |
| vinculo_usuario_projeto | (tenant_id, usuario_id, projeto_id) |
| concessao_acesso_individual | (tenant_id, usuario_id, projeto_id) WHERE ativo |
| regra_salto | (versao_id, pergunta_destino_id) |
| reserva_aplicacao | (aplicacao_id) WHERE ativa |
| lista_eliminacoes | (tenant_id, respondente_id_original) |
| parametro_configuracao | (tenant_id, projeto_id, chave, competencia) NULLS NOT DISTINCT |
| respondente | (tenant_id, cpf_hash) WHERE cpf_hash IS NOT NULL |
| linha_matriz | (pergunta_id, codigo) |
| pagina_aplicacao | (chave_storage) |
| chave_idempotencia | (usuario_id, operacao, chave) |
| falha_login | (email_hmac) |

Checks de aplicação (ENT-010): `estado = 'identificacao_pendente' OR versao_id IS NOT NULL`; `estado NOT IN ('sem_assinatura','concluida') OR (data_aplicacao IS NOT NULL AND local_aplicacao IS NOT NULL)`.

Checks: `ck_respondente_anonimizacao`: `anonimizado OR (cpf_cifrado IS NOT NULL AND cpf_hash IS NOT NULL AND data_nascimento IS NOT NULL)`.
Concessão: autorização exige `ativo AND valido_ate > now()`; o job de expiração só mantém o flag coerente.

### 5.4 Índices essenciais

- `aplicacao (tenant_id, projeto_id, estado)` — fila de revisão
- `item_resposta (tenant_id, aplicacao_id)` e `(tenant_id, pergunta_id)` — leitura/agregação
- `respondente (tenant_id, cpf_hash)` único parcial — vínculo
- `auditoria (tenant_id, criado_em)` — consulta/retenção

### 5.5 CPF e chaves (DEC-041)

AES-256-GCM com envelope no KMS (IV, cifrado, tag e id da chave de dados guardados juntos,
tamanho variável) + HMAC-SHA256 para busca com **chave por tenant** derivada por HKDF
da chave-mestre do KMS, para que o mesmo CPF não seja correlacionável entre tenants.
CPF normalizado (11 dígitos) antes do HMAC. Rotação anual: chaveiro com chave atual e
anteriores (modelo `keyring` do MeuRemedio); re-hash gradual via job. Segredos no
gerenciador da nuvem, nunca no repositório (gitleaks no CI).

### 5.6 Migrações, concorrência e retenção

Drizzle com SQL explícito versionado; migração idempotente, `down` testado.
Toda migração executa em CI contra PostgreSQL 17 real (Testcontainers).
Idempotency-Key obrigatória nas mutações críticas (REQ §6.5); dedupe por `(aplicacao_id, pagina)` no worker.
Reserva de aplicação com expiração; ETag/If-Match obrigatório em edições.
Retenção por tenant (`retencao_dias`, DEC-059); backups ≤ 90 dias (DEC-033); expurgo ≤ 30 dias; lista de
eliminações por 180 dias reaplicada após restauração de backup.

---

## 6. Contrato da API (contract-first, DEC-049)

`contracts/openapi.yaml` é a fonte de validação de requisição e resposta; schemas com
`additionalProperties: false` e `required` declarados. Erros em Problem Details
(RFC 9457), catálogo ERR fechado, `X-Correlation-ID` em todas as respostas.
Rate limit: 100 req/min/usuário; 20 req/min/IP em rotas públicas (ERR-010); 429 declarado em todas as operações.
Rotas públicas (sem sessão): `login`, `resetPassword`, `confirmPasswordReset`, `acceptInvite`.
Sessão em banco, cookie httpOnly + SameSite, CSRF double-submit em toda mutação autenticada; MFA obrigatório (§4.6).
Rotas e operationIds conforme §3; operações internas do worker não são endpoints.
Paths em inglês; campos e mensagens em português. Lint (Spectral) no CI desde a fundação; quebra de compatibilidade (oasdiff) entra no CI no IMP-001, junto com o primeiro código.

### 6.1 Autorização por perfil

Derivada de "Quem executa" de cada RF e dos atores da REQ §2.2. Ordem de verificação:
1. Recurso de outro tenant ou de projeto não vinculado (inclusive IDs no corpo) → 404 ERR-002 (RN-002, RN-004).
2. Nenhum perfil do usuário permite a operação → 403 ERR-016.
3. Perfil `analista_individual` sem concessão vigente em cada projeto envolvido → 403 ERR-008 (DEC-060).
Toda operação com "não" em alguma coluna declara 403 no contrato (verificado pelo validador).

| Operações | admin_tenant | digitalizador | analista | analista_individual |
| --- | --- | --- | --- | --- |
| RF-002 (auth) | sim | sim | sim | sim |
| RF-001 (usuários, perfis, concessões) | sim | não | não | não |
| listProjects, getProject | sim | sim | sim | sim |
| createProject, updateProject, archiveProject, unarchiveProject | sim | não | não | não |
| listForms, getVersion | sim | sim (leitura, para identificar páginas) | não | não |
| createForm, createVersion, updateVersion, publishVersion, generatePdf | sim | não | não | não |
| uploadImages, identifyApplication, addApplicationPages, getPageImage, listReviewQueue, getApplication, openReview, getItemImage, saveReview, confirmApplication, attachSignaturePage, retryReading, discardApplication | não | sim | não | não |
| reopenApplication | sim | sim | não | não |
| getQuotaStatus | sim | não | não | não |
| getDashboardAggregated, listGroups, createGroup, deleteGroup | sim | não | sim | sim |
| exportData (agregado) | sim | não | sim | sim |
| getExport | sim, só as próprias | não | sim, só as próprias | sim, só as próprias |
| exportData (linha a linha), findRespondent, getIndividualRecord | não | não | não | sim, com concessão vigente no projeto (DEC-060) |
| createDataSubjectRequest, listDataSubjectRequests, getDataSubjectRequest, executeDataSubjectRequest, cancelDataSubjectRequest, listAuditEvents | sim | não | não | não |

O perfil é cumulativo (RN-003): permissões efetivas são a união dos perfis do usuário.

---

## 7. Assíncronos e integrações

Outbox transacional + pg-boss; nenhuma mutação crítica depende de chamada síncrona externa.
`ReadEngine` atrás de interface (DEC-043); adaptador mock enquanto GX-001 pendente.
Confiança: definição e calibração na DEC-047. Registro da imagem e recortes: DEC-048.
Provedor real escolhido no conjunto-ouro (§10.1); troca sem retrabalho no produto.
E-mail: convites 24 h uso único; recuperação 60 min uso único; avisos de cota.
Medidor de custo de IA por página/tenant com reserva atômica de orçamento (DEC-051); alerta e fila ao atingir o teto.

---

## 8. Análise de ameaças (nível Completo)

| ID | Ameaça | Controle | Verificação |
| --- | --- | --- | --- |
| T-01 | Acesso entre tenants | FK composta + RLS + 404 + papéis (DEC-046) | TS-001 + contrato |
| T-02 | Injeção de instrução pela imagem | Validar saída contra schema; IA sem ações | Fixtures de injeção no mock do ReadEngine (IMP-003) |
| T-03 | Erro silencioso da IA | Conjunto-ouro; meta ≤ 0,5% (DEC-004) | Medição por mudança de modelo (§10.1) |
| T-04 | Dado sensível em log | Allowlist de campos; mascaramento | Teste que varre logs |
| T-05 | GPS/EXIF nas fotos | Remoção no ingresso | Teste de integração do upload (IMP-002) |
| T-06 | Transferência internacional sem base | GX-001; sintéticos até aprovação | Evidência contratual |
| T-07 | Sequestro de sessão / CSRF | MFA, pré-sessão restrita, cookie, double-submit, bloqueio | TS + testes de autenticação |
| T-08 | Elevação para ficha individual | Concessão com justificativa, 90 dias, expiração por data | Teste por perfil |
| T-09 | Reidentificação por filtro | k-anon por célula, também na exportação; célula oculta sem contagem; supressão complementar (DEC-067); faixas fixas de idade, filtros só categóricos e recusa pelo complemento (DEC-071, ERR-024) | TS-004 + fast-check (propriedade: nenhuma célula oculta é recuperável por subtração; complemento < mínimo sempre recusa) |
| T-10 | Replay / clique duplo | Idempotência obrigatória + dedupe | Testes de concorrência |
| T-11 | Cadeia de suprimentos | SBOM, gitleaks, CodeQL, deps | CI bloqueante |
| T-12 | Backup ressuscita eliminados | Registro externo de eliminações (DEC-062) + reaplicação antes de reabrir o banco | TS-008 + restore com backup anterior à eliminação |
| T-13 | Esgotamento de cota | Teto + reserva atômica + fila sem descarte | TS-007 |
| T-14 | QR forjado / de outro tenant | Validação tenant+projeto+versão; QR com identificador opaco | Teste de integração do upload (IMP-002) |
| T-15 | Correlação de CPF entre tenants | HMAC com chave por tenant (DEC-041) | Teste unitário: mesmo CPF, tenants distintos, hashes distintos |
| T-16 | Função SECURITY DEFINER abusada | Função mínima, search_path fixo, sem SQL dinâmico | Teste de integração com papel `mp_app` |

---

## 9. Operação

### 9.1 Nuvem (ADR-001, resolve DEC-036)

Alternativas: AWS sa-east-1 vs Azure Brazil South.
Decisão: AWS sa-east-1 — paridade com a stack já validada no MeuRemedio
(Bloco P [MR]), S3 presigned URL, KMS e Terraform maduros; região no Brasil atende
RNF-011. Custo sob controle do teto de IA. Registro: DEC-038. O documento ADR-001
deste projeto é criado no IMP-001 em `docs/decisions/`.

### 9.2 Continuidade (DEC-039)

- **RPO:** 24 h
- **RTO:** 4 h
- **Retenção de backup:** máxima de 90 dias (DEC-033), só do banco; imagens não têm backup nem versionamento
- **Restauração testada:** a cada incremento, em staging, com runbook que inclui a reaplicação obrigatória de eliminações a partir do registro externo (DEC-062)
- **Métricas e alertas:** idade do último backup bem-sucedido, duração do restore, taxa de sucesso da reaplicação de eliminações
- **Referências normativas:** P.13 (Bloco P), DEC-033, TS-008

### 9.3 Observabilidade

Logs estruturados com correlação; métricas de custo IA/página, p95 de leitura,
profundidade da fila e violações de isolamento; alertas de cota, falha de leitura,
isolamento e falha do job de expurgo.

### 9.4 CI/CD e rollback

validador de consistência → typecheck → lint → unit → contrato (Spectral + oasdiff)
→ integração (Testcontainers) → E2E + axe → mutação (DEC-052) → CodeQL → gitleaks → SBOM.
Migrações antes do código; rollback = migração `down` testada + imagem anterior.
O validador (`tools/validar_consistencia.py`) e o Spectral já rodam no CI desde a
fundação (`.github/workflows/ci.yml`).

---

## 10. Estratégia de testes por risco

| Risco | Camada | Ferramenta | Trace |
| --- | --- | --- | --- |
| Isolamento | contrato + integração | Testcontainers + Schemathesis | TS-001, RNF-001 |
| Upload seguro | integração | fixtures sintéticas + EICAR | TS-002, CA-029 |
| Confiança/faixa + fronteira 0,90 | unidade + propriedade | Vitest + fast-check | TS-003, CA-005/CA-006 |
| k-anonimato | unidade + propriedade | fast-check | TS-004, RNF-004, DEC-067, DEC-071 |
| Eliminação + reaplicação em restore | integração + E2E | Testcontainers + Playwright | TS-005/TS-008 |
| Imutabilidade | integração | Testcontainers | TS-006, CA-001 |
| Cota IA | integração | mock do medidor | TS-007, CA-030 |
| Erro silencioso | conjunto-ouro | gabarito humano | DEC-004 |
| Acessibilidade | E2E | Playwright + axe | RNF-012 |
| Concorrência/reserva | integração | requisições paralelas | CA-043 |
| Autenticação/MFA/reset MFA | E2E + integração | Playwright + Testcontainers | CA-026, CA-026b, CA-037, CA-037b |
| Vínculo de respondente (novo/existente) | integração | Testcontainers | CA-002, CA-014, CA-014b |
| Reabertura com reversão | integração | Testcontainers | CA-042 |
| Dashboard com gráfico cruzado e k-anon | integração + propriedade | Testcontainers + fast-check | CA-017, CA-034 |
| Assinatura ausente fora de relatórios/exportações | integração + E2E | Testcontainers + Playwright | CA-021 |

### 10.1 Conjunto-ouro (DEC-004, DEC-047, DEC-056)

- Origem: formulários preenchidos à mão por voluntários 60+ com dados fictícios, sob termo de participação próprio (DEC-056).
- Tamanho mínimo por tipo de pergunta: para afirmar erro silencioso ≤ 0,5% com 95% de confiança sem nenhum erro observado, são necessários **pelo menos 600 campos autoconfirmados** por tipo (regra dos três: 3/n ≤ 0,005). Com erros observados, o tamanho é recalculado pelo limite superior de Clopper-Pearson.
- Gabarito com dupla digitação humana e arbitragem das divergências.
- Saídas: escolha do provedor e do método de confiança, calibração do `limite_confianca` (DEC-028 é provisória) e relatório versionado em `docs/`.

### 10.2 Infraestrutura de teste determinístico

- Relógio e gerador de IDs injetáveis (reserva de 30 min, convite de 24 h, concessão de 90 dias, sessão).
- Gerador de CPF válido e lista de CPFs inválidos de referência.
- Semente TOTP conhecida para o E2E com MFA.
- Arquivo de teste EICAR puro (68 bytes) enviado com extensão .png e MIME image/png; EICAR embutido num PNG válido não é detectado.
- Mock do ReadEngine com fixtures: confiança abaixo, igual (0,90) e acima do limite; saída malformada; valor fora do schema; imagem com instrução injetada; timeout e erro.
- Dados 100% sintéticos (Q-001).

### 10.3 Test-First com IA (DEC-053)

IA-TEST escreve testes vermelhos a partir da REQ, em PR próprio, aprovado pelo
responsável. IA-DEV implementa em outro PR, sem alterar os testes aprovados (checagem
no CI + CODEOWNERS). Todo teste com `// @trace <IDs>` para RF/RN/CA/TS. A matriz é
validada a cada merge.

---

## 11. Incrementos

| IMP | Escopo | CAs cobertos | Entrada | Saída / evidência esperada |
| --- | --- | --- | --- | --- |
| IMP-001 | Repo, CI, banco com RLS e papéis, auth + MFA, usuários, perfis, vínculos e concessões, esqueleto do contrato | CA-012, CA-016, CA-025, CA-026, CA-026b, CA-035, CA-037, CA-037b, CA-038 | Gate 1 aprovado; REQ e Bloco P no repo | CI verde; TS-001 passando nas operações existentes; migração aplicada em PG17; E2E de login com MFA e reset de MFA |
| IMP-002 | Projetos, formulários/versões, PDF/QR com mapa de layout, pipeline de upload, regras de salto | CA-001, CA-003, CA-004, CA-013, CA-027, CA-028, CA-029, CA-036, CA-039, CA-040 | IMP-001 aceito | TS-002 e TS-006; PDF imprimível; metadados removidos; regra de salto avaliada |
| IMP-003 | Motor IA isolado, registro da imagem, leitura, cota, revisão, vínculo por CPF, reabertura | CA-002, CA-005, CA-006, CA-007, CA-008, CA-014, CA-014b, CA-015, CA-018, CA-019, CA-020, CA-021, CA-030, CA-032, CA-033, CA-041, CA-042, CA-043, CA-044 | IMP-002 aceito | TS-003 e TS-007; FL-001/FL-002 cobertas; vínculo novo/existente; reversão na reabertura; fronteira 0,90 em `a_revisar` |
| IMP-004 | Dashboards, grupos, exportação, direitos do titular, auditoria | CA-009, CA-010, CA-011, CA-017, CA-021, CA-022, CA-023, CA-024, CA-031, CA-034 | IMP-003 aceito | TS-004/TS-005/TS-008; k-anon por célula; expurgo reaplicável após restore; gráfico cruzado; exclusão de aplicação sem assinatura de relatórios/exportações; grupo mínimo entre projetos |

Cada IMP: IA-TEST escreve testes vermelhos → IA-DEV implementa → verificações
completas → ciclo de revisão por PR → merge pelo responsável → ciclo sobre o
incremento inteiro → Gate 2 (aceite do responsável).

Conjunto-ouro (§10.1) roda em paralelo ao IMP-003 e é pré-requisito do piloto, não do aceite do IMP-003 (o IMP-003 usa o mock).

### 11.1 Cobertura dos 47 CAs da REQ v1.8

A soma dos CAs listados nos IMP-001 a IMP-004 cobre integralmente os 47 critérios
de aceite da REQ v1.8 (CA-001 a CA-044, incluindo CA-014b, CA-026b e CA-037b). O validador
confere que cada CA está no incremento do seu RF.

**CA-021** aparece em mais de um incremento porque a REQ o associa a mais de um RF:
marcado na revisão (RF-008/IMP-003) e excluído de relatórios/exportações (RF-009 e RF-010/IMP-004).

Na v1.5 (CHG-004), CA-015, CA-018, CA-019 e CA-020 passaram a pertencer só aos RF que os
tornam observáveis (leitura e revisão, IMP-003) e CA-017 só ao RF-009 (IMP-004); o IMP-002
entrega a estrutura (regras de salto e perguntas de cruzamento), verificada pelos testes de
RF-004, sem declarar esses CAs.

**CA-034** é coberto no IMP-004 porque o comportamento exigido é a aplicação do
maior `grupo_minimo` entre projetos em relatórios/exportações (RF-009).

**Cobertura parcial no IMP-001:** CA-016, CA-025 e CA-038 pertencem ao RF-001 e são
aceitos no IMP-001 sobre as operações que existem nele (projetos vinculados, concessão,
expiração e revogação com encerramento de sessões). O efeito sobre dashboards e ficha
individual é reverificado no IMP-004 pelo TS-001 gerado do contrato e pelo CA-011.

A conferência unitária está no CSV canônico `registros/matriz_rastreabilidade.csv`,
validado pelo CI a cada merge.

---

## 12. Riscos, decisões, Q, GX e mudanças

| Item | Tipo | Status |
| --- | --- | --- |
| GX-001 parecer jurídico (DPA + Art. 33) | Gate externo | pendente; bloqueia piloto e produção |
| Provedor de IA | dependência | escolha no conjunto-ouro; interface isolada |
| Retenção de produção | jurídico | aguarda GX-001; backups já definidos em 90 dias (DEC-033) |
| Risco aceito: páginas de pessoas distintas | risco | DEC-008; procedimento operacional na v1 (§2.8 da REQ) |
| Risco aceito: grupo mínimo reduzido até 1 | risco | DEC-055 (padrão 5; redução auditada) |
| CHG-001 — CA-032 × catálogo ERR | mudança normativa | aplicada na REQ v1.2 |
| CHG-002 — correções de consistência e lacunas | mudança normativa | aceita em 27/10/2026 (REQ v1.3) |
| CHG-003 — respostas às Q-005 a Q-011 | mudança normativa | aceita em 27/10/2026 (REQ v1.4, DEC-054 a DEC-060) |
| CHG-004 — achados das revisões independentes (rodadas 1 e 2) | mudança normativa | aceita em 28/10/2026 (REQ v1.6) |
| CHG-005 — respostas às Q-012 a Q-020, DEC-061 e DEC-073 | mudança normativa | aceita em 28/10/2026 (REQ v1.7, DEC-064 a DEC-073) |

### 12.1 Histórico da errata da matriz inline da REQ v1.2

Histórico: a matriz inline da REQ v1.2 apresentava três defeitos de formatação identificados
na REV-REQ-003 (linha órfã de `reopenApplication`, linha RF-008 truncada e RF-006
associado a TS-004 em vez de TS-002). Histórico: a REQ v1.2 corrigiu a matriz; a v1.3 a ampliou
com as operações novas (CHG-002). A fonte canônica é
`registros/matriz_rastreabilidade.csv`, idêntica à REQ e ao Bloco 2 deste plano.

### 12.2 Decisões técnicas desta fase

Fonte única das decisões técnicas; `registros/registro_decisoes.csv` é gerado desta
tabela e da tabela de decisões da REQ por `tools/gerar_registros.py`.

| id | data | tipo | problema | alternativas | decisao | premissa_justificativa | status | substituido_por | impacto | relacionados |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEC-037 | 24/10/2026 | técnica | Estrutura do monorepo | Repo único; múltiplos repos | apps/web, apps/api, apps/worker, packages/motor-leitura, packages/db, packages/contratos, infra | Simplicidade e contract-first compartilhado | definitivo | | Baixo | PLANO §2 |
| DEC-038 | 24/10/2026 | técnica | Nuvem do projeto | AWS sa-east-1; Azure Brazil South | AWS sa-east-1 | Paridade com a stack validada no MeuRemedio; região Brasil; resolve DEC-036 | definitivo | | Alto | RNF-011, DEC-036 |
| DEC-039 | 24/10/2026 | técnica | RPO e RTO da v1 | Valores menores; valores maiores | RPO 24h / RTO 4h | Compatível com volume de 500 formulários/mês | definitivo | | Médio | Bloco P P.13 |
| DEC-040 | 24/10/2026 | técnica | Isolamento por tenant | RLS puro; schema por tenant; FK composta + RLS com SET LOCAL | SET LOCAL app.tenant_id por transação + RLS com FORCE | Defesa em camadas exigida pela RN-001 | definitivo | | Alto | RN-001, RN-023, TS-001 |
| DEC-041 | 24/10/2026 | técnica | Cifragem do CPF | Ciframento no app; envelope KMS | AES-256-GCM com envelope no KMS + HMAC-SHA256 com chave por tenant derivada por HKDF | RNF-003 e RN-013 com rotação possível; sem correlação entre tenants (ajustada em 27/10/2026) | definitivo | | Alto | RNF-003, RN-013 |
| DEC-042 | 24/10/2026 | técnica | Segurança de arquivos no ingresso | Só tipo/tamanho; pipeline completo | Tamanho, antimalware (ClamAV) sobre todo arquivo, tipo por magic bytes e páginas, nessa ordem; remoção de metadados (sharp) antes do storage | CA-029 e RN-040 sem ambiguidade | definitivo | | Alto | CA-029, RN-040, TS-002 |
| DEC-043 | 24/10/2026 | técnica | Interface do motor de IA | Acoplado ao provedor; interface ReadEngine | Interface ReadEngine com adaptador por provedor | DEC-007: troca sem retrabalho | definitivo | | Alto | DEC-007, RF-007 |
| DEC-044 | 24/10/2026 | técnica | Sessão e proteção de mutações | JWT stateless; sessão em banco | Sessão em banco + cookie httpOnly + CSRF double-submit | Bloco P P.2 | definitivo | | Alto | RF-002, CA-026 |
| DEC-045 | 24/10/2026 | técnica | Camada do k-anonimato | Supressão no front; supressão na consulta | Supressão por célula na camada de consulta agregada | CA-010/CA-034 valem para tela e exportação | definitivo | | Alto | CA-010, CA-034, TS-004 |
| DEC-046 | 27/10/2026 | técnica | Acesso ao banco fora da requisição autenticada | Desligar RLS no login e nos jobs; papéis separados | Papéis mp_app (RLS), função SECURITY DEFINER mínima para login e tokens, mp_manutencao (BYPASSRLS) só em jobs entre tenants, mp_owner para migrações | Com FORCE RLS, login e jobs não enxergam dados sem um desenho explícito | definitivo | | Alto | DEC-040, RN-001 |
| DEC-047 | 27/10/2026 | técnica | Definição da confiança da leitura | Confiança declarada pelo modelo; logprobs; consenso de leituras | Adaptador devolve confiança em [0,1] calibrada; método escolhido e calibrado no conjunto-ouro; comparação no valor bruto | LLMs de visão não devolvem confiança calibrada por padrão; sem definição a DEC-028 e a DEC-004 não são mensuráveis | provisório | | Alto | DEC-004, DEC-028, RF-007 |
| DEC-048 | 27/10/2026 | técnica | Origem dos recortes e fotos de celular | Recorte por coordenadas fixas; registro da imagem | PDF grava mapa de layout por versão; marcadores fiduciais + QR por página; correção de perspectiva antes do recorte; falha leva a identificacao_pendente | Fotos de celular têm perspectiva e rotação; sem registro os recortes não correspondem aos campos | definitivo | | Alto | RF-004, RF-006, RF-007 |
| DEC-049 | 27/10/2026 | técnica | Fonte de verdade dos artefatos | Edição manual em vários lugares; fonte única + geração | contracts/openapi.yaml é a fonte do contrato; packages/contratos guarda só tipos gerados; registros CSV gerados de REQ e PLANO e validados no CI | Divergências entre artefatos encontradas na REV-REQ-004 e na REV-PLANO-006 | definitivo | | Alto | PLANO §6, ARCHITECTURE.md |
| DEC-050 | 27/10/2026 | técnica | Fluxo de MFA | Segredo enviado pelo cliente; segredo gerado no servidor | Pré-sessão restrita a /auth/mfa/*; segredo TOTP gerado no servidor e cifrado; sessão plena só após verificação | Cliente não deve escolher o segredo; MFA obrigatório para todos (DEC-025) | definitivo | | Alto | DEC-025, CA-026, CA-035 |
| DEC-051 | 27/10/2026 | técnica | Controle do teto de custo de IA | Checagem após a chamada; reserva prévia | Reserva atômica de orçamento com custo estimado antes de cada chamada e ajuste pelo custo real | Workers em paralelo ultrapassariam o teto | definitivo | | Médio | DEC-035, CA-030, TS-007 |
| DEC-052 | 27/10/2026 | técnica | Escopo do teste de mutação | Mutação ≥ 80% em todo o código; escopo crítico | Mutação ≥ 80% em motor-leitura, regras de FL-001/FL-002, k-anonimato, CPF e autorização; demais com cobertura de linhas ≥ 80% | Mutação em todo o repositório é lenta e cara sem ganho proporcional; desvio do Bloco P P.1 registrado | definitivo | | Médio | Bloco P P.1 |
| DEC-053 | 27/10/2026 | técnica | Separação IA-TEST e IA-DEV | Mesmo PR; PRs separados com testes congelados | Testes vermelhos em PR próprio aprovado pelo responsável; PR de implementação não altera testes aprovados (CI + CODEOWNERS) | Evita que a mesma IA ajuste o teste ao código | definitivo | | Alto | Bloco P P.14 |
| DEC-062 | 28/10/2026 | técnica | Onde guardar a lista de eliminações | Tabela no mesmo banco; registro externo | Registro append-only em bucket S3 separado, com Object Lock (retenção 180 dias), gravado na mesma execução da eliminação; o runbook de restore lê dele e reaplica antes de reabrir o banco | A tabela no banco restaurado é tão antiga quanto o backup e não contém eliminações posteriores (achado B-01 da REV-PLANO-007) | definitivo | | Alto | DEC-033, T-12, TS-008 |
| DEC-063 | 28/10/2026 | técnica | Guarda do valor anterior para reversão (CA-042) | Na auditoria; tabela própria cifrada | Tabela HistoricoAtributoRespondente (ENT-023), cifrada como o original, apagada na eliminação; reversão condicionada ao valor atual | A auditoria não pode guardar valores (RN-027) | definitivo | | Alto | CA-042, CA-023, RN-027 |

---

### 12.3 Achados registrados para tratamento posterior (DEC-073)

Achados médios e baixos de revisões independentes aceitos para tratamento posterior, com responsável e incremento. Vazio enquanto não houver.

| Achado | Revisão | Severidade | Descrição | Responsável | Incremento |
| --- | --- | --- | --- | --- | --- |
| M-01 | REV-REQ-007 | médio | Dedução por comparação entre consultas (filtro F e ¬F sem cruzamento; período deslizante) | Carlos Yano (decisão: aceitar o risco ou restringir período a meses fechados) | antes do IMP-004 |
| M-02 | REV-REQ-007 | médio | Aplicacao.cpf_hash não é limpo na eliminação | IA-DEV (CMP-LGPD) | IMP-004 |
| M-03 | REV-REQ-007 | médio | Valor e estado exatos dos itens sobrescritos na eliminação | IA-DEV + aprovação do responsável (CMP-LGPD) | IMP-004 |
| M-04 | REV-REQ-007 | médio | Pedido do titular sem Respondente (CPF só em aplicações em andamento ou já anonimizado) | Carlos Yano (decisão) + IA-DEV (CMP-LGPD) | antes do IMP-004 |
| M-05 | REV-REQ-007 | médio | Correções do pedido do titular sem coluna no dicionário; ENT-023.aplicacao_id NOT NULL | IA-DEV (CMP-LGPD) | IMP-004 |
| M-06 | REV-REQ-007 | médio | Formato, colunas e retenção dos arquivos de acesso, portabilidade e linha a linha | Carlos Yano (decisão) + IA-DEV (CMP-LGPD) | antes do IMP-004 |
| M-07 | REV-REQ-007 | médio | getPageImage expõe a página inteira sem reserva e em qualquer estado | IA-DEV (CMP-Upload, CMP-Revisao) | IMP-002 |
| M-08 | REV-REQ-007 | médio | Reabertura: vínculo e anonimização do respondente órfão | IA-DEV (CMP-Respondents) | IMP-003 |
| M-09 | REV-REQ-007 | médio | Regras de salto: tipos de origem, ciclos e auto-referência | IA-DEV (CMP-Forms) | IMP-002 |
| M-10 | REV-REQ-007 | médio | Tipos agregáveis, cruzáveis e filtráveis; linha de matriz na consulta e na ficha | IA-DEV (CMP-Dashboard) | IMP-004 |
| M-12 | REV-REQ-007 | médio | Desenho técnico de tenant inativo (DEC-070) no login, sessão e jobs | IA-DEV (CMP-Auth, CMP-Infra) | IMP-001 |
| M-13 | REV-REQ-007 | médio | Injeção de instrução que altera outros campos da mesma chamada; subconjunto adversarial no conjunto-ouro | IA-DEV (CMP-MotorIA) | IMP-003 |
| M-14 | REV-REQ-007 | médio | Sensibilidade identificacao em pergunta de saúde | IA-DEV (CMP-Forms) | IMP-002 |
| M-15 | REV-REQ-007 | médio | Ordem e atomicidade da eliminação (registro externo primeiro, passos idempotentes) | IA-DEV (CMP-LGPD) | IMP-004 |
| M-16 | REV-REQ-007 | médio | Imagens órfãs no bucket após restore do banco | IA-DEV (CMP-Infra) | IMP-004 |
| M-17 | REV-REQ-007 | médio | Aviso da volta de sem_assinatura para em_revisao usa ERR-018 | IA-DEV (CMP-Revisao) | IMP-003 |
| M-18 | REV-REQ-007 | médio | Ausência dos outros quatro campos obrigatórios quando ilegível, rasurado ou não se aplica | IA-DEV (CMP-Revisao) | IMP-003 |
| M-19 | REV-REQ-007 | médio | ERR-036 não cobre os casos da RN-047 | IA-DEV (CMP-Forms) | IMP-002 |
| M-20 | REV-REQ-007 | médio | Consulta à lista de senhas vazadas sem DEC, timeout e comportamento em falha | IA-DEV (CMP-Auth) | IMP-001 |
| M-21 | REV-REQ-007 | médio | findRespondent: 404 para respondente fora do escopo da concessão | IA-DEV (CMP-Dashboard) | IMP-004 |
| M-22 | REV-REQ-007 | médio | Aplicação em andamento sem cpf_hash recria titular eliminado | Carlos Yano (decisão: aceitar risco ou barrar por janela) | antes do IMP-004 |
| B-01 | REV-REQ-007 | baixo | Admin ausente do 'Quem executa' dos RF-009 e RF-010 | IA-DEV | IMP-004 |
| B-02 | REV-REQ-007 | baixo | Regras de reserva mortas e vigência implícita | IA-DEV | IMP-003 |
| B-03 | REV-REQ-007 | baixo | Trechos do PLANO §4.1, §4.5 desatualizados | IA-DEV | IMP-003 |
| B-04 | REV-REQ-007 | baixo | Inconsistências menores do contrato (exceto exemplo de campos, já corrigido) | IA-DEV | IMP-001 |
| B-05 | REV-REQ-007 | baixo | §6.5 sem createProject, createForm, createVersion | IA-DEV | IMP-002 |
| B-06 | REV-REQ-007 | baixo | AuditEvent sem detalhes; IndividualRecord sem linha_codigo | IA-DEV | IMP-004 |
| B-07 | REV-REQ-007 | baixo | Transições menores em FL-001/FL-002; obrigatorio; retryReading | IA-DEV | IMP-003 |
| B-08 | REV-REQ-007 | baixo | Destinatário do aviso sem cotação; definição de 'atingido' | IA-DEV | IMP-003 |
| B-09 | REV-REQ-007 | baixo | Unicidades omitidas no §5.3; FL-003 no checklist; FL da matriz | IA-DEV | IMP-001 |
| B-10 | REV-REQ-007 | baixo | Admin sem leitura da fila; encerrar outras sessões | IA-DEV | IMP-001 |
| B-11 | REV-REQ-007 | baixo | Risco de perda de imagens e lista de buckets | IA-DEV | IMP-001 |

## 13. Critério de prontidão e ciclo de verificação

- [x] Todo RF tem tratamento técnico identificado
- [x] Modelo físico e contrato definidos (OpenAPI é artefato irmão deste plano)
- [x] Estratégia de testes cobre todos os 47 CAs da REQ v1.8
- [x] Dependências e GX explícitas; nenhuma suposição crítica oculta (lacunas de negócio Q-005 a Q-011 respondidas e incorporadas como DEC-054 a DEC-060)
- [x] Validador de consistência sem achados (`tools/validar_consistencia.py`)
- [x] Q-005 a Q-011 respondidas
- [x] CHG-002 e CHG-003 aceitas pelo responsável
- [x] Q-012 a Q-020 respondidas; CHG-004 e CHG-005 aceitas
- [ ] Revisão independente (REV-PLANO-010) com 0 bloqueantes e 0 altos; médios e baixos registrados no §12.3 (DEC-061, DEC-073)

**Bloqueio de status:** este plano NÃO pode ser declarado PRONTO PARA IMPLEMENTAÇÃO
enquanto os itens acima não estiverem marcados.

Histórico de rodadas em `registros/revisoes.csv` (namespace REV-PLANO-xxx, distinto de REV-REQ-xxx).

---

## Bloco 2 — Matriz canônica (projeção legível)

A matriz canônica vive em `registros/matriz_rastreabilidade.csv` e é idêntica à
REQ §8.1; o CI falha se divergirem.

| Requisito | Regra | Entidade | Fluxo | História | Critério | Teste Sentinela | Operation ID | Componente | Incremento |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | RN-001, RN-003, RN-004 | ENT-002, ENT-003, ENT-014, ENT-015, ENT-022 | FL-001 | US-010 | CA-012, CA-016, CA-025, CA-035, CA-037, CA-037b, CA-038 | TS-001 | listUsers, createTenantUser, getUser, updateUser, inviteUser, resetMfa, grantIndividualAccess, listIndividualAccessGrants, revokeAccess | CMP-Auth | IMP-001 |
| RF-002 | RN-048 | ENT-002, ENT-027, ENT-028, ENT-030 | FL-001 | US-010 | CA-026, CA-026b, CA-037, CA-037b | — | login, verifyMfa, startMfaSetup, setupMfa, logout, getCurrentSession, resetPassword, confirmPasswordReset, acceptInvite | CMP-Auth | IMP-001 |
| RF-003 | RN-027 | ENT-004, ENT-020, ENT-021 | FL-001 | US-006 | CA-027 | — | listProjects, getProject, createProject, updateProject, archiveProject, unarchiveProject | CMP-Projects | IMP-002 |
| RF-004 | RN-017, RN-018, RN-019, RN-021, RN-042, RN-047 | ENT-005, ENT-006, ENT-007, ENT-008, ENT-016, ENT-024 | FL-001 | US-007 | CA-001, CA-028, CA-036 | TS-006 | listForms, createForm, getVersion, createVersion, updateVersion, publishVersion, generatePdf | CMP-Forms | IMP-002 |
| RF-005 | RN-011, RN-012, RN-014, RN-015 | ENT-009, ENT-010 | FL-001, FL-002 | US-003 | CA-002, CA-014, CA-014b, CA-032 | — | linkRespondent (interna) | CMP-Respondents | IMP-003 |
| RF-006 | RN-040 | ENT-010, ENT-011, ENT-025, ENT-029 | FL-001 | US-001 | CA-003, CA-004, CA-013, CA-029, CA-039, CA-040 | TS-002 | uploadImages, identifyApplication, addApplicationPages, getPageImage | CMP-Upload | IMP-002 |
| RF-007 | RN-021, RN-037, RN-038, RN-039 | ENT-011 | FL-001, FL-002 | US-002, US-007 | CA-005, CA-006, CA-015, CA-018, CA-019, CA-030, CA-041 | TS-003, TS-007 | processAIReading (interna), getQuotaStatus | CMP-MotorIA | IMP-003 |
| RF-008 | RN-016, RN-043, RN-044 | ENT-009, ENT-010, ENT-011, ENT-017, ENT-023 | FL-001, FL-002 | US-002, US-003, US-007 | CA-007, CA-008, CA-020, CA-021, CA-033, CA-042, CA-043, CA-044 | — | listReviewQueue, getApplication, openReview, getItemImage, saveReview, confirmApplication, attachSignaturePage, retryReading, discardApplication, reopenApplication | CMP-Revisao | IMP-003 |
| RF-009 | RN-026 | ENT-012, ENT-015 | FL-001 | US-004, US-007, US-008 | CA-009, CA-010, CA-011, CA-017, CA-021, CA-031, CA-034 | TS-004 | getDashboardAggregated, listGroups, createGroup, deleteGroup, findRespondent, getIndividualRecord | CMP-Dashboard | IMP-004 |
| RF-010 | RN-027, RN-030, RN-031 | ENT-009, ENT-013, ENT-018, ENT-019, ENT-023, ENT-026 | FL-001, FL-003 | US-005, US-009 | CA-021, CA-022, CA-023, CA-024 | TS-005, TS-008 | exportData, getExport, createDataSubjectRequest, listDataSubjectRequests, getDataSubjectRequest, executeDataSubjectRequest, cancelDataSubjectRequest, listAuditEvents | CMP-LGPD | IMP-004 |

---

## Anexo — Registro de revisões independentes do plano (namespace REV-PLANO)

| id | data | revisor | versao_revisada | achados_bloqueantes | achados_altos | achados_medios | achados_baixos | status | resolucao |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REV-PLANO-001 | 24/10/2026 | IA Revisora (Simulada) | 1.0 | 0 | 2 | 3 | 2 | Resolvido | Falta de §4.4 e §4.5; RPO/RTO não declarados; namespace colidia com REV-REQ. Resolvidos na v2.0. |
| REV-PLANO-002 | 27/10/2026 | IA Revisora (Simulada) | 2.0 | 0 | 0 | 3 | 1 | Resolvido | Errata desatualizada; RPO/RTO sem referência em §4.3; fronteira de confiança; namespace. Resolvidos na v2.1. |
| REV-PLANO-003 | 27/10/2026 | IA Revisora (Simulada) | 2.1 | 0 | 1 | 2 | 1 | Resolvido | §13 declarava PRONTO antes de revisão registrada; exceção `campo_respondente` além da REQ; CA-018/CA-019 duplicados; dicionário parcial. Resolvidos na v2.2. |
| REV-PLANO-004 | 27/10/2026 | IA Revisora (Simulada) | 2.2 | 0 | 1 | 0 | 0 | Resolvido | Alocação de CA-017, CA-021 e CA-034 divergia da matriz canônica. Corrigido na v2.3 (o CSV de incrementos não foi atualizado; ver REV-PLANO-006). |
| REV-PLANO-005 | 27/10/2026 | IA Revisora (Simulada) | 2.3 | 0 | 0 | 0 | 0 | Invalidado | O CSV registrava "Convergente" enquanto o plano dizia "Pendente"; a REV-PLANO-006 encontrou achados bloqueantes na mesma versão. |
| REV-PLANO-006 | 27/10/2026 | Claude (assistente IA; não independente) | 2.3 | 4 | n/c | n/c | n/c | Resolvido | Bloqueantes: IDs de DEC colidindo entre REQ e CSV; status da REV-PLANO-005 divergente; CSV de incrementos desatualizado; rotas públicas exigindo sessão no contrato. Também: RLS sem desenho para login e jobs, confiança e recortes indefinidos, segredo MFA enviado pelo cliente, 30 operações ausentes no contrato, CSVs corrompidos e nomes de arquivo com caixa errada. Corrigidos na v2.4. |
| REV-PLANO-007 | 28/10/2026 | Agente revisor-independente (IA, outro modelo, contexto isolado, somente leitura) | 2.5 | 2 | 10 | 17 | 5 | Resolvido | Achados em conjunto com a REV-REQ-005 (lista de eliminações no banco restaurado; nulidade na criação da aplicação; entidades faltantes; autorização sem 403; histórico de atributos sem entidade; oasdiff declarado e ausente; RLS sem WITH CHECK; imutabilidade da auditoria sem mecanismo). Corrigidos na v2.6. |
| REV-PLANO-008 | 28/10/2026 | Agente revisor-independente (IA, outro modelo, contexto isolado, somente leitura) | 2.6 | 2 | 7 | 19 | 6 | Resolvido | Em conjunto com a REV-REQ-006: matriz de autorização contraditória (linhas por RF); resolução de sessão sob RLS sem desenho; ordem de validação do upload; versionamento do bucket de imagens; corpo da resposta guardado na idempotência; IDs de outro recurso pai no corpo. Corrigidos na v2.7. |
| REV-PLANO-009 | 28/10/2026 | Agente revisor-independente (IA, outro modelo, contexto isolado, somente leitura) | 2.8 | 0 | 1 | 22 | 11 | Resolvido | Em conjunto com a REV-REQ-007: alto da DEC-071 corrigido na v2.9; constraint de parametro_configuracao alinhada; médios e baixos no §12.3. |
| REV-PLANO-010 | 28/10/2026 | Agente revisor-independente (verificação) | 2.9 | — | — | — | — | Pendente | Verificar a correção do alto da REV-PLANO-009. |

---

**Fim do documento `PLANO.md` v2.9**
