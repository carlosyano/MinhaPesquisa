# Arquitetura do Projeto MinhaPesquisa

> Documento vivo que descreve a organização do repositório, as responsabilidades dos principais módulos e as fronteiras arquiteturais conhecidas do projeto.

## 1. Objetivo

Este documento apresenta uma visão de alto nível da arquitetura do projeto **MinhaPesquisa**. Seu propósito é facilitar a navegação pelo código, deixar explícita a responsabilidade de cada área e servir como ponto de entrada para desenvolvedores e revisores técnicos.

Este documento não substitui contratos de API, decisões arquiteturais, schemas de banco de dados ou documentação operacional detalhada. Ele referencia esses artefatos quando aplicável.

## 2. Visão geral do repositório

O projeto está organizado como um repositório com aplicações, pacotes compartilhados, infraestrutura, contratos, registros de governança e testes.

```text
c:/dev/minhapesquisa/
├── apps/
│   ├── api/                 # Orquestração HTTP e autorização
│   ├── web/                 # Telas TL-001 a TL-012
│   └── worker/              # Leitura IA, expurgo, expirações e cota
├── packages/
│   ├── db/                  # Schemas Drizzle, migrações e policies RLS
│   ├── motor-leitura/       # Motor de leitura isolado (DEC-007)
│   └── contratos/           # openapi.yaml e schemas gerados
├── infra/                   # Terraform: nuvem, KMS, storage e rede
├── contracts/               # Contrato público da API
├── registros/               # CSVs de governança
└── tests/                   # Unit, integração, E2E, contrato e mutação
```

## 3. Princípios de organização

A estrutura atual evidencia algumas separações importantes:

1. **Aplicações executáveis** ficam em `apps/`.
2. **Código e definições reutilizáveis** ficam em `packages/`.
3. **Infraestrutura como código** fica isolada em `infra/`.
4. **Contrato público da API** possui uma área própria em `contracts/`.
5. **Registros de governança** ficam separados do código de aplicação em `registros/`.
6. **Testes** possuem uma área dedicada em `tests/`.
7. O **motor de leitura** possui isolamento explícito, associado à decisão `DEC-007`.

Detalhes adicionais sobre regras de dependência entre módulos devem ser documentados quando estiverem formalmente definidos.

## 4. Aplicações

### 4.1 `apps/api`

**Responsabilidade:** orquestração HTTP e autorização.

Esta aplicação representa a camada de entrada HTTP do sistema e concentra as responsabilidades explicitamente atribuídas à API.

```text
apps/api/
└── ...
```

#### Pertence a esta área

- orquestração HTTP;
- autorização.

#### Fronteiras

Regras adicionais sobre autenticação, autorização, validação, dependências permitidas e comunicação com outros módulos devem ser registradas aqui à medida que forem formalizadas.

---

### 4.2 `apps/web`

**Responsabilidade:** implementação das telas `TL-001` a `TL-012`.

```text
apps/web/
└── ...
```

A aplicação concentra a interface web associada às telas atualmente identificadas no projeto.

#### Escopo conhecido

- `TL-001` a `TL-012`.

Detalhes sobre framework, roteamento, gerenciamento de estado e composição das telas devem ser acrescentados somente quando definidos pelo projeto.

---

### 4.3 `apps/worker`

**Responsabilidade:** processamento relacionado a leitura por IA, expurgo, expirações e cota.

```text
apps/worker/
└── ...
```

#### Responsabilidades conhecidas

- leitura IA;
- expurgo;
- expirações;
- cota.

O comportamento de processamento, filas, agendamento, retentativas, idempotência e tratamento de falhas deve ser registrado quando essas decisões estiverem formalizadas.

## 5. Pacotes compartilhados

### 5.1 `packages/db`

**Responsabilidade:** definições e mecanismos relacionados à camada de dados.

```text
packages/db/
└── ...
```

#### Conteúdo conhecido

- schemas Drizzle;
- migrações;
- policies RLS.

Este pacote deve ser tratado como o local de referência para os artefatos de banco de dados explicitamente indicados acima.

---

### 5.2 `packages/motor-leitura`

**Responsabilidade:** motor de leitura isolado.

```text
packages/motor-leitura/
└── ...
```

O isolamento deste componente está associado à decisão arquitetural **DEC-007**.

#### Diretriz arquitetural

