REQ.md — MinhaPesquisa
Especificação funcional (fonte da verdade para as IAs)

Status: APROVADO (Gate 1) · CHG-002 a CHG-011 aceitas (CHG-011 propagada na v2.1, IMP-005) · CHG-013 aceita na v2.3 · CHG-014 aceita na v2.4
Versão: 2.4
Data de aprovação: 24/10/2026 (v1.2) · 27/10/2026 (v1.3, CHG-002; v1.4, CHG-003) · 28/10/2026 (v1.5 e v1.6, CHG-004; v1.7, CHG-005; v1.8, CHG-006) · 29/10/2026 (v1.9, CHG-007; v1.10, CHG-008) · 03/11/2026 (v1.11, CHG-009; v1.12, CHG-010; v2.0 e v2.1, CHG-011) · 05/11/2026 (v2.3, CHG-013; v2.4, CHG-014)
Nível de rigor: Completo (DEC-001)
Perfil de plataforma: Bloco P — Web SaaS com dados pessoais (confirmado), aplicado no que couber à aplicação local da DEC-107
Responsável: Carlos Yano

Nota da v2.0 e da v2.1 (CHG-011): o produto deixa de ser um SaaS na nuvem e passa a ser uma aplicação local num notebook, usada por uma única pessoa (DEC-107 a DEC-112 e DEC-117). A v2.1 propaga as decisões às regras, aos requisitos, às telas, aos estados, aos critérios de aceite, ao catálogo de erros e à matriz (IMP-005). Saíram os CA-010, CA-016, CA-025, CA-026b, CA-034, CA-037b, CA-038 e CA-043, as telas TL-002, TL-013 e TL-014 e o TS-004. As entidades de perfis, vínculos, concessões, reservas e tokens continuam no dicionário porque as tabelas ficam no banco sem uso (DEC-116). Nos fluxos, estados e CAs, "digitalizador", "revisor", "administrador" e "analista" designam papéis que a própria usuária exerce (DEC-109).

Nota da v2.4 (CHG-014, Change Request de 05/11/2026 em `docs/historico/`): o formulário pode ser criado a partir de um formulário que já existe, em branco ou preenchido com dados fictícios, com a estrutura lida pela IA e curada pela usuária (RF-011, DEC-132 a DEC-139). Todo rascunho novo já nasce com os 5 campos obrigatórios (DEC-135), e o projeto ganha objetivo, coordenador e período de coleta (DEC-137). A exportação em formato longo do mesmo documento fica para o IMP-004 e ainda não entra nesta versão.

1. Resumo em linguagem simples

O MinhaPesquisa é uma aplicação local, instalada num notebook e usada por uma única pessoa (DEC-107), que transforma formulários de pesquisa respondidos em papel por público 60+ em dados estruturados, prontos para relatórios, dashboards e análises individuais ou por grupo. O sistema recebe imagens (scanner ou celular), identifica cada página por QR code, lê os campos por IA com confiança por campo, envia para revisão humana quando a confiança é baixa ou o valor é inválido, e produz dashboards e exportações (sem k-anonimato, DEC-110). Dados, imagens e backups ficam no notebook; só os recortes lidos vão ao provedor de IA na nuvem, que pode processar fora do Brasil (DEC-111), além das páginas de formulários-modelo sem dado pessoal enviadas na importação (DEC-133). Todo o tratamento de dados pessoais sensíveis de saúde segue a LGPD, com disco cifrado, backup cifrado, auditoria imutável, direitos do titular e transferência internacional de recortes para IA condicionada a parecer jurídico. A especificação está APROVADA para prosseguir à Fase 3 (Arquitetura) e, em seguida, à implementação por incrementos.

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

- Provedor de IA na nuvem para leitura de campos e para a leitura da estrutura de formulários importados (contrato sem retenção e sem uso para treino; pode processar fora do Brasil, DEC-111). É a única integração externa.
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
- Fila de revisão humana para campos com baixa confiança.
- Armazenamento estruturado por item de resposta.
- Relatórios e dashboards por projeto, por formulário, por respondente e por grupo dinâmico (filtros por idade, estado civil, condição de saúde etc.).
- Acesso por senha local, trilha de auditoria, exportação e direitos do titular.
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

#### Risco 1 — Páginas de pessoas diferentes na mesma aplicação (DEC-008)

A v1 não verifica automaticamente se todas as páginas de um envio são da mesma pessoa; a garantia é de quem digitaliza. O alerta do CA-013 detecta página faltante ou repetida, mas não a troca de páginas entre respondentes.

| Campo | Descrição |
|---|---|
| Causa | Agrupamento manual das páginas no upload |
| Impacto | Dados de saúde de dois respondentes misturados, sem aviso, contaminando a análise individual e os relatórios |
| Probabilidade | Maior em formulários de várias páginas e em lotes grandes de scanner |
| Mitigação na v1 | Procedimento operacional: digitalizar uma aplicação por vez e conferir as páginas antes de enviar; correção pela revisão, com auditoria |
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

2.9 Parâmetros de configuração (RN-008)

| Chave | Escopo | Padrão | Faixa | Quem altera | Origem |
|---|---|---|---|---|---|
| limite_confianca | plataforma | 1,00 até a calibração no conjunto-ouro, sem confirmação automática (DEC-127); depois, 0,90 (provisório, DEC-028) | 0..1, calibrado no conjunto-ouro | Administrador da plataforma, por script, com auditoria | DEC-028, DEC-059, DEC-127 |
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
| DEC-006 | 22/10/2026 | negócio | Consentimento | Digital; Assinatura no papel | Assinatura do respondente no formulário, conferida por pessoa; sem assinatura, fora dos relatórios | Base legal e rastreabilidade | definitivo | Alto | RF-008, CA-021, CA-044 |
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
| DEC-019 | 23/10/2026 | negócio | Identificação do respondente | Por nome+data; Por CPF | Identificado só pelo CPF, obrigatório, sempre conferido por pessoa; vínculo na conclusão | Unicidade e LGPD | definitivo | Alto | RF-005, CA-002, CA-014 |
| DEC-020 | 23/10/2026 | negócio | Campos obrigatórios | Nenhum; Alguns; Todos os 5 | Nome, nascimento, CPF, data e local bloqueiam a conclusão | Integridade mínima | definitivo | Alto | RF-004, RF-008, CA-032, CA-036 |
| DEC-021 | 23/10/2026 | negócio | Mascaramento de CPF | Sempre visível; Sempre mascarado; Exceções | Exceto na revisão, na portabilidade e na exportação linha a linha, com auditoria | Equilíbrio entre LGPD e operação | substituído (DEC-072) | Alto | RNF-003, CA-008 |
| DEC-022 | 23/10/2026 | técnica | Envio à IA | Página inteira; Recortes | Recortes dos campos; identificação e saúde em chamadas separadas; sem metadados | Minimização de dado sensível | definitivo | Alto | RF-007, RNF-011 |
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
| DEC-107 | 03/11/2026 | negócio | Forma de implantação do produto | SaaS multi-tenant na AWS; aplicação local num notebook | Aplicação local num único notebook Windows, para uma instituição (um tenant, criado na instalação) e uma única usuária. Banco, imagens e backups ficam no notebook, com disco cifrado (BitLocker) obrigatório; nada é guardado em nuvem. A única saída de dados são os recortes enviados ao provedor de IA (DEC-111). Instalação, parâmetros e manutenção por script local. Sem intenção de voltar a ser SaaS | Simplificar o protótipo e eliminar o custo de nuvem (CHG-011) | definitivo | Alto | RNF-001, RNF-002, RNF-011, DEC-017, DEC-018, DEC-038, Q-031 |
| DEC-108 | 03/11/2026 | negócio | Acesso ao sistema na aplicação local | Senha local sem MFA; senha + MFA; só o login do Windows | Uma conta, criada na instalação, com senha local (regras de senha e bloqueio por tentativas mantidos); sem MFA, sem convite e sem e-mail. Recuperação de senha por script no próprio notebook, com auditoria | Uma só pessoa no próprio notebook; a proteção principal é o login do Windows e o disco cifrado (CHG-011) | definitivo | Alto | RF-002, DEC-025, DEC-032, DEC-054, DEC-065, DEC-082 |
| DEC-109 | 03/11/2026 | negócio | Perfis com uma única usuária | Manter perfis; papel único | A usuária tem todas as permissões: administra, digitaliza e revisa, vê fichas individuais e exporta linha a linha (com auditoria). Saem perfis, vínculos a projetos e concessões de acesso individual | Com uma pessoa, a separação de perfis não protege nada (CHG-011) | definitivo | Alto | RF-001, RF-009, RF-010, DEC-014, DEC-015, DEC-060, DEC-080 |
| DEC-110 | 03/11/2026 | negócio | k-anonimato nos painéis e exportações | Manter; remover | Removido: sem grupo mínimo, sem faixas obrigatórias de idade e sem supressão de células; painéis e exportações mostram todos os grupos | Escolha do responsável para reduzir o IMP-004 (CHG-011); quem compartilhar painéis ou planilhas responde por não expor pessoas em grupos pequenos | definitivo | Alto | RF-009, RF-010, RNF-004, DEC-055, DEC-067, DEC-071, DEC-081 |
| DEC-111 | 03/11/2026 | negócio | Região do provedor de IA (RNF-011) | Só no Brasil; fora do Brasil permitido; decidir no parecer | O provedor de IA pode processar os recortes fora do Brasil, com contrato sem retenção e sem uso para treino (RNF-010) e base legal de transferência internacional (LGPD art. 33), confirmada no GX-001. Os dados guardados continuam só no notebook | Amplia a escolha do provedor no IMP-003 (CHG-011) | definitivo | Alto | RNF-010, RNF-011, Q-001, GX-001 |
| DEC-112 | 03/11/2026 | negócio | Operação com uma única usuária | Manter DEC-034; simplificar | Avisos só na tela (sem e-mail); link de imagem de 5 minutos mantido, servido só no notebook; sem reserva de aplicação para revisão (a proteção contra gravação concorrente fica no If-Match) | Não há disputa entre revisores (CHG-011) | provisório | Médio | RF-008, RNF-007, DEC-034, CA-043 |
| DEC-117 | 03/11/2026 | negócio | Backup do notebook (Q-031) | Diário em disco externo; semanal em disco externo; diário em nuvem cifrada | Backup diário, cifrado, em disco externo guardado longe do notebook; retenção de 90 dias (DEC-033); teste de restauração a cada mês | Com tudo num só notebook, o backup é a única proteção contra perda; diário limita a perda a um dia de digitação (CHG-011) | definitivo | Alto | DEC-107, DEC-033, DEC-114, RNF-008, Q-031 |
| DEC-119 | 04/11/2026 | negócio | Uso do sistema enquanto o GX-001 estiver pendente | Esperar o parecer para usar; usar só para teste | O MinhaPesquisa é usado só para teste, com dados sintéticos (Q-001), sem uso real com dados pessoais; o GX-001 não é exigido enquanto isso valer. Qualquer uso com dados reais exige o GX-001 e uma nova decisão | Escolha do responsável (CHG-012): recortes sintéticos enviados à IA não são dado pessoal, então não há transferência internacional a liberar | definitivo | Alto | GX-001, Q-001, DEC-111, DEC-122, RNF-011 |
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
| Respondente | Pessoa 60+ que responde formulários em papel. Identificada apenas pelo CPF. |
| Aplicação | Conjunto de páginas de um formulário respondidas por um respondente em uma data e local. |
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
O item de resposta DEVE ser um por pergunta; na matriz, um por linha; na múltipla escolha, a lista de códigos fica no mesmo item.

