# Change Request — MinhaPesquisa (CHG-019)

**Data:** 10/11/2026  
**Responsável / Solicitante / Aprovador:** Carlos Yano  
**Classificação:** Normativa (altera fluxo de digitalização, arquitetura de leitura por IA, especificação de QR Code e layout de impressão em PDF)  
**Artefatos de Impacto:** `docs/spec/REQ.md` (v2.8 → v2.9), `docs/architecture/PLANO.md` (v3.19 → v3.20), `contracts/openapi.yaml` (0.8.0 → 0.9.0), `registros/controle_mudancas.csv`  

> **Nota da propagação (10/11/2026):** a DEC-213 e a DEC-214 já existiam no PLANO, que estava na v3.21. As decisões deste documento entraram como DEC-215 (seleção prévia), DEC-216 (página inteira, que absorve a revogação da RN-052 item 5 e da RN-039), DEC-218 (QR, com a versão: `PPPPP.FFF.VV.X/Y`, Q-100 e Q-104) e DEC-219 (layout do PDF); os códigos são a DEC-217 e a implementação é a DEC-220. A propagação gerou a REQ v2.9, o PLANO v3.22 e a OpenAPI 0.9.0. A divergência entre o QR e a escolha bloqueia o envio (ERR-045, Q-101), e o QR antigo conta como ausente (Q-102).

---

## 1. Motivação e Diagnóstico Técnico da Causa-Raiz

Nos testes funcionais com formulários impressos contendo caixas individuais para dígitos de CPF (DEC-105, DEC-106) e data da aplicação:
1. **Sintoma:** Nenhum CPF manuscrito ou data de aplicação preenchidos em caixas claras eram lidos pela IA. Todos chegavam à tela de revisão com valor nulo (`—`), confiança nula (`—`) e estado `a_revisar`.
2. **Causa-Raiz:**
   - O gerador de PDF posicionava o bloco de CPF imediatamente contíguo ao bloco seguinte ("4. Data da aplicação", classificado como sensibilidade `outro`).
   - O algoritmo de localização delimitava caixas próximas e aplicava a regra normativa **RN-052 item 5**: *"se uma região de identificação e uma de saúde ou outro se sobrepõem (com folga `FOLGA = 0.02`), ambas são canceladas e enviadas à revisão sem envio à IA"*.
   - Devido à contiguidade e à folga geométrica de 2%, a função `sobrepostas()` detectava sobreposição entre o CPF e a Data de Aplicação em todas as digitalizações, abortando a leitura pela IA antes mesmo de disparar a requisição à API.
   - Além disso, a estratégia de segmentar a folha em tiras e empilhá-las com tarjas pretas (para supostamente segregar sensibilidade) provou-se contraproducente: recortava dígitos, aumentava a fragilidade a desvios de perspectiva/enquadramento e impedia que a IA utilizasse o contexto espacial e a tipografia da folha para desambiguar as respostas.

Diante desse diagnóstico, o responsável decidiu alterar as regras de negócio e simplificar a arquitetura de leitura e digitalização.

---

## 2. Decisões de Negócio e Mudanças Fechadas

### 2.1. Seleção Prévia Obrigatória de Projeto e Formulário na Digitalização
- **Regra de Negócio:** O usuário deve obrigatoriamente cadastrar o Projeto e o Formulário no sistema antes de digitalizar qualquer resposta.
- **Hierarquia:** Um Projeto pode conter múltiplos tipos de Formulários; cada Formulário recebe respostas de múltiplos participantes/respondentes.
- **Operação de Upload:** Ao digitalizar ou fazer upload de respostas (seja arquivo PDF gerado por scanner ou fotos capturadas por celular), o usuário deve **obrigatoriamente selecionar o Projeto e o Formulário** correspondentes antes de submeter os arquivos.
- **Gabarito Conhecido:** Toda a análise e interpretação pela IA passam a ser realizadas sobre uma base conhecida e pré-cadastrada (as perguntas, enquadramentos, tipos de dados e opções de resposta daquele formulário são fixos e conhecidos).