Alterações que reduzam ou eliminem esse isolamento devem ser avaliadas em relação à `DEC-007` antes de serem incorporadas à arquitetura.

> TODO: adicionar referência ou link para o registro completo da DEC-007 quando sua localização no repositório estiver definida.

---

### 5.3 `packages/contratos`

**Responsabilidade:** definições OpenAPI e schemas gerados.

```text
packages/contratos/
├── openapi.yaml
└── ...                     # Schemas gerados
```

#### Conteúdo conhecido

- `openapi.yaml`;
- schemas gerados.

Convém manter explícita, na documentação do projeto, a distinção entre este pacote e o diretório `contracts/`, pois ambos representam conceitos relacionados a contratos, mas foram apresentados com responsabilidades distintas.

## 6. Contrato público da API

### `contracts/`

**Responsabilidade:** contrato público da API.

```text
contracts/
└── ...
```

Este diretório representa a superfície contratual pública indicada para o projeto.

### Relação com `packages/contratos`

A estrutura atual contém duas áreas relacionadas a contratos:

- `packages/contratos/`: `openapi.yaml` e schemas gerados;
- `contracts/`: contrato público da API.

A relação exata entre elas, incluindo qual artefato é fonte de verdade e quais arquivos são derivados, **não foi especificada na descrição inicial**. Essa definição deve ser adicionada quando estiver formalizada.

## 7. Infraestrutura

### `infra/`

**Responsabilidade:** infraestrutura como código por meio de Terraform.

```text
infra/
└── ...
```

#### Escopo conhecido

- nuvem;
- KMS;
- storage;
- rede.

O diretório separa definições de infraestrutura das aplicações e dos pacotes do projeto.

Configurações de ambientes, state do Terraform, providers, módulos e estratégia de implantação devem ser documentadas quando estiverem definidas.

## 8. Governança

### `registros/`

**Responsabilidade:** armazenamento de registros de governança em CSV.

```text
registros/
└── *.csv
```

Esses registros possuem uma área dedicada, separada do código executável.

> TODO: documentar catálogo, proprietário, finalidade, política de atualização e retenção de cada registro quando essas informações estiverem disponíveis.

## 9. Estratégia de testes

### `tests/`

**Responsabilidade:** testes automatizados do projeto.

```text
tests/
├── unit/                   # Testes unitários
├── integracao/             # Testes de integração
├── e2e/                    # Testes ponta a ponta
├── contrato/               # Testes de contrato
└── mutacao/                # Testes de mutação
```

A estrutura informada prevê cinco categorias de teste:

### 9.1 Testes unitários

Validam unidades isoladas de código conforme o escopo estabelecido pela suíte do projeto.

### 9.2 Testes de integração

Cobrem integrações entre componentes conforme os cenários definidos pelo projeto.

### 9.3 Testes E2E

Cobrem fluxos ponta a ponta conforme os cenários definidos pelo projeto.

### 9.4 Testes de contrato

Destinam-se à verificação dos contratos definidos para as interfaces do sistema.

### 9.5 Testes de mutação

Destinam-se à avaliação da capacidade dos testes de detectar alterações introduzidas no código.

## 10. Fronteiras arquiteturais

Com base na estrutura fornecida, as seguintes fronteiras estão explicitamente identificadas:

| Área | Responsabilidade declarada |
|---|---|
| `apps/api` | Orquestração HTTP e autorização |
| `apps/web` | Telas TL-001 a TL-012 |
| `apps/worker` | Leitura IA, expurgo, expirações e cota |
| `packages/db` | Schemas Drizzle, migrações e policies RLS |
| `packages/motor-leitura` | Motor de leitura isolado, DEC-007 |
| `packages/contratos` | OpenAPI e schemas gerados |
| `infra` | Terraform para nuvem, KMS, storage e rede |
| `contracts` | Contrato público da API |
| `registros` | CSVs de governança |
| `tests` | Testes automatizados |

### Regras de dependência

A estrutura inicial não especifica quais módulos podem importar ou depender de quais outros módulos. Portanto, este documento não presume um grafo de dependências.

Quando essas regras forem definidas, recomenda-se documentá-las explicitamente nesta seção, por exemplo:

```text
[apps/web] ------> [apps/api]
                       |
                       v
              [packages/...]
```

> O diagrama acima é apenas um exemplo de formato documental e **não descreve necessariamente a arquitetura real do projeto**.

