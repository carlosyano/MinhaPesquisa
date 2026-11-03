# AGENTS.md — regras para agentes de IA no MinhaPesquisa

Leia antes de propor código, testes, contrato ou decisões: este arquivo,
`ARCHITECTURE.md`, `docs/spec/REQ.md`, `docs/architecture/PLANO.md` e `docs/spec/BLOCO_P.md`.

## 1. Precedência

Decisões de negócio aprovadas → REQ → PLANO e DEC técnicas → Bloco P → recomendações da IA.
Evidências de implementação e testes não são fonte normativa.

## 2. Proibições

- Não alterar regra de negócio. Lacuna de negócio vira Q-xxx em `docs/spec/REQ.md` §9 e o responsável é avisado; até a resposta, use o texto provisório da Q e não o trate como definitivo.
- Não editar `registros/*.csv` à mão (exceto `controle_mudancas.csv`). Altere REQ/PLANO e rode `python3 tools/gerar_registros.py`.
- Não usar dado pessoal real (Q-001, GX-001). Fixtures e exemplos são sintéticos; CPFs de exemplo devem ser válidos ou marcados como inválidos.
- Não registrar em log nome, CPF, dado de saúde ou conteúdo lido (RN-028).
- Não criar endpoint fora de `contracts/openapi.yaml`; contrato primeiro, código depois.
- Não alterar testes aprovados no PR de implementação (DEC-053).
- Não commitar segredos; nada de `.env` no repositório.

## 3. Fluxo de trabalho (Test-First, DEC-053)

1. IA-TEST: testes vermelhos a partir da REQ, com `// @trace <IDs>`, em PR próprio.
2. Responsável aprova os testes.
3. IA-DEV: implementação em outro PR, até ficar verde, sem tocar nos testes aprovados.
4. CI completo verde; ciclo de verificação (§7); merge pelo responsável.

**Merge:** todo PR, normativo ou não, é juntado só pelo responsável (DEC-092). A IA abre o
PR, deixa o CI verde e avisa; nunca faz merge, nem encadeia PRs que dependam de um PR ainda
não juntado.

## 4. Antes de abrir PR

```bash
python3 tools/gerar_registros.py --check
python3 tools/validar_consistencia.py
npm run lint:spec
```

## 5. Mudança normativa e mudança retroativa (DEC-092)

Mudança técnica exige DEC no PLANO §12.2. Quando qualquer fase (plano, testes ou código)
encontra inconsistência ou lacuna que depende da REQ ou do PLANO, nunca corrige só no local:

1. **Registrar** CHG-xxx em `registros/controle_mudancas.csv`, com `fase_origem`.
2. **Classificar** (`classificacao`):
   - `esclarecimento`: texto ambíguo ou contraditório, sem mudar comportamento, regra, dado,
     contrato ou critério de aceite. Vira DEC e versão menor, sem reaprovação.
   - `normativa`: muda comportamento, regra, dado, contrato ou critério de aceite. Segue os
     passos 3 a 7. Na dúvida entre as duas, é `normativa`.
3. **Impacto pela matriz:** RF, RN, CA, ENT, operationId, CMP, IMP e testes afetados.
4. **Bloqueio seletivo** (`trabalho_bloqueado`): só o trabalho afetado para; o resto segue.
5. **Decisão:** a parte de negócio vira Q-xxx; o aceite do CHG pelo responsável vale como
   reaprovação da nova versão da REQ ou do PLANO.
6. **Propagação de cima para baixo:** REQ → PLANO, contrato e matriz → IA-TEST ajusta os
   testes de aceitação → IA-DEV ajusta o código e roda a regressão. Cada artefato passa pelo
   ciclo do §7: primeiro uma rodada focada nos itens afetados, por fim uma rodada completa.
7. **Fechar:** versões e matriz atualizadas; CHG com status `aprovada`.

Código errado é BUG; REQ ou PLANO errado ou incompleto é CHG. A IA-DEV nunca contorna a REQ
no código.

## 6. Idioma

Documentação, mensagens e campos de API em português do Brasil; paths de API e
identificadores de código em inglês.

## 7. Ciclo de verificação (DEC-061, DEC-073, DEC-092)

1. A cada rodada, um revisor novo (agente `revisor-independente`, contexto isolado, somente
   leitura) revisa o artefato inteiro: primeiro às cegas; depois confere, um a um, os achados
   corrigidos na rodada anterior.
2. Cada achado tem gravidade (bloqueante, alto, médio, baixo) e tipo: `[EDITORIAL]`, que a IA
   corrige, ou `[DECISÃO]`, que vira Q-xxx para o responsável.
3. **Anti-oscilação:** achado que contradiz decisão registrada ou correção de rodada anterior
   é sempre `[DECISÃO]`.
4. **Parada (DEC-073):** rodada com 0 bloqueantes e 0 altos; médios e baixos restantes
   registrados no PLANO §12.3, com responsável e incremento. Com Q aberta, o ciclo pausa.
   Após 5 rodadas sem parar, a IA para e apresenta o diagnóstico ao responsável.
5. Cada rodada é registrada no anexo de revisões da REQ ou do PLANO (REV-REQ-xxx ou
   REV-PLANO-xxx). Nunca declarar o ciclo concluído sem a rodada final registrada.