### 2.2. Nova Arquitetura de Leitura por IA: Envio da Página Inteira
- **Fim dos Recortes Empilhados com Tarjas Pretas:** Descontinua-se o pipeline de recortar perguntas em tiras isoladas e colá-las verticalmente com faixas pretas.
- **Leitura Contextual Direta:** O sistema envia a **imagem da folha/página inteira** diretamente para o modelo de IA de visão multimodal (Anthropic Claude).
- **Entrada da IA:** A chamada à IA recebe a imagem da página inteira e o gabarito das perguntas daquela página específica (código, enunciado, tipo de resposta, opções e regras de formato).
- **Revogação da RN-052 item 5:** Fica revogado o teste de sobreposição geométrica artificial com folga de 2% (`sobrepostas()`). Como a IA analisa a página inteira com o gabarito estruturado, ela distingue com precisão perguntas vizinhas, grids de caixas de CPF e datas manuscritas, eliminando a rejeição indevida por contiguidade.

### 2.3. Nova Especificação do QR Code Gerado pelo Sistema
Quando gerado pelo MinhaPesquisa para impressão, o QR Code impresso no formulário deve codificar obrigatoriamente a seguinte estrutura legível por máquina:
- **Código do Projeto:** 5 dígitos numéricos com preenchimento de zeros à esquerda (ex: `00001`).
- **ID do Formulário:** 3 dígitos numéricos com preenchimento de zeros à esquerda (ex: `001`).
- **Número da Página:** No formato canônico `X/Y`, onde `X` é a página atual e `Y` é o total de páginas daquele formulário (ex: `1/4`, `2/4`, `3/4`, `4/4`).
- **Padrão de Payload:** `[PROJETO_5D].[FORMULARIO_3D].[X/Y]`  
  *Exemplo:* `00001.002.1/4` (Projeto 1, Formulário 2, Página 1 de 4).
- **Validação Cruzada no Upload:** Caso a imagem digitalizada contenha QR code legível, o sistema valida se o Projeto e Formulário lidos coincidem com a seleção feita pelo usuário no upload. Se divergirem, alerta o usuário para prevenir vinculação incorreta de questionários.

### 2.4. Nova Especificação de Layout de Impressão do Formulário (PDF)
Quando o sistema gerar o PDF para impressão, todas as páginas devem seguir as seguintes exigências de layout:
1. **Cabeçalho:**
   - **Nome do Projeto:** Exibido de forma nítida e destacada no topo.
   - **Descrição / Título do Formulário:** Exibido logo abaixo do nome do projeto.
2. **Rodapé:**
   - Informações textuais perfeitamente legíveis para humanos:
     - **Código do Projeto:** 5 dígitos (ex: `Projeto: 00001`)
     - **ID do Formulário:** 3 dígitos (ex: `Formulário: 002`)
     - **Paginação:** No formato `X/Y` (ex: `Página 1/4`, `Página 2/4`, etc.)
   - **QR Code:** Posicionado no canto do rodapé, codificando os mesmos dados (`00001.002.X/Y`).
3. **Diagramação e Espaçamentos:**
   - Espaçamento vertical protetor entre blocos (Termo de Consentimento, Identificação / CPF, Data da Aplicação e seções de perguntas) para evitar qualquer contiguidade visual e facilitar a escrita e a leitura.

---

## 3. Tabela de Novas Decisões Normativas e Técnicas (DECs)

