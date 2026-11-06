<!-- markdownlint-disable MD013 -->

# PLANO.md — MinhaPesquisa

**Plano técnico e de incrementos · Fase 3 (cty-arq)**
**Fontes normativas:** REQ v2.7 (CHG-011 propagada no IMP-005; CHG-012 aceita em 04/11/2026; CHG-013 a CHG-016 aceitas em 05/11/2026; CHG-017 proposta em 06/11/2026) · docs/spec/BLOCO_P.md · Kit v3
**Nível de rigor:** Completo
**Responsável:** Carlos Yano
**Versão do plano:** 3.17
**Status:** REV-PLANO-010 aprovada pelo critério da DEC-073 (0 bloqueantes, 0 altos); CHG-006 e CHG-007 aceitas em 29/10/2026; IMP-001 aceito pelo responsável em 29/10/2026 (Gate 2), com o E2E com navegador pendente (§11); v2.13 alinha o processo ao kit v3 (DEC-092); v2.14 incorpora a CHG-009 (DEC-093 a DEC-100) para o IMP-002; v2.15 registra as decisões do IA-DEV do IMP-002 (DEC-101 a DEC-103) e o aceite do IMP-002 (Gate 2, 03/11/2026); v2.16 registra o modo de demonstração local (DEC-104); v2.17 incorpora a CHG-010 (CPF com uma caixa por dígito, DEC-105 e DEC-106); v3.0 incorpora a CHG-011 (aplicação local num notebook, DEC-107 a DEC-112 e DEC-117 na REQ e DEC-113 a DEC-116) e cria o IMP-005; v3.1 propaga a CHG-011 às seções 3 a 11 e ao contrato (OpenAPI 0.3.0); v3.2 registra os adaptadores locais do IMP-005 (DEC-118) e encerra a propagação da CHG-011; v3.3 incorpora a CHG-012 (DEC-119 da REQ e DEC-120 a DEC-122); v3.4 registra o aceite do IMP-005 (Gate 2, 04/11/2026); v3.5 registra a decisão de testes do IA-TEST do IMP-003 (DEC-123); v3.6 registra as decisões do IA-DEV do IMP-003 (DEC-124); v3.7 amplia o modo de demonstração com a leitura por IA e a revisão (DEC-125); v3.8 incorpora a CHG-013 (revisão focada do IMP-003: DEC-126 a DEC-129 e a Q-036, aberta, na REQ; DEC-130 e DEC-131); v3.9 registra o aceite do IMP-003 (Gate 2, 05/11/2026); v3.10 incorpora a CHG-014 (importação de formulário: DEC-132 a DEC-139 e DEC-143 a DEC-149 na REQ; DEC-140 a DEC-142) e cria o IMP-006, feito antes do IMP-004; v3.11 registra as decisões do IA-DEV do IMP-006 (DEC-150 e DEC-151); v3.12 registra o aceite do IMP-006 (Gate 2, 05/11/2026); v3.13 incorpora a CHG-015 (exportação em formato longo: DEC-153 a DEC-163 na REQ; DEC-164 e DEC-165) e cria o IMP-007, feito antes do IMP-004; v3.14 incorpora a CHG-016 (apóstrofo contra fórmulas só no CSV, DEC-166 na REQ); v3.15 registra as decisões do IA-DEV do IMP-007 (DEC-167); v3.16 guarda os dados do modo de demonstração entre execuções (DEC-168); v3.17 incorpora a CHG-017 (pesquisas sem QR e localização das perguntas pela IA: DEC-169 a DEC-173 e, das Q-063 a Q-065, DEC-175 a DEC-177 na REQ; DEC-174) e cria o IMP-008
**Precedência:** decisões de negócio aprovadas → REQ aprovada → decisões técnicas e este plano → Bloco P → recomendações da IA.
**Este plano não altera regra de negócio.** Lacunas de negócio são registradas como Q na REQ e só entram no plano depois de respondidas.

---

## 1. Objetivo e limites

Aplicação local, num notebook de uma única usuária (DEC-107), que digitaliza pesquisas em
papel do público 60+, lê campos por IA, exige revisão humana quando necessário e produz
dashboards e exportações, com LGPD desde o banco de dados.

**Dentro:** projetos, formulários/versões, importação de formulário por IA (CHG-014), PDF com QR, upload, leitura IA, revisão,
respondente por CPF, dashboards, exportação, direitos do titular, auditoria.

**Fora (v2):** editor visual de layout, biblioteca de perguntas, importação de
Forms/XLSForm, SPSS/R, permissão por linha, gestão de tenants por tela, cobrança.

**Restrições inegociáveis:** dados guardados só no notebook, com disco cifrado (DEC-107);
nenhum dado real em desenvolvimento enquanto GX-001 estiver pendente (Q-001).

**Mudança da v3.0 (CHG-011):** o produto passa a ser uma aplicação local num notebook Windows, de uma
única usuária (DEC-107 a DEC-112 da REQ). Saem a nuvem (DEC-113), a gestão de chaves em nuvem (DEC-114), o
ClamAV (DEC-115), vários tenants na prática (DEC-116), MFA, e-mail, perfis, concessões e k-anonimato. A v3.1
propaga a mudança às seções 3 a 11; o código e os testes seguem no IMP-005 (§11).

---

## 2. Stack e estrutura do monorepo (DEC-037)

Node.js 24 · TypeScript strict · NestJS + Fastify · Next.js + React + Tailwind +
shadcn/ui · PostgreSQL 17 + Drizzle + migrações SQL explícitas · Outbox + fila em tabela própria (DEC-124) ·
npm workspaces. Testes: Vitest, Testcontainers, Playwright + axe, Schemathesis,
fast-check, Stryker (escopo da DEC-052). CI GitHub Actions: Semgrep (DEC-089), gitleaks, SBOM.

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

A leitura da estrutura de um formulário importado (RN-049) conhece o que é um formulário de
pesquisa e por isso não entra no motor: fica no extrator de estrutura do worker, atrás da
própria interface (DEC-141).

---

## 3. Componentes (CMP) e responsabilidades

| CMP | Responsabilidade | RF | Principais operationIds |
| --- | --- | --- | --- |
| CMP-Auth | senha local, sessão, instalação e redefinição de senha por script (DEC-108) | RF-001, RF-002 | login, logout, getCurrentSession, installLocalAccount (script), resetLocalPassword (script) |
| CMP-Projects | projetos, parâmetros, ciclo de vida | RF-003 | listProjects, getProject, createProject, updateProject, archiveProject, unarchiveProject |
| CMP-Forms | versões imutáveis, perguntas, regras de salto, PDF e mapa de layout; campos obrigatórios padronizados (RN-050) e importação de formulário (RN-049, DEC-141) | RF-004, RF-011 | listForms, createForm, getVersion, createVersion, updateVersion, publishVersion, generatePdf, importForm, listFormImports, getFormImport, extractFormStructure (worker) |
| CMP-Upload | validação, antimalware, metadados, QR ou versão escolhida no envio (DEC-169), storage | RF-006, RF-013 | uploadImages, identifyApplication, addApplicationPages, getPageImage |
| CMP-MotorIA | localização das perguntas (RN-052, DEC-174), recorte pelas regiões, chamada ao provedor, confiança, cota | RF-007, RF-013 | processAIReading (worker), getQuotaStatus |
| CMP-Respondents | unicidade por CPF, vínculo, criação, reversão | RF-005 | linkRespondent (interno) |
| CMP-Revisao | fila, revisão (sem reserva, DEC-112), conclusão, assinatura, descarte, reabertura | RF-008 | listReviewQueue, getApplication, openReview, getItemImage, saveReview, confirmApplication, attachSignaturePage, retryReading, discardApplication, reopenApplication |
| CMP-Dashboard | agregação, grupos dinâmicos, ficha (sem k-anonimato, DEC-110) | RF-009 | getDashboardAggregated, listGroups, createGroup, deleteGroup, findRespondent, getIndividualRecord |
| CMP-LGPD | exportação (inclusive o formato longo, RN-051), pedidos do titular, expurgo, portabilidade, auditoria | RF-010, RF-012 | exportData, getExport, createDataSubjectRequest, listDataSubjectRequests, getDataSubjectRequest, executeDataSubjectRequest, cancelDataSubjectRequest, listAuditEvents |
| CMP-Infra | PostgreSQL local, pasta de imagens, chave pelo DPAPI, filas, backup, CI (DEC-113, DEC-114, DEC-117) | todos | — |

---

## 4. Fluxos críticos

### 4.1 Upload → leitura → revisão → conclusão

- Ordem de validação de cada arquivo (DEC-042), parando no primeiro motivo: (1) tamanho ≤ 20 MB, verificado durante o recebimento; (2) antimalware (Microsoft Defender, DEC-115) sobre todo arquivo; (3) tipo por assinatura de conteúdo (magic bytes), não pelo MIME declarado — JPEG, PNG ou PDF; (4) ≤ 50 páginas (DEC-029). Recusa → ERR-029 com o motivo exato.
- Remoção de metadados EXIF/GPS (sharp) antes do storage (DEC-042).
- Pasta de imagens privada no notebook (DEC-113). As imagens entram no backup diário cifrado (DEC-118); depois do expurgo físico (RN-030), a cópia nos backups some pela retenção de 90 dias (DEC-033), e uma restauração reaplica as eliminações (DEC-062).
- QR validado contra tenant + projeto + versão + página; sem QR legível, vale a versão escolhida no envio, validada como no `identifyApplication` (DEC-100, DEC-169). Os marcadores só são registrados (`registro_ok`), sem barrar a leitura. Estado inicial pela tabela de criação da FL-001 (ERR-004, ERR-039, ERR-003).
- Imagem gravada na pasta privada; acesso apenas por link assinado de 5 min, servido só em 127.0.0.1 (DEC-034, DEC-113), entregue por `getItemImage`.
- Outbox registra `leitura.solicitada` na mesma transação.
- Worker localiza cada página primeiro (DEC-174): página inteira e perguntas da versão → número da página e regiões, sem valores; depois confere as páginas (RN-052) e lê em recortes dessas regiões; identificação e saúde em chamadas separadas, sem identificador do respondente (DEC-022, RN-038, RN-039).
- Antes de cada chamada, reserva atômica de orçamento (DEC-051); sem reserva → `aguardando_cota`.
- Saída validada contra schema; estado de cada item pela ordem de avaliação da FL-002 (REQ §6.4). Pontos de atenção:
  - Confiança comparada no valor bruto; **estritamente maior** que o limite confirma (0,90 exato vai para `a_revisar` — CA-005, CA-006, TS-003). Até a calibração no conjunto-ouro o limite padrão é 1,00 e nada é confirmado automaticamente (DEC-127).
  - CPF sempre revisável (RN-012); valor fora do schema sempre revisável (CA-006); `texto_livre` sempre revisável (DEC-057).
  - Regra de salto com origem em `pendente_leitura`, `aguardando_condicao` ou `a_revisar` → `aguardando_condicao` (FL-002 regra 1, CA-018); origem em `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica` segue as regras 4 e 4a.
- Revisão humana sem reserva (DEC-112) e com ETag/If-Match obrigatório (RN-043).
- Conclusão (`confirmApplication`) exige os 5 campos da DEC-020 e assinatura presente (RN-044), exceto CPF, data de nascimento e assinatura na versão de papel antigo (DEC-172, DEC-176; sem CPF, a usuária escolhe o respondente de mesmo nome ou um novo); vínculo por CPF é feito aqui — CPF existente vincula, CPF novo cria respondente (CA-014b). Divergência de cadastro: o digitalizador escolhe o valor (CA-014).
- Falta de campo obrigatório → ERR-006 (CPF ausente/inválido → `aguardando_cpf`).

### 4.2 Falha e cota

Timeout e retentativas conforme tabela abaixo. Após 3 falhas consecutivas em chamada idempotente → `erro_leitura` (ERR-041). Cota mensal atingida → `aguardando_cota` (ERR-003) + aviso na tela (`getQuotaStatus`), sem e-mail (CHG-011); nada é descartado (DEC-035). Período e conversão de moeda: DEC-058.

#### 4.2.1 Tabela de timeouts por operação

| Operação | Timeout | Retentativa | Estado final de falha | Referência |
| --- | --- | --- | --- | --- |
| Chamada ao provedor de IA (leitura de recorte) | 30 s | 1, 2 s (só idempotente; 3 chamadas no total, DEC-129) | `erro_leitura` após 3 falhas (ERR-041) | RF-007, CA-041, P.7 |
| Chamada ao provedor de IA (estrutura de uma página na importação, DEC-141) | 60 s | 1, 2 s (3 chamadas por página no total) | importação em `falhou` (ERR-044) | RF-011, CA-047 |
| Gravação e leitura na pasta local de imagens (DEC-113) | 30 s | 1, 2, 4 s | ERR-020; nada é gravado | RF-006, CA-029 |
| Job de exportação (CSV/XLSX) e PedidoTitular | 60 s | sem retentativa automática (job enfileirado) | PedidoTitular em `falhou` (FL-003), com auditoria e alerta; exportação em `falhou` | RF-010, RF-012, CA-022, CA-024 |
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

**Vínculo com continuidade (§9.2):** a reaplicação da eliminação após restore é obrigatória no runbook, sempre a partir do registro externo (DEC-120) e antes de reabrir o banco ao tráfego, cobrindo a janela de RPO de 24 h e a retenção de backup de 90 dias (DEC-033). O teste de restauração (TS-008 + restore) é mensal, no próprio notebook (DEC-117, DEC-121), e mede a duração da restauração contra o RTO de 1 dia útil.

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

### 4.5 Instalação e redefinição de senha (CA-035, CA-037, DEC-108)

O script de instalação roda no notebook, com o PostgreSQL local já instalado: aplica as
migrações, gera a chave mestra e a guarda pelo DPAPI (DEC-114), cria o único tenant (DEC-116)
e a conta da usuária com a senha digitada no terminal (Argon2id, regras da RN-048). Se o tenant
já existir, recusa sem alterar nada. O script de redefinição troca a senha, encerra todas as
sessões e audita com acao=REDEFINICAO_SENHA, sem a senha. Nenhum dos dois imprime dado pessoal.

