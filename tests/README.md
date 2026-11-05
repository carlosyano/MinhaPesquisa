# Testes do MinhaPesquisa

IA-TEST do IMP-001, do IMP-002, do IMP-005, do IMP-003, do IMP-006 e do IMP-007 (DEC-053). Os testes nascem da REQ e ficam vermelhos até o PR de
implementação (IA-DEV), que não pode alterá-los: o job `testes-congelados` do CI marca de
vermelho qualquer mudança em teste sem o rótulo `ia-test`, e o responsável só autoriza a
junção depois de revisar o diff, com as verificações verdes.

Limite conhecido (decisão do responsável em 29/10/2026, opção A): o repositório é privado no
plano gratuito, então o GitHub não aplica regra de proteção na `main`; e, com uma só pessoa,
o `CODEOWNERS` não bloqueia (o autor não aprova o próprio PR). A proteção é de processo:
nenhuma junção sem a autorização do responsável. Com um segundo revisor, reavaliar o
GitHub Pro para tornar a regra obrigatória.

## Como rodar

```bash
npm ci
npm run typecheck:tests
npm test
```

## O que o IA-DEV precisa entregar para os testes rodarem

O pacote `@minhapesquisa/api` deve exportar `criarHarness()` em `test-harness`, cumprindo
a interface de `tests/support/harness.ts`: servidor HTTP real, PostgreSQL 17 com
migrações e RLS, relógio injetável, scripts locais de instalação e de redefinição de senha
e leitura de auditoria e sessões.

No IMP-002 a interface ganhou `inspect.historicoStatusProjeto`, `inspect.contagemUpload` e
`inspect.leiturasSolicitadas`, e o ambiente passa a exigir armazenamento de imagens com links
assinados baixáveis pelo teste e antimalware que reconheça o EICAR (ver `support/harness.ts`;
desde o IMP-005, pasta local e Microsoft Defender, DEC-113 e DEC-115).
As imagens enviadas nos testes saem do PDF gerado pela própria API, renderizado como scan ou
foto (`support/arquivos.ts`, com autoteste em `support/arquivos.test.ts`).

No IMP-005 (CHG-011, DEC-108, DEC-109) saem da interface o e-mail capturado, o MFA, os perfis e
`seed.usuarioAtivo`. Entram `scripts.instalar` e `scripts.redefinirSenha`, que rodam pelo mesmo
código dos scripts reais num banco sem tenant, e `inspect.tenants`. `seed.tenant` passa a criar o
tenant já com a sua única usuária ativa, para que cada teste tenha a sua conta e o CA-012 tenha
dois tenants no mesmo banco (defesa em profundidade, DEC-116). Os testes de MFA, convite,
recuperação por e-mail, reset de MFA, usuários e concessões foram retirados com os CAs.

Na parte 2 do IMP-005 entram testes unitários dos adaptadores locais: chave mestra (DEC-114),
pasta de imagens (DEC-113), Microsoft Defender (DEC-115) e backup (DEC-117). O DPAPI e o
MpCmdRun só existem no Windows e o CI roda em Linux, então os testes trocam os dois por
equivalentes sintéticos (protetor e executor injetados); a verificação contra o Windows real
fica para a instalação num notebook limpo (critério de saída do IMP-005).

No IMP-003 (leitura por IA e revisão, DEC-123) a interface ganha `motor` (o motor de leitura
simulado no lugar do adaptador Claude: roteiro de leituras por pergunta, custo em dólar e as
chamadas que recebeu), `worker.processar()` (o worker de leitura só roda quando o teste pede ou
quando `clock.advance` vence uma retentativa ou a virada do mês), `seed.consumoIa`,
`seed.parametro` com `competencia`, e `inspect.respondentes`, `inspect.aplicacao`,
`inspect.listaEliminacoes` e `inspect.logs`. Os testes unitários importam do código ainda por
escrever: `apps/api/src/regras/leitura.ts` (`estadoAposLeitura`, FL-002),
`apps/api/src/regras/cpf.ts` (`normalizarCpf`, `cpfValido`) e `packages/motor-leitura/src`
(`AdaptadorClaude`, `ErroLeitura` e os tipos da ReadEngine, DEC-043), este com o SDK oficial
`@anthropic-ai/sdk` e o `fetch` injetado, sem rede. Propriedades usam `fast-check`.

No IMP-006 (importação de formulário, CHG-014, DEC-141 e DEC-142) a interface ganha `extrator`
(o extrator de estrutura simulado no lugar do adaptador Claude: roteiro por página com
`campo_padrao`, falhas, custo e as chamadas que recebeu), `seed.rascunhoAntigo` (rascunho gravado
direto no banco como antes da REQ v2.4, sem os 5 campos da RN-050), `seed.corromperPaginaImportacao`,
`inspect.importacao` e `inspect.contagemImportacao`. As tarefas da importação rodam no mesmo worker
e relógio da leitura. Os testes do IMP-002 alcançados pela CHG-014 foram ajustados em
`versoes.test.ts` (PLANO §11), sem reabrir o aceite do IMP-002. Altura das perguntas (S-12): termo
de consentimento padrão e uma escolha única de 60 opções, que não cabe em nenhuma página.

No IMP-007 (exportação em formato longo, CHG-015, DEC-164 e DEC-165) a interface ganha
`inspect.exportacao` e `inspect.contagemExportacao`. A tarefa da exportação roda no mesmo worker e
relógio da leitura, e o `clock.advance` também roda o job diário que apaga os arquivos vencidos
(DEC-069). Os links de `getExport` precisam ser baixáveis com `fetch`, como os das imagens. O CSV e o
XLSX são lidos por `support/planilha.ts`, sem depender da biblioteca que gera os arquivos (autoteste
em `support/planilha.test.ts`). A neutralização de fórmulas (DEC-166, que substitui a DEC-161) é
conferida no valor gravado: no CSV o apóstrofo faz parte do texto; no XLSX o texto sai como está, em
célula do tipo texto, e nenhuma célula é fórmula.

