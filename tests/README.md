# Testes do MinhaPesquisa

IA-TEST do IMP-001 e do IMP-002 (DEC-053). Os testes nascem da REQ e ficam vermelhos até o PR de
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
migrações e RLS, relógio injetável, captura de e-mails e leitura de auditoria e sessões.

No IMP-002 a interface ganhou `inspect.historicoStatusProjeto`, `inspect.contagemUpload` e
`inspect.leiturasSolicitadas`, e o ambiente passa a exigir armazenamento de objetos com links
assinados baixáveis pelo teste e antimalware que reconheça o EICAR (ver `support/harness.ts`).
As imagens enviadas nos testes saem do PDF gerado pela própria API, renderizado como scan ou
foto (`support/arquivos.ts`, com autoteste em `support/arquivos.test.ts`).

## Cobertura

| Arquivo | Rastreio |
|---|---|
| `integracao/auth/login.test.ts` | CA-026, RF-002 (bloqueio, sessões, CSRF, ERR-021) |
| `integracao/auth/mfa-etapa.test.ts` | CA-026b (exemplos 1 a 7) |
| `integracao/auth/convite.test.ts` | CA-035 |
| `integracao/auth/recuperacao-senha.test.ts` | CA-037 |
| `integracao/auth/reset-mfa.test.ts` | CA-037b (exemplos 1 a 5) |
| `integracao/admin/isolamento.test.ts` | CA-012, TS-001 (operações do IMP-001) |
| `integracao/admin/usuarios.test.ts` | RF-001, CA-016 (parte), CA-038 (desativação) |
| `integracao/admin/concessoes.test.ts` | CA-025, CA-038, Q-030 |
| `integracao/projetos/projetos.test.ts` | RF-003, CA-027 (recusa de upload, reativação, histórico), DEC-055, RN-004 |
| `integracao/projetos/isolamento.test.ts` | CA-012 (exemplos com `/projects`), TS-001 (operações do IMP-002) |
| `integracao/formularios/versoes.test.ts` | RF-004, CA-001, TS-006, CA-036, RN-017, RN-047 (sim/não e sensibilidade), REQ §6.5 |
| `integracao/formularios/pdf.test.ts` | CA-028 (QR opaco por página, termo e assinatura na página 1) |
| `integracao/upload/upload.test.ts` | CA-003, CA-004, CA-029 (exemplos 1 a 5), TS-002, RN-040, RF-006, ERR-019 |
| `integracao/upload/montagem.test.ts` | CA-013, CA-039, CA-040, FL-001 (ordem da criação e saída de `identificacao_pendente`) |
| `support/arquivos.test.ts` | autoteste dos geradores de PDF, QR, EXIF e arquivos de limite |
| `support/apoio.test.ts` | autoteste do apoio (TOTP do RFC 6238, catálogo de erros) |

Ficam para depois (PLANO §11.1):
dashboards e relatórios do CA-016 e auditoria de abertura de ficha do CA-025 (IMP-004);
E2E com navegador (segundo PR de IA-TEST, quando as telas tiverem desenho); consulta à
lista de senhas vazadas (aguarda DEC, item M-20). Do IMP-002: revisão e relatórios de projeto
arquivado (CA-027, IMP-003 e IMP-004); vínculo das respostas lidas à versão 1 (CA-001, IMP-003);
e os itens que aguardam decisão: texto do termo de consentimento, validação das regras de salto
(M-09), erro da RN-047 (M-19), alcance do `getPageImage` (M-07) e versão de outro tenant no
`identifyApplication` (B-N8).

Todos os dados são sintéticos (Q-001): e-mails em `exemplo.test`, nomes fictícios.