### 4.6 Login (DEC-108)

1. `login` (rota pública) valida e-mail e senha. Falha → ERR-013; 5 falhas em 15 min para o mesmo e-mail (exista ou não a conta, contadas pelo HMAC do e-mail) → ERR-014.
2. Sucesso cria a sessão plena direto, sem MFA nem pré-sessão (30 min de inatividade, 24 h no máximo). Com 3 sessões ativas, a nova é recusada com ERR-021 (Bloco P P.2).
3. As colunas e tabelas de MFA, convites e tokens ficam no banco sem uso (DEC-116); a pré-sessão deixa de existir.

### 4.7 Papéis de banco e RLS fora da requisição (DEC-046)

| Contexto | Papel | Como obtém o tenant |
| --- | --- | --- |
| Resolução da sessão (toda requisição autenticada) | função `SECURITY DEFINER` `resolver_sessao(hash_do_cookie)` com `search_path` fixo, que devolve só `(tenant_id, usuario_id, tipo, expira)` e renova a atividade | a própria função |
| Requisição autenticada | `mp_app` (sujeito a RLS com FORCE) | resultado de `resolver_sessao` → `SET LOCAL app.tenant_id` na transação; escritas em Sessao (logout, encerramento de sessões) seguem pela RLS |
| Login e tokens públicos | função `SECURITY DEFINER` com `search_path` fixo, que só busca por HMAC de e-mail/token e devolve o mínimo | não precisa; a função devolve o tenant do usuário |
| Job do worker por aplicação ou por importação de formulário | `mp_app` | job carrega `tenant_id`; worker faz `SET LOCAL` antes de qualquer consulta |
| Jobs agendados (expurgo, virada de cota, reaplicação de eliminações) | `mp_manutencao` (BYPASSRLS), só no processo de jobs agendados | itera tenants explicitamente; cada ação é auditada |
| Migrações | `mp_owner` (dono das tabelas; nunca usado pela aplicação) | — |

Sem `app.tenant_id` definido, `current_setting('app.tenant_id', true)` é NULL e as
policies não devolvem nada (falha fechada). Tabelas da fila (`tarefa_leitura`, DEC-124; `tarefa_importacao`, DEC-142) e do outbox não
guardam dado pessoal; o payload carrega apenas IDs. A `tarefa_importacao` guarda também a estrutura lida
da página do modelo, que não tem dado pessoal (DEC-133).

---

### 4.8 Importação de formulário (RF-011, DEC-142)

- `importForm` valida, na ordem, o projeto ativo (DEC-146), a declaração `sem_dados_reais` (ERR-001) e cada arquivo como no §4.1 (tamanho, antimalware, tipo por assinatura, páginas), mais o total de 50 páginas no envio (ERR-029). Metadados removidos (DEC-042). Os arquivos vão para a pasta privada em `tenant/<tenant>/importacao/<importação>/`, fora das pastas de aplicação.
- A ImportacaoFormulario nasce `enfileirada`, com uma linha em `tarefa_importacao` por página, na mesma transação do outbox. O worker processa essas tarefas com o mesmo relógio, as mesmas retentativas e a mesma reserva de custo da `tarefa_leitura` (DEC-051, DEC-124, DEC-129, DEC-130 (1)); teto atingido → `aguardando_cota` (FL-004).
- Cada página vai inteira ao extrator (DEC-141), reduzida para no máximo 2000 px no lado maior. A saída é validada contra o schema da estrutura (RN-037) e gravada em `tarefa_importacao.resultado`; saída fora do schema conta como falha da chamada, como na leitura. A 3ª falha de uma página cancela as tarefas restantes, libera as reservas não usadas e leva a importação a `falhou` (ERR-044).
- Com todas as páginas lidas, uma só transação aplica a RN-049 e a RN-050 sobre os resultados, cria Formulario, Versao 1 em `rascunho`, Pergunta, Opcao e LinhaMatriz, grava os avisos, marca `concluida` e audita (`IMPORTACAO_FORMULARIO`, só com IDs e contagens). Não há formulário parcial.
- Altura das perguntas: a mesma medida dos blocos do PDF (`apps/api/src/formularios/pdf.ts`) serve à distribuição em páginas da importação (RN-049) e à verificação de que a pergunta cabe na página na gravação e na publicação (DEC-143). Sai de `pdf.ts` para um módulo compartilhado por API e worker.
- Os arquivos e as tarefas da importação são apagados ao fim, em `concluida` ou `falhou`, e `chave_storage` vira NULL; o job diário de expurgo apaga os que sobrarem de importações terminadas.
- Logs e auditoria nunca trazem enunciados nem texto lido (RN-028).

### 4.9 Exportação em formato longo (RF-012, DEC-165)

- `exportData` valida o corpo (com `linha_por_item`, `filtros` → ERR-001, DEC-163) e os projetos (ERR-002), grava a Exportacao `enfileirada` e enfileira o job na mesma transação (outbox, DEC-124). No IMP-007, `agregado` e `linha_a_linha` são recusados com ERR-001 (`campos`: `escopo`) até o IMP-004 (DEC-164).
- O worker marca `em_andamento`, lê as aplicações da RN-051 numa só transação, monta as linhas na ordem da RN-051, neutraliza as células de texto (no CSV com apóstrofo; no XLSX como célula de texto, nunca fórmula, DEC-166) e grava o arquivo pela interface Armazenamento (DEC-101, DEC-113) em `tenant/<tenant>/exportacao/<exportação>.<formato>`. Conclui com `concluida`, `expira_em` = conclusão + `retencao_exportacao_dias` e a auditoria; erro ou 60 s → `falhou`, sem arquivo (§4.2.1).
- O CPF e os itens cifrados (`campo_respondente` e tipo `cpf`, DEC-131 (1)) são decifrados só no worker, em memória; logs e auditoria trazem só IDs e contagens (RN-028).
- `getExport` devolve o link assinado local de 5 min (RNF-007) só com `concluida` e antes de `expira_em`. O job diário apaga os arquivos com `expira_em` vencido e grava `chave_storage` NULL (DEC-069).

## 5. Modelo de dados físico

### 5.1 Convenções

- Tabelas correspondem a ENT-001 a ENT-031, em `snake_case`, mais as filas internas `tarefa_leitura` (DEC-124) e `tarefa_importacao` (DEC-142).
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
| tarefa_importacao | (importacao_id, pagina) |

Checks de aplicação (ENT-010): `estado IN ('identificacao_pendente', 'descartada') OR versao_id IS NOT NULL` (a aplicação descartada antes da identificação fica sem versão; DEC-131); `estado NOT IN ('sem_assinatura','concluida') OR (data_aplicacao IS NOT NULL AND local_aplicacao IS NOT NULL)`.

Checks: `ck_respondente_anonimizacao`: `anonimizado OR (cpf_cifrado IS NOT NULL AND cpf_hash IS NOT NULL AND data_nascimento IS NOT NULL)`.
As tabelas `usuario_perfil`, `vinculo_usuario_projeto`, `concessao_acesso_individual`, `reserva_aplicacao` e `token_uso_unico` ficam sem uso a partir da v3.1 (DEC-116).

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
Idempotency-Key obrigatória nas mutações críticas (REQ §6.5); dedupe por `(aplicacao_id, pagina)` no worker e por `(importacao_id, pagina)` na importação.
Sem reserva de aplicação (DEC-112); ETag/If-Match obrigatório em edições.
Retenção por tenant (`retencao_dias`, DEC-059); backups ≤ 90 dias (DEC-033); expurgo ≤ 30 dias; lista de
eliminações por 180 dias reaplicada após restauração de backup.

---

## 6. Contrato da API (contract-first, DEC-049)

`contracts/openapi.yaml` é a fonte de validação de requisição e resposta; schemas com
`additionalProperties: false` e `required` declarados. Erros em Problem Details
(RFC 9457), catálogo ERR fechado, `X-Correlation-ID` em todas as respostas.
Rate limit: 100 req/min/usuário; 20 req/min/IP em rotas públicas (ERR-010); 429 declarado em todas as operações.
Rota pública (sem sessão): `login`. A API escuta só em 127.0.0.1 (DEC-113).
Sessão em banco, cookie httpOnly + SameSite, CSRF double-submit em toda mutação autenticada; sem MFA (§4.6, DEC-108).
Rotas e operationIds conforme §3; operações internas do worker não são endpoints.
Paths em inglês; campos e mensagens em português. Lint (Spectral) no CI desde a fundação; quebra de compatibilidade (oasdiff) entra no CI no IMP-001, junto com o primeiro código.

### 6.1 Autorização por perfil

Com uma única usuária (DEC-109), não há perfis: toda operação é permitida a quem tem sessão.
Ordem de verificação:
1. Sem sessão → 401 ERR-015; mutação sem CSRF válido → 403 ERR-016.
2. Recurso de outro tenant (inclusive IDs no corpo) → 404 ERR-002 (RN-002; um tenant só, defesa em profundidade, DEC-116).
3. Estado que não admite a ação → 409 ERR-018 (FL-001).

| Operações | usuária |
| --- | --- |
| RF-002 (auth) | sim |
| RF-003, RF-004, RF-006, RF-007, RF-008, RF-009, RF-010, RF-011, RF-012 | sim |

As tabelas de perfis ficam no banco sem uso (DEC-116); o código de autorização por perfil sai no IA-DEV do IMP-005.

---

## 7. Assíncronos e integrações

Outbox transacional + fila em tabela própria (DEC-124); nenhuma mutação crítica depende de chamada síncrona externa.
`ReadEngine` atrás de interface (DEC-043); adaptador mock enquanto GX-001 pendente.
Confiança: definição e calibração na DEC-047. Recortes: regiões da localização (DEC-174); o `mapa_layout` da DEC-048 fica só no PDF.
Provedor real escolhido no conjunto-ouro (§10.1); troca sem retrabalho no produto.
Sem e-mail (DEC-112): avisos de cota só na tela.
Medidor de custo de IA por página/tenant com reserva atômica de orçamento (DEC-051); alerta e fila ao atingir o teto.

---

## 8. Análise de ameaças (nível Completo)

| ID | Ameaça | Controle | Verificação |
| --- | --- | --- | --- |
| T-01 | Acesso entre tenants | FK composta + RLS + 404 + papéis (DEC-046) | TS-001 + contrato |
| T-02 | Injeção de instrução pela imagem | Validar saída contra schema; IA sem ações | Fixtures de injeção no mock do ReadEngine (IMP-003) e no extrator simulado da importação (IMP-006) |
| T-03 | Erro silencioso da IA | Conjunto-ouro; meta ≤ 0,5% (DEC-004) | Medição por mudança de modelo (§10.1) |
| T-04 | Dado sensível em log | Allowlist de campos; mascaramento | Teste que varre logs |
| T-05 | GPS/EXIF nas fotos | Remoção no ingresso | Teste de integração do upload (IMP-002) |
| T-06 | Transferência internacional sem base | GX-001; sintéticos até aprovação | Evidência contratual |
| T-07 | Sequestro de sessão / CSRF | API só em 127.0.0.1, cookie httpOnly, double-submit, bloqueio por tentativas; sem MFA (DEC-108), compensado pelo login do Windows e pelo BitLocker | Testes de autenticação |
| T-08 | Roubo ou perda do notebook | BitLocker obrigatório; backup cifrado fora do notebook (DEC-117); chave mestra pelo DPAPI (DEC-114) | Verificação na instalação + teste de restauração |
| T-09 | Reidentificação por filtro em painel ou planilha compartilhada | Risco aceito: sem k-anonimato (DEC-110); a usuária responde pelo que compartilha | — |
| T-10 | Replay / clique duplo | Idempotência obrigatória + dedupe | Testes de concorrência |
| T-11 | Cadeia de suprimentos | SBOM, gitleaks, Semgrep (DEC-089), deps | CI bloqueante |
| T-12 | Backup ressuscita eliminados | Registro externo de eliminações (DEC-062) + reaplicação antes de reabrir o banco | TS-008 + restore com backup anterior à eliminação |
| T-13 | Esgotamento de cota | Teto + reserva atômica + fila sem descarte | TS-007 |
| T-14 | QR forjado / de outro tenant | Validação tenant+projeto+versão; QR com identificador opaco | Teste de integração do upload (IMP-002) |
| T-15 | Correlação de CPF entre tenants | HMAC com chave por tenant (DEC-041) | Teste unitário: mesmo CPF, tenants distintos, hashes distintos |
| T-16 | Função SECURITY DEFINER abusada | Função mínima, search_path fixo, sem SQL dinâmico | Teste de integração com papel `mp_app` |
| T-17 | Página inteira no provedor de IA na localização (Risco 3 da REQ) | Resposta só com página, confiança e regiões, recusada com qualquer texto (DEC-174); recortes de identificação e saúde separados e sem sobreposição (RN-052); provedor sem retenção (RN-032); dados reais só com o GX-001 | Testes do IMP-008 com o adaptador simulado (CA-055) |

---

## 9. Operação

### 9.1 Ambiente local (DEC-113, substitui a DEC-038)

Notebook Windows 11 com BitLocker, PostgreSQL 17 local, API e interface só em 127.0.0.1,
imagens em pasta local, chave mestra pelo DPAPI (DEC-114), Microsoft Defender no upload
(DEC-115). A única saída de rede é a chamada ao provedor de IA, com TLS 1.2+ (DEC-111).
Sem Terraform, KMS, S3 nem e-mail.

### 9.2 Continuidade (DEC-039)