RN-010 — Valor e estado separados
O item DEVE guardar o valor lido pela IA, a confiança, o valor final e o estado como campos separados.

RN-011 — Respondente
O respondente DEVE ter nome, data de nascimento e CPF (obrigatório, identificador único), e PODE ter endereço. Perguntas marcadas como "campo do respondente" alimentam esses atributos.

RN-012 — CPF validado
O CPF DEVE ser validado na leitura (dígitos verificadores). CPF inválido, ilegível ou ausente vai para revisão, e a aplicação NÃO é concluída sem CPF válido.

RN-013 — CPF cifrado e hash
Para permitir busca com o CPF cifrado, o banco DEVE guardar também um hash com chave (HMAC). O CPF aparece mascarado, exceto na revisão (depois de `openReview`, também em `getApplication` e `getItemImage`, enquanto a aplicação continuar em revisão; DEC-112, DEC-126), no pedido de acesso e na portabilidade do titular e na exportação linha a linha (DEC-072), e cada exibição completa DEVE ser auditada (acao=EXIBICAO_CPF). Na ficha individual o CPF é sempre mascarado.

RN-014 — Correção de CPF
Se o revisor corrigir um CPF já vinculado, o vínculo DEVE ser refeito: a aplicação passa ao respondente do CPF corrigido (ou a um novo), com auditoria.

RN-015 — Correspondência de respondente
A identificação é só pelo CPF, sempre conferido por uma pessoa, e o vínculo acontece na conclusão da aplicação. CPF já cadastrado vincula ao respondente existente; CPF novo cria um respondente.

RN-016 — Data e local da aplicação
Todo formulário impresso DEVE trazer os campos "local" e "data da aplicação", lidos como os demais. Se o formulário não tiver esses campos ou vierem em branco, o digitalizador os informa; sem data e local, a aplicação NÃO é concluída.

RN-017 — Campos obrigatórios na publicação
Uma versão só PODE ser publicada se tiver perguntas marcadas como nome, data de nascimento e CPF do respondente (`campo_respondente`; o CPF com o tipo "CPF"), e como data e local da aplicação (`campo_aplicacao`). Todo rascunho novo sem cópia já nasce com essas perguntas (RN-050, DEC-135).

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
CPF obrigatório como identificador do respondente, armazenado cifrado (com hash para busca) e exibido mascarado.

RN-026 — Sem tamanho mínimo de grupo (RNF-004, DEC-110)
Painéis e exportações mostram todas as contagens, sem ocultar grupos pequenos.

RN-027 — Trilha de auditoria (RNF-005)
Trilha de auditoria imutável de acesso a dado individual, correção, exportação e mudança de status; a auditoria guarda só referências (quem, quando, qual registro, qual campo, qual ação), nunca os valores.

RN-028 — Logs sem dado sensível (RNF-006)
Logs sem dado de saúde, nome, CPF ou conteúdo lido.

RN-029 — Imagens privadas (RNF-007)
Imagens em pasta local privada do notebook, acesso só por link assinado local válido por 5 minutos (DEC-112).

RN-030 — Retenção configurável (RNF-008)
Retenção configurável por tenant, com expurgo de imagens e dados; expurgo em até 30 dias após o pedido ou o fim da retenção. Arquivos de exportação são apagados após `retencao_exportacao_dias` (seção 2.9).

RN-031 — Direitos do titular (RNF-009)
Direitos do titular: acesso, correção, eliminação e portabilidade, executados pela usuária em nome da instituição (tenant).

RN-032 — Provedor de IA sem retenção (RNF-010)
Provedor de IA sem retenção e sem uso dos dados para treino, com contrato (DPA).

RN-033 — Dados guardados no notebook (RNF-011, DEC-111)
Dados guardados só no notebook. O provedor de IA PODE processar os recortes fora do Brasil; isso é transferência internacional, liberada só após o parecer jurídico (GX-001) e o contrato com o provedor. As páginas de formulário-modelo da importação (RN-049) também vão ao provedor e podem ser processadas fora do Brasil, mas não contêm dado pessoal (DEC-133) e não dependem do GX-001.

RN-034 — Acessibilidade (RNF-012)
Acessibilidade WCAG 2.2 AA nas telas.

RN-035 — Tempo de leitura (RNF-013)
Tempo de leitura medido por página, com as páginas de uma aplicação lidas em paralelo; valor de referência de 95% das páginas lidas em até 2 minutos, medido com o provedor real sobre o conjunto-ouro (DEC-056). Na aplicação local, com uma usuária, não há meta de uploads simultâneos.

RN-036 — Custo de IA (RNF-014)
Custo de IA por página monitorado e com teto por tenant; ao atingir o teto, novas leituras ficam na fila e a usuária é avisada na tela (DEC-112), sem descartar nada.

RN-037 — Injeção de instrução pela imagem
A resposta da IA DEVE ser sempre validada contra o schema do formulário, e a IA NUNCA executa ações nem acessa outros dados.

RN-038 — Minimização do que vai para a IA
Só os recortes dos campos são enviados ao provedor, nunca a página inteira, e o cabeçalho de identificação NUNCA vai na mesma chamada que os campos de saúde. Única exceção: a importação de formulário (RN-049) envia a página inteira de um modelo em branco ou com dados fictícios, declarado pela usuária (DEC-133).

RN-039 — Chamadas separadas
Os campos de identificação (nome, CPF, endereço) e os de saúde são enviados em chamadas separadas, sem o identificador do respondente. A importação de formulário (RN-049) não se sujeita a esta regra porque a página do modelo não tem dado pessoal (DEC-133). O agrupamento usa `Pergunta.sensibilidade`: `identificacao` vai sempre sozinha; `saude` e `outro` podem ir juntas.

RN-040 — Metadados removidos
Metadados das imagens, incluindo GPS das fotos de celular, são removidos no upload (CA-029).

RN-041 — Papéis LGPD
Controlador: a instituição (tenant), dona do notebook. Operador: o provedor de IA, nos recortes enviados (as páginas de formulário-modelo da importação não têm dado pessoal, DEC-133). Base legal: cabe ao tenant (consentimento específico e destacado ou tutela da saúde). O sistema registra a evidência do consentimento por aplicação.

