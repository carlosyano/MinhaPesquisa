#!/usr/bin/env python3
"""Validador de consistência cruzada dos artefatos normativos do MinhaPesquisa.

Por que existe: REQ, PLANO, contrato OpenAPI e registros CSV são editados por pessoas e
por IAs em momentos diferentes. Sem uma checagem mecânica, eles divergem em silêncio
(foi o que aconteceu até a REQ v1.2 / PLANO v2.3). Este script roda no CI e falha o build
quando qualquer cruzamento abaixo não fecha.

Uso: python3 tools/validar_consistencia.py   (da raiz do repositório)
Saída: lista de achados e código de saída 1 se houver algum.
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent
REQ = RAIZ / "docs/spec/REQ.md"
PLANO = RAIZ / "docs/architecture/PLANO.md"
OPENAPI = RAIZ / "contracts/openapi.yaml"
REG = RAIZ / "registros"

achados: list[str] = []


def erro(codigo: str, msg: str) -> None:
    achados.append(f"[{codigo}] {msg}")


# ───────────────────────── utilitários ─────────────────────────

def ler(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def ler_csv(nome: str) -> list[dict[str, str]]:
    caminho = REG / nome
    with caminho.open(encoding="utf-8", newline="") as f:
        linhas = list(csv.reader(f))
    if not linhas:
        erro("C1", f"{nome}: arquivo vazio")
        return []
    cab = linhas[0]
    if any(re.fullmatch(r"[A-Z]+-\d+", c or "") for c in cab):
        erro("C1", f"{nome}: primeira linha não é cabeçalho")
    saida = []
    for i, l in enumerate(linhas[1:], start=2):
        if not l:
            continue
        if len(l) != len(cab):
            erro("C1", f"{nome}: linha {i} tem {len(l)} colunas, cabeçalho tem {len(cab)}")
            continue
        saida.append(dict(zip(cab, l)))
    return saida


def tabela_apos(texto: str, marcador: str) -> list[list[str]]:
    """Primeira tabela markdown depois do marcador (linha que contém o texto)."""
    linhas = texto.splitlines()
    ini = next((i for i, l in enumerate(linhas) if marcador in l), None)
    if ini is None:
        erro("PARSE", f"marcador não encontrado: {marcador!r}")
        return []
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


def lista_ids(s: str, prefixo: str) -> set[str]:
    return set(re.findall(rf"\b{prefixo}-\d+[a-z]?\b", s))


def cpf_valido(c: str) -> bool:
    d = [int(x) for x in c]
    if len(d) != 11 or len(set(d)) == 1:
        return False
    for n in (9, 10):
        s = sum(d[i] * (n + 1 - i) for i in range(n))
        if (s * 10) % 11 % 10 != d[n]:
            return False
    return True


# ───────────────────────── carga ─────────────────────────

req = ler(REQ)
plano = ler(PLANO)
api = yaml.safe_load(ler(OPENAPI))
api_txt = ler(OPENAPI)

csvs = {p.name: ler_csv(p.name) for p in sorted(REG.glob("*.csv"))}
decisoes = {r["id"]: r for r in csvs.get("registro_decisoes.csv", [])}
erros_cat = {r["err_id"]: r for r in csvs.get("catalogo_erros.csv", [])}

docs_texto = {
    "REQ.md": req,
    "PLANO.md": plano,
    "openapi.yaml": api_txt,
    "ARCHITECTURE.md": ler(RAIZ / "ARCHITECTURE.md"),
    "AGENTS.md": ler(RAIZ / "AGENTS.md") if (RAIZ / "AGENTS.md").exists() else "",
}

# ───────────────────────── C2 referências de arquivo ─────────────────────────
padrao_arq = re.compile(r"`?((?:docs|registros|contracts|tools|\.github)/[\w./-]+\.(?:md|csv|yaml|yml|py|docx))`?")
for nome, txt in docs_texto.items():
    for ref in set(padrao_arq.findall(txt)):
        if not (RAIZ / ref).exists():
            erro("C2", f"{nome} referencia arquivo inexistente (sensível a maiúsculas): {ref}")

# ───────────────────────── C3 decisões ─────────────────────────
for nome, txt in docs_texto.items():
    for d in sorted(lista_ids(txt, "DEC")):
        if d not in decisoes:
            erro("C3", f"{nome} cita {d}, ausente em registro_decisoes.csv")
for linha in tabela_apos(req, "3. Tabela única de decisões")[1:]:
    did, decisao = linha[0], linha[5]
    if did not in decisoes:
        erro("C3", f"{did} da REQ não está no registro_decisoes.csv")
    elif decisoes[did]["decisao"].strip() != decisao.strip():
        erro("C3", f"{did}: texto da decisão diverge entre REQ e CSV")
for did, r in decisoes.items():
    if r.get("substituido_por") and r["substituido_por"] not in decisoes:
        erro("C3", f"{did}.substituido_por aponta para {r['substituido_por']} inexistente")
    if r["status"] == "substituído" and not r.get("substituido_por"):
        erro("C3", f"{did} substituída sem indicar substituta")

# ───────────────────────── C4 erros ─────────────────────────
ativos = {e for e, r in erros_cat.items() if r.get("status", "ativo") == "ativo"}
tab_err = tabela_apos(req, "8.2 Catálogo de Erros")
cab_err = tab_err[0] if tab_err else []
for linha in tab_err[1:]:
    r = dict(zip(cab_err, linha))
    c = erros_cat.get(r["err_id"])
    if not c:
        erro("C4", f"{r['err_id']} da REQ ausente no catalogo_erros.csv")
        continue
    for campo in ("codigo", "http_status", "mensagem_ao_usuario", "status"):
        if c[campo].strip() != r.get(campo, "").strip():
            erro("C4", f"{r['err_id']}.{campo} diverge entre REQ e CSV")
if tab_err and len(tab_err) - 1 != len(erros_cat):
    erro("C4", "catalogo_erros.csv e REQ §8.2 têm quantidades diferentes de ERR")
enum_api = set(api["components"]["schemas"]["ErrorCode"]["enum"])
if enum_api != ativos:
    erro("C4", f"ErrorCode do OpenAPI ≠ ERR ativos. Só no contrato: {sorted(enum_api - ativos)}; só no catálogo: {sorted(ativos - enum_api)}")
for nome, txt in docs_texto.items():
    for e in sorted(lista_ids(txt, "ERR")):
        if e not in erros_cat:
            erro("C4", f"{nome} cita {e}, ausente do catálogo")
for nome, txt in (("REQ.md", req), ("PLANO.md", plano), ("openapi.yaml", api_txt)):
    for e in sorted(lista_ids(txt, "ERR")):
        if e in erros_cat and erros_cat[e].get("status", "ativo") != "ativo":
            # citações a ERR descontinuado só são aceitas na linha do próprio catálogo
            usos = [l for l in txt.splitlines() if e in l and "descontinuado" not in l.lower()]
            if usos:
                erro("C4", f"{nome} usa {e}, que está descontinuado")
for rnome, resp in api["components"]["responses"].items():
    sch = resp.get("content", {}).get("application/problem+json", {}).get("schema", {})
    for parte in sch.get("allOf", []):
        ex = parte.get("example")
        if ex and ex.get("errorCode") in erros_cat:
            esperado = erros_cat[ex["errorCode"]]["mensagem_ao_usuario"]
            if ex.get("detail") != esperado:
                erro("C4", f"response {rnome}: detail difere da mensagem do catálogo {ex['errorCode']}")
            if str(ex.get("status")) != erros_cat[ex["errorCode"]]["http_status"]:
                erro("C4", f"response {rnome}: status difere do catálogo {ex['errorCode']}")

# ───────────────────────── C5/C6 CAs, matriz, incrementos ─────────────────────────
cas_req = set(re.findall(r"^CA-\d+[a-z]? —", req, flags=re.M))
cas_req = {c.split(" ")[0] for c in cas_req}
mat_req = tabela_apos(req, "8.1 Matriz de Rastreabilidade")
mat_plano = tabela_apos(plano, "## Bloco 2")
mat_csv = csvs.get("matriz_rastreabilidade.csv", [])


def norm_mat(rows: list[list[str]]) -> list[tuple[str, ...]]:
    return [tuple(re.sub(r"\s+", " ", c) for c in r) for r in rows[1:]]


csv_rows = [tuple(re.sub(r"\s+", " ", v) for v in r.values()) for r in mat_csv]
if norm_mat(mat_req) != csv_rows:
    erro("C6", "matriz_rastreabilidade.csv diverge da REQ §8.1")
if norm_mat(mat_plano) != csv_rows:
    erro("C6", "PLANO Bloco 2 diverge da matriz_rastreabilidade.csv")
cas_mat = set()
for r in mat_csv:
    cas_mat |= lista_ids(r["criterio"], "CA")
if cas_mat != cas_req:
    erro("C5", f"CAs da matriz ≠ CAs da REQ. Faltam na matriz: {sorted(cas_req - cas_mat)}; sobram: {sorted(cas_mat - cas_req)}")

imp_plano = {l[0]: lista_ids(l[2], "CA") for l in tabela_apos(plano, "## 11. Incrementos")[1:]}
imp_csv = {r["imp_id"]: lista_ids(r["cas_cobertos"], "CA") for r in csvs.get("plano_incrementos.csv", [])}
if imp_plano != imp_csv:
    for k in sorted(set(imp_plano) | set(imp_csv)):
        if imp_plano.get(k) != imp_csv.get(k):
            erro("C5", f"{k}: CAs no PLANO ≠ plano_incrementos.csv (PLANO−CSV={sorted(imp_plano.get(k, set()) - imp_csv.get(k, set()))}, CSV−PLANO={sorted(imp_csv.get(k, set()) - imp_plano.get(k, set()))})")
uniao_imp = set().union(*imp_plano.values()) if imp_plano else set()
if uniao_imp != cas_req:
    erro("C5", f"Incrementos não cobrem exatamente os CAs da REQ. Faltam: {sorted(cas_req - uniao_imp)}")
# CA alocado ao incremento do seu RF (pela matriz) — CAs de vários RFs podem aparecer em vários IMPs
for r in mat_csv:
    for ca in lista_ids(r["criterio"], "CA"):
        if ca not in imp_plano.get(r["incremento"], set()):
            erro("C5", f"{ca} pertence a {r['requisito']} ({r['incremento']}) mas não está listado nesse incremento no PLANO")
m = re.search(r"(\d+) critérios de aceite", req)
for txt, nome in ((req, "REQ"), (plano, "PLANO")):
    for n in re.findall(r"\b(\d+) CAs\b", txt):
        if int(n) != len(cas_req):
            erro("C5", f"{nome} afirma {n} CAs; a REQ tem {len(cas_req)}")

# ───────────────────────── C7 operationIds ─────────────────────────
ops_api: dict[str, dict] = {}
for p, item in api["paths"].items():
    for metodo, op in item.items():
        if metodo in ("get", "post", "put", "patch", "delete"):
            ops_api[op["operationId"]] = {"path": p, "method": metodo, **op}
ops_mat: set[str] = set()
internas: set[str] = set()
for r in mat_csv:
    for o in [x.strip() for x in r["operation_id"].split(",")]:
        if "(interna)" in o:
            internas.add(o.replace("(interna)", "").strip())
        elif o and o != "—":
            ops_mat.add(o)
if ops_mat != set(ops_api):
    erro("C7", f"operationIds: só na matriz {sorted(ops_mat - set(ops_api))}; só no contrato {sorted(set(ops_api) - ops_mat)}")
cmp_txt = "\n".join(" ".join(l) for l in tabela_apos(plano, "## 3. Componentes"))
for o in ops_mat | internas:
    if not re.search(rf"\b{o}\b", cmp_txt):
        erro("C7", f"operationId {o} não aparece na tabela de componentes do PLANO §3")
ids_validos = lista_ids(req, "RF") | lista_ids(req, "RN") | cas_req | set(decisoes) | set(erros_cat) | lista_ids(req, "RNF") | lista_ids(req, "TS")
for oid, op in ops_api.items():
    tr = op.get("x-trace") or []
    if not tr:
        erro("C7", f"{oid} sem x-trace")
    for t in tr:
        if t not in ids_validos:
            erro("C7", f"{oid}: x-trace {t} não existe na REQ/registros")
    rf_op = [r["requisito"] for r in mat_csv if oid in [x.strip() for x in r["operation_id"].split(",")]]
    if rf_op and rf_op[0] not in tr:
        erro("C7", f"{oid}: x-trace não inclui seu RF da matriz ({rf_op[0]})")

# ───────────────────────── C8 CPFs de exemplo ─────────────────────────
for cpf in set(re.findall(r'"(\d{3}\.?\d{3}\.?\d{3}-?\d{2})"', req)):
    digitos = re.sub(r"\D", "", cpf)
    linha = next(l for l in req.splitlines() if cpf in l)
    if not cpf_valido(digitos) and "inválido" not in linha.lower():
        erro("C8", f"CPF de exemplo inválido sem marcação de inválido: {cpf}")

# ───────────────────────── C9 dicionário ─────────────────────────
dic_req = []
for m_ent in re.finditer(r"^\*\*(ENT-\d+) (\w+)\*\*", req, flags=re.M):
    ent = f"{m_ent.group(1)} {m_ent.group(2)}"
    t = tabela_apos(req[m_ent.start():], m_ent.group(0))
    for l in t[1:]:
        dic_req.append((ent, *l))
dic_csv = [tuple(r.values()) for r in csvs.get("dicionario_dados.csv", [])]
if dic_req != dic_csv:
    so_req = set(dic_req) - set(dic_csv)
    so_csv = set(dic_csv) - set(dic_req)
    erro("C9", f"dicionario_dados.csv diverge da REQ §5 ({len(so_req)} linhas só na REQ, {len(so_csv)} só no CSV)")
ents_dic = {e.split(" ")[0] for e, *_ in dic_req}
for nome, txt in (("REQ.md", req), ("PLANO.md", plano)):
    for e in lista_ids(txt, "ENT"):
        if e not in ents_dic:
            erro("C9", f"{nome} cita {e}, sem dicionário")
for e, campo, *resto in dic_req:
    fmt, vals = resto[4], resto[5]
    if fmt.startswith("^") and vals not in ("—", ""):
        for v in [x.strip() for x in vals.split(";")]:
            if re.fullmatch(r"[\w]+", v) and not re.fullmatch(fmt, v):
                erro("C9", f"{e}.{campo}: valor permitido {v!r} não casa com a regex {fmt}")

# ───────────────────────── C10 revisões ─────────────────────────
rev_csv = {r["id"]: r for r in csvs.get("revisoes.csv", [])}
for l in tabela_apos(plano, "## Anexo — Registro de revisões")[1:]:
    rid, status = l[0], l[8]
    if rid not in rev_csv:
        erro("C10", f"{rid} do PLANO ausente em revisoes.csv")
    elif rev_csv[rid]["status"] != status:
        erro("C10", f"{rid}: status no PLANO ({status}) ≠ revisoes.csv ({rev_csv[rid]['status']})")
for l in tabela_apos(req, "Anexo B — Registro de revisões")[1:]:
    if l[0] not in rev_csv:
        erro("C10", f"{l[0]} da REQ ausente em revisoes.csv")
    elif rev_csv[l[0]]["status"] != l[8]:
        erro("C10", f"{l[0]}: status na REQ ≠ revisoes.csv")

# ───────────────────────── C11 Q e GX ─────────────────────────
q_csv = {r["id"]: r for r in csvs.get("questoes.csv", [])}
for l in tabela_apos(req, "9. Questões em aberto")[1:]:
    if l[0] not in q_csv:
        erro("C11", f"{l[0]} da REQ ausente em questoes.csv")
    elif q_csv[l[0]]["status"] != l[10]:
        erro("C11", f"{l[0]}: status diverge entre REQ e questoes.csv")
gx_csv = {r["id"]: r for r in csvs.get("gates_externos.csv", [])}
for l in tabela_apos(req, "10. Gates externos")[1:]:
    if l[0] not in gx_csv:
        erro("C11", f"{l[0]} ausente em gates_externos.csv")
    elif gx_csv[l[0]]["bloqueia"] != l[5]:
        erro("C11", f"{l[0]}: 'bloqueia' diverge entre REQ e CSV")
for nome, txt in docs_texto.items():
    for q in lista_ids(txt, "Q"):
        if q not in q_csv:
            erro("C11", f"{nome} cita {q}, ausente em questoes.csv")

# ───────────────────────── C12 versões ─────────────────────────
v_req = re.search(r"^Versão: ([\d.]+)", req, flags=re.M).group(1)
for nome, txt in (("PLANO.md", plano), ("openapi.yaml", api_txt), ("ARCHITECTURE.md", docs_texto["ARCHITECTURE.md"])):
    for v in set(re.findall(r"REQ v([\d.]+)", txt)):
        if v != v_req and "histórico" not in nome:
            usos = [l for l in txt.splitlines() if f"REQ v{v}" in l and not re.search(r"hist[óo]ric|errata|CHG-00\d|anterior|REV-", l, re.I)]
            if usos:
                erro("C12", f"{nome} cita REQ v{v}; versão vigente é {v_req}: {usos[0][:90]}")
v_plano = re.search(r"\*\*Versão do plano:\*\* ([\d.]+)", plano).group(1)
if f"PLANO.md v{v_plano}" not in api_txt:
    erro("C12", f"openapi.yaml não cita PLANO.md v{v_plano}")
if f"REQ v{v_req}" not in api_txt:
    erro("C12", f"openapi.yaml não cita REQ v{v_req}")

# ───────────────────────── C13 estados ─────────────────────────
def enum_dic(ent: str, campo: str) -> set[str]:
    for e, c, *resto in dic_req:
        if e.startswith(ent) and c == campo:
            return {x.strip() for x in resto[5].split(";")}
    return set()


def estados_fl(marcador: str) -> set[str]:
    """Estados citados nas colunas 'Estado atual'/'Próximo estado'/'Estado' de todas as tabelas da seção do fluxo."""
    ini = req.index(marcador)
    fim = req.find("**FL-", ini + 5)
    secao = req[ini: fim if fim > 0 else req.index("6.5 Concorrência")]
    s: set[str] = set()
    tabela: list[list[str]] = []
    for linha in secao.splitlines() + [""]:
        if linha.strip().startswith("|"):
            tabela.append([c.strip() for c in linha.strip().strip("|").split("|")])
            continue
        if tabela:
            cab = tabela[0]
            cols = [i for i, c in enumerate(cab) if c in ("Estado atual", "Próximo estado", "Estado")]
            for l in tabela[2:]:
                for i in cols:
                    for x in re.split(r"[/,]| ou ", l[i]):
                        x = x.strip()
                        if re.fullmatch(r"[a-z_]+", x):
                            s.add(x)
            tabela = []
    return s


sch = api["components"]["schemas"]
for ent, campo, fl, api_enum in (
    ("ENT-010", "estado", "**FL-001", set(sch.get("ApplicationState", {}).get("enum", []))),
    ("ENT-011", "estado", "**FL-002", set(sch.get("ItemState", {}).get("enum", []))),
):
    d = enum_dic(ent, campo)
    f = estados_fl(fl)
    if d != api_enum:
        erro("C13", f"{ent}.{campo} ≠ enum do contrato: {sorted(d ^ api_enum)}")
    if f != d:
        erro("C13", f"{fl.strip('*')} usa estados ≠ {ent}.{campo}: {sorted(f ^ d)}")

# ───────────────────────── C14 regras do contrato ─────────────────────────
for oid, op in ops_api.items():
    sec = op.get("security", api.get("security"))
    publica = sec == [] or sec == [{}]
    resp = op.get("responses", {})
    if "429" not in resp:
        erro("C14", f"{oid}: sem resposta 429 (rate limit vale para todas as rotas, P.7)")
    if not publica:
        if "401" not in resp:
            erro("C14", f"{oid}: rota privada sem 401")
        if "{" in op["path"] and "404" not in resp:
            erro("C14", f"{oid}: rota com identificador sem 404 (TS-001)")
        if op["method"] != "get":
            esquemas = {k for s in sec for k in s}
            if "csrfToken" not in esquemas:
                erro("C14", f"{oid}: mutação autenticada sem CSRF")
    if op["method"] in ("put", "patch") and not any(
        (p.get("$ref", "").endswith("IfMatch")) for p in op.get("parameters", [])
    ):
        erro("C14", f"{oid}: edição sem If-Match (P.8)")
for nome, s in sch.items():
    if s.get("type") == "object" and s.get("properties") and s.get("additionalProperties") is not False and nome not in ("ProblemDetails",):
        erro("C14", f"schema {nome} sem additionalProperties: false")
    if s.get("type") == "object" and s.get("properties") and not s.get("required") and not s.get("x-todos-opcionais"):
        erro("C14", f"schema {nome} sem 'required'")
for pnome, prm in api["components"]["parameters"].items():
    if pnome in ("IdempotencyKey", "IfMatch") and not prm.get("required"):
        erro("C14", f"parâmetro {pnome} deveria ser obrigatório (P.8)")

# ───────────────────────── C15 autorização (PLANO §6.1) × 403 ─────────────────────────
aut = tabela_apos(plano, "### 6.1 Autorização por perfil")
rf_ops = {r["requisito"]: [x.strip().replace("(interna)", "").strip() for x in r["operation_id"].split(",")] for r in mat_csv}
cobertas: set[str] = set()
for l in aut[1:]:
    nomes: set[str] = set()
    for item in re.split(r",\s*", re.sub(r"\s*\([^)]*\)", "", l[0])):
        m_rf = re.match(r"(RF-\d+)", item.strip())
        if m_rf:
            nomes |= set(rf_ops.get(m_rf.group(1), []))
        else:
            nomes.add(re.sub(r"\s*\(.*\)", "", item).strip())
    restrita = any(c.lower().startswith("não") or c.lower().startswith("sim,") for c in l[1:])
    for n in nomes:
        if n not in ops_api and n not in internas:
            erro("C15", f"PLANO §6.1 cita operação inexistente: {n}")
            continue
        if n in ops_api:
            cobertas.add(n)
            if restrita and "403" not in ops_api[n].get("responses", {}):
                erro("C15", f"{n}: negada a algum perfil no PLANO §6.1, mas sem resposta 403 no contrato")
for oid in set(ops_api) - cobertas:
    erro("C15", f"{oid}: operação sem linha na matriz de autorização do PLANO §6.1")

# ───────────────────────── resultado ─────────────────────────
if achados:
    print(f"{len(achados)} achado(s):")
    for a in achados:
        print(" -", a)
    sys.exit(1)
print("OK: nenhuma inconsistência detectada pelos cruzamentos automáticos.")