- **RPO:** 24 h
- **RTO:** 1 dia útil (reinstalar num notebook e restaurar)
- **Backup:** diário, cifrado, em disco externo guardado longe do notebook, com o banco, as imagens e a cópia cifrada da chave (DEC-117, DEC-114); retenção máxima de 90 dias (DEC-033)
- **Restauração testada:** todo mês (DEC-117), com runbook que inclui a reaplicação obrigatória de eliminações a partir do registro externo (DEC-062)
- **Métricas e alertas:** idade do último backup bem-sucedido, duração do restore, taxa de sucesso da reaplicação de eliminações
- **Referências normativas:** P.13 (Bloco P), DEC-033, TS-008

### 9.3 Observabilidade

Logs estruturados com correlação; métricas de custo IA/página, p95 de leitura,
profundidade da fila e idade do último backup; avisos na tela de cota, falha de leitura,
falha do job de expurgo e backup atrasado.

### 9.4 CI/CD e rollback

validador de consistência → typecheck → lint → unit → contrato (Spectral + oasdiff)
→ integração (Testcontainers) → E2E + axe → mutação (DEC-052) → Semgrep (DEC-089) → gitleaks → SBOM.
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
| Painéis e exportações sem ocultação (DEC-110) | integração | Testcontainers | RNF-004, CA-009 |
| Eliminação + reaplicação em restore | integração + E2E | Testcontainers + Playwright | TS-005/TS-008 |
| Imutabilidade | integração | Testcontainers | TS-006, CA-001 |
| Cota IA | integração | mock do medidor | TS-007, CA-030 |
| Erro silencioso | conjunto-ouro | gabarito humano | DEC-004 |
| Acessibilidade | E2E | Playwright + axe | RNF-012 |
| Gravação concorrente (duas abas) | integração | requisições paralelas | RN-043, ERR-017 |
| Autenticação, instalação e redefinição de senha | E2E + integração | Playwright + Testcontainers | CA-026, CA-035, CA-037 |
| Vínculo de respondente (novo/existente) | integração | Testcontainers | CA-002, CA-014, CA-014b |
| Reabertura com reversão | integração | Testcontainers | CA-042 |
| Dashboard com gráfico cruzado | integração | Testcontainers | CA-017 |
| Assinatura ausente fora de relatórios/exportações | integração + E2E | Testcontainers + Playwright | CA-021 |
| Importação de formulário (códigos, campos padronizados, cota, falha) | unidade + integração | Vitest + Testcontainers + extrator simulado | CA-045 a CA-048, RN-049, RN-050, FL-004 |

### 10.1 Conjunto-ouro (DEC-004, DEC-047, DEC-056)

- Origem: formulários preenchidos à mão por voluntários 60+ com dados fictícios, sob termo de participação próprio (DEC-056).
- Tamanho mínimo por tipo de pergunta: para afirmar erro silencioso ≤ 0,5% com 95% de confiança sem nenhum erro observado, são necessários **pelo menos 600 campos autoconfirmados** por tipo (regra dos três: 3/n ≤ 0,005). Com erros observados, o tamanho é recalculado pelo limite superior de Clopper-Pearson.
- Gabarito com dupla digitação humana e arbitragem das divergências.
- Saídas: escolha do provedor e do método de confiança, calibração do `limite_confianca` (DEC-028 é provisória) e relatório versionado em `docs/`.

### 10.2 Infraestrutura de teste determinístico

- Relógio e gerador de IDs injetáveis (sessão, bloqueio por tentativas, links assinados).
- Gerador de CPF válido e lista de CPFs inválidos de referência.
- Arquivo de teste EICAR puro (68 bytes) enviado com extensão .png e MIME image/png; EICAR embutido num PNG válido não é detectado.
- Mock do ReadEngine com fixtures: confiança abaixo, igual (0,90) e acima do limite; saída malformada; valor fora do schema; imagem com instrução injetada; timeout e erro.
- Extrator de estrutura simulado (DEC-141), programado por página: perguntas de cada tipo, `campo_padrao` repetido, matriz mais alta que uma página, saída malformada, página com instrução injetada, timeout e erro.
- Dados 100% sintéticos (Q-001).

### 10.3 Test-First com IA (DEC-053)

IA-TEST escreve testes vermelhos a partir da REQ, em PR próprio, aprovado pelo
responsável. IA-DEV implementa em outro PR, sem alterar os testes aprovados (checagem
no CI + CODEOWNERS). Todo teste com `// @trace <IDs>` para RF/RN/CA/TS. A matriz é
validada a cada merge.

---

## 11. Incrementos

| IMP | Escopo | CAs cobertos | Entrada | Saída / evidência esperada | Status |
| --- | --- | --- | --- | --- | --- |
| IMP-001 | Repo, CI, banco com RLS e papéis, auth + MFA, usuários, perfis, vínculos e concessões, esqueleto do contrato | CA-012, CA-026, CA-035, CA-037 | Gate 1 aprovado; REQ e Bloco P no repo | CI verde; TS-001 passando nas operações existentes; migração aplicada em PG17; E2E de login com MFA e reset de MFA | aceito (Gate 2, 29/10/2026; E2E com navegador pendente) |
| IMP-002 | Projetos, formulários/versões, PDF/QR com mapa de layout, pipeline de upload, regras de salto | CA-001, CA-003, CA-004, CA-013, CA-027, CA-028, CA-029, CA-036, CA-039, CA-040 | IMP-001 aceito | TS-002 e TS-006; PDF imprimível; metadados removidos; regra de salto avaliada | aceito (Gate 2, 03/11/2026; E2E com navegador pendente) |
| IMP-005 | Simplificação para a aplicação local (CHG-011): propagar a DEC-107 a DEC-116 à REQ, à matriz, ao contrato e aos testes; retirar MFA, convite, e-mail, perfis, vínculos e concessões; armazenamento em disco local (DEC-113), chaves locais (DEC-114), Microsoft Defender (DEC-115), um tenant fixo criado na instalação (DEC-116); scripts de instalação, de recuperação de senha e de backup diário cifrado (DEC-117) | CA-012, CA-026, CA-035, CA-037 | IMP-002 aceito | CI verde; instalação do zero num notebook Windows limpo; backup e restauração testados; regressão do IMP-001 e do IMP-002 sem MFA | aceito (Gate 2, 04/11/2026) |
| IMP-003 | Motor IA isolado, registro da imagem, leitura, cota, revisão, vínculo por CPF, reabertura | CA-002, CA-005, CA-006, CA-007, CA-008, CA-014, CA-014b, CA-015, CA-018, CA-019, CA-020, CA-021, CA-030, CA-032, CA-033, CA-041, CA-042, CA-044 | IMP-002 e IMP-005 aceitos | TS-003 e TS-007; FL-001/FL-002 cobertas; vínculo novo/existente; reversão na reabertura; fronteira 0,90 em `a_revisar` | aceito (Gate 2, 05/11/2026; E2E com navegador e conjunto-ouro pendentes) |
| IMP-006 | Importação de formulário (CHG-014): extrator de estrutura com adaptador Claude e simulado (DEC-141), job por página com cota e retentativas, códigos e páginas pela RN-049, campos obrigatórios em todo rascunho novo (RN-050), dados do ciclo de coleta no projeto (DEC-137), contrato `importForm`, `listFormImports` e `getFormImport` | CA-045, CA-046, CA-047, CA-048, CA-049 | IMP-003 aceito | CI verde; importação de um formulário sintético de 2 páginas no modo de demonstração; regressão do IMP-002 e do IMP-003 com os campos injetados | aceito (Gate 2, 05/11/2026) |
| IMP-007 | Exportação em formato longo (CHG-015): `exportData` e `getExport` com escopo `linha_por_item` (RN-051), job da exportação em CSV e XLSX (DEC-165), neutralização de fórmulas (DEC-166), job diário que apaga os arquivos de exportação vencidos (DEC-069) | CA-021, CA-050, CA-051 | IMP-006 aceito | CI verde; exportação de dados sintéticos no modo de demonstração aberta no Excel; regressão do IMP-002, do IMP-003 e do IMP-006 | planejado |
| IMP-008 | Pesquisas sem QR e localização pela IA (CHG-017): `versao_id` no `uploadImages` e `origem_qr` (DEC-169), operação `localizar` do `ReadEngine` com adaptador Claude e simulado e schema fechado (DEC-174), páginas pela localização (DEC-171), recortes pelas regiões, `Versao.papel_antigo` (DEC-175) e conclusão sem CPF, data de nascimento e assinatura, com vínculo pelo nome (DEC-172, DEC-176), item sem região (DEC-177), escolha da versão na tela de upload da demonstração | CA-052, CA-053, CA-054, CA-055 | CHG-017 aceita; IMP-007 aceito | CI verde; papel antigo sintético por scanner e por foto, fora de ordem, lido no modo de demonstração; regressão do IMP-002, do IMP-003, do IMP-006 e do IMP-007 | planejado |
| IMP-004 | Dashboards, grupos, exportação, direitos do titular (inclusive de respondente sem CPF, DEC-176), auditoria | CA-009, CA-011, CA-017, CA-021, CA-022, CA-023, CA-024, CA-031 | IMP-003, IMP-006 e IMP-007 aceitos | TS-004/TS-005/TS-008; expurgo reaplicável após restore; gráfico cruzado; exclusão de aplicação sem assinatura de relatórios/exportações | planejado |

Cada IMP: IA-TEST escreve testes vermelhos → IA-DEV implementa → verificações
completas → ciclo de revisão por PR → merge pelo responsável → ciclo sobre o
incremento inteiro → Gate 2 (aceite do responsável).

