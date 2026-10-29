# Testes do MinhaPesquisa

IA-TEST do IMP-001 (DEC-053). Os testes nascem da REQ e ficam vermelhos até o PR de
implementação (IA-DEV), que não pode alterá-los (`.github/CODEOWNERS` e o job
`testes-congelados` do CI).

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
| `support/apoio.test.ts` | autoteste do apoio (TOTP do RFC 6238, catálogo de erros) |

Ficam para depois (PLANO §11.1): exemplos do CA-012 com `/projects` (IMP-002);
dashboards e relatórios do CA-016 e auditoria de abertura de ficha do CA-025 (IMP-004);
E2E com navegador (segundo PR de IA-TEST, quando as telas tiverem desenho); consulta à
lista de senhas vazadas (aguarda DEC, item M-20).

Todos os dados são sintéticos (Q-001): e-mails em `exemplo.test`, nomes fictícios.