RN-042 — Versão publicada imutável
Versão publicada DEVE ser imutável; alterações criam nova versão em rascunho.

RN-043 — Sem reserva de aplicação (DEC-112)
Não há reserva. A gravação concorrente (por exemplo, em duas abas) é recusada pelo If-Match (ERR-017).

RN-044 — Conferência de assinatura
Na v1, a conferência da assinatura é sempre feita por uma pessoa, mesmo quando todos os campos foram confirmados automaticamente.

RN-045 — Contrato do motor de leitura
O motor de leitura (DEC-007) DEVE receber uma imagem recortada e um schema dos campos esperados (tipo, opções, faixa), e DEVE devolver, por campo: o valor lido, a confiança e a região da imagem de onde veio (bounding box). O motor NÃO decide o que vai para revisão; quem chama é que decide. O motor NÃO conhece formulário, pesquisa, tenant nem receita.

RN-047 — Estrutura de perguntas de matriz e múltipla escolha (DEC-010)
Pergunta do tipo `matriz` DEVE ter linhas com código estável (ENT-024) e opções comuns; gera um item de resposta por linha (RN-009). Pergunta do tipo `multipla_escolha` DEVE ter a opção "nenhuma das anteriores" com código `nenhuma_das_anteriores`. Pergunta do tipo `sim_nao` tem as opções fixas `sim` e `nao`, criadas automaticamente. Pergunta com `campo_respondente` ou `campo_aplicacao = aplicador` DEVE ter `sensibilidade = identificacao` (RN-039), definida automaticamente e não editável. Nas demais perguntas, `sensibilidade` é `saude` ou `outro`; `identificacao` nelas é recusada com ERR-001 (DEC-097). Sem a estrutura exigida, a publicação é recusada (ERR-036), com os códigos das perguntas com problema em `campos` (DEC-096).

RN-048 — Autenticação e sessão (Bloco P P.2, DEC-108)
Senha de 10 a 72 caracteres, com minúscula, maiúscula e dígito, fora da lista de senhas vazadas, guardada com Argon2id. Após 5 falhas em 15 minutos para o mesmo e-mail, exista ou não a conta, novas tentativas são bloqueadas por 15 minutos. Sessão expira após 30 minutos de inatividade ou 24 horas; no máximo 3 sessões ativas por usuário. Sem MFA, convite ou link de recuperação: a senha é redefinida por script local (DEC-108).

RN-046 — Conjunto-ouro e limites por domínio
O conjunto-ouro e os limites de confiança SÃO por domínio. O conjunto-ouro do MinhaPesquisa (formulários de pesquisa, público 60+) NÃO serve para o MeuRemedio (receitas médicas). Cada domínio DEVE ter seu próprio gabarito humano e suas próprias metas de erro silencioso.

RN-049 — Importação de formulário (DEC-132, DEC-133, DEC-136, DEC-138, DEC-139, DEC-143, DEC-144, DEC-146)
Entradas: o projeto, ativo (arquivado → ERR-001, DEC-146); o nome do formulário novo; a declaração `sem_dados_reais` (sem ela, ERR-001); e um ou mais arquivos nos tipos e limites da DEC-029, com no máximo 50 páginas no envio, varredura de malware e remoção de metadados como no RF-006 (ERR-029). As páginas são lidas na ordem do envio. O extrator é instruído a devolver só o que está impresso e a ignorar respostas e marcas feitas à mão; a garantia de que não há dado pessoal é a declaração da usuária (DEC-133). Por pergunta, o extrator devolve: enunciado; tipo (um dos 10 do ENT-007, ou desconhecido); rótulos das opções; linhas de matriz; faixa, em escala e número; e `campo_padrao`, um dos 5 campos da RN-050, `endereco`, `aplicador` ou nenhum (DEC-144, DEC-149). A saída é validada contra esse formato (RN-037); saída fora do formato conta como falha da chamada, com as mesmas retentativas (FL-004). Primeiro, a pergunta com `campo_padrao` é tratada pelo passo 1 abaixo; as demais são ajustadas pela tabela; cada ajuste gera um aviso com a página e a posição no original, sem texto lido. Os avisos ficam em ordem de página e posição.

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
| `multipla_escolha` sem opção de código `nenhuma_das_anteriores` | ganha a opção "Nenhuma das anteriores" no fim (RN-047) | — |
| `campo_padrao` já usado por pergunta anterior | fica como pergunta comum (DEC-144) | `campo_repetido` |
| Mais alta que a área útil de uma página do PDF sem o termo de consentimento (página 2 em diante) | descartada (DEC-143) | `nao_cabe` |

Em seguida, o sistema:
1. aplica a RN-050: a primeira pergunta com cada `campo_padrao` vira esse campo, com o código, o tipo e a marcação da tabela da RN-050 (ou, para `endereco` e `aplicador`, os da DEC-149), mesmo com enunciado vazio, que então recebe o enunciado padrão; as opções, linhas e faixa lidas para ela são descartadas, sem aviso; os 5 campos que faltarem são injetados; os códigos usados nesse passo ficam reservados;
2. gera os códigos das demais perguntas, opções e linhas pela transformação T: só no enunciado, tira a numeração do início (dígitos seguidos de `.`, `)` ou `-`, como em "1." e "3)"); tira os acentos ("ç" vira "c"); troca cada sequência de caracteres que não são letra de A a Z (maiúscula ou minúscula) nem dígito por `_`; tira `_` do início e do fim; corta em 40 caracteres e tira de novo `_` do fim. Pergunta em maiúsculas (RN-018); opção e linha em minúsculas (RN-019). Resultado vazio vira `P<página>_<posição>` na pergunta e `opcao_<ordem>` ou `linha_<ordem>` na opção e na linha. Código de pergunta já usado na versão (inclusive os reservados no passo 1), ou de opção já usado nas opções da mesma pergunta, ou de linha já usado nas linhas da mesma pergunta, ganha o sufixo `_2`, `_3` e assim por diante, na ordem do original, cortando antes o necessário para caber em 40 caracteres;
3. atribui sensibilidade `saude` às perguntas que não são da RN-050 (DEC-138) e não cria regras de salto (DEC-139);
4. distribui as perguntas pelas páginas do PDF do sistema: os 5 campos no início da página 1, na ordem da tabela da RN-050, e depois as demais na ordem do original, enchendo cada página até a altura disponível (mesma medida da DEC-143).
O resultado é um formulário novo no projeto, com a versão 1 em `rascunho`, e a lista de avisos. Se nenhuma pergunta lida entrar na versão (as reconhecidas no passo 1 contam; as injetadas não), a importação falha (ERR-044) e nada é criado. Cada página lida conta no teto de custo de IA (RN-036). O arquivo enviado é apagado quando a importação termina, com sucesso ou falha.

RN-050 — Campos obrigatórios padronizados (DEC-134, DEC-135, DEC-145)
Todo rascunho tem exatamente uma pergunta para cada marcação da tabela abaixo. O rascunho novo sem cópia (`createForm`, `createVersion` sem versão de origem e importação) nasce com as 5 no início da página 1, na ordem da tabela; na importação, a pergunta reconhecida mantém o enunciado do original (DEC-144) e as que faltarem vêm com o enunciado padrão. Na criação por cópia, a pergunta sem marcação com um dos 5 códigos ganha sufixo (DEC-147), as perguntas da origem com essas marcações são padronizadas como abaixo, e as que faltarem são injetadas no início da página 1. A cada gravação do rascunho (`updateVersion`), o sistema reaplica à pergunta de cada marcação o código, o tipo, `obrigatorio = true` e a sensibilidade da tabela, sem recusar (DEC-145); enunciado, ordem e página são da usuária. A reaplicação vem antes das demais validações da gravação, inclusive a das regras de salto (DEC-095). É recusado com ERR-001, com todas as violações juntas em `campos` (na ordem da tabela e depois na ordem das perguntas): o conteúdo sem a pergunta de uma das marcações (`campos`: os códigos da tabela que faltam); duas perguntas com a mesma marcação (`campos`: o código da tabela); e pergunta sem a marcação com um dos 5 códigos (`campos`: esse código). No rascunho criado antes da v2.4, a próxima gravação segue estas mesmas regras (reaplicação e recusa), sem injetar o que falta; até lá, a publicação continua protegida pela RN-017 (ERR-036, CA-036). Aqui `campos` traz os códigos da tabela; no ERR-036 da publicação, traz as marcações (`data_aplicacao`, CA-036).