## Cobertura

| Arquivo | Rastreio |
|---|---|
| `integracao/auth/login.test.ts` | CA-026, RF-002 (login sem MFA, bloqueio, sessões, CSRF, ERR-021, rotas retiradas) |
| `integracao/auth/instalacao.test.ts` | CA-035, RF-001, RN-006, RN-007 |
| `integracao/auth/redefinicao-senha.test.ts` | CA-037, RF-001, RN-007 |
| `integracao/projetos/projetos.test.ts` | RF-003, CA-027 (recusa de upload, reativação, histórico), RN-004, DEC-110 (sem `grupo_minimo`) |
| `integracao/projetos/isolamento.test.ts` | CA-012 (exemplos 1 a 4), TS-001 (operações do IMP-002) |
| `integracao/formularios/versoes.test.ts` | RF-004, CA-001, TS-006, CA-036, RN-017, RN-047 (sim/não e sensibilidade), REQ §6.5; ajustado no IMP-006 (RN-050) |
| `integracao/formularios/pdf.test.ts` | CA-028 (QR opaco por página, termo e assinatura na página 1) |
| `integracao/upload/upload.test.ts` | CA-003, CA-004, CA-029 (exemplos 1 a 5), TS-002, RN-040, RF-006, ERR-019 |
| `integracao/upload/montagem.test.ts` | CA-013, CA-039, CA-040, FL-001 (ordem da criação e saída de `identificacao_pendente`) |
| `unit/chaves.test.ts` | DEC-114 (subchaves por HKDF, cópia com a senha de recuperação, guarda pelo DPAPI), CA-035 |
| `unit/armazenamento-disco.test.ts` | DEC-113, RN-029 (pasta local, caminho seguro, links assinados de 5 min em 127.0.0.1) |
| `unit/defender.test.ts` | DEC-115, DEC-102, CA-029 (MpCmdRun, falha nunca é "limpo") |
| `unit/backup.test.ts` | DEC-117, DEC-033, DEC-114 (nome, retenção de 90 dias, teste mensal, cifra do arquivo) |
| `integracao/leitura/leitura.test.ts` | RF-007, FL-002, CA-005, TS-003, CA-006, CA-015, CA-018, CA-019, DEC-074, RN-038, RN-039 (minimização) |
| `integracao/leitura/cota.test.ts` | CA-030, TS-007, DEC-051, DEC-058, ERR-003 (teto, reserva, virada do mês) |
| `integracao/leitura/falha.test.ts` | CA-041, REQ §6.6, ERR-018 (retentativas, `erro_leitura`, `retryReading`) |
| `integracao/revisao/revisao.test.ts` | RF-008, RN-013, CA-007, CA-008, CA-018, CA-020, RN-043/ERR-017, TS-001 (operações do IMP-003) |
| `integracao/revisao/conclusao.test.ts` | CA-032, CA-014b, CA-002, CA-021, CA-044, DEC-064, DEC-079 |
| `integracao/revisao/descarte-reabertura.test.ts` | CA-033, CA-042, DEC-077, DEC-078, RN-014 |
| `unit/estado-item.test.ts` | FL-002 (regras 1 a 9), DEC-028, DEC-047, CA-006 |
| `unit/cpf.test.ts` | RN-012, CA-002, REQ §5.4 |
| `unit/motor-leitura.test.ts` | DEC-007, DEC-043, DEC-122, DEC-123, RN-045 (fronteira do motor e adaptador Claude) |
| `integracao/formularios/importacao.test.ts` | RF-011, CA-045, CA-046, CA-047 (exemplos 1 a 8), RN-049, FL-004, DEC-136, DEC-143, DEC-144, DEC-149, T-02 |
| `integracao/formularios/campos-padrao.test.ts` | CA-048 (exemplos 1 a 9), RN-050, DEC-143, DEC-145, DEC-146, DEC-147 |
| `integracao/projetos/ciclo-coleta.test.ts` | CA-049, DEC-137, RN-027, RN-028 |
| `integracao/exportacao/formato-longo.test.ts` | RF-012, CA-050, CA-051 (exemplos 1 a 8), CA-021, RN-051, DEC-153 a DEC-160, DEC-162 a DEC-166 |
| `support/planilha.test.ts` | autoteste da leitura de CSV (DEC-165) e de XLSX |
| `support/arquivos.test.ts` | autoteste dos geradores de PDF, QR, EXIF e arquivos de limite |
| `support/apoio.test.ts` | autoteste do apoio (catálogo de erros, sem os erros descontinuados na REQ v2.1) |

Ficam para depois (PLANO §11.1):
dashboards, relatórios e auditoria de abertura de ficha do CA-011 (IMP-004);
E2E com navegador do login (segundo PR de IA-TEST, quando a TL-001 tiver desenho); consulta à
lista de senhas vazadas (aguarda DEC, item M-20). Do IMP-002: revisão e relatórios de projeto
arquivado (CA-027, IMP-003 e IMP-004); vínculo das respostas lidas à versão 1 (CA-001, IMP-003).
As decisões da CHG-009 (DEC-093 a DEC-100) têm testes nos arquivos do IMP-002.

Todos os dados são sintéticos (Q-001): e-mails em `exemplo.test`, nomes fictícios.
