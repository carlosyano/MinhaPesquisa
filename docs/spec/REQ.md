REQ.md — MinhaPesquisa
Especificação funcional (fonte da verdade para as IAs)

Status: APROVADO (Gate 1) · CHG-002 a CHG-011 aceitas (CHG-011 propagada na v2.1, IMP-005) · CHG-013 aceita na v2.3 · CHG-014 aceita na v2.4 · CHG-015 aceita na v2.5 · CHG-016 aceita na v2.6 · CHG-017 aceita na v2.7 (Q-063 a Q-071 respondidas; REV-REQ-011 a REV-REQ-015; Q-072 a Q-081 respondidas; ciclo de revisão encerrado pela DEC-073 na rodada 5; Q-082 e Q-083, do IA-DEV do IMP-008, respondidas) · CHG-018 aceita na v2.8 em 07/11/2026 (Q-084 a Q-098 respondidas; rodadas 1 a 4 corrigidas, REV-REQ-016 a REV-REQ-019; ciclo de revisão encerrado pela DEC-073 na rodada 4) · CHG-019 aceita na v2.9 em 13/11/2026 (Q-099 a Q-118 respondidas; ciclo de revisão fechado na rodada 6, REV-REQ-020 a REV-REQ-025, e Q-115 a Q-117 conferidas na rodada 6, REV-REQ-025)
Versão: 2.9
Data de aprovação: 24/10/2026 (v1.2) · 27/10/2026 (v1.3, CHG-002; v1.4, CHG-003) · 28/10/2026 (v1.5 e v1.6, CHG-004; v1.7, CHG-005; v1.8, CHG-006) · 29/10/2026 (v1.9, CHG-007; v1.10, CHG-008) · 03/11/2026 (v1.11, CHG-009; v1.12, CHG-010; v2.0 e v2.1, CHG-011) · 05/11/2026 (v2.3, CHG-013; v2.4, CHG-014; v2.5, CHG-015; v2.6, CHG-016) · 06/11/2026 (v2.7, CHG-017) · 07/11/2026 (v2.8, CHG-018) · 10/11/2026 (v2.9, CHG-019, proposta)
Nível de rigor: Completo (DEC-001)
Perfil de plataforma: Bloco P — Web SaaS com dados pessoais (confirmado), aplicado no que couber à aplicação local da DEC-107
Responsável: Carlos Yano

Nota da v2.0 e da v2.1 (CHG-011): o produto deixa de ser um SaaS na nuvem e passa a ser uma aplicação local num notebook, usada por uma única pessoa (DEC-107 a DEC-112 e DEC-117). A v2.1 propaga as decisões às regras, aos requisitos, às telas, aos estados, aos critérios de aceite, ao catálogo de erros e à matriz (IMP-005). Saíram os CA-010, CA-016, CA-025, CA-026b, CA-034, CA-037b, CA-038 e CA-043, as telas TL-002, TL-013 e TL-014 e o TS-004. As entidades de perfis, vínculos, concessões, reservas e tokens continuam no dicionário porque as tabelas ficam no banco sem uso (DEC-116). Nos fluxos, estados e CAs, "digitalizador", "revisor", "administrador" e "analista" designam papéis que a própria usuária exerce (DEC-109).

Nota da v2.4 (CHG-014, Change Request de 05/11/2026 em `docs/historico/`): o formulário pode ser criado a partir de um formulário que já existe, em branco ou preenchido com dados fictícios, com a estrutura lida pela IA e curada pela usuária (RF-011, DEC-132 a DEC-139). Todo rascunho novo já nasce com os 5 campos obrigatórios (DEC-135), e o projeto ganha objetivo, coordenador e período de coleta (DEC-137). A exportação em formato longo do mesmo documento entra na v2.5 (CHG-015).

Nota da v2.5 (CHG-015, seção 3 do mesmo Change Request): a exportação ganha o escopo `linha_por_item` (formato longo), uma linha por item respondido, com nome e CPF do respondente, pronta para tabela dinâmica (RF-012, RN-051, DEC-153 a DEC-163). A exportação passa a neutralizar fórmulas em células de texto (DEC-161).

Nota da v2.6 (CHG-016, IA-TEST do IMP-007): o apóstrofo contra fórmulas fica só no CSV; no XLSX o texto sai como está, em célula de texto, nunca como fórmula (Q-062, DEC-166, que substitui a DEC-161).

Nota da v2.7 (CHG-017, Change Request de 06/11/2026 em `docs/historico/`, revisto com o responsável): a usuária passa a digitalizar também pesquisas antigas, sem QR e sem os marcadores dos cantos, por scanner ou foto. Em toda página, a IA recebe a página inteira numa chamada só de localização, que devolve qual página da versão é a folha e a região de cada pergunta, sem ler nenhum valor; a leitura continua por recortes, em chamadas separadas (DEC-169 a DEC-171, exceção da RN-038). Sem QR, a usuária escolhe a versão no envio. A versão de papel antigo dispensa CPF e assinatura na conclusão (DEC-172), e a base legal desses dados é garantida fora do sistema (DEC-173). As Q-063 a Q-065 foram respondidas em 06/11/2026: o papel antigo é marcado na versão (DEC-175), o respondente sem CPF é vinculado só pelo nome, com a data de nascimento também dispensada (DEC-176), e a pergunta que a localização não encontra vai à revisão sem leitura (DEC-177). A revisão focada (REV-REQ-011) levou às Q-066 a Q-068: limite próprio de confiança da página (DEC-178), perguntas que "não constam" no papel antigo, com data e local digitados no envio e guardados como padrão do projeto (DEC-179), e o QR legível sempre decide a versão (DEC-180). A rodada 2 (REV-REQ-012) levou às Q-069 a Q-071: a importação de papel antigo mantém a página original de cada pergunta (DEC-181), data e local do envio só valem quando a versão final é de papel antigo (DEC-182) e a página 1 assinada sem QR é conferida pela usuária (DEC-183). A rodada 3 (REV-REQ-013), feita depois do aceite, levou às Q-072 e Q-073: aplicação com folha de QR legível, válido ou não, nunca recebe versão de papel antigo (DEC-184), e data e local do envio ficam guardados enquanto a aplicação está em `identificacao_pendente` (DEC-185). A rodada 4 (REV-REQ-014) levou às Q-074 a Q-079: data e local são aplicados ou apagados só quando a localização confirma a versão e as páginas (DEC-186); só conta o QR do MinhaPesquisa (DEC-187); a folha de página sem perguntas é reconhecida por eliminação (DEC-188); a cópia leva o total de páginas do papel antigo (DEC-189); os campos que o papel antigo não tem entram no início da página 1 (DEC-190); e a eliminação de respondente sem CPF lista as aplicações de papel antigo de mesmo nome (DEC-191). A rodada 5 (REV-REQ-015) encerrou o ciclo, com 0 bloqueantes e 0 altos, e levou às Q-080 e Q-081: o padrão de data e local muda no próprio envio (DEC-192), e a lista da eliminação usa o NOME revisado ou o lido e fica gravada no pedido (DEC-193). O IA-DEV do IMP-008 levou às Q-082 e Q-083: a múltipla escolha de papel antigo dispensa "nenhuma das anteriores" (DEC-195), e a contagem de folhas no envio vale também sem QR (DEC-196). Desde a v2.9 (DEC-216), a leitura também é da página inteira, sem recortes nem chamadas separadas.

Nota da v2.8 (CHG-018, testes preliminares do responsável em 07/11/2026): as Q-084 e Q-085 foram respondidas em 07/11/2026. A opção "Outro" ganha um texto complementar, lido, revisado e exportado numa coluna própria (DEC-197), e o nome do arquivo enviado é gravado como dado pessoal, mostrado no resultado e exportado (DEC-198). As Q-086 a Q-089, abertas na propagação, foram respondidas no mesmo dia: o complemento é opcional (DEC-199), segue a regra geral de confiança (DEC-200), sai nas colunas `Arquivo` e `Complemento` do formato longo (DEC-201) e é marcado também no editor, com uma linha impressa no PDF (DEC-202). O complemento é um item de resposta próprio, ligado à opção (RN-009, ENT-011), que só vale quando a opção é marcada (FL-002, pré-regra 1b). A rodada 1 da revisão (REV-REQ-016) levou às Q-090 a Q-093: o complemento e o arquivo vão também à exportação linha a linha (DEC-207), a revisão humana do complemento é mantida enquanto a opção continua marcada (DEC-204), o nome do arquivo é apagado no ato da eliminação do titular (DEC-206) e o texto escrito ao lado de uma opção não marcada vai à revisão como inconsistência (DEC-205). A rodada 2 (REV-REQ-017) levou à Q-094: quando a própria usuária tira a opção na revisão, o complemento vai direto a `nao_se_aplica` (DEC-208). A rodada 3 (REV-REQ-018) levou às Q-095 a Q-097: o texto ao lado de uma opção não marcada vai à revisão só quando o valor da pergunta veio da leitura ou da regra de salto, e não quando a própria usuária resolveu a pergunta (DEC-209, que substitui a DEC-208); o nome do arquivo é apagado no ato também nas aplicações descartadas pela própria eliminação (DEC-210); e a ficha individual mostra o complemento, sem o nome do arquivo (DEC-211). A rodada 4 (REV-REQ-019) atingiu o critério de parada da DEC-073 e levou à Q-098: o `nao_se_aplica` que a usuária marca no complemento de opção não marcada é mantido enquanto a opção continuar não marcada (DEC-212).

Nota da v2.9 (CHG-019, Change Request de 10/11/2026 em `docs/historico/`): nos testes com CPF e data da aplicação em caixas, nada era lido, porque o bloco do CPF ficava encostado no da data e a regra de sobreposição da RN-052 (item 5) mandava os dois à revisão sem leitura. O responsável decidiu: projeto e formulário são escolhidos sempre antes do envio (DEC-215); a leitura passa a receber a página inteira com o gabarito das perguntas dela, sem recortes e sem separar identificação de saúde (DEC-216, que revoga a RN-052 item 5 e a RN-039 e torna geral a exceção da RN-038); o QR passa a ser legível por humanos, `PPPPP.FFF.VV.X/Y`, com códigos sequenciais do projeto e do formulário (DEC-217, DEC-218); o QR antigo conta como ausente (DEC-218); e o PDF ganha cabeçalho, rodapé legível e espaçamento entre blocos (DEC-219). As Q-099 a Q-104 foram respondidas em 10/11/2026. A rodada 1 da revisão (REV-REQ-020) levou às Q-105 e Q-106, respondidas no mesmo dia: o formulário escolhido fica fixo na aplicação (DEC-221) e a folha acrescentada depois com QR de outro projeto ou formulário também é recusada com ERR-045 (DEC-222).

1. Resumo em linguagem simples

O MinhaPesquisa é uma aplicação local, instalada num notebook e usada por uma única pessoa (DEC-107), que transforma formulários de pesquisa respondidos em papel por público 60+ em dados estruturados, prontos para relatórios, dashboards e análises individuais ou por grupo. O sistema recebe imagens (scanner ou celular), identifica cada página pelo QR code ou, sem QR, pela versão escolhida pela usuária e pela identificação feita pela IA, sempre dentro do projeto e do formulário escolhidos no envio (DEC-169, DEC-215), lê os campos por IA com confiança por campo, envia para revisão humana quando a confiança é baixa ou o valor é inválido, e produz dashboards e exportações (sem k-anonimato, DEC-110). Dados, imagens e backups ficam no notebook; só as páginas inteiras, na identificação e na leitura (DEC-170, DEC-216), vão ao provedor de IA na nuvem, que pode processar fora do Brasil (DEC-111), além das páginas de formulários-modelo sem dado pessoal enviadas na importação (DEC-133). Todo o tratamento de dados pessoais sensíveis de saúde segue a LGPD, com disco cifrado, backup cifrado, auditoria imutável, direitos do titular e transferência internacional das páginas para IA condicionada a parecer jurídico. A especificação está APROVADA para prosseguir à Fase 3 (Arquitetura) e, em seguida, à implementação por incrementos.

2. Sumário executivo e escopo

2.1 Objetivo

Digitalizar, validar e analisar pesquisas em papel com governança LGPD, rastreabilidade total e revisão humana assistida por IA, mantendo a evolução individual do respondente ao longo do tempo.

2.2 Atores

| Ator | Descrição |
|---|---|
| Usuária (única, DEC-107 e DEC-109) | A única pessoa que usa o sistema, no próprio notebook. Acumula o que antes eram cinco papéis: instala e configura por script (antigo administrador da plataforma); cuida de projetos, formulários, parâmetros, auditoria e direitos do titular (administrador do tenant); faz upload, revisa leituras, confere CPF e assinatura, descarta e reabre aplicações (digitalizador); vê dashboards e fichas individuais e exporta linha a linha (analista com acesso individual). Entra só com senha local (DEC-108). |
| Respondente | Pessoa 60+ que responde formulários em papel. Pode responder vários formulários do mesmo projeto ou de projetos diferentes ao longo do tempo. |

2.3 Instituição usuária

Uma única instituição (clínica, cooperativa ou outra entidade que conduza pesquisas impressas), registrada como o único tenant, criado na instalação (DEC-107). Não há venda como serviço nem outras instituições. Volume inicial: cerca de 500 formulários por mês, digitalizados por scanner ou foto de celular.

2.4 Integrações previstas

- Provedor de IA na nuvem para a localização das perguntas na página (DEC-170), para a leitura de campos e para a leitura da estrutura de formulários importados (contrato sem retenção e sem uso para treino; pode processar fora do Brasil, DEC-111). É a única integração externa.
- Imagens, banco e backups ficam no notebook (DEC-107); não há armazenamento em nuvem, e-mail nem monitoramento em nuvem.

2.5 Fontes e precedência

1. Decisões de negócio aprovadas pelo responsável (respostas a Q-xxx e DEC-xxx definitivas).
2. Esta especificação (REQ), com a tabela de decisões (seção 3) prevalecendo sobre o texto.
3. Decisões técnicas (DEC-xxx técnicas) e plano técnico derivados.
4. Bloco P confirmado para o projeto (em `docs/spec/BLOCO_P.md`).
5. Recomendações da IA.
6. Evidências de implementação e testes (não são fonte normativa).

2.6 Dentro do escopo da v1

- Cadastro de projetos, formulários (com versões), perguntas e respondentes, com geração do formulário imprimível em PDF com QR code.
- Criação do formulário a partir de um formulário existente (imagem ou PDF, em branco ou com dados fictícios), com a estrutura lida por IA e curada pela usuária (RF-011, DEC-132).
- Upload de imagens (scanner e celular) e leitura automática por IA.
- Pesquisas antigas, sem QR e sem marcadores, por scanner ou foto, com a versão escolhida no envio e as perguntas localizadas pela IA (DEC-169, DEC-170).
- Fila de revisão humana para campos com baixa confiança.
- Armazenamento estruturado por item de resposta.
- Relatórios e dashboards por projeto, por formulário, por respondente e por grupo dinâmico (filtros por idade, estado civil, condição de saúde etc.).
- Acesso por senha local, trilha de auditoria, exportação e direitos do titular.
- Exportação em formato longo (uma linha por item, XLSX ou CSV), pronta para tabela dinâmica (RF-012, DEC-153).
- Texto escrito ao lado da opção "Outro", lido, revisado e exportado, e nome do arquivo enviado guardado em cada página e exportado (RF-014, DEC-197, DEC-198).
- Projeto e formulário escolhidos antes de todo envio, leitura da página inteira pela IA e QR legível por humanos, com cabeçalho e rodapé no PDF (RF-015, DEC-215 a DEC-219).
- Instalação local, disco cifrado e backup diário cifrado em disco externo (DEC-107, DEC-117).

2.7 Fora do escopo da v1 (etapa posterior)

- Editor visual de layout dos formulários.
- Biblioteca de perguntas reutilizáveis.
- Importação de Microsoft Forms, Google Forms e XLSForm (DEC-016; a importação por imagem da DEC-132 é outra funcionalidade).
- Exportação para SPSS e R.
- Permissão por linha (por usuário ou por condição).
- Gestão de tenants por tela (criar, suspender, configurar); cobrança e assinatura do SaaS.

Fora do produto a partir da v2.0 (CHG-011, sem previsão de volta): vários tenants, várias pessoas usuárias, perfis, vínculos a projetos e concessões de acesso individual (DEC-109); MFA, convites e e-mail (DEC-108); k-anonimato nos painéis e exportações (DEC-110); reserva de aplicação para revisão (DEC-112); implantação em nuvem (DEC-107).

2.8 Riscos aceitos na v1

#### Risco 1 — Páginas de pessoas diferentes na mesma aplicação (DEC-008, DEC-171)

A v1 não verifica automaticamente se todas as páginas de um envio são da mesma pessoa; a garantia é de quem digitaliza. O alerta do CA-013 detecta página faltante ou repetida, mas não a troca de páginas entre respondentes. Sem QR, a ordem das folhas no arquivo não importa: a IA indica qual página da versão é cada folha (DEC-171); a troca de folhas entre duas pessoas do mesmo formulário continua sem detecção, e no papel antigo, que costuma vir em maços, é mais provável.

| Campo | Descrição |
|---|---|
| Causa | Agrupamento manual das páginas no upload; maços de papel antigo digitalizados em sequência |
| Impacto | Dados de saúde de dois respondentes misturados, sem aviso, contaminando a análise individual e os relatórios |
| Probabilidade | Maior em formulários de várias páginas, em lotes grandes de scanner e no papel antigo |
| Mitigação na v1 | Procedimento operacional: digitalizar uma aplicação por vez (um arquivo por pessoa) e conferir as páginas antes de enviar; página faltante, repetida ou não reconhecida pela IA vai para `identificacao_pendente` (CA-013, CA-053); correção pela revisão, com auditoria |
| Tratamento futuro | ID único por cópia impressa no QR, ou comparação automática do nome lido em cada página |

#### Risco 2 — Dados num único notebook (DEC-107)

Todo o banco, as imagens e os dados de saúde ficam num só equipamento.

| Campo | Descrição |
|---|---|
| Causa | Aplicação local, sem nuvem (DEC-107) |
| Impacto | Perda dos dados por defeito, roubo ou perda do notebook; acesso indevido se a máquina for levada desbloqueada |
| Probabilidade | Baixa para defeito ou roubo em um ano, mas com impacto alto |
| Mitigação na v2.0 | Disco cifrado (BitLocker) obrigatório; senha local com bloqueio por tentativas (DEC-108); backup diário cifrado em disco externo guardado longe do notebook (DEC-117); teste periódico de restauração |
| Fora da v2.0 | Alta disponibilidade e acesso por outra máquina |

O antigo Risco 2 (grupo mínimo reduzido até 1) deixa de existir: o k-anonimato foi retirado (DEC-110).

#### Risco 3 — Página inteira enviada ao provedor de IA (DEC-170, DEC-216)

Toda página de formulário vai inteira ao provedor de IA, com nome, CPF e respostas de saúde juntos: primeiro na identificação da página e depois na leitura dos valores (DEC-216). A partir da v2.9 isso é a regra, e não mais a exceção à RN-038 escolhida pelo responsável em 06/11/2026; o responsável aceitou o risco em 10/11/2026 (Q-099).

| Campo | Descrição |
|---|---|
| Causa | Identificação e leitura pela IA sobre a página inteira em todas as páginas (DEC-170, DEC-216) |
| Impacto | O provedor recebe e lê, numa mesma chamada, identificação e dados de saúde da pessoa; um vazamento no provedor expõe a página inteira com os valores |
| Probabilidade | Baixa, com provedor sem retenção e sem uso para treino (RN-032, DPA), mas com impacto alto |
| Mitigação na v1 | Provedor sem retenção e sem uso para treino (RN-032); a chamada não leva projeto, tenant nem identificador do respondente (RN-045); metadados removidos (RN-040); a resposta é validada contra o gabarito (RN-037); dados reais só depois do GX-001, que cobre a página inteira lida |
| Tratamento futuro | Identificação e leitura no próprio notebook, sem enviar a página |

2.9 Parâmetros de configuração (RN-008)

| Chave | Escopo | Padrão | Faixa | Quem altera | Origem |
|---|---|---|---|---|---|
| limite_confianca | plataforma | 1,00 até a calibração no conjunto-ouro, sem confirmação automática (DEC-127); depois, 0,90 (provisório, DEC-028) | 0..1, calibrado no conjunto-ouro | Administrador da plataforma, por script, com auditoria | DEC-028, DEC-059, DEC-127 |
| limite_confianca_localizacao | plataforma | 0,50 (provisório até a calibração no conjunto-ouro, DEC-178) | 0..1, calibrado no conjunto-ouro | Administrador da plataforma, por script, com auditoria | DEC-178 |
| custo_ia_teto | tenant | R$ 500,00/mês | ≥ 0 | Administrador da plataforma, por script, com auditoria | DEC-035, DEC-058, DEC-059 |
| retencao_dias | tenant | NULL (sem expurgo por tempo até GX-001) | 1..3650 | Administrador da plataforma, por script, com auditoria | RN-030, Q-002, DEC-059 |
| cotacao_usd_brl | plataforma, por mês civil | — (obrigatória para o mês corrente; sem ela, nenhuma leitura é feita) | > 0 | Administrador da plataforma, por script, com auditoria | DEC-058 |
| retencao_exportacao_dias | plataforma | 7 (DEC-069) | 1..90 | Administrador da plataforma, por script, com auditoria | RN-030, Q-017 |
| termo_consentimento | tenant | texto padrão abaixo [PROVISÓRIO até o GX-001] | texto de 1 a 1000 caracteres | Administrador da plataforma, por script, com auditoria | DEC-094, RN-041, GX-001 |

Texto padrão de `termo_consentimento` [PROVISÓRIO até o parecer do GX-001; o tenant, como controlador (RN-041), pode substituí-lo]: "Termo de consentimento. Autorizo o uso das minhas respostas a este formulário, inclusive as de saúde, pela instituição responsável pela pesquisa, para fins de acompanhamento e análise, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Posso pedir acesso, correção ou eliminação dos meus dados a qualquer momento." Abaixo do texto, o PDF traz o campo "Assinatura do respondente" (DEC-094).

Na aplicação local, "administrador da plataforma, por script" é a própria usuária, por script no notebook (DEC-107). O parâmetro `grupo_minimo` saiu com o k-anonimato (DEC-110).

Fonte única: todos os parâmetros vivem em ParametroConfiguracao (ENT-020). Ausente no nível mais específico, vale o nível acima (projeto → tenant → plataforma); ausente em todos, vale o padrão desta tabela.

3. Tabela única de decisões (DEC)

Regra de precedência: em caso de conflito entre o texto desta REQ e esta tabela, a tabela prevalece.

| ID | Data | Tipo | Problema | Alternativas | Decisão | Premissa / Justificativa | Status | Impacto | Relacionados |
|---|---|---|---|---|---|---|---|---|---|
| DEC-001 | 24/10/2026 | negócio | Nível de rigor do projeto | Leve; Padrão; Completo | Completo | Dado pessoal sensível de saúde, SaaS multi-tenant e obrigações LGPD | definitivo | Alto | todos |
| DEC-002 | 23/10/2026 | negócio | Nome do produto | — | MinhaPesquisa | Identidade do produto | definitivo | Baixo | — |
| DEC-003 | 22/10/2026 | negócio | Repositório | Público; Privado | Novo e privado, MinhaPesquisa (conta carlosyano), com toolchain, AGENTS.md e rastreabilidade do MeuRemedio como modelo | Governança e confidencialidade | definitivo | Médio | — |
| DEC-004 | 22/10/2026 | negócio | Meta de erro silencioso | 1%; 0,5%; 0,1% | No máximo 0,5% por campo, medida no conjunto-ouro | Qualidade da leitura por IA | definitivo | Alto | RF-007, TS-leitura |
| DEC-005 | 22/10/2026 | negócio | Formulário imprimível | HTML; PDF com QR; editor visual | PDF com QR na v1; editor visual depois | Simplicidade e rastreabilidade por página | definitivo | Médio | RF-004, CA-003, CA-028 |
| DEC-006 | 22/10/2026 | negócio | Consentimento | Digital; Assinatura no papel | Assinatura do respondente no formulário, conferida por pessoa; sem assinatura, fora dos relatórios. Exceção no papel antigo (DEC-172, DEC-173) | Base legal e rastreabilidade | definitivo | Alto | RF-008, CA-021, CA-044 |
| DEC-007 | 22/10/2026 | técnica | Motor de leitura | Acoplado; Pacote isolado | Pacote isolado, reutilizável pelo MeuRemedio | Reuso futuro sem retrabalho. Vive como pacote próprio dentro do repositório (packages/motor-leitura), com interface TypeScript e testes próprios. Só é extraído para repositório ou serviço separado quando o MeuRemedio for usá-lo. No MeuRemedio, a leitura de receita exige DEC própria naquela especificação. | definitivo | Alto | RF-007, CMP-motor |
| DEC-008 | 22/10/2026 | negócio | Montagem da aplicação | Automática por pessoa; Manual por digitalizador | Um envio = uma aplicação = uma pessoa; sem checagem automática (risco aceito) | Simplicidade na v1 | definitivo | Médio | RF-006, CA-013 |
| DEC-009 | 22/10/2026 | negócio | Revisão | Digitalizador e revisor separados; Digitalizador revisa | Na v1, o digitalizador revisa; perfil separado depois | Simplicidade na v1 | definitivo | Médio | RF-008 |
| DEC-010 | 23/10/2026 | negócio | Tipos de pergunta na v1 | Todos; Subconjunto | Matriz/Likert e CPF na v1; Ranking fora; múltipla escolha sempre com "nenhuma das anteriores" | Cobertura e previsibilidade | definitivo | Alto | RF-004, RF-007 |
| DEC-011 | 23/10/2026 | negócio | Regra de salto | Múltiplas condições; Uma condição por pergunta | Uma condição por pergunta, com o estado "não se aplica" | Simplicidade e clareza | definitivo | Médio | RF-004, CA-015, CA-018 |
| DEC-012 | 23/10/2026 | negócio | Biblioteca de perguntas | v1 com biblioteca; v1 sem biblioteca | v2; na v1 basta o código estável | Evolução incremental | definitivo | Baixo | RF-004 |
| DEC-013 | 23/10/2026 | negócio | Relatórios | Agregados; Agregados com cruzamento | Gráfico por pergunta, com cruzamento por uma segunda pergunta | Valor analítico | definitivo | Médio | RF-009, CA-017 |
| DEC-014 | 23/10/2026 | negócio | Exportação | CSV/XLSX/SPSS/R; CSV/XLSX | CSV e XLSX na v1; SPSS e R na v2; analista exporta só agregados | Escopo enxuto | definitivo | Médio | RF-010, CA-022 |
| DEC-015 | 23/10/2026 | negócio | Permissões | Por linha; Por projeto; Por perfil | Tabela de perfis; o vínculo a projetos limita tudo; sem permissão por linha; sem acesso público | Simplicidade e isolamento | substituído (DEC-109) | Alto | RF-001, CA-012, CA-016 |
| DEC-016 | 23/10/2026 | negócio | Importação | v1 com importação; v1 sem | XLSForm, Microsoft e Google Forms no roadmap | Evolução incremental | definitivo | Baixo | — |
| DEC-017 | 23/10/2026 | negócio | Gestão de tenants | Tela na v1; Script na v1 | Fora da v1; tenant e primeiro administrador por script; isolamento no banco desde a v1 | Isolamento é mais caro de adicionar depois | substituído (DEC-107) | Alto | RF-001, RNF-001 |
| DEC-018 | 23/10/2026 | negócio | Administrador da plataforma | Com login no produto; Sem login | Sem login no produto na v1; atua por script e monitoramento | Separação de responsabilidades | substituído (DEC-107) | Médio | RF-001 |
| DEC-019 | 23/10/2026 | negócio | Identificação do respondente | Por nome+data; Por CPF | Identificado só pelo CPF, obrigatório, sempre conferido por pessoa; vínculo na conclusão. Exceção no papel antigo sem CPF: vínculo pelo nome (DEC-172, DEC-176) | Unicidade e LGPD | definitivo | Alto | RF-005, CA-002, CA-014 |
| DEC-020 | 23/10/2026 | negócio | Campos obrigatórios | Nenhum; Alguns; Todos os 5 | Nome, nascimento, CPF, data e local bloqueiam a conclusão. Exceção no papel antigo: CPF e nascimento não bloqueiam (DEC-172, DEC-176) | Integridade mínima | definitivo | Alto | RF-004, RF-008, CA-032, CA-036 |
| DEC-021 | 23/10/2026 | negócio | Mascaramento de CPF | Sempre visível; Sempre mascarado; Exceções | Exceto na revisão, na portabilidade e na exportação linha a linha, com auditoria | Equilíbrio entre LGPD e operação | substituído (DEC-072) | Alto | RNF-003, CA-008 |
| DEC-022 | 23/10/2026 | técnica | Envio à IA | Página inteira; Recortes | Recortes dos campos; identificação e saúde em chamadas separadas; sem metadados. Revista pela DEC-170: a localização envia a página inteira, só para achar as perguntas. Substituída pela DEC-216: identificação e leitura enviam a página inteira, sem recortes nem chamadas separadas | Minimização de dado sensível | definitivo | Alto | RF-007, RNF-011 |
| DEC-023 | 23/10/2026 | negócio | Grupo mínimo | Fixo; Configurável | Por projeto, podendo ser 1; entre projetos vale o maior; ocultação por célula, também na exportação | Flexibilidade e anonimização | substituído (DEC-055) | Alto | RF-009, CA-010, CA-034 |
| DEC-024 | 23/10/2026 | negócio | Unidade dos grupos | Aplicação; Respondente | Respondente; cada filtro usa a aplicação mais recente que tenha a pergunta; período padrão de 12 meses | Coerência analítica | definitivo | Alto | RF-009, CA-009, CA-031 |
| DEC-025 | 23/10/2026 | negócio | Autenticação | Sem MFA; MFA opcional; MFA obrigatório | Regras de senha, bloqueio e sessão para todos; MFA para todos os perfis | Segurança de dado sensível | substituído (DEC-108) | Alto | RF-002, CA-026, RNF-002 |
| DEC-026 | 23/10/2026 | negócio | Eliminação a pedido do titular | Parcial; Total | Apaga imagens e respostas, anonimiza o respondente; auditoria só com referências; lista de eliminações por 180 dias | Conformidade LGPD | definitivo | Alto | RF-010, CA-023, RNF-008 |
| DEC-027 | 23/10/2026 | negócio | Ciclo de vida do projeto | Ativo/Inativo; Ativo/Arquivado | Ativo ou Arquivado, reversível; toda mudança de status registrada com data, hora e usuário | Rastreabilidade | definitivo | Médio | RF-003, CA-027 |
| DEC-028 | 23/10/2026 | negócio | Limite de confiança da IA | 0,70; 0,80; 0,90 | Confirma só acima de 0,90 | Valor provisório até calibração pelo conjunto-ouro | provisório | Alto | RF-007, CA-005 |
| DEC-029 | 23/10/2026 | negócio | Limites de arquivo e texto | 10 MB; 20 MB; 50 MB | 20 MB e 50 páginas por arquivo; textos de 200 e 2.000 caracteres | Equilíbrio entre uso e custo | provisório | Médio | RF-006, CA-029 |
| DEC-030 | 23/10/2026 | negócio | Tempo de leitura | 1 min; 2 min; 5 min | 95% das páginas em até 2 minutos, num lote de 100 | Valor provisório até conjunto-ouro | provisório | Médio | RNF-013 |
| DEC-031 | 23/10/2026 | negócio | Acesso individual | 30 dias; 90 dias; indeterminado | 90 dias, com justificativa; cada abertura auditada | Equilíbrio entre uso e risco | provisório | Alto | RF-001, CA-025 |
| DEC-032 | 23/10/2026 | negócio | Validade do convite | 12 h; 24 h; 72 h | 24 horas, de uso único | Segurança | substituído (DEC-108) | Médio | RF-002, CA-035 |
| DEC-033 | 24/10/2026 | negócio | Retenção de backups | 30 dias; 90 dias; indeterminado | Backups guardados por no máximo 90 dias | Conformidade com direito à eliminação | provisório | Alto | RNF-008, CA-023 |
| DEC-034 | 23/10/2026 | negócio | Operação | Sem link assinado; Link de 5 min; Link de 1 h | Link de imagem de 5 minutos; avisos por e-mail e na tela; reserva de aplicação por 30 minutos | Segurança e UX | substituído (DEC-112) | Médio | RNF-007, CA-043 |
| DEC-035 | 24/10/2026 | negócio | Teto de custo de IA na v1 | Sem teto; R$ 500/mês; R$ 1.000/mês | R$ 500,00/mês por tenant | Valor provisório para viabilizar a fila de espera (CA-030) na v1 | provisório | Alto | RF-007, CA-030, RNF-014 |
| DEC-036 | 24/10/2026 | técnica | Definição do ambiente de nuvem | AWS sa-east-1; Azure Brazil South | A definir na Fase 3 (ADR), sempre com região no Brasil | Soberania de dados; decisão técnica adiada para análise | substituído (DEC-038) | Alto | RNF-011, RNF-002 |
| DEC-054 | 27/10/2026 | negócio | Identificação do usuário no login | E-mail único global; e-mail único por tenant | E-mail único em toda a plataforma; um e-mail pertence a um único tenant | Login sem ambiguidade de tenant (Q-005) | substituído (DEC-108) | Alto | RF-001, RF-002, ENT-002 |
| DEC-055 | 27/10/2026 | negócio | Grupo mínimo | Padrão 1; padrão 5; padrão 5 com piso 3 | Por projeto, padrão 5, alterável de 1 a 1000 pelo administrador do tenant com auditoria; entre projetos vale o maior; ocultação por célula, também na exportação | Reduz a reidentificação de idosos por filtros estreitos (Q-006); substitui a DEC-023 | substituído (DEC-110) | Alto | RF-009, CA-010, CA-034 |
| DEC-056 | 27/10/2026 | negócio | Origem do conjunto-ouro | Voluntários com dados fictícios; dados reais após GX-001; preenchimento digital | Formulários preenchidos à mão por voluntários 60+ com dados fictícios, sob termo de participação próprio, sem dado pessoal real | Permite calibrar e escolher o provedor sem depender do GX-001 (Q-007) | definitivo | Alto | DEC-004, DEC-028, RN-046 |
| DEC-057 | 27/10/2026 | negócio | Leitura de texto livre | Sempre revisão; regra geral de confiança; sem leitura por IA | Itens do tipo `texto_livre` sempre vão para `a_revisar` | Texto livre não tem schema que valide o valor (Q-008) | definitivo | Médio | RF-007, FL-002, DEC-010 |
| DEC-058 | 27/10/2026 | negócio | Período e moeda do teto de custo de IA | Mês civil e PTAX diária; janela móvel de 30 dias; mês civil e cotação fixa mensal | Mês civil no fuso America/Sao_Paulo; custo em dólar convertido por cotação fixa configurada pela plataforma a cada mês | Previsibilidade do teto (Q-009) | definitivo | Médio | DEC-035, RN-036, CA-030 |
| DEC-059 | 27/10/2026 | negócio | Alteração de limite_confianca, custo_ia_teto e retencao_dias | Plataforma por script; administrador do tenant pela tela; misto | Administrador da plataforma, por script, com auditoria | Não há gestão de tenant por tela na v1 (DEC-017); Q-010 | definitivo | Médio | RN-008, DEC-017, DEC-018 |
| DEC-060 | 27/10/2026 | negócio | Perfil analista_individual × concessão | Perfil e concessão; só concessão; só perfil | O acesso individual exige o perfil `analista_individual` e uma concessão vigente para o projeto | Defesa em duas camadas para dados individuais de saúde (Q-011) | substituído (DEC-109) | Alto | RF-001, RF-009, DEC-031, CA-025 |
| DEC-061 | 28/10/2026 | negócio | Forma da revisão independente (nível Completo) | Revisor humano; agente de IA isolado | Agente de IA de outro modelo, com contexto isolado e somente leitura (`.claude/agents/revisor-independente.md`); o responsável lê e aprova os achados de cada rodada | Não há revisor humano disponível; risco aceito: IAs tendem a errar de forma parecida | definitivo | Alto | REV-REQ-005, REV-PLANO-007 |
| DEC-064 | 28/10/2026 | negócio | Vínculo do respondente sem assinatura | Só ao concluir; já em sem_assinatura | O respondente só é criado ou vinculado, e o cadastro só é alterado, quando a aplicação chega a `concluida` | Sem assinatura não há evidência de consentimento (DEC-006, RN-041); Q-012 | definitivo | Alto | RF-005, RF-008, FL-001 |
| DEC-065 | 28/10/2026 | negócio | E-mail já usado em outro tenant | Erro genérico; resposta igual ao sucesso | Erro ERR-023 (descontinuado na v2.1) igual para qualquer tenant, auditado e limitado por rate limit; risco residual aceito | Evita oráculo detalhado entre clientes (Q-013) | substituído (DEC-108) | Médio | RF-001, DEC-054 |
| DEC-066 | 28/10/2026 | negócio | Leitura de texto curto | Sempre revisão; regra geral | Itens `texto_curto` sempre vão para `a_revisar` | Sem schema que valide o conteúdo (Q-014) | definitivo | Médio | RF-007, FL-002, DEC-057 |
| DEC-067 | 28/10/2026 | negócio | Dedução de célula oculta por subtração | Supressão complementar; aceitar o risco | Supressão complementar na consulta agregada, também na exportação | Impede deduzir a célula oculta pela linha, pela coluna ou pela consulta sem cruzamento (Q-015) | substituído (DEC-110) | Alto | RF-009, DEC-045, CA-017 |
| DEC-068 | 28/10/2026 | negócio | Vínculo padrão a todos os projetos | Dinâmico; fixado na criação | Dinâmico: inclui projetos criados depois (`todos_projetos`) | Leitura natural da RN-004 (Q-016) | definitivo | Médio | RN-004, RF-001 |
| DEC-069 | 28/10/2026 | negócio | Retenção dos arquivos de exportação | 24 h; 7 dias; 30 dias | 7 dias após a geração | Dados pessoais em repouso pelo menor tempo útil (Q-017) | definitivo | Médio | RN-030, RF-010 |
| DEC-070 | 28/10/2026 | negócio | Efeito de tenant inativo | Login, jobs e dados; só login | Login recusado (ERR-013), jobs do tenant suspensos, dados preservados, expurgos por eliminação e retenção mantidos | Gestão de tenant por script (DEC-017); Q-018 | definitivo | Médio | DEC-017, ENT-001 |
| DEC-071 | 28/10/2026 | negócio | Dedução por diferença entre filtros | Faixas fixas e mínimo no complemento; aceitar o risco | Filtros de idade só em faixas fixas de 5 anos (60-64 ... 90+); consulta recusada quando o complemento do filtro no projeto tem menos respondentes que o mínimo | Dois filtros que diferem em uma pessoa revelariam suas respostas (Q-019) | substituído (DEC-110) | Alto | RF-009, RNF-004, DEC-055 |
| DEC-072 | 28/10/2026 | negócio | Mascaramento de CPF | Ver DEC-021 | Exceto na revisão, no pedido de acesso e na portabilidade do titular e na exportação linha a linha, com auditoria | Inclui o acesso do próprio titular (Q-020); substitui a DEC-021 | definitivo | Alto | RNF-003, CA-008, CA-024 |
| DEC-073 | 28/10/2026 | negócio | Critério de parada da revisão independente | Zero achados médios; zero bloqueantes e altos com médios registrados | Rodada aprovada com 0 bloqueantes e 0 altos; achados médios e baixos restantes só com registro de responsável e incremento (PLANO §12.3) | Rodadas sucessivas descem de nível e não convergem a zero médios; desvio do nível Completo aceito | definitivo | Médio | DEC-001, DEC-061 |
| DEC-074 | 29/10/2026 | negócio | Campo lido em branco | Sempre revisão; regra geral de confiança | Campo lido em branco que não é destino de salto que mande pular vai para `a_revisar` | Evita confirmar como vazio um campo marcado de leve (Q-021) | definitivo | Médio | RF-007, FL-002, RN-020 |
| DEC-075 | 29/10/2026 | negócio | Filtro em escala e múltipla escolha | Valor único e "marcou a opção"; intervalos livres | Escala filtrada por um valor (`igual` ou `diferente`, sem `em`); múltipla escolha filtra por "marcou a opção" | Evita recortes estreitos (Q-022) | definitivo | Médio | RF-009, DEC-071 |
| DEC-076 | 29/10/2026 | negócio | Complemento do filtro | Por projeto e por período; proibir vários projetos | Sem filtro, não se aplica; com vários projetos, verificado em cada projeto com o maior mínimo; com período, calculado no mesmo período | Fecha a DEC-071 (Q-023) | definitivo | Médio | RF-009, DEC-055, DEC-071 |
| DEC-077 | 29/10/2026 | negócio | Valores de aplicação descartada | Apagar no descarte; manter até a retenção | No descarte, `valor_ia` e `valor_final` dos itens são apagados com as imagens e a aplicação vai para a ListaEliminacoes (motivo `descarte_aplicacao`) para reaplicação após restore; fica a auditoria | Minimização (LGPD) (Q-024) | definitivo | Médio | RF-008, CA-033, RN-030 |
| DEC-078 | 29/10/2026 | negócio | Respondente sem aplicação após reabertura | Anonimizar; manter até a retenção | Respondente que fica sem aplicação concluída após reabertura é anonimizado e registrado na ListaEliminacoes só para reaplicação após restore (motivo `anonimizacao_reabertura`), com auditoria | Sem finalidade para manter (Q-025) | definitivo | Médio | RF-005, CA-042 |
| DEC-079 | 29/10/2026 | negócio | Campo obrigatório ilegível | Bloquear conclusão; concluir sem vínculo | Nome, nascimento, data ou local ilegível, rasurado ou não se aplica → ERR-006 até informar o valor; CPF ilegível → `aguardando_cpf` | Integridade mínima (DEC-020) (Q-026) | definitivo | Médio | RF-008, DEC-020, CA-032 |
| DEC-080 | 29/10/2026 | negócio | Concessão individual sem perfil | Recusar; permitir | Concessão recusada (ERR-018) se o usuário não tiver o perfil `analista_individual` (DEC-060; texto corrigido pela Q-030) | Evita concessão sem efeito ou indevida (Q-027, Q-030) | substituído (DEC-109) | Baixo | RF-001, CA-025 |
| DEC-081 | 29/10/2026 | negócio | Faixa abaixo de 60 | Criar faixa; excluir | Faixa `<60` com o mesmo mínimo das demais; complementa a DEC-071 | Público pode ter menos de 60 (Q-028) | substituído (DEC-110) | Baixo | RF-009, DEC-071 |
| DEC-082 | 29/10/2026 | negócio | Novo MFA após reset | Link por e-mail; próximo login | Após o reset, o novo cadastro só começa pelo link de uso único (24 h) enviado ao e-mail, com a senha; login com `mfa_ativo = false` não cria pré-sessão (ERR-013) | Quem tem só a senha não cadastra MFA (Q-029) | substituído (DEC-108) | Alto | RF-001, RF-002, CA-037b, CA-026b |
| DEC-093 | 03/11/2026 | negócio | CA-003 enviava só a página 2 e esperava `em_leitura`, contra a linha 3 da criação da FL-001 (página faltante) | Ajustar a FL-001; esclarecer o CA-003 | Esclarecimento: no CA-003 o digitalizador envia as 4 páginas da versão em JPEG e a página 2 é identificada pelo QR; a FL-001 não muda | Encontrado no IA-TEST do IMP-002 (CHG-009, item 1) | definitivo | Baixo | CA-003, FL-001 |
| DEC-094 | 03/11/2026 | negócio | Texto do termo de consentimento da página 1 (CA-028) | Texto fixo do sistema; texto por tenant | Texto por tenant no parâmetro `termo_consentimento` (seção 2.9), definido por script, com texto padrão provisório até o GX-001 | O tenant é o controlador e responde pela base legal (RN-041) (CHG-009, item 2) | provisório | Médio | CA-028, RN-041, GX-001 |
| DEC-095 | 03/11/2026 | negócio | Validação das regras de salto (M-09) | Validar na publicação; validar no rascunho | No rascunho (`updateVersion`), ERR-001 quando: a origem não é `sim_nao` nem `escolha_unica`; a opção não existe na origem; origem e destino são a mesma pergunta; a regra fecha um ciclo; o destino vem antes da origem (`ordem`) | Erro apontado na hora da edição (CHG-009, item 3) | definitivo | Médio | RN-021, RF-004 |
| DEC-096 | 03/11/2026 | negócio | Erro da estrutura da RN-047 (M-19) | ERR-001 no rascunho; ERR-036 na publicação | Mantém a recusa na publicação com ERR-036; `campos` traz os códigos das perguntas com estrutura inválida (matriz sem linhas, múltipla escolha sem `nenhuma_das_anteriores`), junto com os campos da RN-017 que faltarem | Preserva a RN-047 e diz ao administrador qual pergunta corrigir (CHG-009, item 4) | definitivo | Baixo | RN-047, CA-036, ERR-036 |
| DEC-097 | 03/11/2026 | negócio | Sensibilidade `identificacao` em pergunta comum (M-14) | Livre; reservada | `identificacao` é reservada às perguntas com `campo_respondente` ou `campo_aplicacao = aplicador` (definida automaticamente); nas demais o administrador escolhe `saude` ou `outro`; `identificacao` nelas → ERR-001 | Evita que dado de saúde vá na chamada de identificação (RN-039) (CHG-009, item 5) | definitivo | Médio | RN-039, RN-047 |
| DEC-098 | 03/11/2026 | negócio | Páginas de aplicação já aberta em projeto arquivado | Recusar; permitir | `addApplicationPages` continua permitido em projeto arquivado; só `uploadImages` (nova aplicação) é recusado com ERR-001 | Completar aplicação já aberta não é novo upload (CA-027) (CHG-009, item 8) | definitivo | Baixo | CA-027, RF-006 |
| DEC-105 | 03/11/2026 | negócio | CPF no PDF | Campo único; uma caixa por dígito | A pergunta do tipo `cpf` sai no PDF com 11 caixas, uma por dígito, sem pontuação impressa | Orienta o preenchimento à mão e separa os dígitos para a leitura (RN-012) (CHG-010) | definitivo | Médio | CA-028, RF-004, RN-012 |
| DEC-107 | 03/11/2026 | negócio | Forma de implantação do produto | SaaS multi-tenant na AWS; aplicação local num notebook | Aplicação local num único notebook Windows, para uma instituição (um tenant, criado na instalação) e uma única usuária. Banco, imagens e backups ficam no notebook, com disco cifrado (BitLocker) obrigatório; nada é guardado em nuvem. A única saída de dados são as imagens enviadas ao provedor de IA (DEC-111; desde a DEC-216, as páginas inteiras). Instalação, parâmetros e manutenção por script local. Sem intenção de voltar a ser SaaS | Simplificar o protótipo e eliminar o custo de nuvem (CHG-011) | definitivo | Alto | RNF-001, RNF-002, RNF-011, DEC-017, DEC-018, DEC-038, Q-031 |
| DEC-108 | 03/11/2026 | negócio | Acesso ao sistema na aplicação local | Senha local sem MFA; senha + MFA; só o login do Windows | Uma conta, criada na instalação, com senha local (regras de senha e bloqueio por tentativas mantidos); sem MFA, sem convite e sem e-mail. Recuperação de senha por script no próprio notebook, com auditoria | Uma só pessoa no próprio notebook; a proteção principal é o login do Windows e o disco cifrado (CHG-011) | definitivo | Alto | RF-002, DEC-025, DEC-032, DEC-054, DEC-065, DEC-082 |
| DEC-109 | 03/11/2026 | negócio | Perfis com uma única usuária | Manter perfis; papel único | A usuária tem todas as permissões: administra, digitaliza e revisa, vê fichas individuais e exporta linha a linha (com auditoria). Saem perfis, vínculos a projetos e concessões de acesso individual | Com uma pessoa, a separação de perfis não protege nada (CHG-011) | definitivo | Alto | RF-001, RF-009, RF-010, DEC-014, DEC-015, DEC-060, DEC-080 |
| DEC-110 | 03/11/2026 | negócio | k-anonimato nos painéis e exportações | Manter; remover | Removido: sem grupo mínimo, sem faixas obrigatórias de idade e sem supressão de células; painéis e exportações mostram todos os grupos | Escolha do responsável para reduzir o IMP-004 (CHG-011); quem compartilhar painéis ou planilhas responde por não expor pessoas em grupos pequenos | definitivo | Alto | RF-009, RF-010, RNF-004, DEC-055, DEC-067, DEC-071, DEC-081 |
| DEC-111 | 03/11/2026 | negócio | Região do provedor de IA (RNF-011) | Só no Brasil; fora do Brasil permitido; decidir no parecer | O provedor de IA pode processar os recortes, desde a DEC-170 as páginas inteiras da localização e, desde a DEC-216, as páginas inteiras lidas, fora do Brasil, com contrato sem retenção e sem uso para treino (RNF-010) e base legal de transferência internacional (LGPD art. 33), confirmada no GX-001. Os dados guardados continuam só no notebook | Amplia a escolha do provedor no IMP-003 (CHG-011) | definitivo | Alto | RNF-010, RNF-011, Q-001, GX-001 |
| DEC-112 | 03/11/2026 | negócio | Operação com uma única usuária | Manter DEC-034; simplificar | Avisos só na tela (sem e-mail); link de imagem de 5 minutos mantido, servido só no notebook; sem reserva de aplicação para revisão (a proteção contra gravação concorrente fica no If-Match) | Não há disputa entre revisores (CHG-011) | provisório | Médio | RF-008, RNF-007, DEC-034, CA-043 |
| DEC-117 | 03/11/2026 | negócio | Backup do notebook (Q-031) | Diário em disco externo; semanal em disco externo; diário em nuvem cifrada | Backup diário, cifrado, em disco externo guardado longe do notebook; retenção de 90 dias (DEC-033); teste de restauração a cada mês | Com tudo num só notebook, o backup é a única proteção contra perda; diário limita a perda a um dia de digitação (CHG-011) | definitivo | Alto | DEC-107, DEC-033, DEC-114, RNF-008, Q-031 |
| DEC-119 | 04/11/2026 | negócio | Uso do sistema enquanto o GX-001 estiver pendente | Esperar o parecer para usar; usar só para teste | O MinhaPesquisa é usado só para teste, com dados sintéticos (Q-001), sem uso real com dados pessoais; o GX-001 não é exigido enquanto isso valer. Qualquer uso com dados reais exige o GX-001 e uma nova decisão | Escolha do responsável (CHG-012): imagens sintéticas enviadas à IA (recortes e, desde a DEC-216, páginas inteiras) não são dado pessoal, então não há transferência internacional a liberar | definitivo | Alto | GX-001, Q-001, DEC-111, DEC-122, RNF-011 |
| DEC-126 | 05/11/2026 | negócio | Até quando o CPF completo aparece (Q-032) | Enquanto a marca de exibição existir; só durante a revisão | O CPF completo aparece só enquanto a aplicação está em revisão (`em_revisao`, `aguardando_cpf` ou `sem_assinatura`) e depois de `openReview`, que audita cada abertura (EXIBICAO_CPF). Conclusão, descarte e reabertura apagam a marca: na aplicação concluída o CPF volta a aparecer mascarado e uma nova revisão exige novo `openReview`. O recorte do campo de CPF consultado sem a revisão aberta também audita EXIBICAO_CPF | Sem isso, uma abertura liberava o CPF completo para sempre, sem auditoria (revisão focada do IMP-003, F-01) | definitivo | Alto | RN-013, DEC-072, DEC-112, CA-008 |
| DEC-127 | 05/11/2026 | negócio | Confirmação automática antes da calibração (Q-033) | Confirmar acima de 0,90 já; tudo à revisão até a calibração | Até o conjunto-ouro calibrar a confiança (DEC-047), nenhum item é confirmado automaticamente: o padrão de `limite_confianca` é 1,00, e a regra 8 da FL-002 nunca se aplica (confiança > 1,00 não existe). Depois da calibração, o administrador da plataforma grava o limite calibrado por script (DEC-059) | A confiança declarada pelo modelo não é calibrada; um erro com confiança alta passaria sem revisão para dashboards e exportações (revisão focada do IMP-003, F-05) | provisório | Alto | DEC-028, DEC-047, DEC-004, FL-002, CA-005 |
| DEC-128 | 05/11/2026 | negócio | Confirmar valor fora do schema (Q-034) | Aceitar o valor lido; exigir a correção | A ação `confirmar` só vale para valor lido preenchido e dentro do schema da pergunta (as mesmas checagens da regra 7 da FL-002; no CPF, os 11 dígitos). O CPF com dígito verificador inválido pode ser confirmado e segue para `aguardando_cpf` na conclusão (FL-001, CA-002 exemplo 3). Valor em branco ou fora do schema é recusado com ERR-001 (`campos: acao`): a usuária corrige o valor ou marca em branco, ilegível, rasurado ou não se aplica | Um valor inválido confirmado entraria nos agregados e no cadastro (revisão focada do IMP-003, F-06) | definitivo | Alto | FL-002, CA-006, CA-007, RN-020 |
| DEC-129 | 05/11/2026 | negócio | Número de chamadas da leitura com falha (Q-035) | 3 chamadas no total; 1 chamada e 3 retentativas | No máximo 3 chamadas por página e grupo de envio: a primeira e duas retentativas, em 1 e 2 s; na 3ª falha, a aplicação vai para `erro_leitura` (ERR-041) | Alinha o código ao CA-041 ("falhou em 3 tentativas") e evita uma chamada paga a mais (revisão focada do IMP-003, F-11) | definitivo | Médio | CA-041, ERR-041, RF-007 |
| DEC-132 | 05/11/2026 | negócio | Criação de formulário a partir de um formulário existente (Change Request de 05/11/2026) | Só cadastro manual; importação por imagem com IA | A usuária envia um formulário que já existe (imagem ou PDF) e a IA lê a estrutura: enunciados, tipos, opções, linhas de matriz e faixas. O resultado é um formulário novo, com a versão 1 em rascunho, que a usuária cura no editor antes de publicar (RF-011, RN-049). O PDF de coleta é sempre o gerado pelo sistema (CA-028): papéis no layout original não são lidos. A importação não cria versão nova de formulário existente e não substitui a DEC-016 | Agilizar o cadastro de formulários que já existem em papel; escolha do responsável para a próxima etapa (CHG-014) | definitivo | Alto | RF-011, RF-004, RN-049, DEC-016, CA-045 |
| DEC-133 | 05/11/2026 | negócio | Formulário enviado à importação (Q-037) | Só em branco ou com dados fictícios; também preenchido com dados reais | Só formulário em branco ou preenchido com dados fictícios. A usuária declara isso a cada envio (`sem_dados_reais`); sem a declaração, ERR-001. Como a página inteira vai ao provedor, a importação é a única exceção à RN-038 e não se sujeita à RN-039, válida só para esse modelo sem dado pessoal, que por isso não depende do GX-001 (RN-033, RN-041); o extrator é instruído a ignorar o que estiver escrito à mão | A página inteira com nome, CPF e saúde juntos violaria a RN-038 e a RN-039 e exigiria o GX-001 (CHG-014) | definitivo | Alto | RN-033, RN-038, RN-039, RN-041, RN-049, GX-001, DEC-119 |
| DEC-134 | 05/11/2026 | negócio | Os 5 campos obrigatórios no formulário importado (Q-038) | Reconhecer no original e injetar o que faltar; sempre injetar os 5 | A pergunta do original equivalente a nome, data de nascimento, CPF, data ou local da aplicação recebe o código, o tipo e a marcação padrão da RN-050, mantendo o enunciado do original; o campo que não for reconhecido é injetado. Nenhum dos 5 fica duplicado. Como a equivalência é decidida: DEC-144 | Evita perguntas repetidas no PDF (CHG-014) | definitivo | Médio | RN-017, RN-050, CA-046 |
| DEC-135 | 05/11/2026 | negócio | Os 5 campos obrigatórios no rascunho criado à mão (Q-039) | Injetar em todo rascunho novo; só na importação | Todo rascunho novo sem cópia (`createForm`, `createVersion` sem versão de origem e importação) já nasce com os 5 campos da RN-050. No rascunho eles podem mudar de enunciado, ordem e página, mas não podem ser removidos (ERR-001); código, tipo, marcação e obrigatoriedade são reaplicados pelo sistema (DEC-145). O ERR-036 continua como proteção na publicação | A usuária não precisa lembrar dos campos da RN-017 (CHG-014) | definitivo | Médio | RN-017, RN-050, RF-004, CA-048, ERR-036 |
| DEC-136 | 05/11/2026 | negócio | Arquivo e custo da importação (Q-040) | Mesmos tipos e limites do upload, com custo no teto; com TIFF; fora do teto | Os tipos e limites de arquivo do upload (DEC-029, acompanhando suas mudanças), com no máximo 50 páginas no envio, varredura de malware e remoção de metadados, como no RF-006 (ERR-029). Cada página lida conta no teto de custo de IA do tenant (RN-036); com o teto atingido, a importação fica em `aguardando_cota` até a cota voltar | Um só conjunto de regras de arquivo e de custo (CHG-014) | definitivo | Médio | DEC-029, DEC-035, RN-036, CA-047 |
| DEC-137 | 05/11/2026 | negócio | Dados do ciclo de coleta no projeto (Q-041) | Texto e datas; tudo texto livre; deixar para depois | O projeto ganha `objetivo` (texto), `coordenador` (nome) e `coleta_inicio` e `coleta_fim` (datas), todos opcionais; `coleta_fim` antes de `coleta_inicio` → ERR-001. O nome do coordenador é dado pessoal: não vai à IA, não entra em log e a alteração é auditada sem o valor (RN-027, RN-028). Os quatro campos podem ser apagados (`null`); apagar o coordenador é como se atende a um pedido dele de eliminação; restauração de backup: DEC-148 | Etapa 3 do Change Request (CHG-014) | definitivo | Baixo | RF-003, ENT-004, CA-049 |
| DEC-138 | 05/11/2026 | negócio | Sensibilidade das perguntas importadas (Q-042) | A IA sugere saúde ou outro; sempre o padrão | As perguntas importadas que não são campos de identificação recebem a sensibilidade padrão `saude` (ENT-007), sem sugestão da IA; a usuária pode mudar para `outro` na curadoria. Os campos de identificação seguem a RN-047 (DEC-097) | O sistema é usado só para teste e aprendizado (DEC-119), e `saude` é o padrão mais protetor (CHG-014) | definitivo | Baixo | RN-039, RN-047, DEC-097 |
| DEC-139 | 05/11/2026 | negócio | Regras de salto do formulário importado (Q-043) | Só na curadoria; a IA sugere | A importação não cria regras de salto, mesmo que o original traga instruções como "se Não, pule para a 7"; a usuária as configura no rascunho (RN-021, DEC-095) | Evita regra errada criada sem aviso (CHG-014) | definitivo | Baixo | RN-021, DEC-011, DEC-095 |
| DEC-143 | 05/11/2026 | negócio | Pergunta que não cabe na página do PDF (Q-044) | Recusar e apontar; mover para a página seguinte | A gravação do rascunho (`updateVersion`) com pergunta que não cabe na sua página, pela mesma medida de altura do PDF, é recusada com ERR-001, com os códigos das perguntas em `campos`; a publicação também confere e recusa com ERR-036, com os códigos em `campos` (DEC-096). Na importação, a pergunta mais alta que uma página inteira é descartada com aviso `nao_cabe` (RN-049) | Hoje a pergunta que passa do rodapé sai fora da folha, sem erro (PLANO §12.3, F-20) (CHG-014) | definitivo | Médio | RF-004, RN-049, CA-028, CA-047, CA-048, ERR-036 |
| DEC-144 | 05/11/2026 | negócio | Como a importação reconhece os 5 campos obrigatórios (Q-045) | A IA indica e a primeira vence; lista fixa de termos | O extrator devolve, por pergunta, `campo_padrao`: qual dos 5 campos da RN-050 ela é, ou nenhum. A primeira pergunta, na ordem do original, com cada `campo_padrao` vira esse campo, com o tipo da RN-050; as seguintes com o mesmo `campo_padrao` ficam como perguntas comuns, com aviso `campo_repetido` | Reconhece variações como "Nome do entrevistado", que uma lista fixa não pega (CHG-014) | definitivo | Médio | RN-049, RN-050, DEC-134, CA-046 |
| DEC-145 | 05/11/2026 | negócio | Campos da RN-050 gravados com código, tipo ou obrigatoriedade diferentes (Q-046) | Corrigir sozinho; recusar | A cada gravação do rascunho, o sistema reaplica à pergunta de cada marcação o código, o tipo, `obrigatorio = true` e a sensibilidade da RN-050, sem recusar, como a RN-047 faz com a sensibilidade. Só a falta de uma das 5 marcações, a marcação repetida ou um dos 5 códigos usado sem a marcação são recusados com ERR-001. A versão criada por cópia também é padronizada | Os dados ficam padronizados sem a tela precisar enviar tudo certo (CHG-014) | definitivo | Médio | RN-050, RN-047, DEC-135, CA-048 |
| DEC-146 | 05/11/2026 | negócio | Criar formulário em projeto arquivado (Q-047) | Permitir; recusar | `createForm` e `importForm` em projeto arquivado são recusados com ERR-001 (`campos`: `projeto`), como o upload (CA-027). A importação já enviada segue até o fim mesmo que o projeto seja arquivado depois, como a DEC-098 faz com as páginas | Projeto arquivado não recebe cadastro novo (CHG-014) | definitivo | Baixo | RF-004, RF-011, CA-027, CA-047, CA-048, DEC-098 |
| DEC-147 | 05/11/2026 | negócio | Código reservado em pergunta comum na cópia de versão antiga (Q-048) | Renomear com sufixo; recusar a cópia | Na criação por cópia, a pergunta sem marcação cujo código é um dos reservados da RN-050 ganha o sufixo `_2`, `_3` e assim por diante, como na RN-049, antes de a pergunta marcada receber o código padrão | A cópia sempre funciona, sem trabalho manual (revisão focada da CHG-014, S-03) | definitivo | Baixo | RN-050, DEC-145, CA-048 |
| DEC-148 | 05/11/2026 | negócio | Nome do coordenador apagado e restauração de backup (Q-049) | Aceitar o risco; reaplicar após o restore | Risco aceito: a restauração de um backup anterior traz de volta o nome do coordenador apagado, que a usuária apaga de novo; o nome não tem retenção própria e não entra na ListaEliminacoes | Nome da equipe, num sistema usado só para teste (DEC-119) (revisão focada da CHG-014, S-06) | definitivo | Baixo | DEC-137, DEC-120, RN-031 |
| DEC-149 | 05/11/2026 | negócio | Endereço e aplicador no formulário importado (Q-050) | A IA também reconhece; aceitar o risco | O `campo_padrao` da importação aceita também `endereco` e `aplicador`: a pergunta reconhecida recebe a marcação (`campo_respondente = endereco` ou `campo_aplicacao = aplicador`), o código ENDERECO ou APLICADOR, o tipo `texto_curto` e a sensibilidade `identificacao` (RN-047). Esses dois não são obrigatórios nem injetados | Endereço é identificação (RN-039) e não pode ir à IA junto com saúde (revisão focada da CHG-014, S-16) | definitivo | Médio | RN-039, RN-047, RN-049, DEC-097, DEC-144 |
| DEC-152 | 05/11/2026 | negócio | Enunciado e obrigatoriedade de endereço e aplicador no formulário importado (Q-051) | "Endereço" e "Aplicador" | Com enunciado vazio, a pergunta reconhecida como `endereco` recebe "Endereço do respondente" e a reconhecida como `aplicador`, "Nome do aplicador". As duas ficam com `obrigatorio = false`; a pessoa pode torná-las obrigatórias na edição do rascunho | Endereço e aplicador são opcionais no formulário, ao contrário dos 5 campos da RN-050 (resposta do responsável) | definitivo | Baixo | RN-049, DEC-149 |
| DEC-153 | 05/11/2026 | negócio | Exportação em formato longo (Change Request de 05/11/2026, seção 3) | Só agregado e linha a linha; também uma linha por item | A exportação ganha o escopo `linha_por_item` (formato longo): uma linha por item de cada aplicação, com as colunas e as regras da RN-051 (RF-012). Os escopos `agregado` e `linha_a_linha` continuam como estão (RF-010) | A planilha sai pronta para tabela dinâmica, sem Power Query nem macros (CHG-015) | definitivo | Médio | RF-010, RF-012, RN-051, ENT-026, CA-050 |
| DEC-154 | 05/11/2026 | negócio | Linha de matriz no formato longo (Q-052) | Coluna própria; código composto na pergunta | A coluna `Codigo_Linha` traz o código da linha da matriz (RN-019) e fica vazia nas outras perguntas; `Codigo_Pergunta` é sempre o código da pergunta | O código da pergunta continua estável para filtrar e comparar versões (RN-018) (CHG-015) | definitivo | Baixo | RN-018, RN-019, RN-051, CA-050 |
| DEC-155 | 05/11/2026 | negócio | CPF no formato longo (Q-053) | 11 dígitos sem pontuação; com pontuação; mascarado | CPF completo, com 11 dígitos sem pontuação (§5.4) e gravado como texto, como na exportação linha a linha (DEC-072); a exportação é auditada (RN-051) | Formato estável para cruzar planilhas, sem perder o zero à esquerda (CHG-015) | definitivo | Alto | DEC-072, RN-013, RN-051, CA-050 |
| DEC-156 | 05/11/2026 | negócio | Valor de escala, número, data e texto no formato longo (Q-054) | Na coluna do código, com rótulo vazio; repetido no rótulo | Em escala, número, data, texto curto e texto livre, o valor no formato canônico (§5.4) vai em `Codigo_Opcao_Valor`, e `Rotulo_Opcao_Valor` fica vazio | Uma só coluna de valor; o rótulo é só de opção (CHG-015) | definitivo | Baixo | RN-051, CA-050 |
| DEC-157 | 05/11/2026 | negócio | Aplicações no formato longo (Q-055) | Só concluídas com assinatura; também em revisão | Só aplicações `concluida` com assinatura `presente` (CA-021; exceção do papel antigo na DEC-172), dos projetos pedidos e com `data_aplicacao` no período, quando informado | Valor em revisão não é definitivo, e sem assinatura não há consentimento (DEC-006) (CHG-015) | definitivo | Alto | CA-021, DEC-006, RN-051, CA-050 |
| DEC-158 | 05/11/2026 | negócio | Item sem resposta no formato longo (Q-056) | Uma linha com valor vazio e a situação; omitir | O item em branco, ilegível, rasurado ou "não se aplica" gera uma linha com `Codigo_Opcao_Valor` e `Rotulo_Opcao_Valor` vazios e a coluna `Situacao` com o estado (`em_branco`, `ilegivel`, `rasurado`, `nao_se_aplica`); o item com valor tem `Situacao = respondida`. `nenhuma_das_anteriores` marcada é uma opção como as outras | Os estados não viram zero nem "não" (RN-020), e a falta de resposta fica visível na planilha (CHG-015) | definitivo | Médio | RN-020, RN-047, RN-051, CA-050 |
| DEC-159 | 05/11/2026 | negócio | Formatos do formato longo (Q-057) | XLSX e CSV; só XLSX | XLSX e CSV, como as demais exportações (DEC-014) | Mesma escolha da DEC-014 (CHG-015) | definitivo | Baixo | DEC-014, RN-051, CA-051 |
| DEC-160 | 05/11/2026 | negócio | Identificador da aplicação no formato longo (Q-058) | UUID da aplicação; número sequencial da exportação | `ID_Aplicacao` é o identificador da aplicação no sistema (UUID), o mesmo das telas e da auditoria | Permite voltar à aplicação e juntar exportações diferentes (CHG-015) | definitivo | Baixo | ENT-010, RN-051, CA-050 |
| DEC-161 | 05/11/2026 | negócio | Fórmulas em células exportadas (Q-059) | Neutralizar com apóstrofo; não tratar | Em toda exportação em CSV ou XLSX (RF-010, RF-012), a célula de texto que começa com `=`, `+`, `-`, `@`, tabulação ou retorno de carro recebe um apóstrofo (`'`) na frente. Os valores de `escala` e `numero` e as datas, já validados no formato canônico (§5.4), saem como estão | Texto lido do papel ou digitado na revisão não pode virar fórmula ao abrir a planilha (RN-037; PLANO §12.3, F-19) (CHG-015) | substituído (DEC-166) | Médio | RN-037, RN-051, CA-051 |
| DEC-162 | 05/11/2026 | negócio | Dados de identificação no formato longo (Q-060) | Só o CPF; nome ao lado do CPF; nome e data de nascimento | A coluna `Nome` (nome do cadastro do respondente) fica ao lado do CPF. As perguntas marcadas como nome, data de nascimento ou CPF do respondente e como data da aplicação não viram linhas: nome, CPF e data da aplicação já estão nas colunas, e a data de nascimento fica fora da planilha | O responsável precisa do nome do respondente na planilha; a data de nascimento não é necessária (minimização) (CHG-015) | definitivo | Alto | RN-013, RN-051, DEC-072, CA-050 |
| DEC-163 | 05/11/2026 | negócio | Recorte do formato longo (Q-061) | Só projetos e período; também os filtros do dashboard | O formato longo recorta só por projetos e período (`data_aplicacao`; sem período, todas as aplicações). `filtros` enviados com `linha_por_item` são recusados com ERR-001 (`campos`: `filtros`) até os filtros do dashboard existirem (RF-009, IMP-004) | Os filtros dependem do RF-009, ainda não implementado (CHG-015) | provisório | Baixo | RF-009, RN-051, CA-051 |
| DEC-166 | 05/11/2026 | negócio | Apóstrofo só no CSV (Q-062, revisão da DEC-161) | Apóstrofo no CSV e no XLSX; só no CSV; em nenhum | Na exportação em CSV (RF-010, RF-012), a célula de texto que começa com `=`, `+`, `-`, `@`, tabulação ou retorno de carro recebe um apóstrofo (`'`) na frente. No XLSX não há apóstrofo: o texto sai como está, em célula do tipo texto, e nenhuma célula é gravada como fórmula. Os valores de `escala` e `numero` e as datas, já validados no formato canônico (§5.4), saem como estão nos dois formatos | O responsável não quer o apóstrofo na planilha; no XLSX a célula de texto não vira fórmula, e no CSV, que não tem tipo de célula, o apóstrofo continua impedindo a fórmula (RN-037; PLANO §12.3, F-19) (CHG-016) | definitivo | Médio | RN-037, RN-051, DEC-161, CA-051 |
| DEC-169 | 06/11/2026 | negócio | Pesquisas antigas sem QR e sem marcadores (Change Request de 06/11/2026) | Só formulário impresso pelo sistema; QR opcional com a ordem do arquivo; QR opcional com a localização pela IA | O QR deixa de ser obrigatório no envio. Com QR legível, ele decide a versão (prevalece sobre a escolhida na tela); sem QR legível, vale a versão publicada que a usuária escolhe no envio (`versao_id`); sem QR e sem versão escolhida, a aplicação vai para `identificacao_pendente` (ERR-004). Vale para scanner e foto. Os marcadores dos cantos deixam de ser exigidos para ler | A instituição tem acervos de pesquisas já aplicadas em papel comum, muitas só em foto, que precisam entrar na base (CHG-017) | definitivo | Alto | RF-006, FL-001, CA-003, CA-004, CA-052, ERR-004, DEC-048 |
| DEC-170 | 06/11/2026 | negócio | Como achar as perguntas na página sem marcadores (CHG-017) | Encaixe no notebook pelo modelo em branco; a IA localiza as perguntas | Em toda página de formulário, com ou sem QR, a IA recebe a página inteira numa chamada só de localização, que devolve o número da página e a região de cada pergunta da versão, sem ler valores (desde a DEC-216, só a página e a confiança; as regiões e os valores saem da leitura da página inteira, sem recortes nem chamadas separadas; o que segue sobre recortes e RN-039 foi substituído pela DEC-216). Os recortes da leitura saem dessas regiões. É a segunda exceção da RN-038; a leitura dos valores continua por recortes, com identificação e saúde em chamadas separadas (RN-039). A chamada a mais por página entra no custo de IA e no teto (RN-036) | O responsável aceitou o custo maior por página e o envio da página inteira (Risco 3) para que foto e papel antigo funcionem sem marcadores; a alternativa de encaixe local ficou como tratamento futuro (Carlos Yano, 06/11/2026) | definitivo | Alto | RN-036, RN-038, RN-039, RN-041, RN-045, RF-007, CA-055, DEC-022, DEC-048, Q-036 |
| DEC-171 | 06/11/2026 | negócio | Ordem das folhas sem QR (CHG-017) | Ordem do arquivo, garantida por quem digitaliza; página indicada pela IA na localização | Desde a DEC-216, a folha cuja página mudou é lida de novo com a página informada, sem nova localização; desde a DEC-221, só com versões do formulário escolhido. A mesma chamada de localização (DEC-170) indica qual página da versão é cada folha; a ordem das folhas no arquivo não importa. Com QR legível, a página do QR prevalece e a IA só confere; divergência, página não reconhecida, faltante ou repetida levam a aplicação a `identificacao_pendente` (ERR-004), onde a usuária informa as páginas (`identifyApplication`); a página informada por ela prevalece, e só as folhas cuja página mudou ou não tinha sido reconhecida são localizadas de novo, só para as regiões, sem conferir a página (RN-052, item 3a). Substitui a reordenação manual na revisão proposta no Change Request | Sem custo extra e sem depender da ordem do maço; reduz o Risco 1 (Carlos Yano, 06/11/2026) | definitivo | Médio | DEC-008, RF-006, FL-001, CA-013, CA-053, Risco 1 |
| DEC-172 | 06/11/2026 | negócio | CPF e assinatura no papel antigo (CHG-017) | Dispensar no papel antigo; completar à mão; exigir como hoje | Na aplicação de versão de papel antigo (DEC-175), CPF ausente, ilegível ou inválido e assinatura ausente não impedem a conclusão: a aplicação conclui sem CPF e com a assinatura registrada como está (RN-044 continua: uma pessoa confere). CPF válido lido continua vinculando pelo CPF (RN-015); sem ele, o vínculo é pelo nome (DEC-176). Nome, data e local continuam obrigatórios (DEC-020); a data de nascimento também é dispensada (DEC-176). A aplicação de papel antigo concluída entra nos relatórios e nas exportações mesmo sem assinatura (exceção ao CA-021 e à DEC-157); sem CPF, a coluna CPF sai vazia. É exceção também à DEC-006: no papel antigo, a assinatura não é a evidência do consentimento (DEC-173) | Os questionários antigos não pediam CPF nem assinatura; sem a dispensa, todo o acervo ficaria em `aguardando_cpf` ou `sem_assinatura` (Carlos Yano, 06/11/2026) | definitivo | Alto | RN-011, RN-012, RN-015, RN-025, RN-044, RN-051, FL-001, CA-021, CA-054, DEC-006, DEC-020, DEC-157 |
| DEC-173 | 06/11/2026 | negócio | Base legal dos dados das pesquisas antigas (CHG-017) | Declaração da usuária no envio, auditada; garantia fora do sistema | O responsável garante fora do sistema a base legal do tratamento dos dados das pesquisas antigas; o sistema não pede declaração no envio e só marca a origem (papel antigo) na versão (DEC-175); a aplicação herda a marca da sua versão (`papel_antigo`, só leitura). A evidência de consentimento por aplicação (RN-041) não se aplica ao papel antigo | O consentimento dessas pesquisas foi colhido antes do sistema, em outro termo (Carlos Yano, 06/11/2026) | definitivo | Médio | RN-041, GX-001, DEC-175 |
| DEC-175 | 06/11/2026 | negócio | Como o sistema sabe que é papel antigo (Q-063) | Marca na versão; todo envio sem QR legível | A versão tem a marca `papel_antigo`, escolhida pela usuária ao criar ou importar o formulário e imutável depois da publicação (RN-042); a versão de papel antigo não gera PDF imprimível. Só a aplicação de versão de papel antigo tem a dispensa da DEC-172; um formulário oficial com o QR estragado continua exigindo CPF e assinatura | Resposta do responsável: "A" (Carlos Yano, 06/11/2026) | definitivo | Médio | DEC-169, DEC-172, DEC-173, ENT-006, RN-052 |
| DEC-176 | 06/11/2026 | negócio | Respondente sem CPF no papel antigo (Q-064) | Nome e data de nascimento; respondente novo a cada aplicação; só o nome | Na conclusão de aplicação de papel antigo sem CPF válido, o vínculo é só pelo nome: o sistema lista os respondentes com o mesmo nome normalizado (sem acento, sem diferença de maiúsculas, com os espaços das pontas retirados e os repetidos reduzidos a um), com a data de nascimento de cada um quando houver, e a usuária escolhe um deles ou um respondente novo; sem candidato, cria respondente novo, sem CPF. A data de nascimento também deixa de ser obrigatória no papel antigo. O vínculo pelo nome não altera o cadastro escolhido: data de nascimento e endereço lidos só preenchem o que estiver vazio. Respondente sem data de nascimento fica fora dos filtros por idade (RF-009). O pedido do titular de respondente sem CPF o identifica pelo respondente achado pelo nome (RF-010; contrato 0.7.0; implementação no IMP-004) | Resposta do responsável: "somente nome, pois nem sempre teremos CPF e data de nascimento preenchidos" (Carlos Yano, 06/11/2026) | definitivo | Alto | DEC-020, DEC-172, RN-011, RN-015, ENT-009, RF-009, RF-010, CA-054 |
| DEC-177 | 06/11/2026 | negócio | Pergunta que a localização não encontra (Q-065) | Item à revisão sem leitura; aplicação em `identificacao_pendente` | O item da pergunta sem região vai a `a_revisar`, sem leitura, e a usuária responde olhando a página inteira na revisão (em branco, se o papel não tinha o campo) | Resposta do responsável: "A" (Carlos Yano, 06/11/2026) | definitivo | Médio | DEC-170, RN-052, FL-002, CA-055 |
| DEC-178 | 06/11/2026 | negócio | Quando a localização não reconhece a página (Q-066) | Limite próprio; só página nula ou fora da versão; o limite dos campos | A folha conta como não reconhecida quando a localização não indica página, indica página fora da versão ou indica a página com confiança abaixo de `limite_confianca_localizacao` (padrão 0,50, calibrado no conjunto-ouro); `limite_confianca` continua só para os campos | Até a calibração, `limite_confianca` é 1,00 e pararia quase todo envio; todos os campos ainda passam pela revisão, que pega recorte errado (Carlos Yano, 06/11/2026; desde a DEC-216 não há recorte, e a folha não reconhecida não é lida) | definitivo | Médio | RN-052, DEC-127, DEC-171, CA-053 |
| DEC-179 | 06/11/2026 | negócio | Perguntas que o papel antigo não tem e data e local da aplicação (Q-067) | Marcar "não consta"; poder remover; como hoje | Na versão de papel antigo, as perguntas de CPF, data de nascimento, data e local da aplicação PODEM ser marcadas `nao_consta` (o nome, não). Pergunta `nao_consta` não é localizada nem lida: CPF e data de nascimento nascem `em_branco`; data e local nascem `corrigido` com o valor digitado pela usuária no envio ou, sem valor, `a_revisar` sem leitura. A tela de envio de papel antigo traz data e local preenchidos com os últimos informados no projeto (`padrao_data_aplicacao`, `padrao_local_aplicacao`); o valor que a usuária muda vira o novo padrão para os envios seguintes. A medida de "caber na página" (DEC-143) não vale para a versão de papel antigo. O padrão só muda com valor enviado e aplicado à aplicação (DEC-185, DEC-186) | São vários respondentes por pesquisa, digitalizados em sequência; a usuária não pode digitar data e local um a um (Carlos Yano, 06/11/2026) | definitivo | Médio | RN-016, RN-017, RN-050, DEC-143, DEC-172, ENT-004, ENT-007, CA-057 |
| DEC-180 | 06/11/2026 | negócio | Versão diferente da do QR legível (Q-068) | O QR sempre decide; a usuária decide | Com QR legível de versão válida do projeto, a versão é sempre a do QR: a versão escolhida no envio só vale quando nenhuma folha tem esse QR, e o `identifyApplication` com versão diferente da do QR legível e válido de alguma folha é recusado com ERR-039, auditado. QR legível de versão inexistente, não publicada, de outro tenant ou de outro projeto (CA-039) não decide a versão: a usuária a informa, mas nunca uma versão de papel antigo (DEC-184). A versão de papel antigo só é usada em aplicação sem nenhuma folha com QR legível | Impede que um formulário oficial ganhe a dispensa de CPF e assinatura do papel antigo (DEC-175) (Carlos Yano, 06/11/2026) | definitivo | Médio | DEC-169, DEC-175, DEC-184, ERR-039, CA-052 |
| DEC-181 | 06/11/2026 | negócio | Páginas do formulário importado de papel antigo (Q-069) | Manter a página do original; redistribuir como hoje | Na importação com `papel_antigo` (RN-049), cada pergunta fica na página em que está no original, sem a redistribuição do passo 4 nem o descarte `nao_cabe`, e a versão tem tantas páginas quanto o original. Dos 5 campos da RN-050, os reconhecidos no papel ficam na sua página; os não reconhecidos entram na página 1, marcados `nao_consta` (DEC-179), exceto o nome, que entra sem a marca e é procurado pela localização. A versão de papel antigo não grava `mapa_layout` e não passa pela medida da DEC-143 | As páginas da versão precisam bater com as folhas reais para a localização e a conferência de páginas (RN-052) (Carlos Yano, 06/11/2026) | definitivo | Médio | RN-049, RN-050, RN-052, DEC-143, DEC-175, DEC-179, DEC-190, CA-058 |
| DEC-182 | 06/11/2026 | negócio | Data e local do envio em casos de borda (Q-070) | Valer só se a versão final for de papel antigo; recusar quando não se aplicam | Data e local enviados no `uploadImages` ficam gravados na aplicação e só valem quando a versão da aplicação, definida no envio ou depois (`identifyApplication`, `addApplicationPages`), é de papel antigo com a pergunta `nao_consta`; só então preenchem o item e atualizam o padrão do projeto. Em versão que não é de papel antigo, são apagados quando a localização confirma a versão e as páginas (DEC-185, DEC-186). Data futura → ERR-001, nada é gravado. PODE vir só a data ou só o local | Os maços chegam sem versão ou com a versão corrigida depois; a digitação não pode se perder nem contaminar formulários oficiais (Carlos Yano, 06/11/2026) | definitivo | Baixo | DEC-179, DEC-185, ENT-010, CA-057 |
| DEC-183 | 06/11/2026 | negócio | Página 1 assinada anexada sem QR legível (Q-071) | A usuária confere; a IA localiza em segundo plano | No `attachSignaturePage`, sem QR legível, a folha não vai à IA: a usuária confirma, na conferência da assinatura (RN-044), que é a página 1 da aplicação. Com QR legível, a conferência pelo QR continua | Sem custo, sem espera e sem chamada externa no meio da operação (Carlos Yano, 06/11/2026) | definitivo | Baixo | RN-044, RN-052, CA-044, FL-001 |
| DEC-184 | 06/11/2026 | negócio | Versão de papel antigo em aplicação com QR legível de versão inválida (Q-072) | Nunca papel antigo; só o QR válido bloqueia | Aplicação com alguma folha de QR legível, de versão válida ou não, nunca recebe versão de papel antigo: o `identifyApplication` com versão de papel antigo nessa aplicação é recusado com ERR-039, auditado, e nada muda. A versão de papel antigo escolhida no envio ou no `addApplicationPages` também não vale nessa aplicação (a tabela de criação da FL-001 a deixa em `identificacao_pendente`). Corrige a DEC-180, que deixava a usuária informar qualquer versão quando o QR legível não era válido | Resposta do responsável: "Nunca papel antigo" (Carlos Yano, 06/11/2026); mantém o objetivo da DEC-180, de que um formulário oficial não ganhe a dispensa de CPF, assinatura e consentimento (DEC-172, DEC-173) | definitivo | Médio | DEC-172, DEC-173, DEC-175, DEC-180, ERR-039, FL-001, CA-052 |
| DEC-185 | 06/11/2026 | negócio | Quando data e local do envio são aplicados ou apagados (Q-073) | Só ao sair da pendência; quando a versão é escolhida | Data e local enviados no `uploadImages` ficam gravados na aplicação enquanto ela está em `identificacao_pendente`, qualquer que seja a versão escolhida, e só são aplicados ou apagados quando ela sai de lá (ou nasce fora dela): com versão de papel antigo que tem a pergunta `nao_consta` correspondente, o valor preenche o item e atualiza o padrão do projeto; com versão que não é de papel antigo, data e local são apagados. O `addApplicationPages` que traz data ou local substitui o valor gravado (só o que vier). Na versão de papel antigo sem a pergunta `nao_consta` de data ou de local, o valor correspondente é ignorado e apagado, e a pergunta é localizada e lida como as demais. Ajusta a DEC-182. O momento de aplicar ou apagar foi revisto pela DEC-186 | Resposta do responsável: "Só ao sair da pendência" (Carlos Yano, 06/11/2026); a versão escolhida por engano no envio não pode fazer a digitação se perder | definitivo | Baixo | DEC-179, DEC-182, ENT-010, FL-001, CA-057 |
| DEC-186 | 06/11/2026 | negócio | Momento de aplicar ou apagar data e local do envio (Q-074) | Quando a versão é confirmada; no nascimento da aplicação | Data e local do envio ficam gravados até a localização confirmar a versão e as páginas, no fim da localização que leva a aplicação à leitura (inclusive a que segue o `identifyApplication`); só então são aplicados (versão de papel antigo com a pergunta `nao_consta`: preenchem o item e atualizam o padrão do projeto) ou apagados (versão oficial, ou papel antigo sem a pergunta `nao_consta` correspondente). Antes disso, em `em_leitura`, `aguardando_cota` ou `identificacao_pendente`, nada é aplicado nem o padrão muda. Revê o momento da DEC-185. A parte do padrão do projeto foi revista pela DEC-192 | Resposta do responsável: "Quando a versão é confirmada" (Carlos Yano, 06/11/2026); a aplicação nascida em `em_leitura` pode voltar à pendência pela localização, e nada aplicado precisa ser desfeito | definitivo | Baixo | DEC-179, DEC-182, DEC-185, FL-001, FL-002, CA-057 |
| DEC-187 | 06/11/2026 | negócio | O que é QR legível (Q-075) | Só o QR do sistema; qualquer QR decodificável | QR legível é só o que decodifica no formato do identificador do MinhaPesquisa (DEC-048). QR de outro formato (site, outro sistema) conta como folha sem QR: não decide a versão nem impede a de papel antigo (DEC-184), e a sua presença é auditada sem o conteúdo | Resposta do responsável: aceita a recomendação (Carlos Yano, 06/11/2026); o papel antigo pode trazer QR de terceiros, e o acervo não pode ficar de fora por isso | definitivo | Baixo | DEC-048, DEC-180, DEC-184, RN-052 |
| DEC-188 | 06/11/2026 | negócio | Folha de página sem perguntas no envio (Q-076) | Por eliminação; sempre pendência; descrição guardada na importação | Quando, ao fim da localização, sobra exatamente uma folha não reconhecida e falta exatamente uma página da versão, e essa página não tem perguntas, a folha passa a ser essa página, sem regiões e sem leitura; em qualquer outro caso, a folha não reconhecida leva a aplicação a `identificacao_pendente` (DEC-178) | Resposta do responsável: "Por eliminação" (Carlos Yano, 06/11/2026); a localização não tem como reconhecer capa ou agradecimento, e a pendência a cada envio daria trabalho | definitivo | Baixo | DEC-178, DEC-181, RN-052, CA-053 |
| DEC-189 | 06/11/2026 | negócio | Total de páginas na cópia de versão (Q-077) | Copiar quando a nova é de papel antigo; recalcular sempre | A cópia de versão (`createVersion` com `copiar_de_versao_id`) leva o `total_paginas` informado quando a versão nova é de papel antigo e o apaga quando não é | Resposta do responsável: aceita a recomendação (Carlos Yano, 06/11/2026); sem o total, a cópia de um papel antigo com página final sem pergunta mandaria todo envio à pendência | definitivo | Baixo | DEC-181, ENT-006, RN-050 |
| DEC-190 | 06/11/2026 | negócio | Posição dos campos injetados na importação de papel antigo (Q-078) | No início da página 1, na ordem da RN-050; no fim da página 1 | Na importação de papel antigo, os campos da RN-050 que o original não tem entram no início da página 1, na ordem da tabela da RN-050, antes das perguntas do original | Resposta do responsável: aceita a recomendação (Carlos Yano, 06/11/2026); a posição define a ordem na revisão e na exportação longa (RN-051) | definitivo | Baixo | DEC-181, RN-049, RN-050, RN-051, CA-058 |
| DEC-191 | 06/11/2026 | negócio | Aplicações de papel antigo em andamento na eliminação de respondente sem CPF (Q-079) | Listar para a usuária decidir o descarte; risco aceito | No pedido de eliminação de respondente sem CPF, o sistema lista as aplicações de papel antigo em andamento (fora de `concluida` e `descartada`) cujo NOME tem o mesmo nome normalizado do respondente (DEC-176), e a usuária decide o descarte de cada uma (`discardApplication`); a lista é auditada sem o nome, e a execução do pedido não as descarta sozinha | Resposta do responsável: "Listar para descarte" (Carlos Yano, 06/11/2026); sem CPF, essas aplicações não são achadas pelo `cpf_hash` e, concluídas, trariam de volta os dados do titular eliminado | definitivo | Médio | DEC-176, RN-031, RF-010, TS-008, CA-056 |
| DEC-192 | 06/11/2026 | negócio | Quando o padrão de data e local do projeto muda (Q-080) | No envio; na confirmação, se o envio for mais recente | O padrão de data e local do projeto (`padrao_data_aplicacao`, `padrao_local_aplicacao`) muda no próprio envio (`uploadImages` ou `addApplicationPages`) que traz o valor, com o valor digitado (só o que vier), qualquer que seja a versão ou o destino da aplicação. Os itens da aplicação continuam sendo preenchidos ou apagados só quando a localização confirma a versão e as páginas (DEC-186). Revê a parte da DEC-186 sobre o padrão | Resposta do responsável: "No envio" (Carlos Yano, 06/11/2026); os maços são enviados em sequência, antes de a localização anterior terminar, e uma pendência resolvida depois não pode voltar o padrão para uma data mais antiga | definitivo | Baixo | DEC-179, DEC-186, ENT-004, CA-057 |
| DEC-193 | 06/11/2026 | negócio | Nome e momento da lista de aplicações na eliminação sem CPF (Q-081) | NOME revisado ou lido, lista gravada na execução; só o revisado, lista na hora | Na lista da DEC-191, o nome de cada aplicação é o `valor_final` do NOME ou, sem ele, o `valor_ia`. A lista é recalculada a cada consulta enquanto o pedido não foi executado e fica gravada no pedido na execução (`PedidoTitular.aplicacoes_mesmo_nome`), para continuar visível depois da anonimização | Resposta do responsável: aceita a recomendação (Carlos Yano, 06/11/2026); o NOME vai sempre à revisão (FL-002, regra 6) e a aplicação em andamento pode ainda não ter `valor_final` | definitivo | Baixo | DEC-176, DEC-191, ENT-018, CA-056 |
| DEC-195 | 06/11/2026 | negócio | "Nenhuma das anteriores" na múltipla escolha de papel antigo (Q-082) | Só no papel antigo; em todo formulário; manter a RN-047 | Na versão de papel antigo, a `multipla_escolha` não precisa da opção `nenhuma_das_anteriores`: a importação de papel antigo não a acrescenta (RN-049) e a publicação não a exige (RN-047, DEC-096). Fora do papel antigo nada muda. Quando a opção existe, a regra 7 da FL-002 continua valendo | Resposta do responsável: aceita a recomendação, opção B (Carlos Yano, 06/11/2026); o papel antigo não tem essa caixa impressa, e a opção nunca viria marcada da leitura | definitivo | Baixo | RN-047, RN-049, DEC-096, DEC-181, CA-058 |
| DEC-196 | 06/11/2026 | negócio | Contagem de folhas no envio sem QR (Q-083) | No envio, também sem QR; só no fim da localização | A linha 4 da tabela de criação da FL-001 vale também com a versão escolhida no envio: número de folhas diferente do total da versão leva a `identificacao_pendente` (ERR-004) já no envio, sem localização (CA-052, exemplo 2). O CA-053, exemplo 9, passa a partir dessa pendência | Resposta do responsável: opção A (Carlos Yano, 06/11/2026); evita localizar folhas que já se sabe que não fecham com a versão | definitivo | Baixo | FL-001, CA-052, CA-053, DEC-171, RN-052 |
| DEC-197 | 07/11/2026 | negócio | Texto escrito ao lado da opção "Outro" (Q-084) | Texto livre da opção, lido, revisado e exportado; pergunta de texto curto depois; fora do escopo | A opção "Outro" ("Outros", "Especifique", "Qual?") pode ter um texto complementar: a importação a reconhece e marca a opção como opção com complemento; quando ela é marcada, a IA lê também o texto escrito ao lado, que vai à revisão como um valor à parte do item, e a exportação leva esse texto numa coluna própria. Propagada na v2.8 (DEC-199 a DEC-202) | Resposta do responsável: opção A (Carlos Yano, 07/11/2026); nos testes preliminares, "Outros: Maternidade" foi gravado só como `outro` e a palavra se perdeu | definitivo | Médio | ENT-008, ENT-011, RN-049, RN-051, RF-007, RF-012 |
| DEC-198 | 07/11/2026 | negócio | Nome do arquivo enviado (Q-085) | Só na tela, sem gravar; gravar como dado pessoal; gravar e exportar | O nome original do arquivo enviado é gravado em cada página que veio dele (ENT-025), tratado como dado pessoal (o nome costuma trazer o nome da pessoa): expurgado com a imagem, nunca em log (RN-028). O resultado do envio mostra o nome do arquivo e o número sequencial da página na ordem de envio, e a exportação leva o nome do arquivo numa coluna própria. Propagada na v2.8 (ENT-025, RF-006, RN-051, DEC-201) | Resposta do responsável: opção C (Carlos Yano, 07/11/2026); um arquivo por pessoa, com todas as páginas, é o envio normal, e o nome do arquivo ajuda a conferir a planilha | definitivo | Médio | ENT-025, RF-006, RF-012, RF-014, RN-028, RN-051 |
| DEC-199 | 07/11/2026 | negócio | Complemento vazio com "Outro" marcado (Q-086) | Opcional; obrigatório | O complemento é opcional: com a opção marcada e nada escrito, ilegível ou rasurado ao lado, o item de complemento é resolvido como `em_branco`, `ilegivel` ou `rasurado` e não impede a conclusão; a exportação leva a célula `Complemento` vazia | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); o idoso muitas vezes marca "Outro" sem especificar | definitivo | Baixo | RN-009, FL-002, RN-051, CA-059 |
| DEC-200 | 07/11/2026 | negócio | Revisão do complemento (Q-087) | Sempre à revisão, como o texto curto; regra geral de confiança | O item de complemento segue a regra geral da FL-002: lido em branco vai a `a_revisar` (regra 6a, DEC-074); acima do limite de confiança (DEC-028) é confirmado automaticamente (regra 8); senão vai a `a_revisar`. A regra 6 (texto curto e texto livre sempre à revisão, DEC-066) não se aplica a ele | Resposta do responsável: "Regra geral de confiança" (Carlos Yano, 07/11/2026), contra a recomendação de levá-lo sempre à revisão; até a calibração o limite é 1,00 (DEC-127), e na prática ele vai à revisão | definitivo | Médio | FL-002, DEC-028, DEC-066, DEC-074, CA-059 |
| DEC-201 | 07/11/2026 | negócio | Colunas do complemento e do arquivo no formato longo (Q-088) | Colunas novas por pergunta; arquivo por aplicação | A RN-051 ganha a coluna `Arquivo`, logo depois de `ID_Aplicacao`, com o nome do arquivo da página da versão onde está a pergunta, e a coluna `Complemento`, logo depois de `Rotulo_Opcao_Valor`, preenchida só na linha da opção com complemento marcada, com o `valor_final` do item de complemento | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); na tabela dinâmica, cada linha diz de que arquivo veio | definitivo | Médio | RN-051, RF-012, CA-050, CA-059, CA-060 |
| DEC-202 | 07/11/2026 | negócio | Onde a opção ganha complemento (Q-089) | Editor e PDF; só na importação | A marca `com_complemento` da opção (ENT-008) é posta pela importação (RN-049) e pode ser ligada e desligada pela usuária no rascunho (`createVersion`, `updateVersion`); o PDF gerado (`generatePdf`) imprime uma linha para escrever depois do rótulo dessa opção. Só opções de `escolha_unica` e `multipla_escolha` a admitem, e nunca `nenhuma_das_anteriores` (RN-047) | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026) | definitivo | Baixo | ENT-008, RN-047, RN-049, RF-004, RF-011, CA-059 |
| DEC-204 | 07/11/2026 | negócio | Complemento já revisado quando a pergunta muda (Q-091) | Manter a revisão; voltar à revisão | O item de complemento resolvido pela usuária (`confirmado`, `corrigido`, `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica`) é mantido quando o item da pergunta é revisado de novo e continua com a opção marcada; só muda quando a opção deixa de estar marcada (`nao_se_aplica`) ou na reabertura da aplicação (`a_revisar`, com o `valor_final` preservado) | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026) | definitivo | Baixo | FL-002, DEC-197, CA-059 |
| DEC-205 | 07/11/2026 | negócio | Texto ao lado de uma opção não marcada (Q-093) | À revisão como inconsistência; ignorar | Quando o item da pergunta fica resolvido sem a opção com complemento e a leitura achou texto ao lado dela, o item de complemento vai a `a_revisar`, como inconsistência (mesmo critério do CA-019); a usuária corrige a pergunta, marcando a opção, ou marca o complemento como `nao_se_aplica`. Sem texto lido, o complemento fica `nao_se_aplica`. Enquanto a opção não está marcada, o complemento só aceita `nao_se_aplica` na revisão e não é exportado | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); evita perder a palavra quando o idoso escreve sem marcar a caixa | definitivo | Baixo | FL-002, DEC-197, CA-019, CA-059 |
| DEC-206 | 07/11/2026 | negócio | Nome do arquivo na eliminação do titular (Q-092) | No ato da eliminação; junto com a imagem | Na execução do pedido de eliminação, o `nome_arquivo` das páginas das aplicações do titular é apagado no ato, junto com os valores dos itens, e a reaplicação da ListaEliminacoes após um restore o apaga de novo (DEC-062). No descarte, o nome segue a imagem e é apagado no expurgo físico (DEC-077) | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); o nome costuma trazer o nome da pessoa, e a imagem pode levar até 30 dias para o expurgo físico | definitivo | Médio | DEC-198, RN-030, CA-023, TS-005, ENT-019, ENT-025 |
| DEC-207 | 07/11/2026 | negócio | Complemento e arquivo na exportação linha a linha (Q-090) | Também no linha a linha; só no formato longo | A exportação `linha_a_linha` (RF-010, IMP-004) também leva o complemento de cada opção com complemento e o nome do arquivo, no formato que a M-06 definir antes do IMP-004; o dashboard e a exportação agregada não mostram nenhum dos dois, e a ficha individual mostra só o complemento (DEC-211) | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026) | definitivo | Baixo | DEC-197, DEC-198, RF-010, IMP-004 |
| DEC-208 | 07/11/2026 | negócio | Complemento quando a usuária tira a opção (Q-094) | Não se aplica direto; à revisão pela DEC-205 | A DEC-205 vale só quando o valor da pergunta sem a opção veio da leitura (`confirmado_automaticamente` ou `confirmado`). Quando a usuária corrige a pergunta (`corrigido`) para um valor sem a opção com complemento, o complemento vai direto a `nao_se_aplica`, mesmo com texto lido, que fica só em `valor_ia` | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); quem tirou a opção já viu o texto ao lado dela na revisão | substituído (DEC-209) | Baixo | DEC-205, FL-002, CA-059 |
| DEC-209 | 07/11/2026 | negócio | Complemento quando a pergunta fica sem a opção (Q-095) | Por quem decidiu a pergunta; só a leitura vai à revisão; todo estado menos `corrigido` | A DEC-205 vale quando o valor da pergunta sem a opção com complemento veio da leitura ou do worker: `confirmado_automaticamente`, `confirmado` ou `nao_se_aplica` posto por regra de salto (`revisor_id` nulo). Quando a própria usuária resolveu a pergunta por outra ação (`corrigido`, `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica` marcado por ela), o complemento vai direto a `nao_se_aplica`, mesmo com texto lido, que fica só em `valor_ia`. Na reabertura, vale o estado da pergunta antes de reaberta | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); quem decidiu a pergunta já viu a página; substitui a DEC-208, que só tratava o `corrigido` | definitivo | Baixo | DEC-205, DEC-208, FL-002, CA-059 |
| DEC-210 | 07/11/2026 | negócio | Nome do arquivo das aplicações descartadas pela eliminação (Q-096) | No ato; no expurgo | Na execução da eliminação, o `nome_arquivo` é apagado no ato também nas páginas das aplicações descartadas pela própria execução: as em andamento do titular e as de papel antigo de mesmo nome que a usuária manda descartar junto (DEC-191). O descarte comum continua apagando o nome no expurgo físico (DEC-077, DEC-206) | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); a aplicação em andamento muitas vezes ainda não tem respondente, e o nome do arquivo é a única ligação dela com a pessoa | definitivo | Médio | DEC-191, DEC-206, RN-030, CA-023, TS-008 |
| DEC-211 | 07/11/2026 | negócio | Complemento e arquivo na ficha individual (Q-097) | Só o complemento; os dois; nenhum | A ficha individual (RF-009, TL-009) mostra, junto do valor da pergunta, o complemento de cada opção com complemento marcada, com o `valor_final` do item em `confirmado_automaticamente`, `confirmado` ou `corrigido` (como na RN-051); o nome do arquivo não aparece na ficha | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); o complemento faz parte da resposta da pessoa, e o nome do arquivo é dado operacional | definitivo | Baixo | DEC-207, RF-009, TL-009, CA-059 |
| DEC-212 | 07/11/2026 | negócio | Complemento de opção não marcada já revisado (Q-098) | Manter a revisão; voltar à revisão | O `nao_se_aplica` que a usuária marca no item de complemento de opção não marcada (DEC-205) é mantido quando o item da pergunta muda de novo e continua sem a opção; só muda quando a opção passa a estar marcada (pré-regra 1b) ou na reabertura a partir de `concluida` (linhas próprias da FL-002) | Resposta do responsável: recomendação aceita (Carlos Yano, 07/11/2026); estende a DEC-204 à opção não marcada e evita revisar o mesmo complemento em laço | definitivo | Baixo | DEC-204, DEC-205, DEC-209, FL-002, CA-059 |
| DEC-215 | 10/11/2026 | negócio | Projeto e formulário escolhidos antes do envio (CHG-019, Q-101) | Escolha opcional com QR decidindo; escolha obrigatória com o QR prevalecendo; escolha obrigatória com bloqueio na divergência | Todo envio (`uploadImages`, por scanner ou foto) informa o projeto e o formulário; a versão continua opcional e, quando informada, é do formulário escolhido. Folha com QR legível de projeto ou formulário diferente do escolhido faz o envio inteiro ser recusado (ERR-045), sem criar aplicação, com os códigos lidos, para que a usuária escolha o projeto e o formulário certos. Substitui, nesse ponto, o "QR prevalece" da DEC-169 e da DEC-180, que continuam valendo para a versão | Resposta do responsável: "Alerta e bloqueia informando para a operadora selecionar o projeto e formulário correto" (Carlos Yano, 10/11/2026); toda leitura passa a partir de um gabarito conhecido | definitivo | Alto | DEC-169, DEC-180, DEC-221, DEC-222, RF-006, RF-013, RF-015, RN-052, FL-001, CA-052, CA-057, CA-061, ERR-045 |
| DEC-216 | 10/11/2026 | negócio | Leitura sobre a página inteira (CHG-019, Q-099) | Manter recortes separados; página inteira com tarja na identificação; página inteira como regra geral | Toda página de formulário passa pela identificação (página e confiança, sem regiões) e por uma leitura com a página inteira e o gabarito das perguntas dela, que devolve valor, confiança e região por campo. Acabam os recortes e o empilhamento com tarjas; ficam revogados o item 5 da RN-052 (sobreposição com folga) e a RN-039 (chamadas separadas), e a página inteira deixa de ser exceção à RN-038 | O bloco do CPF encostado no da data fazia a regra de sobreposição mandar os dois à revisão sem leitura em toda digitalização; os recortes também cortavam dígitos e tiravam o contexto da folha. O responsável aceitou o envio da página inteira com identificação e saúde juntas como regra geral (Carlos Yano, 10/11/2026; Risco 3) | definitivo | Alto | DEC-022, DEC-111, DEC-170, GX-001, RN-033, RN-036, RN-038, RN-039, RN-041, RN-045, RN-052, RF-007, CA-055, CA-062, Risco 3 |
| DEC-217 | 10/11/2026 | negócio | Códigos numéricos do projeto e do formulário (CHG-019, Q-103) | Sequenciais automáticos; formulário sequencial global; digitados pela usuária | O projeto ganha `codigo` sequencial no tenant, que na instalação é um só (DEC-107) (1 a 99999, mostrado com 5 dígitos) e o formulário, `codigo` sequencial dentro do projeto (1 a 999, mostrado com 3 dígitos); ambos atribuídos na criação, imutáveis e mostrados na tela. Os já existentes recebem o código pela ordem de criação. Passar do limite é recusado (ERR-001) | Resposta do responsável: recomendação aceita (Carlos Yano, 10/11/2026) | definitivo | Médio | ENT-004, ENT-005, RF-003, RF-004, DEC-218 |
| DEC-218 | 10/11/2026 | negócio | Conteúdo do QR (CHG-019, Q-100, Q-102, Q-104) | Código opaco da versão (`MP1.`); `PPPPP.FFF.X/Y`; `PPPPP.FFF.VV.X/Y` | O QR de cada página codifica `PPPPP.FFF.VV.X/Y`: código do projeto (5 dígitos), do formulário (3), número da versão (2) e a página `X` sobre o total `Y` da versão, por exemplo `00001.002.01.1/4`. QR legível é só o que decodifica nesse formato, com `1 ≤ X ≤ Y`. O QR `MP1.` impresso antes da v2.9 conta como ausente (DEC-187): vale a versão escolhida no envio. `Y` diferente do `total_paginas` da versão leva ao ERR-039. A versão no QR passa a limitar o formulário a 99 versões. Substitui o identificador opaco da DEC-048 | Respostas do responsável: incluir a versão no QR, com 2 dígitos; não aceitar o QR antigo (Carlos Yano, 10/11/2026) | definitivo | Alto | DEC-048, DEC-169, DEC-180, DEC-187, ENT-006, CA-028, CA-039, ERR-004, ERR-039 |
| DEC-219 | 10/11/2026 | negócio | Cabeçalho, rodapé e espaçamento do PDF (CHG-019) | Manter o layout; cabeçalho e rodapé enriquecidos | Toda página do PDF traz no cabeçalho o nome do projeto, em negrito e a 14 pt, e logo abaixo o nome do formulário, a 11 pt; no rodapé, o texto "Projeto: PPPPP · Formulário: FFF · Versão: VV · Página X/Y" e, no canto, o QR da DEC-218. Há pelo menos 18 pt de espaço vertical entre o termo, o bloco de identificação e CPF, a data da aplicação e as seções de perguntas, sem blocos encostados | Change Request de 10/11/2026 (Carlos Yano); os tamanhos de 14 pt e 11 pt foram aprovados pelo responsável em 13/11/2026 (REV-REQ-021, B-06) | definitivo | Médio | RF-004, CA-028, DEC-106, DEC-218 |
| DEC-221 | 10/11/2026 | negócio | Formulário fixo na aplicação (CHG-019, Q-105) | Formulário fixo; trocar o formulário no `identifyApplication` | O formulário escolhido no envio fica gravado na aplicação (`formulario_id`) e não muda. O `identifyApplication` e o `addApplicationPages` só aceitam versão desse formulário; versão de outro formulário é ERR-039, auditado. Escolhido o formulário errado, a usuária descarta a aplicação e envia de novo. Única exceção: aplicação anterior à v2.9, que não tem formulário gravado (DEC-223, DEC-231) e cuja `versao_id` é nula (DEC-234) | Resposta do responsável: recomendação aceita (Carlos Yano, 10/11/2026) | definitivo | Médio | DEC-215, DEC-100, DEC-223, ENT-010, RN-052, FL-001, CA-052, CA-057, ERR-039 |
| DEC-222 | 10/11/2026 | negócio | QR de outro formulário em folha acrescentada ou na página assinada (CHG-019, Q-106) | Recusa com ERR-045; regra antiga pela versão | Folha do `addApplicationPages` ou página 1 do `attachSignaturePage` com QR legível de projeto ou formulário diferente do da aplicação recusa o pedido com ERR-045; nada é gravado e a aplicação fica como estava | Resposta do responsável: recomendação aceita (Carlos Yano, 10/11/2026); mesma regra do envio (DEC-215) | definitivo | Médio | DEC-215, RN-052, FL-001, CA-044, CA-061, ERR-045 |
| DEC-223 | 13/11/2026 | negócio | Aplicação antiga sem formulário (CHG-019, Q-107) | Exceção estreita: o `identifyApplication` grava o formulário uma única vez; migrar sem nulo; impedir a identificação | A aplicação anterior à v2.9, sem versão (a de outro projeto é anulada, DEC-234), e em `identificacao_pendente` ou `descartada`, não tem formulário gravado (`formulario_id` nulo). O `identifyApplication` com a versão informada grava o formulário dessa versão, uma única vez, mesmo quando volta ERR-004 por páginas incompletas (DEC-229); depois disso vale a DEC-221 (formulário fixo). Nas demais aplicações o `formulario_id` é obrigatório | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); não há formulário a atribuir sem inventar dado (REV-REQ-021, M-01) | definitivo | Médio | DEC-221, ENT-010, FL-001, RN-052, CA-052, CA-057 |
| DEC-224 | 13/11/2026 | negócio | Códigos mostrados no ERR-045 com várias folhas divergentes (CHG-019, Q-108) | Códigos da primeira folha divergente, com o ERR-029 antes; todos os códigos lidos | Quando mais de uma folha tem QR de projeto ou formulário diferente do escolhido, o ERR-045 traz `projeto_qr` e `formulario_qr` da primeira folha divergente, na ordem do envio. Arquivo recusado (ERR-029) vem antes do ERR-045 | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); uma resposta curta e sem expor mais códigos que o necessário (REV-REQ-021, B-04) | definitivo | Baixo | DEC-215, DEC-222, RN-052, ERR-045, CA-061 |
| DEC-225 | 13/11/2026 | negócio | Versão de outro formulário no `addApplicationPages` (CHG-019, Q-109) | Recusa com ERR-039, sem gravar; gravar as folhas e avisar com ERR-039 | O `addApplicationPages` com `versao_id` de outro formulário do mesmo projeto que não o da aplicação recusa o pedido (400, ERR-039); a de outro projeto ou tenant segue a DEC-230 e a DEC-233, sem gravar as folhas e sem mudar a aplicação. As demais causas de ERR-039 seguem a tabela de criação da FL-001 (DEC-230) | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); coerente com a DEC-221 e a DEC-222 (REV-REQ-022, N-02) | definitivo | Médio | DEC-221, DEC-222, RN-052, FL-001, CA-061, ERR-039 |
| DEC-226 | 13/11/2026 | negócio | `addApplicationPages` em aplicação antiga sem formulário (CHG-019, Q-110) | Recusa até o `identifyApplication` definir o formulário; aceitar e comparar com o formulário da versão informada | Na aplicação anterior à v2.9, sem versão e sem `formulario_id` (DEC-223), o `addApplicationPages` é recusado com ERR-018 até o `identifyApplication` definir o formulário. Assim a aplicação nunca fica com versão e sem formulário | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); mantém a invariante da DEC-221 (REV-REQ-022, N-03) | definitivo | Médio | DEC-221, DEC-223, RN-052, FL-001, CA-061, ERR-018 |
| DEC-227 | 13/11/2026 | negócio | QR de outra versão ou com total diferente na página 1 assinada (CHG-019, Q-111) | ERR-039, permanece em `sem_assinatura`; aceitar a página 1 do mesmo formulário; ERR-004 | O `attachSignaturePage` com a página 1 de QR legível de outra versão do mesmo formulário, ou com `Y` diferente do `total_paginas` da versão (DEC-218), é recusado com ERR-039 e a aplicação permanece em `sem_assinatura`, sem folha nova. QR legível de página diferente de 1 segue o ERR-004 | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); segue a DEC-218 (REV-REQ-022, N-05) | definitivo | Médio | DEC-218, DEC-222, RN-044, FL-001, CA-044, ERR-039, ERR-004 |
| DEC-229 | 13/11/2026 | negócio | `identifyApplication` com páginas incompletas em aplicação antiga (CHG-019, Q-112) | Grava o formulário mesmo com ERR-004; o `addApplicationPages` informa a versão e define o formulário; só descartar | Na aplicação antiga sem formulário (DEC-223), o `identifyApplication` com versão válida (existente, publicada e do projeto) grava o `formulario_id` dessa versão, uma única vez, também quando a resposta é ERR-004 por páginas incompletas ou incoerentes; nada mais muda, exceto zerar a `versao_id` de outro projeto (DEC-234). Com o formulário gravado, o `addApplicationPages` deixa de ser recusado (DEC-226) | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); menor desvio da DEC-223 (REV-REQ-023, O-01) | definitivo | Alto | DEC-223, DEC-226, FL-001, CA-061, ERR-004, ERR-018 |
| DEC-230 | 13/11/2026 | negócio | Alcance da recusa do ERR-039 no `addApplicationPages` (CHG-019, Q-113) | Recusa só para a versão de outro formulário; recusa para todas as causas | No `addApplicationPages`, só a `versao_id` de outro formulário que não o da aplicação recusa o pedido (400, ERR-039, DEC-225). As demais causas de ERR-039 (versão inexistente, não publicada, de outro tenant ou projeto, ou de papel antigo com folha de QR legível) seguem a tabela de criação da FL-001: em geral as folhas são gravadas e a aplicação fica em `identificacao_pendente` com o aviso ERR-039 (linha 3); com QR legível e válido numa folha, vale a versão do QR (DEC-180) e a linha 3 não se aplica. A versão inválida não é gravada (DEC-232) | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); é o que a DEC-225 aprovou (REV-REQ-023, O-02) | definitivo | Alto | DEC-225, DEC-221, FL-001, CA-061, ERR-039 |
| DEC-231 | 13/11/2026 | negócio | Migração do `formulario_id` das aplicações existentes (CHG-019, Q-114) | Nulo também com versão de outro projeto e em descartada sem versão; atribuir o formulário da versão gravada | Na migração, o `formulario_id` é o da versão gravada; fica nulo quando a aplicação não tem versão ou quando a versão gravada é de outro projeto, em `identificacao_pendente` ou em `descartada` (DEC-223); a `versao_id` de outro projeto é anulada na mesma migração (DEC-234) | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); não grava formulário de outro projeto (REV-REQ-023, O-05) | definitivo | Médio | DEC-215, DEC-221, DEC-223, ENT-010 |
| DEC-232 | 13/11/2026 | negócio | `versao_id` inválida do pedido não é gravada (CHG-019, Q-115) | Descartar a inválida e avisar; gravar só se existir e for do tenant; gravar sempre | Quando a `versao_id` escolhida ou informada é inexistente, não publicada, de outro tenant, de outro projeto ou de outro formulário, ela não é gravada em `aplicacao.versao_id` (fica a anterior, ou nula): as folhas são gravadas, a aplicação fica em `identificacao_pendente` com o aviso ERR-039 e a resposta traz a `versao_id` que ficou valendo. Vale para a linha 3 da tabela de criação (`uploadImages`) e para o `addApplicationPages`, exceto a versão de outro formulário do mesmo projeto no `addApplicationPages`, que recusa o pedido (DEC-225). A `versao_id` válida continua gravada (DEC-169) | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); evita chave estrangeira quebrada e referência entre tenants (REV-REQ-024, R5-P03) | definitivo | Alto | DEC-169, DEC-180, DEC-230, FL-001, ENT-010, CA-061, ERR-039 |
| DEC-233 | 13/11/2026 | negócio | Versão de outro tenant no `uploadImages` e no `addApplicationPages` (CHG-019, Q-116) | Tratar como inexistente, com a tentativa auditada; 404 ERR-002; 200 sem tratar o tenant | A `versao_id` de outro tenant tem o mesmo tratamento da inexistente, sem revelar que ela existe, e a tentativa é auditada, como a DEC-100 já faz no `identifyApplication`: no `identifyApplication`, 400 ERR-039; no `uploadImages` e no `addApplicationPages`, 200 com o aviso ERR-039 e a versão não gravada (DEC-232). É exceção ao 404 ERR-002 do PLANO §6.1 | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); uma regra só para versão de outro tenant (REV-REQ-024, R5-P04) | definitivo | Alto | DEC-100, DEC-230, DEC-232, RN-002, CA-039, CA-061, ERR-039 |
| DEC-234 | 13/11/2026 | negócio | `versao_id` de outro projeto nas aplicações antigas (CHG-019, Q-117) | Anular na migração e zerar no `identifyApplication`; manter a versão e afrouxar a invariante | Na migração, a `versao_id` de outro projeto é anulada junto com o `formulario_id` (DEC-231), e o `identifyApplication` da DEC-229 também zera uma `versao_id` de outro projeto que encontre. Assim, a aplicação nunca tem versão sem ser do formulário dela (DEC-221, DEC-226) | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026); mantém a invariante da ENT-010 (REV-REQ-024, R5-P01) | definitivo | Médio | DEC-221, DEC-226, DEC-229, DEC-231, ENT-010 |
| DEC-235 | 13/11/2026 | negócio | Versão de papel antigo recusada pela DEC-184 (CHG-019, Q-118) | Tratar como inválida: não gravada, com aviso ERR-039; tratar como válida e gravar | A versão de papel antigo que a DEC-184 recusa (aplicação com folha de QR legível, válido ou não) é inválida como as demais causas de ERR-039: não é gravada em `versao_id`, e a aplicação fica em `identificacao_pendente` com o aviso ERR-039 (DEC-230, DEC-232). Vale no `uploadImages` e no `addApplicationPages` | Resposta do responsável: recomendação aceita (Carlos Yano, 13/11/2026) (REV-REQ-025, R6-03) | definitivo | Médio | DEC-184, DEC-230, DEC-232, FL-001, ERR-039 |

3.1 Decisões ainda pendentes (viram Q ou GX)

| Tema | Tratamento |
|---|---|
| Retenção de dados de produção em ambiente ativo | Aguarda parecer jurídico (GX-001). Backups já decididos em 90 dias (DEC-033). |
| Retenção da trilha de auditoria (inclui IP) | Aguarda parecer jurídico (GX-001); até lá, a auditoria é mantida e nunca contém valores pessoais (RN-027). |
| Provedor de IA | Claude primeiro e Gemini depois, para comparação no conjunto-ouro (DEC-122); pode processar fora do Brasil (DEC-111), com a transferência internacional de dados reais condicionada a GX-001. |
| Parecer jurídico (DPA + LGPD Art. 33) | Registrado como GX-001; o sistema é usado só para teste com dados sintéticos (DEC-119), e o GX-001 bloqueia qualquer uso com dados reais. |

4. Glossário e regras de negócio

4.1 Glossário

| Termo | Significado |
|---|---|
| Tenant | Entidade contratante do SaaS (clínica, cooperativa etc.). Cada tenant é isolado. |
| Respondente | Pessoa 60+ que responde formulários em papel. Identificada apenas pelo CPF, exceto no papel antigo sem CPF, em que o vínculo é pelo nome (DEC-172, DEC-176). |
| Aplicação | Conjunto de páginas de um formulário respondidas por um respondente em uma data e local. |
| Papel antigo | Pesquisa aplicada em papel que não foi impresso pelo sistema, sem QR e sem marcadores, digitalizada por scanner ou foto; marcada na versão (DEC-169, DEC-175). |
| QR legível | QR decodificado no formato `PPPPP.FFF.VV.X/Y` do MinhaPesquisa (DEC-218); QR de outro formato (site, outro sistema, ou o `MP1.` impresso antes da v2.9) conta como ausente, e a sua presença é auditada sem o conteúdo (DEC-187, DEC-218). |
| Localização | Desde a DEC-216, a chamada de identificação: a IA recebe a página inteira e devolve só qual página da versão é a folha e a confiança, sem ler valores nem devolver regiões (RN-052, DEC-170). As regiões vêm da leitura da página inteira. |
| Item de resposta | Registro de uma pergunta em uma aplicação (valor lido, confiança, valor final, estado). |
| Grupo | Filtro salvo (idade, estado civil, resposta a uma pergunta) recalculado a cada consulta. |
| Conjunto-ouro | Base de formulários preenchidos à mão com gabarito humano, para calibrar e medir o erro silencioso da IA. |
| Limite de confiança | Valor mínimo de confiança da IA para confirmar automaticamente um campo. |
| Erro silencioso | Leitura errada com confiança alta; o campo entra nos relatórios sem revisão. |
| Row-Level Security (RLS) | Mecanismo do PostgreSQL que garante isolamento de dados por tenant no banco. |
| Outbox transacional | Padrão que garante entrega de mensagens assíncronas com consistência de dados. |
| Link assinado | URL temporária com assinatura criptográfica para acesso a imagens privadas. |
| k-anonimato | Propriedade de que um grupo tem no mínimo k indivíduos, impedindo identificação. Não é aplicado a partir da v2.1 (DEC-110). |

4.2 Regras de negócio (RN)

Convenção: DEVE (obrigatório), NÃO DEVE (proibido), PODE (permitido).

RN-001 — Isolamento por tenant
O sistema DEVE isolar dados por `tenant_id` em todas as tabelas, com chaves estrangeiras compostas `(id, tenant_id)` e Row-Level Security no PostgreSQL como segunda barreira.

RN-002 — Recurso de outro tenant
Recurso de outro tenant DEVE responder 404, sem revelar se o recurso existe, e a tentativa DEVE ser auditada. Vale também para identificadores no corpo da requisição e para identificador que não pertença ao recurso pai do caminho (ex.: item de outra aplicação em `saveReview`).

RN-003 — Papel único (DEC-109)
A usuária tem todas as permissões. NÃO há perfis nem separação de papéis; as tabelas de perfis (ENT-003, ENT-022) ficam no banco sem uso (DEC-116).

RN-004 — Sem vínculo a projetos (DEC-109)
A usuária vê todos os projetos do tenant. NÃO há vínculo a projetos, concessão de acesso individual nem permissão por linha.

RN-005 — Sem acesso público
NÃO existe acesso público nem envio sem login, como regra fixa da plataforma.

RN-006 — Tenant único criado na instalação (DEC-107, DEC-116)
O script de instalação cria o único tenant. O isolamento por `tenant_id` no banco continua como defesa em profundidade.

RN-007 — Instalação e conta da usuária (DEC-108)
O script de instalação cria o tenant e a conta da usuária com a senha informada no próprio notebook. NÃO há convite, e-mail nem MFA. A senha esquecida é redefinida por script local, que encerra as sessões e registra a ação na auditoria.

RN-008 — Parâmetros de configuração
Os parâmetros DEVEM ter escopo (tenant, plataforma ou projeto), padrão e forma de alteração com auditoria, conforme a tabela da seção 2.9.

RN-009 — Item de resposta
O item de resposta DEVE ser um por pergunta; na matriz, um por linha; na múltipla escolha, a lista de códigos fica no mesmo item. Cada opção com complemento (`com_complemento`, DEC-202) gera também um item de complemento, ligado à pergunta e à opção (`opcao_id`), com o texto escrito ao lado dela (DEC-197); ele só vale quando a opção é marcada (FL-002, regra 1b) e é opcional (DEC-199).

RN-010 — Valor e estado separados
O item DEVE guardar o valor lido pela IA, a confiança, o valor final e o estado como campos separados.

RN-011 — Respondente
O respondente DEVE ter nome, data de nascimento e CPF (obrigatório, identificador único), e PODE ter endereço. Exceção: o respondente de papel antigo PODE não ter CPF nem data de nascimento (DEC-172, DEC-176). Perguntas marcadas como "campo do respondente" alimentam esses atributos.

RN-012 — CPF validado
O CPF DEVE ser validado na leitura (dígitos verificadores). CPF inválido, ilegível ou ausente vai para revisão, e a aplicação NÃO é concluída sem CPF válido, exceto na versão de papel antigo (DEC-172).

RN-013 — CPF cifrado e hash
Para permitir busca com o CPF cifrado, o banco DEVE guardar também um hash com chave (HMAC). O CPF aparece mascarado, exceto na revisão (depois de `openReview`, também em `getApplication` e `getItemImage`, enquanto a aplicação continuar em revisão; DEC-112, DEC-126), no pedido de acesso e na portabilidade do titular e na exportação linha a linha (DEC-072), e cada exibição completa DEVE ser auditada (acao=EXIBICAO_CPF). Na ficha individual o CPF é sempre mascarado.

RN-014 — Correção de CPF
Se o revisor corrigir um CPF já vinculado, o vínculo DEVE ser refeito: a aplicação passa ao respondente do CPF corrigido (ou a um novo), com auditoria.

RN-015 — Correspondência de respondente
A identificação é só pelo CPF, sempre conferido por uma pessoa, e o vínculo acontece na conclusão da aplicação. CPF já cadastrado vincula ao respondente existente; CPF novo cria um respondente. Na aplicação de papel antigo concluída sem CPF, o vínculo é só pelo nome, escolhido pela usuária entre os respondentes de mesmo nome ou um novo (DEC-176).

RN-016 — Data e local da aplicação
Todo formulário impresso DEVE trazer os campos "local" e "data da aplicação", lidos como os demais. Se o formulário não tiver esses campos ou vierem em branco, o digitalizador os informa; sem data e local, a aplicação NÃO é concluída. Na versão de papel antigo, a pergunta de data ou de local marcada `nao_consta` não é lida: vale o valor digitado no envio ou o informado na revisão (DEC-179).

RN-017 — Campos obrigatórios na publicação
Uma versão só PODE ser publicada se tiver perguntas marcadas como nome, data de nascimento e CPF do respondente (`campo_respondente`; o CPF com o tipo "CPF"), e como data e local da aplicação (`campo_aplicacao`). Todo rascunho novo sem cópia já nasce com essas perguntas (RN-050, DEC-135). Na versão de papel antigo, as de CPF, data de nascimento, data e local PODEM estar marcadas `nao_consta` (DEC-179).

RN-018 — Código estável de pergunta
Toda pergunta DEVE ter um código estável (ex.: `ESTADO_CIVIL`). É ele que permite comparar o mesmo dado entre formulários e versões diferentes.

RN-019 — Código estável de opção
Toda opção DEVE ter um código estável, separado do rótulo impresso, gerado sem acentos ("Viúvo" vira `viuvo`) e editável.

RN-020 — Estados distintos
Resposta em branco, ilegível, rasurada e "não se aplica" SÃO estados distintos, e nenhum deles vira zero ou "não".

RN-021 — Regra de salto na v1
Uma condição por pergunta ("mostrar se a pergunta X = valor Y"), impressa no formulário como instrução. A pergunta de origem é `sim_nao` ou `escolha_unica`, a opção existe nela, origem e destino são perguntas diferentes, o destino vem depois da origem e as regras não formam ciclo; caso contrário, o rascunho é recusado com ERR-001 (DEC-095). Pergunta pulada conforme a regra recebe "não se aplica" e NÃO vai para revisão, exceto quando estiver preenchida, caso em que vai para revisão como inconsistência (CA-019).

RN-022 — Ranking fora da v1
Ranking (ordenar itens) NÃO é suportado na v1.

RN-023 — Isolamento por tenant no banco (RNF-001)
Teste de integração gerado a partir da OpenAPI DEVE tentar acessar recursos de outro tenant em todas as operações privadas e exigir 404.

RN-024 — Criptografia (RNF-002, DEC-107)
Disco do notebook cifrado pelo BitLocker (banco, imagens e exportações); backup cifrado (DEC-117). O tráfego fica em 127.0.0.1, sem rede; a chamada ao provedor de IA usa TLS 1.2+.

RN-025 — CPF obrigatório (RNF-003)
CPF obrigatório como identificador do respondente (exceto no papel antigo, DEC-172), armazenado cifrado (com hash para busca) e exibido mascarado.

RN-026 — Sem tamanho mínimo de grupo (RNF-004, DEC-110)
Painéis e exportações mostram todas as contagens, sem ocultar grupos pequenos.

RN-027 — Trilha de auditoria (RNF-005)
Trilha de auditoria imutável de acesso a dado individual, correção, exportação e mudança de status; a auditoria guarda só referências (quem, quando, qual registro, qual campo, qual ação), nunca os valores.

RN-028 — Logs sem dado sensível (RNF-006)
Logs sem dado de saúde, nome, CPF, conteúdo lido ou nome de arquivo enviado (DEC-198).

RN-029 — Imagens privadas (RNF-007)
Imagens em pasta local privada do notebook, acesso só por link assinado local válido por 5 minutos (DEC-112).

RN-030 — Retenção configurável (RNF-008)
Retenção configurável por tenant, com expurgo de imagens e dados; expurgo em até 30 dias após o pedido ou o fim da retenção. Arquivos de exportação são apagados após `retencao_exportacao_dias` (seção 2.9).

RN-031 — Direitos do titular (RNF-009)
Direitos do titular: acesso, correção, eliminação e portabilidade, executados pela usuária em nome da instituição (tenant).

RN-032 — Provedor de IA sem retenção (RNF-010)
Provedor de IA sem retenção e sem uso dos dados para treino, com contrato (DPA).

RN-033 — Dados guardados no notebook (RNF-011, DEC-111)
Dados guardados só no notebook. O provedor de IA PODE processar as páginas inteiras enviadas na identificação e na leitura (DEC-170, DEC-216) fora do Brasil; isso é transferência internacional, liberada só após o parecer jurídico (GX-001) e o contrato com o provedor. As páginas de formulário-modelo da importação (RN-049) também vão ao provedor e podem ser processadas fora do Brasil, mas não contêm dado pessoal (DEC-133) e não dependem do GX-001.

RN-034 — Acessibilidade (RNF-012)
Acessibilidade WCAG 2.2 AA nas telas.

RN-035 — Tempo de leitura (RNF-013)
Tempo de leitura medido por página, com as páginas de uma aplicação lidas em paralelo; valor de referência de 95% das páginas lidas em até 2 minutos, medido com o provedor real sobre o conjunto-ouro (DEC-056). Na aplicação local, com uma usuária, não há meta de uploads simultâneos.

RN-036 — Custo de IA (RNF-014)
Custo de IA por página monitorado (inclui a chamada de identificação da página, DEC-170, DEC-216) e com teto por tenant; ao atingir o teto, novas leituras ficam na fila e a usuária é avisada na tela (DEC-112), sem descartar nada.

RN-037 — Injeção de instrução pela imagem
A resposta da IA DEVE ser sempre validada contra o schema do formulário, e a IA NUNCA executa ações nem acessa outros dados.

RN-038 — Minimização do que vai para a IA
Desde a v2.9 (DEC-216), a página de formulário vai inteira ao provedor, na identificação e na leitura, com identificação e saúde juntas (Risco 3). A minimização fica em: (1) só as páginas da aplicação, sem metadados (RN-040); (2) sem projeto, tenant, respondente nem nome de arquivo na chamada (RN-045, RN-028); (3) na leitura, só o gabarito das perguntas daquela página. A importação de formulário (RN-049) continua aceitando só modelo em branco ou com dados fictícios, declarado pela usuária (DEC-133).

RN-039 — Chamadas separadas
Revogada pela DEC-216 (CHG-019): identificação e saúde da mesma página são lidas na mesma chamada, sobre a página inteira. Continua valendo que nenhuma chamada leva o identificador do respondente. `Pergunta.sensibilidade` continua no gabarito e na auditoria, mas não separa mais as chamadas.

RN-040 — Metadados removidos
Metadados das imagens, incluindo GPS das fotos de celular, são removidos no upload (CA-029).

RN-041 — Papéis LGPD
Controlador: a instituição (tenant), dona do notebook. Operador: o provedor de IA, nas páginas inteiras enviadas na identificação e na leitura (DEC-170, DEC-216; as páginas de formulário-modelo da importação não têm dado pessoal, DEC-133). Base legal: cabe ao tenant (consentimento específico e destacado ou tutela da saúde). O sistema registra a evidência do consentimento por aplicação, exceto no papel antigo, cuja base legal é garantida fora do sistema (DEC-173).

RN-042 — Versão publicada imutável
Versão publicada DEVE ser imutável; alterações criam nova versão em rascunho.

RN-043 — Sem reserva de aplicação (DEC-112)
Não há reserva. A gravação concorrente (por exemplo, em duas abas) é recusada pelo If-Match (ERR-017).

RN-044 — Conferência de assinatura
Na v1, a conferência da assinatura é sempre feita por uma pessoa, mesmo quando todos os campos foram confirmados automaticamente. No papel antigo, a assinatura ausente não impede a conclusão (DEC-172).

RN-045 — Contrato do motor de leitura
O motor de leitura (DEC-007) DEVE receber a imagem da página inteira e o gabarito das perguntas daquela página (código, enunciado, tipo, opções, linhas da matriz, faixa e formato), e DEVE devolver, por campo: o valor lido, a confiança e a região da imagem de onde veio (bounding box). Na pergunta com opção com complemento, devolve também, por opção com complemento, o texto escrito ao lado e a confiança, sem região própria: o item de complemento usa a região da pergunta (DEC-197). O motor NÃO decide o que vai para revisão; quem chama é que decide. Na página 1, devolve também a região da assinatura, ou null. Campo que não encontrar volta sem valor e sem região. O motor NÃO conhece projeto, pesquisa, tenant, respondente nem receita; da versão, conhece só o gabarito da página (DEC-216). Na identificação da página (RN-052), o motor recebe a página inteira e a lista das perguntas da versão por página (código, enunciado e tipo, sem projeto nem tenant), e DEVE devolver só o número da página e a confiança; resposta com texto lido ou fora desse schema é recusada (RN-037). Resposta da leitura com campo fora do gabarito também é recusada (RN-037).

RN-047 — Estrutura de perguntas de matriz e múltipla escolha (DEC-010)
Pergunta do tipo `matriz` DEVE ter linhas com código estável (ENT-024) e opções comuns; gera um item de resposta por linha (RN-009). Pergunta do tipo `multipla_escolha` DEVE ter a opção "nenhuma das anteriores" com código `nenhuma_das_anteriores`, exceto na versão de papel antigo (DEC-195). Pergunta do tipo `sim_nao` tem as opções fixas `sim` e `nao`, criadas automaticamente. Só opções de `escolha_unica` e `multipla_escolha` podem ter `com_complemento`, e nunca a `nenhuma_das_anteriores`; caso contrário, o rascunho é recusado com ERR-001, com o código da pergunta em `campos` (DEC-202). Pergunta com `campo_respondente` ou `campo_aplicacao = aplicador` DEVE ter `sensibilidade = identificacao` (DEC-097), definida automaticamente e não editável. Nas demais perguntas, `sensibilidade` é `saude` ou `outro`; `identificacao` nelas é recusada com ERR-001 (DEC-097). Sem a estrutura exigida, a publicação é recusada (ERR-036), com os códigos das perguntas com problema em `campos` (DEC-096).

RN-048 — Autenticação e sessão (Bloco P P.2, DEC-108)
Senha de 10 a 72 caracteres, com minúscula, maiúscula e dígito, fora da lista de senhas vazadas, guardada com Argon2id. Após 5 falhas em 15 minutos para o mesmo e-mail, exista ou não a conta, novas tentativas são bloqueadas por 15 minutos. Sessão expira após 30 minutos de inatividade ou 24 horas; no máximo 3 sessões ativas por usuário. Sem MFA, convite ou link de recuperação: a senha é redefinida por script local (DEC-108).

RN-046 — Conjunto-ouro e limites por domínio
O conjunto-ouro e os limites de confiança SÃO por domínio. O conjunto-ouro do MinhaPesquisa (formulários de pesquisa, público 60+) NÃO serve para o MeuRemedio (receitas médicas). Cada domínio DEVE ter seu próprio gabarito humano e suas próprias metas de erro silencioso.

RN-049 — Importação de formulário (DEC-132, DEC-133, DEC-136, DEC-138, DEC-139, DEC-143, DEC-144, DEC-146)
Entradas: o projeto, ativo (arquivado → ERR-001, DEC-146); o nome do formulário novo; a declaração `sem_dados_reais` (sem ela, ERR-001); e um ou mais arquivos nos tipos e limites da DEC-029, com no máximo 50 páginas no envio, varredura de malware e remoção de metadados como no RF-006 (ERR-029). As páginas são lidas na ordem do envio. O extrator é instruído a devolver só o que está impresso e a ignorar respostas e marcas feitas à mão; a garantia de que não há dado pessoal é a declaração da usuária (DEC-133). Por pergunta, o extrator devolve: enunciado; tipo (um dos 10 do ENT-007, ou desconhecido); rótulos das opções e, em cada uma, se pede um texto ao lado ("Outro", "Outros", "Especifique", "Qual?" ou uma linha para escrever, DEC-197); linhas de matriz; faixa, em escala e número; e `campo_padrao`, um dos 5 campos da RN-050, `endereco`, `aplicador` ou nenhum (DEC-144, DEC-149). A saída é validada contra esse formato (RN-037); saída fora do formato conta como falha da chamada, com as mesmas retentativas (FL-004). Primeiro, a pergunta com `campo_padrao` é tratada pelo passo 1 abaixo; as demais são ajustadas pela tabela; cada ajuste gera um aviso com a página e a posição no original, sem texto lido. Os avisos ficam em ordem de página e posição.

| Pergunta lida | Resultado | Aviso |
|---|---|---|
| Enunciado vazio | descartada | `descartada` |
| Tipo desconhecido | entra como `texto_curto` | `tipo_incerto` |
| `escolha_unica` ou `multipla_escolha` sem opção | entra como `texto_curto` | `tipo_incerto` |
| `matriz` sem linhas ou sem opções | entra como `texto_curto` | `tipo_incerto` |
| `escala` sem faixa | entra como `numero`, sem faixa | `tipo_incerto` |
| Enunciado com mais de 2000 caracteres, ou rótulo de opção ou linha com mais de 200 | cortado no limite | `texto_cortado` |
| Opção ou linha com rótulo vazio | a opção ou linha é descartada; se a pergunta ficar sem opção ou sem linha, segue as linhas acima | `tipo_incerto` |
| `sim_nao` | opções trocadas pelas fixas `sim` e `nao` (RN-047) | — |
| Opção que pede texto ao lado | a opção entra com `com_complemento = true`, com o rótulo sem a linha de escrever e sem os dois-pontos do fim (DEC-197); em pergunta que não é `escolha_unica` nem `multipla_escolha`, ou na opção `nenhuma_das_anteriores`, a marca é descartada (RN-047) | — |
| `multipla_escolha` sem opção de código `nenhuma_das_anteriores` | ganha a opção "Nenhuma das anteriores" no fim (RN-047), exceto na importação de papel antigo (DEC-195) | — |
| `campo_padrao` já usado por pergunta anterior | fica como pergunta comum (DEC-144) | `campo_repetido` |
| Mais alta que a área útil de uma página do PDF sem o termo de consentimento (página 2 em diante) | descartada (DEC-143) | `nao_cabe` |

Em seguida, o sistema:
1. aplica a RN-050: a primeira pergunta com cada `campo_padrao` vira esse campo, com o código, o tipo e a marcação da tabela da RN-050 (ou, para `endereco` e `aplicador`, os da DEC-149 e da DEC-152), mesmo com enunciado vazio, que então recebe o enunciado padrão; as opções, linhas e faixa lidas para ela são descartadas, sem aviso; os 5 campos que faltarem são injetados; os códigos usados nesse passo ficam reservados;
2. gera os códigos das demais perguntas, opções e linhas pela transformação T: só no enunciado, tira a numeração do início (dígitos seguidos de `.`, `)` ou `-`, como em "1." e "3)"); tira os acentos ("ç" vira "c"); troca cada sequência de caracteres que não são letra de A a Z (maiúscula ou minúscula) nem dígito por `_`; tira `_` do início e do fim; corta em 40 caracteres e tira de novo `_` do fim. Pergunta em maiúsculas (RN-018); opção e linha em minúsculas (RN-019). Resultado vazio vira `P<página>_<posição>` na pergunta e `opcao_<ordem>` ou `linha_<ordem>` na opção e na linha. Código de pergunta já usado na versão (inclusive os reservados no passo 1), ou de opção já usado nas opções da mesma pergunta, ou de linha já usado nas linhas da mesma pergunta, ganha o sufixo `_2`, `_3` e assim por diante, na ordem do original, cortando antes o necessário para caber em 40 caracteres;
3. atribui sensibilidade `saude` às perguntas que não são da RN-050 (DEC-138) e não cria regras de salto (DEC-139);
4. distribui as perguntas pelas páginas do PDF do sistema: os 5 campos no início da página 1, na ordem da tabela da RN-050, e depois as demais na ordem do original, enchendo cada página até a altura disponível (mesma medida da DEC-143). Na importação de papel antigo, este passo e o descarte `nao_cabe` não se aplicam: vale a DEC-181, e a versão grava `total_paginas` com o número de páginas do original, inclusive as que ficarem sem pergunta; os 5 campos que o original não tem entram no início da página 1, na ordem da tabela da RN-050, antes das perguntas do original (DEC-190).
O resultado é um formulário novo no projeto, com a versão 1 em `rascunho`, e a lista de avisos. Se nenhuma pergunta lida entrar na versão (as reconhecidas no passo 1 contam; as injetadas não), a importação falha (ERR-044) e nada é criado. Cada página lida conta no teto de custo de IA (RN-036). O arquivo enviado é apagado quando a importação termina, com sucesso ou falha.

RN-050 — Campos obrigatórios padronizados (DEC-134, DEC-135, DEC-145)
Todo rascunho tem exatamente uma pergunta para cada marcação da tabela abaixo. O rascunho novo sem cópia (`createForm`, `createVersion` sem versão de origem e importação) nasce com as 5 no início da página 1, na ordem da tabela, exceto na importação de papel antigo, em que as reconhecidas ficam na sua página do original (DEC-181) e as que faltam entram no início da página 1 (DEC-190); na importação, a pergunta reconhecida mantém o enunciado do original (DEC-144) e as que faltarem vêm com o enunciado padrão. Na criação por cópia, a pergunta sem marcação com um dos 5 códigos ganha sufixo (DEC-147), as perguntas da origem com essas marcações são padronizadas como abaixo, e as que faltarem são injetadas no início da página 1; quando a versão nova não é de papel antigo, a marca `nao_consta` é retirada das perguntas copiadas (DEC-179) e o `total_paginas` informado é apagado; quando é, ele é copiado (DEC-189). A cada gravação do rascunho (`updateVersion`), o sistema reaplica à pergunta de cada marcação o código, o tipo, `obrigatorio = true` e a sensibilidade da tabela, sem recusar (DEC-145); enunciado, ordem e página são da usuária. A reaplicação vem antes das demais validações da gravação, inclusive a das regras de salto (DEC-095). É recusado com ERR-001, com todas as violações juntas em `campos` (na ordem da tabela e depois na ordem das perguntas): o conteúdo sem a pergunta de uma das marcações (`campos`: os códigos da tabela que faltam); duas perguntas com a mesma marcação (`campos`: o código da tabela); e pergunta sem a marcação com um dos 5 códigos (`campos`: esse código). No rascunho criado antes da v2.4, a próxima gravação segue estas mesmas regras (reaplicação e recusa), sem injetar o que falta; até lá, a publicação continua protegida pela RN-017 (ERR-036, CA-036). Aqui `campos` traz os códigos da tabela; no ERR-036 da publicação, traz as marcações (`data_aplicacao`, CA-036).

| Código | Tipo | Enunciado padrão | Marcação | Sensibilidade |
|---|---|---|---|---|
| NOME | texto_curto | Nome completo | `campo_respondente = nome` | identificacao (RN-047) |
| DATA_NASCIMENTO | data | Data de nascimento | `campo_respondente = data_nascimento` | identificacao (RN-047) |
| CPF | cpf | CPF | `campo_respondente = cpf` | identificacao (RN-047) |
| DATA_APLICACAO | data | Data da aplicação | `campo_aplicacao = data_aplicacao` | outro |
| LOCAL_APLICACAO | texto_curto | Local da aplicação | `campo_aplicacao = local_aplicacao` | outro |

RN-051 — Exportação em formato longo (DEC-153 a DEC-163)
O escopo `linha_por_item` gera um arquivo XLSX ou CSV (DEC-159) com uma linha de cabeçalho e estas colunas, nesta ordem:

| Coluna | Conteúdo |
|---|---|
| ID_Aplicacao | identificador da aplicação (UUID, DEC-160) |
| Arquivo | nome do arquivo enviado da página de formulário (`tipo = formulario`, não a página 1 assinada anexada depois) da aplicação com o número da página da pergunta (`PaginaAplicacao.nome_arquivo`, DEC-198, DEC-201); vazio quando a página foi enviada antes da migração 0010 (IMP-009), já foi expurgada ou teve o nome apagado (DEC-206, DEC-210), e nas perguntas `nao_consta` do papel antigo (DEC-179), que não estão no papel |
| CPF | CPF do cadastro do respondente, completo, com 11 dígitos sem pontuação, como texto (DEC-155); vazio no respondente de papel antigo sem CPF (DEC-172) |
| Nome | nome do cadastro do respondente (DEC-162) |
| Data_Aplicacao | data da aplicação, `YYYY-MM-DD` |
| Codigo_Pergunta | código da pergunta (RN-018) |
| Codigo_Linha | código da linha da matriz (RN-019); vazio nas outras perguntas (DEC-154) |
| Codigo_Opcao_Valor | código da opção marcada; em escala, número, data, texto curto e texto livre, o valor no formato canônico (§5.4, DEC-156); vazio quando `Situacao` não é `respondida` |
| Rotulo_Opcao_Valor | rótulo da opção na versão da aplicação; vazio quando o valor não é opção ou não há valor |
| Complemento | na linha da opção com complemento marcada, o `valor_final` do item de complemento (DEC-197, DEC-201); vazio nas demais linhas e quando o complemento está em branco, ilegível, rasurado ou não se aplica (DEC-199) |
| Situacao | `respondida`, `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica` (DEC-158) |

Entram só as aplicações `concluida` com assinatura `presente` (CA-021, DEC-157) e as de papel antigo `concluida` com qualquer assinatura (DEC-172), dos projetos pedidos e com `data_aplicacao` no período, quando informado; sem período, todas. Os valores são os de `valor_final`. Em cada aplicação, cada pergunta da versão gera linhas assim:
1. `multipla_escolha`: uma linha por opção marcada, na ordem das opções na versão; `nenhuma_das_anteriores` é uma opção como as outras;
2. `matriz`: uma linha por linha da matriz, com a opção marcada nela;
3. demais tipos: uma linha;
4. item em branco, ilegível, rasurado ou "não se aplica": uma linha, com valor e rótulo vazios e a situação (RN-020); na matriz, uma por linha da matriz.
O item de complemento não gera linha própria: o texto vai na coluna `Complemento` da linha da sua opção (DEC-201).
As perguntas marcadas como nome, data de nascimento ou CPF do respondente (`campo_respondente`) e como data da aplicação (`campo_aplicacao = data_aplicacao`) não viram linhas (DEC-162). As linhas seguem a ordem de `Data_Aplicacao` e de `ID_Aplicacao` e, dentro da aplicação, a ordem das perguntas na versão (página e ordem) e das linhas da matriz. Sem aplicação que entre, o arquivo traz só o cabeçalho. As células de texto são neutralizadas contra fórmulas: com apóstrofo no CSV e como célula de texto no XLSX (DEC-166). Os filtros do dashboard não se aplicam (DEC-163). A exportação é auditada uma vez, com escopo, formato, projetos e número de aplicações, sem valores (RN-028); esse registro vale como o da exibição completa do CPF (DEC-072). O arquivo é apagado após `retencao_exportacao_dias` (RN-030, DEC-069), e a partir daí a consulta da exportação não traz mais o link.

RN-052 — Identificação da página, leitura da página inteira e papel antigo (DEC-169 a DEC-191, DEC-215 a DEC-218, DEC-221 a DEC-224)
0. Todo envio informa o projeto e o formulário (DEC-215), e o formulário fica gravado na aplicação e não muda depois (DEC-221): `identifyApplication` e `addApplicationPages` só aceitam versão desse formulário (ERR-039). Folha com QR legível de projeto ou formulário diferente do escolhido faz o pedido inteiro ser recusado com ERR-045, sem gravar nada: no envio, sem criar aplicação; no `addApplicationPages` e no `attachSignaturePage`, sem mudar a aplicação (DEC-222). Com várias folhas divergentes, o ERR-045 traz os códigos da primeira folha divergente, na ordem do envio, e o ERR-029 vem antes dele (DEC-224). Na aplicação antiga sem formulário (DEC-223), o `addApplicationPages` é recusado com ERR-018 até o `identifyApplication` definir o formulário (DEC-226).
1. Toda página de formulário (`tipo = formulario`) passa, antes da leitura, por uma chamada de identificação (RN-045) com a página inteira, que devolve o número da página da versão e a confiança (DEC-216). Depois, a leitura recebe a página inteira e o gabarito das perguntas da página identificada e devolve, por campo, o valor, a confiança e a região; as regiões gravadas em `regioes` saem da leitura, e não do `mapa_layout`. Neste documento, "localização" designa a chamada de identificação.
2. Com QR legível, a versão e a página são as do QR (DEC-218); a localização confere a página (DEC-171). A versão do QR legível de versão válida do formulário escolhido vale para a aplicação inteira, inclusive as folhas sem QR (DEC-180). Sem esse QR em nenhuma folha, a versão é a escolhida pela usuária no envio (DEC-169), e a página é a indicada pela localização. A versão de papel antigo nunca vale em aplicação com alguma folha de QR legível, válido ou não (DEC-184). Só é QR legível o que decodifica no formato do MinhaPesquisa; QR de outro formato conta como ausente e é auditado sem o conteúdo (DEC-187).
3. A aplicação vai para `identificacao_pendente` (ERR-004) quando a localização não reconhece alguma folha (DEC-178), salvo a eliminação do item 3c, quando a página dela diverge da do QR, ou quando as páginas resultantes ficam faltantes, repetidas ou além do total da versão (CA-013; o total é o `total_paginas` da versão, ENT-006). Pergunta que a leitura não encontra na página (sem valor e sem região) vai a `a_revisar` (DEC-177).
3a. Depois do `identifyApplication`, a página é a informada pela usuária e nenhuma folha passa de novo pela identificação: a identificação conta como concluída na hora, e todas as folhas mantidas são lidas com o gabarito da página informada (nenhuma foi lida antes, porque a pendência vem antes da leitura). Depois do `identifyApplication`, a página informada não é conferida com o QR nem pela confiança.
3b. As páginas já identificadas são preservadas quando a cota acaba ou a chamada falha; a retomada (cota liberada ou `retryReading`) localiza só as que faltam, e a conferência do item 3 é feita quando todas estiverem localizadas.
3c. A folha indicada como uma página da versão sem perguntas (página do original sem pergunta, DEC-181) não tem regiões e nada é lido nela; ela conta na conferência de páginas do item 3. Quando sobra exatamente uma folha não reconhecida e falta exatamente uma página, e essa página não tem perguntas, a folha passa a ser essa página (DEC-188).
3d. Data e local do envio são aplicados ou apagados quando a localização confirma a versão e as páginas, e não antes (DEC-186).
4. A versão de papel antigo (DEC-175) dispensa CPF, data de nascimento e assinatura na conclusão (DEC-172, DEC-176) e não exige evidência de consentimento (DEC-173). Pergunta marcada `nao_consta` não é localizada nem lida (DEC-179).
5. Revogado pela DEC-216 (CHG-019): não há mais teste de sobreposição de regiões; perguntas vizinhas, inclusive o CPF em caixas e a data da aplicação, são lidas na mesma página inteira e distinguidas pelo gabarito.

5. Modelo e dicionário de dados

5.1 Diagrama conceitual (13 entidades principais; 31 no total com as de apoio)

```
Tenant 1──* Usuario *──* Perfil (via UsuarioPerfil)
  │                       │
  │    └──* VinculoUsuarioProjeto ──1 Projeto 1── Aplicacao ──1 Respondente
  │                       │
  └──1── Projeto 1──* Formulario 1──* Versao 1──* Pergunta 1──* Opcao
                          │                    │
                     └──* RegraSalto          │
                                              │
Aplicacao 1──* ItemResposta                   │
  │                                           │
  └──* ReservaAplicacao (fonte única da reserva)│
                                              │
Grupo (filtro salvo, sem dados copiados)      │
                                              │
ParametroConfiguracao (tenant, plataforma, projeto)
                                              │
PedidoTitular, ListaEliminacoes, HistoricoStatusProjeto
ConcessaoAcessoIndividual, Auditoria, UsuarioPerfil, HistoricoAtributoRespondente,
LinhaMatriz, PaginaAplicacao, Exportacao, Sessao, TokenUsoUnico, ChaveIdempotencia, FalhaLogin,
ImportacaoFormulario
```

5.2 Dicionário de dados completo (11 propriedades em 100% dos campos)

Propriedades: entidade, campo técnico, significado, tipo, obrigatório, tamanho/precisão, formato/regex, valores permitidos, padrão, único, chave estrangeira, sensibilidade LGPD.

**ENT-001 Tenant**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do tenant | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| nome | nome do tenant | varchar | sim | 200 | — | — | — | não | — | pessoal |
| slug | identificador curto | varchar | sim | 50 | ^[a-z0-9-]+$ | — | — | sim | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| ativo | tenant ativo (false: login recusado com ERR-013 e jobs do tenant suspensos, sem apagar dados; DEC-070) | boolean | sim | — | — | true/false | true | não | — | não |

**ENT-002 Usuario**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do usuário | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do usuário | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| email | e-mail de login | varchar | sim | 255 | email RFC 5322 | — | — | sim (global, DEC-054) | — | pessoal |
| nome | nome do usuário | varchar | sim | 200 | — | — | — | não | — | pessoal |
| senha_hash | hash Argon2id | varchar | sim | 255 | Argon2id | — | — | não | — | sensível |
| mfa_secret | segredo TOTP | varchar | não | 64 | base32 | — | NULL | não | — | sensível |
| mfa_ativo | MFA habilitado | boolean | sim | — | — | true/false | false | não | — | não |
| ultimo_login | último login | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| situacao | situação do usuário | enum | sim | — | — | pendente_convite; ativo; inativo | pendente_convite | não | — | não |
| todos_projetos | vínculo dinâmico a todos os projetos do tenant (RN-004; DEC-068); true ignora VinculoUsuarioProjeto | boolean | sim | — | — | true/false | true | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-003 Perfil**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do perfil | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do perfil | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| codigo | código do perfil | varchar | sim | 50 | ^[a-z_]+$ | admin_tenant; digitalizador; analista; analista_individual | — | sim (por tenant) | — | não |
| nome | nome do perfil | varchar | sim | 100 | — | — | — | não | — | não |

**ENT-004 Projeto**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do projeto | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| codigo | código do projeto no QR e no rodapé do PDF, sequencial no tenant, atribuído na criação e imutável (DEC-217); mostrado com 5 dígitos (`00001`) | int | sim | — | — | 1 a 99999 | auto | sim (por tenant) | — | não |
| tenant_id | tenant do projeto | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| nome | nome do projeto | varchar | sim | 200 | — | — | — | não | — | não |
| descricao | descrição | text | não | 5000 | — | — | NULL | não | — | não |
| objetivo | objetivo metodológico do ciclo de coleta (DEC-137) | text | não | 5000 | — | — | NULL | não | — | não |
| coordenador | nome do coordenador técnico (DEC-137); não vai à IA nem a log | varchar | não | 200 | — | — | NULL | não | — | pessoal |
| coleta_inicio | início previsto da coleta (DEC-137) | date | não | — | YYYY-MM-DD | — | NULL | não | — | não |
| coleta_fim | fim previsto da coleta; não pode ser anterior a `coleta_inicio` (DEC-137) | date | não | — | YYYY-MM-DD | ≥ coleta_inicio | NULL | não | — | não |
| padrao_data_aplicacao | última data da aplicação digitada num envio de papel antigo do projeto, proposta no envio seguinte (DEC-179) | date | não | — | YYYY-MM-DD | não futura | NULL | não | — | pessoal |
| padrao_local_aplicacao | último local da aplicação digitado num envio de papel antigo do projeto, proposto no envio seguinte (DEC-179) | varchar | não | 200 | — | — | NULL | não | — | pessoal |
| status | status do projeto | enum | sim | — | — | ativo; arquivado | ativo | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-005 Formulario**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do formulário | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do formulário | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| projeto_id | projeto do formulário | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| codigo | código do formulário no QR e no rodapé do PDF, sequencial dentro do projeto, atribuído na criação e imutável (DEC-217); mostrado com 3 dígitos (`002`) | int | sim | — | — | 1 a 999 | auto | sim (por projeto) | — | não |
| nome | nome do formulário, impresso no cabeçalho do PDF (DEC-219) | varchar | sim | 200 | — | — | — | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-006 Versao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da versão | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da versão | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| formulario_id | formulário da versão | uuid | sim | 36 | UUID v4 | — | — | não | Formulario.id | não |
| numero | número da versão; no QR e no rodapé com 2 dígitos (`01`, DEC-218) | int | sim | — | — | 1 a 99 | auto | sim (por form) | — | não |
| status | status da versão | enum | sim | — | — | rascunho; publicada | rascunho | não | — | não |
| publicada_em | data de publicação | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| mapa_layout | coordenadas normalizadas de cada campo por página, gravadas na publicação (DEC-048); desde a DEC-170 servem só ao PDF imprimível; desde a DEC-216 não há recorte, e as regiões saem da leitura; NULL na versão de papel antigo (DEC-181) | jsonb | não | — | JSON | — | NULL | não | — | não |
| total_paginas | número de folhas da versão, usado na conferência de páginas (RN-052, CA-013), gravado na publicação: na versão oficial, a maior página das perguntas (as páginas do PDF); na de papel antigo, o informado no rascunho (`updateVersion`; a importação grava as páginas do original, DEC-181) ou, sem ele, a maior página das perguntas; informado fora do papel antigo ou menor que a maior página das perguntas → ERR-001; desmarcar `papel_antigo` apaga o informado; a cópia de versão o leva quando a versão nova é de papel antigo e o apaga quando não é (DEC-189) | int | não | — | — | 1..50 | NULL | não | — | não |
| papel_antigo | versão de pesquisa antiga, sem QR nem marcadores: dispensa CPF, data de nascimento e assinatura na conclusão (DEC-172, DEC-175, DEC-176); imutável depois da publicação (RN-042) | boolean | sim | — | — | true/false | false | não | — | não |
| criada_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-007 Pergunta**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da pergunta | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da pergunta | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| versao_id | versão da pergunta | uuid | sim | 36 | UUID v4 | — | — | não | Versao.id | não |
| codigo | código estável | varchar | sim | 100 | ^[A-Z0-9_]+$ | — | — | sim (por versão) | — | não |
| tipo | tipo de pergunta | enum | sim | — | — | escolha_unica; multipla_escolha; escala; matriz; numero; data; sim_nao; cpf; texto_curto; texto_livre | — | não | — | não |
| enunciado | texto da pergunta | text | sim | 2000 | — | — | — | não | — | não |
| ordem | ordem na página | int | sim | — | — | ≥ 1 | — | não | — | não |
| pagina | número da página | int | sim | — | — | ≥ 1 | — | não | — | não |
| obrigatorio | campo obrigatório | boolean | sim | — | — | true/false | false | não | — | não |
| campo_respondente | alimenta atributo do respondente | varchar | não | 50 | — | nome; data_nascimento; cpf; endereco | NULL | não | — | não |
| campo_aplicacao | marca a pergunta de data, local ou aplicador da aplicação (RN-016, RN-017) | varchar | não | 50 | — | data_aplicacao; local_aplicacao; aplicador | NULL | não | — | não |
| nao_consta | pergunta que o papel antigo não tem: não é localizada nem lida (DEC-179); só em versão de papel antigo, e só nas perguntas de CPF, data de nascimento, data e local | boolean | sim | — | — | true/false | false | não | — | não |
| sensibilidade | classificação da pergunta, no gabarito e na auditoria (RN-047); desde a DEC-216 não separa as chamadas à IA (RN-039 revogada); `identificacao` só nas perguntas da RN-047 (DEC-097) | enum | sim | — | — | identificacao; saude; outro | saude | não | — | não |
| valor_min | valor mínimo (escala/número) | decimal | não | 10,2 | — | — | NULL | não | — | não |
| valor_max | valor máximo (escala/número) | decimal | não | 10,2 | — | — | NULL | não | — | não |
| unidade | unidade (número) | varchar | não | 20 | — | — | NULL | não | — | não |

**ENT-008 Opcao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da opção | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da opção | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| pergunta_id | pergunta da opção | uuid | sim | 36 | UUID v4 | — | — | não | Pergunta.id | não |
| codigo | código estável | varchar | sim | 50 | ^[a-z0-9_]+$ | — | — | sim (por pergunta) | — | não |
| rotulo | texto impresso | varchar | sim | 200 | — | — | — | não | — | não |
| ordem | ordem | int | sim | — | — | ≥ 1 | — | não | — | não |
| com_complemento | a opção pede um texto ao lado ("Outro: ____"), lido num item de complemento (DEC-197, DEC-202); só em `escolha_unica` e `multipla_escolha`, nunca em `nenhuma_das_anteriores` (RN-047) | boolean | sim | — | — | true/false | false | não | — | não |

**ENT-009 Respondente**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do respondente | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do respondente | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| nome | nome completo | varchar | sim | 200 | — | — | — | não | — | pessoal |
| data_nascimento | data de nascimento | date | sim (NULL só se anonimizado ou de papel antigo sem data, DEC-176) | — | YYYY-MM-DD | não futura | — | não | — | pessoal |
| cpf_cifrado | CPF cifrado | bytea | sim (NULL só se anonimizado ou de papel antigo sem CPF, DEC-172) | variável | AES-256-GCM (IV + cifrado + tag + id da chave) | — | — | não | — | sensível |
| cpf_hash | HMAC do CPF (busca) | bytea | sim (NULL só se anonimizado ou de papel antigo sem CPF, DEC-172) | 32 | HMAC-SHA256 com chave do tenant | — | — | sim (por tenant, quando não nulo) | — | sensível |
| endereco | endereço | varchar | não | 500 | — | — | NULL | não | — | pessoal |
| anonimizado | respondente anonimizado | boolean | sim | — | — | true/false | false | não | — | não |
| origem_papel_antigo | respondente criado pela conclusão de aplicação de papel antigo: pode ficar sem CPF ou sem data de nascimento (DEC-176) | boolean | sim | — | — | true/false | false | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-010 Aplicacao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da aplicação | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da aplicação | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| projeto_id | projeto da aplicação | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| versao_id | versão do formulário: a do QR legível ou, sem QR legível, a escolhida no envio ou no `identifyApplication` (DEC-169, DEC-180); pode ficar NULL só em identificacao_pendente ou em descartada vinda de um estado sem versão (DEC-231) | uuid | não | 36 | UUID v4 | — | NULL | não | Versao.id | não |
| formulario_id | formulário escolhido no envio, fixo na aplicação (DEC-215, DEC-221); a `versao_id`, quando existe, é dele; nulo só em aplicação anterior à v2.9 sem versão, em `identificacao_pendente` ou `descartada` (DEC-223, DEC-231, DEC-234) | uuid | sim, exceto DEC-223 | 36 | UUID v4 | — | — | não | Formulario.id | não |
| origem_qr | a versão veio do QR (true) ou da escolha da usuária no envio ou no `identifyApplication` (false) (DEC-169); continua true quando a versão informada é a do QR (DEC-180) | boolean | sim | — | — | true/false | true | não | — | não |
| respondente_id | respondente (só na conclusão) | uuid | não | 36 | UUID v4 | — | NULL | não | Respondente.id | pessoal (indireto) |
| data_aplicacao | data da aplicação (obrigatória em sem_assinatura e concluida); no papel antigo, pode vir do envio, guardada até a localização confirmar a versão e as páginas (DEC-182, DEC-185, DEC-186) | date | não | — | YYYY-MM-DD | não futura | NULL | não | — | pessoal |
| local_aplicacao | local da aplicação (obrigatório em sem_assinatura e concluida); no papel antigo, pode vir do envio, guardado até a localização confirmar a versão e as páginas (DEC-182, DEC-185, DEC-186) | varchar | não | 200 | — | — | NULL | não | — | pessoal |
| aplicador | nome do aplicador | varchar | não | 200 | — | — | NULL | não | — | pessoal |
| estado | estado da aplicação | enum | sim | — | — | identificacao_pendente; aguardando_cota; em_leitura; erro_leitura; em_revisao; aguardando_cpf; sem_assinatura; concluida; descartada | identificacao_pendente | não | — | não |
| assinatura | status da assinatura | enum | não | — | — | presente; ausente; nao_conferida | nao_conferida | não | — | não |
| criada_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| concluida_em | data de conclusão | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| cpf_hash | HMAC do CPF lido, gravado quando o item de CPF fica resolvido (localiza aplicações em andamento na eliminação) | bytea | não | 32 | HMAC-SHA256 com chave do tenant | — | NULL | não | — | sensível |
| manter_cadastro | escolha do digitalizador por atributo divergente (CA-014), gravada na conclusão e aplicada no vínculo | jsonb | não | — | JSON | nome; data_nascimento; endereco → existente; aplicacao | NULL | não | — | não |
| motivo_descarte | motivo informado no descarte (CA-033) | text | não | 2000 | — | — | NULL | não | — | pessoal (indireto) |
| motivo_reabertura | motivo da última reabertura (CA-042) | text | não | 2000 | — | — | NULL | não | — | pessoal (indireto) |

**ENT-011 ItemResposta**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do item | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do item | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| aplicacao_id | aplicação do item | uuid | sim | 36 | UUID v4 | — | — | não | Aplicacao.id | não |
| pergunta_id | pergunta do item | uuid | sim | 36 | UUID v4 | — | — | não | Pergunta.id | não |
| linha_id | linha da matriz (só perguntas do tipo matriz) | uuid | não | 36 | UUID v4 | — | NULL | não | LinhaMatriz.id | não |
| opcao_id | opção com complemento do item de complemento (RN-009, DEC-197); NULL nos demais itens | uuid | não | 36 | UUID v4 | — | NULL | não | Opcao.id | não |
| valor_ia | valor lido pela IA, no formato canônico (§5.4); cifrado (DEC-041) quando a pergunta tem `campo_respondente` | text | não | 2000 | — | — | NULL | não | — | sensível |
| confianca | confiança da IA (valor bruto, sem arredondamento) | decimal | não | 5,4 | — | 0.0000..1.0000 | NULL | não | — | não |
| valor_final | valor confirmado/corrigido, no formato canônico (§5.4); cifrado (DEC-041) quando a pergunta tem `campo_respondente` | text | não | 2000 | — | — | NULL | não | — | sensível |
| estado | estado do item | enum | sim | — | — | pendente_leitura; aguardando_condicao; confirmado_automaticamente; a_revisar; confirmado; corrigido; em_branco; ilegivel; rasurado; nao_se_aplica | pendente_leitura | não | — | não |
| revisor_id | usuário que aplicou a última ação de revisão ao item; NULL quando a última mudança de estado foi do worker ou da reavaliação de salto (FL-002, DEC-209) | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |
| revisado_em | data da revisão | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| regiao_imagem | região da imagem (bounding box) | jsonb | não | — | JSON | — | NULL | não | — | não |
| revisao_reaberta | item de complemento que foi a `a_revisar` pela reabertura e ainda não foi revisado (FL-002); sempre false nos demais itens | boolean | sim | — | — | true; false | false | não | — | não |

**ENT-012 Grupo**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do grupo | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do grupo | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| projeto_id | projeto do grupo | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| usuario_id | dono do grupo | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| nome | nome do grupo | varchar | sim | 200 | — | — | — | não | — | não |
| filtros | filtros (JSON) | jsonb | sim | — | JSON | — | — | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-013 Auditoria**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do evento | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do evento | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | usuário que executou | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |
| acao | ação executada | varchar | sim | 100 | — | — | — | não | — | não |
| entidade | entidade afetada | varchar | sim | 100 | — | — | — | não | — | não |
| registro_id | ID do registro afetado | uuid | não | 36 | UUID v4 | — | NULL | não | — | não |
| campo | campo afetado | varchar | não | 100 | — | — | NULL | não | — | não |
| ip | IP de origem | inet | não | — | IPv4/IPv6 | — | NULL | não | — | pessoal |
| canal | canal (web; api; script) | enum | não | — | — | web; api; script | NULL | não | — | não |
| detalhes | referências adicionais em lista fechada por ação (ex.: filtro_aplicado com códigos de pergunta e opção; `form_selection_mismatch` com `projeto_qr` e `formulario_qr`, DEC-215); nunca valores pessoais nem texto livre | jsonb | não | — | JSON | — | NULL | não | — | não |
| criado_em | data do evento | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

5.3 Entidades de apoio (dicionário completo)

Todas as entidades de apoio possuem as 11 propriedades obrigatórias, conforme exigido pelo nível de rigor Completo.

**ENT-014 VinculoUsuarioProjeto**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do vínculo | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do vínculo | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | usuário vinculado | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| projeto_id | projeto vinculado | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| criado_por | usuário que criou | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |

Constraint única: `(tenant_id, usuario_id, projeto_id)` — impede vínculo duplicado.

**ENT-015 ConcessaoAcessoIndividual**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da concessão | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da concessão | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | usuário que recebeu acesso | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| projeto_id | projeto concedido | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| justificativa | motivo da concessão | text | sim | 1000 | — | — | — | não | — | pessoal (indireto) |
| concedido_em | data de concessão | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| valido_ate | data de expiração | timestamp | sim | — | ISO 8601 UTC | — | concedido_em + 90 dias | não | — | não |
| revogado_em | data de revogação | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| revogado_por | usuário que revogou | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |
| ativo | concessão ativa | boolean | sim | — | — | true/false | true | não | — | não |

Constraint única: `(tenant_id, usuario_id, projeto_id)` onde `ativo = true` — impede concessões simultâneas.

Vigência: a concessão só autoriza acesso enquanto `ativo = true` **e** `valido_ate` > agora. Um job marca `ativo = false` ao expirar, mas a autorização nunca depende apenas do job.

**ENT-016 RegraSalto**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da regra | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da regra | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| versao_id | versão da regra | uuid | sim | 36 | UUID v4 | — | — | não | Versao.id | não |
| pergunta_origem_id | pergunta que dispara a regra | uuid | sim | 36 | UUID v4 | — | — | não | Pergunta.id | não |
| pergunta_destino_id | pergunta que é mostrada/ocultada | uuid | sim | 36 | UUID v4 | — | — | não | Pergunta.id | não |
| opcao_codigo | código da opção que dispara | varchar | sim | 50 | ^[a-z0-9_]+$ | — | — | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

Constraint única: `(versao_id, pergunta_destino_id)` — uma pergunta destino só pode ter uma regra de salto.

**ENT-017 ReservaAplicacao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da reserva | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da reserva | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| aplicacao_id | aplicação reservada | uuid | sim | 36 | UUID v4 | — | — | não | Aplicacao.id | não |
| usuario_id | usuário que reservou | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| reservado_em | data da reserva | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| ultima_atividade_em | última ação de revisão do titular da reserva | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| expira_em | data de expiração (deslizante) | timestamp | sim | — | ISO 8601 UTC | — | ultima_atividade_em + 30 min | não | — | não |
| ativa | reserva ativa | boolean | sim | — | — | true/false | true | não | — | não |

Constraint única: `(aplicacao_id)` onde `ativa = true` — impede reservas simultâneas.

**ENT-018 PedidoTitular**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do pedido | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do pedido | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| respondente_id | respondente titular | uuid | sim | 36 | UUID v4 | — | — | não | Respondente.id | pessoal (indireto) |
| tipo | tipo de direito | enum | sim | — | — | acesso; correcao; eliminacao; portabilidade | — | não | — | não |
| descricao | descrição do pedido | text | não | 2000 | — | — | NULL | não | — | pessoal (indireto) |
| solicitado_em | data da solicitação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| executado_em | data da execução | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| executado_por | usuário que executou | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |
| status | status do pedido | enum | sim | — | — | pendente; em_andamento; concluido; falhou; cancelado | pendente | não | — | não |
| resultado | resultado da execução | text | não | 5000 | — | — | NULL | não | — | não |
| aplicacoes_mesmo_nome | eliminação de respondente sem CPF: aplicações de papel antigo em andamento com o mesmo nome normalizado, gravadas na execução (DEC-191, DEC-193) | jsonb | não | — | lista de UUID | — | NULL | não | — | pessoal (indireto) |

**ENT-019 ListaEliminacoes**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do registro | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da eliminação | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| motivo | origem do registro | enum | sim | — | — | eliminacao; anonimizacao_reabertura; descarte_aplicacao | eliminacao | não | — | não |
| respondente_id_original | ID interno do respondente eliminado ou anonimizado | uuid | não | 36 | UUID v4 | — | NULL | não | — | não |
| aplicacao_id | aplicação descartada cujos valores lidos foram apagados (DEC-077) | uuid | não | 36 | UUID v4 | — | NULL | não | — | não |
| eliminado_em | data da eliminação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| valido_ate | data de expiração do registro | timestamp | sim | — | ISO 8601 UTC | — | eliminado_em + 180 dias | não | — | não |

Constraint única: `(tenant_id, respondente_id_original)` e `(tenant_id, aplicacao_id)` — impede registros duplicados. Check: `motivo = descarte_aplicacao` exige `aplicacao_id` e `respondente_id_original` nulo; os demais motivos exigem `respondente_id_original` e `aplicacao_id` nulo.

Todos os motivos são reaplicados após restauração de backup (CA-023, exemplo 4). Só `eliminacao` tem os demais efeitos do direito de eliminação (RN-031); `anonimizacao_reabertura` (DEC-078) e `descarte_aplicacao` (DEC-077) servem apenas para que o dado apagado não volte com o backup. Cada aplicação descartada pela execução de uma eliminação (as em andamento do titular e as de papel antigo de mesmo nome, DEC-191) também gera um registro `descarte_aplicacao`, e a reaplicação desse motivo grava `nome_arquivo` NULL nas páginas da aplicação (DEC-210).

Nota: Esta entidade não tem FK para `Respondente` porque o respondente foi anonimizado. O `respondente_id_original` guarda apenas o UUID interno para reaplicar a eliminação em caso de restauração de backup.

**ENT-020 ParametroConfiguracao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do parâmetro | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do parâmetro (NULL = plataforma) | uuid | não | 36 | UUID v4 | — | NULL | não | Tenant.id | não |
| projeto_id | projeto do parâmetro (NULL = tenant/plataforma) | uuid | não | 36 | UUID v4 | — | NULL | não | Projeto.id | não |
| chave | nome do parâmetro | varchar | sim | 100 | ^[a-z_]+$ | retencao_dias; custo_ia_teto; limite_confianca; cotacao_usd_brl; retencao_exportacao_dias; termo_consentimento | — | não | — | não |
| competencia | mês civil a que o valor se refere (obrigatório para cotacao_usd_brl, NULL nas demais) | date | não | — | YYYY-MM-01 | — | NULL | não | — | não |
| valor | valor do parâmetro | text | sim | 1000 | — | — | — | não | — | sensível (depende da chave) |
| alterado_em | data da alteração | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| alterado_por | usuário que alterou | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |

Constraint única: `(tenant_id, projeto_id, chave, competencia)` com `NULLS NOT DISTINCT` — impede parâmetros duplicados também nos níveis plataforma e tenant (colunas nulas).

Nota: A sensibilidade LGPD depende da chave. Exemplo: `custo_ia_teto` é não sensível; `retencao_dias` pode ser sensível se revelar estratégia de retenção.

**ENT-021 HistoricoStatusProjeto**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do registro | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do projeto | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| projeto_id | projeto do histórico | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| status_anterior | status antes da mudança | enum | não | — | — | ativo; arquivado | NULL | não | — | não |
| status_novo | status após a mudança | enum | sim | — | — | ativo; arquivado | — | não | — | não |
| alterado_em | data da mudança | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| alterado_por | usuário que alterou | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |

**ENT-022 UsuarioPerfil**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da atribuição | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da atribuição | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | usuário | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| perfil_id | perfil atribuído | uuid | sim | 36 | UUID v4 | — | — | não | Perfil.id | não |
| criado_em | data da atribuição | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| criado_por | usuário que atribuiu | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |

Constraint única: `(tenant_id, usuario_id, perfil_id)` — impede atribuição duplicada (RN-003).

**ENT-023 HistoricoAtributoRespondente**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do registro | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| respondente_id | respondente alterado | uuid | sim | 36 | UUID v4 | — | — | não | Respondente.id | pessoal (indireto) |
| aplicacao_id | aplicação que alterou o atributo | uuid | sim | 36 | UUID v4 | — | — | não | Aplicacao.id | não |
| atributo | atributo alterado | enum | sim | — | — | nome; data_nascimento; endereco | — | não | — | não |
| valor_anterior_cifrado | valor antes da alteração (NULL se não havia) | bytea | não | variável | AES-256-GCM | — | NULL | não | — | sensível |
| valor_gravado_hash | HMAC do valor gravado pela aplicação (reversão só se o atual ainda for este) | bytea | sim | 32 | HMAC-SHA256 com chave do tenant | — | — | não | — | sensível |
| criado_em | data da alteração | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

Apagado integralmente na eliminação do titular (CA-023).

**ENT-024 LinhaMatriz**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da linha | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| pergunta_id | pergunta do tipo matriz | uuid | sim | 36 | UUID v4 | — | — | não | Pergunta.id | não |
| codigo | código estável da linha | varchar | sim | 50 | ^[a-z0-9_]+$ | — | — | sim (por pergunta) | — | não |
| rotulo | texto impresso | varchar | sim | 200 | — | — | — | não | — | não |
| ordem | ordem | int | sim | — | — | ≥ 1 | — | não | — | não |

**ENT-025 PaginaAplicacao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da imagem/página | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| aplicacao_id | aplicação | uuid | sim | 36 | UUID v4 | — | — | não | Aplicacao.id | não |
| tipo | finalidade da imagem: `assinatura` é a página 1 assinada anexada em `sem_assinatura` (CA-044); a página 1 original é mantida | enum | sim | — | — | formulario; assinatura | formulario | não | — | não |
| numero_pagina | página da versão: a do QR ou, sem QR, a indicada pela localização ou pela usuária (DEC-171); NULL até identificar | int | não | — | — | ≥ 1 | NULL | não | — | não |
| chave_storage | chave do objeto no bucket privado | varchar | sim | 500 | — | — | — | sim | — | não |
| sha256 | hash do arquivo sem metadados | bytea | sim | 32 | SHA-256 | — | — | não | — | não |
| ordem_envio | posição da folha na aplicação, na ordem do envio, a partir de 1; as folhas do `addApplicationPages` e do `attachSignaturePage` continuam a sequência, e as descartadas no `identifyApplication` não liberam o número (DEC-198) | int | sim | — | — | ≥ 1 | — | sim (por aplicação) | — | não |
| nome_arquivo | nome original do arquivo enviado de onde veio a página, sem a pasta, cortado em 255 caracteres (DEC-198); apagado (NULL) no expurgo da imagem e no ato da eliminação do titular, inclusive nas aplicações descartadas por ela (DEC-206, DEC-210); NULL nas páginas enviadas antes da migração 0010 (IMP-009) | varchar | não | 255 | — | — | NULL | não | — | pessoal |
| registro_ok | marcadores dos cantos encontrados (DEC-048); desde a DEC-169 só informativo, não impede a leitura | boolean | sim | — | — | true/false | false | não | — | não |
| regioes | regiões dos campos da página (e, na página 1, a da assinatura) devolvidas pela leitura da página inteira (DEC-216), em coordenadas normalizadas da imagem, com a confiança (RN-052) | jsonb | não | — | JSON | — | NULL | não | — | não |
| criado_em | data do upload | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| expurgada_em | data do expurgo físico | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |

**ENT-026 Exportacao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da exportação | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | quem pediu | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| projeto_ids | projetos incluídos | uuid[] | sim | — | UUID v4 | — | — | não | — | não |
| formato | formato | enum | sim | — | — | csv; xlsx | — | não | — | não |
| escopo | escopo (`linha_por_item`: formato longo, RN-051) | enum | sim | — | — | agregado; linha_a_linha; linha_por_item | — | não | — | não |
| status | situação | enum | sim | — | — | enfileirada; em_andamento; concluida; falhou; cancelada | enfileirada | não | — | não |
| chave_storage | objeto gerado (NULL até concluir ou após expurgo) | varchar | não | 500 | — | — | NULL | não | — | não |
| criado_em | data do pedido | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| expira_em | data de expurgo do arquivo | timestamp | não | — | ISO 8601 UTC | — | concluida + retencao_exportacao_dias | não | — | não |

Linha a linha e linha por item contêm dados pessoais em repouso: canceladas e apagadas na eliminação do titular (CA-023).

**ENT-027 Sessao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da sessão | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do usuário | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | usuário | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| tipo | tipo | enum | sim | — | — | pre_sessao; plena | pre_sessao | não | — | não |
| segredo_hash | hash do segredo do cookie | bytea | sim | 32 | SHA-256 | — | — | sim | — | sensível |
| criada_em | criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| ultima_atividade_em | última atividade | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| expira_absoluta_em | expiração absoluta (24 h; pré-sessão 5 min) | timestamp | sim | — | ISO 8601 UTC | — | — | não | — | não |
| revogada_em | encerramento | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| ip | IP de criação | inet | não | — | IPv4/IPv6 | — | NULL | não | — | pessoal |

**ENT-028 TokenUsoUnico**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do token | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do usuário | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | usuário | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| tipo | finalidade | enum | sim | — | — | convite; recuperacao_senha; reset_mfa | — | não | — | não |
| token_hash | hash do token enviado por e-mail | bytea | sim | 32 | SHA-256 | — | — | sim | — | sensível |
| expira_em | expiração (convite 24 h; recuperação 60 min) | timestamp | sim | — | ISO 8601 UTC | — | — | não | — | não |
| usado_em | uso (uso único) | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |

**ENT-029 ChaveIdempotencia**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| usuario_id | usuário | uuid | sim | 36 | UUID v4 | — | — | não | Usuario.id | não |
| chave | valor do header Idempotency-Key | varchar | sim | 64 | — | — | — | sim (por usuário e operação) | — | não |
| operacao | operationId | varchar | sim | 100 | — | — | — | não | — | não |
| hash_requisicao | HMAC do corpo (detecta reuso com outro conteúdo, ERR-019) | bytea | sim | 32 | HMAC-SHA256 | — | — | não | — | não |
| resposta | status HTTP e ID do recurso criado ou alterado; nunca o corpo (o replay devolve o estado atual do recurso, já sujeito a eliminação e autorização) | jsonb | sim | — | JSON | — | — | não | — | não |
| expira_em | expiração | timestamp | sim | — | ISO 8601 UTC | — | criado_em + 24 h | não | — | não |

**ENT-030 FalhaLogin**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| email_hmac | HMAC do e-mail normalizado (exista ou não a conta) | bytea | sim | 32 | HMAC-SHA256 | — | — | sim | — | pessoal (indireto) |
| tentativas | falhas na janela | int | sim | — | — | 0..100 | 0 | não | — | não |
| janela_inicio | início da janela de 15 min | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| bloqueado_ate | fim do bloqueio | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |

Sem `tenant_id`: o login acontece antes de conhecer o tenant (DEC-054). ENT-030 só é acessada pela função de login. ENT-027 e ENT-028 são localizadas pelo hash do cookie ou do token por funções SECURITY DEFINER mínimas (login, tokens e resolução de sessão); depois de definido o tenant, leituras e escritas seguem pela RLS normal (PLANO §4.7, DEC-046).

**ENT-031 ImportacaoFormulario**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da importação | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| projeto_id | projeto que recebe o formulário | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| nome_formulario | nome do formulário a criar | varchar | sim | 200 | — | — | — | não | — | não |
| estado | situação da importação (FL-004) | enum | sim | — | — | enfileirada; aguardando_cota; em_andamento; concluida; falhou | enfileirada | não | — | não |
| total_paginas | páginas do envio | int | sim | — | — | 1..50 | — | não | — | não |
| chave_storage | pasta dos arquivos enviados (NULL depois de apagados, RN-049) | varchar | não | 500 | — | — | NULL | não | — | não |
| formulario_id | formulário criado (só em concluida) | uuid | não | 36 | UUID v4 | — | NULL | não | Formulario.id | não |
| avisos | ajustes da RN-049 por página e posição no original, sem texto lido | jsonb | não | — | JSON | — | NULL | não | — | não |
| criada_em | data do pedido | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| concluida_em | data em que terminou (concluida ou falhou) | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |

O arquivo enviado é um modelo sem dado pessoal (DEC-133) e é apagado ao fim da importação; a eliminação do titular não alcança esta entidade.

5.4 Formato canônico de valores (valor_ia e valor_final)

| Tipo de pergunta | Formato | Exemplo |
|---|---|---|
| escolha_unica, sim_nao | código da opção | `viuvo`, `sim` |
| multipla_escolha | códigos das opções em ordem alfabética, separados por `;` | `diabetes;hipertensao` |
| matriz | código da opção (um item por linha) | `satisfeito` |
| escala, numero | decimal com ponto, sem separador de milhar | `3`, `72.5` |
| data | ISO 8601 `YYYY-MM-DD` | `1951-01-01` |
| cpf | 11 dígitos, sem máscara | `12345678909` |
| texto_curto, texto_livre | texto UTF-8 normalizado (NFC), sem espaços nas pontas | `Rua A, 10` |
| item de complemento (RN-009) | texto UTF-8 normalizado (NFC), sem espaços nas pontas, com até 200 caracteres | `Maternidade` |

Filtros e comparações entre versões (RN-018) usam este formato.

6. Requisitos funcionais, não funcionais, telas, fluxos e estados

6.1 Requisitos funcionais (RF)

**RF-001 — Instalação e conta local da usuária**
Quem executa: A usuária, por script no notebook (DEC-107, DEC-108).
Quando pode: Na instalação (uma vez) e quando esquecer a senha.
Quando não pode: Instalação quando o tenant já existe; redefinição sem acesso ao notebook.
Entradas: nome da instituição, nome, e-mail e senha da usuária; na redefinição, a nova senha.
Sucesso: tenant e conta criados; ou senha redefinida, com as sessões encerradas.
Erro e timeout: mensagens do script, sem dado pessoal no terminal (RN-028).
Registros alterados: Tenant, Usuario, Auditoria.
Mensagens: "Instalação concluída" ou "Senha redefinida".
Estado final: conta ativa.

**RF-002 — Autenticação e sessões**
Quem executa: A usuária.
Quando pode: Com credenciais válidas.
Quando não pode: Após 5 falhas em 15 min (bloqueio de 15 min), ou sessão expirada (30 min inatividade ou 24 h).
Entradas: e-mail e senha.
Sucesso: sessão criada, no máximo 3 sessões ativas; sem MFA (DEC-108).
Erro e timeout: ERR-013 (credenciais inválidas), ERR-014 (bloqueio por tentativas, aplicado por e-mail exista ou não a conta), ERR-015 (sessão expirada), ERR-021 (limite de 3 sessões ativas).
Registros alterados: Usuario (ultimo_login), Sessao, FalhaLogin, Auditoria.
Mensagens: exatamente as do catálogo para ERR-013 a ERR-015 e ERR-021 (genéricas, sem revelar se a conta existe).
Estado final: autenticado ou bloqueado.

**RF-003 — Cadastro de projetos**
Quem executa: A usuária.
Quando pode: Sempre que tiver sessão.
Quando não pode: Quando tenta criar projeto em outro tenant.
Entradas: nome e descrição; opcionalmente objetivo, coordenador e início e fim da coleta (DEC-137) (criação e alteração).
Sucesso: projeto criado com status `ativo` e com o próximo `codigo` sequencial (DEC-217); o 100.000º projeto é recusado com ERR-001.
Erro e timeout: ERR-001 (validação), ERR-002 (recurso não encontrado), ERR-016 (sem permissão).
Registros alterados: Projeto, HistoricoStatusProjeto, Auditoria.
Mensagens: "Projeto criado".
Estado final: projeto ativo ou arquivado, reversível.

**RF-004 — Cadastro de formulários, versões, perguntas, opções e regras de salto, e geração do PDF**
Quem executa: A usuária.
Quando pode: Quando o formulário está em rascunho.
Quando não pode: Quando a versão está publicada (imutável); quando faltam campos obrigatórios (nome, nascimento, CPF, data e local da aplicação); criar formulário em projeto arquivado (ERR-001, DEC-146); pergunta que não cabe na página (DEC-143), exceto na versão de papel antigo (DEC-181).
Entradas: dados do formulário, perguntas, opções (com a marca `com_complemento`, DEC-202), regras de salto. O rascunho novo sem cópia já traz os 5 campos da RN-050 (DEC-135).
Sucesso: formulário criado com o próximo `codigo` sequencial do projeto (DEC-217; o 1.000º formulário do projeto e a 100ª versão do formulário são recusados com ERR-001); versão publicada; PDF gerado com, em toda página, cabeçalho com o nome do projeto e o do formulário, rodapé com "Projeto: PPPPP · Formulário: FFF · Versão: VV · Página X/Y" e o QR `PPPPP.FFF.VV.X/Y` no canto do rodapé (DEC-218, DEC-219), espaçamento entre os blocos (termo, identificação e CPF, data da aplicação e seções de perguntas) e, depois do rótulo de cada opção com complemento, uma linha para escrever (DEC-202).
Erro e timeout: ERR-001 (validação), ERR-036 (campos obrigatórios ausentes), ERR-009 (versão publicada é imutável), timeout de 30 s na geração do PDF.
Registros alterados: Formulario, Versao, Pergunta, Opcao, RegraSalto, Auditoria.
Mensagens: "Versão publicada" ou a mensagem do ERR-036.
Estado final: versão publicada ou em rascunho.

**RF-005 — Cadastro de respondentes a partir do papel, com unicidade por CPF**
Quem executa: Sistema (automático na conclusão da aplicação).
Quando pode: Quando a aplicação é concluída com CPF válido; na versão de papel antigo, também sem CPF válido, com o vínculo pelo nome (DEC-172, DEC-176).
Quando não pode: Quando o CPF é inválido, ilegível ou ausente, exceto na versão de papel antigo (DEC-172).
Entradas: CPF, nome, data de nascimento, endereço (lidos do papel); no papel antigo sem CPF válido, o respondente de mesmo nome escolhido pela usuária, ou um novo (DEC-176).
Sucesso: respondente criado ou vinculado ao existente; no papel antigo, pode ficar sem CPF e sem data de nascimento (DEC-176).
Erro e timeout: ERR-006 (CPF ausente ou inválido na conclusão, fora do papel antigo), ERR-001 (respondente fora dos candidatos de mesmo nome, ou `respondente_id` fora do papel antigo sem CPF, DEC-176).
Registros alterados: Respondente, Aplicacao (respondente_id), Auditoria.
Mensagens: "Respondente vinculado" ou "Aguardando CPF válido".
Estado final: respondente existente ou novo.

**RF-006 — Upload de imagens (scanner em lote e foto de celular)**
Quem executa: A usuária.
Quando pode: Quando o projeto está ativo (CA-027).
Quando não pode: Sem projeto e formulário escolhidos (ERR-001, DEC-215); folha com QR legível de projeto ou formulário diferente do escolhido (ERR-045, nada é criado); quando o arquivo não é JPEG/PNG/PDF, passa de 20 MB (ou 50 páginas) ou falha na varredura de malware. Sem QR legível e sem versão escolhida, a aplicação é criada em `identificacao_pendente` (FL-001).
Entradas: arquivo(s) de imagem, de scanner ou foto, com ou sem QR; projeto e formulário escolhidos, obrigatórios (`formulario_id`, DEC-215); versão publicada do formulário escolhido (`versao_id`), opcional; sem QR legível, é ela que define a versão (DEC-169); no papel antigo, data e local da aplicação, propostos com o padrão do projeto (DEC-179).
Sucesso: aplicação criada com as páginas, versão do QR ou da escolha, localização e leitura disparadas (RN-052); cada página guarda o nome do arquivo de onde veio (DEC-198), e o resultado do envio lista as páginas na ordem do envio, com o número de cada uma (`ordem_envio`, a partir de 1) e o nome do arquivo. O nome do arquivo é dado pessoal: não vai a log, à auditoria nem à mensagem de erro; o ERR-029 identifica o arquivo recusado pela posição no envio (`posicao`, RN-028).
Erro e timeout: ERR-001 (validação, formulário ausente ou de outro projeto, ou projeto arquivado, CA-027), ERR-045 (QR de outro projeto ou formulário, DEC-215), ERR-029 (arquivo recusado), ERR-004 (sem QR legível e sem versão escolhida, ou páginas inconsistentes), ERR-039 (QR ou versão escolhida de outro contexto), ERR-003 (aviso de cota); timeout de 30 s no storage.
Registros alterados: Aplicacao (com `origem_qr`), PaginaAplicacao, ItemResposta (pendente_leitura), Projeto (padrão de data e local, no próprio envio, DEC-179, DEC-192), Auditoria.
Mensagens: "Upload concluído" ou a mensagem do ERR-029 com o motivo.
Estado final: aplicação em `em_leitura`, `aguardando_cota` ou `identificacao_pendente` (FL-001, tabela de criação).

**RF-007 — Leitura automática por IA, com confiança por campo**
Quem executa: Worker assíncrono (pg-boss).
Quando pode: Quando a aplicação tem versão e o tenant tem cota (reserva atômica de orçamento antes de cada chamada, inclusive a de identificação).
Quando não pode: Quando o teto de custo de IA foi atingido (aplicações ficam em `aguardando_cota`).
Entradas: primeiro, cada página inteira com as perguntas da versão, na chamada de identificação (RN-052, DEC-170), que devolve a página e a confiança; depois, a mesma página inteira com o gabarito das perguntas dela, numa chamada de leitura por página, sem metadados (DEC-216).
Sucesso: itens com valor_ia, confianca e estado (confirmado_automaticamente ou a_revisar); regiões de cada campo gravadas em `regioes`; na pergunta com opção com complemento, a mesma leitura da página devolve também o texto escrito ao lado de cada uma dessas opções, com a sua confiança, gravado no item de complemento (RN-009, DEC-197), que segue a regra 1b da FL-002.
Erro e timeout: timeout de 30 s por chamada, retentativas em 1 e 2 s (3 chamadas no total, DEC-129); após 3 falhas, aplicação vai para `erro_leitura` (ERR-041); teto atingido → `aguardando_cota` (ERR-003); página não reconhecida ou páginas inconsistentes na identificação → `identificacao_pendente` (ERR-004).
Registros alterados: PaginaAplicacao (`numero_pagina`, `regioes`), ItemResposta, Aplicacao (estado; data e local do envio aplicados ou apagados, DEC-186), Auditoria.
Mensagens: "Leitura concluída" ou a mensagem do ERR-041.
Estado final: aplicação em `em_revisao`, `aguardando_cota`, `erro_leitura` ou `identificacao_pendente`.

**RF-008 — Fila de revisão humana e confirmação da aplicação**
Quem executa: A usuária (no papel de revisora).
Quando pode: Quando a aplicação está em `em_revisao`, `aguardando_cpf`, `sem_assinatura`, `identificacao_pendente` ou `erro_leitura` (conforme a ação, FL-001); sem reserva (DEC-112).
Quando não pode: Quando faltam campos obrigatórios; quando o estado não admite a ação.
Entradas: ações de revisão (confirmar, corrigir, em branco, ilegível, rasurado, não se aplica), conferência de assinatura, escolha do valor de cadastro em divergência (CA-014), identificação manual de páginas, nova leitura, página 1 assinada (CA-044).
Sucesso: todos os campos resolvidos, inclusive os itens de complemento, que são revisados como um valor à parte, ao lado da sua opção (DEC-197), e podem ficar em branco (DEC-199); o complemento de opção não marcada só aceita `nao_se_aplica` (DEC-205; outra ação → ERR-001); nome, data de nascimento, CPF válido, data e local informados (DEC-020); assinatura presente. Na versão de papel antigo, CPF, data de nascimento e assinatura não são exigidos, e sem CPF a usuária escolhe o respondente de mesmo nome ou um novo (DEC-172, DEC-176).
Erro e timeout: ERR-001 (escolha do respondente ausente ou fora dos candidatos no papel antigo sem CPF, ou `respondente_id` enviado fora desse caso, DEC-176), ERR-006 (campos obrigatórios ausentes), ERR-017 (edição concorrente, por exemplo em duas abas), ERR-018 (ação inválida no estado atual), ERR-022 (item não resolvido).
Registros alterados: ItemResposta (estado, valor_final, revisor_id), Aplicacao (estado, respondente_id, concluida_em), Auditoria.
Mensagens: "Aplicação concluída" ou "Aguardando [campo obrigatório]".
Estado final: aplicação `concluida`, `aguardando_cpf`, `sem_assinatura` ou `descartada`.

**RF-009 — Relatórios e dashboards por projeto, formulário, respondente e grupo**
Quem executa: A usuária.
Quando pode: Sempre que tiver sessão; todos os projetos (DEC-109).
Quando não pode: Filtro fora das regras abaixo.
Entradas: filtros (idade, estado civil, resposta a pergunta, período).
Sucesso: dashboard com gráficos por pergunta e cruzamento por uma segunda pergunta, com todas as contagens (sem k-anonimato, DEC-110); entram as aplicações concluídas com assinatura e as de papel antigo concluídas (DEC-172). A ficha individual mostra o complemento das opções com complemento junto do valor da pergunta, sem o nome do arquivo (DEC-211).
Erro e timeout: ERR-002 (projeto inexistente), ERR-001 (filtro fora das regras abaixo), timeout de 30 s.
Regras de filtro: idade por faixas `<60`, `60-64`, `65-69`, `70-74`, `75-79`, `80-84`, `85-89`, `90+` (formato do filtro, sem papel de anonimização, DEC-110); filtro por resposta só em perguntas categóricas (`escolha_unica`, `multipla_escolha`, `sim_nao`, `escala`, `matriz` por linha), com operadores `igual`, `diferente` ou `em` sobre códigos de opção; em `escala`, só `igual` ou `diferente` com um valor (DEC-075); em `multipla_escolha`, o filtro significa "marcou a opção".
Registros alterados: Auditoria (abertura de ficha); Grupo (ao salvar grupo).
Mensagens: "Nenhum dado para os filtros escolhidos" quando não há respondentes.
Estado final: dashboard exibido.

**RF-010 — Exportação em CSV/XLSX, auditoria e direitos do titular (LGPD)**
Quem executa: A usuária (exportação agregada ou linha a linha, direitos do titular e auditoria; DEC-109).
Quando pode: Sempre que tiver sessão.
Quando não pode: Pedido do titular em estado que não permite a ação.
Entradas: formato (CSV/XLSX), escopo (agregado, linha a linha ou linha por item; o formato longo é o RF-012), rótulos ou códigos, filtros; para direitos do titular, CPF do titular ou, sem CPF, o respondente escolhido pela usuária na busca por nome (`findRespondent`, mesma normalização da DEC-176, auditada), e o tipo do pedido. Consulta da trilha de auditoria (TL-011).
Sucesso: arquivo gerado, auditoria registrada; a exportação linha a linha leva também o complemento das opções com complemento e o nome do arquivo (DEC-207); na eliminação, o nome do arquivo das páginas do titular, inclusive das aplicações descartadas pela própria eliminação, é apagado no ato (DEC-206, DEC-210); na eliminação de respondente sem CPF, o pedido lista as aplicações de papel antigo em andamento com o mesmo nome normalizado, para a usuária decidir o descarte (DEC-191).
Erro e timeout: ERR-018 (pedido em estado que não permite execução), timeout de 60 s no job.
Registros alterados: Auditoria, PedidoTitular (se for direito do titular); na eliminação, também Respondente, ItemResposta, PaginaAplicacao (`nome_arquivo`), Aplicacao, Exportacao e ListaEliminacoes.
Mensagens: "Exportação concluída" ou "Pedido do titular executado".
Estado final: arquivo disponível ou pedido executado.

**RF-011 — Criação de formulário por importação, campos obrigatórios padronizados e ciclo de coleta (CHG-014)**
Quem executa: A usuária; a leitura da estrutura é feita pelo worker assíncrono.
Quando pode: Com sessão e o projeto ativo; o arquivo é um formulário em branco ou com dados fictícios (DEC-133).
Quando não pode: Projeto arquivado (ERR-001, DEC-146); sem a declaração `sem_dados_reais` (ERR-001); arquivo fora da RN-049 (ERR-029).
Entradas: projeto, nome do formulário, arquivo(s) e a declaração `sem_dados_reais`.
Sucesso: formulário novo com a versão 1 em rascunho (RN-049), com os 5 campos da RN-050, pronto para a curadoria no editor (TL-004). O RF-011 também responde pelos campos padronizados em todo rascunho (RN-050, DEC-135, DEC-145), pela verificação de altura das perguntas (DEC-143), pela recusa de formulário novo em projeto arquivado (DEC-146) e pelos dados do ciclo de coleta do projeto (DEC-137); esses usam as operações do RF-003 e do RF-004 (`createProject`, `updateProject`, `createForm`, `createVersion`, `updateVersion`, `publishVersion`).
Erro e timeout: ERR-001 (validação), ERR-029 (arquivo recusado), ERR-003 (aviso de cota, importação em `aguardando_cota`), ERR-044 (falha da importação); timeout de 60 s por chamada à IA, com 3 chamadas por página no total (seção 6.6).
Registros alterados: ImportacaoFormulario, Formulario, Versao, Pergunta, Opcao, LinhaMatriz, Projeto, Auditoria.
Mensagens: "Formulário importado" ou a mensagem do ERR-044.
Estado final: importação em `concluida` (formulário em rascunho) ou `falhou` (nada criado).

**RF-012 — Exportação em formato longo (CHG-015)**
Quem executa: A usuária; o arquivo é gerado pelo worker assíncrono.
Quando pode: Sempre que tiver sessão.
Quando não pode: Com `filtros` (ERR-001, DEC-163); projeto inexistente (ERR-002).
Entradas: formato (CSV ou XLSX), projetos e, opcionalmente, período (`exportData` com escopo `linha_por_item`).
Sucesso: arquivo no formato longo da RN-051, com as colunas `Arquivo` e `Complemento` (DEC-201), disponível pelo link da consulta da exportação até `retencao_exportacao_dias` (DEC-069); auditoria registrada.
Erro e timeout: ERR-001 (validação), ERR-002 (projeto não encontrado), ERR-019 (Idempotency-Key reusada com outro conteúdo); timeout de 60 s no job (seção 6.6), com a exportação em `falhou`.
Registros alterados: Exportacao, Auditoria.
Mensagens: "Exportação concluída".
Estado final: exportação `concluida` (arquivo disponível até expirar) ou `falhou`.

**RF-013 — Pesquisas sem QR e identificação da página pela IA (CHG-017, CHG-019)**
Quem executa: A usuária, no envio e na revisão; a localização é feita pelo worker assíncrono.
Quando pode: Quando o projeto está ativo; com QR legível ou com a versão publicada escolhida no envio (DEC-169); papel antigo por scanner ou foto.
Quando não pode: Sem QR legível e sem versão escolhida (ERR-004); versão escolhida de outro contexto, ou de papel antigo em aplicação com folha de QR legível de versão inválida (ERR-039, DEC-184; com QR legível de versão válida, a versão do QR apenas prevalece, DEC-180); arquivo fora da DEC-029 (ERR-029).
Entradas: arquivo(s), projeto, formulário (DEC-215) e, opcionalmente, a versão (`uploadImages` com `versao_id`); no papel antigo, data e local da aplicação, propostos com o padrão do projeto (DEC-179, DEC-182, DEC-185); na identificação, cada página inteira e as perguntas da versão (RN-045, RN-052); na importação de papel antigo, o formulário em branco (RN-049, DEC-181).
Sucesso: páginas identificadas pelo QR ou pela identificação; leitura da página inteira com o gabarito da página (RF-007, DEC-216); na versão de papel antigo, conclusão sem CPF, sem data de nascimento e sem assinatura (DEC-172, DEC-176).
Erro e timeout: ERR-001 (data do envio futura, DEC-182; respondente fora dos candidatos, DEC-176; `nao_consta` fora do permitido, DEC-179), ERR-004 (página não reconhecida, divergente do QR, faltante ou repetida), ERR-039, ERR-003 (aviso de cota), ERR-041 (3 falhas da identificação); timeout de 30 s por chamada (seção 6.6).
Registros alterados: Aplicacao (`versao_id`, `origem_qr`, data e local do envio, DEC-186), Projeto (padrão de data e local, DEC-192), PaginaAplicacao (`numero_pagina`, `regioes`), ItemResposta, Respondente (papel antigo sem CPF, DEC-176), Auditoria.
Mensagens: as do RF-006, do RF-007 e do RF-008.
Estado final: os da FL-001.

**RF-014 — Texto da opção "Outro" e nome do arquivo enviado (CHG-018)**
Quem executa: A usuária, no editor, no envio, na revisão e na exportação; a leitura e a exportação são feitas pelo worker assíncrono.
Quando pode: No rascunho, para marcar a opção com complemento (DEC-202); no envio, na leitura, na revisão e na exportação, como no RF-006, no RF-007, no RF-008 e no RF-012.
Quando não pode: `com_complemento` fora de `escolha_unica` e `multipla_escolha` ou em `nenhuma_das_anteriores` (ERR-001, RN-047); versão publicada (ERR-009).
Entradas: a marca `com_complemento` da opção (editor ou importação, RN-049); o nome de cada arquivo enviado (`uploadImages`, `addApplicationPages`, `attachSignaturePage`); a revisão do item de complemento (`saveReview`).
Sucesso: o PDF traz uma linha para escrever depois do rótulo da opção com complemento (DEC-202); o texto ao lado da opção marcada é lido, revisado e exportado na coluna `Complemento` (DEC-197, DEC-199 a DEC-201); cada página guarda o nome do arquivo de onde veio, mostrado no resultado do envio com o número da página na ordem do envio e exportado na coluna `Arquivo` (DEC-198, DEC-201).
Erro e timeout: os do RF-004, do RF-006, do RF-007, do RF-008 e do RF-012.
Registros alterados: Opcao (`com_complemento`), PaginaAplicacao (`nome_arquivo`), ItemResposta (item de complemento), Auditoria (sem o nome do arquivo nem o complemento, RN-028).
Mensagens: as do RF-004, do RF-006, do RF-008 e do RF-012.
Estado final: os da FL-001 e da FL-002.

**RF-015 — Projeto e formulário escolhidos no envio, leitura da página inteira e QR legível (CHG-019)**
Quem executa: A usuária, no cadastro, na impressão e no envio; a identificação e a leitura são feitas pelo worker assíncrono.
Quando pode: No cadastro de projeto e formulário (códigos, DEC-217); na geração do PDF (DEC-218, DEC-219); no envio, com projeto ativo e formulário escolhido (DEC-215).
Quando não pode: Envio sem formulário, ou com formulário de outro projeto (ERR-001); folha com QR legível de projeto ou formulário diferente do escolhido, no envio, no `addApplicationPages` ou no `attachSignaturePage` (ERR-045, DEC-222); versão de outro formulário no `identifyApplication` ou no `addApplicationPages` (ERR-039, DEC-221, DEC-225); `addApplicationPages` em aplicação antiga sem formulário (ERR-018, DEC-226); página 1 assinada com QR de outra versão ou com total diferente (ERR-039, DEC-227); código acima do limite (ERR-001).
Entradas: no envio, os arquivos, o projeto e o formulário, e opcionalmente a versão; na leitura, cada página inteira e o gabarito das perguntas dela (RN-045, DEC-216).
Sucesso: PDF com cabeçalho, rodapé legível e QR `PPPPP.FFF.VV.X/Y`; envio aceito com a versão do QR ou da escolha; itens lidos da página inteira, com valor, confiança e região, sem teste de sobreposição (RN-052).
Erro e timeout: ERR-001, ERR-018 (`addApplicationPages` em aplicação antiga sem formulário, DEC-226), ERR-045, ERR-039 (QR de versão inexistente ou total diferente; versão de outro formulário no `addApplicationPages`, DEC-225), ERR-004, ERR-041 (3 falhas da identificação ou da leitura); timeout de 30 s por chamada (seção 6.6).
Registros alterados: Projeto (`codigo`), Formulario (`codigo`), Aplicacao (`formulario_id`, DEC-221), PaginaAplicacao (`numero_pagina`, `regioes`), ItemResposta, Auditoria (recusa do ERR-045, sem imagem).
Mensagens: as do RF-004, do RF-006 e do RF-007, e a do ERR-045.
Estado final: os da FL-001.

6.2 Requisitos não funcionais (RNF)

Ver seção 4.2 (RN-023 a RN-036) para os detalhes de verificação de cada RNF.

| ID | Requisito | Verificação |
|---|---|---|
| RNF-001 | Isolamento por tenant no banco (FK composta + RLS), mantido com um tenant como defesa em profundidade (DEC-116) | Teste de integração gerado da OpenAPI |
| RNF-002 | Disco cifrado (BitLocker) e backup cifrado; tráfego local em 127.0.0.1; TLS 1.2+ na chamada à IA (DEC-107, DEC-117) | Verificação na instalação + teste de restauração |
| RNF-003 | CPF cifrado (com hash) e mascarado | Teste unitário e de integração |
| RNF-004 | Sem tamanho mínimo de grupo; painéis e exportações mostram todas as contagens (DEC-110) | Teste de integração do dashboard |
| RNF-005 | Trilha de auditoria imutável (só referências) | Teste de integração |
| RNF-006 | Logs sem dado sensível | Teste que varre logs |
| RNF-007 | Imagens em pasta local privada, link assinado local de 5 min | Teste de integração |
| RNF-008 | Retenção configurável, expurgo em até 30 dias | Job + teste |
| RNF-009 | Direitos do titular (acesso, correção, eliminação, portabilidade) | Teste por direito |
| RNF-010 | Provedor de IA sem retenção, sem treino | Evidência contratual (GX) |
| RNF-011 | Dados guardados só no notebook; IA pode processar as páginas inteiras da identificação e da leitura fora do Brasil após o GX-001 (DEC-111, DEC-170, DEC-216) | Decisão + evidência |
| RNF-012 | Acessibilidade WCAG 2.2 AA | Playwright + axe |
| RNF-013 | Referência: 95% das páginas lidas em até 2 min, sem meta de uploads simultâneos | Medição com o provedor real no conjunto-ouro |
| RNF-014 | Custo de IA monitorado, teto por tenant, fila ao atingir | Métrica + alerta |

6.3 Telas (TL)

Para cada tela, os estados obrigatórios (Bloco P, P.11): carregando, vazio, sucesso, erro, sem permissão e tempo esgotado.

| ID | Tela | Estados |
|---|---|---|
| TL-001 | Login | carregando, vazio (sem conta), sucesso (redireciona), erro (credenciais inválidas), sem permissão (conta bloqueada), tempo esgotado (sessão expirada) |
| TL-002 | Retirada na v2.1 (sem MFA, DEC-108) | — |
| TL-003 | Lista de projetos | carregando, vazio (nenhum projeto), sucesso (lista), erro, sem permissão, tempo esgotado |
| TL-004 | Cadastro de formulário (com a marca de complemento da opção, DEC-202) | carregando, vazio, sucesso (salvo), erro (validação), sem permissão, tempo esgotado |
| TL-005 | Upload de imagens (com a escolha opcional da versão publicada, para envio sem QR, DEC-169; o resultado mostra o nome do arquivo e o número de cada página na ordem do envio, DEC-198) | carregando, vazio, sucesso (aplicação criada), erro (arquivo recusado), sem permissão, tempo esgotado |
| TL-006 | Fila de revisão | carregando, vazio (fila vazia), sucesso (lista), erro, sem permissão, tempo esgotado |
| TL-007 | Revisão lado a lado (com a página inteira à vista, para o item sem região, DEC-177; o complemento aparece ao lado da sua opção, DEC-197) | carregando, vazio, sucesso (salvo), erro (validação ou edição concorrente), sem permissão (estado não admite revisão), tempo esgotado |
| TL-008 | Dashboard | carregando, vazio (sem dados), sucesso (gráficos), erro, sem permissão, tempo esgotado |
| TL-009 | Ficha individual (com o complemento da opção, DEC-211) | carregando, vazio, sucesso (evolução), erro, sem permissão (sessão expirada), tempo esgotado |
| TL-010 | Exportação (agregada, linha a linha ou linha por item) | carregando, vazio, sucesso (arquivo gerado), erro, sem permissão, tempo esgotado |
| TL-011 | Auditoria | carregando, vazio, sucesso (lista), erro, sem permissão, tempo esgotado |
| TL-012 | Direitos do titular | carregando, vazio, sucesso (pedido executado), erro, sem permissão, tempo esgotado |
| TL-013 | Retirada na v2.1 (sem usuários, perfis e concessões, DEC-109) | — |
| TL-014 | Retirada na v2.1 (sem convite nem link de recuperação, DEC-108) | — |
| TL-015 | Importação de formulário | carregando, vazio (nenhuma importação no projeto), sucesso (lista das importações do projeto; a concluída leva ao formulário em rascunho, com os avisos), erro (arquivo recusado ou importação falhou), sem permissão, tempo esgotado; aguardando cota (aviso do ERR-003) |

6.4 Máquinas de estado

**FL-001 — Estado da aplicação**

A aplicação nasce no upload (`uploadImages`). O estado inicial é decidido na própria requisição, na ordem da tabela "Criação".

Criação (evento: digitalizador envia as páginas):

| Ordem | Condição | Próximo estado | Erro/aviso |
|---|---|---|---|
| 0 | Formulário não escolhido ou de outro projeto (ERR-001), ou folha com QR legível de projeto ou formulário diferente do escolhido (DEC-215) | nenhum: o envio é recusado e nada é gravado | ERR-001 ou ERR-045 |
| 1 | QR legível do projeto e do formulário escolhidos, mas de versão inexistente ou não publicada, ou com o total `Y` diferente do `total_paginas` da versão (DEC-180, DEC-218) | identificacao_pendente | ERR-039 |
| 2 | Nenhuma folha com QR legível de versão válida do formulário escolhido e nenhuma versão escolhida no envio (DEC-169, DEC-180) | identificacao_pendente | ERR-004 |
| 3 | Nenhuma folha com QR legível de versão válida do formulário escolhido e versão escolhida inexistente, não publicada, de outro tenant, de outro projeto ou de outro formulário (DEC-100, DEC-221) | identificacao_pendente | ERR-039 |
| 4 | QR legíveis de versões diferentes, QR de página repetida, ou número de páginas diferente do total da versão (CA-013, CA-040); a versão é a do QR legível quando houver, para todas as folhas (DEC-180), senão a escolhida | identificacao_pendente | ERR-004 |
| 5 | Teto de custo de IA do tenant atingido | aguardando_cota | ERR-003 (aviso) |
| 6 | Nenhuma das anteriores | em_leitura | — |

Com QR legível, a versão do QR prevalece sobre a escolhida no envio (DEC-169, DEC-180); a escolhida fica gravada em `versao_id` mesmo em `identificacao_pendente`, se for válida (existente, publicada, do projeto e do formulário, e, sendo de papel antigo, sem folha de QR legível, DEC-184, DEC-235); a inválida é descartada, com o aviso da tabela (DEC-232, DEC-233), o formulário escolhido fica em `formulario_id` (DEC-221), e o `addApplicationPages` reavalia a tabela com eles (ou com a `versao_id` do próprio pedido, que substitui a escolhida), recusando com ERR-045 a folha nova de QR de outro projeto ou formulário (DEC-222). Essa tabela vale também no `addApplicationPages`, com duas exceções: primeira, a `versao_id` de outro formulário recusa o pedido com ERR-039, sem gravar nada (DEC-225); as demais causas de ERR-039 gravam as folhas e deixam a aplicação em `identificacao_pendente` com o aviso (DEC-230). Segunda, a aplicação antiga sem formulário recusa o `addApplicationPages` com ERR-018 até o `identifyApplication` definir o formulário, mesmo que ele volte ERR-004 (DEC-226, DEC-229). A versão de papel antigo nunca vale em aplicação com folha de QR legível, válido ou não (DEC-184); só conta o QR no formato do MinhaPesquisa (DEC-187). No `identifyApplication`, a conferência com o QR considera só as folhas mantidas (sem `descartar`). Data e local do envio ficam gravados até a localização confirmar a versão e as páginas, e só então são aplicados ou apagados (DEC-185, DEC-186). Os marcadores dos cantos não entram na tabela: a página sem marcadores é identificada e lida sobre a página inteira (RN-052). Em `em_leitura`, cada página passa primeiro pela identificação e só depois pela leitura da página inteira (DEC-216).

Transições:

| Estado atual | Evento | Condição | Ação | Próximo estado | Quem dispara |
|---|---|---|---|---|---|
| identificacao_pendente | digitalizador informa versão (do formulário da aplicação, DEC-221; na aplicação antiga sem formulário, a versão informada define o formulário uma única vez, DEC-223) e página ou corrige as páginas | páginas completas e coerentes; teto não atingido | a página informada prevalece, sem nova identificação (RN-052, item 3a), e dispara a leitura de todas as folhas mantidas | em_leitura | digitalizador |
| identificacao_pendente | digitalizador informa versão (do formulário da aplicação, DEC-221, ou DEC-223) e página ou corrige as páginas | páginas completas e coerentes; teto atingido | enfileira | aguardando_cota | digitalizador |
| identificacao_pendente | digitalizador informa versão e página | versão inexistente, não publicada, de outro tenant ou de outro projeto (DEC-100, DEC-233), versão de outro formulário (DEC-221), versão diferente da do QR legível e válido de alguma folha mantida (DEC-180), ou de papel antigo com alguma folha mantida de QR legível, válido ou não (DEC-184) | recusa com ERR-039; audita; nada muda | identificacao_pendente | digitalizador |
| identificacao_pendente | digitalizador informa versão e página | aplicação antiga sem formulário (DEC-223), versão válida (existente, publicada e do projeto; senão vale a linha anterior, com ERR-039 e nada gravado) e páginas ainda incompletas ou incoerentes | recusa com ERR-004; grava só o `formulario_id` da versão, uma única vez, e zera a `versao_id` se for de outro projeto (DEC-229, DEC-234); audita (`form_set_from_version`) | identificacao_pendente | digitalizador |
| identificacao_pendente | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| aguardando_cota | cota disponível | teto não atingido | dispara leitura | em_leitura | sistema (job) |
| aguardando_cota | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| em_leitura | identificação concluída | todas as folhas reconhecidas (inclusive por eliminação, DEC-188), sem divergência do QR e sem página faltante, repetida ou além do total | aplica ou apaga data e local do envio (DEC-186); avalia a regra 0 da FL-002; dispara a leitura de cada página inteira (DEC-216) | em_leitura | worker |
| em_leitura | identificação concluída | alguma página não reconhecida (salvo a eliminação da DEC-188) ou divergente do QR (essas duas conferências não valem depois do `identifyApplication`, RN-052, item 3a), ou páginas faltantes, repetidas ou além do total (RN-052, DEC-171) | audita; aviso ERR-004; nada é lido | identificacao_pendente | worker |
| em_leitura | leitura concluída | todos os itens lidos ou marcados sem leitura (DEC-177, DEC-179) | avalia estados dos itens (FL-002) | em_revisao | worker |
| em_leitura | teto atingido antes de ler todas as páginas | — | preserva itens já lidos; páginas restantes aguardam | aguardando_cota | worker |
| em_leitura | identificação ou leitura falhou 3x | timeout ou erro | preserva as páginas já identificadas e os itens já lidos (RN-052, item 3b); audita | erro_leitura | worker |
| em_leitura | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| erro_leitura | digitalizador manda ler de novo | teto não atingido | dispara leitura | em_leitura | digitalizador |
| erro_leitura | digitalizador manda ler de novo | teto atingido | enfileira | aguardando_cota | digitalizador |
| erro_leitura | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| em_revisao | digitalizador conclui | todos os itens resolvidos (FL-002); nome, data de nascimento, CPF válido, data e local informados (DEC-020); assinatura presente | grava manter_cadastro, vincula respondente, audita | concluida | digitalizador |
| em_revisao | digitalizador conclui | CPF ausente, ilegível ou inválido; versão que não é de papel antigo | audita; ERR-006 | aguardando_cpf | digitalizador |
| em_revisao | digitalizador conclui | versão de papel antigo (DEC-175); itens resolvidos; nome, data e local informados; CPF, data de nascimento e assinatura em qualquer situação (DEC-172, DEC-176) | vincula pelo CPF válido (grava manter_cadastro) ou, sem ele, ao respondente de mesmo nome escolhido pela usuária ou a um novo (DEC-176); audita | concluida | digitalizador |
| em_revisao | digitalizador conclui | assinatura marcada como ausente; demais condições atendidas; versão que não é de papel antigo | grava manter_cadastro; NÃO vincula respondente (DEC-064); audita | sem_assinatura | digitalizador |
| em_revisao | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| aguardando_cpf | digitalizador informa CPF válido | — | volta para revisão | em_revisao | digitalizador |
| aguardando_cpf | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| sem_assinatura | digitalizador envia página 1 assinada e confirma a assinatura como presente (RN-044) | QR do projeto e do formulário da aplicação (senão, recusa com ERR-045, DEC-222) confere versão e página, ou, sem QR legível, a usuária confirma que é a página 1 (DEC-183); divergências de cadastro iguais às gravadas | grava a imagem como `assinatura` (a página 1 original é mantida); confere assinatura sem reler os outros campos; vincula respondente com o manter_cadastro gravado; audita | concluida | digitalizador |
| sem_assinatura | digitalizador envia página 1 assinada e confirma a assinatura como presente | divergências de cadastro mudaram desde a conclusão (outra aplicação alterou o cadastro ou o respondente foi eliminado) | grava a imagem; recalcula divergências; audita; aviso ERR-018 | em_revisao | digitalizador |
| sem_assinatura | digitalizador corrige a conferência (assinatura marcada como ausente por engano) | — | volta para revisão, preservando os itens | em_revisao | digitalizador |
| sem_assinatura | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| concluida | digitalizador ou admin reabre com motivo | — | sai dos relatórios, audita | em_revisao | digitalizador/admin |
| descartada | — | estado final | — | — | — |

Precedência na conclusão (a primeira que se aplica decide):

1. Algum item fora dos estados resolvidos (FL-002) → ERR-022; nada é gravado.
1a. `respondente_id` enviado fora do caso permitido (versão que não é de papel antigo, ou papel antigo com CPF válido) → ERR-001; nada é gravado e a aplicação continua no estado em que estava, antes da regra 2 (DEC-176).
2. CPF ausente, ilegível ou inválido → resposta de sucesso com aviso ERR-006 e estado `aguardando_cpf` (a transição é gravada); na versão de papel antigo, a regra não se aplica (DEC-172).
3. Nome, data de nascimento, data ou local ausentes, ilegíveis, rasurados ou marcados como não se aplica → ERR-006; nada é gravado; permanece em `em_revisao` (DEC-079); na versão de papel antigo, a data de nascimento não entra nesta regra (DEC-176).
3a. Versão de papel antigo sem CPF válido, com respondentes de mesmo nome, sem a escolha da usuária (um deles ou novo), ou com `respondente_id` não nulo fora da lista, inclusive com a lista vazia → ERR-001; nada é gravado (DEC-176). A lista é calculada na hora, a partir do `valor_final` atual do NOME, tanto na exibição (`openReview`, `getApplication`) quanto na conclusão.
4. Assinatura ausente → `sem_assinatura`; presente → `concluida`; na versão de papel antigo, `concluida` nos dois casos (DEC-172).

Operações por estado (fora destas combinações → ERR-018):

Sem reserva de aplicação (DEC-112); a gravação concorrente é recusada pelo If-Match (ERR-017).

| Operação | Estados permitidos |
|---|---|
| identifyApplication, addApplicationPages | identificacao_pendente |
| getPageImage | todos, exceto descartada |
| openReview | em_revisao, aguardando_cpf, sem_assinatura |
| saveReview, getItemImage, confirmApplication | em_revisao, aguardando_cpf |
| attachSignaturePage | sem_assinatura |
| retryReading | erro_leitura |
| discardApplication | todos, exceto concluida e descartada |
| reopenApplication | concluida; e sem_assinatura (corrige a conferência) |
| getApplication | todos |

Em `aguardando_cpf`, `saveReview` sobre o item de CPF com valor válido devolve a aplicação a `em_revisao`.

Situação do item de CPF na conclusão: `em_branco` → ausente; `ilegivel` ou `rasurado` → ilegível; `confirmado`, `corrigido` ou `confirmado_automaticamente` com dígitos verificadores inválidos → inválido; `nao_se_aplica` não é permitido no item de CPF (ERR-001 em `saveReview`). `corrigir` no item de CPF valida os dígitos (ERR-001).

Quando não há cotação do dólar do mês corrente (DEC-058), novas leituras não são feitas: a aplicação fica em `aguardando_cota` com aviso ERR-003 e a usuária é avisada na tela.

Timeout e retentativa:
- Localização e leitura por IA: timeout de 30 s por chamada, retentativas em 1 e 2 s (DEC-129); após 3 falhas, estado final `erro_leitura`.

**FL-002 — Estado do item de resposta**

Ordem de avaliação ao fim da leitura de um item (a primeira regra que se aplica decide; a comparação de confiança usa o valor bruto, sem arredondamento):

| Ordem | Regra | Estado |
|---|---|---|
| 1b | Pré-regra do item de complemento (RN-009, DEC-197), avaliada antes da regra 0 e só para ele: (a) item da pergunta em `pendente_leitura`, `aguardando_condicao` ou `a_revisar` → `aguardando_condicao`; (b) item da pergunta em qualquer outro estado, sem a opção do complemento no seu valor: com a pergunta em estado vindo da leitura ou do worker (`confirmado_automaticamente`, `confirmado` ou `nao_se_aplica` posto por regra de salto, com `revisor_id` nulo) e complemento lido com texto → `a_revisar`, como inconsistência (DEC-205, DEC-209); com a pergunta resolvida pela usuária por outra ação (`corrigido`, `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica` marcado por ela, DEC-209), ou com o complemento lido em branco ou sem leitura → `nao_se_aplica`; (c) opção marcada e complemento sem leitura (a pergunta não foi lida, regra 0, ou a leitura não o devolveu) → `a_revisar`; (d) opção marcada e complemento lido → regras 6a, 7, 8 e 9, sem a regra 6 (DEC-200); texto acima de 200 caracteres está fora do schema (regra 7, §5.4) | aguardando_condicao, nao_se_aplica, a_revisar ou confirmado_automaticamente |
| 0 | Item sem leitura: pergunta `nao_consta` (DEC-179: CPF e data de nascimento → `em_branco`; data e local → `corrigido` com o valor do envio, ou `a_revisar` sem ele), pergunta sem região (DEC-177) ou com região sobreposta (RN-052, item 5) → `a_revisar`; vale mesmo para destino de regra de salto | em_branco, corrigido ou a_revisar |
| 1 | Item é destino de regra de salto e a pergunta de origem está em `pendente_leitura`, `aguardando_condicao` ou `a_revisar` (CA-018) | aguardando_condicao |
| 2 | Origem resolvida, a regra manda pular e o item está em branco (CA-015) | nao_se_aplica |
| 3 | Origem resolvida, a regra manda pular e o item está preenchido (CA-019) | a_revisar |
| 4 | Origem em `nao_se_aplica` (origem pulada por outra regra): destino em branco → `nao_se_aplica`; destino preenchido → `a_revisar` | nao_se_aplica ou a_revisar |
| 4a | Origem em `em_branco`, `ilegivel` ou `rasurado` (condição indeterminada) | a_revisar |
| 5 | Pergunta do tipo `cpf` (RN-012) | a_revisar |
| 6 | Pergunta do tipo `texto_livre` (DEC-057) ou `texto_curto` (DEC-066) | a_revisar |
| 6a | Valor lido em branco (DEC-074) | a_revisar |
| 7 | Valor fora do schema: tipo, faixa, opção inexistente, mais de uma marcação em escolha única, ou `nenhuma_das_anteriores` marcada junto com outra opção (CA-006) | a_revisar |
| 8 | Confiança > limite_confianca (DEC-028; até a calibração o limite é 1,00 e esta regra não se aplica, DEC-127) | confirmado_automaticamente |
| 9 | Demais casos (confiança ≤ limite) | a_revisar |

Item sem leitura (regra 0) nunca conta como "em branco" nas regras 2, 4 e 6a, que só valem para o valor lido pela IA. O item de complemento não é destino de regra de salto e é avaliado só pela pré-regra 1b, que usa as regras 6a a 9 no caso (d); as regras 0 a 6 não se aplicam a ele diretamente. Ele é reavaliado pela 1b a cada mudança de estado ou de valor do item da pergunta (leitura, `saveReview`, regra de salto), mas a revisão humana do complemento é mantida enquanto a opção continua marcada (DEC-204). As linhas "condição de salto muda" e "aplicação reaberta" da tabela abaixo não valem para ele; valem as linhas próprias do item de complemento. Na reabertura, as linhas próprias de reabertura substituem a pré-regra 1b, inclusive a 1b(a): o complemento com a opção marcada vai a `a_revisar` e ali fica até a usuária revisá-lo, mesmo quando ela confirma a pergunta de novo (não volta à 1b(d)); só sai dali sem revisão se a opção deixar de estar marcada (1b, b). O complemento em `nao_se_aplica` permanece assim na reabertura, salvo o da DEC-205, que tinha texto lido e volta a `a_revisar`. Nas linhas de reabertura, "opção marcada" é avaliada no `valor_final` preservado do item da pergunta, e o estado da pergunta é o de antes da reabertura (DEC-209). O `a_revisar` vindo da reabertura fica marcado no item de complemento (`revisao_reaberta`, DEC-203 do PLANO), e a marca sai quando a usuária aplica uma ação de revisão a ele ou quando a opção deixa de estar marcada. Na revisão, as perguntas de um mesmo `saveReview` são aplicadas antes dos seus complementos, e cada complemento é validado depois da pré-regra 1b (DEC-205, DEC-209). Toda mudança de estado feita pelo worker ou pela reavaliação de salto (também a do `saveReview`, sobre itens que a usuária não tocou) grava `revisor_id` e `revisado_em` nulos; só a ação de revisão da usuária sobre o próprio item os preenche (DEC-209). As linhas "aplicação reaberta" valem só para a reabertura a partir de `concluida`; a volta de `sem_assinatura` para `em_revisao` (FL-001) preserva os itens, inclusive os de complemento. O item `corrigido` com o valor do envio (DEC-179) fica com `revisor_id` nulo, e o preenchimento é auditado pelo worker, com os códigos das perguntas e sem os valores (RN-028). "Origem resolvida" (regras 2 e 3) significa origem em `confirmado_automaticamente`, `confirmado` ou `corrigido`. A regra 1 vale só para os três estados que listam; origem em `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica` segue para as regras 4 e 4a. Assim, todo estado da origem cai em exatamente uma das regras 1, 2/3, 4 ou 4a (ou, se a regra de salto não mandar pular, segue para as regras 5 a 9).

"Condição de salto resolvida" (evento da tabela abaixo) é a saída da origem de `pendente_leitura`, `aguardando_condicao` ou `a_revisar` para qualquer outro estado.

"Item resolvido" (usado na conclusão, FL-001) significa item em `confirmado_automaticamente`, `confirmado`, `corrigido`, `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica`. Itens em `pendente_leitura`, `aguardando_condicao` ou `a_revisar` impedem a conclusão (ERR-022).

| Estado atual | Evento | Condição | Ação | Próximo estado | Quem dispara |
|---|---|---|---|---|---|
| pendente_leitura | localização concluída | regra 0 | — | em_branco, corrigido ou a_revisar | worker |
| pendente_leitura | leitura concluída | regra 8 | — | confirmado_automaticamente | worker |
| pendente_leitura | leitura concluída | regras 3, 4 (destino preenchido), 4a, 5, 6, 6a, 7 ou 9 | — | a_revisar | worker |
| pendente_leitura | leitura concluída | regra 1 | — | aguardando_condicao | worker |
| pendente_leitura | leitura concluída | regra 2 ou 4 (destino em branco) | — | nao_se_aplica | worker |
| aguardando_condicao | condição de salto resolvida | regra 2 | — | nao_se_aplica | worker |
| item de complemento em qualquer estado, fora da reabertura | item da pergunta muda de estado ou de valor | pré-regra 1b; se o complemento está resolvido pela usuária, ou em `a_revisar` depois da reabertura, e a opção continua marcada, nada muda (DEC-204); se está em `nao_se_aplica` marcado pela usuária e a opção continua não marcada, nada muda (DEC-212) | reavalia; o `valor_ia` lido é mantido | aguardando_condicao, nao_se_aplica, a_revisar ou confirmado_automaticamente | worker ou API (saveReview) |
| item de complemento com a opção marcada | aplicação reaberta (a partir de `concluida`) | — | reavalia; valor_final preservado | a_revisar | digitalizador |
| item de complemento sem a opção marcada | aplicação reaberta (a partir de `concluida`) | complemento sem texto lido, ou pergunta resolvida pela usuária antes da reabertura (DEC-209) | — | permanece nao_se_aplica | digitalizador |
| item de complemento sem a opção marcada | aplicação reaberta (a partir de `concluida`) | complemento com texto lido e pergunta, antes da reabertura, em estado vindo da leitura ou do worker (1b, b; DEC-205, DEC-209) | reavalia | a_revisar | digitalizador |
| aguardando_condicao | revisor aplica ação de revisão | inclusive no item de complemento enquanto a pergunta não está resolvida | recusa com ERR-018 | permanece aguardando_condicao | digitalizador |
| aguardando_condicao | condição de salto resolvida | demais regras | avalia pelas regras 3 a 9 | confirmado_automaticamente, nao_se_aplica ou a_revisar | worker ou API (reavaliação em saveReview) |
| a_revisar | revisor confirma | valor_ia preenchido e no schema (DEC-128); senão ERR-001 | valor_final = valor_ia | confirmado | digitalizador |
| a_revisar | revisor corrige | — | valor_final = novo valor | corrigido | digitalizador |
| a_revisar | revisor marca em branco | — | — | em_branco | digitalizador |
| a_revisar | revisor marca ilegível | — | — | ilegivel | digitalizador |
| a_revisar | revisor marca rasurado | — | — | rasurado | digitalizador |
| a_revisar | revisor marca não se aplica | — | — | nao_se_aplica | digitalizador |
| confirmado_automaticamente | condição de salto muda | — | reavalia | a_revisar ou nao_se_aplica | worker |
| confirmado_automaticamente | aplicação reaberta | — | reavalia; valor_final preservado | a_revisar | digitalizador |
| confirmado / corrigido | condição de salto muda | — | reavalia | a_revisar ou nao_se_aplica | worker |
| confirmado / corrigido | aplicação reaberta | — | reavalia; valor_final preservado | a_revisar | digitalizador |
| em_branco / ilegivel / rasurado / nao_se_aplica | revisor altera | não vale para o complemento de opção não marcada (DEC-205) | valor_final atualizado | confirmado ou corrigido | digitalizador |
| confirmado_automaticamente / confirmado / corrigido / em_branco / ilegivel / rasurado / nao_se_aplica | revisor aplica outra ação de revisão | aplicação em `em_revisao` ou `aguardando_cpf`; no complemento de opção não marcada, só `nao_se_aplica` (DEC-205) | aplica a ação | estado da ação (em_branco, ilegivel, rasurado, nao_se_aplica, confirmado ou corrigido) | digitalizador |
| nao_se_aplica | condição de salto muda para "mostrar" (CA-020) | — | reavalia | a_revisar | worker |

Timeout e retentativa: não aplicável (estados finais de revisão são ações humanas).

**FL-003 — Estado do pedido do titular (ENT-018)**

| Estado atual | Evento | Condição | Ação | Próximo estado | Quem dispara |
|---|---|---|---|---|---|
| pendente | administrador executa | — | enfileira o job | em_andamento | administrador do tenant |
| pendente | administrador cancela com motivo | — | audita | cancelado | administrador do tenant |
| em_andamento | job conclui | — | registra resultado, audita | concluido | sistema (job) |
| em_andamento | job falha ou excede 60 s | — | audita a falha; alerta o administrador | falhou | sistema (job) |
| falhou | administrador executa de novo | — | reenfileira | em_andamento | administrador do tenant |
| falhou | administrador cancela com motivo | — | audita | cancelado | administrador do tenant |
| concluido / cancelado | — | estados finais | — | — | — |

Execução por tipo: `acesso` e `portabilidade` geram CSV ou JSON (CA-024); `correcao` aplica ao Respondente as correções informadas no pedido (atributo e novo valor), com auditoria e registro em HistoricoAtributoRespondente; `eliminacao` segue o CA-023. Executar em `em_andamento`, `concluido` ou `cancelado` → ERR-018.

**FL-004 — Estado da importação de formulário (ENT-031)**

| Estado atual | Evento | Condição | Ação | Próximo estado | Quem dispara |
|---|---|---|---|---|---|
| — | usuária envia o arquivo | projeto ativo, arquivo e declaração válidos (RN-049) | grava o arquivo, cria uma tarefa por página, enfileira | enfileirada | usuária |
| enfileirada / aguardando_cota | tarefa começa | cota disponível | reserva o custo da página antes da chamada (RN-036) | em_andamento | sistema (job) |
| enfileirada / em_andamento | reserva recusada | teto atingido | suspende as tarefas restantes; as páginas já lidas são mantidas; retoma quando a cota voltar (virada do mês ou teto maior), sem cancelamento pela usuária | aguardando_cota | sistema (job) |
| em_andamento | todas as páginas lidas | ao menos uma pergunta aproveitada | cria o formulário e a versão 1 em rascunho (RN-049, RN-050), apaga o arquivo, audita | concluida | sistema (job) |
| em_andamento | todas as páginas lidas | nenhuma pergunta aproveitada | apaga o arquivo, audita (ERR-044) | falhou | sistema (job) |
| enfileirada / em_andamento / aguardando_cota | 3ª falha na mesma página (chamada, ou página que não se lê do disco ou não se converte em imagem) | — | cancela as tarefas restantes, libera as reservas não usadas, apaga o arquivo, audita (ERR-044) | falhou | sistema (job) |
| concluida / falhou | — | estados finais; para tentar de novo, a usuária envia o arquivo outra vez | — | — | — |

O arquivamento do projeto depois do envio não interrompe a importação (DEC-146).

6.5 Concorrência e idempotência

| Situação | Tratamento |
|---|---|
| Edição simultânea de aplicação (duas abas) | Sem reserva (DEC-112); ETag/If-Match obrigatório, divergência → ERR-017 |
| Clique duplo em upload e em mutações críticas | Header `Idempotency-Key` obrigatório em todas as operações que o contrato declara com ele (upload, importação de formulário, identificação, conclusão, assinatura, nova leitura, descarte, reabertura, grupo, exportação e pedidos do titular; reuso com conteúdo diferente → ERR-019 |
| Edição concorrente de projeto, versão em rascunho e revisão | ETag/If-Match obrigatório; divergência → ERR-017 |
| Requisição repetida de leitura | Deduplicação por `aplicacao_id` + `pagina` no worker |
| Queda de rede no meio da operação | Outbox transacional (pg-boss) garante entrega |
| Edição de versão publicada | Recusado (ERR-009); versão publicada é imutável (CA-001) |

6.6 Resiliência em chamadas externas

| Chamada | Timeout | Retentativa | Estado final de falha |
|---|---|---|---|
| Provedor de IA (leitura) | 30 s | 1 e 2 s (só idempotente; DEC-129) | erro_leitura após 3 falhas (CA-041) |
| Provedor de IA (localização de uma página, RN-052) | 30 s | 1 e 2 s (3 chamadas no total, como a leitura) | erro_leitura após 3 falhas (CA-041) |
| Provedor de IA (estrutura de uma página na importação, RN-049) | 60 s | 1 e 2 s (3 chamadas por página no total) | importação em `falhou` (ERR-044) |
| Armazenamento de objetos (upload/download) | 30 s | 1, 2 e 4 s | ERR-020 (nada é gravado) |
| Geração do PDF imprimível | 30 s | 1, 2 e 4 s | ERR-020; versão permanece como está |
| Job de exportação e de pedido do titular | 60 s | sem retentativa automática (job enfileirado) | PedidoTitular em `falhou` (FL-003), com auditoria e alerta; exportação em `falhou` |

7. Histórias de usuário e critérios de aceite (Gherkin com dados concretos)

Regra do nível Completo: Todos os critérios de aceite de alto risco (segurança, LGPD, dinheiro, isolamento) DEVEM conter tabelas de dados concretos (Exemplos) para eliminar ambiguidade.

**US-001 — Como digitalizador, quero fazer upload de imagens de um formulário para que o sistema agrupe as páginas e inicie a leitura.**
Relacionado a: RF-006, RF-007, RF-008, CA-003, CA-004, CA-013, CA-029, CA-039, CA-040, CA-052, CA-053, CA-055, CA-057

CA-003 — Upload identifica o formulário e a página
Dado que o digitalizador está na tela de upload do projeto "Saúde Idoso" e escolheu o formulário dele
Quando ele envia as 4 páginas da versão 1 em JPEG, uma por arquivo, todas com QR code legível
Então o sistema identifica o formulário, a versão e cada página sem digitação, inclusive a página 2 (DEC-093)
E a aplicação entra no estado "Em leitura", com `origem_qr` = true
E cada página passa pela localização, que confirma a página do QR antes da leitura (DEC-171)

CA-004 — Upload sem QR legível
Dado que o digitalizador está na tela de upload do projeto "Saúde Idoso" e escolheu o formulário dele
Quando ele envia um arquivo JPEG de 2 MB cujo QR code está danificado ou ilegível, sem escolher a versão
Então a imagem vai para a fila com o status "identificacao_pendente"
E nada é lido pela IA
E o sistema exibe a mensagem exata do catálogo (ERR-004)

CA-029 — Validação de segurança e tamanho do arquivo
Dado que o digitalizador tenta enviar um arquivo
Quando o arquivo não é JPEG, PNG ou PDF, ou excede 20 MB, ou contém malware
Então o sistema recusa o upload imediatamente
E exibe a mensagem de erro exata do catálogo (ERR-029) com o motivo
E nenhum dado é gravado no banco

| Exemplo | Tipo de arquivo | Tamanho | Páginas | Resultado esperado | Erro e mensagem exata |
|---|---|---|---|---|---|
| 1 | formulario.pdf | 15 MB | 4 | Aceito | — |
| 2 | foto.jpg | 25 MB | 1 | Recusado | ERR-029 — Arquivo recusado: excede o limite de 20 MB. |
| 3 | dados.exe | 2 MB | — | Recusado | ERR-029 — Arquivo recusado: tipo de arquivo não permitido. |
| 4 | scan.png (conteúdo EICAR puro, MIME image/png) | 68 bytes | 1 | Recusado | ERR-029 — Arquivo recusado: risco de segurança detectado. |
| 5 | lote.pdf | 18 MB | 51 | Recusado | ERR-029 — Arquivo recusado: excede o limite de 50 páginas. |

**US-002 — Como revisor, quero corrigir campos com baixa confiança para garantir a qualidade dos dados antes da conclusão.**
Relacionado a: RF-007, RF-008, CA-005, CA-006, CA-007, CA-008

CA-005 — Confiança baixa vai para revisão
Dado que a IA processou uma imagem com limite de confiança de 0,90
Quando um campo é lido com confiança de 0,85
Então o estado do item de resposta é definido como "a_revisar"
E a aplicação não entra nos relatórios até ser resolvida

CA-006 — Valor fora da validação
Dado que a pergunta é do tipo "Escala numérica" com faixa permitida de 1 a 5
Quando a IA lê o valor "7" ou identifica duas opções marcadas
Então o campo vai para o estado "a_revisar"
Mesmo que a confiança da leitura seja superior a 0,90

CA-007 — Revisão lado a lado
Dado que a aplicação está no estado "em_revisao"
Quando o revisor abre a aplicação para analisar um campo
Então o sistema exibe o recorte da imagem do campo ao lado do valor lido pela IA
E o revisor pode aplicar as ações: confirmar, corrigir, em branco, ilegível, rasurado ou não se aplica

CA-008 — Correção é auditada sem expor o valor pessoal no log
Dado que um revisor corrige o campo "data_nascimento" de "1950-01-01" para "1951-01-01"
Quando a correção é salva
Então o `valor_ia` permanece "1950-01-01"
E o `valor_final` torna-se "1951-01-01"
E a auditoria registra: usuário="revisor_01", ação="CORRECAO_CAMPO", entidade="ItemResposta", campo="data_nascimento"
E o log de aplicação NÃO contém os valores "1950" ou "1951"

| Exemplo | Campo | valor_ia | Ação | valor_final | Auditoria (ação, campo) | Texto proibido no log e na auditoria |
|---|---|---|---|---|---|---|
| 1 | data_nascimento | "1950-01-01" | corrigir para "1951-01-01" | "1951-01-01" | CORRECAO_CAMPO, data_nascimento | "1950", "1951" |
| 2 | cpf | "12345678900" (lido errado, inválido) | corrigir para "12345678909" | "12345678909" | CORRECAO_CAMPO, cpf | "123456789", "12345678909" |

**US-003 — Como sistema, quero vincular a aplicação ao respondente correto pelo CPF para manter a evolução individual.**
Relacionado a: RF-005, RF-008, CA-002, CA-014, CA-032, CA-054, CA-056

CA-002 — Respondente identificado e vinculado pelo CPF
Dado que já existe um respondente no tenant com CPF "12345678909" e nome "Maria Silva"
Quando uma nova aplicação é concluída com o CPF lido "123.456.789-09" e nome "Maria da Silva"
Então o sistema valida os dígitos do CPF
E vincula a aplicação ao respondente existente (ID: `resp-001`)
E NÃO cria um novo registro de respondente
E o digitalizador informa em `manter_cadastro.nome` qual nome manter (CA-014)
E a divergência de nome é registrada na auditoria para ciência do revisor

| Exemplo | CPF lido | Respondente existente com o mesmo CPF | Resultado esperado |
|---|---|---|---|
| 1 | "123.456.789-09" | `resp-001` "Maria Silva" | Vincula a `resp-001`; divergência de nome auditada; nenhum respondente novo |
| 2 | "12345678909" (sem máscara) | `resp-001` "Maria Silva" | Mesmo resultado do exemplo 1 (normalização antes do HMAC) |
| 3 | "123.456.789-00" (inválido) | — | Conclusão responde com sucesso e aviso ERR-006; aplicação em `aguardando_cpf`; nenhum vínculo |

CA-032 — Campos obrigatórios de aplicação bloqueiam a conclusão
Dado que uma aplicação está em revisão
Quando o revisor tenta concluir sem informar a "data_aplicacao" ou o "local_aplicacao"
Então o sistema bloqueia a ação
E exibe a mensagem exata do catálogo (ERR-006): "A aplicação não pode ser concluída sem nome, data de nascimento, CPF válido, data e local da aplicação."

| Exemplo | nome | data_nascimento | CPF | data | local | Resultado esperado |
|---|---|---|---|---|---|---|
| 1 | preenchido | preenchida | "52998224725" | preenchida | vazio | ERR-006; permanece em `em_revisao` |
| 2 | preenchido | preenchida | "52998224725" | vazia | preenchido | ERR-006; permanece em `em_revisao` |
| 3 | preenchido | preenchida | vazio | preenchida | preenchido | Sucesso com aviso ERR-006; vai para `aguardando_cpf` |
| 4 | vazio | preenchida | "52998224725" | preenchida | preenchido | ERR-006; permanece em `em_revisao` |
| 5 | preenchido | preenchida | "52998224725" | preenchida | preenchido | Concluída (com assinatura presente) |

**US-004 — Como usuária, quero visualizar dashboards agregados por grupo.**
Relacionado a: RF-009, CA-009, CA-031

**US-005 — Como usuária, quero executar o direito de eliminação de um titular conforme a LGPD.**
Relacionado a: RF-010, CA-023, CA-024

CA-023 — Eliminação a pedido do titular com expurgo e anonimização
Dado um pedido de eliminação para o respondente com CPF "98765432100"
Quando o administrador executa o pedido
Então o acesso aos dados do respondente é bloqueado imediatamente
E as imagens da aplicação são marcadas para expurgo imediato
E os dados da entidade `Respondente` são anonimizados (`nome` = "ANONIMIZADO", `cpf_cifrado` = NULL, `data_nascimento` = NULL, `endereco` = NULL, `anonimizado` = true)
E o `cpf_hash` é apagado do banco
E os itens de resposta têm `valor_ia` e `valor_final` sobrescritos
E os arquivos de exportação ainda disponíveis são apagados
E o `nome_arquivo` das páginas das suas aplicações, inclusive das descartadas por esta execução, é apagado no ato (DEC-206, DEC-210)
E o histórico de atributos do respondente (ENT-023) é apagado
E `motivo_descarte`, `motivo_reabertura` das suas aplicações e a `descricao` do pedido são sobrescritos
E as aplicações em andamento do titular são descartadas, cada uma com um registro `descarte_aplicacao` na `ListaEliminacoes` (DEC-077, DEC-210)
E um registro é inserido na `ListaEliminacoes` com o ID interno do respondente, válido por 180 dias
E a auditoria registra a execução sem conter o CPF original
E o expurgo físico ocorre em até 30 dias
E a lista de eliminações de 180 dias garante a reaplicação do expurgo caso um backup seja restaurado dentro da janela de retenção de 90 dias (DEC-033)
E uma aplicação futura com o mesmo CPF cria um respondente novo

| Exemplo | Situação do titular antes do pedido | Resultado esperado após a execução |
|---|---|---|
| 1 | 2 aplicações concluídas | Itens sobrescritos; imagens marcadas para expurgo; aplicações fora de relatórios |
| 2 | 1 aplicação em `em_revisao` | Aplicação descartada; imagens marcadas para expurgo; `nome_arquivo` das páginas apagado no ato (DEC-210) |
| 3 | 1 exportação linha a linha pendente | Exportação cancelada e arquivo apagado |
| 4 | Backup restaurado 20 dias depois | Job reaplica a eliminação pela `ListaEliminacoes`; nenhum dado do titular volta, nem o `nome_arquivo` das aplicações descartadas pela execução, que têm registro `descarte_aplicacao` próprio (DEC-210) |
| 5 | Nova aplicação com o mesmo CPF após a eliminação | Novo respondente criado, sem vínculo com o anterior |

**US-006 — Como usuária, quero cadastrar projetos para organizar as pesquisas.**
Relacionado a: RF-003, RF-011, CA-027, CA-049

CA-027 — Ciclo de vida do projeto
Dado que o administrador do tenant criou o projeto "Saúde Idoso" com status "ativo"
Quando ele arquiva o projeto
Então novos uploads são recusados com ERR-001
E as aplicações em andamento seguem a revisão normalmente, inclusive o acréscimo de páginas (DEC-098)
E os relatórios continuam disponíveis
E o histórico registra: data, hora e usuário da mudança

**US-007 — Como usuária, quero cadastrar formulários com versões e perguntas para gerar o PDF imprimível.**
Relacionado a: RF-004, RF-007, RF-008, RF-009, CA-001, CA-015, CA-017, CA-018, CA-019, CA-020, CA-028, CA-036

CA-001 — Versão publicada é imutável
Dado que o formulário "Demografia" tem a versão 1 publicada
Quando o administrador tenta alterar uma pergunta da versão 1
Então a alteração direta é rejeitada com ERR-009
E o administrador pode criar a versão 2 em rascunho a partir da versão 1 e alterá-la
E as respostas já lidas continuam vinculadas à versão 1

CA-015 — Pergunta pulada pela regra de salto
Dado que a regra de salto é "pergunta 8 só se a pergunta 7 = sim"
Quando a pergunta 7 é lida como "não" e a pergunta 8 está em branco
Então a pergunta 8 recebe o estado "nao_se_aplica"
E a pergunta 8 não vai para revisão

CA-017 — Gráfico cruzado
Dado que a usuária está no dashboard do projeto "Satisfação"
Quando ele escolhe a pergunta "satisfação com o sono" e cruza por "estado civil"
Então o gráfico mostra a distribuição da satisfação separada por estado civil
E cada célula traz a contagem de respondentes, mesmo quando é pequena (DEC-110)

CA-018 — Condição de salto não resolvida
Dado que a pergunta 7 está "a_revisar"
Quando a leitura da pergunta 8 termina
Então a regra de salto da pergunta 8 só é avaliada depois que a pergunta 7 for resolvida
E a pergunta 8 fica no estado "aguardando_condicao"

Regra de salto: "pergunta 8 só se a pergunta 7 = sim".

| Exemplo | Estado da pergunta 7 (origem) | Pergunta 8 (destino) | Regra FL-002 | Estado da pergunta 8 |
|---|---|---|---|---|
| 1 | `a_revisar` | preenchida | 1 | `aguardando_condicao` |
| 2 | `pendente_leitura` | em branco | 1 | `aguardando_condicao` |
| 3 | `confirmado` = "não" | em branco | 2 | `nao_se_aplica` |
| 4 | `em_branco` | em branco | 4a | `a_revisar` |
| 5 | `ilegivel` | preenchida | 4a | `a_revisar` |
| 6 | `nao_se_aplica` (pulada por outra regra) | em branco | 4 | `nao_se_aplica` |
| 7 | `nao_se_aplica` (pulada por outra regra) | preenchida | 4 | `a_revisar` |
| 8 | sai de `a_revisar` para `rasurado` com a 8 em `aguardando_condicao` | — | 4a (reavaliação) | `a_revisar` |

CA-019 — Resposta em pergunta que deveria ser pulada
Dado que a pergunta 7 = "não" e a pergunta 8 foi preenchida
Quando a leitura termina
Então a pergunta 8 vai para revisão como inconsistência
E nada é descartado

CA-020 — Correção da condição
Dado que a pergunta 8 está marcada "nao_se_aplica" pela regra
Quando o revisor corrige a pergunta 7 para "sim"
Então a regra é reavaliada
E a pergunta 8 volta ao estado "a_revisar"

CA-028 — PDF imprimível
Dado que o projeto "Saúde Idoso" tem o código 1, o formulário "Demografia" tem o código 2 e a versão 1 dele está publicada, com 4 páginas
Quando o administrador gera o PDF
Então cada página traz no cabeçalho o nome do projeto e, logo abaixo, o do formulário (DEC-219)
E o rodapé da página 3 traz o texto "Projeto: 00001 · Formulário: 002 · Versão: 01 · Página 3/4" e, no canto, o QR com o conteúdo `00001.002.01.3/4` (DEC-218)
E há pelo menos 18 pt de espaço vertical entre o termo, o bloco de identificação e CPF, a data da aplicação e cada seção de perguntas, conferível no `mapa_layout`; nenhum bloco encosta no seguinte (DEC-219)
E o nome do projeto sai em negrito e a 14 pt, e o do formulário a 11 pt (DEC-219)
E a primeira página traz o termo de consentimento do tenant (`termo_consentimento`) com campo de assinatura (DEC-094)
E a pergunta do tipo "CPF" traz 11 caixas, uma por dígito (DEC-105)
E versão em rascunho não gera PDF

CA-036 — Publicação exige campos obrigatórios
Dado que a versão 1 do formulário, um rascunho criado antes da v2.4 e ainda não gravado de novo (RN-050), não tem pergunta marcada como "data_aplicacao"
Quando o administrador tenta publicar
Então a publicação é recusada com ERR-036
E a mensagem exibe: "Publicação recusada: faltam [data_aplicacao]"
E o campo `campos` do erro contém `data_aplicacao` (identificadores do enum `campo_respondente`/`campo_aplicacao`)

**US-008 — Como usuária, quero visualizar dashboards e relatórios agregados para analisar os dados das pesquisas.**
Relacionado a: RF-009, CA-009, CA-011, CA-031

CA-009 — Grupo dinâmico
Dado que o projeto "Saúde Idoso" tem respondentes de 62 a 91 anos
Quando a usuária filtra as faixas de idade "65-69" a "85-89" e "PRESSAO_ALTA = sim"
Então o dashboard mostra só esse grupo
E a idade é calculada na data da aplicação mais recente
E todas as contagens aparecem, sem ocultar grupos pequenos (DEC-110)

| Exemplo | Respondentes no filtro | Resultado esperado |
|---|---|---|
| 1 | 40 | Dashboard exibido com 40 |
| 2 | 2 | Dashboard exibido com 2 |
| 3 | filtro "idade > 70" (intervalo livre) | ERR-001 |

CA-011 — Evolução individual
Dado que o respondente "resp-001" tem três aplicações do mesmo código de pergunta em datas diferentes
Quando a usuária abre a ficha
Então vê a evolução no tempo, em todos os projetos (DEC-109)
E o CPF aparece mascarado
E a abertura fica registrada na auditoria

CA-031 — Unidade dos grupos
Dado que o respondente "resp-001" tem "pressão_alta = sim" em março e "não" em junho
Quando a usuária filtra "pressão_alta = sim" de janeiro a dezembro
Então o respondente não entra no grupo
E cada filtro usa a aplicação mais recente do período que contenha aquela pergunta
E os grupos sempre contam respondentes, não aplicações
E sem período informado, o filtro usa os últimos 12 meses

**US-009 — Como usuária, quero exportar dados em CSV ou XLSX para análise externa.**
Relacionado a: RF-010, CA-022, CA-024

CA-022 — Exportação agregada e linha a linha
Dado que a usuária está na tela de exportação
Quando ela exporta os dados agregados ou linha a linha
Então recebe o arquivo em CSV ou XLSX, sem ocultar grupos pequenos (DEC-110)
E a exportação linha a linha traz o CPF completo (DEC-072)
E toda exportação fica registrada na auditoria

CA-024 — Acesso, correção e portabilidade
Dado que o titular pediu acesso aos seus dados
Quando o administrador do tenant executa o pedido
Então o sistema gera os dados do respondente em formato CSV ou JSON
E a auditoria registra a execução sem conter os dados pessoais

**US-010 — Como usuária, quero instalar o sistema no meu notebook e entrar com a minha senha.**
Relacionado a: RF-001, RF-002, CA-012, CA-013, CA-014, CA-014b, CA-021, CA-026, CA-030, CA-033, CA-035, CA-037, CA-039, CA-040, CA-041, CA-042, CA-044

CA-012 — Isolamento entre tenants
Dado que o usuário "user-A" pertence ao tenant "tenant-A"
Quando ele requisita `GET /projects/{id-B}` do tenant "tenant-B"
Então recebe 404 Not Found (não 403), com ERR-002
E a tentativa é registrada na auditoria

| Exemplo | Requisição de user-A (tenant-A) | Recurso | Resposta esperada |
|---|---|---|---|
| 1 | `GET /projects/{id-B}` | projeto do tenant-B | 404 ERR-002, auditado |
| 2 | `GET /projects/{id-inexistente}` | UUID que não existe | 404 ERR-002, corpo idêntico ao do exemplo 1 |
| 3 | `POST /projects/{id-B}/archive` | projeto do tenant-B | 404 ERR-002; projeto do tenant-B inalterado |
| 4 | `GET /projects/{id-A}` | projeto do tenant-A | 200 |

CA-013 — Páginas agrupadas por quem digitaliza
Dado que o digitalizador abriu uma aplicação e enviou as páginas
Quando o QR indica página faltante ou repetida
Então o sistema bloqueia a leitura
E o digitalizador deve corrigir as páginas daquela aplicação

CA-014 — Respondente lido do papel
Dado que o respondente "resp-001" já existe com nome "Maria Silva"
Quando uma nova aplicação chega com nome "Maria da Silva" e o mesmo CPF
Então o sistema vincula ao respondente existente
E o digitalizador vê os valores lado a lado e escolhe qual manter
E a divergência é registrada na auditoria

CA-014b — Respondente novo criado a partir do papel
Dado que não existe respondente com o CPF "11144477735" no tenant
Quando uma aplicação é concluída com esse CPF válido
Então o sistema cria um novo registro de respondente com os dados lidos do formulário
E vincula a aplicação ao novo respondente
E a criação é registrada na auditoria

CA-021 — Assinatura ausente
Dado que uma aplicação tem assinatura marcada como ausente
Quando o analista consulta relatórios ou exporta
Então essa aplicação não aparece nos resultados
E a exceção é a aplicação de papel antigo, que aparece mesmo sem assinatura (DEC-172, CA-054)

CA-026 — Autenticação
Dado que a usuária tenta fazer login
Quando ela erra a senha 5 vezes em 15 minutos
Então novas tentativas são bloqueadas por 15 minutos
E a resposta não revela se a conta existe
E com a senha certa a sessão é criada direto, sem MFA (DEC-108)

CA-030 — Teto de custo de IA
Dado que o tenant atingiu o teto mensal de R$ 500,00
Quando chegam novas páginas
Então elas ficam na fila
E as aplicações ficam em "aguardando_cota"
E a usuária é avisada na tela (ERR-003, DEC-112)
E nenhuma página é descartada

| Exemplo | Custo acumulado no mês (R$) | Teto (R$) | Custo estimado da próxima chamada (R$) | Resultado esperado |
|---|---|---|---|---|
| 1 | 499,00 | 500,00 | 0,50 | Chamada feita; acumulado 499,50 |
| 2 | 499,80 | 500,00 | 0,50 | Chamada não feita; aplicação em `aguardando_cota`; aviso enviado |
| 3 | 500,00 | 500,00 | 0,01 | Chamada não feita; aplicação em `aguardando_cota` |
| 4 | 0,00 (virada do mês civil, DEC-058) | 500,00 | 0,50 | Fila retomada; aplicações voltam para `em_leitura` |

CA-033 — Descarte de aplicação
Dado que uma aplicação tem agrupamento errado
Quando o digitalizador a descarta com motivo
Então ela vai para "descartada"
E as imagens são apagadas
E os valores lidos dos itens são apagados e a aplicação é registrada na ListaEliminacoes com motivo `descarte_aplicacao` (DEC-077)
E a auditoria registra quem, quando e o motivo

CA-035 — Instalação
Dado que o notebook ainda não tem o MinhaPesquisa instalado
Quando a usuária roda o script de instalação com o nome da instituição, o e-mail e uma senha válida
Então o tenant e a conta são criados e ela já pode entrar com a senha
E rodar a instalação de novo é recusado, sem alterar nada
E senha fora das regras da RN-048 é recusada, sem criar nada

CA-037 — Recuperação de senha
Dado que a usuária esqueceu a senha
Quando ela roda o script de redefinição no notebook e informa uma nova senha válida
Então a senha é trocada e todas as sessões ativas são encerradas
E a redefinição fica registrada na auditoria, sem a senha
E não há e-mail nem link (DEC-108)

CA-039 — QR validado
Dado que o envio escolheu o projeto 00001 e o formulário 002, que só tem a versão 01 publicada, com 4 páginas
Quando o upload termina
Então os casos da tabela são tratados assim

| Exemplo | Conteúdo do QR da folha | Resultado esperado |
|---|---|---|
| 1 | `00001.002.05.1/4` (versão inexistente) | `identificacao_pendente`, ERR-039; nada é lido; a tentativa é auditada |
| 2 | `00001.002.01.1/3` (total diferente do da versão) | `identificacao_pendente`, ERR-039; nada é lido |
| 3 | `MP1.` seguido do código antigo (formato anterior à v2.9) | Conta como folha sem QR (DEC-218): a versão é a escolhida no envio ou, sem ela, `identificacao_pendente` com ERR-004; a presença do QR é auditada sem o conteúdo (DEC-187) |
| 4 | `00001.002.01.5/4` (página além do total) | Não decodifica no formato: conta como folha sem QR, como no exemplo 3 |

CA-040 — Montagem da aplicação no envio
Dado que o digitalizador escolhe o projeto e o formulário e envia as páginas
Quando o envio termina
Então o sistema cria uma aplicação com essas páginas
E um PDF com páginas a mais que a versão do formulário cai no alerta do CA-013

CA-041 — Erro de leitura
Dado que uma página falhou em 3 tentativas automáticas
Quando a última falhar
Então a aplicação vai para "erro_leitura"
E o digitalizador pode mandar ler de novo

CA-042 — Reabertura de aplicação concluída
Dado que uma aplicação está concluída
Quando o digitalizador a reabre com motivo
Então ela volta a "em_revisao"
E sai dos relatórios até ser concluída de novo
E se o CPF for corrigido, o vínculo é refeito
E as alterações de cadastro feitas por essa aplicação são revertidas
E o respondente que ficou sem nenhuma aplicação concluída é anonimizado como na eliminação e registrado na ListaEliminacoes com motivo `anonimizacao_reabertura`, sem os demais efeitos da eliminação (DEC-078)
E a reversão é registrada na auditoria

CA-044 — Assinatura anexada depois
Dado que a aplicação de "Demografia" (formulário 002 do projeto 00001, com a versão 01 de 2 páginas e a versão 02 também publicada) está no estado "sem_assinatura"
Quando o digitalizador envia a imagem da página 1 contendo a assinatura e confirma a assinatura como presente
Então o sistema confere o QR code da versão e da página ou, sem QR legível, toma a confirmação como a da usuária de que a folha é a página 1, sem chamar a IA (DEC-183)
E a assinatura é conferida sem reler os outros campos
E o resultado segue a tabela

| Exemplo | Folha enviada | Resultado esperado |
|---|---|---|
| 1 | Página 1 com QR íntegro da versão da aplicação | `concluida` |
| 2 | Página 1 sem QR legível (QR rasgado) | `concluida`; nenhuma chamada de localização nem de leitura (DEC-183) |
| 3 | Página 2 com QR íntegro da versão da aplicação | ERR-004 — Não foi possível identificar o formulário nesta página. Informe manualmente.; permanece em `sem_assinatura` |
| 4 | Página 1 com QR íntegro de outro formulário ou projeto | ERR-045 (DEC-222, CA-061 exemplos 11 e 12); permanece em `sem_assinatura` |
| 5 | Página 1 com `00001.002.02.1/2` (versão 02 do mesmo formulário), numa aplicação da versão 01 | ERR-039 (DEC-227); permanece em `sem_assinatura`, sem folha nova |
| 6 | Página 1 com `00001.002.01.1/3` (total diferente do `total_paginas` 2 da versão) | ERR-039 (DEC-227); permanece em `sem_assinatura`, sem folha nova |

**US-011 — Como usuária, quero criar um formulário a partir de um formulário em papel que já tenho, sem digitar pergunta por pergunta.**
Relacionado a: RF-011, RF-013, CA-045, CA-046, CA-047, CA-048, CA-058

CA-045 — Importação cria o formulário em rascunho
Dado que o projeto "Saúde 60+" está ativo
E a usuária envia "questionario.pdf" (2 páginas, em branco) com o nome "Hábitos" e a declaração `sem_dados_reais`
Quando a importação termina
Então a importação fica em `concluida` e existe o formulário "Hábitos" com a versão 1 em `rascunho`
E os 5 campos da RN-050 estão no início da página 1, seguidos das perguntas do original, na ordem do original, com os códigos da RN-049
E toda pergunta de múltipla escolha tem a opção `nenhuma_das_anteriores`
E as perguntas que não são da RN-050 têm sensibilidade `saude`, e a versão não tem regra de salto
E o arquivo enviado foi apagado e a auditoria registra a importação

| Exemplo | Impresso no original | Tipo | Código gerado | Opções ou linhas geradas |
|---|---|---|---|---|
| 1 | "Estado civil: ( ) Solteiro ( ) Casado ( ) Viúvo" | escolha_unica | ESTADO_CIVIL | `solteiro`, `casado`, `viuvo` |
| 2 | "Quais bens possui? [ ] Carro [ ] Geladeira [ ] TV" | multipla_escolha | QUAIS_BENS_POSSUI | `carro`, `geladeira`, `tv`, `nenhuma_das_anteriores` |
| 3 | "3) Você fuma? ( ) Sim ( ) Não" | sim_nao | VOCE_FUMA | `sim`, `nao` |
| 4 | Grade "Satisfação com:" com linhas "Moradia" e "Saúde" e colunas "Ruim" e "Boa" | matriz | SATISFACAO_COM | linhas `moradia`, `saude`; opções `ruim`, `boa` |
| 5 | Outra pergunta impressa como "Estado civil:", depois da do exemplo 1 | escolha_unica | ESTADO_CIVIL_2 | `solteiro`, `casado`, `viuvo` |
| 6 | "Ações praticadas" com a opção "Caminhada / corrida" | multipla_escolha | ACOES_PRATICADAS | `caminhada_corrida`, `nenhuma_das_anteriores` |

CA-046 — Campos obrigatórios reconhecidos ou injetados
Dado que o extrator devolve "Nome do entrevistado" com `campo_padrao = nome`, "Data da entrevista" com `campo_padrao = data_aplicacao` e "Nome social" também com `campo_padrao = nome`, nessa ordem, e nenhuma pergunta de data de nascimento, CPF ou local
Quando a importação termina
Então "Nome do entrevistado" vira a pergunta NOME (`campo_respondente = nome`, `texto_curto`), com o enunciado do original
E "Data da entrevista" vira DATA_APLICACAO (`campo_aplicacao = data_aplicacao`, `data`)
E "Nome social" fica como pergunta comum, com o código NOME_SOCIAL e o aviso `campo_repetido`
E DATA_NASCIMENTO, CPF e LOCAL_APLICACAO são injetadas com o enunciado padrão da RN-050
E os 5 campos ficam no início da página 1, na ordem da tabela da RN-050, cada um uma só vez
E a pergunta CPF é do tipo `cpf`

CA-047 — Envio recusado, cota e falha da importação
Dado que a usuária está na tela de importação (TL-015)
Quando envia um arquivo ou a importação é processada
Então o resultado segue a tabela

| Exemplo | Situação | Resultado esperado | Erro e mensagem exata |
|---|---|---|---|
| 1 | Sem a declaração `sem_dados_reais` | Recusado; nada é gravado | ERR-001 — Revise os campos destacados e tente novamente. (`campos`: `sem_dados_reais`) |
| 2 | modelo.tiff, 3 MB | Recusado; nada é gravado | ERR-029 — Arquivo recusado: tipo de arquivo não permitido. |
| 3 | Dois PDFs de 30 páginas cada | Recusado; nada é gravado | ERR-029 — Arquivo recusado: excede o limite de 50 páginas. |
| 4 | Projeto arquivado | Recusado; nada é gravado | ERR-001 — Revise os campos destacados e tente novamente. (`campos`: `projeto`) |
| 5 | Teto de custo atingido | Importação em `aguardando_cota`; retoma quando a cota voltar, sem chamada à IA antes disso | aviso ERR-003 — O processamento está pausado: o teto mensal de custo de IA foi atingido. |
| 6 | A IA não devolve nenhuma pergunta aproveitável | Importação em `falhou`; nenhum formulário criado; arquivo apagado | ERR-044 — Não foi possível ler o formulário. Confira o arquivo e tente de novo, ou cadastre as perguntas à mão. |
| 7 | 3 chamadas falham na página 2 | Importação em `falhou`; tarefas restantes canceladas; nenhum formulário criado; arquivo apagado | ERR-044 — Não foi possível ler o formulário. Confira o arquivo e tente de novo, ou cadastre as perguntas à mão. |
| 8 | Uma matriz lida é mais alta que uma página inteira | Importação em `concluida`, sem essa pergunta | aviso `nao_cabe` na página e posição da matriz |

CA-048 — Rascunho com os campos obrigatórios padronizados
Dado que a usuária cria o formulário "Sono" à mão (`createForm`) no projeto ativo "Saúde 60+"
Quando abre a versão 1 em rascunho e a grava
Então o resultado segue a tabela

| Exemplo | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir a versão 1 | Tem NOME, DATA_NASCIMENTO, CPF, DATA_APLICACAO e LOCAL_APLICACAO, obrigatórias, no início da página 1, na ordem da RN-050 |
| 2 | Gravar NOME com o enunciado "Nome do participante" | Aceito, com o enunciado novo |
| 3 | Gravar a pergunta marcada `campo_respondente = cpf` com tipo `texto_curto`, código `DOC` e sem `obrigatorio` | Aceito; a pergunta fica com código CPF, tipo `cpf` e `obrigatorio = true` (DEC-145) |
| 4 | Gravar sem a pergunta marcada `campo_respondente = cpf` | Recusado com ERR-001 (`campos`: `CPF`) |
| 5 | Gravar duas perguntas marcadas `campo_aplicacao = local_aplicacao` | Recusado com ERR-001 (`campos`: `LOCAL_APLICACAO`) |
| 6 | Gravar pergunta sem marcação com o código NOME | Recusado com ERR-001 (`campos`: `NOME`) |
| 7 | Gravar uma pergunta que passa do rodapé da página 1 | Recusado com ERR-001 (`campos`: código da pergunta) (DEC-143) |
| 8 | `createVersion` copiando uma versão publicada cuja pergunta de nome tem o código NOME_RESP | Nova versão com essa pergunta como NOME (RN-050) |
| 9 | `createForm` no projeto arquivado "Antigo" | Recusado com ERR-001 (`campos`: `projeto`) (DEC-146) |

CA-049 — Dados do ciclo de coleta do projeto
Dado que o projeto "Saúde 60+" está ativo
Quando a usuária grava objetivo, coordenador e período de coleta
Então o resultado segue a tabela
E a auditoria registra a alteração sem o nome do coordenador (RN-027)

| Exemplo | Operação | coordenador | coleta_inicio | coleta_fim | Resultado esperado |
|---|---|---|---|---|---|
| 1 | createProject | "Ana Souza" | 2026-12-01 | 2027-03-31 | Gravado |
| 2 | createProject | — | 2026-12-01 | — | Gravado |
| 3 | updateProject | — | 2027-03-31 | 2026-12-01 | Recusado com ERR-001 (`campos`: `coleta_fim`) |
| 4 | updateProject, num projeto que tinha "Ana Souza" | `null` | — | — | Gravado; o nome é apagado (DEC-137) |

**US-012 — Como usuária, quero exportar os dados em formato longo, uma linha por item, para analisar na planilha sem transformar os dados.**
Relacionado a: RF-012, CA-021, CA-050, CA-051

CA-050 — Planilha em formato longo
Dado que o projeto "Saúde 60+" tem a aplicação A1 (`concluida`, assinatura `presente`, data da aplicação 2026-11-05) da respondente "Maria da Silva", CPF "529.982.247-25", e a aplicação A2 (`concluida`, assinatura `ausente`)
E as páginas da A1 vieram do arquivo "maria.pdf"
E a versão das duas tem, nesta ordem, NOME, DATA_NASCIMENTO, CPF, DATA_APLICACAO, LOCAL_APLICACAO, BENS_POSSUIDOS (`multipla_escolha`), SATISFACAO_COM (`matriz`, linhas `moradia` e `saude`), PESO (`numero`), FUMA (`sim_nao`) e DOENCAS (`multipla_escolha`)
Quando a usuária exporta o projeto com escopo `linha_por_item`, formato XLSX e sem período
Então o arquivo tem o cabeçalho ID_Aplicacao, Arquivo, CPF, Nome, Data_Aplicacao, Codigo_Pergunta, Codigo_Linha, Codigo_Opcao_Valor, Rotulo_Opcao_Valor, Complemento, Situacao (DEC-201)
E só as linhas da A1, na ordem da tabela (a A2 fica fora, CA-021)
E todas com o ID da A1, Arquivo "maria.pdf", CPF "52998224725", Nome "Maria da Silva", Data_Aplicacao 2026-11-05 e Complemento vazio (nenhuma opção da versão tem complemento)
E não há linhas de NOME, DATA_NASCIMENTO, CPF nem DATA_APLICACAO (DEC-162)
E a auditoria registra a exportação uma vez, sem valores

| Exemplo | Item da A1 | Codigo_Pergunta | Codigo_Linha | Codigo_Opcao_Valor | Rotulo_Opcao_Valor | Situacao |
|---|---|---|---|---|---|---|
| 1 | LOCAL_APLICACAO = "Clínica Centro" | LOCAL_APLICACAO | (vazio) | Clínica Centro | (vazio) | respondida |
| 2 | BENS_POSSUIDOS = `carro;geladeira`, 1ª opção | BENS_POSSUIDOS | (vazio) | carro | Carro | respondida |
| 3 | BENS_POSSUIDOS, 2ª opção | BENS_POSSUIDOS | (vazio) | geladeira | Geladeira | respondida |
| 4 | SATISFACAO_COM, linha `moradia` = `boa` | SATISFACAO_COM | moradia | boa | Boa | respondida |
| 5 | SATISFACAO_COM, linha `saude` ilegível | SATISFACAO_COM | saude | (vazio) | (vazio) | ilegivel |
| 6 | PESO = `72.5` | PESO | (vazio) | 72.5 | (vazio) | respondida |
| 7 | FUMA em branco | FUMA | (vazio) | (vazio) | (vazio) | em_branco |
| 8 | DOENCAS = `nenhuma_das_anteriores` | DOENCAS | (vazio) | nenhuma_das_anteriores | Nenhuma das anteriores | respondida |

CA-051 — Recorte, formato, fórmulas e retenção do formato longo
Dado o projeto "Saúde 60+" do CA-050
Quando a usuária pede a exportação com escopo `linha_por_item`
Então o resultado segue a tabela

| Exemplo | Situação | Resultado esperado |
|---|---|---|
| 1 | Com `filtros` | Recusado com ERR-001 — Revise os campos destacados e tente novamente. (`campos`: `filtros`); nada é gravado |
| 2 | Projeto inexistente em `projeto_ids` | Recusado com ERR-002 — O recurso solicitado não existe ou você não tem acesso.; nada é gravado |
| 3 | Período de 2026-12-01 a 2026-12-31, sem aplicação nele | Exportação `concluida`; arquivo só com o cabeçalho |
| 4 | Formato CSV | Mesmas colunas e linhas do CA-050 |
| 5 | LOCAL_APLICACAO da A1 gravado como `=HYPERLINK("http://exemplo.invalid")` | No XLSX, Codigo_Opcao_Valor sai `=HYPERLINK("http://exemplo.invalid")` em célula de texto, não de fórmula; no CSV, `'=HYPERLINK("http://exemplo.invalid")` (DEC-166) |
| 6 | Nome do cadastro gravado como `@Maria` | No XLSX, Nome sai `@Maria` em célula de texto; no CSV, `'@Maria` (DEC-166) |
| 7 | PESO = `-3` | Codigo_Opcao_Valor sai `-3`, sem apóstrofo, nos dois formatos (DEC-166) |
| 8 | 8 dias depois de concluída a exportação | Arquivo apagado; a consulta da exportação traz `url_download` nulo (DEC-069) |

CA-052 — Papel antigo sem QR, com a versão escolhida no envio
Dado que o projeto "Saúde Idoso" tem a versão 2 do formulário "Condições de Saúde", publicada, de papel antigo, com 2 páginas, e a versão 1 do formulário "Saúde Geral", publicada, com QR, com 2 páginas
E que o projeto "Outro Projeto" tem a versão 1 do formulário "Hábitos", publicada
Quando a usuária envia, na tela de upload do projeto "Saúde Idoso", um PDF com as folhas da tabela
Então o resultado segue a tabela
E nas linhas em `em_leitura`, as páginas vêm da identificação ou do QR, e o evento de auditoria do upload registra `origem_qr`
E o PDF imprimível da versão 2 de "Condições de Saúde" é recusado com ERR-018 — Esta ação não é permitida no estado atual. (DEC-175)

| Exemplo | Formulário escolhido | Versão escolhida | Folhas enviadas | QR | Resultado esperado |
|---|---|---|---|---|---|
| 1 | "Condições de Saúde" | versão 2 | 2 | não | `em_leitura`, versão 2, `origem_qr` = false |
| 2 | "Condições de Saúde" | versão 2 | 3 | não | `identificacao_pendente`; ERR-004 — Não foi possível identificar o formulário nesta página. Informe manualmente.; nada é lido |
| 3 | "Condições de Saúde" | nenhuma | 2 | não | `identificacao_pendente`; ERR-004 — Não foi possível identificar o formulário nesta página. Informe manualmente.; nada é lido |
| 4 | "Saúde Geral" | nenhuma | 2 | íntegro, versão 1 de "Saúde Geral" | `em_leitura`, versão 1 de "Saúde Geral", `origem_qr` = true |
| 5 | "Condições de Saúde" | versão 2 | 2 | íntegro, versão 1 de "Saúde Geral" | Recusado com ERR-045 (o QR é de outro formulário do projeto); nada é gravado (DEC-215) |
| 6 | "Hábitos" (de "Outro Projeto") | versão 1 | 2 | não | Recusado com ERR-001, `campos` = `formulario_id`; nada é gravado (DEC-215) |
| 7 | "Condições de Saúde" | versão 2 | 2: a primeira com QR íntegro da página 1 da versão 1 de "Saúde Geral", a segunda sem QR | só na primeira | Recusado com ERR-045: basta uma folha com QR de outro formulário; nada é gravado (DEC-215) |
| 8 | "Saúde Geral" | nenhuma no envio; depois, `identifyApplication` com a versão 2 de "Condições de Saúde" | 2 | íntegro, versão 1 de "Saúde Geral", nas duas, mas com uma página repetida | O `identifyApplication` é recusado com ERR-039 — QR code inválido para o contexto atual. Informe manualmente.; auditado; nada muda (versão de outro formulário, DEC-221) |
| 9 | "Saúde Geral" | nenhuma | 2: a primeira com QR íntegro da página 1 da versão 1 de "Saúde Geral", a segunda sem QR | só na primeira | `em_leitura`, versão 1 de "Saúde Geral" nas duas folhas (DEC-180), sem precisar escolher versão; a segunda folha tem a página indicada pela identificação |
| 10 | "Condições de Saúde" | nenhuma no envio; depois, `identifyApplication` com a versão 2 | 2 | legível, do projeto e de "Condições de Saúde", mas de versão inexistente (CA-039) | No envio, `identificacao_pendente` com ERR-039; o `identifyApplication` com a versão 2, de papel antigo, é recusado com ERR-039 — QR code inválido para o contexto atual. Informe manualmente.; auditado, e nada muda (DEC-184) |
| 11 | "Condições de Saúde" | versão 2 | 2: a primeira com um QR de outro formato (endereço de site), a segunda sem QR | só o de outro formato | `em_leitura`, versão 2, `origem_qr` = false: o QR de outro formato conta como ausente; a presença dele é auditada sem o conteúdo (DEC-187) |
| 12 | "Condições de Saúde" | versão 2 | 2 | `MP1.` do formato anterior à v2.9 | `em_leitura`, versão 2, `origem_qr` = false: o QR antigo conta como ausente (DEC-218) e a versão de papel antigo vale (DEC-184 só olha o QR legível) |

CA-053 — Ordem das folhas indicada pela identificação
Dado que a usuária enviou 2 fotos JPEG com a versão 2 de "Condições de Saúde" (2 páginas) escolhida, sem QR (exemplos 1 a 3, 5 e 6) ou com QR legível da versão 2, publicada, com 2 páginas, de outro formulário do projeto "Saúde Idoso", "Condições de Saúde QR", escolhido no envio com essa versão (exemplo 4)
E que `limite_confianca_localizacao` é 0,50
Quando a identificação termina
Então o resultado segue a tabela

| Exemplo | Identificação da foto 1 | Identificação da foto 2 | Resultado esperado |
|---|---|---|---|
| 1 | página 2 | página 1 | Fotos lidas como página 2 e página 1, cada uma inteira com o gabarito da sua página (DEC-216) |
| 2 | página 1 (confiança 0,90) | página 2 com confiança 0,40 (não reconhecida, DEC-178) | `identificacao_pendente`; ERR-004; nada é lido |
| 3 | página 1 | página 1 | `identificacao_pendente`; ERR-004 (página repetida); nada é lido |
| 4 | página 2, com QR legível da página 1 | página 1, com QR legível da página 2 | `identificacao_pendente`; ERR-004 (identificação diverge do QR, DEC-171); nada é lido |
| 5 | depois do exemplo 2, a usuária informa foto 1 = página 1 e foto 2 = página 2 | sem nova identificação | `em_leitura`; as duas fotos são lidas, a foto 2 como página 2 (RN-052, item 3a); pergunta que a leitura não encontra vai a `a_revisar` (DEC-177) |
| 6 | página 1 (confiança 0,90) | página 2 com confiança exatamente 0,50 | Foto 2 reconhecida como página 2 (só abaixo de 0,50 a folha não é reconhecida, DEC-178); segue para a leitura |
| 7 | com a versão 1 de "Memórias Antigas" (estrutura do CA-058, publicada: 3 páginas, a página 3 sem perguntas) escolhida com o seu formulário e uma terceira foto, que a identificação indica como página 2 com confiança 0,90: página 1, confiança 0,90 | página nula | A foto 2 passa a ser a página 3, por eliminação, sem regiões e sem leitura (DEC-188); as fotos 1 e 3 seguem para a leitura |
| 8 | como no exemplo 7, mas a terceira foto também volta com página nula | página nula | `identificacao_pendente`; ERR-004; nada é lido (DEC-188) |
| 9 | com uma terceira foto, a mesma página 2 fotografada de novo: o envio já vai a `identificacao_pendente` com ERR-004, sem identificação (FL-001, linha 4; DEC-196) | — | depois, a usuária descarta a terceira foto e informa foto 1 = página 1 e foto 2 = página 2: a aplicação vai a `em_leitura`, e as duas fotos são lidas com a página informada, sem nova identificação nem conferência da página (RN-052, item 3a) |

E, nos exemplos 2 a 4, quando a usuária informa as páginas (`identifyApplication`), a página informada prevalece, não há nova identificação, todas as folhas mantidas são lidas e a aplicação volta a `em_leitura` (exemplo 5)

CA-054 — Papel antigo conclui sem CPF e sem assinatura
Dado que a aplicação A3, da versão 2 de "Condições de Saúde" (papel antigo), está em `em_revisao` com todos os itens resolvidos, nome "Maria Souza", data de nascimento 1950-03-12, data da aplicação 2024-05-10 e local "Centro Dia"
E que já existe a respondente R1, "MARIA  SOUZA", sem CPF e sem data de nascimento, e nenhuma respondente com o CPF "52998224725"
Quando a usuária conclui a aplicação nas situações da tabela
Então o resultado segue a tabela

| Exemplo | Versão | CPF | Assinatura | Resultado esperado |
|---|---|---|---|---|
| 1 | papel antigo | em branco | ausente | Sem escolha do respondente: ERR-001, nada é gravado; escolhendo R1: `concluida`, vinculada a R1, que passa a ter a data de nascimento 1950-03-12; entra na exportação, com a coluna CPF vazia no formato longo (DEC-172, DEC-176) |
| 2 | papel antigo | "52998224725" | ausente | `concluida`; cria a respondente com esse CPF (RN-015); entra na exportação |
| 3 | papel antigo | "52998224700" (inválido) | presente | Escolhendo respondente novo: `concluida`, com um respondente novo "Maria Souza", sem CPF (DEC-176) |
| 4 | papel antigo, data de nascimento em branco | em branco | ausente | Escolhendo R1: `concluida`, vinculada a R1, que continua sem data de nascimento (DEC-176) |
| 5 | papel antigo | em branco | ausente | Escolhendo um `respondente_id` fora dos candidatos: ERR-001; nada é gravado |
| 6 | papel antigo, nome em branco | em branco | ausente | ERR-006; permanece em `em_revisao` |
| 7 | aplicação de outra versão, que não é de papel antigo, com os mesmos dados | em branco | presente | `aguardando_cpf`; aviso ERR-006 |
| 8 | aplicação de outra versão, que não é de papel antigo, com os mesmos dados | "52998224725" | ausente | `sem_assinatura` (fora dos relatórios, CA-021) |
| 9 | papel antigo, nome "Joana Lima", sem respondente com esse nome | em branco | ausente | Sem `respondente_id`: `concluida`, com respondente novo "Joana Lima", sem CPF |
| 10 | papel antigo | "52998224725" | ausente | Com `respondente_id` de R1: ERR-001 (com CPF válido o vínculo é pelo CPF); nada é gravado |
| 11 | papel antigo, data de nascimento em branco | "39053344705" | ausente | `concluida`; cria a respondente com esse CPF e sem data de nascimento (DEC-176) |
| 12 | aplicação de outra versão, que não é de papel antigo, com os mesmos dados | em branco | presente | Com `respondente_id` de R1: ERR-001; nada é gravado e a aplicação continua em `em_revisao`, sem ir a `aguardando_cpf` (FL-001, precedência 1a) |
| 13 | papel antigo, nome "Joana Lima", sem respondente com esse nome | em branco | ausente | Com `respondente_id` de R1: ERR-001 (lista de candidatos vazia); nada é gravado |

CA-055 — Identificação sem leitura de valores e leitura da página inteira
Dado que a página 1 da versão 2 de "Condições de Saúde" tem só as perguntas NOME (`sensibilidade = identificacao`) e PRESSAO (`saude`), nenhuma marcada `nao_consta`
Quando a aplicação está em `em_leitura`
Então o sistema faz uma chamada de identificação com a página inteira e as perguntas da versão por página, sem projeto nem tenant
E depois uma única chamada de leitura com a página inteira e o gabarito de NOME e PRESSAO (DEC-216)
E o custo das duas chamadas entra no teto de custo de IA (RN-036)
E os casos da tabela são tratados assim

| Exemplo | Resposta | Resultado esperado |
|---|---|---|
| 1 | Identificação: página 1; leitura: NOME e PRESSAO com valor, confiança e região | Itens com o valor lido e o estado pela confiança (FL-002) |
| 2 | Identificação traz o texto "Maria" junto da página | Resposta recusada (RN-037) e tratada como falha da chamada, com retentativa; após 3 falhas, `erro_leitura` (ERR-041) |
| 3 | Leitura com regiões de NOME e PRESSAO que se sobrepõem | Os dois itens seguem a confiança, como no exemplo 1; não há mais teste de sobreposição (DEC-216) |
| 4 | Leitura sem valor e sem região de PRESSAO | PRESSAO em `a_revisar`; a usuária responde vendo a página inteira (DEC-177) |
| 5 | Leitura traz um campo `PESO`, fora do gabarito da página | Resposta recusada (RN-037) e tratada como falha da chamada |

CA-056 — Papel antigo nos relatórios e respondente sem CPF nos pedidos do titular
Dado que as aplicações A3 (data da aplicação 2024-05-10) e A4 (2024-05-17), de papel antigo, estão `concluida` sem assinatura e sem CPF, vinculadas às respondentes R1 ("Maria Souza", sem data de nascimento) e R2 ("Maria Souza", nascida em 1948-07-01, com 75 anos em 2024-05-17)
E que o dashboard usa o período de 2024-01-01 a 2024-12-31
Quando a usuária usa o dashboard e os pedidos do titular
Então o resultado segue a tabela

| Exemplo | Ação | Resultado esperado |
|---|---|---|
| 1 | Dashboard do projeto, sem filtro | A3 e A4 entram nas contagens (DEC-172) |
| 2 | Dashboard filtrado pela faixa `75-79` | Só A4 entra; R1, sem data de nascimento, fica fora (DEC-176) |
| 3 | `findRespondent` com o nome "maria souza" | Devolve R1 e R2, com a data de nascimento de cada uma; a busca é auditada |
| 4 | Pedido de eliminação com o `respondente_id` de R2 | Pedido registrado para R2; R1 não é afetada |
| 5 | Pedido sem CPF e sem `respondente_id`, ou com os dois | ERR-001 — Revise os campos destacados e tente novamente.; nada é gravado |
| 6 | Pedido de eliminação de R1, com a aplicação A5, de papel antigo, em `em_revisao`, sem CPF, com o NOME "maria  souza" | A consulta do pedido (`getDataSubjectRequest`) lista A5 em `aplicacoes_mesmo_nome` (pelo `valor_ia` do NOME, ainda sem revisão), com auditoria sem o nome; depois da execução, a lista continua no pedido (DEC-193); a execução não descarta A5 sozinha, e a usuária a descarta com `discardApplication` (DEC-191) |

CA-057 — Perguntas que não constam no papel antigo e padrão de data e local
Dado que a versão 2 de "Condições de Saúde" (papel antigo) tem as perguntas CPF e DATA_NASCIMENTO marcadas `nao_consta`, e DATA_APLICACAO e LOCAL_APLICACAO também
E que o projeto "Saúde Idoso" ainda não tem padrão de data e local
E que o projeto também tem a versão 1 de "Saúde Geral" (oficial, 2 páginas) e a versão 1 de "Lembranças" (papel antigo, 2 páginas, com DATA_APLICACAO marcada `nao_consta` e LOCAL_APLICACAO sem a marca)
E que "Condições de Saúde" também tem a versão 3 publicada, oficial (sem papel antigo), com 2 páginas
E que, salvo indicação no exemplo, cada envio tem 2 folhas sem QR, com o formulário "Condições de Saúde" e a versão 2 escolhidos, e a identificação reconhece as duas; quando o exemplo escolhe a versão de outro formulário, escolhe também esse formulário
Quando a usuária faz os envios da tabela, nessa ordem
Então o resultado segue a tabela

| Exemplo | Envio | Data e local propostos na tela | Data e local enviados | Resultado esperado |
|---|---|---|---|---|
| 1 | primeiro maço | vazios | 2024-05-10, "Centro Dia" | Itens de CPF e DATA_NASCIMENTO em `em_branco`; DATA_APLICACAO e LOCAL_APLICACAO em `corrigido` com os valores enviados; nenhum deles vai à identificação nem à leitura; o projeto passa a ter o padrão 2024-05-10 e "Centro Dia" |
| 2 | segundo maço | 2024-05-10, "Centro Dia" | os mesmos | Como no exemplo 1 |
| 3 | terceiro maço | 2024-05-10, "Centro Dia" | 2024-05-17, "Centro Dia" | Itens com 2024-05-17; o padrão do projeto passa a ser 2024-05-17 |
| 4 | quarto maço | 2024-05-17, "Centro Dia" | nenhum | DATA_APLICACAO e LOCAL_APLICACAO em `a_revisar`, sem leitura; o padrão não muda |
| 5 | gravação do rascunho (`updateVersion`) de uma versão de papel antigo com o NOME marcado `nao_consta` | — | — | Recusada com ERR-001 (`campos`: `NOME`) |
| 6 | envio com a data 2099-01-01 | 2024-05-17, "Centro Dia" | 2099-01-01, "Centro Dia" | Recusado com ERR-001 (`campos`: `data_aplicacao`); nada é gravado (DEC-182) |
| 7 | envio sem versão escolhida, com 2024-05-24 e "Centro Dia"; depois, `identifyApplication` com a versão 2 | 2024-05-17, "Centro Dia" | 2024-05-24, "Centro Dia" | O padrão passa a 2024-05-24 no envio (DEC-192); depois do `identifyApplication`, que conclui a identificação na hora (RN-052, item 3a), os itens recebem 2024-05-24 (DEC-182, DEC-186) |
| 8 | envio com a versão 1 de "Saúde Geral" escolhida, 2 folhas sem QR | — | 2024-05-31, "Centro Dia" | `em_leitura`; o padrão passa a 2024-05-31 no envio (DEC-192); ao fim da identificação, data e local são apagados da aplicação, e os itens DATA_APLICACAO e LOCAL_APLICACAO são lidos como os demais (DEC-182, DEC-186) |
| 9 | envio só com a data | 2024-05-31, "Centro Dia" | 2024-06-03, local vazio | DATA_APLICACAO em `corrigido` com 2024-06-03; LOCAL_APLICACAO em `a_revisar`, sem leitura; o padrão de data passa a 2024-06-03, e o de local continua "Centro Dia" (DEC-182, DEC-192) |
| 10 | envio sem versão escolhida, 2 folhas sem QR (`identificacao_pendente`, ERR-004); depois, `identifyApplication` com a versão 2 | — | 2024-06-07, "Centro Dia" | O padrão passa a 2024-06-07 no envio (DEC-192); em `identificacao_pendente`, data e local continuam gravados na aplicação; depois do `identifyApplication`, os itens recebem 2024-06-07 e "Centro Dia" (DEC-185, DEC-186) |
| 11 | envio sem versão escolhida, com 1 folha, 2024-06-14 e "Centro Dia"; depois, `addApplicationPages` com a segunda folha, a versão 2 e a data 2024-06-21 | 2024-06-07, "Centro Dia" | 2024-06-14, "Centro Dia" | O padrão passa a 2024-06-14 no envio e a 2024-06-21 no `addApplicationPages` (DEC-192); a data do `addApplicationPages` substitui a do envio, e o local é mantido: itens com 2024-06-21 e "Centro Dia" (DEC-185) |
| 12 | envio com a versão 1 de "Lembranças" | 2024-06-21, "Centro Dia" | 2024-06-28, "Casa de Repouso" | O padrão passa a 2024-06-28 e "Casa de Repouso" no envio (DEC-192); DATA_APLICACAO em `corrigido` com 2024-06-28; o local é apagado da aplicação, e LOCAL_APLICACAO é lido como as demais perguntas (DEC-185) |
| 13 | envio com a versão 2 e 2024-07-05, "Centro Dia"; a identificação não reconhece uma folha (`identificacao_pendente`); depois, `identifyApplication` com a versão 3 (oficial, do mesmo formulário) | 2024-06-28, "Casa de Repouso" | 2024-07-05, "Centro Dia" | O padrão passa a 2024-07-05 e "Centro Dia" no envio (DEC-192); durante a pendência, nada é aplicado aos itens; depois do `identifyApplication`, data e local são apagados da aplicação, e o padrão continua 2024-07-05 e "Centro Dia" (DEC-186) |

CA-058 — Importação de formulário de papel antigo
Dado que o projeto "Saúde Idoso" está ativo
E a usuária envia "antigo.pdf" (3 páginas, em branco) com o nome "Memórias Antigas", a declaração `sem_dados_reais` e `papel_antigo`
E o original traz, na página 1, "Nome:" e "Estado civil: ( ) Solteiro ( ) Casado"; na página 2, "Pressão alta? ( ) Sim ( ) Não", "Local:" e "Medicamentos em uso", de múltipla escolha com 60 opções, mais alta que a área útil de uma página do PDF; e, na página 3, só um agradecimento, sem pergunta
Quando a importação termina
Então a versão 1, em rascunho, tem `papel_antigo`, `total_paginas` = 3 e `mapa_layout` nulo, e nenhum aviso `nao_cabe` (DEC-181)
E o resultado segue a tabela

| Exemplo | Pergunta | Resultado esperado |
|---|---|---|
| 1 | NOME ("Nome:") | Página 1, sem `nao_consta` |
| 2 | ESTADO_CIVIL | Página 1 |
| 3 | PRESSAO_ALTA | Página 2, a página do original |
| 4 | LOCAL_APLICACAO ("Local:") | Página 2, sem `nao_consta` |
| 5 | MEDICAMENTOS_EM_USO | Página 2, sem descarte |
| 6 | CPF, DATA_NASCIMENTO e DATA_APLICACAO, que o original não tem | Injetadas no início da página 1, na ordem da RN-050 (DATA_NASCIMENTO, CPF e DATA_APLICACAO), antes de NOME e ESTADO_CIVIL, com `nao_consta` (DEC-179, DEC-190) |
| 7 | NOME, num original sem "Nome:" | Injetada no início da página 1, antes de DATA_NASCIMENTO (ordem da RN-050), sem `nao_consta`, e procurada pela leitura (DEC-181, DEC-190) |
| 8 | Todas, importando o mesmo arquivo sem `papel_antigo` | Como no CA-045: os 5 campos no início da página 1 e as demais redistribuídas; MEDICAMENTOS_EM_USO descartada com `nao_cabe`; nenhuma `nao_consta` |
| 9 | Cópia da versão 1 publicada (`createVersion` com `copiar_de_versao_id`) | A cópia é de papel antigo, com `total_paginas` = 3; com `papel_antigo` = false, `total_paginas` nulo e nenhuma pergunta `nao_consta` (DEC-179, DEC-189) |
| 10 | Cópia de uma versão de papel antigo publicada sem `total_paginas` informado, com perguntas até a página 2 | A cópia leva `total_paginas` = 2, o total gravado na publicação (ENT-006, DEC-189) |

**US-013 — Como usuária, quero que o texto escrito ao lado de "Outro" e o nome do arquivo enviado cheguem à revisão e à planilha, para não perder a resposta e para conferir de onde ela veio.**
Relacionado a: RF-014, CA-059, CA-060

**US-014 — Como usuária, quero escolher o projeto e o formulário antes de enviar e que a IA leia a folha inteira, para que o CPF e a data em caixas sejam lidos e uma digitalização não vá para o formulário errado.**
Relacionado a: RF-015, CA-061, CA-062, CA-063

CA-059 — Opção "Outro" com complemento
Dado que o projeto "Saúde 60+" tem a versão publicada com a pergunta MOTIVO_CONSULTA (`escolha_unica`, opções `rotina` "Rotina", `dor` "Dor" e `outros` "Outros", esta com `com_complemento`) e a pergunta DOENCAS (`multipla_escolha`, opções `diabetes` "Diabetes", `outra` "Outra" com `com_complemento` e `nenhuma_das_anteriores` "Nenhuma das anteriores")
E, para os exemplos 4e e 6e, outra versão publicada tem também a pergunta CONSULTOU (`sim_nao`), antes de MOTIVO_CONSULTA, com a regra de salto "CONSULTOU = `nao` → pula MOTIVO_CONSULTA"
E o mesmo formulário tem um rascunho com essas perguntas e também FUMA (`sim_nao`) e SATISFACAO_COM (`matriz`), para os exemplos 10 e 11
E o limite de confiança é 0,90
Quando a folha de uma aplicação é lida e revisada como na tabela
Então o item de complemento de cada opção com complemento fica como na tabela (FL-002, pré-regra 1b)
E a aplicação conclui com os itens de complemento em qualquer estado resolvido (DEC-199), e não conclui com um item de complemento em `aguardando_condicao` ou `a_revisar` (ERR-022, FL-001)
E na exportação `linha_por_item` a coluna Complemento sai como na tabela, só na linha da opção (DEC-201)

| Exemplo | Leitura e revisão | Complemento | Linha exportada |
|---|---|---|---|
| 1 | MOTIVO_CONSULTA lida `outros` (0,95), texto "Maternidade" (0,95) | `confirmado_automaticamente`, "Maternidade" (DEC-200) | Codigo_Opcao_Valor `outros`, Rotulo_Opcao_Valor "Outros", Complemento "Maternidade" |
| 1a | MOTIVO_CONSULTA lida `outros` (0,95), e a resposta da leitura não traz o complemento | `a_revisar` (pré-regra 1b, c) | — |
| 2 | MOTIVO_CONSULTA lida `outros` (0,95), texto "Matrnidade" (0,60); a usuária corrige para "Maternidade" | `a_revisar`, depois `corrigido` | Complemento "Maternidade" |
| 3 | MOTIVO_CONSULTA lida `outros` (0,95), nada escrito ao lado; a usuária marca em branco | `a_revisar` (regra 6a), depois `em_branco` | Complemento vazio; a aplicação conclui (DEC-199) |
| 4 | MOTIVO_CONSULTA lida `dor` (0,95), texto "joelho" ao lado de "Outros" (0,95); a usuária marca o complemento como não se aplica | `a_revisar`, como inconsistência (DEC-205), depois `nao_se_aplica`; `corrigir` nele é recusado com ERR-001 | Codigo_Opcao_Valor `dor`, Complemento vazio |
| 4a | MOTIVO_CONSULTA lida `dor` (0,95), nada escrito ao lado de "Outros" | `nao_se_aplica` (pré-regra 1b, b) | Codigo_Opcao_Valor `dor`, Complemento vazio |
| 4b | MOTIVO_CONSULTA lida `dor` (0,70), texto "joelho" ao lado de "Outros" (0,95); a usuária marca a pergunta em branco (o mesmo vale se ela a marca ilegível, rasurada ou não se aplica) | `aguardando_condicao`, depois `nao_se_aplica`, com "joelho" só em `valor_ia` (DEC-209) | MOTIVO_CONSULTA vazia, Complemento vazio |
| 4c | Caso 7 (complemento `a_revisar`), com todas as outras perguntas resolvidas; a usuária pede a conclusão (`confirmApplication`) | Recusada com ERR-022 — Ainda há campos a revisar nesta aplicação.; o complemento continua `a_revisar` | — |
| 4d | Caso 4 (complemento `nao_se_aplica` marcado pela usuária); depois ela aplica `confirmar` de novo em MOTIVO_CONSULTA, ainda `dor` | Permanece `nao_se_aplica` (DEC-212) | Codigo_Opcao_Valor `dor`, Complemento vazio |
| 4e | CONSULTOU lida `nao` (0,95); MOTIVO_CONSULTA sem marcação, com texto "joelho" ao lado de "Outros" (0,95) | MOTIVO_CONSULTA `nao_se_aplica` pela regra de salto (regra 2, `revisor_id` nulo); complemento `a_revisar`, como inconsistência (1b, b; DEC-209) | — |
| 5 | MOTIVO_CONSULTA lida `outros` (0,70), texto "Maternidade" (0,95) | `aguardando_condicao` enquanto a pergunta está `a_revisar`; quando a usuária confirma `outros`, `confirmado_automaticamente` | Complemento "Maternidade" |
| 6 | MOTIVO_CONSULTA lida `outros` (0,80) e confirmada pela usuária, texto "Maternidade" (0,95); depois a usuária corrige MOTIVO_CONSULTA para `rotina` | `confirmado_automaticamente`, depois `nao_se_aplica`, com "Maternidade" só em `valor_ia` (DEC-209) | Codigo_Opcao_Valor `rotina`, Complemento vazio |
| 6a | Caso 2 (complemento `corrigido`); depois a usuária aplica de novo `confirmar` em MOTIVO_CONSULTA, ainda `outros` | Permanece `corrigido`, "Maternidade" (DEC-204) | Complemento "Maternidade" |
| 6b | Caso 1 (complemento `confirmado_automaticamente`, 0,95), com a aplicação concluída e depois reaberta; a usuária confirma MOTIVO_CONSULTA | `a_revisar`, com o `valor_final` "Maternidade" preservado, e continua `a_revisar` depois da confirmação da pergunta, até a usuária revisá-lo (não volta a `confirmado_automaticamente` pela 1b, d) | — |
| 6c | Caso 4 (complemento `nao_se_aplica` pela DEC-205), com a aplicação concluída e depois reaberta | `a_revisar` de novo (DEC-205) | — |
| 6d | MOTIVO_CONSULTA lida `dor` (0,70), texto "Maternidade" (0,95); num só `saveReview`, a usuária corrige a pergunta para `outros` e o complemento para "Maternidade" | A pergunta é aplicada primeiro; o complemento fica `corrigido`, "Maternidade" | Complemento "Maternidade" |
| 6e | Caso 4b (pergunta `em_branco` pela usuária, complemento `nao_se_aplica`), com a aplicação concluída e depois reaberta | O complemento permanece `nao_se_aplica` (pergunta resolvida pela usuária antes da reabertura, DEC-209) | — |
| 7 | MOTIVO_CONSULTA lida `outros` (0,95), texto com 201 caracteres (0,95) | `a_revisar` (fora do schema, regra 7) | — |
| 8 | DOENCAS lida `diabetes;outra` (0,95), texto "Asma" (0,95) | complemento de `outra`: `confirmado_automaticamente`, "Asma" | Duas linhas de DOENCAS: `diabetes` com Complemento vazio e `outra` com Complemento "Asma" |

| Exemplo | Formulário | Resultado esperado |
|---|---|---|
| 9 | Importação, num formulário novo, de um original com "Motivo: ( ) Rotina ( ) Dor ( ) Outros: ______" | A opção entra com código `outros`, rótulo "Outros" e `com_complemento` = true (RN-049) |
| 10 | No editor, `updateVersion` do rascunho com `com_complemento` na opção `diabetes` de DOENCAS | Gravado; depois de publicada (`publishVersion`), o PDF da versão (`generatePdf`) traz uma linha para escrever depois de "Diabetes" (DEC-202) |
| 11 | `updateVersion` do rascunho com `com_complemento` na opção `nenhuma_das_anteriores`, ou numa opção de FUMA (`sim_nao`) ou de SATISFACAO_COM (`matriz`) | Recusado com ERR-001 — Revise os campos destacados e tente novamente. (`campos`: o código da pergunta) (RN-047) |
| 12 | Ficha individual (`getIndividualRecord`, IMP-004) da respondente do caso 1 | MOTIVO_CONSULTA com o valor `outros` e o complemento "Maternidade"; sem o nome do arquivo (DEC-211) |
| 13 | Caso 5, com a usuária pedindo `saveReview` só do complemento enquanto MOTIVO_CONSULTA está `a_revisar` | Recusado com ERR-018; o complemento continua `aguardando_condicao` (FL-002) |

CA-060 — Nome do arquivo enviado
Dado que o projeto "Saúde 60+" tem a versão 1 do formulário "Saúde Geral", publicada, com QR e 2 páginas
Quando a usuária envia "maria.pdf" (2 páginas), num envio, e depois, noutro envio, "joao.jpg" (página 1) e "joao-2.jpg" (página 2), cada envio de uma pessoa (DEC-008)
Então o resultado do primeiro envio lista as páginas 1 e 2 de "maria.pdf", e o do segundo, a página 1 de "joao.jpg" e a 2 de "joao-2.jpg", na ordem do envio (`ordem_envio`, DEC-198)
E cada página guarda o nome do arquivo de onde veio (ENT-025)
E nem o log nem a auditoria do upload trazem os nomes dos arquivos (RN-028)
E o apagamento do nome do arquivo na eliminação do titular (DEC-206) é conferido no CA-023 e no TS-005 (IMP-004)
E o resultado segue a tabela

| Exemplo | Situação | Resultado esperado |
|---|---|---|
| 1 | Exportação `linha_por_item` das duas aplicações concluídas | Arquivo "maria.pdf" nas linhas da aplicação de Maria; nas de João, "joao.jpg" nas perguntas da página 1 e "joao-2.jpg" nas da página 2 (DEC-201) |
| 2 | Nome de arquivo com 300 caracteres | Gravado cortado em 255 caracteres |
| 3 | Nome de arquivo `=SOMA(A1).pdf` | No XLSX, Arquivo sai em célula de texto, não de fórmula; no CSV, `'=SOMA(A1).pdf` (DEC-166) |
| 4 | Envio de "C:\fotos\maria.pdf" (o navegador manda o nome com a pasta) e de um nome em Unicode decomposto (NFD), "joão.jpg" | Gravados "maria.pdf", sem a pasta, e "joão.jpg" em NFC |
| 5 | Aplicação com páginas enviadas antes da migração 0010 (IMP-009) | Arquivo vazio nas linhas dessa aplicação |
| 6 | Envio de "ana-p1.jpg" só com a página 1, em `identificacao_pendente`, e depois `addApplicationPages` com "ana-p2.jpg" | A página de "ana-p2.jpg" recebe `ordem_envio` 2, continuando a sequência da aplicação |
| 7 | Envio com "ok.jpg" e "virus.pdf", este recusado pela varredura | ERR-029 com `posicao` = 2 e o motivo, sem o nome do arquivo na resposta nem no log (RN-028) |
| 8 | Aplicação descartada (DEC-077), depois do expurgo físico das imagens; `getApplication` | `nome_arquivo` nulo nas páginas |
| 9 | Aplicação em `sem_assinatura` com 2 folhas enviadas; `attachSignaturePage` com "maria-assinada.jpg" | A folha recebe `ordem_envio` 3 e guarda o nome "maria-assinada.jpg" |

CA-061 — Projeto e formulário escolhidos antes do envio
Dado que o projeto "Saúde Idoso" (código 00001) tem os formulários "Demografia" (002) e "Hábitos" (003), cada um com a versão 01 publicada de 2 páginas, e "Demografia" também com a versão 02 em rascunho
E o teto de custo de IA não foi atingido
E a aplicação dos exemplos 9 a 17 e 19 tem `versao_id` nula, o tenant B tem uma versão publicada e o stub da identificação responde página 1 para a folha 1 (exemplo 15)
E, nos exemplos 9 a 17, uma aplicação de "Demografia" já criada: em `identificacao_pendente`, com 1 página (9, 10, 13 a 17 e 19), ou em `sem_assinatura`, com as 2 páginas lidas e revisadas e a assinatura ausente (11 e 12)
Quando o digitalizador envia as imagens na tela de upload (exemplos 1 a 8 e 18) ou acrescenta uma folha ou anexa a página assinada (exemplos 9 a 17 e 19)
Então os casos da tabela são tratados assim (DEC-215)

| Exemplo | Escolha no envio | QR das folhas | Resultado esperado |
|---|---|---|---|
| 1 | projeto 00001, formulário "Demografia" | `00001.002.01.1/2` e `00001.002.01.2/2` | `em_leitura`, versão 01 de "Demografia" |
| 2 | projeto 00001, sem formulário | qualquer | Recusado com ERR-001, `campos` = `formulario_id`; nada é gravado |
| 3 | projeto 00001, formulário "Demografia" | `00001.003.01.1/2` ("Hábitos") na folha 1 | Recusado com ERR-045, com `projeto_qr` = 00001 e `formulario_qr` = 003, que a tela mostra junto da mensagem; nenhuma aplicação é criada; a recusa é auditada sem imagem |
| 4 | projeto 00001, formulário "Demografia" | `00007.002.01.1/2` (outro projeto) na folha 2 | Recusado com ERR-045; nada é gravado |
| 5 | projeto 00001, formulário de outro projeto | qualquer | Recusado com ERR-001, `campos` = `formulario_id` |
| 6 | projeto 00001, formulário "Demografia" | nenhum | Sem versão escolhida: `identificacao_pendente`, ERR-004 (FL-001) |
| 7 | projeto 00001, formulário "Demografia" | folha 1 com `00001.003.01.1/2` e folha 2 com `00007.002.01.2/2` | Recusado com ERR-045, com `projeto_qr` = 00001 e `formulario_qr` = 003 (os da primeira folha divergente, DEC-224); nada é gravado |
| 8 | projeto 00001, formulário "Demografia"; o arquivo da folha 1 é inválido (ERR-029, `posicao` = 1) | folha 2 com `00001.003.01.2/2` | Recusado com ERR-029, não com ERR-045 (DEC-224); nada é gravado |
| 9 | aplicação "Demografia" em `identificacao_pendente`; `addApplicationPages` com uma folha | `00001.003.01.2/2` ("Hábitos") | Recusado com ERR-045; a aplicação continua `identificacao_pendente`, com as mesmas páginas (DEC-222) |
| 10 | aplicação "Demografia" em `identificacao_pendente`; `addApplicationPages` com uma folha | `00007.002.01.2/2` (outro projeto) | Recusado com ERR-045; nada é gravado e a aplicação não muda |
| 11 | aplicação "Demografia" em `sem_assinatura`; `attachSignaturePage` com a página 1 assinada | `00001.003.01.1/2` ("Hábitos") | Recusado com ERR-045; permanece em `sem_assinatura`, sem folha nova (DEC-222) |
| 12 | aplicação "Demografia" em `sem_assinatura`; `attachSignaturePage` com a página 1 assinada | `00007.002.01.1/2` (outro projeto) | Recusado com ERR-045; permanece em `sem_assinatura`, sem folha nova |
| 13 | aplicação "Demografia" em `identificacao_pendente`; `addApplicationPages` com `versao_id` da versão 01 de "Hábitos" | sem QR legível | Recusado com ERR-039 (400); nada é gravado e a aplicação não muda (DEC-225) |
| 14 | aplicação antiga do projeto 00001, sem versão e sem `formulario_id` (DEC-223); `addApplicationPages` com uma folha | `00001.002.01.2/2` | Recusado com ERR-018; nada é gravado (DEC-226) |
| 15 | a mesma aplicação antiga do projeto 00001; `identifyApplication` com a versão 01 de "Demografia" e a página 1 (falta a página 2); depois, o `addApplicationPages` do exemplo 14 | sem QR legível; depois, `00001.002.01.2/2` | O `identifyApplication` volta ERR-004 e grava `formulario_id` = "Demografia", uma única vez, sem mudar mais nada (DEC-229); o `addApplicationPages` é aceito e a aplicação vai para `em_leitura`, com `versao_id` = versão 01 (a do QR da folha 2, `origem_qr` = true) e a folha 1 identificada pela IA |
| 16 | aplicação de "Demografia" em `identificacao_pendente`; `addApplicationPages` com `versao_id` da versão 02 de "Demografia", não publicada | sem QR legível | 200: a folha é gravada, a `versao_id` não é gravada (continua nula) e a aplicação continua em `identificacao_pendente` com o aviso ERR-039 (DEC-230, DEC-232) |
| 17 | aplicação de "Demografia" em `identificacao_pendente`; `addApplicationPages` com `versao_id` de uma versão de outro tenant | sem QR legível | Mesmo resultado do exemplo 16, como se a versão não existisse; a tentativa é auditada com o evento `version_out_of_scope` (DEC-233) |
| 18 | projeto 00001, formulário "Demografia"; envio com uma `versao_id` inexistente | sem QR legível | `identificacao_pendente` com o aviso ERR-039; as folhas são gravadas e a `versao_id` fica nula (DEC-232) |
| 19 | aplicação de "Demografia" em `identificacao_pendente`; `addApplicationPages` com `versao_id` da versão 01 de "Demografia" de outro projeto | sem QR legível | 200: a folha é gravada, a `versao_id` não é gravada (continua nula) e a aplicação continua em `identificacao_pendente` com o aviso ERR-039 (DEC-230, DEC-232) |

CA-062 — CPF em caixas e data da aplicação vizinhos são lidos
Dado que a página 1 da versão 01 de "Demografia" tem o CPF em 11 caixas logo acima da data da aplicação, ambos preenchidos à mão
Quando a aplicação está em `em_leitura`
Então a leitura recebe a página inteira com o gabarito das perguntas da página 1 (DEC-216)
E o CPF e a data da aplicação voltam com valor, confiança e região, cada um no seu item
E nenhum dos dois vai a `a_revisar` por estar perto do outro (RN-052, item 5, revogado)
E o estado de cada item segue a confiança e a validação (FL-002, CA-005, CA-006)

CA-063 — Códigos sequenciais de projeto e formulário e seus limites
Dado que o tenant tem os projetos 00001 e 00002, nessa ordem, e o projeto 00001 tem os formulários 001 e 002
Quando a usuária cria projetos, formulários e versões, ou o sistema migra uma base sem códigos
Então os casos da tabela são tratados assim (DEC-217, DEC-218)

| Exemplo | Situação | Resultado esperado |
|---|---|---|
| 1 | Cria um projeto | `codigo` "00003" na resposta |
| 2 | Cria um formulário no projeto 00002 | `codigo` "001" (a contagem é por projeto) |
| 3 | Altera o nome e depois arquiva o projeto 00001 | `codigo` continua "00001" (imutável) |
| 4 | Migração de uma base com 3 projetos criados em dias diferentes, sem código | Recebem "00001", "00002" e "00003" pela ordem de `criado_em` |
| 5 | O maior `codigo` de projeto é 99999 e a usuária cria outro projeto | ERR-001, sem `campos` (o limite não é de um campo do pedido); nada é criado |
| 6 | O maior `codigo` de formulário do projeto é 999 e a usuária cria outro formulário | ERR-001, sem `campos` (o limite não é de um campo do pedido); nada é criado |
| 7 | O formulário tem a versão 99 e a usuária cria outra versão | ERR-001, sem `campos` (o limite não é de um campo do pedido); nada é criado |
| 8 | Migração de um projeto com 3 formulários criados em dias diferentes, sem código | Recebem "001", "002" e "003" pela ordem de `criado_em`, dentro do projeto |
| 9 | Duas criações de projeto ao mesmo tempo | Recebem códigos diferentes e consecutivos (DEC-220 (1)) |

Os exemplos 5 a 7 não criam milhares de registros: o teste grava na base de teste o maior código (99999 ou 999) ou a versão 99 e então chama a operação.

8. Rastreabilidade e catálogo de erros

8.1 Matriz de Rastreabilidade (completa)

A matriz completa é mantida em `registros/matriz_rastreabilidade.csv`, idêntica a esta tabela; o CI (`tools/validar_consistencia.py`) falha se divergirem. Operações marcadas "(interna)" são executadas pelo worker ou dentro de outra operação e não são endpoints.

| Requisito | Regra | Entidade | Fluxo | História | Critério | Teste Sentinela | Operation ID | Componente | Incremento |
|---|---|---|---|---|---|---|---|---|---|
| RF-001 | RN-001, RN-006, RN-007 | ENT-001, ENT-002 | FL-001 | US-010 | CA-012, CA-035, CA-037 | TS-001 | installLocalAccount (interna), resetLocalPassword (interna) | CMP-Auth | IMP-001 |
| RF-002 | RN-048 | ENT-002, ENT-027, ENT-030 | FL-001 | US-010 | CA-026 | — | login, logout, getCurrentSession | CMP-Auth | IMP-001 |
| RF-003 | RN-027 | ENT-004, ENT-020, ENT-021 | FL-001 | US-006 | CA-027 | — | listProjects, getProject, createProject, updateProject, archiveProject, unarchiveProject | CMP-Projects | IMP-002 |
| RF-004 | RN-017, RN-018, RN-019, RN-021, RN-042, RN-047, RN-050 | ENT-005, ENT-006, ENT-007, ENT-008, ENT-016, ENT-024 | FL-001 | US-007 | CA-001, CA-028, CA-036 | TS-006 | listForms, createForm, getVersion, createVersion, updateVersion, publishVersion, generatePdf | CMP-Forms | IMP-002 |
| RF-005 | RN-011, RN-012, RN-014, RN-015 | ENT-009, ENT-010 | FL-001, FL-002 | US-003 | CA-002, CA-014, CA-014b, CA-032 | — | linkRespondent (interna) | CMP-Respondents | IMP-003 |
| RF-006 | RN-040 | ENT-010, ENT-011, ENT-025, ENT-029 | FL-001 | US-001 | CA-003, CA-004, CA-013, CA-029, CA-039, CA-040 | TS-002 | uploadImages, identifyApplication, addApplicationPages, getPageImage | CMP-Upload | IMP-002 |
| RF-007 | RN-021, RN-036, RN-037, RN-038, RN-045, RN-052 | ENT-011 | FL-001, FL-002 | US-002, US-007 | CA-005, CA-006, CA-015, CA-018, CA-019, CA-030, CA-041 | TS-003, TS-007 | processAIReading (interna), getQuotaStatus | CMP-MotorIA | IMP-003 |
| RF-008 | RN-016, RN-043, RN-044 | ENT-009, ENT-010, ENT-011, ENT-023 | FL-001, FL-002 | US-002, US-003, US-007 | CA-007, CA-008, CA-020, CA-021, CA-033, CA-042, CA-044 | — | listReviewQueue, getApplication, openReview, getItemImage, saveReview, confirmApplication, attachSignaturePage, retryReading, discardApplication, reopenApplication | CMP-Revisao | IMP-003 |
| RF-009 | RN-026 | ENT-011, ENT-012 | FL-001 | US-004, US-007, US-008 | CA-009, CA-011, CA-017, CA-021, CA-031, CA-056, CA-059 | — | getDashboardAggregated, listGroups, createGroup, deleteGroup, findRespondent, getIndividualRecord | CMP-Dashboard | IMP-004 |
| RF-010 | RN-027, RN-030, RN-031 | ENT-009, ENT-013, ENT-018, ENT-019, ENT-023, ENT-025, ENT-026 | FL-001, FL-003 | US-005, US-009 | CA-021, CA-022, CA-023, CA-024, CA-056 | TS-005, TS-008 | exportData, getExport, createDataSubjectRequest, listDataSubjectRequests, getDataSubjectRequest, executeDataSubjectRequest, cancelDataSubjectRequest, listAuditEvents | CMP-LGPD | IMP-004 |
| RF-011 | RN-017, RN-018, RN-019, RN-036, RN-037, RN-038, RN-047, RN-049, RN-050 | ENT-004, ENT-005, ENT-006, ENT-007, ENT-008, ENT-024, ENT-031 | FL-004 | US-006, US-011 | CA-045, CA-046, CA-047, CA-048, CA-049 | — | importForm, listFormImports, getFormImport, extractFormStructure (interna) | CMP-Forms | IMP-006 |
| RF-012 | RN-020, RN-030, RN-037, RN-051 | ENT-009, ENT-010, ENT-011, ENT-013, ENT-026 | FL-001 | US-009, US-012 | CA-021, CA-050, CA-051 | — | exportData, getExport | CMP-LGPD | IMP-007 |
| RF-013 | RN-016, RN-017, RN-036, RN-038, RN-041, RN-045, RN-049, RN-050, RN-052 | ENT-004, ENT-006, ENT-007, ENT-009, ENT-010, ENT-025, ENT-031 | FL-001, FL-002 | US-001, US-003, US-011 | CA-052, CA-053, CA-054, CA-055, CA-057, CA-058 | — | uploadImages, identifyApplication, addApplicationPages, getPageImage, getItemImage, openReview, getApplication, saveReview, retryReading, confirmApplication, attachSignaturePage, createVersion, updateVersion, publishVersion, generatePdf, importForm, processAIReading (interna) | CMP-Upload, CMP-MotorIA, CMP-Forms | IMP-008 |
| RF-014 | RN-009, RN-028, RN-030, RN-037, RN-045, RN-047, RN-049, RN-051 | ENT-008, ENT-011, ENT-025 | FL-001, FL-002 | US-013 | CA-059, CA-060 | — | createVersion, updateVersion, generatePdf, importForm, uploadImages, addApplicationPages, attachSignaturePage, getApplication, openReview, getItemImage, saveReview, confirmApplication, reopenApplication, exportData, getIndividualRecord, executeDataSubjectRequest, processAIReading (interna) | CMP-Forms, CMP-Upload, CMP-MotorIA, CMP-Revisao, CMP-LGPD | IMP-009 |
| RF-015 | RN-033, RN-036, RN-037, RN-038, RN-041, RN-045, RN-052 | ENT-004, ENT-005, ENT-006, ENT-010, ENT-011, ENT-013, ENT-025 | FL-001, FL-002 | US-014 | CA-061, CA-062, CA-063 | — | createProject, createForm, createVersion, publishVersion, generatePdf, uploadImages, identifyApplication, addApplicationPages, attachSignaturePage, getPageImage, getItemImage, processAIReading (interna) | CMP-Projects, CMP-Forms, CMP-Upload, CMP-MotorIA | IMP-010 |

8.2 Catálogo de Erros (ERR)

Formato Problem Details (RFC 9457). Mensagens exatas em pt-BR. Sem stack trace ou detalhes internos. O sistema NUNCA revela se um recurso existe quando há suspeita de violação de isolamento (retorna 404 genérico).

| err_id | codigo | http_status | quando_ocorre | mensagem_ao_usuario | log_gerado | estado_resultante | requisitos | status |
|---|---|---|---|---|---|---|---|---|
| ERR-001 | VALIDATION_FAILED | 400 | Campo obrigatório ausente, formato inválido, regra de negócio violada (inclusive `formulario_id` ausente ou de outro projeto no envio, DEC-215; código de projeto, de formulário ou número de versão acima do limite, DEC-217, DEC-218; regra de salto inválida, DEC-095; sensibilidade `identificacao` fora da RN-047, DEC-097; violação da RN-050; pergunta que não cabe na página, DEC-143, exceto no papel antigo, DEC-181; `coleta_fim` antes de `coleta_inicio`, DEC-137; falta da declaração `sem_dados_reais`, DEC-133) ou upload, criação ou importação de formulário em projeto arquivado (CA-027, DEC-146); no papel antigo: respondente fora dos candidatos de mesmo nome ou `respondente_id` fora do caso permitido (DEC-176), `nao_consta` fora do permitido (DEC-179), data do envio futura (DEC-182), `total_paginas` fora do papel antigo ou menor que a maior página das perguntas (ENT-006); no complemento (CHG-018): `com_complemento` fora do permitido (RN-047, DEC-202), `corrigir` acima de 200 caracteres (§5.4) e ação diferente de `nao_se_aplica` no complemento de opção não marcada (DEC-205). | Revise os campos destacados e tente novamente. | warn: validation_failed (sem dados pessoais) | Nada é gravado | RF-003, RF-004, RF-006, RF-011, CA-027, CA-047, CA-048, CA-049, RF-008, RF-013, CA-054, CA-056, CA-057, RF-014, CA-059, RF-015, CA-061, CA-063 | ativo |
| ERR-002 | RESOURCE_NOT_FOUND | 404 | Recurso inexistente ou de outro tenant. | O recurso solicitado não existe ou você não tem acesso. | warn: resource_not_found_or_out_of_scope (auditoria acionada) | Nada é gravado | RN-002, CA-012 | ativo |
| ERR-003 | AI_QUOTA_EXCEEDED | — | Teto de custo de IA do tenant atingido; aviso exibido na tela (estado assíncrono, não é resposta HTTP de erro). | O processamento está pausado: o teto mensal de custo de IA foi atingido. | info: ai_quota_exceeded (tenant_id) | Aplicação ou importação de formulário em `aguardando_cota` | RF-007, RF-011, CA-030, CA-047, DEC-035 | ativo |
| ERR-004 | INVALID_QR_CODE | 400 | QR ilegível, ausente ou no formato anterior à v2.9 (DEC-218) sem versão escolhida no envio (DEC-169); número de páginas diferente do da versão; página não reconhecida pela identificação ou divergente do QR (DEC-171); ou páginas faltantes, repetidas ou excedentes. | Não foi possível identificar o formulário nesta página. Informe manualmente. | warn: qr_invalid_or_missing | Aplicação em `identificacao_pendente` (no `attachSignaturePage`, permanece em `sem_assinatura`; no `identifyApplication` de aplicação antiga sem formulário, grava o `formulario_id`, DEC-229) | RF-006, RF-008, RF-013, CA-004, CA-013, CA-040, CA-044, CA-052, CA-053 | ativo |
| ERR-005 | RESERVATION_EXPIRED | 409 | Descontinuado pela CHG-002: duplicava o ERR-043 (também descontinuado, CHG-011). | Descontinuado. | — | — | CHG-002 | descontinuado |
| ERR-006 | MISSING_MANDATORY_FIELDS | 400 | Tentativa de concluir aplicação sem nome, data de nascimento, CPF válido, data ou local, ou com um deles ilegível, rasurado ou marcado como não se aplica (DEC-020, DEC-079); na versão de papel antigo, só nome, data ou local (DEC-172, DEC-176). A mensagem cita os cinco campos também no papel antigo. | A aplicação não pode ser concluída sem nome, data de nascimento, CPF válido, data e local da aplicação. | warn: missing_mandatory_fields | CPF ausente ou inválido: sucesso com este aviso e estado `aguardando_cpf`; demais campos: nada é gravado, permanece em `em_revisao` | RF-005, RF-008, CA-032, CA-054 | ativo |
| ERR-007 | FILE_REJECTED | 400 | Descontinuado pela CHG-002: duplicava o ERR-029. | Descontinuado; usar ERR-029. | — | — | CHG-002 | descontinuado |
| ERR-008 | ACCESS_DENIED_INDIVIDUAL | 403 | Descontinuado pela CHG-011: sem concessões de acesso individual (DEC-109). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-009 | VERSION_IMMUTABLE | 409 | Tentativa de alterar perguntas de uma versão já publicada. | Versões publicadas são imutáveis. Crie uma nova versão em rascunho. | info: immutable_version_attempt | Nada é gravado | RF-004, CA-001, RN-042 | ativo |
| ERR-010 | RATE_LIMIT_EXCEEDED | 429 | Mais de 100 req/min por usuário ou 20 req/min por IP em rotas públicas. | Muitas tentativas. Aguarde alguns minutos antes de tentar novamente. | warn: rate_limit_exceeded (ip/user) | Nada é gravado | RF-002, Bloco P.7 | ativo |
| ERR-011 | TOKEN_INVALID | 400 | Descontinuado pela CHG-011: sem convite nem link de recuperação (DEC-108). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-012 | MFA_INVALID | 400 | Descontinuado pela CHG-011: sem MFA (DEC-108). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-013 | INVALID_CREDENTIALS | 401 | E-mail ou senha incorretos, conta inexistente ou inativa, ou tenant inativo (DEC-070) — mesma resposta. | Credenciais inválidas. | warn: login_failed (HMAC do e-mail) | Contagem de falhas atualizada | RF-002, CA-026 | ativo |
| ERR-014 | LOGIN_THROTTLED | 429 | 5 falhas em 15 minutos para o mesmo e-mail, exista ou não a conta. | Muitas tentativas. Tente novamente em 15 minutos. | warn: login_throttled (HMAC do e-mail) | Bloqueio de 15 minutos | RF-002, CA-026 | ativo |
| ERR-015 | SESSION_REQUIRED | 401 | Sessão ausente, expirada (30 min de inatividade ou 24 h) ou encerrada. | Sua sessão expirou. Entre novamente. | info: session_required | Nada é gravado | RF-002, CA-026 | ativo |
| ERR-016 | FORBIDDEN | 403 | Token CSRF ausente ou inválido. | Você não tem permissão para realizar esta ação. | warn: forbidden_action | Nada é gravado | RF-001, RF-002 | ativo |
| ERR-017 | STALE_VERSION | 412 | If-Match diferente do ETag atual (edição concorrente); If-Match ausente é erro de validação (ERR-001). | Os dados foram alterados por outra pessoa. Recarregue e tente novamente. | info: stale_etag | Nada é gravado | RF-008, CA-043 | ativo |
| ERR-018 | INVALID_STATE | 409 | Ação não permitida no estado atual do recurso (FL-001, `addApplicationPages` em aplicação antiga sem formulário, DEC-226, pedido do titular já executado, ação de revisão sobre item em `aguardando_condicao`, inclusive o de complemento, FL-002). | Esta ação não é permitida no estado atual. | info: invalid_state_transition | Nada é gravado | RF-008, RF-010, RF-014, RF-015, CA-059, CA-061 | ativo |
| ERR-019 | IDEMPOTENCY_CONFLICT | 409 | Chave de idempotência reutilizada com conteúdo diferente. | Esta solicitação já foi enviada com outros dados. Gere uma nova solicitação. | warn: idempotency_conflict | Nada é gravado | RF-006, Bloco P.8 | ativo |
| ERR-020 | DEPENDENCY_UNAVAILABLE | 503 | Pasta de imagens, antimalware ou outro serviço local indisponível após as retentativas. | Serviço temporariamente indisponível. Tente novamente em instantes. | error: dependency_unavailable (serviço) | Nada é gravado | RF-004, RF-006 | ativo |
| ERR-021 | SESSION_LIMIT_REACHED | 409 | Usuário já tem 3 sessões ativas (Bloco P P.2). | Você já tem 3 sessões ativas. Saia em outro dispositivo ou aguarde até 30 minutos sem uso para entrar. | info: session_limit_reached | Nenhuma sessão nova | RF-002 | ativo |
| ERR-022 | ITEMS_UNRESOLVED | 400 | Tentativa de concluir com itens em `pendente_leitura`, `aguardando_condicao` ou `a_revisar`. | Ainda há campos a revisar nesta aplicação. | info: items_unresolved | Nada é gravado | RF-008, FL-002 | ativo |
| ERR-023 | EMAIL_UNAVAILABLE | 400 | Descontinuado pela CHG-011: sem criação de usuários (DEC-109). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-024 | QUERY_REFUSED | 400 | Descontinuado pela CHG-011: sem k-anonimato (DEC-110). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-029 | FILE_REJECTED_LIMIT | 400 | Upload ou importação de formulário recusados. Motivos exatos: "excede o limite de 20 MB"; "excede o limite de 50 páginas"; "tipo de arquivo não permitido"; "risco de segurança detectado". No envio de imagens (`uploadImages`, `addApplicationPages` e `attachSignaturePage`), a resposta traz também a posição do arquivo recusado no envio (`posicao`, a partir de 1), nunca o nome do arquivo (RN-028, DEC-198); na importação de formulário (`importForm`), não traz `posicao`. | Arquivo recusado: [motivo]. | warn: file_rejected (motivo, posicao) | Nada é gravado | RF-006, RF-011, CA-029, CA-047, RN-040 | ativo |
| ERR-036 | MISSING_PUBLISH_FIELDS | 400 | Tentativa de publicar versão sem campos obrigatórios (nome, nascimento, CPF, data, local) ou com pergunta fora da estrutura da RN-047 ou que não cabe na sua página (DEC-143, exceto no papel antigo, DEC-181); `campos` traz os campos que faltam e os códigos das perguntas com problema (DEC-096). | Publicação recusada: faltam [lista dos campos]. | warn: missing_publish_fields | Versão permanece em `rascunho` | RF-004, CA-036, RN-017 | ativo |
| ERR-039 | QR_INVALID_CONTEXT | 400 | QR com total de páginas diferente do da versão (DEC-218), ou QR, versão escolhida no envio (`uploadImages`) ou versão informada no `identifyApplication` ou no `addApplicationPages` aponta para versão inexistente, não publicada, de formulário diferente do da aplicação (DEC-221), de outro tenant ou de projeto diferente do envio, ou diferente da do QR legível, ou versão de papel antigo em aplicação com folha de QR legível (DEC-100, DEC-169, DEC-180, DEC-184); no `addApplicationPages`, a versão de outro formulário recusa o pedido (DEC-225); no `attachSignaturePage`, a página 1 com QR legível de outra versão do formulário ou com `Y` diferente do total (DEC-227). A mensagem fala em QR também quando o erro é a versão escolhida. | QR code inválido para o contexto atual. Informe manualmente. | warn: qr_invalid_context | Aplicação em `identificacao_pendente`; no `addApplicationPages` com versão de outro formulário e no `attachSignaturePage`, nada é gravado e a aplicação não muda; a versão inválida não é gravada (DEC-232) e a de outro tenant é auditada (DEC-233) | RF-006, RF-008, RF-013, RF-015, CA-039, CA-044, CA-052, CA-061, DEC-221 | ativo |
| ERR-041 | AI_READING_FAILED | — | A identificação da página (RN-052) ou a leitura falhou em 3 tentativas automáticas consecutivas (estado assíncrono, exibido na fila). | Erro de leitura. O digitalizador pode mandar ler de novo. | error: ai_reading_failed (3 retries) | Aplicação em `erro_leitura` | RF-007, RF-013, CA-041, CA-055 | ativo |
| ERR-043 | RESERVATION_CONFLICT | 409 | Descontinuado pela CHG-011: sem reserva de aplicação (DEC-112). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-044 | FORM_IMPORT_FAILED | — | A importação de formulário não reconheceu nenhuma pergunta, ou 3 chamadas à IA falharam na mesma página (estado assíncrono, exibido na consulta da importação). | Não foi possível ler o formulário. Confira o arquivo e tente de novo, ou cadastre as perguntas à mão. | error: form_import_failed (motivo, página) | Importação em `falhou`; nada é criado | RF-011, CA-047 | ativo |
| ERR-045 | FORM_SELECTION_MISMATCH | 409 | O QR legível de alguma folha do envio (`uploadImages`), da folha acrescentada (`addApplicationPages`) ou da página 1 assinada (`attachSignaturePage`) é de projeto ou formulário diferente do escolhido no envio (DEC-215, DEC-222); com várias folhas divergentes, vale a primeira, na ordem do envio, e o ERR-029 vem antes (DEC-224). | O QR desta digitalização é de outro projeto ou formulário. Selecione o projeto e o formulário corretos e envie de novo. | info: form_selection_mismatch (códigos lidos, sem imagem nem nome de arquivo) | Nada é gravado: no envio, nenhuma aplicação é criada; nos demais, a aplicação fica como estava | RF-006, RF-008, RF-013, RF-015, RN-052, CA-044, CA-052, CA-061 | ativo |

9. Questões em aberto (Q)

Q-001 a Q-004 foram incorporadas na v1.2. Q-005 a Q-011, abertas pela CHG-002, foram respondidas em 27/10/2026 e incorporadas na v1.4 como DEC-054 a DEC-060 (CHG-003). Q-012 a Q-020, abertas pela CHG-004, foram respondidas em 28/10/2026 (recomendações aceitas) e incorporadas na v1.7 como DEC-064 a DEC-072 (CHG-005).

| id | data | pergunta | por_que_importa | opcao_a | opcao_b | opcao_c | recomendacao | texto_provisorio (definitivo quando respondida) | resposta | status | relacionados |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Q-001 | 24/10/2026 | Provedor de IA e Transferência Internacional | Impacto em conformidade LGPD (Art. 33) e risco jurídico | A: Bloquear desenvolvimento até o parecer | B: Desenvolver com dados sintéticos e bloquear apenas a produção | — | B | A transferência internacional de dados para o provedor de IA está condicionada ao parecer jurídico (GX-001). O desenvolvimento prosseguirá com dados sintéticos. | Concordo. Resolvemos isso depois. | respondida | RF-007, RNF-011, GX-001 |
| Q-002 | 24/10/2026 | Retenção de dados e backups | Impacto em custo de armazenamento e conformidade com direito à eliminação | A: 30 dias | B: 90 dias | C: Indeterminado até o jurídico | B | Backups serão retidos por no máximo 90 dias. A retenção de dados de produção em ambiente ativo aguarda definição do parecer jurídico (GX-001). | Aceito sua sugestão. | respondida | RNF-008, CA-023, DEC-033 |
| Q-003 | 24/10/2026 | Teto de Custo de IA na v1 | Impacto direto em custo operacional e comportamento da fila de processamento | A: Sem teto | B: R$ 500/mês | C: R$ 1.000/mês | B | O teto provisório de custo de IA é de R$ 500,00/mês por tenant para a v1, acionando a fila de espera (CA-030) ao ser atingido. | Aceito sua sugestão. | respondida | RF-007, CA-030, DEC-035 |
| Q-004 | 24/10/2026 | Ambiente de Nuvem | Impacto em arquitetura, custo e soberania de dados | A: AWS sa-east-1 | B: Azure Brazil South | C: Deixar para a Fase 3 | C | A definição da nuvem (AWS sa-east-1 ou Azure Brazil South) será formalizada via ADR na Fase 3, garantindo a soberania de dados no Brasil. | Aceito sua sugestão. | respondida | RNF-011, DEC-036 |
| Q-005 | 27/10/2026 | Identificação do usuário no login | O e-mail é único por tenant, mas o login não informa o tenant: o mesmo e-mail em dois tenants torna o login ambíguo | A: e-mail único global (um e-mail pertence a um único tenant) | B: e-mail único por tenant, com identificador do tenant no login | — | A | O e-mail do usuário é único em toda a plataforma; um e-mail pertence a um único tenant. | Aceito a recomendação (Carlos Yano, 27/10/2026). | respondida | RF-001, RF-002, ENT-002 |
| Q-006 | 27/10/2026 | Valor padrão de grupo_minimo | Com padrão 1, filtros estreitos expõem dados de saúde de idosos a analistas sem acesso individual (Risco 2, seção 2.8) | A: manter padrão 1 (DEC-023) | B: padrão 5, podendo ser reduzido por projeto com auditoria | C: padrão 5 com piso de 3 | B | O padrão de grupo_minimo é 5, podendo ser reduzido por projeto com auditoria. | Aceito a recomendação (Carlos Yano, 27/10/2026). | respondida | DEC-023, RN-026, CA-010 |
| Q-007 | 27/10/2026 | Origem do conjunto-ouro | Caligrafia real de pessoas 60+ é dado pessoal (bloqueado por GX-001); caligrafia sintética não representa o público; sem conjunto-ouro não há como escolher provedor nem medir a DEC-004 | A: voluntários 60+ preenchem formulários com dados fictícios, com termo próprio | B: usar dados reais só após GX-001 | C: formulários preenchidos digitalmente (sintéticos) | A | O conjunto-ouro é formado por formulários preenchidos à mão por voluntários 60+ com dados fictícios, sob termo de participação próprio, sem dado pessoal real. | Aceito a recomendação (Carlos Yano, 27/10/2026). | respondida | DEC-004, DEC-028, RN-046, GX-001 |
| Q-008 | 27/10/2026 | Leitura de texto livre | Texto livre não tem schema que permita validar o valor, então a regra "valor dentro do schema" não protege contra erro silencioso | A: texto_livre sempre vai para revisão | B: segue a regra geral de confiança | C: texto_livre não é lido por IA; o digitalizador digita | A | Itens do tipo `texto_livre` sempre vão para `a_revisar`. | Aceito a recomendação (Carlos Yano, 27/10/2026). | respondida | RF-007, FL-002, DEC-010 |
| Q-009 | 27/10/2026 | Período e moeda do teto de custo de IA | O teto é em reais e o provedor cobra em dólar; "mês" pode ser civil ou janela móvel | A: mês civil (America/Sao_Paulo) e cotação PTAX do dia | B: janela móvel de 30 dias | C: mês civil (America/Sao_Paulo) e cotação fixa configurada pela plataforma a cada mês | C | O teto vale por mês civil no fuso America/Sao_Paulo; o custo em dólar é convertido por cotação fixa configurada pela plataforma a cada mês. | Aceito a recomendação (Carlos Yano, 27/10/2026). | respondida | DEC-035, RN-036, CA-030 |
| Q-010 | 27/10/2026 | Quem altera limite_confianca, custo_ia_teto e retencao_dias | RN-008 exige forma de alteração definida; na v1 não há gestão de tenant por tela (DEC-017) | A: administrador da plataforma, por script, com auditoria | B: administrador do tenant, pela tela | C: teto e retenção pelo administrador do tenant; limite pela plataforma | A | Os três parâmetros são alterados pelo administrador da plataforma, por script, com auditoria (seção 2.9). | Aceito a recomendação (Carlos Yano, 27/10/2026). | respondida | RN-008, DEC-017, DEC-018 |
| Q-011 | 27/10/2026 | Perfil analista_individual × concessão de acesso individual | A REQ tem o perfil `analista_individual` (ENT-003) e a concessão por projeto com 90 dias (ENT-015, DEC-031), sem dizer se ambos são exigidos | A: exige o perfil e uma concessão vigente no projeto | B: basta a concessão vigente (o perfil deixa de existir) | C: basta o perfil | A | O acesso individual exige o perfil `analista_individual` e uma concessão vigente para o projeto. | Aceito a recomendação (Carlos Yano, 27/10/2026). | respondida | RF-001, RF-009, DEC-031, CA-025 |
| Q-012 | 28/10/2026 | Vínculo do respondente quando a assinatura está ausente | DEC-006 tira do relatório a aplicação sem assinatura; criar ou alterar cadastro do respondente sem evidência de consentimento conflita com RN-041 | A: vincular e alterar cadastro só ao chegar em `concluida` (inclusive depois de anexar a assinatura) | B: vincular já ao entrar em `sem_assinatura` | — | A | O respondente só é criado ou vinculado, e o cadastro só é alterado, quando a aplicação chega a `concluida`. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | RF-005, RF-008, DEC-006, RN-041 |
| Q-013 | 28/10/2026 | Criação de usuário com e-mail já usado em outro tenant | Com e-mail único global (DEC-054), qualquer resposta diferente do sucesso revela que o e-mail é usuário de outro cliente | A: erro genérico (ERR-023 (descontinuado na v2.1)), igual para qualquer tenant, auditado e sujeito a rate limit (risco residual aceito) | B: resposta igual ao sucesso, sem enviar convite | — | A | A criação com e-mail já existente na plataforma devolve ERR-023, com a mesma resposta para qualquer tenant, auditada e limitada por rate limit. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | RF-001, DEC-054, RN-002 |
| Q-014 | 28/10/2026 | Leitura de texto curto | `texto_curto` também não tem schema que valide o conteúdo, além do tamanho; pode ser confirmado automaticamente com erro ou instrução injetada | A: `texto_curto` sempre vai para revisão (como DEC-057) | B: segue a regra geral de confiança | — | A | Itens do tipo `texto_curto` sempre vão para `a_revisar`. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | RF-007, FL-002, DEC-057 |
| Q-015 | 28/10/2026 | Dedução de célula oculta por subtração | No gráfico cruzado (CA-017), a célula oculta pode ser obtida subtraindo as visíveis da linha ou do total sem cruzamento | A: supressão complementar na consulta (ocultar outra célula da linha e da coluna e o marginal quando necessário) | B: aceitar formalmente o risco e ampliar o Risco 2 | — | A | A consulta agregada aplica supressão complementar para que nenhuma célula oculta possa ser deduzida por subtração dentro da mesma consulta ou pela consulta sem cruzamento. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | RF-009, DEC-045, DEC-055, CA-010, CA-017 |
| Q-016 | 28/10/2026 | "Todos os projetos" é vínculo dinâmico? | RN-004: o padrão é "todos os projetos"; não diz se inclui projetos criados depois | A: dinâmico (inclui projetos futuros) | B: fixado na criação do usuário | — | A | O vínculo padrão "todos os projetos do tenant" inclui os projetos criados depois. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | RN-004, RF-001, CA-016 |
| Q-017 | 28/10/2026 | Retenção dos arquivos de exportação | Exportação linha a linha guarda dados pessoais e de saúde em repouso, sem prazo | A: 7 dias | B: 30 dias | C: 24 horas | A | Arquivos de exportação são apagados 7 dias após a geração. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | RN-030, RF-010 |
| Q-018 | 28/10/2026 | Efeito de tenant inativo | `Tenant.ativo` existe, mas sem regra; a gestão é por script (DEC-017) | A: login recusado (ERR-013), jobs do tenant suspensos, dados preservados e expurgos legais mantidos | B: só login recusado | — | A | Tenant inativo: login recusado com ERR-013, jobs do tenant suspensos, dados preservados e expurgos por eliminação e retenção mantidos. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | DEC-017, ENT-001 |
| Q-019 | 28/10/2026 | Dedução por diferença entre filtros | Dois filtros que diferem em uma só pessoa (ex.: idade ≥ 65 e idade ≥ 66) revelam as respostas dela por subtração, mesmo com todas as células acima do mínimo | A: filtros de idade só em faixas fixas (60-64, 65-69, ..., 90+) e mínimo aplicado também ao complemento do filtro | B: aceitar formalmente o risco e reescrever o Risco 2 e a RNF-004 | — | A | Filtros de idade só em faixas fixas de 5 anos (90+ na última); uma consulta é recusada quando o complemento do filtro dentro do projeto tem menos respondentes que o mínimo. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | RF-009, RNF-004, DEC-055, CA-009 |
| Q-020 | 28/10/2026 | CPF completo no pedido de acesso do titular | DEC-021 lista portabilidade e linha a linha, mas não o pedido de acesso (CA-024) | A: incluir o acesso entre as exceções (o arquivo é do próprio titular) | B: mascarar no acesso | — | A | No pedido de acesso, o CPF do próprio titular aparece completo, com auditoria. | Aceito a recomendação (Carlos Yano, 28/10/2026). | respondida | DEC-021, CA-024, RN-013 |
| Q-021 | 29/10/2026 | Campo lido em branco fora de regra de salto | A IA pode ler um campo como em branco com confiança alta; sem regra, ele seria confirmado automaticamente como vazio e um campo preenchido de leve passaria despercebido (M-N2) | A: campo lido em branco vai sempre para `a_revisar` | B: segue a regra geral de confiança (confirmado automaticamente se acima do limite) | — | A | Campo lido em branco que não é destino de regra de salto vai para `a_revisar`; o revisor marca `em_branco`. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-007, FL-002, RN-020 |
| Q-022 | 29/10/2026 | Filtros em `escala` e em `multipla_escolha` | Intervalos livres em escala (ex.: 3 a 3, 3 a 4) permitem recortes estreitos parecidos com os de idade; em múltipla escolha não está definido se o filtro é "marcou a opção" ou "marcou só a opção" (M-N4) | A: escala filtrada só por um valor ou por faixas definidas no formulário; múltipla escolha filtra por "marcou a opção" (contém) | B: intervalos livres em escala, protegidos só pelo mínimo do complemento (DEC-071) | — | A | Filtro em escala por valor único; múltipla escolha filtra por "marcou a opção"; o mínimo do complemento (DEC-071) vale para ambos. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-009, RNF-004, DEC-071 |
| Q-023 | 29/10/2026 | Complemento do filtro sem filtro, com vários projetos e com período | A DEC-071 manda recusar a consulta quando o complemento do filtro tem menos respondentes que o mínimo, mas não diz como calcular o complemento nesses três casos (M-N5) | A: sem filtro não há complemento; com vários projetos o complemento é verificado em cada projeto com o maior mínimo (DEC-055); com período o complemento é calculado dentro do mesmo período | B: recusar filtro em consulta com mais de um projeto | — | A | Sem filtro, a regra do complemento não se aplica; com vários projetos, vale em cada projeto com o maior mínimo; com período, o complemento é calculado no mesmo período. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-009, DEC-055, DEC-071 |
| Q-024 | 29/10/2026 | Valores lidos de aplicação descartada | O descarte apaga as imagens, mas os valores lidos pela IA ficam guardados sem prazo, inclusive de pessoa que pode ter sido agrupada por engano (M-N8) | A: apagar os valores dos itens no descarte, mantendo só a auditoria | B: manter os valores até o prazo de retenção do tenant (RN-030) | — | A | No descarte, os valores lidos (`valor_ia`, `valor_final`) são apagados junto com as imagens; fica só a auditoria. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-008, CA-033, RN-030 |
| Q-025 | 29/10/2026 | Respondente sem aplicação após reabertura | Ao reabrir e revincular uma aplicação, o respondente anterior pode ficar sem nenhuma aplicação concluída, guardando nome e CPF sem finalidade (M-08 da REV-REQ-007, reclassificado pela M-N7) | A: respondente sem aplicação concluída é anonimizado como na eliminação, sem entrar na lista de eliminações | B: manter o cadastro até o prazo de retenção | — | A | Respondente que fica sem aplicação concluída após a reabertura é anonimizado (registrado na ListaEliminacoes só para reaplicação após restore), com auditoria. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-005, CA-042, RN-030 |
| Q-026 | 29/10/2026 | Campo obrigatório ilegível, rasurado ou não se aplica | A DEC-020 exige os 5 campos para concluir, mas não diz o que fazer quando um deles está ilegível ou rasurado no papel (M-18 da REV-REQ-007, reclassificado pela M-N7) | A: a conclusão fica bloqueada (ERR-006) até o digitalizador informar o valor, obtido com o aplicador ou o respondente | B: permite concluir com o campo marcado, sem vincular o respondente | — | A | Nome, data de nascimento, data ou local marcados como ilegível, rasurado ou não se aplica bloqueiam a conclusão (ERR-006) até o valor ser informado; CPF ilegível segue para `aguardando_cpf` (FL-001). | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-008, DEC-020, CA-032 |
| Q-027 | 29/10/2026 | Concessão individual a usuário sem perfil de analista | Hoje nada impede conceder acesso linha a linha a um usuário que não tem perfil para ver dados individuais (B-N7) | A: recusar a concessão se o usuário não tiver o perfil exigido | B: permitir; a concessão só vale se o perfil for dado depois | — | A | Concessão individual só para usuário com o perfil exigido; caso contrário é recusada. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-001, CA-025 |
| Q-028 | 29/10/2026 | Idade abaixo de 60 nos filtros | As faixas da DEC-071 começam em 60-64; respondentes com menos de 60 não têm faixa definida (B-N6) | A: criar a faixa "menos de 60" | B: respondentes com menos de 60 ficam fora dos filtros de idade | — | A | Há a faixa "menos de 60", sujeita ao mesmo mínimo das demais. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-009, DEC-071 |
| Q-029 | 29/10/2026 | Novo cadastro de MFA após reset | Após o reset pelo administrador, quem tiver só a senha cadastra o próprio MFA antes do titular (risco residual da correção A-01) | A: após o reset, o novo cadastro exige link de uso único enviado por e-mail, como no convite | B: manter o cadastro no próximo login e aceitar o risco | — | A | Após o reset de MFA, o novo cadastro só começa por link de uso único enviado ao e-mail do usuário, válido por 24 horas. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-001, RF-002, CA-037b, CA-026b |
| Q-030 | 29/10/2026 | Perfil exigido para a concessão individual | A DEC-060 exige o perfil `analista_individual` para o acesso individual, mas a DEC-080, o RF-001 e o CA-025 recusam a concessão só a quem não tem o perfil `analista`; com `analista`, a concessão ficaria sem efeito | A: exigir `analista_individual` (coerente com a DEC-060) | B: exigir `analista` | — | A | A concessão individual só é aceita para usuário com o perfil `analista_individual`; caso contrário, ERR-018. | Aceito a recomendação (Carlos Yano, 29/10/2026). | respondida | RF-001, CA-025, DEC-060, DEC-080 |
| Q-031 | 03/11/2026 | Frequência, mídia e guarda do backup do notebook | Com tudo num só notebook (DEC-107), o backup é a única proteção contra perda; a frequência define quantos dias de digitação se perdem | A: diário, em disco externo cifrado guardado longe do notebook | B: semanal, em disco externo cifrado | C: diário, em nuvem cifrada pela própria usuária | A | Backup diário, cifrado, em disco externo guardado longe do notebook; retenção de 90 dias (DEC-033); teste de restauração a cada mês | Aceito a recomendação, backup diário (Carlos Yano, 03/11/2026). Incorporada como DEC-117. | respondida | DEC-107, DEC-033, DEC-117, RNF-008 |
| Q-032 | 05/11/2026 | Até quando o CPF completo aparece depois de `openReview` | A marca da abertura nunca era apagada: a aplicação, mesmo concluída, mostrava o CPF completo sem nova auditoria (revisão focada do IMP-003, F-01) | A: só enquanto a aplicação está em revisão; conclusão, descarte e reabertura apagam a marca | B: até o fim da sessão | — | A | O CPF completo aparece só na revisão aberta, com cada abertura auditada, e some ao concluir | Concordo com a recomendação (Carlos Yano, 05/11/2026). Incorporada como DEC-126. | respondida | RN-013, DEC-112, DEC-126 |
| Q-033 | 05/11/2026 | Confirmação automática antes da calibração da confiança | A confiança é a declarada pelo modelo, sem calibração (DEC-047); erro com confiança alta passaria sem revisão (revisão focada do IMP-003, F-05) | A: tudo à revisão humana até o conjunto-ouro calibrar | B: confirmar acima de 0,90 já | — | A | Nenhum item é confirmado automaticamente até a calibração | Concordo com a recomendação (Carlos Yano, 05/11/2026). Incorporada como DEC-127. | respondida | DEC-028, DEC-047, DEC-127 |
| Q-034 | 05/11/2026 | `confirmar` com valor em branco ou fora do schema | A FL-002 não dizia se `confirmar` valida o valor lido; um valor inválido confirmado entraria nos dados (revisão focada do IMP-003, F-06) | A: recusar e exigir a correção ou outra marcação | B: aceitar o valor lido | — | A | `confirmar` só aceita valor preenchido e no schema | Concordo com a recomendação (Carlos Yano, 05/11/2026). Incorporada como DEC-128. | respondida | FL-002, CA-006, DEC-128 |
| Q-035 | 05/11/2026 | Número de chamadas antes de `erro_leitura` | A REQ diz "falhou em 3 tentativas" e "retentativas em 1, 2 e 4 s", que somam 4 chamadas (revisão focada do IMP-003, F-11) | A: 3 chamadas no total | B: 1 chamada e 3 retentativas | — | A | 3 chamadas no total, com retentativas em 1 e 2 s | Concordo com a recomendação (Carlos Yano, 05/11/2026). Incorporada como DEC-129. | respondida | CA-041, ERR-041, DEC-129 |
| Q-036 | 05/11/2026 | Correção de perspectiva antes do recorte | A DEC-048 pede correção de perspectiva antes do recorte; a implementação (DEC-124) só confere se os 4 marcadores aparecem. No scanner de mesa a página sai reta; na foto de celular, um recorte deslocado pode levar nome ou CPF junto com uma pergunta de saúde (RN-038; revisão focada do IMP-003, F-13) | A: exigir os 4 marcadores dentro de uma margem e mandar à revisão, sem leitura, a página fora dela | B: corrigir a perspectiva pelos 4 marcadores antes de recortar (DEC-048) | C: A agora e B quando a digitalização por celular entrar | C | Até a resposta, vale a DEC-124: marcadores conferidos, sem correção de perspectiva; a digitalização é feita no scanner de mesa | Adiada pelo responsável (Carlos Yano, 05/11/2026): no scanner é fácil garantir a página reta; decidir quando a digitalização por celular entrar, antes do piloto. Superada em 06/11/2026 (CHG-017): o responsável escolheu a localização das perguntas pela IA em toda página (DEC-170); os recortes saem das regiões que a IA indica na própria imagem, sem mapa fixo a corrigir, e os marcadores deixam de ser exigidos (DEC-169). | respondida | DEC-048, DEC-124, RN-038 |
| Q-037 | 05/11/2026 | Que formulário pode ser enviado à importação | A página inteira vai ao provedor de IA; preenchida com dados reais, levaria nome, CPF e saúde juntos (RN-038, RN-039, GX-001) | A: só em branco ou com dados fictícios, com declaração a cada envio | B: também preenchido com dados reais | — | A | Só formulário em branco ou com dados fictícios, declarado a cada envio | Em branco ou sintético (Carlos Yano, 05/11/2026). Incorporada como DEC-133. | respondida | RN-038, RN-049, DEC-133 |
| Q-038 | 05/11/2026 | Os 5 campos obrigatórios no formulário importado | O Change Request manda injetar sempre; se o original já tem "Nome" ou "CPF", o PDF sairia com perguntas repetidas | A: reconhecer no original e injetar o que faltar | B: sempre injetar os 5 | — | A | Reconhecer no original e injetar só o que faltar | Reconhecer, senão injetar (Carlos Yano, 05/11/2026). Incorporada como DEC-134. | respondida | RN-017, RN-050, DEC-134 |
| Q-039 | 05/11/2026 | Os 5 campos obrigatórios no rascunho criado à mão | Hoje a RN-017 só recusa a publicação (ERR-036); injetar muda o cadastro manual também | A: injetar em todo rascunho novo, sem permitir remoção | B: injetar só na importação | — | A | Todo rascunho novo sem cópia nasce com os 5 campos, que não podem ser removidos | Sim, em todo rascunho (Carlos Yano, 05/11/2026). Incorporada como DEC-135. | respondida | RN-017, RN-050, DEC-135 |
| Q-040 | 05/11/2026 | Tipos de arquivo e custo da importação | O Change Request cita TIFF, que o upload não aceita, e não diz se a importação consome o teto de IA | A: JPEG, PNG e PDF; conta no teto | B: inclui TIFF; conta no teto | C: JPEG, PNG e PDF; fora do teto | A | Mesmos tipos e limites do upload; o custo conta no teto mensal | JPEG/PNG/PDF; conta no teto (Carlos Yano, 05/11/2026). Incorporada como DEC-136. | respondida | DEC-029, DEC-035, DEC-136 |
| Q-041 | 05/11/2026 | Dados do ciclo de coleta no projeto | O Change Request pede objetivo, coordenador e cronograma, que o projeto não tem | A: objetivo e coordenador em texto, cronograma como datas de início e fim | B: tudo texto livre | C: deixar para depois | A | Objetivo, coordenador e período de coleta, opcionais | Sim, texto + datas (Carlos Yano, 05/11/2026). Incorporada como DEC-137. | respondida | RF-003, ENT-004, DEC-137 |
| Q-042 | 05/11/2026 | Sensibilidade das perguntas importadas | A sensibilidade define o grupo de envio à IA (RN-039); a importação poderia sugeri-la | A: a IA sugere e a usuária confere | B: sempre o padrão `saude` | — | A | As perguntas importadas recebem o padrão `saude`, sem sugestão | "Não é necessário identificar se é saúde ou não. Isso é apenas um teste para que eu aprenda o desenvolvimento de projetos via IA" (Carlos Yano, 05/11/2026). Incorporada como DEC-138. | respondida | RN-039, RN-047, DEC-138 |
| Q-043 | 05/11/2026 | Regras de salto do formulário importado | Instruções como "se Não, pule para a 7" podem ser lidas errado e criar regra sem aviso | A: não importar; configurar na curadoria | B: a IA sugere | — | A | A importação não cria regras de salto | Não, só na curadoria (Carlos Yano, 05/11/2026). Incorporada como DEC-139. | respondida | RN-021, DEC-095, DEC-139 |
| Q-044 | 05/11/2026 | Pergunta que não cabe na página do PDF | Hoje o PDF não confere a altura: a pergunta que passa do rodapé sai fora da folha, sem erro (PLANO §12.3, F-20); na importação, uma pergunta pode ser mais alta que uma página inteira | A: recusar a gravação do rascunho com ERR-001 e os códigos em `campos`; na importação, descartar com aviso a pergunta maior que uma página | B: mover a pergunta para a página seguinte | — | A | Recusar e apontar; descartar com aviso na importação | Recusar e apontar (Carlos Yano, 05/11/2026). Incorporada como DEC-143. | respondida | RF-004, RF-011, CA-028, DEC-143 |
| Q-045 | 05/11/2026 | Como a importação reconhece os 5 campos obrigatórios | A saída da IA não dizia qual pergunta é o nome ou o CPF; sem regra, o teste e o código teriam de inventar uma (revisão focada da CHG-014, R-01) | A: a IA indica o campo por pergunta; o primeiro candidato vence e os demais ficam comuns, com aviso | B: lista fixa de termos | — | A | A IA indica `campo_padrao`; o primeiro vence | A IA indica; 1º vence (Carlos Yano, 05/11/2026). Incorporada como DEC-144. | respondida | RN-049, RN-050, DEC-144 |
| Q-046 | 05/11/2026 | Campos da RN-050 gravados com código, tipo ou obrigatoriedade diferentes | O `updateVersion` substitui o conteúdo inteiro; recusar toda diferença quebraria a tela e testes que não enviam `obrigatorio` (revisão focada da CHG-014, R-03) | A: o sistema reaplica código, tipo e obrigatoriedade; só a remoção é recusada | B: recusar com ERR-001 | — | A | O sistema reaplica código, tipo, obrigatoriedade e sensibilidade; falta ou repetição de marcação, ou código reservado sem marcação, é recusado com ERR-001 | Corrige sozinho (Carlos Yano, 05/11/2026). Incorporada como DEC-145. | respondida | RN-050, DEC-135, DEC-145 |
| Q-047 | 05/11/2026 | Criar formulário em projeto arquivado | O `createForm` aceita projeto arquivado e a importação recusava, sem decisão (revisão focada da CHG-014, R-10) | A: permitir os dois | B: recusar os dois com ERR-001 | — | A | `createForm` e `importForm` em projeto arquivado → ERR-001 (`campos`: `projeto`) | Recusar os dois (Carlos Yano, 05/11/2026). Incorporada como DEC-146. | respondida | RF-004, RF-011, CA-027, DEC-146 |
| Q-048 | 05/11/2026 | Código reservado em pergunta comum na cópia de versão antiga | Uma versão anterior à v2.4 pode ter pergunta comum com o código NOME e a de nome com outro código; a padronização da cópia geraria dois NOME (revisão focada da CHG-014, S-03) | A: a pergunta comum ganha sufixo `_2` | B: recusar a cópia com ERR-001 | — | A | A pergunta comum com código reservado ganha sufixo na cópia | Renomear com _2 (Carlos Yano, 05/11/2026). Incorporada como DEC-147. | respondida | RN-050, DEC-147 |
| Q-049 | 05/11/2026 | Nome do coordenador apagado e restauração de backup | A restauração reaplica só eliminações de respondentes; o nome apagado voltaria (revisão focada da CHG-014, S-06) | A: aceitar o risco | B: registrar e reaplicar após o restore | — | A | Risco aceito; a usuária apaga de novo | Aceitar o risco (Carlos Yano, 05/11/2026). Incorporada como DEC-148. | respondida | DEC-137, DEC-148 |
| Q-050 | 05/11/2026 | Endereço e aplicador no formulário importado | Só os 5 campos eram reconhecidos; "Endereço" entraria como `saude` e iria à IA junto com saúde (RN-039; revisão focada da CHG-014, S-16) | A: a IA também reconhece endereço e aplicador | B: aceitar o risco | — | A | Endereço e aplicador reconhecidos como identificação, sem injeção | IA também reconhece (Carlos Yano, 05/11/2026). Incorporada como DEC-149. | respondida | RN-039, RN-049, DEC-149 |
| Q-051 | 05/11/2026 | Enunciado padrão de endereço e aplicador | A RN-049 (passo 1) dá o enunciado padrão à pergunta reconhecida com enunciado vazio, mas a DEC-149 não fixa o enunciado de `endereco` e `aplicador`, que não estão na tabela da RN-050 (IA-DEV do IMP-006) | A: "Endereço" e "Aplicador" | B: "Endereço do respondente" e "Nome do aplicador" | — | A | Enunciados "Endereço do respondente" e "Nome do aplicador"; as duas perguntas não são obrigatórias | B, e os dois não são obrigatórios no formulário (Carlos Yano, 05/11/2026). Incorporada como DEC-152. | respondida | RN-049, DEC-149, DEC-151, DEC-152 |
| Q-052 | 05/11/2026 | Linha de matriz no formato longo | O Change Request faz cada linha da matriz virar uma linha da planilha, mas não diz onde vai o código da linha | A: coluna própria `Codigo_Linha` | B: código composto em `Codigo_Pergunta` (ex.: SATISFACAO_COM_moradia) | — | A | Coluna `Codigo_Linha`, vazia fora da matriz | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-154. | respondida | RN-019, RN-051, DEC-154 |
| Q-053 | 05/11/2026 | CPF no formato longo | O exemplo do Change Request mostra o CPF com pontuação; o formato canônico (§5.4) é sem pontuação | A: 11 dígitos sem pontuação, completo, auditado (DEC-072) | B: com pontuação | C: mascarado | A | CPF completo, 11 dígitos sem pontuação, como texto | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-155. | respondida | DEC-072, RN-051, DEC-155 |
| Q-054 | 05/11/2026 | Valor de escala, número, data e texto no formato longo | O Change Request só mostra opções; não diz onde vai o valor das perguntas sem opção | A: valor canônico em `Codigo_Opcao_Valor`, rótulo vazio | B: valor repetido no rótulo | — | A | Valor em `Codigo_Opcao_Valor`, rótulo vazio | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-156. | respondida | RN-051, DEC-156 |
| Q-055 | 05/11/2026 | Aplicações no formato longo | O Change Request não diz se entram aplicações em revisão ou sem assinatura | A: só concluídas com assinatura presente (CA-021) | B: também em revisão | — | A | Só `concluida` com assinatura `presente` | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-157. | respondida | CA-021, RN-051, DEC-157 |
| Q-056 | 05/11/2026 | Item sem resposta no formato longo | Sem regra, o item em branco, ilegível, rasurado ou "não se aplica" sumiria da planilha ou se confundiria com zero (RN-020) | A: uma linha com valor vazio e a coluna `Situacao`; `nenhuma_das_anteriores` como opção comum | B: omitir o item | — | A | Uma linha com valor vazio e a situação | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-158. | respondida | RN-020, RN-051, DEC-158 |
| Q-057 | 05/11/2026 | Formatos do formato longo | O Change Request fala só em XLSX; as demais exportações têm XLSX e CSV (DEC-014) | A: XLSX e CSV | B: só XLSX | — | A | XLSX e CSV | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-159. | respondida | DEC-014, RN-051, DEC-159 |
| Q-058 | 05/11/2026 | Identificador da aplicação no formato longo | O exemplo do Change Request usa `app-001`; o sistema identifica a aplicação por UUID | A: UUID da aplicação | B: número sequencial da exportação | — | A | UUID da aplicação | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-160. | respondida | ENT-010, RN-051, DEC-160 |
| Q-059 | 05/11/2026 | Fórmulas em células exportadas | Texto lido do papel é gravado como veio; uma célula que começa com `=` vira fórmula ao abrir a planilha (PLANO §12.3, F-19) | A: apóstrofo antes de `=`, `+`, `-`, `@`, tabulação e retorno de carro | B: não tratar | — | A | Apóstrofo na frente das células de texto que começam com esses caracteres; números e datas canônicos saem como estão | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-161. | respondida | RN-037, RN-051, DEC-161 |
| Q-060 | 05/11/2026 | Dados de identificação no formato longo | O Change Request traz só o CPF; as perguntas de nome e data de nascimento virariam linhas da planilha | A: só o CPF; nome e data de nascimento não entram (minimização) | B: coluna `Nome` ao lado do CPF; data de nascimento fora | C: nome e data de nascimento como colunas | A | Coluna `Nome` ao lado do CPF; data de nascimento fora; perguntas de identificação e de data da aplicação não viram linhas | "No excel gerado eu preciso do nome do respondente" (Carlos Yano, 05/11/2026): B. Incorporada como DEC-162. | respondida | RN-051, DEC-072, DEC-162 |
| Q-061 | 05/11/2026 | Recorte do formato longo | O contrato aceita os filtros do dashboard, que só existem no IMP-004 (RF-009) | A: só projetos e período; `filtros` → ERR-001 até o IMP-004 | B: esperar os filtros do dashboard | — | A | Só projetos e período; `filtros` recusados com ERR-001 | De acordo (Carlos Yano, 05/11/2026). Incorporada como DEC-163. | respondida | RF-009, RN-051, DEC-163 |
| Q-062 | 05/11/2026 | Apóstrofo no XLSX | O apóstrofo da DEC-161 aparece na célula ao abrir o XLSX no Excel; o responsável pediu para tirá-lo (IA-TEST do IMP-007, PR #50) | A: apóstrofo só no CSV; XLSX com célula de texto, nunca fórmula | B: sem apóstrofo nos dois (o CSV volta a abrir fórmulas, F-19) | — | A | Apóstrofo só no CSV | "Apóstrofo só no CSV" (Carlos Yano, 05/11/2026): A. Incorporada como DEC-166. | respondida | RN-037, RN-051, DEC-161, DEC-166 |
| Q-063 | 06/11/2026 | Como o sistema sabe que é papel antigo | A dispensa de CPF e assinatura (DEC-172) e a base legal fora do sistema (DEC-173) valem só para o papel antigo; se valerem para qualquer envio sem QR, um formulário oficial com o QR estragado concluiria sem CPF | A: marca `papel_antigo` na versão, escolhida pela usuária ao criar ou importar o formulário e imutável depois da publicação (RN-042); a versão de papel antigo não gera PDF imprimível | B: todo envio sem QR legível é papel antigo | — | A | Vale a A: `Versao.papel_antigo`, definida no rascunho e imutável na publicação; só a aplicação de versão de papel antigo tem a dispensa da DEC-172 | "A" (Carlos Yano, 06/11/2026). Incorporada como DEC-175. | respondida | DEC-169, DEC-172, DEC-173, ENT-006, RN-052 |
| Q-064 | 06/11/2026 | Respondente sem CPF no papel antigo | O respondente é identificado só pelo CPF (RN-015) e o cadastro exige CPF (ENT-009); sem regra, a aplicação de papel antigo sem CPF não tem a quem se vincular, e os direitos do titular (RF-010) procuram pelo CPF | A: vincular por nome e data de nascimento iguais (sem acento e sem diferença de maiúsculas), sempre conferido pela usuária na conclusão; sem correspondência, cria respondente sem CPF; mais de uma, a usuária escolhe; o pedido do titular também busca por nome e data de nascimento | B: cada aplicação sem CPF cria um respondente novo, sem evolução individual | C: A, e o respondente sem CPF recebe o CPF quando uma aplicação posterior com CPF válido casar por nome e data de nascimento | A | Vale a A | "Somente nome, pois nem sempre teremos CPF e data de nascimento preenchidos" (Carlos Yano, 06/11/2026). Incorporada como DEC-176, com a data de nascimento também dispensada no papel antigo. | respondida | DEC-172, RN-011, RN-015, ENT-009, RF-010, CA-054 |
| Q-065 | 06/11/2026 | Pergunta que a localização não encontra | A IA pode não achar uma pergunta na página (rasgada, fora da foto, campo que o papel antigo não tinha, como o CPF); sem regra, o item fica sem recorte nem leitura | A: o item vai a `a_revisar` sem leitura, e a usuária responde olhando a página inteira na revisão (em branco, se o papel não tinha o campo) | B: a aplicação vai para `identificacao_pendente` até a usuária reenviar a página | — | A | Vale a A | "A" (Carlos Yano, 06/11/2026). Incorporada como DEC-177. | respondida | DEC-170, RN-052, FL-002, CA-055 |
| Q-066 | 06/11/2026 | Quando a localização não reconhece a página | O texto usava o `limite_confianca` dos campos, que é 1,00 até a calibração: quase todo envio iria a `identificacao_pendente` (REV-REQ-011, R-01) | A: limite próprio `limite_confianca_localizacao`, padrão 0,50, calibrável | B: só página nula ou fora da versão | C: o limite dos campos | A | — | "Limite próprio 0,50" (Carlos Yano, 06/11/2026). Incorporada como DEC-178. | respondida | RN-052, DEC-171, DEC-178 |
| Q-067 | 06/11/2026 | Perguntas obrigatórias que o papel antigo não tem | A versão de papel antigo precisa ter CPF, data de nascimento, data e local (RN-017, RN-050), que o papel nunca teve; a usuária marcaria em branco uma a uma em cada maço; a DEC-143 usa a medida do PDF, que o papel antigo não tem (REV-REQ-011, R-11) | A: marcar "não consta"; item nasce em branco; DEC-143 não vale | B: poder remover as perguntas de CPF e data de nascimento | C: como hoje | A | — | "Marcar como não consta [...] CPF e data de nascimento podem ser não consta, mas o local e a data de aplicação podem ser digitados pelo operador que está registrando (upload) as respostas. E não pode ser um a um: ao preencher o primeiro, eles passam a ser default para os demais; se necessário, o operador altera, e passa a ser o default para o próximo" (Carlos Yano, 06/11/2026). Incorporada como DEC-179. | respondida | RN-016, RN-017, RN-050, DEC-143, DEC-179 |
| Q-068 | 06/11/2026 | Versão de papel antigo em folha com QR legível | Pelo `identifyApplication` ou pelo envio, um formulário oficial poderia receber uma versão de papel antigo e a dispensa de CPF e assinatura (REV-REQ-011, R-16) | A: o QR legível sempre decide a versão; outra → ERR-039 | B: a usuária decide | — | A | — | "Não: QR sempre manda" (Carlos Yano, 06/11/2026). Incorporada como DEC-180. | respondida | DEC-169, DEC-175, DEC-180 |
| Q-069 | 06/11/2026 | Páginas do formulário importado de papel antigo | A importação redistribui as perguntas nas páginas do PDF do sistema e descarta as que não cabem; as páginas da versão não batem com as folhas reais (REV-REQ-012, S-03) | A: manter a página do original; campos padronizados que o papel não tem entram `nao_consta` | B: redistribuir como hoje | — | A | — | "Manter página original" (Carlos Yano, 06/11/2026). Incorporada como DEC-181. | respondida | RN-049, RN-050, DEC-181 |
| Q-070 | 06/11/2026 | Data e local do envio em casos de borda | Envio sem versão, versão definida depois, versão oficial, data futura, só um dos dois (REV-REQ-012, S-07) | A: só valem se a versão final for de papel antigo; data futura recusada; pode vir só um | B: recusar quando não se aplicam | — | A | — | "Só se a versão final for papel antigo" (Carlos Yano, 06/11/2026). Incorporada como DEC-182. | respondida | DEC-179, DEC-182 |
| Q-071 | 06/11/2026 | Página 1 assinada anexada sem QR legível | A conferência pelo QR é impossível, e localizar pela IA seria uma chamada externa síncrona sem regra de cota nem falha (REV-REQ-012, S-09) | A: a usuária confirma na conferência da assinatura | B: a IA localiza em segundo plano | — | A | — | "Você, na conferência" (Carlos Yano, 06/11/2026). Incorporada como DEC-183. | respondida | RN-044, DEC-183 |
| Q-072 | 06/11/2026 | Versão de papel antigo em aplicação com QR legível de versão inválida | A DEC-180 dizia que o QR legível de versão inválida não decide a versão e também que a versão de papel antigo só vale sem QR legível; o CA-052 ex. 10 aceitava a versão de papel antigo nessa folha, e um formulário oficial escaparia de CPF, assinatura e consentimento (REV-REQ-013, T-01) | A: nunca papel antigo em aplicação com folha de QR legível, válido ou não → ERR-039 | B: só o QR válido bloqueia | — | A | — | "Nunca papel antigo" (Carlos Yano, 06/11/2026). Incorporada como DEC-184. | respondida | DEC-180, DEC-184, CA-052 |
| Q-073 | 06/11/2026 | Quando data e local do envio são aplicados ou apagados | A DEC-182 apagava data e local "quando a versão é definida": uma versão oficial escolhida por engano e trocada no `identifyApplication` perderia a digitação; o `addApplicationPages` e o papel antigo sem `nao_consta` não estavam cobertos (REV-REQ-013, T-02) | A: guardar enquanto em `identificacao_pendente` e aplicar ou apagar só ao sair de lá | B: apagar quando a versão é escolhida | — | A | — | "Só ao sair da pendência" (Carlos Yano, 06/11/2026). Incorporada como DEC-185. | respondida | DEC-182, DEC-185, CA-057 |
| Q-074 | 06/11/2026 | Momento de aplicar ou apagar data e local do envio | Pela DEC-185, a aplicação nascida em `em_leitura` já aplicava ou apagava data e local, mas a localização pode levá-la depois à pendência e a usuária trocar a versão; o CA-057 ex. 10 contradizia a regra (REV-REQ-014, U-01) | A: só quando a localização confirma a versão e as páginas | B: no nascimento, como na DEC-185 | — | A | — | "Quando a versão é confirmada" (Carlos Yano, 06/11/2026). Incorporada como DEC-186. | respondida | DEC-185, DEC-186, CA-057 |
| Q-075 | 06/11/2026 | O que é QR legível | Papel antigo pode trazer QR de terceiros; se contar como QR legível de versão inválida, o acervo nunca recebe a versão de papel antigo (REV-REQ-014, U-02) | A: só o QR no formato do MinhaPesquisa; outro conta como ausente, auditado | B: qualquer QR decodificável | — | A | — | Recomendação aceita (Carlos Yano, 06/11/2026). Incorporada como DEC-187. | respondida | DEC-184, DEC-187 |
| Q-076 | 06/11/2026 | Folha de página sem perguntas no envio | A localização não recebe nada para reconhecer capa ou agradecimento; todo envio desse formulário iria à pendência (REV-REQ-014, U-05) | A: por eliminação | B: sempre pendência | C: guardar uma descrição na importação | A | — | "Por eliminação" (Carlos Yano, 06/11/2026). Incorporada como DEC-188. | respondida | DEC-181, DEC-188, CA-053 |
| Q-077 | 06/11/2026 | Total de páginas na cópia de versão | A cópia de um papel antigo não dizia se leva o `total_paginas` (REV-REQ-014, U-06) | A: leva quando a nova é de papel antigo e apaga quando não é | B: recalcular sempre | — | A | — | Recomendação aceita (Carlos Yano, 06/11/2026). Incorporada como DEC-189. | respondida | DEC-181, DEC-189 |
| Q-078 | 06/11/2026 | Posição dos campos injetados na importação de papel antigo | A DEC-181 não dizia em que posição da página 1 entram os campos que o papel não tem (REV-REQ-014, U-07) | A: no início da página 1, na ordem da RN-050 | B: no fim da página 1 | — | A | — | Recomendação aceita (Carlos Yano, 06/11/2026). Incorporada como DEC-190. | respondida | DEC-181, DEC-190, CA-058 |
| Q-079 | 06/11/2026 | Aplicações de papel antigo em andamento na eliminação de respondente sem CPF | Sem CPF, essas aplicações não são achadas pelo `cpf_hash`; concluídas, trariam de volta os dados do titular eliminado (REV-REQ-014, U-08) | A: listar para a usuária decidir o descarte | B: risco aceito | — | A | — | "Listar para descarte" (Carlos Yano, 06/11/2026). Incorporada como DEC-191. | respondida | DEC-176, DEC-191, CA-056 |
| Q-080 | 06/11/2026 | Quando o padrão de data e local do projeto muda | Pela DEC-186, o padrão mudava só no fim da localização: maços enviados em sequência recebiam o padrão antigo, e uma pendência resolvida depois voltava o padrão para uma data mais antiga (REV-REQ-015, V-01) | A: no próprio envio, com o valor digitado | B: na confirmação, se o envio for mais recente | — | A | — | "No envio" (Carlos Yano, 06/11/2026). Incorporada como DEC-192. | respondida | DEC-179, DEC-186, DEC-192 |
| Q-081 | 06/11/2026 | Nome e momento da lista de aplicações na eliminação sem CPF | O NOME da aplicação em andamento pode não ter `valor_final`, e a lista calculada na hora sumiria depois da anonimização (REV-REQ-015, V-04) | A: `valor_final` ou, sem ele, `valor_ia`; lista gravada no pedido na execução | B: só `valor_final`; lista calculada na hora | — | A | — | Recomendação aceita (Carlos Yano, 06/11/2026). Incorporada como DEC-193. | respondida | DEC-191, DEC-193 |
| Q-082 | 06/11/2026 | "Nenhuma das anteriores" na múltipla escolha de papel antigo | A RN-047 exige a opção `nenhuma_das_anteriores` em toda `multipla_escolha`, e a RN-049 a acrescenta na importação; o papel antigo não tem essa caixa impressa, e o IA-TEST do IMP-008 (CA-058 e DEC-181) espera a importação sem ela e a publicação sem exigi-la (IA-DEV do IMP-008) | A: vale também no papel antigo (a opção é acrescentada e exigida, e nunca vem marcada da leitura) | B: no papel antigo, a importação não a acrescenta e a publicação não a exige | — | B | — | Recomendação aceita (Carlos Yano, 06/11/2026). Incorporada como DEC-195. | respondida | RN-047, RN-049, DEC-096, DEC-181, DEC-195, CA-058 |
| Q-083 | 06/11/2026 | Contagem de folhas no envio sem QR | A linha 4 da tabela de criação da FL-001 e o CA-052, exemplo 2, mandam a aplicação a `identificacao_pendente` já no envio quando o número de folhas difere do total da versão escolhida; o CA-053, exemplo 9, envia 3 fotos sem QR para a mesma versão de 2 páginas e espera `em_leitura` no envio e a localização das 3 antes da pendência. Os dois exemplos não podem valer juntos (IA-DEV do IMP-008) | A: a contagem vale no envio também sem QR; o CA-053, exemplo 9, passa a usar uma situação sem folha a mais (por exemplo, 2 fotos indicadas como a mesma página) | B: sem QR, a contagem fica para o fim da localização, e o CA-052, exemplo 2, e a linha 4 da FL-001 mudam | — | A | — | "Opção A" (Carlos Yano, 06/11/2026). Incorporada como DEC-196. | respondida | FL-001, CA-013, CA-052, CA-053, DEC-171, DEC-196, RN-052 |
| Q-084 | 07/11/2026 | Texto escrito ao lado da opção "Outro" | A importação transforma "Outro: ____" numa opção comum e o modelo não tem texto complementar de opção: a leitura grava só `outro` e o texto escrito ao lado se perde (testes preliminares do responsável, "Outros: Maternidade") | A: a opção ganha um texto livre, lido pela IA, revisado como valor à parte e exportado numa coluna própria | B: a importação cria uma pergunta de texto curto logo depois da pergunta | C: fora do escopo; o texto não é capturado | A | — | "84: A" (Carlos Yano, 07/11/2026). Incorporada como DEC-197. | respondida | ENT-008, ENT-011, RN-049, RN-051, DEC-197 |
| Q-085 | 07/11/2026 | Nome do arquivo enviado | O nome original do arquivo não é guardado; o responsável quer vê-lo no resultado, mas o nome costuma trazer o nome da pessoa (dado pessoal) | A: só na tela do envio, sem gravar | B: gravar na página como dado pessoal, expurgado com a imagem e fora da exportação | C: gravar e levar à exportação | A | — | "85: C" (Carlos Yano, 07/11/2026). Incorporada como DEC-198. | respondida | ENT-025, RF-006, RN-051, DEC-198 |
| Q-086 | 07/11/2026 | Complemento vazio com "Outro" marcado | A DEC-197 não diz se o texto ao lado de "Outro" é obrigatório quando a opção é marcada (propagação da CHG-018) | A: opcional; o complemento fica em branco, ilegível ou rasurado e a aplicação conclui | B: obrigatório; sem ele a aplicação não conclui | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-199. | respondida | RN-009, FL-002, DEC-197, DEC-199 |
| Q-087 | 07/11/2026 | Revisão do complemento | O complemento é texto sem schema, como o texto curto, que vai sempre à revisão (DEC-066) (propagação da CHG-018) | A: sempre à revisão, como o texto curto | B: regra geral de confiança | — | A | — | "Regra geral de confiança" (Carlos Yano, 07/11/2026). Incorporada como DEC-200. | respondida | FL-002, DEC-066, DEC-197, DEC-200 |
| Q-088 | 07/11/2026 | Colunas do complemento e do arquivo no formato longo | A DEC-197 e a DEC-198 pedem colunas próprias, sem nome nem posição, e uma aplicação pode ter páginas de mais de um arquivo (propagação da CHG-018) | A: `Arquivo` depois de `ID_Aplicacao`, com o arquivo da página da pergunta, e `Complemento` depois de `Rotulo_Opcao_Valor`, só na linha da opção | B: como A, mas `Arquivo` com todos os arquivos da aplicação, na ordem do envio, repetido em todas as linhas | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-201. | respondida | RN-051, DEC-197, DEC-198, DEC-201 |
| Q-089 | 07/11/2026 | Onde a opção ganha complemento | A DEC-197 fala só da importação; o formulário criado no editor e o PDF gerado pelo sistema também podem ter "Outro" (propagação da CHG-018) | A: também no editor, e o PDF imprime uma linha para escrever depois do rótulo | B: só na importação; o editor não muda a marca e o PDF não muda | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-202. | respondida | ENT-008, RF-004, RN-049, DEC-197, DEC-202 |
| Q-090 | 07/11/2026 | Complemento e arquivo na exportação linha a linha | A DEC-197 manda a exportação levar o complemento sem limitar o escopo, e a DEC-201 só trata do formato longo (REV-REQ-016, X-12) | A: também no `linha_a_linha`, no formato da M-06; o dashboard não mostra | B: só no formato longo | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-207. | respondida | DEC-197, DEC-201, RF-010, DEC-207 |
| Q-091 | 07/11/2026 | Complemento já revisado quando a pergunta muda | A regra 1b reavalia o complemento a cada mudança da pergunta e não diz se a revisão humana do complemento é mantida (REV-REQ-016, X-02) | A: mantém a revisão enquanto a opção continua marcada; muda só se a opção for desmarcada ou na reabertura | B: toda mudança da pergunta leva o complemento de novo a `a_revisar` | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-204. | respondida | FL-002, DEC-197, DEC-204 |
| Q-092 | 07/11/2026 | Nome do arquivo na eliminação do titular | O `nome_arquivo` é apagado só no expurgo físico da imagem, que pode levar até 30 dias depois da eliminação, com o titular já anonimizado (REV-REQ-016, X-08) | A: apagado no ato da eliminação e na reaplicação após restore; no descarte, segue a imagem | B: segue a imagem também na eliminação | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-206. | respondida | DEC-198, CA-023, RN-030, DEC-206 |
| Q-093 | 07/11/2026 | Texto ao lado de uma opção não marcada | A regra 1b deixa o complemento de opção não marcada em `nao_se_aplica` mesmo com texto lido, e a palavra se perde sem revisão (REV-REQ-016, X-03; observação da IA na propagação) | A: vai a `a_revisar` como inconsistência, como o CA-019 | B: ignorar; fica só em `valor_ia` | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-205. | respondida | FL-002, CA-019, DEC-197, DEC-205 |
| Q-094 | 07/11/2026 | Complemento quando a usuária tira a opção | Pela DEC-205, o complemento com texto lido vai a `a_revisar` sempre que a pergunta fica sem a opção, inclusive quando foi a própria usuária que a tirou na revisão, e a conclusão fica bloqueada até ela marcar `nao_se_aplica` (REV-REQ-017, Y-01) | A: `nao_se_aplica` direto quando a usuária corrige a pergunta; a DEC-205 vale só para o valor vindo da leitura | B: sempre `a_revisar`, pela DEC-205 | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-208. | respondida | DEC-205, FL-002, CA-059, DEC-208 |
| Q-095 | 07/11/2026 | Complemento quando a pergunta fica sem a opção por outra ação da usuária | A pré-regra 1b(b) mandava a `a_revisar` o complemento com texto lido quando a pergunta ficava `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica`, enquanto a DEC-208 limitava a DEC-205 ao valor vindo da leitura; a reabertura ficava sem regra para esses estados (REV-REQ-018, Z-01) | A: pelo autor da decisão — `a_revisar` só com a pergunta vinda da leitura ou da regra de salto; `nao_se_aplica` quando a usuária resolveu a pergunta | B: `a_revisar` só com `confirmado_automaticamente` ou `confirmado` | C: `a_revisar` em todo estado menos `corrigido` | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-209. | respondida | DEC-205, DEC-208, FL-002, CA-059, DEC-209 |
| Q-096 | 07/11/2026 | Nome do arquivo das aplicações descartadas pela eliminação | A DEC-206 apaga o nome no ato para as aplicações do titular e manda o descarte apagá-lo no expurgo; as aplicações em andamento descartadas pela própria eliminação caíam nos dois casos (REV-REQ-018, Z-04) | A: no ato, em toda aplicação descartada pela execução da eliminação | B: no expurgo físico, como no descarte comum | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-210. | respondida | DEC-191, DEC-206, CA-023, TS-008, DEC-210 |
| Q-097 | 07/11/2026 | Complemento e arquivo na ficha individual | A DEC-207 tirava o complemento e o arquivo do dashboard e da exportação agregada, mas não dizia nada da ficha individual (REV-REQ-018, Z-07) | A: só o complemento | B: o complemento e o nome do arquivo | C: nenhum | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-211. | respondida | DEC-207, RF-009, TL-009, DEC-211 |
| Q-098 | 07/11/2026 | Complemento de opção não marcada já revisado | Pela 1b(b), o complemento que a usuária marcou `nao_se_aplica` voltava a `a_revisar` toda vez que a pergunta vinda da leitura era confirmada de novo, num laço de revisão (REV-REQ-019, AA-01) | A: manter o `nao_se_aplica` da usuária enquanto a opção continuar não marcada | B: voltar à revisão a cada mudança da pergunta | — | A | — | Recomendação aceita (Carlos Yano, 07/11/2026). Incorporada como DEC-212. | respondida | DEC-204, DEC-205, FL-002, CA-059, DEC-212 |
| Q-099 | 10/11/2026 | Página inteira em toda leitura | A leitura da página inteira leva nome, CPF e saúde juntos ao provedor em toda aplicação; até a v2.8 isso era exceção da RN-038, só na localização e na importação | A: regra geral, com o risco aceito | B: página inteira com a identificação coberta, CPF numa chamada à parte | C: só nos formulários do sistema | A | — | "Sim, regra geral" (Carlos Yano, 10/11/2026). Incorporada como DEC-216. | respondida | RN-038, RN-039, Risco 3, DEC-216 |
| Q-100 | 10/11/2026 | Como o QR novo indica a versão | O `PPPPP.FFF.X/Y` do Change Request não tem a versão, e é o QR que decide a versão (DEC-180) | A: versão escolhida no envio | B: versão publicada vigente | C: versão no QR | C | — | "Incluir versão no QR" (Carlos Yano, 10/11/2026). Incorporada como DEC-218. | respondida | DEC-180, DEC-218 |
| Q-101 | 10/11/2026 | QR de projeto ou formulário diferente do escolhido | O Change Request pede alerta, mas não diz se o envio segue | A: alerta e bloqueia | B: alerta e o QR prevalece | C: alerta e a escolha prevalece | A | — | "Alerta e bloqueia informando para a operadora selecionar o projeto e formulário correto" (Carlos Yano, 10/11/2026). Incorporada como DEC-215. | respondida | DEC-169, DEC-180, DEC-215 |
| Q-102 | 10/11/2026 | Formulários já impressos com o QR antigo | Há papel impresso com o QR `MP1.` da DEC-048 | A: aceitar os dois formatos | B: o antigo conta como sem QR | — | — | — | "Não, antigo vira sem QR" (Carlos Yano, 10/11/2026). Incorporada como DEC-218. | respondida | DEC-048, DEC-187, DEC-218 |
| Q-103 | 10/11/2026 | Como nascem os códigos do projeto e do formulário | Projeto e formulário só têm UUID; o QR pede 5 e 3 dígitos | A: sequenciais automáticos, o do formulário dentro do projeto | B: formulário sequencial global | C: digitados pela usuária | A | — | Recomendação aceita (Carlos Yano, 10/11/2026). Incorporada como DEC-217. | respondida | ENT-004, ENT-005, DEC-217 |
| Q-104 | 10/11/2026 | Dígitos da versão no QR | A versão entra no QR (Q-100), sem formato definido | A: 2 dígitos, `PPPPP.FFF.VV.X/Y` | B: 3 dígitos | — | A | — | Recomendação aceita (Carlos Yano, 10/11/2026). Incorporada como DEC-218. | respondida | ENT-006, DEC-218 |
| Q-105 | 10/11/2026 | O formulário pode mudar depois do envio | A FL-001 e os CA-052 e CA-057 deixavam o `identifyApplication` trocar de formulário, e a DEC-215 fixa a versão no formulário escolhido (REV-REQ-020, R1-01) | A: formulário fixo; versão de outro formulário é ERR-039 | B: pode trocar o formulário, conferindo de novo com o QR | — | A | — | Recomendação aceita (Carlos Yano, 10/11/2026). Incorporada como DEC-221. | respondida | DEC-215, FL-001, CA-052, CA-057, DEC-221 |
| Q-106 | 10/11/2026 | QR de outro formulário em folha acrescentada ou assinada | A DEC-215 só falava do envio; o `addApplicationPages` e o `attachSignaturePage` também recebem folhas com QR (REV-REQ-020, R1-09) | A: recusa com ERR-045 | B: regra antiga pela versão (ERR-039) | — | A | — | Recomendação aceita (Carlos Yano, 10/11/2026). Incorporada como DEC-222. | respondida | DEC-215, CA-044, DEC-222 |
| Q-107 | 13/11/2026 | Aplicação antiga sem formulário | A DEC-221 diz que o formulário não muda, mas a aplicação anterior à v2.9, sem versão, não tem formulário gravado (REV-REQ-021, M-01) | A: exceção estreita; o `identifyApplication` grava o formulário uma única vez | B: migrar sem nulo; C: impedir a identificação das antigas | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-223. | respondida | DEC-221, ENT-010, FL-001, DEC-223 |
| Q-108 | 13/11/2026 | Códigos do ERR-045 com várias folhas divergentes | O contrato tem um só `projeto_qr` e um só `formulario_qr`; não estava dito qual folha vale nem a precedência do ERR-029 (REV-REQ-021, B-04) | A: códigos da primeira folha divergente; ERR-029 antes | B: todos os códigos lidos | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-224. | respondida | DEC-215, DEC-222, ERR-045, DEC-224 |
| Q-109 | 13/11/2026 | Versão de outro formulário no `addApplicationPages` | O contrato recusa (400), mas a tabela de criação da FL-001 grava com aviso ERR-039 (REV-REQ-022, N-02) | A: recusa com ERR-039, sem gravar | B: grava as folhas e devolve 200 com aviso ERR-039 | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-225. | respondida | DEC-221, DEC-222, FL-001, CA-061, DEC-225 |
| Q-110 | 13/11/2026 | `addApplicationPages` em aplicação antiga sem formulário | A DEC-223 só trata o `identifyApplication`; uma folha nova com QR poderia definir a versão e deixar o formulário nulo (REV-REQ-022, N-03) | A: recusa com ERR-018 até o `identifyApplication` definir o formulário | B: aceita e compara com o formulário da versão informada | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-226. | respondida | DEC-223, FL-001, CA-061, DEC-226 |
| Q-111 | 13/11/2026 | Página 1 assinada com QR de outra versão ou total diferente | Não havia resultado para QR legível do mesmo formulário, mas de outra versão, nem para `Y` diferente do total (REV-REQ-022, N-05) | A: ERR-039, permanece em `sem_assinatura` | B: aceita a página 1 do mesmo formulário; C: ERR-004 | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-227. | respondida | DEC-218, DEC-222, CA-044, DEC-227 |
| Q-112 | 13/11/2026 | `identifyApplication` com páginas incompletas em aplicação antiga | O `addApplicationPages` só é aceito depois que o formulário é gravado, mas o `identifyApplication` com página faltante volta ERR-004 e a aplicação nunca seria completada (REV-REQ-023, O-01) | A: grava o formulário mesmo com ERR-004 | B: o `addApplicationPages` informa a versão e define o formulário; C: só descartar | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-229. | respondida | DEC-223, DEC-226, CA-061, DEC-229 |
| Q-113 | 13/11/2026 | Alcance da recusa do ERR-039 no `addApplicationPages` | A DEC-225 cobre só a versão de outro formulário, mas o contrato recusava todas as causas do ERR-039 (REV-REQ-023, O-02) | A: recusa só a versão de outro formulário; as demais seguem a tabela | B: recusa todas as causas | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-230. | respondida | DEC-225, FL-001, CA-061, DEC-230 |
| Q-114 | 13/11/2026 | Migração do `formulario_id` | A migração não dizia o que fazer com aplicação antiga com versão de outro projeto nem com aplicação descartada sem versão (REV-REQ-023, O-05) | A: nulo quando não há versão ou ela é de outro projeto, em `identificacao_pendente` ou `descartada` | B: atribuir o formulário da versão gravada, qualquer que seja | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-231. | respondida | DEC-223, ENT-010, DEC-231 |
| Q-115 | 13/11/2026 | `versao_id` inválida do pedido | Não estava dito se a `versao_id` inexistente, não publicada, de outro tenant ou projeto é gravada em `aplicacao.versao_id` (REV-REQ-024, R5-P03) | A: descartar a inválida e avisar | B: gravar só se existir e for do tenant; C: gravar sempre | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-232. | respondida | DEC-169, DEC-230, FL-001, CA-061, DEC-232 |
| Q-116 | 13/11/2026 | Versão de outro tenant no `uploadImages` e no `addApplicationPages` | O PLANO §6.1 manda 404, a DEC-100 manda 400 no `identifyApplication` e a DEC-230 manda 200 (REV-REQ-024, R5-P04) | A: tratar como inexistente, com a tentativa auditada | B: 404 ERR-002; C: 200 sem tratar o tenant | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-233. | respondida | DEC-100, DEC-230, CA-061, DEC-233 |
| Q-117 | 13/11/2026 | `versao_id` de outro projeto nas aplicações antigas | A DEC-231 deixava aplicação com versão de outro projeto e sem formulário, contra a DEC-226 e a ENT-010 (REV-REQ-024, R5-P01) | A: limpar a `versao_id` de outro projeto, na migração e no `identifyApplication` | B: manter a versão e afrouxar a invariante | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-234. | respondida | DEC-221, DEC-226, DEC-229, DEC-231, DEC-234 |
| Q-118 | 13/11/2026 | Versão de papel antigo recusada pela DEC-184 | A DEC-230 a trata como causa de ERR-039, mas a DEC-232, o contrato e a definição de "válida" da FL-001 não diziam se ela é gravada em `versao_id` (REV-REQ-025, R6-03) | A: inválida, não gravada, com aviso ERR-039 | B: válida e gravada | — | A | — | Recomendação aceita (Carlos Yano, 13/11/2026). Incorporada como DEC-235. | respondida | DEC-184, DEC-230, DEC-232, DEC-235 |

10. Gates externos (GX)

Gates externos são condições que devem ser cumpridas antes de uma fase específica (geralmente a Fase 6 - Produção). Eles não bloqueiam o desenvolvimento com dados sintéticos, mas bloqueiam a liberação para usuários reais.

| id | descricao | tipo | responsavel_externo | condicao_de_cumprimento | bloqueia | status | evidencia | data |
|---|---|---|---|---|---|---|---|---|
| GX-001 | Parecer jurídico sobre tratamento de dados (DPA) e transferência internacional (LGPD Art. 33) para o provedor de IA, inclusive o envio da página inteira, com identificação e dados de saúde juntos, na identificação e na leitura (DEC-170, DEC-216). | jurídico | Advogado/Consultoria LGPD | Documento formal de parecer e minuta de DPA aprovada, garantindo que o provedor de IA não usa dados para treino e que a transferência internacional das páginas inteiras enviadas na identificação e na leitura (DEC-216) está legalmente amparada. | produção (Fase 6 e Piloto) | pendente | — | 24/10/2026 |

11. Testes sentinela (TS)

Testes sentinela são casos de teste de alto nível que validam os riscos críticos de negócio, segurança e limites do sistema. Eles servem como "âncoras" para a suíte de testes automatizados na Fase 5.

| id | nome_do_teste | cenario | resultado_esperado | requisitos |
|---|---|---|---|---|
| TS-001 | Isolamento de Tenant (Segurança) | Usuário do Tenant A tenta acessar via API, em todas as operações privadas do contrato, um recurso (ex: `GET /projects/{id}`), no caminho ou no corpo da requisição, que pertence ao Tenant B. | O sistema retorna 404 Not Found (não 403) e registra uma tentativa de violação de isolamento na auditoria. Nenhum dado do Tenant B é retornado. | RNF-001, RN-002, CA-012 |
| TS-002 | Validação de Upload (Limite e Segurança) | Usuário tenta fazer upload de um arquivo `.exe` de 5MB e, em seguida, um `.pdf` de 25MB. | Ambos são rejeitados imediatamente com ERR-029 (motivos "tipo de arquivo não permitido" e "excede o limite de 20 MB"). O sistema não processa o arquivo nem grava metadados no banco. | RF-006, CA-029, RN-040 |
| TS-003 | Fila de Revisão por Confiança (Negócio) | A IA lê um campo de escolha única com confiança de 0.85 (limite é 0.90). | O ItemResposta é criado com estado `a_revisar`. A Aplicacao não pode ser concluída até que este item seja resolvido por um humano. | RF-007, CA-005, DEC-028 |
| TS-004 | Retirado na v2.1 (sem k-anonimato, DEC-110) | — | — | RNF-004 |
| TS-005 | Direito de Eliminação (LGPD) | Administrador executa o pedido de eliminação para um respondente específico. | As imagens são marcadas para expurgo e o `nome_arquivo` das páginas é apagado no ato (DEC-206). O registro do Respondente tem `nome` sobrescrito, `cpf_cifrado`, `cpf_hash`, `data_nascimento` e `endereco` apagados, e `anonimizado` = true. O ID do respondente vai para a ListaEliminacoes. A auditoria registra a ação sem o CPF. | RF-010, CA-023, RN-030, RN-031, DEC-026 |
| TS-006 | Bloqueio de Edição de Versão Publicada (Integridade) | Administrador tenta adicionar uma nova pergunta a uma Versao que já tem o status `publicada`. | O sistema rejeita a operação com ERR-009 (Versão imutável). O administrador deve criar uma nova versão em rascunho. | RF-004, CA-001, RN-042 |
| TS-007 | Teto de Custo de IA (Operação) | O tenant atinge o teto de R$ 500,00 de custo de IA no mês. Uma nova aplicação é enviada para leitura. | A aplicação entra no estado `aguardando_cota`. A usuária é avisada na tela. Nenhuma chamada é feita ao provedor de IA até que a cota seja renovada ou o teto aumentado. | RF-007, CA-030, DEC-035, RNF-014 |
| TS-008 | Direito de Eliminação Completo (LGPD) | Administrador executa eliminação de respondente com aplicações concluídas, aplicações em revisão e exportações pendentes. | Todas as imagens são marcadas para expurgo. Os ItemResposta têm `valor_ia` e `valor_final` sobrescritos, e o `nome_arquivo` das páginas, inclusive das aplicações descartadas, é apagado no ato (DEC-206, DEC-210). O Respondente é anonimizado. Aplicações em andamento são descartadas. Exportações pendentes são canceladas. O ID vai para ListaEliminacoes com validade de 180 dias. A auditoria registra a ação sem CPF. O expurgo físico ocorre em até 30 dias. | RF-010, CA-023, RN-030, RN-031, DEC-026 |

12. Checklist de pronto (nível Completo)

Reavaliado na v1.3. Itens verificáveis por script são checados no CI por `tools/validar_consistencia.py`; o resultado do script prevalece sobre este texto.

- [x] 1. IDs únicos e rastreáveis: RF-001 a RF-015, RNF-001 a RNF-014, RN-001 a RN-052, ENT-001 a ENT-031, FL-001 a FL-004, TL-001 a TL-015, US-001 a US-014, 58 CAs (CA-001 a CA-063 e CA-014b, sem os retirados na v2.1: CA-010, CA-016, CA-025, CA-026b, CA-034, CA-037b, CA-038 e CA-043), ERR do catálogo (seção 8.2, incluindo os descontinuados), TS-001 a TS-008, DEC-001 a DEC-036 e DEC-054 a DEC-061, DEC-064 a DEC-082 (tabela da REQ; inclui DEC técnicas anteriores à Fase 3, como DEC-007, DEC-022 e DEC-036), DEC-037 a DEC-053, DEC-062 e DEC-063 (técnicas, no PLANO), as DEC seguintes da REQ e do PLANO até a DEC-235, Q-001 a Q-118 e GX-001. Verificado por script (IDs citados existem nos registros).
- [x] 2. BDD com dados concretos: tabelas de exemplos nos CAs de alto risco CA-002, CA-008, CA-012, CA-023, CA-029, CA-030 e CA-032 (adicionadas na v1.3; na v1.2 só o CA-029 tinha tabela).
- [x] 3. Estados e fluxos fechados: FL-001 com tabela de criação e entradas em `aguardando_cota`; FL-002 com ordem de avaliação explícita; FL-004 com as transições da importação (CHG-014). Estados verificados por script contra o dicionário e o contrato.
- [x] 4. Dicionário de dados completo: 31 entidades com as 11 propriedades; `registros/dicionario_dados.csv` idêntico, verificado por script.
- [x] 5. Concorrência e duplicidade definidas (seção 6.5), com idempotência e If-Match obrigatórios nas operações listadas.
- [x] 6. Resiliência em chamadas externas (seção 6.6), incluindo PDF e jobs.
- [x] 7. Zero contradições com a tabela de decisões: DEC-020 × ERR-006 e DEC-026 × dicionário corrigidos na v1.3.
- [x] 8. Toda escolha técnica é DEC; lacuna de negócio é Q, e Q respondida vira DEC (Q-005 a Q-011 → DEC-054 a DEC-060). DEC-036 foi resolvida pela DEC-038 (PLANO); DEC-023 substituída pela DEC-055.
- [x] 9. Testes sentinela cobrindo riscos: TS-001 a TS-008.
- [x] 10. Gates externos registrados: GX-001 (bloqueia piloto e produção).
- [x] 11. Nenhum trecho exige "bom senso": lacunas resolvidas pelas DEC-054 a DEC-060 e DEC-064 a DEC-072.
- [x] 12. Toda Q respondida: Q-001 a Q-035 e Q-037 a Q-081 respondidas (Q-031 em 03/11/2026 como DEC-117; Q-032 a Q-035 em 05/11/2026 como DEC-126 a DEC-129; Q-037 a Q-050 em 05/11/2026 como DEC-133 a DEC-139 e DEC-143 a DEC-149; Q-051 em 05/11/2026 como DEC-152); Q-052 a Q-062 em 05/11/2026 (CHG-015 e CHG-016); Q-036 superada em 06/11/2026 pela DEC-170; Q-063 a Q-081 em 06/11/2026 como DEC-175 a DEC-193 (CHG-017).
- [ ] 13. Consenso DEV/TEST sem divergência bloqueante: depende da próxima rodada de revisão independente.
- [x] 14. REQ autocontida: referências externas (MeuRemedio, Kit v3) são informativas; o Bloco P está em `docs/spec/BLOCO_P.md`.
- [x] 15. Última revisão independente sem achado bloqueante ou alto, com médios e baixos registrados (DEC-061, DEC-073): REV-REQ-015 (rodada 5 da CHG-017), 0 bloqueantes e 0 altos; decisões V-01 e V-04 respondidas (DEC-192, DEC-193); editoriais corrigidos; V-08, V-11 e V-14 no PLANO §12.3.

Anexo A — Glossário técnico

| Termo | Significado no contexto do MinhaPesquisa |
|---|---|
| Outbox Transacional | Padrão de arquitetura onde eventos de domínio (ex: "aplicação concluída") são gravados na mesma transação de banco de dados que a entidade, garantindo que mensagens assíncronas (para o worker de IA ou e-mail) nunca sejam perdidas em caso de falha. |
| Row-Level Security (RLS) | Recurso do PostgreSQL que aplica filtros de `tenant_id` automaticamente em todas as queries, servindo como segunda barreira de defesa contra vazamento de dados entre tenants. |
| Link Assinado (Signed URL) | URL temporária gerada pelo serviço de armazenamento (S3/Blob) que concede acesso de leitura a um objeto privado (imagem do formulário) por um tempo limitado (5 min), sem expor credenciais. |
| k-anonimato | Propriedade de privacidade onde um conjunto de dados agregados só é exibido se contiver pelo menos `k` indivíduos (configurado em `grupo_minimo`), impedindo a reidentificação de indivíduos em grupos pequenos. Não é aplicado a partir da v2.1 (DEC-110). |
| Conjunto-ouro | Base de dados de validação contendo imagens de formulários preenchidos à mão por voluntários, acompanhadas do gabarito humano (valor real). Usado para medir a acurácia e o erro silencioso da IA. |
| HMAC (Hash-based Message Authentication Code) | Função criptográfica usada para gerar um hash do CPF com uma chave secreta, permitindo buscar o CPF no banco mesmo ele estando armazenado de forma cifrada (AES-256). |
| Contract-First | Abordagem onde o contrato da API (OpenAPI) é definido e aprovado antes da implementação do código, garantindo que o frontend e o backend evoluam em paralelo e que os testes de integração sejam gerados automaticamente. |
| Test-First | Prática onde os testes de aceitação (Gherkin/Cucumber) são escritos e falham (commit vermelho) antes de a funcionalidade ser implementada pela IA-DEV. |

Anexo B — Registro de revisões independentes (REV)

A revisão independente é obrigatória no nível Completo. O revisor não pode ser o autor da especificação; na v1 é um agente de IA de outro modelo, isolado e somente leitura, com os achados aprovados pelo responsável (DEC-061). Cada rodada desce um nível de detalhe; para com 0 bloqueantes e 0 altos, com médios e baixos registrados no PLANO §12.3 (DEC-073).

| id | data | revisor | versao_revisada | achados_bloqueantes | achados_altos | achados_medios | achados_baixos | status | resolucao |
|---|---|---|---|---|---|---|---|---|---|
| REV-REQ-001 | 24/10/2026 | IA Revisora (Simulada) | 1.0 | 0 | 0 | 6 | 3 | Resolvido | CAs incompletos; ERRs sem catálogo; entidades de apoio sem dicionário; US insuficientes; matriz como amostra; TS-008 ausente. Todos resolvidos. |
| REV-REQ-002 | 24/10/2026 | IA Revisora (Simulada) | 1.1 | 0 | 0 | 0 | 0 | Resolvido | Verificação cruzada declarada sem achados; a REV-REQ-004 mostrou que a verificação não foi efetiva. |
| REV-REQ-003 | 24/10/2026 | Carlos Yano (CHG-001) | 1.2 | 0 | 0 | 0 | 0 | Resolvido | CHG-001 aplicada: CA-032 de ERR-036 para ERR-006. CA-014b e CA-037b adicionados. |
| REV-REQ-004 | 27/10/2026 | Claude (assistente IA; não independente) | 1.2 | 4 | n/c | n/c | n/c | Resolvido | Bloqueantes: ERR duplicados; DEC-020 × ERR-006; eliminação × NOT NULL; CPF de exemplo inválido. Demais achados não classificados por severidade. Validação mecânica (`tools/validar_consistencia.py`) e leitura cruzada: ERR duplicados (005/043, 007/029); DEC-020 × ERR-006; eliminação × NOT NULL; CPF de exemplo inválido; FL-001 sem entradas em `aguardando_cota`; FL-002 sem precedência; RN-008 citando tabela inexistente; regex de Perfil; tabelas de exemplos ausentes nos CAs de alto risco; contrato sem 30 operações. Corrigidos na v1.3 (CHG-002); lacunas de negócio viraram Q-005 a Q-011. |
| REV-REQ-005 | 28/10/2026 | Agente revisor-independente (IA, outro modelo, contexto isolado, somente leitura) | 1.4 | 2 | 10 | 17 | 5 | Resolvido | Bloqueantes: lista de eliminações no mesmo banco restaurado; colunas NOT NULL da aplicação impossíveis na criação. Altos: FL-002 presa com origem pulada; vínculo sem assinatura; histórico de atributos sem entidade; entidades faltantes (exportação, página, sessão, token, idempotência, falha de login); e-mail de outro tenant; texto curto; linhas de matriz e 'nenhuma das anteriores'; reserva fixa × deslizante; pedido do titular sem estado de falha; dedução de célula oculta. Corrigidos na v1.5 (CHG-004); decisões de negócio viraram Q-012 a Q-018. |
| REV-REQ-006 | 28/10/2026 | Agente revisor-independente (IA, outro modelo, contexto isolado, somente leitura) | 1.5 | 2 | 7 | 19 | 6 | Resolvido | Confirmou a correção dos achados da REV-REQ-005. Novos: identificação de páginas e conferência de assinatura sem acesso à imagem; CPF e dados do respondente em claro nos itens; matriz de autorização contraditória; cadastro existente não exposto para a escolha do CA-014; PedidoTitular sem transição para `falhou`; minimização dependente de configuração manual; dedução por diferença entre filtros; resolução de sessão sob RLS. Corrigidos na v1.6; Q-019 e Q-020 abertas. |
| REV-REQ-007 | 28/10/2026 | Agente revisor-independente (IA, outro modelo, contexto isolado, somente leitura) | 1.7 | 0 | 1 | 22 | 11 | Resolvido | Alto: DEC-071 (faixas de idade e recusa pelo complemento) ausente do contrato e dos CAs; corrigido na v1.8 (ERR-024 (descontinuado na v2.1), CA-009, CA-010, Filter). Médios e baixos registrados no PLANO §12.3 com incremento (DEC-073). |
| REV-REQ-008 | 28/10/2026 | Agente revisor-independente (verificação) | 1.8 | 0 | 2 | 8 | 11 | Resolvido | Altos: A-01 (MFA cadastrável com mfa_ativo) e A-02 (regra 1 da FL-002 capturava origem em branco/ilegível/rasurado/não se aplica). Corrigidos em 29/10/2026 (CA-026b; FL-002 e CA-018); verificação restrita ao diff: 0 bloqueantes, 0 altos (agente revisor-independente no modelo Sonnet, por falta de créditos do modelo configurado; aceito pelo responsável). Médios e baixos no PLANO §12.3; decisões de negócio viraram Q-021 a Q-029. |
| REV-REQ-009 | 05/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.4 | 1 | 3 | 9 | 7 | Resolvido | Rodada focada da CHG-014 (REQ, PLANO e contrato). Bloqueante: reconhecimento dos 5 campos sem regra (R-01). Altos: códigos gerados × exemplos (R-02), trava da RN-050 no `updateVersion` (R-03), CA-036 inalcançável e testes do IMP-002 (R-04). Decisões viraram Q-044 a Q-047 (DEC-143 a DEC-146); editoriais corrigidos no mesmo PR (RN-049 e RN-050 reescritas, FL-004 completa, tabela `tarefa_importacao`, `listFormImports`, escopo LGPD das páginas-modelo). |
| REV-REQ-010 | 05/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.4 | 0 | 0 | 8 | 13 | Resolvido | Rodada 2 da CHG-014: conferiu os R-01 a R-20 da REV-REQ-009 (R-04 parcial: dois testes do IMP-002 a mais, incluídos no PLANO §11). Critério de parada da DEC-073 atingido (0 bloqueantes, 0 altos). Decisões S-03, S-06 e S-16 viraram Q-048 a Q-050 (DEC-147 a DEC-149); editoriais S-01, S-02, S-04, S-05, S-07 a S-11 e S-13 a S-20 corrigidos no mesmo PR; S-12 (fixtures de altura) no PLANO §12.3 para o IA-TEST do IMP-006. |
| REV-REQ-011 | 06/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.7 | 1 | 5 | 11 | 9 | Resolvido | Rodada 1 (focada) da CHG-017, com REQ, PLANO e contrato. Bloqueante R-01 (limite de confiança da página) e médios R-11 e R-16 viraram as Q-066 a Q-068, respondidas como DEC-178 a DEC-180. Altos corrigidos: página informada prevalece depois do `identifyApplication` (R-02), restrição do respondente sem CPF (R-03), textos de LGPD e GX-001 com a página inteira (R-04), `papel_antigo` em `createForm`, `importForm` e `updateVersion` (R-05), regra 0 da FL-002 (R-06). Médios e baixos corrigidos (R-07 a R-10, R-12 a R-15, R-17 a R-21, R-23 a R-26); R-22 (finais de linha do PLANO) já estava juntado no #54 e ficou em LF, como os demais; as mensagens do ERR-006 e do ERR-039 ficam como estão (testes aceitos), com a ressalva no catálogo |
| REV-REQ-012 | 06/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.7 | 0 | 3 | 7 | 12 | Resolvido | Rodada 2 da CHG-017: dos R-01 a R-26, 20 resolvidos e 5 parciais (R-03, R-10, R-11, R-14, R-21), completados aqui. Altos: restrição do respondente sem data de nascimento (S-01, marca `origem_papel_antigo`), QR de contexto inválido não decide a versão (S-02), importação de papel antigo (S-03, Q-069 → DEC-181). S-07 e S-09 viraram as Q-070 e Q-071 (DEC-182, DEC-183). Demais médios e baixos corrigidos; em S-18, `origem_qr` e `papel_antigo` ficam opcionais na resposta até o IA-DEV do IMP-008, para não quebrar os testes aceitos |
| REV-REQ-013 | 06/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.7 | 0 | 1 | 5 | 9 | Resolvido | Rodada 3 da CHG-017, feita depois do aceite da CHG-017 e da junção do PR #55, portanto com o aceite registrado antes do critério de parada da DEC-073. Dos S-01 a S-22, os parciais (S-02, S-03, S-07, S-09, S-12, S-18, S-19) foram completados pelos T. Alto T-01 (DEC-180 contraditória) e médio T-02 viraram as Q-072 e Q-073 (DEC-184, DEC-185). Médios corrigidos: CA-058 novo e exemplos no CA-044 e no CA-057 (T-03); `SignatureUpload` e DEC-124 (T-04); RF-005 (T-05); `total_paginas` da versão e folha sem pergunta (T-06). Baixos T-07 a T-15 corrigidos. Em T-05 e T-09, o CA-054 e o CA-057 ficam só na linha do RF-013 da matriz, como os demais CAs da CHG-017 (PLANO §11.1, que agora cita o RF-004, o RF-005 e o RF-011): o validador exige o CA no incremento do RF, e o IMP-002, o IMP-003 e o IMP-006 já foram aceitos |
| REV-REQ-014 | 06/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.7 | 0 | 1 | 8 | 7 | Resolvido | Rodada 4 da CHG-017: dos T-01 a T-15, 14 resolvidos e T-02 parcial, completado aqui. Alto U-01 (momento de aplicar data e local) e médios U-02, U-05 a U-08 viraram as Q-074 a Q-079 (DEC-186 a DEC-191). Editoriais corrigidos: folhas mantidas no `identifyApplication` (U-03), "não publicada" na linha 1 da criação (U-04), lista de candidatos calculada na hora (U-09), massa do CA-055 e do CA-057 (U-10), DEC-179 e RN-016 (U-11), x-trace e catálogo (U-12), textos desatualizados (U-13), contrato e RF-013 (U-14), folga na RN-052 item 5 (U-15). U-16, anterior à CHG-017 (getPageImage × FL-001 e MFA no ARCHITECTURE.md), registrado no PLANO §12.3 |
| REV-REQ-015 | 06/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.7 | 0 | 0 | 5 | 9 | Resolvido | Rodada 5 da CHG-017, sobre o PR #56 já juntado: critério de parada da DEC-073 atingido (0 bloqueantes, 0 altos). Dos U-01 a U-15, 12 resolvidos e 3 parciais (U-07, U-12, U-13), completados aqui. V-01 e V-04 viraram as Q-080 e Q-081 (DEC-192, DEC-193). Editoriais corrigidos: V-02 (ordem no CA-058), V-03 (localização sem folha a refazer, CA-053 ex. 9), V-05 (`total_paginas` das versões já publicadas), V-06, V-07, V-09, V-10, V-12 e V-13 (CA-054 ex. 13). V-08 (CAs da DEC-187 e da DEC-189), V-11 (data e local na resposta da aplicação) e V-14 (região deslocada sem sobreposição) registrados no PLANO §12.3 para o IMP-008 |
| REV-REQ-016 | 07/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.8 | 1 | 1 | 10 | 6 | Resolvido | Rodada 1 (focada) da CHG-018, junto com a REV-PLANO-018. X-02 (transições da regra 1b), X-03, X-08 e X-12 levaram às Q-090 a Q-093 (DEC-204 a DEC-207). Editoriais corrigidos: X-01 (bloqueante: CA-060 com duas pessoas num envio, contra a DEC-008; agora dois envios), X-02 (pré-regra 1b antes da regra 0, evento único e linhas próprias de reabertura), X-04 e X-05 (massa do CA-059), X-06 (complemento ausente e limite de 200 na regra 7), X-07 (RN-045 e `getItemImage`), X-09 (`ordem_envio`), X-10 (CA-060 ex. 4 pela eliminação), X-11 (complemento no conjunto-ouro), X-13 (página `formulario` e `nao_consta` na coluna Arquivo), X-14, X-15, X-16, X-17 e X-18 (ERR-029 pela posição) |
| REV-REQ-017 | 07/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.8 | 0 | 3 | 6 | 6 | Resolvido | Rodada 2 da CHG-018, junto com a REV-PLANO-019. Dos X-01 a X-18, 16 resolvidos e 2 parciais (X-02, X-18), completados aqui. Y-01 virou a Q-094 (DEC-208). Editoriais corrigidos: Y-02 (reabertura substitui a 1b; complemento reaberto fica em `a_revisar`), Y-03 (eliminação fora do CA-060, no CA-023 e no TS-005 do IMP-004), Y-04 (`posicao` no ERR-029), Y-05 (ordem do `saveReview`), Y-06, Y-07 (PDF depois da publicação), Y-08, Y-09, Y-10, Y-11, Y-12, Y-13, Y-14 (massa do CA-059) e Y-15 (acesso e portabilidade na M-06) |
| REV-REQ-018 | 07/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.8 | 0 | 2 | 3 | 12 | Resolvido | Rodada 3 da CHG-018, junto com a REV-PLANO-020. Dos Y-01 a Y-15, 10 resolvidos e 3 parciais (Y-01, Y-02, Y-08), completados aqui; Y-11 a Y-13 sem resíduo. Z-01 virou a Q-095 (DEC-209), Z-04 a Q-096 (DEC-210) e Z-07 a Q-097 (DEC-211). Corrigidos: Z-02 ("item da pergunta" não exclui o complemento da conclusão, da criação e da revisão; CA-059 4c), Z-03 (marca `revisao_reaberta`; 6b com confiança 0,95), Z-05 (fixtures e exemplos 1a, 4 a 9 do CA-060), Z-06 (matriz e x-trace), Z-08 (`posicao` só no upload), Z-09, Z-10, Z-11 (teto de tokens), Z-12, Z-13 (corte pela migração 0010), Z-14, Z-15 (arquivo de trava do Word), Z-16 (regressão dos filtros no IMP-004) e Z-17 (ERR-018 no complemento em `aguardando_condicao`, CA-059 13) |
| REV-REQ-019 | 07/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.8 | 0 | 0 | 8 | 8 | Resolvido | Rodada 4 da CHG-018, junto com a REV-PLANO-021: critério de parada da DEC-073 atingido (0 bloqueantes, 0 altos). Dos Z-01 a Z-17, 14 resolvidos e 3 parciais (Z-03, Z-08, Z-13), completados aqui. AA-01 virou a Q-098 (DEC-212). Corrigidos todos os demais: AA-02 (`revisor_id` nulo nas mudanças do worker), AA-03 e AA-15 (`posicao` por operação), AA-04 (`revisao_reaberta` na ENT-011), AA-05 (reabertura só a partir de `concluida`), AA-06 (CA-059 4d, 4e e 6e), AA-07 (`descarte_aplicacao` das aplicações descartadas pela eliminação), AA-08 (ERR-001 e ERR-018), AA-09, AA-10 (marca descartada em `nenhuma_das_anteriores`), AA-11 (teto da chamada), AA-12 (FK com `tenant_id`), AA-13, AA-14 e AA-16; nenhuma pendência |
| REV-REQ-020 | 10/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.9 | 1 | 4 | 10 | 6 | Resolvido | Rodada 1 (focada) da CHG-019, com REQ, PLANO e contrato. Bloqueante R1-01 e médio R1-09 viraram as Q-105 e Q-106, respondidas como DEC-221 e DEC-222; os demais, editoriais, corrigidos: CA-052, CA-053 e CA-057 reescritos sem troca de formulário; `formulario_id` na aplicação; schema próprio do `addApplicationPages`; leitura de todas as folhas depois do `identifyApplication`; textos de recortes, localização com regiões e RN-039 alinhados à DEC-216 |
| REV-REQ-021 | 13/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.9 | 0 | 0 | 5 | 8 | Resolvido | Rodada 2 (focada) da CHG-019, junto com a REV-PLANO-023: critério de parada da DEC-073 atingido (0 bloqueantes, 0 altos). Os achados da rodada 1 estavam resolvidos. M-01 e B-04 viraram as Q-107 e Q-108, respondidas como DEC-223 e DEC-224; os demais, editoriais, corrigidos: CA-061 com os exemplos de `addApplicationPages` e `attachSignaturePage` (ERR-045), CA-044 (exemplo 4), CA-063 (novo, códigos sequenciais e limites), linha solta do CA-013 retirada, tamanhos da DEC-219 e do CA-028 (14 pt e 11 pt), referências e rastreio (RN-052, ERR-045, RF-007), `codigo` por tenant, pontuação da FL-001. Fica o B-07 no PLANO §12.3 |
| REV-REQ-022 | 13/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.9 | 0 | 0 | 5 | 11 | Resolvido | Rodada 3 (focada) da CHG-019, junto com a REV-PLANO-024: critério de parada da DEC-073 atingido (0 bloqueantes, 0 altos). Os achados da rodada 2 estavam resolvidos, com dois parciais (N-04, N-08). N-02, N-03 e N-05 viraram as Q-109 a Q-111, respondidas como DEC-225 a DEC-227; os demais, editoriais, corrigidos: `FileOrQrRejected` com todos os casos, ERR-019 no `PagesConflict`, `x-trace` e colunas de rastreio, CA-013 fora das listas do ERR-045, DEC-217 por tenant, DEC-219 com o aceite dos tamanhos, `formulario_id` "sim, exceto DEC-223", CA-063 (valores da API, `campos`, migração de formulários, concorrência), CA-061 (Dado e exemplos 13 e 14), CA-044 (exemplos 5 e 6) |
| REV-REQ-023 | 13/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.9 | 0 | 2 | 3 | 5 | Resolvido | Rodada 4 (focada) da CHG-019, junto com a REV-PLANO-025. Os dois altos vieram das DEC-225 e DEC-226: O-01 e O-02 viraram as Q-112 e Q-113, respondidas como DEC-229 e DEC-230; O-05 virou a Q-114 (DEC-231). Editoriais corrigidos: Dado do CA-061 e do CA-044, exemplos 14 a 16 do CA-061, linha nova da FL-001 (ERR-004 com formulário gravado), rastreio do ERR-004, ERR-018 e RF-015, texto do contrato. O check `contrato` passou com o arquivo de erros aceitos do `oasdiff` (DEC-228) |
| REV-REQ-024 | 13/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.9 | 0 | 0 | 5 | 7 | Resolvido | Rodada 5 (focada, a última do ciclo) da CHG-019, junto com a REV-PLANO-026: critério de parada da DEC-073 atingido (0 bloqueantes, 0 altos). Os achados da rodada 4 estavam resolvidos. Os 5 médios e 7 baixos foram registrados no PLANO §12.3 (R5-P01 a R5-P05 e R5-B01 a R5-B07), com responsável e incremento (IMP-010) |
| REV-REQ-025 | 13/11/2026 | Agente revisor-independente (IA, contexto isolado, somente leitura) | 2.9 | 0 | 0 | 4 | 7 | Resolvido | Rodada 6 (curta e dirigida) da CHG-019, junto com a REV-PLANO-027: critério de parada da DEC-073 atingido (0 bloqueantes, 0 altos). R5-P01 a R5-P05 e R5-B01 a R5-B07 conferidos. Corrigidos sem nova rodada: DEC-232 e DEC-225 (alcance, "outro formulário do mesmo projeto"), DEC-229 (zerar a `versao_id` de outro projeto), ENT-010 (`versao_id` nula em `descartada`), FL-001 (causas de ERR-039 no `identifyApplication`), catálogo do ERR-039, CA-061 (Dado e exemplo 19). R6-03 (versão de papel antigo) virou a Q-118, respondida como DEC-235 |

Fim do documento `REQ.md`