| Código | Tipo | Enunciado padrão | Marcação | Sensibilidade |
|---|---|---|---|---|
| NOME | texto_curto | Nome completo | `campo_respondente = nome` | identificacao (RN-047) |
| DATA_NASCIMENTO | data | Data de nascimento | `campo_respondente = data_nascimento` | identificacao (RN-047) |
| CPF | cpf | CPF | `campo_respondente = cpf` | identificacao (RN-047) |
| DATA_APLICACAO | data | Data da aplicação | `campo_aplicacao = data_aplicacao` | outro |
| LOCAL_APLICACAO | texto_curto | Local da aplicação | `campo_aplicacao = local_aplicacao` | outro |

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
| tenant_id | tenant do projeto | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| nome | nome do projeto | varchar | sim | 200 | — | — | — | não | — | não |
| descricao | descrição | text | não | 5000 | — | — | NULL | não | — | não |
| objetivo | objetivo metodológico do ciclo de coleta (DEC-137) | text | não | 5000 | — | — | NULL | não | — | não |
| coordenador | nome do coordenador técnico (DEC-137); não vai à IA nem a log | varchar | não | 200 | — | — | NULL | não | — | pessoal |
| coleta_inicio | início previsto da coleta (DEC-137) | date | não | — | YYYY-MM-DD | — | NULL | não | — | não |
| coleta_fim | fim previsto da coleta; não pode ser anterior a `coleta_inicio` (DEC-137) | date | não | — | YYYY-MM-DD | ≥ coleta_inicio | NULL | não | — | não |
| status | status do projeto | enum | sim | — | — | ativo; arquivado | ativo | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-005 Formulario**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do formulário | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do formulário | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| projeto_id | projeto do formulário | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| nome | nome do formulário | varchar | sim | 200 | — | — | — | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-006 Versao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da versão | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da versão | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| formulario_id | formulário da versão | uuid | sim | 36 | UUID v4 | — | — | não | Formulario.id | não |
| numero | número da versão | int | sim | — | — | ≥ 1 | auto | sim (por form) | — | não |
| status | status da versão | enum | sim | — | — | rascunho; publicada | rascunho | não | — | não |
| publicada_em | data de publicação | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| mapa_layout | coordenadas normalizadas de cada campo por página, gravadas na publicação (DEC-048) | jsonb | não | — | JSON | — | NULL | não | — | não |
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
| sensibilidade | grupo de envio à IA (RN-039): identificação nunca vai junto com saúde/outro; `identificacao` só nas perguntas da RN-047 (DEC-097) | enum | sim | — | — | identificacao; saude; outro | saude | não | — | não |
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

**ENT-009 Respondente**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador do respondente | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant do respondente | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| nome | nome completo | varchar | sim | 200 | — | — | — | não | — | pessoal |
| data_nascimento | data de nascimento | date | sim (NULL só se anonimizado) | — | YYYY-MM-DD | não futura | — | não | — | pessoal |
| cpf_cifrado | CPF cifrado | bytea | sim (NULL só se anonimizado) | variável | AES-256-GCM (IV + cifrado + tag + id da chave) | — | — | não | — | sensível |
| cpf_hash | HMAC do CPF (busca) | bytea | sim (NULL só se anonimizado) | 32 | HMAC-SHA256 com chave do tenant | — | — | sim (por tenant, quando não nulo) | — | sensível |
| endereco | endereço | varchar | não | 500 | — | — | NULL | não | — | pessoal |
| anonimizado | respondente anonimizado | boolean | sim | — | — | true/false | false | não | — | não |
| criado_em | data de criação | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |

**ENT-010 Aplicacao**

| campo | significado | tipo | obrig | tamanho | formato | valores | padrão | único | FK | LGPD |
|---|---|---|---|---|---|---|---|---|---|---|
| id | identificador da aplicação | uuid | sim | 36 | UUID v4 | — | — | sim | — | não |
| tenant_id | tenant da aplicação | uuid | sim | 36 | UUID v4 | — | — | não | Tenant.id | não |
| projeto_id | projeto da aplicação | uuid | sim | 36 | UUID v4 | — | — | não | Projeto.id | não |
| versao_id | versão do formulário (NULL só em identificacao_pendente) | uuid | não | 36 | UUID v4 | — | NULL | não | Versao.id | não |
| respondente_id | respondente (só na conclusão) | uuid | não | 36 | UUID v4 | — | NULL | não | Respondente.id | pessoal (indireto) |
| data_aplicacao | data da aplicação (obrigatória em sem_assinatura e concluida) | date | não | — | YYYY-MM-DD | não futura | NULL | não | — | pessoal |
| local_aplicacao | local da aplicação (obrigatório em sem_assinatura e concluida) | varchar | não | 200 | — | — | NULL | não | — | pessoal |
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
| valor_ia | valor lido pela IA, no formato canônico (§5.4); cifrado (DEC-041) quando a pergunta tem `campo_respondente` | text | não | 2000 | — | — | NULL | não | — | sensível |
| confianca | confiança da IA (valor bruto, sem arredondamento) | decimal | não | 5,4 | — | 0.0000..1.0000 | NULL | não | — | não |
| valor_final | valor confirmado/corrigido, no formato canônico (§5.4); cifrado (DEC-041) quando a pergunta tem `campo_respondente` | text | não | 2000 | — | — | NULL | não | — | sensível |
| estado | estado do item | enum | sim | — | — | pendente_leitura; aguardando_condicao; confirmado_automaticamente; a_revisar; confirmado; corrigido; em_branco; ilegivel; rasurado; nao_se_aplica | pendente_leitura | não | — | não |
| revisor_id | usuário que revisou | uuid | não | 36 | UUID v4 | — | NULL | não | Usuario.id | não |
| revisado_em | data da revisão | timestamp | não | — | ISO 8601 UTC | — | NULL | não | — | não |
| regiao_imagem | região da imagem (bounding box) | jsonb | não | — | JSON | — | NULL | não | — | não |

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
| detalhes | referências adicionais em lista fechada por ação (ex.: filtro_aplicado com códigos de pergunta e opção); nunca valores pessoais nem texto livre | jsonb | não | — | JSON | — | NULL | não | — | não |
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

Todos os motivos são reaplicados após restauração de backup (CA-023, exemplo 4). Só `eliminacao` tem os demais efeitos do direito de eliminação (RN-031); `anonimizacao_reabertura` (DEC-078) e `descarte_aplicacao` (DEC-077) servem apenas para que o dado apagado não volte com o backup.

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
| numero_pagina | página da versão (NULL até identificar) | int | não | — | — | ≥ 1 | NULL | não | — | não |
| chave_storage | chave do objeto no bucket privado | varchar | sim | 500 | — | — | — | sim | — | não |
| sha256 | hash do arquivo sem metadados | bytea | sim | 32 | SHA-256 | — | — | não | — | não |
| registro_ok | registro da imagem pelos marcadores (DEC-048) | boolean | sim | — | — | true/false | false | não | — | não |
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
| escopo | escopo | enum | sim | — | — | agregado; linha_a_linha | — | não | — | não |
| status | situação | enum | sim | — | — | enfileirada; em_andamento; concluida; falhou; cancelada | enfileirada | não | — | não |
| chave_storage | objeto gerado (NULL até concluir ou após expurgo) | varchar | não | 500 | — | — | NULL | não | — | não |
| criado_em | data do pedido | timestamp | sim | — | ISO 8601 UTC | — | now() | não | — | não |
| expira_em | data de expurgo do arquivo | timestamp | não | — | ISO 8601 UTC | — | concluida + retencao_exportacao_dias | não | — | não |

Linha a linha contém dados pessoais em repouso: cancelada e apagada na eliminação do titular (CA-023).

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
Sucesso: projeto criado com status `ativo`.
Erro e timeout: ERR-001 (validação), ERR-002 (recurso não encontrado), ERR-016 (sem permissão).
Registros alterados: Projeto, HistoricoStatusProjeto, Auditoria.
Mensagens: "Projeto criado".
Estado final: projeto ativo ou arquivado, reversível.

**RF-004 — Cadastro de formulários, versões, perguntas, opções e regras de salto, e geração do PDF**
Quem executa: A usuária.
Quando pode: Quando o formulário está em rascunho.
Quando não pode: Quando a versão está publicada (imutável); quando faltam campos obrigatórios (nome, nascimento, CPF, data e local da aplicação); criar formulário em projeto arquivado (ERR-001, DEC-146); pergunta que não cabe na página (DEC-143).
Entradas: dados do formulário, perguntas, opções, regras de salto. O rascunho novo sem cópia já traz os 5 campos da RN-050 (DEC-135).
Sucesso: versão publicada, PDF gerado com QR code por página.
Erro e timeout: ERR-001 (validação), ERR-036 (campos obrigatórios ausentes), ERR-009 (versão publicada é imutável), timeout de 30 s na geração do PDF.
Registros alterados: Formulario, Versao, Pergunta, Opcao, RegraSalto, Auditoria.
Mensagens: "Versão publicada" ou a mensagem do ERR-036.
Estado final: versão publicada ou em rascunho.