## 11. Fluxos de execução

Os fluxos completos entre Web, API, Worker, banco, motor de leitura e infraestrutura não foram especificados na estrutura inicial.

Quando formalizados, devem ser documentados separadamente, cobrindo pelo menos:

- entrada da requisição;
- autorização;
- persistência;
- acionamento de processamento IA;
- processamento assíncrono, se aplicável;
- aplicação de cotas;
- expiração;
- expurgo;
- resposta ao cliente.

Nenhuma ordem de execução entre esses itens é presumida neste documento.

## 12. Segurança e proteção de dados

A estrutura do projeto contém elementos explicitamente relacionados a controles técnicos:

- autorização em `apps/api`;
- policies RLS em `packages/db`;
- KMS sob a infraestrutura definida em `infra/`;
- expurgo e expirações em `apps/worker`.

Esses elementos devem ter suas regras detalhadas na documentação de segurança e nas decisões arquiteturais correspondentes. Este documento não presume implementação, garantias ou fluxos que não tenham sido especificados.

## 13. Contratos e schemas

O projeto possui artefatos de contrato em duas áreas:

```text
packages/contratos/
├── openapi.yaml
└── schemas gerados

contracts/
└── contrato público da API
```

Devem ser documentados futuramente:

- fonte de verdade do contrato;
- processo de geração de schemas;
- validação de compatibilidade;
- versionamento;
- política para breaking changes;
- relação exata entre `packages/contratos` e `contracts`.

## 14. Decisões arquiteturais

Decisões estruturais relevantes devem possuir um identificador estável e documentação própria.

### Decisões conhecidas

| ID | Tema | Situação conhecida |
|---|---|---|
| `DEC-007` | Isolamento do motor de leitura | Referenciada pela estrutura fornecida |

O conteúdo e o status formal da `DEC-007` não foram fornecidos, portanto não são reproduzidos neste documento.

## 15. Convenções de manutenção deste documento

Este arquivo deve ser atualizado quando houver mudanças que afetem a arquitetura ou a navegação do repositório, incluindo:

- criação ou remoção de uma aplicação;
- criação ou remoção de pacote compartilhado;
- mudança de responsabilidade de um módulo;
- alteração relevante nas fronteiras arquiteturais;
- introdução de nova categoria de testes;
- alteração da organização dos contratos;
- mudança estrutural na infraestrutura;
- nova decisão arquitetural que afete a organização descrita aqui.

Evite duplicar neste documento detalhes que pertencem naturalmente a contratos, código, schemas, runbooks ou decisões arquiteturais. Prefira referências para a documentação especializada.

## 16. Pontos ainda a documentar

A estrutura inicial não fornece informação suficiente para definir com segurança os itens abaixo:

- tecnologias utilizadas por `apps/api`, `apps/web` e `apps/worker`;
- banco de dados adotado;
- provedor de nuvem;
- mecanismos de comunicação entre API e Worker;
- mecanismo de autenticação;
- regras completas de autorização;
- direção das dependências entre aplicações e pacotes;
- fluxo de dados da leitura IA;
- estratégia de filas ou processamento assíncrono;
- observabilidade;
- CI/CD;
- ambientes;
- estratégia de deployment;
- política de versionamento da API;
- fonte de verdade entre `contracts/` e `packages/contratos/`;
- localização e formato definitivo das decisões `DEC-*`.

Esses pontos devem ser incorporados à documentação somente quando houver definições concretas para eles.

## 17. Referência rápida

```text
Preciso alterar...                     Procurar primeiro em...
────────────────────────────────────────────────────────────────
HTTP / autorização                    apps/api/
Tela TL-001 a TL-012                  apps/web/
Leitura IA / expurgo / expiração      apps/worker/
Cota                                  apps/worker/
Schema / migração / RLS               packages/db/
Motor de leitura                      packages/motor-leitura/
OpenAPI / schemas gerados             packages/contratos/
Contrato público da API               contracts/
Terraform / KMS / storage / rede      infra/
Registros de governança               registros/
Testes                                tests/
```

---

## Histórico

Este `ARCHITECTURE.md` foi criado a partir da estrutura de projeto fornecida. Informações não presentes na descrição original foram mantidas como pontos a documentar, evitando assumir tecnologias, fluxos ou dependências ainda não especificados.
