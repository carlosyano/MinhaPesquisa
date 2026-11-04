# Testes do MinhaPesquisa

IA-TEST do IMP-001, do IMP-002 e do IMP-005 (DEC-053). Os testes nascem da REQ e ficam vermelhos até o PR de
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

## Cobertura

| Arquivo | Rastreio |
|---|---|
| `integracao/auth/login.test.ts` | CA-026, RF-002 (login sem MFA, bloqueio, sessões, CSRF, ERR-021, rotas retiradas) |
| `integracao/auth/instalacao.test.ts` | CA-035, RF-001, RN-006, RN-007 |
| `integracao/auth/redefinicao-senha.test.ts` | CA-037, RF-001, RN-007 |
| `integracao/projetos/projetos.test.ts` | RF-003, CA-027 (recusa de upload, reativação, histórico), RN-004, DEC-110 (sem `grupo_minimo`) |
| `integracao/projetos/isolamento.test.ts` | CA-012 (exemplos 1 a 4), TS-001 (operações do IMP-002) |
| `integracao/formularios/versoes.test.ts` | RF-004, CA-001, TS-006, CA-036, RN-017, RN-047 (sim/não e sensibilidade), REQ §6.5 |
| `integracao/formularios/pdf.test.ts` | CA-028 (QR opaco por página, termo e assinatura na página 1) |
| `integracao/upload/upload.test.ts` | CA-003, CA-004, CA-029 (exemplos 1 a 5), TS-002, RN-040, RF-006, ERR-019 |
| `integracao/upload/montagem.test.ts` | CA-013, CA-039, CA-040, FL-001 (ordem da criação e saída de `identificacao_pendente`) |
| `support/arquivos.test.ts` | autoteste dos geradores de PDF, QR, EXIF e arquivos de limite |
| `support/apoio.test.ts` | autoteste do apoio (catálogo de erros, sem os erros descontinuados na REQ v2.1) |

Ficam para depois (PLANO §11.1):
dashboards, relatórios e auditoria de abertura de ficha do CA-011 (IMP-004);
E2E com navegador do login (segundo PR de IA-TEST, quando a TL-001 tiver desenho); consulta à
lista de senhas vazadas (aguarda DEC, item M-20). Do IMP-002: revisão e relatórios de projeto
arquivado (CA-027, IMP-003 e IMP-004); vínculo das respostas lidas à versão 1 (CA-001, IMP-003).
As decisões da CHG-009 (DEC-093 a DEC-100) têm testes nos arquivos do IMP-002.

Todos os dados são sintéticos (Q-001): e-mails em `exemplo.test`, nomes fictícios.