**RF-005 — Cadastro de respondentes a partir do papel, com unicidade por CPF**
Quem executa: Sistema (automático na conclusão da aplicação).
Quando pode: Quando a aplicação é concluída com CPF válido.
Quando não pode: Quando o CPF é inválido, ilegível ou ausente.
Entradas: CPF, nome, data de nascimento, endereço (lidos do papel).
Sucesso: respondente criado ou vinculado ao existente.
Erro e timeout: ERR-006 (CPF ausente ou inválido na conclusão).
Registros alterados: Respondente, Aplicacao (respondente_id), Auditoria.
Mensagens: "Respondente vinculado" ou "Aguardando CPF válido".
Estado final: respondente existente ou novo.

**RF-006 — Upload de imagens (scanner em lote e foto de celular)**
Quem executa: A usuária.
Quando pode: Quando o projeto está ativo (CA-027).
Quando não pode: Quando o arquivo não é JPEG/PNG/PDF, passa de 20 MB (ou 50 páginas), falha na varredura de malware, ou QR inválido.
Entradas: arquivo(s) de imagem, projeto escolhido.
Sucesso: aplicação criada com as páginas, QR identificado, leitura disparada.
Erro e timeout: ERR-001 (validação ou projeto arquivado, CA-027), ERR-029 (arquivo recusado), ERR-004 (QR ilegível ou páginas inconsistentes), ERR-039 (QR de outro contexto), ERR-003 (aviso de cota); timeout de 30 s no storage.
Registros alterados: Aplicacao, ItemResposta (pendente_leitura), Auditoria.
Mensagens: "Upload concluído" ou a mensagem do ERR-029 com o motivo.
Estado final: aplicação em `em_leitura`, `aguardando_cota` ou `identificacao_pendente` (FL-001, tabela de criação).

**RF-007 — Leitura automática por IA, com confiança por campo**
Quem executa: Worker assíncrono (pg-boss).
Quando pode: Quando todas as páginas estão identificadas e o tenant tem cota (reserva atômica de orçamento antes de cada chamada).
Quando não pode: Quando o teto de custo de IA foi atingido (aplicações ficam em `aguardando_cota`).
Entradas: recortes dos campos (identificação e saúde em chamadas separadas, sem metadados).
Sucesso: itens com valor_ia, confianca e estado (confirmado_automaticamente ou a_revisar).
Erro e timeout: timeout de 30 s por chamada, retentativas em 1 e 2 s (3 chamadas no total, DEC-129); após 3 falhas, aplicação vai para `erro_leitura` (ERR-041); teto atingido → `aguardando_cota` (ERR-003).
Registros alterados: ItemResposta, Aplicacao (estado), Auditoria.
Mensagens: "Leitura concluída" ou a mensagem do ERR-041.
Estado final: aplicação em `em_revisao`, `aguardando_cota` ou `erro_leitura`.

**RF-008 — Fila de revisão humana e confirmação da aplicação**
Quem executa: A usuária (no papel de revisora).
Quando pode: Quando a aplicação está em `em_revisao`, `aguardando_cpf`, `sem_assinatura`, `identificacao_pendente` ou `erro_leitura` (conforme a ação, FL-001); sem reserva (DEC-112).
Quando não pode: Quando faltam campos obrigatórios; quando o estado não admite a ação.
Entradas: ações de revisão (confirmar, corrigir, em branco, ilegível, rasurado, não se aplica), conferência de assinatura, escolha do valor de cadastro em divergência (CA-014), identificação manual de páginas, nova leitura, página 1 assinada (CA-044).
Sucesso: todos os campos resolvidos; nome, data de nascimento, CPF válido, data e local informados (DEC-020); assinatura presente.
Erro e timeout: ERR-006 (campos obrigatórios ausentes), ERR-017 (edição concorrente, por exemplo em duas abas), ERR-018 (ação inválida no estado atual).
Registros alterados: ItemResposta (estado, valor_final, revisor_id), Aplicacao (estado, respondente_id, concluida_em), Auditoria.
Mensagens: "Aplicação concluída" ou "Aguardando [campo obrigatório]".
Estado final: aplicação `concluida`, `aguardando_cpf`, `sem_assinatura` ou `descartada`.

**RF-009 — Relatórios e dashboards por projeto, formulário, respondente e grupo**
Quem executa: A usuária.
Quando pode: Sempre que tiver sessão; todos os projetos (DEC-109).
Quando não pode: Filtro fora das regras abaixo.
Entradas: filtros (idade, estado civil, resposta a pergunta, período).
Sucesso: dashboard com gráficos por pergunta e cruzamento por uma segunda pergunta, com todas as contagens (sem k-anonimato, DEC-110).
Erro e timeout: ERR-002 (projeto inexistente), ERR-001 (filtro fora das regras abaixo), timeout de 30 s.
Regras de filtro: idade por faixas `<60`, `60-64`, `65-69`, `70-74`, `75-79`, `80-84`, `85-89`, `90+` (formato do filtro, sem papel de anonimização, DEC-110); filtro por resposta só em perguntas categóricas (`escolha_unica`, `multipla_escolha`, `sim_nao`, `escala`, `matriz` por linha), com operadores `igual`, `diferente` ou `em` sobre códigos de opção; em `escala`, só `igual` ou `diferente` com um valor (DEC-075); em `multipla_escolha`, o filtro significa "marcou a opção".
Registros alterados: Auditoria (abertura de ficha); Grupo (ao salvar grupo).
Mensagens: "Nenhum dado para os filtros escolhidos" quando não há respondentes.
Estado final: dashboard exibido.

**RF-010 — Exportação em CSV/XLSX, auditoria e direitos do titular (LGPD)**
Quem executa: A usuária (exportação agregada ou linha a linha, direitos do titular e auditoria; DEC-109).
Quando pode: Sempre que tiver sessão.
Quando não pode: Pedido do titular em estado que não permite a ação.
Entradas: formato (CSV/XLSX), rótulos ou códigos, filtros; para direitos do titular, CPF do titular e tipo do pedido. Consulta da trilha de auditoria (TL-011).
Sucesso: arquivo gerado, auditoria registrada.
Erro e timeout: ERR-018 (pedido em estado que não permite execução), timeout de 60 s no job.
Registros alterados: Auditoria, PedidoTitular (se for direito do titular).
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
| RNF-011 | Dados guardados só no notebook; IA pode processar fora do Brasil após o GX-001 (DEC-111) | Decisão + evidência |
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
| TL-004 | Cadastro de formulário | carregando, vazio, sucesso (salvo), erro (validação), sem permissão, tempo esgotado |
| TL-005 | Upload de imagens | carregando, vazio, sucesso (aplicação criada), erro (arquivo recusado), sem permissão, tempo esgotado |
| TL-006 | Fila de revisão | carregando, vazio (fila vazia), sucesso (lista), erro, sem permissão, tempo esgotado |
| TL-007 | Revisão lado a lado | carregando, vazio, sucesso (salvo), erro (validação ou edição concorrente), sem permissão (estado não admite revisão), tempo esgotado |
| TL-008 | Dashboard | carregando, vazio (sem dados), sucesso (gráficos), erro, sem permissão, tempo esgotado |
| TL-009 | Ficha individual | carregando, vazio, sucesso (evolução), erro, sem permissão (sessão expirada), tempo esgotado |
| TL-010 | Exportação | carregando, vazio, sucesso (arquivo gerado), erro, sem permissão, tempo esgotado |
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
| 1 | Alguma página sem QR legível ou sem registro de imagem possível (DEC-048) | identificacao_pendente | ERR-004 |
| 2 | QR de versão inexistente, de outro tenant ou de outro projeto | identificacao_pendente | ERR-039 |
| 3 | Página faltante, repetida, de outro formulário ou além do total da versão (CA-013, CA-040) | identificacao_pendente | ERR-004 |
| 4 | Teto de custo de IA do tenant atingido | aguardando_cota | ERR-003 (aviso) |
| 5 | Nenhuma das anteriores | em_leitura | — |

Transições:

| Estado atual | Evento | Condição | Ação | Próximo estado | Quem dispara |
|---|---|---|---|---|---|
| identificacao_pendente | digitalizador informa formulário, versão e página ou corrige as páginas | páginas completas e coerentes; teto não atingido | dispara leitura | em_leitura | digitalizador |
| identificacao_pendente | digitalizador informa formulário, versão e página ou corrige as páginas | páginas completas e coerentes; teto atingido | enfileira | aguardando_cota | digitalizador |
| identificacao_pendente | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| aguardando_cota | cota disponível | teto não atingido | dispara leitura | em_leitura | sistema (job) |
| aguardando_cota | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| em_leitura | leitura concluída | todos os campos lidos | avalia estados dos itens (FL-002) | em_revisao | worker |
| em_leitura | teto atingido antes de ler todas as páginas | — | preserva itens já lidos; páginas restantes aguardam | aguardando_cota | worker |
| em_leitura | leitura falhou 3x | timeout ou erro | audita | erro_leitura | worker |
| em_leitura | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| erro_leitura | digitalizador manda ler de novo | teto não atingido | dispara leitura | em_leitura | digitalizador |
| erro_leitura | digitalizador manda ler de novo | teto atingido | enfileira | aguardando_cota | digitalizador |
| erro_leitura | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| em_revisao | digitalizador conclui | todos os itens resolvidos (FL-002); nome, data de nascimento, CPF válido, data e local informados (DEC-020); assinatura presente | grava manter_cadastro, vincula respondente, audita | concluida | digitalizador |
| em_revisao | digitalizador conclui | CPF ausente, ilegível ou inválido | audita; ERR-006 | aguardando_cpf | digitalizador |
| em_revisao | digitalizador conclui | assinatura marcada como ausente; demais condições atendidas | grava manter_cadastro; NÃO vincula respondente (DEC-064); audita | sem_assinatura | digitalizador |
| em_revisao | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| aguardando_cpf | digitalizador informa CPF válido | — | volta para revisão | em_revisao | digitalizador |
| aguardando_cpf | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| sem_assinatura | digitalizador envia página 1 assinada e confirma a assinatura como presente (RN-044) | QR confere versão e página; divergências de cadastro iguais às gravadas | grava a imagem como `assinatura` (a página 1 original é mantida); confere assinatura sem reler os outros campos; vincula respondente com o manter_cadastro gravado; audita | concluida | digitalizador |
| sem_assinatura | digitalizador envia página 1 assinada e confirma a assinatura como presente | divergências de cadastro mudaram desde a conclusão (outra aplicação alterou o cadastro ou o respondente foi eliminado) | grava a imagem; recalcula divergências; audita; aviso ERR-018 | em_revisao | digitalizador |
| sem_assinatura | digitalizador corrige a conferência (assinatura marcada como ausente por engano) | — | volta para revisão, preservando os itens | em_revisao | digitalizador |
| sem_assinatura | digitalizador descarta | — | apaga imagens e valores lidos dos itens (DEC-077), audita | descartada | digitalizador |
| concluida | digitalizador ou admin reabre com motivo | — | sai dos relatórios, audita | em_revisao | digitalizador/admin |
| descartada | — | estado final | — | — | — |

Precedência na conclusão (a primeira que se aplica decide):

1. Algum item fora dos estados resolvidos (FL-002) → ERR-022; nada é gravado.
2. CPF ausente, ilegível ou inválido → resposta de sucesso com aviso ERR-006 e estado `aguardando_cpf` (a transição é gravada).
3. Nome, data de nascimento, data ou local ausentes, ilegíveis, rasurados ou marcados como não se aplica → ERR-006; nada é gravado; permanece em `em_revisao` (DEC-079).
4. Assinatura ausente → `sem_assinatura`; presente → `concluida`.

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
- Leitura por IA: timeout de 30 s por chamada, retentativas em 1 e 2 s (DEC-129); após 3 falhas, estado final `erro_leitura`.

**FL-002 — Estado do item de resposta**

Ordem de avaliação ao fim da leitura de um item (a primeira regra que se aplica decide; a comparação de confiança usa o valor bruto, sem arredondamento):

| Ordem | Regra | Estado |
|---|---|---|
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

"Origem resolvida" (regras 2 e 3) significa origem em `confirmado_automaticamente`, `confirmado` ou `corrigido`. A regra 1 vale só para os três estados que listam; origem em `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica` segue para as regras 4 e 4a. Assim, todo estado da origem cai em exatamente uma das regras 1, 2/3, 4 ou 4a (ou, se a regra de salto não mandar pular, segue para as regras 5 a 9).

"Condição de salto resolvida" (evento da tabela abaixo) é a saída da origem de `pendente_leitura`, `aguardando_condicao` ou `a_revisar` para qualquer outro estado.

"Item resolvido" (usado na conclusão, FL-001) significa item em `confirmado_automaticamente`, `confirmado`, `corrigido`, `em_branco`, `ilegivel`, `rasurado` ou `nao_se_aplica`. Itens em `pendente_leitura`, `aguardando_condicao` ou `a_revisar` impedem a conclusão (ERR-022).

| Estado atual | Evento | Condição | Ação | Próximo estado | Quem dispara |
|---|---|---|---|---|---|
| pendente_leitura | leitura concluída | regra 8 | — | confirmado_automaticamente | worker |
| pendente_leitura | leitura concluída | regras 3, 4 (destino preenchido), 4a, 5, 6, 6a, 7 ou 9 | — | a_revisar | worker |
| pendente_leitura | leitura concluída | regra 1 | — | aguardando_condicao | worker |
| pendente_leitura | leitura concluída | regra 2 ou 4 (destino em branco) | — | nao_se_aplica | worker |
| aguardando_condicao | condição de salto resolvida | regra 2 | — | nao_se_aplica | worker |
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
| em_branco / ilegivel / rasurado / nao_se_aplica | revisor altera | — | valor_final atualizado | confirmado ou corrigido | digitalizador |
| confirmado / corrigido / em_branco / ilegivel / rasurado / nao_se_aplica | revisor aplica outra ação de revisão | aplicação em `em_revisao` ou `aguardando_cpf` | aplica a ação | estado da ação (em_branco, ilegivel, rasurado, nao_se_aplica, confirmado ou corrigido) | digitalizador |
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
| Provedor de IA (estrutura de uma página na importação, RN-049) | 60 s | 1 e 2 s (3 chamadas por página no total) | importação em `falhou` (ERR-044) |
| Armazenamento de objetos (upload/download) | 30 s | 1, 2 e 4 s | ERR-020 (nada é gravado) |
| Geração do PDF imprimível | 30 s | 1, 2 e 4 s | ERR-020; versão permanece como está |
| Job de exportação e de pedido do titular | 60 s | sem retentativa automática (job enfileirado) | PedidoTitular em `falhou` (FL-003), com auditoria e alerta; exportação em `falhou` |

7. Histórias de usuário e critérios de aceite (Gherkin com dados concretos)

Regra do nível Completo: Todos os critérios de aceite de alto risco (segurança, LGPD, dinheiro, isolamento) DEVEM conter tabelas de dados concretos (Exemplos) para eliminar ambiguidade.

**US-001 — Como digitalizador, quero fazer upload de imagens de um formulário para que o sistema agrupe as páginas e inicie a leitura.**
Relacionado a: RF-006, RF-008, CA-003, CA-004, CA-013, CA-029, CA-039, CA-040

CA-003 — Upload identifica o formulário e a página
Dado que o digitalizador está na tela de upload do projeto "Saúde Idoso"
Quando ele envia as 4 páginas da versão 1 em JPEG, uma por arquivo, todas com QR code legível
Então o sistema identifica o formulário, a versão e cada página sem digitação, inclusive a página 2 (DEC-093)
E a aplicação entra no estado "Em leitura"

CA-004 — Upload sem QR legível
Dado que o digitalizador está na tela de upload do projeto "Saúde Idoso"
Quando ele envia um arquivo JPEG de 2 MB cujo QR code está danificado ou ilegível
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
Relacionado a: RF-005, RF-008, CA-002, CA-014, CA-032

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
E o histórico de atributos do respondente (ENT-023) é apagado
E `motivo_descarte`, `motivo_reabertura` das suas aplicações e a `descricao` do pedido são sobrescritos
E as aplicações em andamento do titular são descartadas
E um registro é inserido na `ListaEliminacoes` com o ID interno do respondente, válido por 180 dias
E a auditoria registra a execução sem conter o CPF original
E o expurgo físico ocorre em até 30 dias
E a lista de eliminações de 180 dias garante a reaplicação do expurgo caso um backup seja restaurado dentro da janela de retenção de 90 dias (DEC-033)
E uma aplicação futura com o mesmo CPF cria um respondente novo

| Exemplo | Situação do titular antes do pedido | Resultado esperado após a execução |
|---|---|---|
| 1 | 2 aplicações concluídas | Itens sobrescritos; imagens marcadas para expurgo; aplicações fora de relatórios |
| 2 | 1 aplicação em `em_revisao` | Aplicação descartada; imagens marcadas para expurgo |
| 3 | 1 exportação linha a linha pendente | Exportação cancelada e arquivo apagado |
| 4 | Backup restaurado 20 dias depois | Job reaplica a eliminação pela `ListaEliminacoes`; nenhum dado do titular volta |
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
Dado que a versão 1 do formulário "Demografia" está publicada
Quando o administrador gera o PDF
Então cada página traz um QR com identificador opaco da versão e o número da página
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
Quando o QR indica página faltante, repetida ou de outro formulário
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
Dado que uma página tem QR apontando para versão inexistente
Quando o upload termina
Então a página vai para "identificacao_pendente"
E nada é lido
E a tentativa é auditada

CA-040 — Montagem da aplicação no envio
Dado que o digitalizador escolhe o projeto e envia as páginas
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
Dado que a aplicação está no estado "sem_assinatura"
Quando o digitalizador envia a imagem da página 1 contendo a assinatura
Então o sistema confere o QR code da versão e da página
E a assinatura é conferida sem reler os outros campos
E a aplicação muda para o estado "concluida"

