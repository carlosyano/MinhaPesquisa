# Bloco P — Perfil "Web SaaS com dados pessoais" (referência: MeuRemedio)

Regra de uso: este é o perfil de plataforma padrão do kit, derivado do MeuRemedio e ampliado com itens do MinhaPesquisa (multi-tenant, IA dentro do produto). Na Fase 0, confirme se o projeto usa este perfil. Cada item que não se aplica ou que muda vira DEC-xxx com justificativa. O Bloco P confirmado é copiado para `docs/spec/BLOCO_P.md` do projeto e o conteúdo normativo aplicável vai para a REQ.

Legenda de origem: [MR] regra já especificada e implementada no MeuRemedio · [PROP] padrão proposto, ainda não validado em projeto · [DEC 23/10/2026] valor aprovado pelo responsável, ainda não usado em projeto real · [A CONFIRMAR] valor que o responsável deve validar (nenhum no momento).

## P.1 Stack [MR]
Node.js 24, TypeScript strict; API NestJS + Fastify, contract-first (OpenAPI valida requisição e resposta); web Next.js + React + Tailwind + shadcn/ui; PostgreSQL 17 + Drizzle + migrações SQL explícitas; fila pg-boss + Outbox transacional; monorepo npm. Testes: Vitest, Testcontainers, Playwright + axe, Schemathesis, Stryker (mutação ≥ 80%), fast-check. CI no GitHub Actions com CodeQL, gitleaks e SBOM. Nuvem definida por ADR, sempre com região no Brasil.

## P.2 Autenticação e sessão
[MR] Senha de 10 a 72 caracteres, com minúscula, maiúscula e dígito, fora da lista de senhas vazadas, guardada com Argon2id. Após 5 falhas em 15 minutos, bloqueio de 15 minutos sem revelar se a conta existe. Sessão expira após 30 minutos de inatividade ou 24 horas; no máximo 3 sessões ativas. Token de verificação válido por 24 h e de redefinição por 60 min, de uso único. Proteção CSRF (cookie + cabeçalho + Origin) em toda mutação autenticada.
MFA: perguntar a cada projeto, na Fase 0, se irá ou não adotar MFA; a resposta é registrada como DEC (decisão de 23/10/2026).

## P.3 Autorização [MR + PROP]
Controle por papel e escopo (cliente, projeto). Recurso fora do escopo responde 404, sem revelar se existe, e a tentativa é auditada. Teste gerado do contrato cobre 100% das operações privadas. [PROP] Em multi-tenant, isolamento no banco (chaves compostas e Row-Level Security).

## P.4 Entradas e arquivos [MR + PROP]
Validação no servidor pelo schema do contrato: tipo, tamanho, formato, obrigatoriedade. Entrada inválida é rejeitada, nunca corrigida em silêncio. [PROP] Upload: tipos permitidos, tamanho máximo, varredura de malware e remoção de metadados.

## P.5 Dados e LGPD [MR]
TLS 1.2 ou superior (1.3 preferencial); criptografia em repouso com chaves gerenciadas; segredos em cofre. Classificação de sensibilidade por campo. Mascaramento em tela e log, com exceções explícitas e auditadas. Logs sem segredos e sem dado de saúde. Retenção é decisão de negócio (Q-xxx).

## P.6 Erros [MR]
Catálogo fechado ERR-xxx, no formato Problem Details (RFC 9457), com mensagem exata em pt-BR e identificador de correlação (X-Correlation-ID). Nunca exibir stack trace ou detalhe interno.

## P.7 Resiliência e limites [DEC 23/10/2026]
Timeout de 30 s em chamadas externas; retentativas em 1, 2 e 4 s, só em operações idempotentes; estado final de falha documentado. Limite de 100 requisições por minuto por usuário e 20 por IP em rotas públicas.

## P.8 Concorrência [MR + PROP]
Chave de idempotência nas mutações críticas; ETag/If-Match em edições. [PROP] Reserva com expiração quando houver edição longa por mais de uma pessoa.

## P.9 Auditoria [MR + PROP]
Registro imutável de ações críticas: quem, quando, o quê, qual registro, IP e canal. [PROP] Guarda só referências, nunca valores pessoais, para ser compatível com a eliminação pedida pelo titular.

## P.10 Tempo e formatos [MR + DEC 23/10/2026]
Instantes em UTC (ISO 8601). Datas civis (nascimento, agenda, horário de remédio) como data civil com fuso IANA, nunca convertidas para UTC. Valores monetários em decimal exato. UTF-8. [DEC 23/10/2026] Paginação de 20 itens, no máximo 100.

## P.11 UX e acessibilidade [MR]
Para toda tela: carregando, vazio, sucesso, erro, sem permissão e tempo esgotado. Confirmação para ações destrutivas. WCAG 2.2 AA. Textos de interface em pt-BR.

## P.12 IA dentro do produto [PROP]
Quando o produto usar IA: tratar a entrada como não confiável (instrução escondida); validar a saída contra schema; a IA nunca executa ações; enviar o mínimo de dados; transferência internacional como gate externo; teto de custo; conjunto-ouro com gabarito humano e métrica de erro silencioso; provedor atrás de interface, trocável sem retrabalho.

## P.13 Operação [MR + DEC 23/10/2026]
[MR] Logs estruturados; SBOM e bloqueio de vulnerabilidades críticas e altas; reaplicação de eliminações após restauração de backup. [DEC 23/10/2026] Retenção de backup, RPO e RTO declarados por projeto, na Fase 3 (cty-arq); restauração testada; métricas e alertas.

## P.14 Governança [MR]
Contract-First e Test-First (commit do teste vermelho antes do código verde); todo teste com @trace para os IDs da especificação; matriz RF → RN → CA → TS → operationId; decisões registradas; mudança normativa só com aprovação do mantenedor.