**Aceite do IMP-003 (05/11/2026, Carlos Yano):** aceito com o CI verde (PRs #30 a #35 e #37 a #40) e a CHG-013 incorporada. A leitura real com o scanner de mesa foi testada pelo responsável no modo de demonstração (DEC-125). Revisão independente focada no código do incremento (vínculo por CPF e reabertura, isolamento, o que sai do sistema, cota e retentativas): 2 bloqueantes, 4 altos, 10 médios e 3 baixos; bloqueantes e altos corrigidos pelas DEC-126 a DEC-130, e os médios F-07, F-08, F-12, F-14, F-15 e F-16 pela DEC-131. Pendentes, no §12.3: F-09 e F-10 e a Q-036 (F-13), antes do piloto; F-17 a F-19 no IMP-004. Pendentes também o E2E com navegador, quando houver telas, e o conjunto-ouro (§10.1), que calibra a confiança: até lá nada é confirmado automaticamente (DEC-127). A revisão completa do sistema fica para antes do piloto. Próximo: IMP-004 (a partir da CHG-014, o IMP-006 vem antes, DEC-140).

**Aceite do IMP-006 (05/11/2026, Carlos Yano):** aceito com o CI verde (PRs #43 a #47) e a CHG-014 implementada. A importação real foi testada pelo responsável no modo de demonstração (DEC-151 (9)): formulário criado a partir de um modelo, publicado, impresso, respondido com dados sintéticos e processado corretamente pela leitura. A Q-051, aberta no IA-DEV, foi respondida como DEC-152. O IA-TEST foi corrigido no #46 (sessão expirada após o avanço do relógio, sem mudar expectativas). Pendente, no §12.3: F-21 (job diário de limpeza dos arquivos da importação), adiado para o IMP-004, com o expurgo da RN-030. Próximo: IMP-004.

**Aceite do IMP-005 (04/11/2026, Carlos Yano):** aceito com o CI verde (PRs #22 a #27) e a
CHG-012 incorporada (PR #28). A instalação do zero no notebook, o backup e o teste de
restauração foram feitos pelo responsável seguindo `docs/operacao/NOTEBOOK.md`. Sem revisão
independente do incremento, por escolha do responsável. Próximo: IMP-003.

**Aceite do IMP-002 (03/11/2026, Carlos Yano):** aceito com o CI verde (PRs #13, #14 e #15) e a
CHG-009 incorporada. Pendentes: o E2E com navegador, quando houver telas; e, antes do piloto,
a renderização de PDF em processo isolado, o limite total por envio, a verificação do clamd e do
S3 contra os serviços reais e a extensão do teste de mutação às regras novas (DEC-052). Sem
revisão independente do incremento, por escolha do responsável.
Depois do aceite, a CHG-010 (DEC-105, DEC-106) muda só o campo de CPF do PDF e o mapa de
layout; o ajuste seguiu IA-TEST → IA-DEV dentro do IMP-002, antes do IMP-003.

**CHG-011 sobre os incrementos aceitos (v3.1):** o IMP-001 foi aceito com os CA-016, CA-025,
CA-026b, CA-037b e CA-038, retirados pela CHG-011; sua lista passa a ter só os CAs que continuam,
com CA-026, CA-035 e CA-037 reescritos. O IMP-005 refaz testes e código desses CAs (sem MFA,
convite, e-mail, perfis e concessões) e retira o grupo_minimo dos projetos do IMP-002.

**Aceite do IMP-001 (29/10/2026, Carlos Yano):** aceito com 105 testes verdes no CI (74 de
integração com PostgreSQL 17 e 31 unitários) e mutação de 90% em criptografia e autorização
(DEC-052). Pendente, por decisão do responsável: o E2E com navegador do login com MFA e do
reset de MFA, que entra quando as telas TL-001 e TL-002 tiverem desenho. A revisão
independente do incremento inteiro não foi feita antes do aceite (escolha do responsável
para economizar custo); fica recomendada antes do piloto.

**Ordem a partir da CHG-014 (DEC-140):** o IMP-006 é feito antes do IMP-004, como o IMP-005 foi
feito antes do IMP-003. O IMP-004 continua com o escopo e os CAs de antes; a exportação em formato
longo do Change Request de 05/11/2026 entrou pela CHG-015 no IMP-007, também feito antes do IMP-004 (DEC-164). O IMP-006 também ajusta
os testes e o código do IMP-002 que a CHG-014 alcança, em `versoes.test.ts`: rascunho vazio passa a
ter os 5 campos; o CA-036, a "versão vazia lista os 5 campos" e a "falta de campo da RN-017 junto
com estrutura inválida" passam a usar um rascunho anterior à v2.4 gravado direto no banco, porque a
gravação pela API recusa a falta de marcação (RN-050); o "CPF errado" passa a esperar o tipo
reaplicado (DEC-145); e o `createForm` passa a recusar projeto arquivado (DEC-146).

Conjunto-ouro (§10.1) roda em paralelo ao IMP-003 e é pré-requisito do piloto, não do aceite do IMP-003 (o IMP-003 usa o mock).

### 11.1 Cobertura dos 50 CAs da REQ v2.7

A soma dos CAs listados nos IMP-001 a IMP-008 cobre integralmente os 50 critérios
de aceite da REQ v2.7 (CA-001 a CA-055 e CA-014b, sem os oito retirados pela CHG-011). O validador
confere que cada CA está no incremento do seu RF.

**CA-052 a CA-055** pertencem ao RF-013 (IMP-008), mesmo quando exercitam o upload (RF-006, IMP-002),
a leitura (RF-007) ou a conclusão (RF-008, IMP-003): os incrementos aceitos não são reabertos, e
os testes deles que mudam com a CHG-017 (CA-003, CA-004 e a tabela de criação da FL-001) são
ajustados no IA-TEST do IMP-008.

**CA-050 e CA-051** pertencem ao RF-012 (IMP-007), que também declara o CA-021 (sem assinatura, fora da exportação).

**CA-045 a CA-049** pertencem ao RF-011 (IMP-006), mesmo quando exercitam operações do RF-003
(`createProject`, `updateProject`) ou do RF-004 (`createForm`, `createVersion`, `updateVersion`):
o IMP-002, já aceito, não é reaberto.

**CA-021** aparece em mais de um incremento porque a REQ o associa a mais de um RF:
marcado na revisão (RF-008/IMP-003) e excluído de relatórios/exportações (RF-009 e RF-010/IMP-004).

Na v1.5 (CHG-004), CA-015, CA-018, CA-019 e CA-020 passaram a pertencer só aos RF que os
tornam observáveis (leitura e revisão, IMP-003) e CA-017 só ao RF-009 (IMP-004); o IMP-002
entrega a estrutura (regras de salto e perguntas de cruzamento), verificada pelos testes de
RF-004, sem declarar esses CAs.

**CA-012 no IMP-001:** os exemplos do CA-012 usam `/projects`, que só existe no IMP-002.
No IMP-001 os mesmos quatro exemplos (outro tenant, inexistente com corpo idêntico,
escrita em outro tenant sem efeito, próprio tenant) são aplicados às operações de usuários
e concessões; os exemplos com `/projects` são testados no IMP-002. Com a CHG-011, o CA-012
fica como defesa em profundidade (DEC-116). O teste E2E com navegador do login entra num PR
de IA-TEST quando a tela TL-001 tiver desenho.

A conferência unitária está no CSV canônico `registros/matriz_rastreabilidade.csv`,
validado pelo CI a cada merge.

---

## 12. Riscos, decisões, Q, GX e mudanças

| Item | Tipo | Status |
| --- | --- | --- |
| GX-001 parecer jurídico (DPA + Art. 33) | Gate externo | pendente; não é exigido enquanto o uso for só de teste com dados sintéticos (DEC-119); bloqueia qualquer uso com dados reais |
| Provedor de IA | dependência | Claude primeiro, Gemini depois para comparação (DEC-122); interface isolada (DEC-043) |
| Retenção de produção | jurídico | aguarda GX-001; backups já definidos em 90 dias (DEC-033) |
| Risco aceito: páginas de pessoas distintas | risco | DEC-008; procedimento operacional na v1 (§2.8 da REQ) |
| Risco aceito: dados num único notebook | risco | DEC-107, DEC-117 (BitLocker, backup diário cifrado fora do notebook) |
| Risco aceito: página inteira no provedor de IA na localização | risco | DEC-170; T-17 (§8); Risco 3 da REQ |
| CHG-001 — CA-032 × catálogo ERR | mudança normativa | aplicada na REQ v1.2 |
| CHG-002 — correções de consistência e lacunas | mudança normativa | aceita em 27/10/2026 (REQ v1.3) |
| CHG-003 — respostas às Q-005 a Q-011 | mudança normativa | aceita em 27/10/2026 (REQ v1.4, DEC-054 a DEC-060) |
| CHG-004 — achados das revisões independentes (rodadas 1 e 2) | mudança normativa | aceita em 28/10/2026 (REQ v1.6) |
| CHG-005 — respostas às Q-012 a Q-020, DEC-061 e DEC-073 | mudança normativa | aceita em 28/10/2026 (REQ v1.7, DEC-064 a DEC-073) |
| CHG-006 — achado alto da REV-REQ-007 (DEC-071 no contrato e nos CAs) | mudança normativa | aceita em 29/10/2026 (REQ v1.8) |
| CHG-007 — altos A-01 e A-02 da REV-REQ-008; Q-021 a Q-029 | mudança normativa | aceita em 29/10/2026 (REQ v1.9, DEC-074 a DEC-082) |
| CHG-008 — perfil exigido na concessão individual (Q-030) | mudança normativa | aceita em 29/10/2026 (REQ v1.10, Q-030) |
| CHG-009 — CA-003 esclarecido e lacunas do IA-TEST do IMP-002 (DEC-093 a DEC-100) | mudança normativa | aceita em 03/11/2026 (REQ v1.11) |
| CHG-011 — aplicação local num notebook, de uma única usuária (DEC-107 a DEC-116) | mudança normativa | aceita em 03/11/2026 (REQ v2.1); propagada no IMP-005 (PLANO v3.2, DEC-118) |
| CHG-012 — uso só de teste com dados sintéticos, Claude como provedor de IA, eliminações e RTO no notebook (DEC-119 a DEC-122) | mudança normativa | aceita em 04/11/2026 (REQ v2.2, PLANO v3.3) |
| CHG-010 — CPF com uma caixa por dígito no PDF (DEC-105, DEC-106) | mudança normativa | aceita em 03/11/2026 (REQ v2.1); propagada no IA-TEST e no IA-DEV |
| CHG-013 — revisão focada do IMP-003 (DEC-126 a DEC-131) | mudança normativa | aceita em 05/11/2026 (REQ v2.3, PLANO v3.8) |
| CHG-014 — importação de formulário, campos obrigatórios padronizados e ciclo de coleta (DEC-132 a DEC-146) | mudança normativa | aceita em 05/11/2026 (REQ v2.4, PLANO v3.10); implementada no IMP-006 |
| CHG-015 — exportação em formato longo (DEC-153 a DEC-165) | mudança normativa | aceita em 05/11/2026 (REQ v2.5, PLANO v3.13); implementação no IMP-007 |
| CHG-016 — apóstrofo contra fórmulas só no CSV (DEC-166) | mudança normativa | aceita em 05/11/2026 (REQ v2.6, PLANO v3.14); implementação no IMP-007 |
| CHG-017 — pesquisas sem QR e localização das perguntas pela IA (DEC-169 a DEC-177) | mudança normativa | proposta em 06/11/2026 (REQ v2.7, PLANO v3.17); Q-063 a Q-065 respondidas (DEC-175 a DEC-177); aguarda a revisão focada e o aceite; implementação no IMP-008 |

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
| DEC-038 | 24/10/2026 | técnica | Nuvem do projeto | AWS sa-east-1; Azure Brazil South | AWS sa-east-1 | Paridade com a stack validada no MeuRemedio; região Brasil; resolve DEC-036 | substituído | DEC-113 | Alto | RNF-011, DEC-036 |
| DEC-039 | 24/10/2026 | técnica | RPO e RTO da v1 | Valores menores; valores maiores | RPO 24h / RTO 4h | Compatível com volume de 500 formulários/mês | substituído | DEC-121 | Médio | Bloco P P.13 |
| DEC-040 | 24/10/2026 | técnica | Isolamento por tenant | RLS puro; schema por tenant; FK composta + RLS com SET LOCAL | SET LOCAL app.tenant_id por transação + RLS com FORCE | Defesa em camadas exigida pela RN-001 | definitivo | | Alto | RN-001, RN-023, TS-001 |
| DEC-041 | 24/10/2026 | técnica | Cifragem do CPF | Ciframento no app; envelope KMS | AES-256-GCM com envelope no KMS + HMAC-SHA256 com chave por tenant derivada por HKDF | RNF-003 e RN-013 com rotação possível; sem correlação entre tenants (ajustada em 27/10/2026) | substituído | DEC-114 | Alto | RNF-003, RN-013 |
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
| DEC-062 | 28/10/2026 | técnica | Onde guardar a lista de eliminações | Tabela no mesmo banco; registro externo | Registro append-only em bucket S3 separado, com Object Lock (retenção 180 dias), gravado na mesma execução da eliminação; o runbook de restore lê dele e reaplica antes de reabrir o banco | A tabela no banco restaurado é tão antiga quanto o backup e não contém eliminações posteriores (achado B-01 da REV-PLANO-007) | substituído | DEC-120 | Alto | DEC-033, T-12, TS-008 |
| DEC-063 | 28/10/2026 | técnica | Guarda do valor anterior para reversão (CA-042) | Na auditoria; tabela própria cifrada | Tabela HistoricoAtributoRespondente (ENT-023), cifrada como o original, apagada na eliminação; reversão condicionada ao valor atual | A auditoria não pode guardar valores (RN-027) | definitivo | | Alto | CA-042, CA-023, RN-027 |
| DEC-083 | 29/10/2026 | técnica | Tenant inativo no login e na sessão (M-12, DEC-070) | Checar só no login; checar no login e em toda sessão | A função de login devolve tenant.ativo; tenant inativo → ERR-013 (conta como falha, sem pré-sessão). auth_resolver_sessao recusa sessão e pré-sessão de tenant inativo (ERR-015) sem apagar nada. Jobs do tenant filtram tenant.ativo a partir do IMP-002 | Inativar o tenant deve ter efeito imediato, não só no próximo login | definitivo | | Médio | DEC-070, RF-002, M-12 |
| DEC-084 | 29/10/2026 | técnica | Lista de senhas vazadas (M-20, Bloco P P.2) | Lista embutida; consulta ao Have I Been Pwned | Lista embutida no código (SecLists 10k-most-common, licença MIT), comparada sem diferenciar maiúsculas; sem chamada externa, sem timeout e sem modo de falha. Atualização da lista por PR | Escolha do responsável (opção 1A, 29/10/2026): nada sai do servidor e não há dependência de terceiro; cobertura menor que a consulta online | definitivo | | Médio | Bloco P P.2, RF-002, M-20 |
| DEC-085 | 29/10/2026 | técnica | Parâmetros de senha e TOTP (B-N9) | Padrões da biblioteca; parâmetros explícitos | Argon2id m=19456 KiB, t=2, p=1 (OWASP); TOTP RFC 6238 SHA-1, 6 dígitos, passo de 30 s, tolerância de ±1 passo; código de passo já usado ou anterior ao último aceito é recusado (ERR-012 (descontinuado na v2.1)); segredo TOTP cifrado com AES-256-GCM pela chave da aplicação (KMS na implantação) | Parâmetros auditáveis e proteção contra reuso do código na janela | definitivo | | Médio | DEC-050, RF-002, B-N9 |
| DEC-086 | 29/10/2026 | técnica | Repetições no cadastro de MFA (V-B1, CA-026b) | Recusar segundo startMfaSetup; sobrescrever o segredo não confirmado | startMfaSetup repetido sobrescreve o segredo ainda não confirmado; só setupMfa ativa o MFA. Pré-sessão encerrada porque outra concluiu o setupMfa responde ERR-018 (CA-026b, exemplo 4); pré-sessão expirada ou encerrada por outro motivo (logout, reset de MFA, desativação) responde ERR-015 | Seguro, pois o segredo só vale após a confirmação; o código de erro segue o CA-026b | definitivo | | Baixo | CA-026b, V-B1, DEC-050 |
| DEC-087 | 29/10/2026 | técnica | Contagem de falhas de login (CA-026) | Janela deslizante; janela fixa a partir da primeira falha | Janela fixa de 15 min aberta na primeira falha, por HMAC do e-mail; contam ERR-013 (login e acceptMfaReset) e ERR-012 (descontinuado na v2.1); a 5ª falha bloqueia por 15 min; a contagem zera só quando uma sessão plena é criada (o acerto da senha sozinho não zera) | Sem zerar no acerto da senha, quem tem a senha não testa códigos MFA sem limite | definitivo | | Médio | CA-026, RF-002, ERR-014 |
| DEC-088 | 29/10/2026 | técnica | Envio de e-mail no IMP-001 (convite, recuperação, reset de MFA) | Integrar o provedor agora; interface e captura agora, provedor na implantação | Interface Mailer; outbox transacional com só IDs; o token é gerado no despacho e só o hash fica no banco; no IMP-001 o despacho roda no próprio processo após o commit; Amazon SES (sa-east-1) e despacho por pg-boss entram com o ambiente na nuvem | Escolha do responsável (opção 2A, 29/10/2026): não há conta AWS configurada; nenhum e-mail sai em desenvolvimento | definitivo | | Médio | RF-001, RF-002, PLANO §7 |
| DEC-089 | 29/10/2026 | técnica | Análise estática de segurança no CI | CodeQL; Semgrep; nenhuma | Semgrep (regras públicas para TypeScript/Node) no lugar do CodeQL, que exige plano pago em repositório privado | Escolha do responsável (opção 3A, 29/10/2026); mesma função no plano gratuito | definitivo | | Médio | PLANO §9.4 |
| DEC-090 | 29/10/2026 | técnica | Dono das funções SECURITY DEFINER (refina DEC-046) | mp_owner; papel próprio com BYPASSRLS | Papel mp_auth (NOLOGIN, BYPASSRLS) é dono só das funções auth_* (login, falhas, tokens, resolução de sessão), com search_path fixo e grants mínimos; mp_app só tem EXECUTE nelas | Com FORCE ROW LEVEL SECURITY o próprio mp_owner é filtrado pela RLS, então as funções de login não enxergariam o usuário | definitivo | | Alto | DEC-046, DEC-040 |
| DEC-091 | 29/10/2026 | técnica | Proteção dos testes aprovados no plano gratuito (complementa DEC-053) | Regra da main no GitHub (plano pago); processo com job de CI | Repositório privado no plano gratuito: o GitHub não aplica a regra da main e, com uma só pessoa, o CODEOWNERS não bloqueia. Valem o job testes-congelados e a regra de que nenhuma junção ocorre sem a autorização do responsável; reavaliar o GitHub Pro com um segundo revisor | Escolha do responsável (opção A, 29/10/2026) | definitivo | | Médio | DEC-053 |
| DEC-092 | 03/11/2026 | técnica | Processo de trabalho alinhado ao kit v3 | Manter o processo de 29/10/2026; adotar o kit v3 integralmente; adotar o kit v3 com o merge sempre pelo responsável | Adotar o kit v3 com três ajustes: (1) todo PR é juntado só pelo responsável, inclusive os não normativos; (2) mudança retroativa proporcional (CHG classificada como esclarecimento ou normativa, impacto pela matriz, bloqueio seletivo, propagação de cima para baixo), com as colunas fase_origem, classificacao e trabalho_bloqueado em controle_mudancas.csv; (3) ciclo de verificação com revisor novo a cada rodada e regra anti-oscilação, mantido o critério de parada da DEC-073. O status de cada IMP passa a vir do §11 | Escolha do responsável (03/11/2026): ele faz todos os merges para economizar tokens; o critério da DEC-073 continua valendo no lugar do critério do kit (sem médios) | definitivo | | Médio | AGENTS.md §3, §5 e §7; DEC-053, DEC-061, DEC-073 |
| DEC-099 | 03/11/2026 | técnica | Alcance do getPageImage (M-07) | Qualquer perfil do projeto; só digitalizador com regras por estado | Só digitalizador vinculado ao projeto (outro perfil → ERR-016; sem vínculo → ERR-002). Em `identificacao_pendente`, qualquer digitalizador vinculado; nos estados com reserva (IMP-003), só o titular da reserva ativa; nos demais estados → ERR-018. Todo acesso concedido é auditado com o id da imagem em `registro_id` | Minimização do acesso à imagem inteira (RN-029, DEC-034); escolha do responsável em 03/11/2026 (CHG-009, item 6) | definitivo | | Médio | RF-006, RN-029, DEC-034 |
| DEC-100 | 03/11/2026 | técnica | Versão de outro tenant informada no identifyApplication (B-N8) | 404 ERR-002; 400 ERR-039 | 400 ERR-039, igual a versão inexistente, sem revelar que a versão existe; a tentativa é auditada | Mesmo tratamento do QR de outro tenant (CA-039); escolha do responsável em 03/11/2026 (CHG-009, item 7) | definitivo | | Baixo | CA-039, ERR-039, RN-002 |
| DEC-101 | 03/11/2026 | técnica | Armazenamento das imagens no IMP-002 | Integrar o S3 agora; interface agora, S3 na implantação | Interface Armazenamento (gravar, apagar, link assinado, contagem); chave `tenant/<tenant>/aplicacao/<aplicação>/<imagem>.jpg`, sem dado pessoal; nos testes, implementação em memória com links assinados por HMAC e expiração pelo relógio injetado; o adaptador do Amazon S3 (sa-east-1, bucket privado, sem versionamento, fora do backup) entra na implantação | Mesmo padrão do e-mail (DEC-088): a API não sobe fora de teste sem o adaptador real | definitivo | | Médio | RN-029, RN-030, DEC-034, DEC-088 |
| DEC-102 | 03/11/2026 | técnica | Antimalware nos testes e em produção (DEC-042) | ClamAV em contêiner no CI; equivalente que reconhece o EICAR | Produção: cliente clamd (INSTREAM, 30 s; resposta inesperada ou tempo esgotado é falha, nunca "limpo"). Testes: equivalente que reconhece a assinatura EICAR, sem baixar a base de vírus. O cliente clamd é verificado contra um ClamAV real antes do piloto | CI rápido; a base de vírus tem centenas de MB | definitivo | | Médio | DEC-042, CA-029 |
| DEC-103 | 03/11/2026 | técnica | Itens de resposta (ItemResposta) na criação da aplicação | Criar `pendente_leitura` no upload; criar na leitura | Os itens nascem com a leitura, no IMP-003; no IMP-002 a aplicação em `em_leitura` tem só as páginas e o evento `leitura.solicitada` no outbox | A versão só fica certa quando a aplicação sai de `identificacao_pendente`; evita criar e apagar itens | definitivo | | Baixo | RF-006, RF-007, FL-001 |
| DEC-104 | 03/11/2026 | técnica | Modo de demonstração local para testar o IMP-002 com foto real, antes das telas (TL-xxx) | Esperar as telas; script de demonstração local fora da API | `npm run demo` (`apps/api/src/demo`): PostgreSQL 17 descartável, a API real com o armazenamento em memória (DEC-101), e-mail só no terminal e o equivalente EICAR (DEC-102), ou um clamd real com `MP_CLAMD_HOST`; uma usuária sintética com MFA, um projeto e um formulário publicado de duas páginas; uma página simples (entrar, baixar o PDF, enviar e identificar) que só usa operações do contrato, repassadas a partir da mesma origem. Escuta só em 127.0.0.1, recusa NODE_ENV=production, gera segredos a cada execução e não grava nada fora do contêiner; depende de pacotes de desenvolvimento, então não roda na imagem de produção. Não substitui o E2E com navegador nem as telas TL-xxx | Escolha do responsável em 03/11/2026: testar a leitura do QR e o registro com fotos reais antes do IMP-003. Só dados sintéticos enquanto a GX-001 estiver pendente | definitivo | | Baixo | DEC-101, DEC-102, DEC-088, RF-006, GX-001 |
| DEC-106 | 03/11/2026 | técnica | Caixas do CPF no PDF e no mapa de layout (DEC-105) | Só a região da pergunta; região da pergunta e de cada caixa | 11 caixas quadradas de 18 pt, com 4 pt entre elas, dentro da área de resposta atual (a altura do bloco e a região da pergunta não mudam). O `mapa_layout` ganha, na pergunta do tipo `cpf`, a lista `caixas` com as 11 regiões normalizadas, na ordem dos dígitos | O IMP-003 recorta e lê dígito a dígito; como a região da pergunta não muda, os mapas já gravados continuam válidos | definitivo | | Médio | DEC-105, DEC-048, RF-004, RF-007, RN-012 |
| DEC-113 | 03/11/2026 | técnica | Ambiente de execução da aplicação local (DEC-107) | AWS sa-east-1; notebook Windows | Notebook Windows 11 com BitLocker: PostgreSQL 17 local, API e interface web servidas só em 127.0.0.1; imagens em pasta local, pela interface Armazenamento (DEC-101) com um adaptador de disco e links assinados locais de 5 min; e-mail removido; pg-boss e outbox mantidos no PostgreSQL local; sem Terraform | Sem nuvem própria (CHG-011) | definitivo | | Alto | DEC-107, DEC-101, DEC-038, RNF-002, RNF-007 |
| DEC-114 | 03/11/2026 | técnica | Chaves de cifra do CPF e do MFA sem KMS (DEC-041) | KMS da nuvem; chave mestra local protegida pelo Windows | AES-256-GCM e HMAC-SHA256 por HKDF mantidos; a chave mestra é gerada na instalação e guardada cifrada pelo DPAPI do Windows (escopo da máquina); uma cópia cifrada com senha de recuperação acompanha o backup, para restaurar em outro notebook | Sem KMS (CHG-011); sem a cópia, a perda do notebook tornaria o backup ilegível | definitivo | | Alto | DEC-041, DEC-107, RNF-003, DEC-117 |
| DEC-115 | 03/11/2026 | técnica | Antimalware no upload da aplicação local (DEC-042, DEC-102) | clamd; Microsoft Defender | Produção: Microsoft Defender pela linha de comando (MpCmdRun), com a mesma regra de falha da DEC-102 (tempo esgotado ou resposta inesperada é falha, nunca "limpo"). Testes: o equivalente EICAR da DEC-102 continua | Já vem no Windows, sem serviço extra (CHG-011) | definitivo | | Médio | DEC-042, DEC-102, RF-006, CA-029 |
| DEC-116 | 03/11/2026 | técnica | Código de vários tenants já implementado (DEC-107) | Remover tenant_id e RLS; manter com um tenant fixo | Mantém tenant_id, RLS e papéis do banco como estão; a instalação cria o único tenant e a usuária; tabelas novas seguem o mesmo padrão. Os testes de isolamento ficam como regressão até o IMP-005 decidir quais saem | Remover custaria refazer migrações e testes do IMP-001 e do IMP-002 sem ganho para a usuária (escolha do responsável) | definitivo | | Médio | DEC-107, RNF-001, RN-001, DEC-046 |
| DEC-118 | 04/11/2026 | técnica | Detalhes dos adaptadores locais do IMP-005 (DEC-113 a DEC-115, DEC-117) | Decidir na implantação; fixar no IA-DEV do IMP-005 | Chave mestra: subchaves por HKDF-SHA256 com um rótulo por finalidade (HMAC do e-mail, cifra de campo, backup); cópia de recuperação com scrypt (N=2^15, r=8, p=1) e AES-256-GCM, com a senha de recuperação definida pela usuária na instalação, pela política da RN-048; DPAPI no escopo da máquina pelo Windows PowerShell, que protege também as senhas geradas de mp_app e mp_manutencao e a conexão de superusuário usada no backup (segredos.dpapi). Imagens: pasta local com gravação atômica, chave validada por segmentos simples e links assinados por HMAC num servidor em 127.0.0.1. Defender: MpCmdRun -Scan -ScanType 3 -File -DisableRemediation sobre arquivo temporário de nome aleatório; código 0 = limpo, 2 ou arquivo removido = risco, o resto = falha. Backup: pg_dump (formato custom, como superusuário), imagens e cópia de recuperação num tar do Windows, cifrado com AES-256-GCM pela subchave de backup, com a cópia de recuperação no cabeçalho; diário pelo Agendador de Tarefas; retenção de 90 dias pelo nome do arquivo; o teste mensal pede a senha de recuperação, restaura num banco temporário e confere tenant e imagens. A instalação recusa sem BitLocker, salvo com --sem-bitlocker para testes com dados sintéticos | As imagens entram no backup, porque o notebook é a única cópia (DEC-107); a senha de recuperação pedida no teste mensal confirma que a usuária ainda a sabe | definitivo | | Alto | DEC-113, DEC-114, DEC-115, DEC-117, DEC-101, DEC-033, T-08 |
| DEC-120 | 04/11/2026 | técnica | Registro externo das eliminações no notebook (substitui a DEC-062) | Bucket na nuvem; arquivo no disco de backup | Arquivo append-only `eliminacoes.log` no disco externo de backup, só com IDs e datas (sem dado pessoal), gravado na mesma execução da eliminação; com o disco desconectado, a linha fica numa fila na pasta de dados e é copiada para o disco no backup seguinte. O arquivo fica fora do .mpbak, para que um backup antigo restaurado encontre as eliminações posteriores; o roteiro de restauração reaplica antes de reabrir o banco | Sem nuvem (CHG-011); o disco de backup já fica longe do notebook. Eliminações feitas depois do último backup e ainda na fila se perdem junto com o notebook, dentro do RPO de 24 h (risco aceito, CHG-012) | definitivo | | Alto | DEC-062, DEC-033, DEC-117, T-12, TS-008 |
| DEC-121 | 04/11/2026 | técnica | RTO no notebook (substitui o RTO da DEC-039) | 4 h; 1 dia útil | RPO 24 h mantido; RTO de 1 dia útil (instalar noutro notebook e restaurar); o teste de restauração é mensal no próprio notebook (`testar-restauracao`, DEC-117), sem ambiente de staging | Um único notebook, sem equipe de plantão (CHG-011, CHG-012) | definitivo | | Médio | DEC-039, DEC-117, Bloco P P.13 |
| DEC-122 | 04/11/2026 | técnica | Provedor de IA (ReadEngine, DEC-043) | Escolher no conjunto-ouro; Claude; Gemini | Claude (API da Anthropic) é o primeiro adaptador da interface ReadEngine; o Gemini entra depois, pela mesma interface, para comparação no conjunto-ouro. O modelo é escolhido no IMP-003 pelo conjunto-ouro | Escolha do responsável (CHG-012); a interface isolada (DEC-043) permite trocar sem mudar regras | definitivo | | Médio | DEC-043, DEC-111, DEC-056, DEC-119 |
| DEC-123 | 04/11/2026 | técnica | Testes da leitura por IA (IMP-003) | Chamar a API real nos testes; gravar respostas; motor simulado no harness | Os testes de integração usam o worker real com um motor simulado no lugar do adaptador Claude, programado por pergunta e que registra cada chamada (campos, recorte e schema); o worker só roda por `worker.processar()` e pelos jobs que o relógio fizer vencer. O adaptador Claude tem testes unitários com o `fetch` injetado no SDK oficial (`@anthropic-ai/sdk`), sem rede: uma tentativa por chamada (`maxRetries` 0, as retentativas da REQ §6.6 são do worker), saída estruturada por JSON schema, sem ferramentas, e qualquer saída fora do schema pedido (campo ausente, extra ou repetido, confiança ou região fora de 0 a 1) vira falha `malformada` da chamada inteira. As regras de estado do item (FL-002) e de CPF ficam em funções puras, base do teste de mutação (DEC-052); propriedades com `fast-check` | Testes determinísticos e sem custo nem dado real (Q-001, DEC-119); a interface isolada (DEC-043) deixa o adaptador ser testado à parte | definitivo | | Médio | DEC-043, DEC-051, DEC-052, DEC-053, DEC-122 |
| DEC-124 | 04/11/2026 | técnica | Implementação da leitura e da revisão (IMP-003) | pg-boss; fila em tabela própria; worker em processo separado | (1) Fila: tabela `tarefa_leitura` (uma tarefa por página e grupo de envio, RN-039) com a hora da próxima tentativa pelo relógio injetado, no lugar do pg-boss, para que as retentativas (1 e 2 s, DEC-129) e a retomada da cota sigam o relógio dos testes; no notebook o worker roda no mesmo processo da API, a cada segundo. (2) Recorte: regiões do `mapa_layout` (DEC-048) aplicadas à página normalizada, sem correção de perspectiva; as perguntas da tarefa vão empilhadas numa só imagem. O recorte de `getItemImage` é gerado na primeira consulta e guardado ao lado das páginas, apagado no descarte. (3) Revisão: o revisor age sobre itens lidos (a revisar ou resolvidos, inclusive `confirmado_automaticamente`, CA-020); `pendente_leitura` e `aguardando_condicao` → ERR-018. A confirmação automática grava `valor_final` = `valor_ia`. Quando a condição de salto muda, o destino vai a `a_revisar` ou `nao_se_aplica` (FL-002). (4) Cadastro: `respondente.versao` sobe a cada alteração; `aplicacao.cadastro_versao` guarda a versão vista na conclusão sem assinatura e decide, no anexo (CA-044), se o cadastro mudou. A reversão (CA-042) usa a ordem de registro (`seq`) do histórico e confere o HMAC do valor gravado; o respondente antigo é anonimizado na nova conclusão, se não lhe restar aplicação concluída. QR da página anexada que não confere versão e página 1 → ERR-004. (5) `auditoria.seq` e `historico_atributo_respondente.seq` (identidade) desempatam eventos no mesmo instante do relógio injetado. (6) Adaptador Claude: credencial no cabeçalho `x-api-key` (DEC-123), sem ler variáveis de ambiente | Testes determinísticos pelo relógio (DEC-053, DEC-123) sem mudar regra de negócio; menos uma dependência na instalação local (DEC-113) | definitivo | | Médio | DEC-043, DEC-048, DEC-051, DEC-064, DEC-078, DEC-112, DEC-113, DEC-123 |
| DEC-125 | 04/11/2026 | técnica | Modo de demonstração com leitura por IA e revisão (amplia a DEC-104) | Esperar as telas TL-xxx; comandos `chave-ia` e `cotacao` no notebook | `npm run demo` passa a ler e revisar: (1) a chave da API da Anthropic vem de `MP_DEMO_CHAVE_IA` na execução, fica só na memória do processo, sai do ambiente logo ao ser lida e nunca é gravada; sem ela o envio funciona e a leitura fica parada (DEC-124); (2) o modelo é o padrão da instalação (DEC-122), trocável por `MP_DEMO_MODELO`; (3) a cotação do dólar do mês corrente e do seguinte é gravada como parâmetro da plataforma, fictícia (padrão 5.00, `MP_DEMO_COTACAO`); (4) o worker de leitura roda no mesmo processo a cada 1 s, como no notebook; (5) a página ganha a cota do mês, o acompanhamento da leitura, a revisão (abrir, recorte do campo, confirmar ou corrigir, divergência do cadastro), a conclusão e a nova tentativa, só com operações do contrato | Escolha do responsável em 04/11/2026: testar a leitura real com foto antes das telas. Cada página lida gera custo real na conta da Anthropic, avisado no terminal. Só dados sintéticos enquanto a GX-001 estiver pendente; o modelo é provisório até o conjunto-ouro (DEC-122) | definitivo | | Baixo | DEC-104, DEC-122, DEC-124, DEC-058, GX-001 |
| DEC-130 | 05/11/2026 | técnica | Correções da revisão focada do IMP-003 (CHG-013) | Tratar caso a caso no código; registrar a regra | (1) Página da tarefa que não se lê do disco ou não se recorta (arquivo sumido, JPEG corrompido) conta como falha da tarefa, com as mesmas retentativas da chamada (§4.2.1); nenhum erro de uma tarefa interrompe as demais. (2) Reserva recusada por não caber no teto (CA-030, exemplo 2): `consumo_ia.reserva_recusada_reais` guarda a menor reserva recusada no mês, e a cota conta como atingida enquanto consumido + essa reserva passar do teto; a retomada espera o teto subir ou o mês virar, sem oscilar entre `em_leitura` e `aguardando_cota`. (3) Descarte de aplicação reaberta: o respondente da conclusão anterior é anonimizado como na nova conclusão (DEC-078), se não lhe restar aplicação concluída | Achados F-02, F-03 e F-04 da revisão focada do IMP-003 (revisão focada do IMP-003) | definitivo | | Alto | DEC-051, DEC-078, DEC-124, CA-030, CA-033, CA-042 |
| DEC-131 | 05/11/2026 | técnica | Médios da revisão focada do IMP-003 tratados antes do aceite | Tratar no IMP-004; tratar agora | (1) Item de pergunta do tipo `cpf` fica cifrado em `item_resposta`, como os campos do respondente (RN-025). (2) Vínculo do respondente com uma trava transacional pelo hash do CPF (`pg_advisory_xact_lock`): duas conclusões do mesmo CPF se sucedem. (3) Reversão (§4.4): alteração posterior já revertida não impede a reversão; quando o valor anterior foi gravado por uma aplicação também revertida, a reversão desce até o valor de antes dela; atributo mantido por alteração posterior é auditado (`REVERTER_CADASTRO`, resultado `mantido`). (4) Checks de aplicação do §5.3 em migração, com `descartada` admitida sem versão. (5) O motor recebe chaves opacas (`c1`, `c2`…), nunca o código da pergunta; cada campo indica o seu recorte (`recorte`, de cima para baixo) e os recortes vão separados por uma faixa preta, com a regra nas instruções (RN-045) | Achados F-07, F-08, F-12, F-14, F-15 e F-16 da revisão focada do IMP-003; F-09 e F-10 ficam para antes do piloto (§12.3) e o F-13 é a Q-036 | definitivo | | Médio | RN-025, RN-045, DEC-063, DEC-124, CA-042, ENT-010 |
| DEC-140 | 05/11/2026 | técnica | Lugar da importação de formulário no plano (CHG-014) | Renumerar o IMP-004; criar o IMP-006 e fazê-lo antes | IMP-006 novo, feito antes do IMP-004, que passa a ter o IMP-006 aceito como entrada; nada do IMP-004 é renumerado. Os CA-045 a CA-049 ficam no RF-011 e no IMP-006; os testes do IMP-002 alcançados pela CHG-014 (rascunho com os 5 campos, CA-036, `createForm` em projeto arquivado) são ajustados no IA-TEST do IMP-006, sem reabrir o aceite do IMP-002 | Mesmo precedente do IMP-005, feito antes do IMP-003; evita renumerar referências ao IMP-004 na REQ, no §12.3 e na matriz | definitivo | | Baixo | RF-011, IMP-004, IMP-006 |
| DEC-141 | 05/11/2026 | técnica | Onde fica a leitura da estrutura do formulário (RN-049) | Novo método no ReadEngine; extrator próprio no worker | Interface `ExtratorEstrutura` no worker da leitura (hoje em `apps/api/src/leitura`), com `extrairPagina(imagem, opcoes)` que devolve as perguntas da página (enunciado, tipo, opções, linhas, faixa e `campo_padrao`, DEC-144 e DEC-149) e o custo estimado antes da chamada (DEC-051). Primeiro adaptador: Claude, com o mesmo SDK, chave, modelo e cotação da leitura (DEC-122, DEC-125); nos testes, um extrator simulado programado por página (como a DEC-123). O `packages/motor-leitura` não muda | O motor é agnóstico de domínio e recebe só recortes (RN-045, §2.1); a página inteira de um formulário de pesquisa é assunto do produto | definitivo | | Médio | RN-045, RN-049, DEC-043, DEC-122, DEC-123 |
| DEC-142 | 05/11/2026 | técnica | Execução da importação (RN-049, FL-004) | Síncrona na requisição; job por página | Tabela própria `tarefa_importacao` (importação, página, tentativas, próxima tentativa, estado, custo reservado e `resultado` jsonb com a estrutura lida), processada pelo mesmo worker e relógio da `tarefa_leitura` (DEC-124), com timeout de 60 s por chamada e 3 chamadas no total por página; reserva de custo por página; criação de todas as entidades numa só transação no fim; arquivos em `tenant/<tenant>/importacao/<importação>/`, apagados ao fim e pelo job diário; altura das perguntas por um módulo compartilhado com o PDF (§4.8, DEC-143) | Uma importação de 50 páginas passa do tempo de uma requisição; reaproveita a cota, as retentativas e o relógio dos testes da leitura | definitivo | | Médio | RF-011, FL-004, DEC-051, DEC-124, DEC-129 |
| DEC-150 | 05/11/2026 | técnica | Implementação dos campos padronizados, da altura e do ciclo de coleta (IMP-006) | Tratar no controlador; módulos compartilhados | (1) Altura: `apps/api/src/formularios/layout.ts` tem a medida dos blocos usada pelo PDF, pelo mapa de layout, pela verificação da DEC-143 e pela distribuição da importação; a área das perguntas vai do topo (120 pt abaixo da borda) até a caixa do termo na página 1 (260 pt da base) e até o rodapé (80 pt) nas demais; a pergunta passa do rodapé quando a base do bloco fica abaixo desse limite, com as perguntas anteriores da página empilhadas. (2) RN-050 em `apps/api/src/regras/campos-padrao.ts` (funções puras): a gravação confere as marcações e os códigos reservados e só então reaplica; na cópia, a primeira pergunta de cada marcação é padronizada, as demais com a mesma marcação ficam como estão (a próxima gravação recusa), e as regras de salto seguem os códigos renomeados; os campos injetados recebem a ordem 1 a 5 e as perguntas copiadas são deslocadas. A recusa de altura na gravação vem depois da reaplicação e da validação do conteúdo. (3) `listForms` lista do formulário mais recente para o mais antigo, como `listFormImports` (a REQ e o contrato não fixam a ordem). (4) Ciclo de coleta: colunas em `projeto` (migração 0006), com a ordem das datas também como check no banco; o coordenador fica em texto, sem cifra de campo, como o dicionário (ENT-004) | Mesma medida em todos os pontos que dependem da altura (§4.8); regras puras testáveis à parte (DEC-052) | definitivo | | Baixo | RN-050, DEC-135, DEC-137, DEC-143, DEC-145, DEC-147, CA-048, CA-049 |
| DEC-151 | 05/11/2026 | técnica | Implementação da importação de formulário (IMP-006) | Tarefas na tabela de leitura; extrator dentro do motor | (1) `tarefa_importacao` (migração 0007) com `situacao` pendente, suspensa (teto atingido ou mês sem cotação; volta a pendente quando a cota permite) ou concluida, o resultado validado da página em `resultado` (jsonb) e a reserva em `custo_reservado_usd`, ajustada após a chamada como na leitura (DEC-051, DEC-130); a importação termina com as tarefas apagadas. (2) `importacao_formulario` guarda também `aviso` (ERR-003 em `aguardando_cota`, ERR-044 em `falhou`), `versao_id` e `criada_por`, que é o usuário da auditoria feita pelo worker. (3) Auditoria: `SOLICITAR_IMPORTACAO` no envio (só o número de páginas), `IMPORTACAO_FORMULARIO` na conclusão e `IMPORTACAO_FALHOU` na falha, com IDs e contagens, sem texto lido (RN-028). (4) Arquivos em `tenant/<tenant>/importacao/<importação>/<página>.jpg`, apagados ao terminar; o worker reduz a página a no máximo 2000 px antes da chamada; página ilegível no armazenamento conta como falha da chamada. (5) O worker valida de novo a saída do extrator antes de gravar (RN-037). (6) O multipart aceita 2 campos de texto por envio (o nome do formulário e a declaração da importação; a confirmação da assinatura no upload). (7) ExtratorClaude em `apps/api/src/leitura/extrator.ts` com a chave, o modelo e os preços da leitura, ligado no notebook e no modo de demonstração quando há chave. (8) Endereço e aplicador reconhecidos seguem a DEC-152 (enunciado padrão e `obrigatorio = false`). (9) O modo de demonstração (DEC-104, DEC-125) ganha a importação: envio do modelo com a declaração, acompanhamento, avisos, perguntas do rascunho e publicação, que passa a ser o formulário impresso e identificado na página | Mesma fila, relógio e cota da leitura (DEC-124, DEC-142); só identificadores e contagens fora da tabela (RN-028) | definitivo | | Baixo | RN-049, RN-050, DEC-141, DEC-142, DEC-149, DEC-152, CA-045, CA-046, CA-047 |
| DEC-164 | 05/11/2026 | técnica | Lugar da exportação em formato longo no plano (CHG-015) | Dentro do IMP-004; IMP-007 antes do IMP-004 | IMP-007 novo, feito antes do IMP-004, que passa a ter o IMP-007 aceito como entrada; nada é renumerado. O IMP-007 entrega `exportData` e `getExport` só com `linha_por_item`: `agregado` e `linha_a_linha` são recusados com ERR-001 (`campos`: `escopo`) até o IMP-004. Entram também a neutralização de fórmulas (DEC-161), que o IMP-004 reaproveita nos outros escopos, e o job diário que apaga só os arquivos de exportação vencidos (DEC-069). O expurgo da RN-030, a lista de eliminações e a limpeza dos arquivos da importação (F-21) seguem no IMP-004 | Escolha do responsável (05/11/2026): a planilha antes dos dashboards; mesmo precedente da DEC-140 | definitivo | | Baixo | RF-012, IMP-004, IMP-007, DEC-140 |
| DEC-165 | 05/11/2026 | técnica | Arquivo da exportação (IMP-007) | Decidir no IA-DEV; fixar agora | (1) CSV em UTF-8 com BOM, separador `;`, linhas terminadas em CRLF e aspas duplas (RFC 4180) no campo com `;`, aspas ou quebra de linha, para abrir direto no Excel em português. (2) XLSX com uma planilha `Dados` e o cabeçalho na linha 1; toda célula é texto, exceto os valores de `escala` e `numero`, gravados como número; o CPF é sempre texto (DEC-155). (3) Arquivo pela interface Armazenamento (DEC-101), em `tenant/<tenant>/exportacao/<exportação>.<formato>`, com o mesmo link assinado local de 5 min das imagens (DEC-113); sem rota nova no contrato. (4) Uma tarefa por exportação, na fila do worker (DEC-124), sem retentativa (§4.2.1). (5) Auditoria `EXPORTAR_DADOS` no pedido (escopo, formato e projetos) e `EXPORTACAO_CONCLUIDA` ao gerar (número de aplicações e de linhas), sem valores (RN-028) | Um só formato de arquivo testável no IA-TEST; CSV em UTF-8 sem BOM abre com acentos errados no Excel | definitivo | | Baixo | RN-051, DEC-069, DEC-101, DEC-113, DEC-155, DEC-161 |
| DEC-167 | 05/11/2026 | técnica | Implementação da exportação em formato longo (IMP-007) | Outbox e biblioteca de planilha; tabela própria e gerador próprio | (1) `exportacao` e `tarefa_exportacao` (migração 0008), uma tarefa por exportação na fila em tabela do worker (DEC-124), com `situacao` pendente, concluida ou falhou, sem retentativa (DEC-165 (4)); `exportData` grava as duas na mesma transação, com a idempotência da REQ §6.5. (2) CSV e XLSX gerados sem biblioteca externa (`infra/planilha.ts`): XLSX mínimo com a planilha `Dados`, texto como string em linha e número só em `escala` e `numero`, num zip com deflate do próprio Node; sem dependência nova para auditar. (3) O expurgo dos arquivos vencidos roda a cada ciclo do worker, não só uma vez por dia: apaga o arquivo e grava `chave_storage` NULL assim que `expira_em` passa (DEC-069); a consulta já não devolve o link depois de `expira_em`. (4) O prazo de 60 s do job conta em tempo real; estourado ou com erro, a exportação vai para `falhou`, o arquivo gravado é apagado e a auditoria registra `EXPORTACAO_FALHOU`, sem valores. (5) `filtros` presente no corpo, mesmo vazio, é recusado com ERR-001 (DEC-163); `periodo.de` depois de `periodo.ate` também (`campos`: `periodo`). (6) Padrão de `retencao_exportacao_dias`: 7 (DEC-069, REQ §2.9) | Mesma fila e relógio dos testes da leitura e da importação; menos dependências no notebook | definitivo | | Baixo | RN-051, DEC-069, DEC-124, DEC-163, DEC-165, DEC-166 |
| DEC-168 | 05/11/2026 | técnica | Modo de demonstração com os dados guardados entre execuções (muda a DEC-104) | Manter descartável; usar o PostgreSQL da instalação do notebook | `npm run demo` deixa de ser descartável: (1) o banco fica no contêiner Docker `minhapesquisa-demo-pg` com o volume `minhapesquisa-demo-dados`, gerido pela CLI do Docker (criado na primeira vez, iniciado nas seguintes e parado ao encerrar), nunca no PostgreSQL da instalação, que tem os mesmos papéis (`mp_app`, `mp_manutencao`); (2) as imagens e as exportações vão para o armazenamento em disco (DEC-113) e os segredos (senhas do PostgreSQL, de `mp_app`, de `mp_manutencao` e da usuária, chaves de cifra e de HMAC) para `estado.json`, na pasta da demonstração (`%LOCALAPPDATA%\MinhaPesquisaDemo`, trocável por `MP_DEMO_PASTA`), separada da instalação; (3) a semente (tenant, usuária, projeto e formulário) só roda na primeira vez; migrações, papéis e cotação a cada início; (4) sem `estado.json`, os dados antigos não teriam como ser decifrados: contêiner e volume são apagados e tudo recomeça; `MP_DEMO_ZERAR=true` faz o mesmo de propósito; (5) a página escolhe o formulário atual entre as versões publicadas do projeto (`listForms`), a mais recente primeiro; (6) com `MP_DEMO_DATABASE_URL` a demonstração continua descartável (banco criado e apagado, armazenamento em memória, segredos novos) | Pedido do responsável em 05/11/2026: manter os dados entre as demonstrações. Os segredos ficam num arquivo local sem cifra, aceitável só porque a demonstração usa dados sintéticos (GX-001) e escuta só em 127.0.0.1 | definitivo | | Baixo | DEC-104, DEC-113, DEC-125, DEC-151, GX-001 |
| DEC-174 | 06/11/2026 | técnica | Implementação da localização das perguntas (CHG-017, IMP-008) | Detecção local de QR e marcadores com o mapa fixo; localização pela IA | (1) `ReadEngine` ganha a operação `localizar(pagina, perguntas)`: recebe a imagem da página já sem metadados e, por página da versão, a lista de perguntas (código, enunciado, tipo e, na matriz, as linhas), sem projeto, tenant nem respondente (RN-045); devolve `{pagina, confianca, regioes: [{codigo, x, y, largura, altura}]}` em coordenadas normalizadas 0..1 da imagem enviada; (2) a saída é validada contra esse schema com `additionalProperties: false`: qualquer campo a mais, código fora da versão ou região fora de 0..1 recusa a resposta, que conta como falha da chamada (retentativas da DEC-129, depois `erro_leitura`); (3) a localização é uma tarefa por página na `tarefa_leitura` (DEC-124), com reserva de orçamento própria (DEC-051), antes das tarefas de leitura da aplicação; (4) a página indicada vai para `numero_pagina` e as regiões para `regioes` (ENT-025); confiança da página abaixo de `limite_confianca`, página fora da versão ou divergente do QR → `identificacao_pendente` (DEC-171); (5) o recorte da leitura e o de `getItemImage` passam a sair de `regioes`, com uma folga de 2% de cada lado, limitada à imagem; regiões de identificação e de saúde ou outro que se sobrepõem (já com a folga) levam os dois itens a `a_revisar` sem leitura (RN-052); (6) o adaptador simulado devolve as regiões a partir do `mapa_layout` da versão, para os testes e a demonstração; (7) o recorte pelo `mapa_layout` (DEC-048 e DEC-124, item 2) deixa de ser usado na leitura | Foto e papel antigo sem marcadores (DEC-170) sem biblioteca de visão computacional no notebook; o schema fechado limita a resposta a posições (Risco 3) | definitivo | | Alto | DEC-022, DEC-043, DEC-048, DEC-051, DEC-124, DEC-129, DEC-170, DEC-171 |

---

### 12.3 Achados registrados para tratamento posterior (DEC-073)

Achados médios e baixos de revisões independentes aceitos para tratamento posterior, com responsável e incremento. Vazio enquanto não houver.

| Achado | Revisão | Severidade | Descrição | Responsável | Incremento |
| --- | --- | --- | --- | --- | --- |
| M-01 | REV-REQ-007 | médio | Dedução por comparação entre consultas (filtro F e ¬F sem cruzamento; período deslizante). Mitigação parcial pela DEC-071; resta a comparação entre períodos e entre projetos (B-N3 da REV-REQ-008) | Carlos Yano (decisão: aceitar o risco ou restringir período a meses fechados) | antes do IMP-004 |
| M-02 | REV-REQ-007 | médio | Aplicacao.cpf_hash não é limpo na eliminação | IA-DEV (CMP-LGPD) | IMP-004 |
| M-03 | REV-REQ-007 | médio | Valor e estado exatos dos itens sobrescritos na eliminação | IA-DEV + aprovação do responsável (CMP-LGPD) | IMP-004 |
| M-04 | REV-REQ-007 | médio | Pedido do titular sem Respondente (CPF só em aplicações em andamento ou já anonimizado) | Carlos Yano (decisão) + IA-DEV (CMP-LGPD) | antes do IMP-004 |
| M-05 | REV-REQ-007 | médio | Correções do pedido do titular sem coluna no dicionário; ENT-023.aplicacao_id NOT NULL | IA-DEV (CMP-LGPD) | IMP-004 |
| M-06 | REV-REQ-007 | médio | Formato, colunas e retenção dos arquivos de acesso, portabilidade e linha a linha | Carlos Yano (decisão) + IA-DEV (CMP-LGPD) | antes do IMP-004 |
| M-07 | REV-REQ-007 | médio | getPageImage expõe a página inteira sem reserva e em qualquer estado | — (decidido: DEC-099, incorporado na CHG-009) | IMP-002 |
| M-08 | REV-REQ-007 | médio | Reabertura: vínculo e anonimização do respondente órfão | IA-DEV (CMP-Respondents); decidido: DEC-078 | IMP-003 |
| M-09 | REV-REQ-007 | médio | Regras de salto: tipos de origem, ciclos e auto-referência | — (decidido: DEC-095, incorporado na CHG-009) | IMP-002 |
| M-10 | REV-REQ-007 | médio | Tipos agregáveis, cruzáveis e filtráveis; linha de matriz na consulta e na ficha | IA-DEV (CMP-Dashboard) | IMP-004 |
| M-11 | REV-REQ-007 | médio | Constraint de unicidade sem `competencia` | — (corrigido na CHG-006; registrado pela M-N6 da REV-REQ-008) | — |
| M-12 | REV-REQ-007 | médio | Desenho técnico de tenant inativo (DEC-070) no login, sessão e jobs | — (decidido: DEC-083) | IMP-001 |
| M-13 | REV-REQ-007 | médio | Injeção de instrução que altera outros campos da mesma chamada; subconjunto adversarial no conjunto-ouro | IA-DEV (CMP-MotorIA) | IMP-003 |
| M-14 | REV-REQ-007 | médio | Sensibilidade identificacao em pergunta de saúde | — (decidido: DEC-097, incorporado na CHG-009) | IMP-002 |
| M-15 | REV-REQ-007 | médio | Ordem e atomicidade da eliminação (registro externo primeiro, passos idempotentes) | IA-DEV (CMP-LGPD) | IMP-004 |
| M-16 | REV-REQ-007 | médio | Imagens órfãs no bucket após restore do banco | IA-DEV (CMP-Infra) | IMP-004 |
| M-17 | REV-REQ-007 | médio | Aviso da volta de sem_assinatura para em_revisao usa ERR-018 | IA-DEV (CMP-Revisao) | IMP-003 |
| M-18 | REV-REQ-007 | médio | Ausência dos outros quatro campos obrigatórios quando ilegível, rasurado ou não se aplica | IA-DEV (CMP-Revisao); decidido: DEC-079 | IMP-003 |
| M-19 | REV-REQ-007 | médio | ERR-036 não cobre os casos da RN-047 | — (decidido: DEC-096, incorporado na CHG-009) | IMP-002 |
| M-20 | REV-REQ-007 | médio | Consulta à lista de senhas vazadas sem DEC, timeout e comportamento em falha | — (decidido: DEC-084) | IMP-001 |
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
| B-11 | REV-REQ-007 | médio | Risco de perda de imagens e lista de buckets. Elevado a médio pelo responsável em 29/10/2026: a página 1 assinada é a evidência do consentimento | IA-DEV (CMP-Infra) | IMP-001 |
| M-N1 | REV-REQ-008 | médio | CA-003 (só página 2 → em leitura) contradiz a tabela de criação da FL-001 e o CA-013 | IA-DEV + aceite do responsável (corrigir o CA-003, mudança normativa) | IMP-003 |
| M-N2 | REV-REQ-008 | médio | Campo lido em branco fora de regra de salto | — (decidido: DEC-074, incorporado na CHG-007) | IMP-003 |
| M-N3 | REV-REQ-008 | médio | Contrato não distingue em branco, ilegível, rasurado e não se aplica no dashboard, na ficha e na exportação (RN-020) | IA-DEV (CMP-Dashboard, contrato) | IMP-004 |
| M-N4 | REV-REQ-008 | médio | Filtro em `escala` com intervalos quase livres; semântica do filtro em múltipla escolha | — (decidido: DEC-075, incorporado na CHG-007) | antes do IMP-004 |
| M-N5 | REV-REQ-008 | médio | Regra do complemento sem filtros, com vários projetos e com período | — (decidido: DEC-076, incorporado na CHG-007) | antes do IMP-004 |
| M-N6 | REV-REQ-008 | médio | M-11 da REV-REQ-007 ausente do §12.3 | — (registrado nesta tabela) | — |
| M-N7 | REV-REQ-008 | médio | Lacunas de negócio do §12.3 atribuídas à IA-DEV | — (M-08 e M-18 reclassificados para Q-025 e Q-026; M-01, M-04, M-06 e M-22 já estavam com o responsável) | — |
| M-N8 | REV-REQ-008 | médio | Aplicação descartada mantém os valores lidos sem prazo | — (decidido: DEC-077, incorporado na CHG-007; reaplicação após restore pela ListaEliminacoes) | IMP-003 |
| B-N1 | REV-REQ-008 | baixo | Checklist da REQ cita REV-REQ-007 como última revisão | IA-DEV | próxima versão da REQ |
| B-N2 | REV-REQ-008 | baixo | CHG-006 fora da tabela de mudanças do PLANO §12 | — (incluída na v2.10) | — |
| B-N3 | REV-REQ-008 | baixo | Ampliar M-01 e registrar a mitigação parcial da DEC-071 | — (feito na linha M-01) | — |
| B-N4 | REV-REQ-008 | baixo | RF-010 sem ERR-024 (descontinuado na v2.1), ERR-001 e ERR-019 na lista de erros | IA-DEV (CMP-LGPD) | IMP-004 |
| B-N5 | REV-REQ-008 | baixo | CPF mascarado no CA-002 × formato canônico do dicionário | IA-DEV (CMP-Respondents) | IMP-003 |
| B-N6 | REV-REQ-008 | baixo | Faixa de idade abaixo de 60 ausente da DEC-071 | — (decidido: DEC-081, incorporado na CHG-007) | antes do IMP-004 |
| B-N7 | REV-REQ-008 | baixo | Concessão individual a usuário sem o perfil exigido | — (decidido: DEC-080, incorporado na CHG-007) | IMP-001 |
| B-N8 | REV-REQ-008 | baixo | `versao_id` de outro tenant no `identifyApplication`: 404 (TS-001) × ERR-039 | — (decidido: DEC-100, incorporado na CHG-009) | IMP-002 |
| B-N9 | REV-REQ-008 | baixo | Reuso do mesmo código TOTP na janela de tempo e parâmetros do Argon2id | — (decidido: DEC-085) | IMP-001 |
| B-N10 | REV-REQ-008 | baixo | Erro de `saveReview` em item `aguardando_condicao` não definido | IA-DEV (CMP-Revisao) | IMP-003 |
| B-N11 | REV-REQ-008 | baixo | Cópia de data, local e aplicador para a aplicação na conclusão | IA-DEV (CMP-Revisao) | IMP-003 |
| V-M1 | verificação CHG-007 | médio | Exemplos testáveis dos filtros das DEC-075, DEC-076 e DEC-081 (`em` em escala → ERR-001; "marcou a opção"; sem filtro; vários projetos; período; faixa `<60`) e validação por tipo no schema Filter | IA-TEST + IA-DEV (CMP-Dashboard) | IMP-004 |
| V-M2 | verificação CHG-007 | médio | Exemplo do CA-032 para campo obrigatório ilegível (DEC-079) | IA-TEST (CMP-Revisao) | IMP-003 |
| V-B1 | verificação CHG-007 | baixo | `startMfaSetup` repetido na mesma pré-sessão sobrescreve o segredo não confirmado (seguro, mas implícito) | — (decidido: DEC-086) | IMP-001 |
| V-B2 | verificação CHG-007 | baixo | Exemplo de reset do MFA entre o login e a chamada de MFA | — (teste no IA-TEST do IMP-001) | IMP-001 |
| V-B3 | verificação CHG-007 | baixo | CA-023, TS-005 e TS-008 ainda descrevem a ListaEliminacoes só para eliminação; faltam exemplos de reaplicação dos motivos `descarte_aplicacao` e `anonimizacao_reabertura` | IA-DEV + IA-TEST (CMP-LGPD) | IMP-004 |
| F-07 | revisão focada do IMP-003 (05/11/2026) | médio | Reversão em cadeia (CA-042): histórico já revertido de outra aplicação ainda conta como alteração posterior; atributo mantido sem auditoria da divergência (PLANO §4.4) | IA-DEV (CMP-Respondents) | — (tratado: DEC-131) |
| F-08 | revisão focada do IMP-003 (05/11/2026) | médio | Duas conclusões simultâneas do mesmo CPF: a segunda recebe ERR-020 (CPF novo) ou grava o mesmo valor anterior no histórico (CPF existente); falta trava pelo hash do CPF | IA-DEV (CMP-Respondents) | — (tratado: DEC-131) |
| F-09 | revisão focada do IMP-003 (05/11/2026) | médio | Worker usa mp_manutencao (BYPASSRLS) dentro do processo da API; PLANO §4.7 reserva esse papel aos jobs agendados | IA-DEV (CMP-MotorIA) | antes do piloto (com a revisão completa); o IMP-004 não deve copiar o padrão |
| F-10 | revisão focada do IMP-003 (05/11/2026) | médio | Queda entre a chamada à IA e a gravação: a reserva estimada não é ajustada e a tentativa não é contada (DEC-051) | IA-DEV (CMP-MotorIA) | antes do piloto |
| F-12 | revisão focada do IMP-003 (05/11/2026) | médio | Recortes empilhados sem rótulo: as instruções ao modelo não ligam o i-ésimo recorte ao i-ésimo campo (RN-045) | IA-DEV (CMP-MotorIA) | — (tratado: DEC-131) |
| F-13 | revisão focada do IMP-003 (05/11/2026) | médio | DEC-124 (sem correção de perspectiva) contradiz a DEC-048 (correção antes do recorte); recorte deslocado pode levar identificação junto com saúde (RN-038) | Carlos Yano (Q-036, adiada) + IA-DEV | antes do piloto, quando a digitalização por celular entrar |
| F-14 | revisão focada do IMP-003 (05/11/2026) | médio | Checks de integridade da aplicação do §5.3 (concluída com data e local; versão fora de identificacao_pendente) ausentes nas migrações | IA-DEV (CMP-Revisao) | — (tratado: DEC-131) |
| F-15 | revisão focada do IMP-003 (05/11/2026) | médio | Pergunta do tipo cpf sem campo_respondente fica em claro em item_resposta (RN-025) | IA-DEV (CMP-Formularios) | — (tratado: DEC-131) |
| F-16 | revisão focada do IMP-003 (05/11/2026) | baixo | Chave enviada ao modelo é o código da pergunta (revela o tema de saúde); um índice opaco basta (RN-045) | IA-DEV (CMP-MotorIA) | — (tratado: DEC-131) |
| F-17 | revisão focada do IMP-003 (05/11/2026) | baixo | Trigger de imutabilidade impede expurgar entradas vencidas da ListaEliminacoes (§5.6) | IA-DEV (CMP-LGPD) | IMP-004 |
| F-18 | revisão focada do IMP-003 (05/11/2026) | baixo | Índice item_resposta (tenant_id, pergunta_id) do §5.4 ausente | IA-DEV (CMP-Dashboard) | IMP-004 |
| F-19 | revisão focada do IMP-003 (05/11/2026) | baixo | Texto lido do papel é gravado como veio; a exportação precisa neutralizar fórmulas (RN-037) | — (decidido: DEC-161, revista pela DEC-166, incorporado na CHG-015) | IMP-007 |
| F-20 | análise da CHG-014 (05/11/2026) | médio | O PDF não confere se as perguntas cabem na página: as que passam do rodapé saem fora da folha, sem erro (`posicionar` em `pdf.ts`). A importação distribui pela altura (DEC-142), mas a edição manual pode estourar a página | — (decidido: DEC-143, incorporado na CHG-014) | IMP-006 |
| S-12 | revisão focada da CHG-014 (REV-REQ-010) | baixo | CA-047 ex. 8 e CA-048 ex. 7 sem dados concretos de altura; a área útil da página 1 depende do `termo_consentimento` | IA-TEST (CMP-Forms): fixar no teste o termo padrão e o número de perguntas que estoura a página | IMP-006 |
| F-21 | IA-DEV do IMP-006 (05/11/2026) | baixo | O job diário que apaga os arquivos que sobrarem de importações terminadas (§4.8, DEC-142) ainda não existe; o worker já apaga os arquivos ao fim, e só uma exclusão que falhe deixa resto. Adiado pelo responsável (Carlos Yano, 05/11/2026) para o job diário de expurgo da RN-030 | IA-DEV (CMP-LGPD), junto com o expurgo | IMP-004 |

## 13. Critério de prontidão e ciclo de verificação

- [x] Todo RF tem tratamento técnico identificado
- [x] Modelo físico e contrato definidos (OpenAPI é artefato irmão deste plano)
- [x] Estratégia de testes cobre todos os 50 CAs da REQ v2.7
- [x] Dependências e GX explícitas; nenhuma suposição crítica oculta (lacunas de negócio Q-005 a Q-011 respondidas e incorporadas como DEC-054 a DEC-060)
- [x] Validador de consistência sem achados (`tools/validar_consistencia.py`)
- [x] Q-005 a Q-011 respondidas
- [x] CHG-002 e CHG-003 aceitas pelo responsável
- [x] Q-012 a Q-030 respondidas; CHG-004 a CHG-008 aceitas
- [x] Revisão independente (REV-PLANO-010) com 0 bloqueantes e 0 altos; médios e baixos registrados no §12.3 (DEC-061, DEC-073)

**Bloqueio de status:** este plano NÃO pode ser declarado PRONTO PARA IMPLEMENTAÇÃO
enquanto os itens acima não estiverem marcados.

Histórico de rodadas em `registros/revisoes.csv` (namespace REV-PLANO-xxx, distinto de REV-REQ-xxx).

---

## Bloco 2 — Matriz canônica (projeção legível)

A matriz canônica vive em `registros/matriz_rastreabilidade.csv` e é idêntica à
REQ §8.1; o CI falha se divergirem.

| Requisito | Regra | Entidade | Fluxo | História | Critério | Teste Sentinela | Operation ID | Componente | Incremento |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | RN-001, RN-006, RN-007 | ENT-001, ENT-002 | FL-001 | US-010 | CA-012, CA-035, CA-037 | TS-001 | installLocalAccount (interna), resetLocalPassword (interna) | CMP-Auth | IMP-001 |
| RF-002 | RN-048 | ENT-002, ENT-027, ENT-030 | FL-001 | US-010 | CA-026 | — | login, logout, getCurrentSession | CMP-Auth | IMP-001 |
| RF-003 | RN-027 | ENT-004, ENT-020, ENT-021 | FL-001 | US-006 | CA-027 | — | listProjects, getProject, createProject, updateProject, archiveProject, unarchiveProject | CMP-Projects | IMP-002 |
| RF-004 | RN-017, RN-018, RN-019, RN-021, RN-042, RN-047, RN-050 | ENT-005, ENT-006, ENT-007, ENT-008, ENT-016, ENT-024 | FL-001 | US-007 | CA-001, CA-028, CA-036 | TS-006 | listForms, createForm, getVersion, createVersion, updateVersion, publishVersion, generatePdf | CMP-Forms | IMP-002 |
| RF-005 | RN-011, RN-012, RN-014, RN-015 | ENT-009, ENT-010 | FL-001, FL-002 | US-003 | CA-002, CA-014, CA-014b, CA-032 | — | linkRespondent (interna) | CMP-Respondents | IMP-003 |
| RF-006 | RN-040 | ENT-010, ENT-011, ENT-025, ENT-029 | FL-001 | US-001 | CA-003, CA-004, CA-013, CA-029, CA-039, CA-040 | TS-002 | uploadImages, identifyApplication, addApplicationPages, getPageImage | CMP-Upload | IMP-002 |
| RF-007 | RN-021, RN-037, RN-038, RN-039 | ENT-011 | FL-001, FL-002 | US-002, US-007 | CA-005, CA-006, CA-015, CA-018, CA-019, CA-030, CA-041 | TS-003, TS-007 | processAIReading (interna), getQuotaStatus | CMP-MotorIA | IMP-003 |
| RF-008 | RN-016, RN-043, RN-044 | ENT-009, ENT-010, ENT-011, ENT-023 | FL-001, FL-002 | US-002, US-003, US-007 | CA-007, CA-008, CA-020, CA-021, CA-033, CA-042, CA-044 | — | listReviewQueue, getApplication, openReview, getItemImage, saveReview, confirmApplication, attachSignaturePage, retryReading, discardApplication, reopenApplication | CMP-Revisao | IMP-003 |
| RF-009 | RN-026 | ENT-012 | FL-001 | US-004, US-007, US-008 | CA-009, CA-011, CA-017, CA-021, CA-031 | — | getDashboardAggregated, listGroups, createGroup, deleteGroup, findRespondent, getIndividualRecord | CMP-Dashboard | IMP-004 |
| RF-010 | RN-027, RN-030, RN-031 | ENT-009, ENT-013, ENT-018, ENT-019, ENT-023, ENT-026 | FL-001, FL-003 | US-005, US-009 | CA-021, CA-022, CA-023, CA-024 | TS-005, TS-008 | exportData, getExport, createDataSubjectRequest, listDataSubjectRequests, getDataSubjectRequest, executeDataSubjectRequest, cancelDataSubjectRequest, listAuditEvents | CMP-LGPD | IMP-004 |
| RF-011 | RN-017, RN-018, RN-019, RN-036, RN-037, RN-038, RN-047, RN-049, RN-050 | ENT-004, ENT-005, ENT-006, ENT-007, ENT-008, ENT-024, ENT-031 | FL-004 | US-006, US-011 | CA-045, CA-046, CA-047, CA-048, CA-049 | — | importForm, listFormImports, getFormImport, extractFormStructure (interna) | CMP-Forms | IMP-006 |
| RF-012 | RN-020, RN-030, RN-037, RN-051 | ENT-009, ENT-010, ENT-011, ENT-013, ENT-026 | FL-001 | US-009, US-012 | CA-021, CA-050, CA-051 | — | exportData, getExport | CMP-LGPD | IMP-007 |
| RF-013 | RN-036, RN-038, RN-039, RN-041, RN-045, RN-052 | ENT-006, ENT-009, ENT-010, ENT-025 | FL-001, FL-002 | US-001, US-003 | CA-052, CA-053, CA-054, CA-055 | — | uploadImages, identifyApplication, confirmApplication, processAIReading (interna) | CMP-Upload, CMP-MotorIA | IMP-008 |

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
| REV-PLANO-010 | 28/10/2026 | Agente revisor-independente (verificação) | 2.9 | 0 | 2 | 8 | 11 | Resolvido | Ver REV-REQ-008 (mesma rodada). A-01 e A-02 corrigidos (PLANO §4.1 e §4.6); verificação restrita ao diff aprovada (0 bloqueantes, 0 altos). Médios e baixos no §12.3. |
| REV-PLANO-011 | 05/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 3.10 | 0 | 0 | 1 | 1 | Resolvido | Rodada focada da CHG-014, junto com a REV-REQ-009: a fila da importação não cabia na `tarefa_leitura` (R-08, médio; tabela `tarefa_importacao` na DEC-142 e nos §4.7, §4.8, §5.1, §5.3 e §5.6) e o "Próximo: IMP-004" do aceite do IMP-003 (R-16, baixo). |
| REV-PLANO-012 | 05/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 3.10 | 0 | 0 | 1 | 3 | Resolvido | Rodada 2 da CHG-014, junto com a REV-REQ-010: testes do IMP-002 alcançados (R-04, médio) e riscos de teste da importação (S-07, médio) no §11, §8, §10 e §10.2; `campo_padrao` na DEC-141 (S-09), escopo do IMP-006 e §1 (S-10) e local do extrator (S-11), baixos. |

---

**Fim do documento `PLANO.md` v3.1**