**US-011 — Como usuária, quero criar um formulário a partir de um formulário em papel que já tenho, sem digitar pergunta por pergunta.**
Relacionado a: RF-011, CA-045, CA-046, CA-047, CA-048

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
| RF-007 | RN-021, RN-037, RN-038, RN-039 | ENT-011 | FL-001, FL-002 | US-002, US-007 | CA-005, CA-006, CA-015, CA-018, CA-019, CA-030, CA-041 | TS-003, TS-007 | processAIReading (interna), getQuotaStatus | CMP-MotorIA | IMP-003 |
| RF-008 | RN-016, RN-043, RN-044 | ENT-009, ENT-010, ENT-011, ENT-023 | FL-001, FL-002 | US-002, US-003, US-007 | CA-007, CA-008, CA-020, CA-021, CA-033, CA-042, CA-044 | — | listReviewQueue, getApplication, openReview, getItemImage, saveReview, confirmApplication, attachSignaturePage, retryReading, discardApplication, reopenApplication | CMP-Revisao | IMP-003 |
| RF-009 | RN-026 | ENT-012 | FL-001 | US-004, US-007, US-008 | CA-009, CA-011, CA-017, CA-021, CA-031 | — | getDashboardAggregated, listGroups, createGroup, deleteGroup, findRespondent, getIndividualRecord | CMP-Dashboard | IMP-004 |
| RF-010 | RN-027, RN-030, RN-031 | ENT-009, ENT-013, ENT-018, ENT-019, ENT-023, ENT-026 | FL-001, FL-003 | US-005, US-009 | CA-021, CA-022, CA-023, CA-024 | TS-005, TS-008 | exportData, getExport, createDataSubjectRequest, listDataSubjectRequests, getDataSubjectRequest, executeDataSubjectRequest, cancelDataSubjectRequest, listAuditEvents | CMP-LGPD | IMP-004 |
| RF-011 | RN-017, RN-018, RN-019, RN-036, RN-037, RN-038, RN-047, RN-049, RN-050 | ENT-004, ENT-005, ENT-006, ENT-007, ENT-008, ENT-024, ENT-031 | FL-004 | US-006, US-011 | CA-045, CA-046, CA-047, CA-048, CA-049 | — | importForm, listFormImports, getFormImport, extractFormStructure (interna) | CMP-Forms | IMP-006 |

8.2 Catálogo de Erros (ERR)

Formato Problem Details (RFC 9457). Mensagens exatas em pt-BR. Sem stack trace ou detalhes internos. O sistema NUNCA revela se um recurso existe quando há suspeita de violação de isolamento (retorna 404 genérico).

| err_id | codigo | http_status | quando_ocorre | mensagem_ao_usuario | log_gerado | estado_resultante | requisitos | status |
|---|---|---|---|---|---|---|---|---|
| ERR-001 | VALIDATION_FAILED | 400 | Campo obrigatório ausente, formato inválido, regra de negócio violada (inclusive regra de salto inválida, DEC-095; sensibilidade `identificacao` fora da RN-047, DEC-097; violação da RN-050; pergunta que não cabe na página, DEC-143; `coleta_fim` antes de `coleta_inicio`, DEC-137; falta da declaração `sem_dados_reais`, DEC-133) ou upload, criação ou importação de formulário em projeto arquivado (CA-027, DEC-146). | Revise os campos destacados e tente novamente. | warn: validation_failed (sem dados pessoais) | Nada é gravado | RF-003, RF-004, RF-006, RF-011, CA-027, CA-047, CA-048, CA-049 | ativo |
| ERR-002 | RESOURCE_NOT_FOUND | 404 | Recurso inexistente ou de outro tenant. | O recurso solicitado não existe ou você não tem acesso. | warn: resource_not_found_or_out_of_scope (auditoria acionada) | Nada é gravado | RN-002, CA-012 | ativo |
| ERR-003 | AI_QUOTA_EXCEEDED | — | Teto de custo de IA do tenant atingido; aviso exibido na tela (estado assíncrono, não é resposta HTTP de erro). | O processamento está pausado: o teto mensal de custo de IA foi atingido. | info: ai_quota_exceeded (tenant_id) | Aplicação ou importação de formulário em `aguardando_cota` | RF-007, RF-011, CA-030, CA-047, DEC-035 | ativo |
| ERR-004 | INVALID_QR_CODE | 400 | QR ilegível ou ausente, registro da imagem impossível, ou páginas faltantes, repetidas ou excedentes. | Não foi possível identificar o formulário nesta página. Informe manualmente. | warn: qr_invalid_or_missing | Aplicação em `identificacao_pendente` | RF-006, CA-004, CA-013, CA-040 | ativo |
| ERR-005 | RESERVATION_EXPIRED | 409 | Descontinuado pela CHG-002: duplicava o ERR-043 (também descontinuado, CHG-011). | Descontinuado. | — | — | CHG-002 | descontinuado |
| ERR-006 | MISSING_MANDATORY_FIELDS | 400 | Tentativa de concluir aplicação sem nome, data de nascimento, CPF válido, data ou local, ou com um deles ilegível, rasurado ou marcado como não se aplica (DEC-020, DEC-079). | A aplicação não pode ser concluída sem nome, data de nascimento, CPF válido, data e local da aplicação. | warn: missing_mandatory_fields | CPF ausente ou inválido: sucesso com este aviso e estado `aguardando_cpf`; demais campos: nada é gravado, permanece em `em_revisao` | RF-005, RF-008, CA-032 | ativo |
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
| ERR-018 | INVALID_STATE | 409 | Ação não permitida no estado atual do recurso (FL-001, pedido do titular já executado). | Esta ação não é permitida no estado atual. | info: invalid_state_transition | Nada é gravado | RF-008, RF-010 | ativo |
| ERR-019 | IDEMPOTENCY_CONFLICT | 409 | Chave de idempotência reutilizada com conteúdo diferente. | Esta solicitação já foi enviada com outros dados. Gere uma nova solicitação. | warn: idempotency_conflict | Nada é gravado | RF-006, Bloco P.8 | ativo |
| ERR-020 | DEPENDENCY_UNAVAILABLE | 503 | Pasta de imagens, antimalware ou outro serviço local indisponível após as retentativas. | Serviço temporariamente indisponível. Tente novamente em instantes. | error: dependency_unavailable (serviço) | Nada é gravado | RF-004, RF-006 | ativo |
| ERR-021 | SESSION_LIMIT_REACHED | 409 | Usuário já tem 3 sessões ativas (Bloco P P.2). | Você já tem 3 sessões ativas. Saia em outro dispositivo ou aguarde até 30 minutos sem uso para entrar. | info: session_limit_reached | Nenhuma sessão nova | RF-002 | ativo |
| ERR-022 | ITEMS_UNRESOLVED | 400 | Tentativa de concluir com itens em `pendente_leitura`, `aguardando_condicao` ou `a_revisar`. | Ainda há campos a revisar nesta aplicação. | info: items_unresolved | Nada é gravado | RF-008, FL-002 | ativo |
| ERR-023 | EMAIL_UNAVAILABLE | 400 | Descontinuado pela CHG-011: sem criação de usuários (DEC-109). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-024 | QUERY_REFUSED | 400 | Descontinuado pela CHG-011: sem k-anonimato (DEC-110). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-029 | FILE_REJECTED_LIMIT | 400 | Upload ou importação de formulário recusados. Motivos exatos: "excede o limite de 20 MB"; "excede o limite de 50 páginas"; "tipo de arquivo não permitido"; "risco de segurança detectado". | Arquivo recusado: [motivo]. | warn: file_rejected (motivo) | Nada é gravado | RF-006, RF-011, CA-029, CA-047, RN-040 | ativo |
| ERR-036 | MISSING_PUBLISH_FIELDS | 400 | Tentativa de publicar versão sem campos obrigatórios (nome, nascimento, CPF, data, local) ou com pergunta fora da estrutura da RN-047 ou que não cabe na sua página (DEC-143); `campos` traz os campos que faltam e os códigos das perguntas com problema (DEC-096). | Publicação recusada: faltam [lista dos campos]. | warn: missing_publish_fields | Versão permanece em `rascunho` | RF-004, CA-036, RN-017 | ativo |
| ERR-039 | QR_INVALID_CONTEXT | 400 | QR, ou versão informada no `identifyApplication`, aponta para versão inexistente, de outro tenant ou de projeto diferente do envio (DEC-100). | QR code inválido para o contexto atual. Informe manualmente. | warn: qr_invalid_context | Aplicação em `identificacao_pendente` | RF-006, CA-039 | ativo |
| ERR-041 | AI_READING_FAILED | — | A leitura falhou em 3 tentativas automáticas consecutivas (estado assíncrono, exibido na fila). | Erro de leitura. O digitalizador pode mandar ler de novo. | error: ai_reading_failed (3 retries) | Aplicação em `erro_leitura` | RF-007, CA-041 | ativo |
| ERR-043 | RESERVATION_CONFLICT | 409 | Descontinuado pela CHG-011: sem reserva de aplicação (DEC-112). | Descontinuado. | — | — | CHG-011 | descontinuado |
| ERR-044 | FORM_IMPORT_FAILED | — | A importação de formulário não reconheceu nenhuma pergunta, ou 3 chamadas à IA falharam na mesma página (estado assíncrono, exibido na consulta da importação). | Não foi possível ler o formulário. Confira o arquivo e tente de novo, ou cadastre as perguntas à mão. | error: form_import_failed (motivo, página) | Importação em `falhou`; nada é criado | RF-011, CA-047 | ativo |

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
| Q-036 | 05/11/2026 | Correção de perspectiva antes do recorte | A DEC-048 pede correção de perspectiva antes do recorte; a implementação (DEC-124) só confere se os 4 marcadores aparecem. No scanner de mesa a página sai reta; na foto de celular, um recorte deslocado pode levar nome ou CPF junto com uma pergunta de saúde (RN-038; revisão focada do IMP-003, F-13) | A: exigir os 4 marcadores dentro de uma margem e mandar à revisão, sem leitura, a página fora dela | B: corrigir a perspectiva pelos 4 marcadores antes de recortar (DEC-048) | C: A agora e B quando a digitalização por celular entrar | C | Até a resposta, vale a DEC-124: marcadores conferidos, sem correção de perspectiva; a digitalização é feita no scanner de mesa | Adiada pelo responsável (Carlos Yano, 05/11/2026): no scanner é fácil garantir a página reta; decidir quando a digitalização por celular entrar, antes do piloto. | aberta | DEC-048, DEC-124, RN-038 |
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
| Q-051 | 05/11/2026 | Enunciado padrão de endereço e aplicador | A RN-049 (passo 1) dá o enunciado padrão à pergunta reconhecida com enunciado vazio, mas a DEC-149 não fixa o enunciado de `endereco` e `aplicador`, que não estão na tabela da RN-050 (IA-DEV do IMP-006) | A: "Endereço" e "Aplicador" | B: "Endereço do respondente" e "Nome do aplicador" | — | A | Até a resposta, vale A, provisório no IA-DEV do IMP-006 (DEC-151) | — | aberta | RN-049, DEC-149, DEC-151 |

