// Página do modo de demonstração (DEC-104). Não é uma tela TL-xxx: só o mínimo para entrar,
// baixar o PDF, enviar fotos e ver o resultado, usando apenas operações do contrato. Texto
// do servidor entra por textContent, nunca por innerHTML.

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
  table { border-collapse: collapse; margin-top: 8px; } td, th { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
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
    <button type="submit">Continuar</button>
  </form>
  <form id="f-mfa" hidden>
    <label for="codigo">Código do app autenticador</label><input id="codigo" type="text" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required>
    <button type="submit">Entrar</button>
  </form>
</section>

<section id="painel" hidden>
  <h2>2. Imprimir o formulário</h2>
  <p>Baixe o PDF, imprima, preencha com dados sintéticos e fotografe cada página (a foto da página 1 precisa mostrar o QR).</p>
  <a id="pdf" class="botao" download="formulario-demo.pdf">Baixar PDF</a>

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
    <pre id="json"></pre>
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

async function chamar(metodo, caminho, corpo, idempotente) {
  const headers = { accept: 'application/json, application/problem+json', 'x-csrf-token': csrf() };
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
  return dados;
}

$('f-login').addEventListener('submit', async (e) => {
  e.preventDefault(); mensagem();
  try {
    await chamar('POST', '/auth/login', { email: $('email').value, senha: $('senha').value });
    $('f-login').hidden = true; $('f-mfa').hidden = false; $('codigo').focus();
  } catch (err) { mensagem(err.message); }
});

$('f-mfa').addEventListener('submit', async (e) => {
  e.preventDefault(); mensagem();
  try {
    await chamar('POST', '/auth/mfa/verify', { codigo: $('codigo').value });
    $('entrar').hidden = true; $('painel').hidden = false;
  } catch (err) { mensagem(err.message); }
});

let aplicacao = null;
function mostrar(a) {
  aplicacao = a;
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
