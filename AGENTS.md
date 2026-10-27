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
4. CI completo verde; revisão; merge pelo responsável.

## 4. Antes de abrir PR

```bash
python3 tools/gerar_registros.py --check
python3 tools/validar_consistencia.py
npm run lint:spec
```

## 5. Mudança normativa

Mudança em REQ exige linha em `registros/controle_mudancas.csv` (CHG-xxx), nova versão da
REQ e aceite do responsável. Mudança técnica exige DEC no PLANO §12.2.

## 6. Idioma

Documentação, mensagens e campos de API em português do Brasil; paths de API e
identificadores de código em inglês.