10. Gates externos (GX)

Gates externos são condições que devem ser cumpridas antes de uma fase específica (geralmente a Fase 6 - Produção). Eles não bloqueiam o desenvolvimento com dados sintéticos, mas bloqueiam a liberação para usuários reais.

| id | descricao | tipo | responsavel_externo | condicao_de_cumprimento | bloqueia | status | evidencia | data |
|---|---|---|---|---|---|---|---|---|
| GX-001 | Parecer jurídico sobre tratamento de dados (DPA) e transferência internacional (LGPD Art. 33) para o provedor de IA. | jurídico | Advogado/Consultoria LGPD | Documento formal de parecer e minuta de DPA aprovada, garantindo que o provedor de IA não usa dados para treino e que a transferência internacional está legalmente amparada. | produção (Fase 6 e Piloto) | pendente | — | 24/10/2026 |

11. Testes sentinela (TS)

Testes sentinela são casos de teste de alto nível que validam os riscos críticos de negócio, segurança e limites do sistema. Eles servem como "âncoras" para a suíte de testes automatizados na Fase 5.

| id | nome_do_teste | cenario | resultado_esperado | requisitos |
|---|---|---|---|---|
| TS-001 | Isolamento de Tenant (Segurança) | Usuário do Tenant A tenta acessar via API, em todas as operações privadas do contrato, um recurso (ex: `GET /projects/{id}`), no caminho ou no corpo da requisição, que pertence ao Tenant B. | O sistema retorna 404 Not Found (não 403) e registra uma tentativa de violação de isolamento na auditoria. Nenhum dado do Tenant B é retornado. | RNF-001, RN-002, CA-012 |
| TS-002 | Validação de Upload (Limite e Segurança) | Usuário tenta fazer upload de um arquivo `.exe` de 5MB e, em seguida, um `.pdf` de 25MB. | Ambos são rejeitados imediatamente com ERR-029 (motivos "tipo de arquivo não permitido" e "excede o limite de 20 MB"). O sistema não processa o arquivo nem grava metadados no banco. | RF-006, CA-029, RN-040 |
| TS-003 | Fila de Revisão por Confiança (Negócio) | A IA lê um campo de escolha única com confiança de 0.85 (limite é 0.90). | O ItemResposta é criado com estado `a_revisar`. A Aplicacao não pode ser concluída até que este item seja resolvido por um humano. | RF-007, CA-005, DEC-028 |
| TS-004 | Retirado na v2.1 (sem k-anonimato, DEC-110) | — | — | RNF-004 |
| TS-005 | Direito de Eliminação (LGPD) | Administrador executa o pedido de eliminação para um respondente específico. | As imagens são marcadas para expurgo. O registro do Respondente tem `nome` sobrescrito, `cpf_cifrado`, `cpf_hash`, `data_nascimento` e `endereco` apagados, e `anonimizado` = true. O ID do respondente vai para a ListaEliminacoes. A auditoria registra a ação sem o CPF. | RF-010, CA-023, RN-030, RN-031, DEC-026 |
| TS-006 | Bloqueio de Edição de Versão Publicada (Integridade) | Administrador tenta adicionar uma nova pergunta a uma Versao que já tem o status `publicada`. | O sistema rejeita a operação com ERR-009 (Versão imutável). O administrador deve criar uma nova versão em rascunho. | RF-004, CA-001, RN-042 |
| TS-007 | Teto de Custo de IA (Operação) | O tenant atinge o teto de R$ 500,00 de custo de IA no mês. Uma nova aplicação é enviada para leitura. | A aplicação entra no estado `aguardando_cota`. A usuária é avisada na tela. Nenhuma chamada é feita ao provedor de IA até que a cota seja renovada ou o teto aumentado. | RF-007, CA-030, DEC-035, RNF-014 |
| TS-008 | Direito de Eliminação Completo (LGPD) | Administrador executa eliminação de respondente com aplicações concluídas, aplicações em revisão e exportações pendentes. | Todas as imagens são marcadas para expurgo. Os ItemResposta têm `valor_ia` e `valor_final` sobrescritos. O Respondente é anonimizado. Aplicações em andamento são descartadas. Exportações pendentes são canceladas. O ID vai para ListaEliminacoes com validade de 180 dias. A auditoria registra a ação sem CPF. O expurgo físico ocorre em até 30 dias. | RF-010, CA-023, RN-030, RN-031, DEC-026 |

12. Checklist de pronto (nível Completo)

Reavaliado na v1.3. Itens verificáveis por script são checados no CI por `tools/validar_consistencia.py`; o resultado do script prevalece sobre este texto.

- [x] 1. IDs únicos e rastreáveis: RF-001 a RF-011, RNF-001 a RNF-014, RN-001 a RN-050, ENT-001 a ENT-031, FL-001 a FL-004, TL-001 a TL-015, US-001 a US-011, 44 CAs (CA-001 a CA-049 e CA-014b, sem os retirados na v2.1: CA-010, CA-016, CA-025, CA-026b, CA-034, CA-037b, CA-038 e CA-043), ERR do catálogo (seção 8.2, incluindo os descontinuados), TS-001 a TS-008, DEC-001 a DEC-036 e DEC-054 a DEC-061, DEC-064 a DEC-082 (tabela da REQ; inclui DEC técnicas anteriores à Fase 3, como DEC-007, DEC-022 e DEC-036), DEC-037 a DEC-053, DEC-062 e DEC-063 (técnicas, no PLANO), as DEC seguintes da REQ e do PLANO até a DEC-149, Q-001 a Q-051 e GX-001. Verificado por script (IDs citados existem nos registros).
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
- [ ] 12. Toda Q respondida: Q-001 a Q-035 e Q-037 a Q-050 respondidas (Q-031 em 03/11/2026 como DEC-117; Q-032 a Q-035 em 05/11/2026 como DEC-126 a DEC-129; Q-037 a Q-050 em 05/11/2026 como DEC-133 a DEC-139 e DEC-143 a DEC-149); Q-036 aberta, adiada pelo responsável até a digitalização por celular (antes do piloto); Q-051 aberta no IA-DEV do IMP-006, com valor provisório (DEC-151).
- [ ] 13. Consenso DEV/TEST sem divergência bloqueante: depende da próxima rodada de revisão independente.
- [x] 14. REQ autocontida: referências externas (MeuRemedio, Kit v3) são informativas; o Bloco P está em `docs/spec/BLOCO_P.md`.
- [ ] 15. Última revisão independente sem achado bloqueante ou alto, com médios e baixos registrados (DEC-061, DEC-073): pendente (REV-REQ-007).

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

Fim do documento `REQ.md`