| DEC | Título / Objeto | Descrição Normativa |
|---|---|---|
| **DEC-213** | Seleção prévia de Projeto e Formulário no upload | O upload de arquivos digitalizados (scanner ou foto) exige a indicação prévia obrigatória do Projeto e do Formulário/Versão aos quais as respostas pertencem. Não há mais upload cego sem vinculação prévia. |
| **DEC-214** | Leitura multimodal por página inteira | A leitura por IA recebe a imagem da página inteira e o gabarito estruturado das perguntas daquela página. Fica extinta a fragmentação em recortes empilhados com tarjas pretas (`recortar()`). |
| **DEC-215** | Revogação da RN-052 item 5 e checagem artificial de sobreposição | Fica revogada a regra de bloqueio de leitura por sobreposição geométrica (`FOLGA = 0.02`). A discriminação de campos vizinhos é realizada pela visão contextual do modelo multimodal sobre a página inteira. |
| **DEC-216** | Estrutura padronizada do QR Code | O QR Code do formulário codifica a string `PPPPP.FFF.X/Y`, onde `PPPPP` são 5 dígitos do projeto, `FFF` são 3 dígitos do formulário e `X/Y` é a fração da página sobre o total de páginas. |
| **DEC-217** | Layout do PDF impresso: cabeçalho e rodapé enriquecidos | O PDF impresso gerado pelo sistema deve conter no cabeçalho o Nome do Projeto e a Descrição do Formulário; e no rodapé o QR Code acompanhado do texto legível com Código do Projeto (5d), ID do Formulário (3d) e Paginação (`X/Y`). |

---

## 4. Impacto nos Artefatos do Projeto

1. **`docs/spec/REQ.md` (v2.8 → v2.9):**
   - **RF-004 e RF-013:** Atualização do fluxo de submissão: formulário e projeto são selecionados na tela de digitalização antes do upload.
   - **RN-012 e RN-038:** Envio da página inteira com o gabarito das perguntas da página à IA (mantendo a regra de que o processamento ocorre no âmbito da infraestrutura autorizada).
   - **RN-052:** Revogação do item 5 (eliminação de cancelamento por sobreposição de bounding boxes).
   - **RF-003 e CA-028:** Atualização dos requisitos do PDF do formulário para inclusão do cabeçalho completo, rodapé com dados legíveis e novo formato de QR Code.
   - **FL-001:** Fluxo de digitalização com validação entre a seleção do usuário e o QR Code lido.

2. **`docs/architecture/PLANO.md` (v3.19 → v3.20):**
   - **Pipeline do Worker (`worker.ts`):** Substituição do fluxo `localizar -> recortar -> ler_recortes` pelo fluxo direto de `identificar_pagina -> ler_pagina_inteira`.
   - **Pacote `motor-leitura`:** Remoção do pipeline de fatiamento geométrico e ajuste dos prompts para leitura de folha inteira a partir do gabarito.
   - **Gerador de PDF (`layout.ts` e `pdf.ts`):** Inclusão de cabeçalho com nome e descrição, rodapé com informações legíveis e codificação do QR code em `00001.002.X/Y`.

3. **`contracts/openapi.yaml` (0.8.0 → 0.9.0):**
   - Operação `uploadImages`: campos `projeto_id` e `formulario_id` tornam-se obrigatórios na submissão multipart.
   - Atualização da documentação dos endpoints de geração de PDF e leitura.

4. **`registros/controle_mudancas.csv`:**
   - Registro formal da **CHG-019**, aprovada por Carlos Yano, com status `aprovada`.

---

## 5. Próximos Passos para Implementação

1. **Governança:**
   - Atualização do arquivo `registros/controle_mudancas.csv` com a entrada da CHG-019.
   - Atualização dos arquivos normativos `docs/spec/REQ.md` e `docs/architecture/PLANO.md`.
2. **Ciclo IA-TEST:**
   - Criação/ajuste dos testes de aceitação refletindo a seleção prévia obrigatória, o novo formato de payload do QR Code e os novos elementos de cabeçalho/rodapé do PDF.
3. **Ciclo IA-DEV:**
   - Implementação do novo layout no gerador de PDF (`apps/api/src/formularios/layout.ts` e `pdf.ts`).
   - Refatoração do `worker.ts` e do `motor-leitura` para leitura contextual da folha inteira, removendo o algoritmo de sobreposição que bloqueava o CPF.
