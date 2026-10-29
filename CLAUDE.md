# CLAUDE.md

Siga integralmente `AGENTS.md` (regras para agentes de IA deste repositório) e `ARCHITECTURE.md`.

Resumo operacional:
- Fontes normativas: `docs/spec/REQ.md`, `docs/architecture/PLANO.md`, `contracts/openapi.yaml`.
- Registros CSV são gerados: `python3 tools/gerar_registros.py`.
- Antes de concluir qualquer tarefa: `python3 tools/validar_consistencia.py` e `npm run lint:spec`.
- Lacuna de negócio → registrar Q-xxx e perguntar ao responsável; nunca inventar regra.
