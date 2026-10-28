# REV-REQ-008 / REV-PLANO-010 — resultado da rodada 4 (verificação)

Revisor: agente revisor-independente (IA, outro modelo, contexto isolado, somente leitura) — DEC-061.
Versões: REQ v1.8, PLANO v2.9, OpenAPI 0.2.5 (commit 1b97cff).
Veredito: **REPROVADO** pelo critério da DEC-073 — 0 bloqueantes, **2 altos**, 8 médios, 11 baixos (novos).
O alto da rodada anterior (DEC-071) foi confirmado como corrigido.
Situação: **não tratado ainda** — pendente para a próxima sessão.

## Altos (corrigir antes do aceite)

- **A-01 (MFA):** nada impede `startMfaSetup`/`setupMfa` para usuário com `mfa_ativo = true`; com a senha, um atacante cadastraria novo MFA e obteria sessão plena. Correção: aceitar só na etapa `mfa_cadastro`; caso contrário ERR-018; CA com exemplo. IMP-001 / CMP-Auth.
- **A-02 (FL-002):** a definição de "origem resolvida" faz a regra 1 capturar origem em `em_branco`/`ilegivel`/`rasurado`/`nao_se_aplica`, tornando as regras 4 e 4a inalcançáveis e prendendo o destino em `aguardando_condicao`. Correção: regra 1 só para origem em `pendente_leitura`, `aguardando_condicao` ou `a_revisar`; exemplos em CA. IMP-003.

## Médios

- M-N1: CA-003 (só página 2 → em leitura) contradiz a tabela de criação e o CA-013.
- M-N2: falta regra para campo lido em branco fora de regra de salto (decisão de negócio).
- M-N3: contrato não distingue em branco, ilegível, rasurado e não se aplica no dashboard, ficha e exportação (RN-020).
- M-N4: filtro em `escala` permite intervalos quase livres; semântica de filtro em múltipla escolha indefinida (decisão de negócio).
- M-N5: regra do complemento indefinida sem filtros, com vários projetos e com período.
- M-N6: M-11 da REV-REQ-007 não consta do §12.3 (foi corrigido na CHG-006 — constraint com `competencia`; falta registrar).
- M-N7: itens do §12.3 que são lacuna de negócio estão atribuídos à IA-DEV; devem virar Q-021+.
- M-N8: aplicação descartada mantém valores lidos indefinidamente.

## Baixos

B-N1 checklist cita REV-REQ-007; B-N2 CHG-006 fora da tabela do PLANO §12; B-N3 ampliar M-01 e notar mitigação parcial da DEC-071; B-N4 RF-010 sem ERR-024/001/019; B-N5 CPF mascarado no CA-002 × formato canônico; B-N6 faixa `<60` não consta da DEC-071; B-N7 concessão a usuário sem perfil; B-N8 `versao_id` de outro tenant no `identifyApplication` (404 × ERR-039); B-N9 replay de TOTP e parâmetros Argon2id; B-N10 erro de `saveReview` em item `aguardando_condicao`; B-N11 cópia de data/local/aplicador para a aplicação na conclusão.

Observação do revisor: B-11 (imagens sem backup) talvez mereça ser médio, porque a página 1 assinada é a evidência de consentimento.
