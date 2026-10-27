#!/usr/bin/env python3
"""Gera os registros CSV de governança a partir das fontes normativas (DEC-049).

Por que existe: os CSVs em `registros/` eram editados à mão e divergiram da REQ e do
PLANO (IDs de DEC colidindo, colunas quebradas, matriz e incrementos desatualizados).
Agora REQ.md e PLANO.md são a fonte; os CSVs são derivados e nunca editados à mão.
Exceção: `controle_mudancas.csv`, que é o próprio registro de mudanças.

Uso:
  python3 tools/gerar_registros.py          # regrava os CSVs
  python3 tools/gerar_registros.py --check  # só compara; sai com 1 se algum estiver desatualizado (CI)
"""
from __future__ import annotations

import csv
import io
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
REQ = (RAIZ / "docs/spec/REQ.md").read_text(encoding="utf-8")
PLANO = (RAIZ / "docs/architecture/PLANO.md").read_text(encoding="utf-8")
REG = RAIZ / "registros"


def tabela_apos(texto: str, marcador: str) -> list[list[str]]:
    linhas = texto.splitlines()
    ini = next(i for i, l in enumerate(linhas) if marcador in l)
    rows: list[list[str]] = []
    dentro = False
    for l in linhas[ini + 1:]:
        if l.strip().startswith("|"):
            dentro = True
            cel = [c.strip() for c in l.strip().strip("|").split("|")]
            if all(re.fullmatch(r":?-{3,}:?", c) for c in cel if c):
                continue
            rows.append(cel)
        elif dentro:
            break
    return rows


def para_csv(cab: list[str], linhas: list[list[str]]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(cab)
    w.writerows(linhas)
    return buf.getvalue()


saidas: dict[str, str] = {}

# Decisões: negócio e técnicas da REQ (DEC-001..036) + técnicas do PLANO §12.2
cab_dec = ["id", "data", "tipo", "problema", "alternativas", "decisao", "premissa_justificativa",
           "status", "substituido_por", "impacto", "relacionados"]
dec = []
for l in tabela_apos(REQ, "3. Tabela única de decisões")[1:]:
    did, data, tipo, prob, alt, decisao, prem, status, impacto, rel = l
    subst = ""
    m = re.fullmatch(r"substituído \((DEC-\d+)\)", status)
    if m:
        status, subst = "substituído", m.group(1)
    dec.append([did, data, tipo, prob, alt, decisao, prem, status, subst, impacto, rel])
for l in tabela_apos(PLANO, "### 12.2 Decisões técnicas")[1:]:
    dec.append(l)
saidas["registro_decisoes.csv"] = para_csv(cab_dec, dec)

# Catálogo de erros
t = tabela_apos(REQ, "8.2 Catálogo de Erros")
saidas["catalogo_erros.csv"] = para_csv(t[0], t[1:])

# Matriz
t = tabela_apos(REQ, "8.1 Matriz de Rastreabilidade")
cab_mat = ["requisito", "regra", "entidade", "fluxo", "historia", "criterio", "teste_sentinela",
           "operation_id", "componente", "incremento"]
saidas["matriz_rastreabilidade.csv"] = para_csv(cab_mat, t[1:])
matriz = [dict(zip(cab_mat, r)) for r in t[1:]]

# Dicionário
cab_dic = ["entidade", "campo_tecnico", "significado", "tipo", "obrigatorio", "tamanho_precisao",
           "formato_regex", "valores_permitidos", "padrao", "unico", "chave_estrangeira", "sensibilidade_lgpd"]
dic = []
for m in re.finditer(r"^\*\*(ENT-\d+) (\w+)\*\*", REQ, flags=re.M):
    for l in tabela_apos(REQ[m.start():], m.group(0))[1:]:
        dic.append([f"{m.group(1)} {m.group(2)}", *l])
saidas["dicionario_dados.csv"] = para_csv(cab_dic, dic)

# Questões e gates
t = tabela_apos(REQ, "9. Questões em aberto")
saidas["questoes.csv"] = para_csv(
    ["id", "data", "pergunta", "por_que_importa", "opcao_a", "opcao_b", "opcao_c", "recomendacao",
     "texto_provisorio", "resposta", "status", "relacionados"], t[1:])
t = tabela_apos(REQ, "10. Gates externos")
saidas["gates_externos.csv"] = para_csv(t[0], t[1:])

# Incrementos (PLANO §11) com RF e TS derivados da matriz
inc = []
for imp, escopo, cas, entrada, saida in tabela_apos(PLANO, "## 11. Incrementos")[1:]:
    rfs = [r["requisito"] for r in matriz if r["incremento"] == imp]
    ts = sorted({x.strip() for r in matriz if r["incremento"] == imp for x in r["teste_sentinela"].split(",") if x.strip() != "—"})
    inc.append([imp, escopo, ", ".join(rfs), cas, ", ".join(ts), entrada, saida, "planejado"])
saidas["plano_incrementos.csv"] = para_csv(
    ["imp_id", "escopo", "rf_cobertos", "cas_cobertos", "ts_cobertos", "pre_requisitos", "criterio_aceite", "status"], inc)

# Revisões (anexos da REQ e do PLANO)
rev = []
for artefato, texto, marcador in (("REQ.md", REQ, "Anexo B — Registro de revisões"),
                                  ("PLANO.md", PLANO, "## Anexo — Registro de revisões")):
    for l in tabela_apos(texto, marcador)[1:]:
        rid, data, revisor, versao, b, a, m_, bx, status, res = l
        rev.append([rid, data, artefato, versao, revisor, b, a, m_, bx, status, res])
saidas["revisoes.csv"] = para_csv(
    ["id", "data", "artefato", "versao", "revisor", "achados_bloqueantes", "achados_altos",
     "achados_medios", "achados_baixos", "status", "resolucao"], rev)

desatualizados = []
for nome, conteudo in saidas.items():
    caminho = REG / nome
    atual = caminho.read_text(encoding="utf-8") if caminho.exists() else None
    if atual != conteudo:
        desatualizados.append(nome)
        if "--check" not in sys.argv:
            caminho.write_text(conteudo, encoding="utf-8")

if "--check" in sys.argv:
    if desatualizados:
        print("CSV desatualizados em relação à REQ/PLANO (rode tools/gerar_registros.py):", ", ".join(desatualizados))
        sys.exit(1)
    print("OK: registros CSV coerentes com REQ e PLANO.")
else:
    print("Regravados:", ", ".join(desatualizados) or "nenhum (já estavam atualizados)")
