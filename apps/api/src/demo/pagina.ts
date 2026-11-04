// Página do modo de demonstração (DEC-104, DEC-125). Não é uma tela TL-xxx: só o mínimo para
// entrar, baixar o PDF, enviar fotos, acompanhar a leitura, revisar e concluir, usando apenas
// operações do contrato. Texto do servidor entra por textContent, nunca por innerHTML.

export const PAGINA_DEMO = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MinhaPesquisa — demonstração</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { font-size: 1.3rem; } h2 { font-size: 1.05rem; margin-top: 28px; }
  .aviso { background: #fff4d6; border: 1px solid #e0b84a; padding: 8px 12px; border-radius: 6px; font-size: .9rem; }
  label { display: block; margin: 10px 0 4px; font-weight: 600; }
  input[type=text], input[type=email], input[type=password], input[type=number] { width: 100%; max-width: 320px; padding: 6px; font-size: 1rem; }
  button, a.botao { margin-top: 12px; padding: 8px 14px; font-size: 1rem; cursor: pointer; }
  pre { background: #f4f4f4; padding: 10px; overflow-x: auto; font-size: .85rem; }
  .erro { color: #a40000; font-weight: 600; } [hidden] { display: none; }
  table { border-collapse: collapse; margin-top: 8px; } td, th { border: 1px solid #ccc; padding: 4px 8px; text-align: left; vertical-align: top; }
  #itens input[type=text] { width: 140px; } #itens select { font-size: .9rem; }
  img.recorte { display: block; max-width: 260px; max-height: 160px; margin-top: 6px; border: 1px solid #999; }
  .baixa { background: #fff4d6; } .cota { font-size: .9rem; color: #444; }
</style>
</head>
<body>
<h1>MinhaPesquisa — modo de demonstração</h1>
<p class="aviso">Ambiente local e descartável. Use só dados sintéticos no formulário (GX-001): nada de nome, CPF ou resposta de pessoa real.</p>

<section id="entrar">
  <h2>1. Entrar</h2>
  <form id="f-login">
    <label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required>
    <label for="senha">Senha (impressa no terminal)</label><input id="senha" type="password" autocomplete="current-password" required>
    <button type="submit">Entrar</button>
  </form>
</section>

<section id="painel" hidden>
  <h2>2. Imprimir o formulário</h2>
  <p>Baixe o PDF, imprima, preencha com dados sintéticos e fotografe cada página (a foto da página 1 precisa mostrar o QR).</p>
  <a id="pdf" class="botao" download="formulario-demo.pdf">Baixar PDF</a>
  <p class="cota" id="cota"></p>

  <h2>3. Enviar as fotos (uma pessoa por envio)</h2>
  <form id="f-upload">
    <input id="arquivos" type="file" multiple accept="image/jpeg,image/png,application/pdf" required>
    <br><button type="submit">Enviar</button>
  </form>

  <section id="resultado" hidden>
    <h2>4. Resultado</h2>
    <p>Estado: <strong id="estado"></strong> <span id="aviso"></span></p>
    <table><thead><tr><th>Imagem</th><th>Tipo</th><th>Página</th><th>QR e registro</th><th></th></tr></thead><tbody id="paginas"></tbody></table>
    <form id="f-identificar" hidden>
      <p>Informe o número de cada página do formulário (a identificação automática falhou):</p>
      <div id="campos-identificar"></div>
      <button type="submit">Identificar</button>
    </form>

    <section id="revisao" hidden>
      <h2>5. Revisão</h2>
      <p>Itens em amarelo esperam a sua conferência. <strong>Abrir revisão</strong> mostra o CPF completo (fica auditado).</p>
      <button type="button" id="abrir">Abrir revisão</button>
      <table><thead><tr><th>Campo</th><th>Lido pela IA</th><th>Confiança</th><th>Estado</th><th>Ação</th></tr></thead><tbody id="itens"></tbody></table>
      <button type="button" id="salvar">Salvar revisão</button>
      <div id="divergencias"></div>
      <label for="assinatura">Assinatura na página 1</label>
      <select id="assinatura"><option value="presente">presente</option><option value="ausente">ausente</option></select>
      <br><button type="button" id="concluir">Concluir</button>
    </section>
    <button type="button" id="tentar" hidden>Tentar a leitura de novo</button>
    <details><summary>Resposta da API</summary><pre id="json"></pre></details>
  </section>
</section>
<p id="mensagem" class="erro" role="alert"></p>

<script>
const DADOS = __DADOS__;
const $ = (id) => document.getElementById(id);
$('email').value = DADOS.email;
$('pdf').href = '/forms/' + DADOS.formId + '/versions/' + DADOS.versaoId + '/pdf';

function csrf() {
  const m = document.cookie.match(/(?:^|; )mp_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}
function mensagem(texto) { $('mensagem').textContent = texto || ''; }

let etag = null; // ETag da última resposta da aplicação (If-Match da revisão e da conclusão, RN-043)

async function chamar(metodo, caminho, corpo, idempotente, extra) {
  const headers = { accept: 'application/json, application/problem+json', 'x-csrf-token': csrf(), ...(extra || {}) };
  if (idempotente) headers['idempotency-key'] = crypto.randomUUID();
  let body;
  if (corpo instanceof FormData) body = corpo;
  else if (corpo !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(corpo); }
  const r = await fetch(caminho, { method: metodo, headers, body, credentials: 'same-origin' });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto) : undefined;
  if (!r.ok) {
    const p = dados || {};
    throw new Error((p.errorCode || r.status) + ': ' + (p.detail || p.title || 'falha'));
  }
  if (r.headers.get('etag')) etag = r.headers.get('etag');
  return dados;
}

$('f-login').addEventListener('submit', async (e) => {
  e.preventDefault(); mensagem();
  try {
    await chamar('POST', '/auth/login', { email: $('email').value, senha: $('senha').value });
    $('entrar').hidden = true; $('painel').hidden = false;
    cota();
  } catch (err) { mensagem(err.message); }
});

let aplicacao = null;
let espera = null;
const idDe = (a) => a.aplicacao_id || a.id;
const EDITAVEL = ['em_revisao', 'aguardando_cpf'];
const consultar = (id) => chamar('GET', '/applications/' + id);

async function cota() {
  try {
    const c = await chamar('GET', '/tenant/quota');
    $('cota').textContent = 'Cota de IA do mês: R$ ' + c.consumido + ' de R$ ' + c.teto + (c.atingido ? ' (atingida)' : '');
  } catch (err) { $('cota').textContent = ''; }
}

/** Enquanto a leitura roda, consulta a cada 2 s (o worker roda a cada 1 s). */
function acompanhar(id) {
  clearTimeout(espera);
  espera = setTimeout(async () => {
    try { mostrar(await consultar(id)); } catch (err) { mensagem(err.message); }
  }, 2000);
}

function mostrar(a) {
  aplicacao = a;
  if (a.estado === 'em_leitura' || a.estado === 'aguardando_cota') acompanhar(idDe(a));
  else cota();
  mostrarItens(a);
  $('tentar').hidden = a.estado !== 'erro_leitura';
  $('resultado').hidden = false;
  $('estado').textContent = a.estado;
  $('aviso').textContent = a.aviso ? '(aviso ' + a.aviso + ')' : '';
  $('json').textContent = JSON.stringify(a, null, 2);
  const corpo = $('paginas'); corpo.replaceChildren();
  const campos = $('campos-identificar'); campos.replaceChildren();
  for (const p of a.paginas || []) {
    const tr = document.createElement('tr');
    for (const v of [p.imagem_id.slice(0, 8), p.tipo, p.numero_pagina ?? '—', p.registro_ok ? 'ok' : 'falhou']) {
      const td = document.createElement('td'); td.textContent = String(v); tr.appendChild(td);
    }
    const td = document.createElement('td'); tr.appendChild(td); corpo.appendChild(tr);
    // A imagem só é liberada em identificacao_pendente ou para o titular da reserva (DEC-099).
    if (a.estado === 'identificacao_pendente') {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Ver imagem';
      b.addEventListener('click', async () => {
        mensagem();
        try {
          const img = await chamar('GET', '/applications/' + (a.aplicacao_id || a.id) + '/pages/' + p.imagem_id + '/image');
          window.open(img.url, '_blank', 'noopener');
        } catch (err) { mensagem(err.message); }
      });
      td.appendChild(b);
    }
    if (p.tipo === 'formulario') {
      const l = document.createElement('label'); l.textContent = 'Imagem ' + p.imagem_id.slice(0, 8);
      const i = document.createElement('input'); i.type = 'number'; i.min = '1'; i.required = true;
      i.dataset.imagem = p.imagem_id; if (p.numero_pagina) i.value = p.numero_pagina;
      campos.append(l, i);
    }
  }
  $('f-identificar').hidden = a.estado !== 'identificacao_pendente';
}

const ACOES = { confirmar: 'confirmar', corrigir: 'corrigir para…', em_branco: 'em branco', ilegivel: 'ilegível', rasurado: 'rasurado', nao_se_aplica: 'não se aplica' };
const revisavel = (i) => i.estado !== 'pendente_leitura' && i.estado !== 'aguardando_condicao';

function celula(texto) { const td = document.createElement('td'); td.textContent = texto; return td; }

function mostrarItens(a) {
  const corpo = $('itens'); corpo.replaceChildren();
  const itens = a.itens || [];
  $('revisao').hidden = itens.length === 0 || a.estado === 'em_leitura';
  const editavel = EDITAVEL.includes(a.estado);
  for (const b of ['abrir', 'salvar', 'concluir']) $(b).disabled = !editavel;
  for (const i of itens) {
    const tr = document.createElement('tr');
    if (i.estado === 'a_revisar') tr.className = 'baixa';
    const campo = celula(i.pergunta_codigo + (i.linha_codigo ? '.' + i.linha_codigo : ''));
    let lido = i.valor_ia ?? '—';
    if (i.valor_final !== null && i.valor_final !== i.valor_ia) lido += ' → ' + i.valor_final;
    const acao = document.createElement('td');
    if (editavel && revisavel(i)) {
      // Recorte do campo ao lado do valor lido (CA-007), pedido só quando a usuária quer ver.
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = 'Ver recorte';
      b.addEventListener('click', async () => {
        mensagem();
        try {
          const r = await chamar('GET', '/applications/' + idDe(a) + '/items/' + i.id + '/image');
          const img = document.createElement('img'); img.className = 'recorte'; img.alt = 'recorte do campo'; img.src = r.url;
          b.replaceWith(img);
        } catch (err) { mensagem(err.message); }
      });
      campo.append(document.createElement('br'), b);
      const sel = document.createElement('select'); sel.dataset.item = i.id;
      const vazio = document.createElement('option'); vazio.value = ''; vazio.textContent = i.estado === 'a_revisar' ? '— escolha —' : '(manter)';
      sel.appendChild(vazio);
      for (const [v, t] of Object.entries(ACOES)) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
      const valor = document.createElement('input'); valor.type = 'text'; valor.hidden = true; valor.value = i.valor_final ?? i.valor_ia ?? '';
      sel.addEventListener('change', () => { valor.hidden = sel.value !== 'corrigir'; });
      acao.append(sel, valor);
    }
    tr.append(campo, celula(lido), celula(i.confianca === null ? '—' : Number(i.confianca).toFixed(2)), celula(i.estado), acao);
    corpo.appendChild(tr);
  }
  // Atributos que divergem do cadastro do mesmo CPF: a escolha é obrigatória na conclusão (CA-014).
  const div = $('divergencias'); div.replaceChildren();
  for (const atributo of a.divergencias_cadastro || []) {
    const atual = a.cadastro_existente ? a.cadastro_existente[atributo] : null;
    const l = document.createElement('label');
    l.textContent = 'Cadastro diverge em ' + atributo + (atual ? ' (atual: ' + atual + ')' : ' (abra a revisão para ver o atual)') + '. Manter:';
    const sel = document.createElement('select'); sel.dataset.atributo = atributo;
    for (const [v, t] of [['aplicacao', 'o valor desta aplicação'], ['existente', 'o cadastro atual']]) {
      const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o);
    }
    div.append(l, sel);
  }
}

$('abrir').addEventListener('click', async () => {
  mensagem();
  try { mostrar(await chamar('POST', '/applications/' + idDe(aplicacao) + '/review/open')); }
  catch (err) { mensagem(err.message); }
});

$('salvar').addEventListener('click', async () => {
  mensagem();
  const itens = [];
  for (const sel of $('itens').querySelectorAll('select')) {
    if (!sel.value) continue;
    const item = { item_id: sel.dataset.item, acao: sel.value };
    if (sel.value === 'corrigir') item.valor_final = sel.nextElementSibling.value;
    itens.push(item);
  }
  if (itens.length === 0) { mensagem('Escolha a ação de pelo menos um item.'); return; }
  try { mostrar(await chamar('PATCH', '/applications/' + idDe(aplicacao) + '/review', { itens }, false, { 'if-match': etag || '' })); }
  catch (err) { mensagem(err.message); }
});

$('concluir').addEventListener('click', async () => {
  mensagem();
  const corpo = { assinatura: $('assinatura').value };
  const escolhas = [...$('divergencias').querySelectorAll('select')];
  if (escolhas.length) corpo.manter_cadastro = Object.fromEntries(escolhas.map((s) => [s.dataset.atributo, s.value]));
  try {
    const id = idDe(aplicacao);
    await consultar(id); // ETag atual
    await chamar('POST', '/applications/' + id + '/confirm', corpo, true, { 'if-match': etag || '' });
    mostrar(await consultar(id));
  } catch (err) { mensagem(err.message); }
});

$('tentar').addEventListener('click', async () => {
  mensagem();
  try {
    const id = idDe(aplicacao);
    await chamar('POST', '/applications/' + id + '/retry', undefined, true);
    mostrar(await consultar(id));
  } catch (err) { mensagem(err.message); }
});

$('f-upload').addEventListener('submit', async (e) => {
  e.preventDefault(); mensagem();
  const fd = new FormData();
  for (const f of $('arquivos').files) fd.append('arquivos', f, f.name);
  try { mostrar(await chamar('POST', '/projects/' + DADOS.projetoId + '/applications/upload', fd, true)); }
  catch (err) { mensagem(err.message); }
});

$('f-identificar').addEventListener('submit', async (e) => {
  e.preventDefault(); mensagem();
  const paginas = [...$('campos-identificar').querySelectorAll('input')].map((i) => ({ imagem_id: i.dataset.imagem, numero_pagina: Number(i.value) }));
  try { mostrar(await chamar('POST', '/applications/' + (aplicacao.aplicacao_id || aplicacao.id) + '/identify', { versao_id: DADOS.versaoId, paginas }, true)); }
  catch (err) { mensagem(err.message); }
});
</script>
</body>
</html>
`;
