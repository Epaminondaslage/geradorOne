const _fs = require('node:fs');
const _os = require('node:os');
const _path = require('node:path');
process.env.RUNTIME_DIR = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'g1-i18n-srv-test-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const srv = require('../lib/i18n-servidor');
const { createUserStore } = require('../lib/users');
const { renderEmail } = require('../lib/email-template');
const { createMailer } = require('../lib/mailer');
const { validateProject } = require('../lib/projects');
const { validateSupport } = require('../lib/support');
const app = require('../server');

const req = (headers = {}) => ({ headers });
// Dicionário injetado: os testes não dependem dos dicionários reais do app.
const DICT = {
  en: { 'srv.erro.tema_invalido': 'Invalid theme.', 'srv.erro.senha_curta': 'The password needs at least {min} characters.', 'srv.ia.responder_em': 'Write ALL output in {idioma}.', 'srv.ia.idioma.en': 'English', 'legal.ressalva': 'Only in Portuguese <b>& more</b>.' },
  de: { 'legal.ressalva': 'Nur auf Portugiesisch.' }
};

test('idioma da requisição: cookie, depois conta, depois Accept-Language, depois pt-BR', () => {
  assert.equal(srv.idiomaDaRequisicao(req({ cookie: 'g1_session=x; idioma=de', 'accept-language': 'en' }), { language: 'es' }), 'de');
  assert.equal(srv.idiomaDaRequisicao(req({ 'accept-language': 'en' }), { language: 'es' }), 'es');
  assert.equal(srv.idiomaDaRequisicao(req({ 'accept-language': 'it-IT,it;q=0.9,en;q=0.5' }), { language: '' }), 'it');
  assert.equal(srv.idiomaDaRequisicao(req(), null), 'pt-BR');
  assert.equal(srv.idiomaDaRequisicao(req({ cookie: 'idioma=klingon', 'accept-language': '*' })), 'pt-BR');
  assert.equal(srv.idiomaDaRequisicao(req({ cookie: 'idioma=%E0%A4%A' })), 'pt-BR');
});

test('language do corpo inválido cai no idioma da requisição (pt-BR sem cookie)', () => {
  assert.equal(srv.idiomaDoCorpo(req(), null, 'xx'), 'pt-BR');
  assert.equal(srv.idiomaDoCorpo(req(), null, undefined), 'pt-BR');
  assert.equal(srv.idiomaDoCorpo(req(), null, 'en-US'), 'en');
  assert.equal(srv.idiomaDoCorpo(req({ cookie: 'idioma=es' }), null, { evil: 1 }), 'es');
});

test('tr traduz pelo idioma da requisição e cai para o português do servidor', () => {
  assert.equal(srv.tr(req({ cookie: 'idioma=en' }), null, 'srv.erro.tema_invalido', undefined, DICT), 'Invalid theme.');
  assert.equal(srv.tr(req({ cookie: 'idioma=es' }), null, 'srv.erro.tema_invalido', undefined, DICT), 'Tema inválido.');
  assert.equal(srv.tr(req(), null, 'srv.erro.senha_curta', { min: 8 }, DICT), 'A senha precisa ter ao menos 8 caracteres.');
  assert.equal(srv.tr(req({ cookie: 'idioma=en' }), null, 'srv.nao.existe'), 'srv.nao.existe');
});

test('erro carrega chave, parâmetros e code estável; a mensagem fica em português', () => {
  const falha = srv.erro('srv.erro.senha_curta', { min: 8 }, 422);
  assert.equal(falha.message, 'A senha precisa ter ao menos 8 caracteres.');
  assert.equal(falha.status, 422);
  assert.equal(falha.code, 'erro.senha_curta');
  assert.deepEqual(srv.corpoErro(req({ cookie: 'idioma=en' }), null, falha, 'srv.erro.erro_interno', DICT), { error: 'The password needs at least 8 characters.', code: 'erro.senha_curta' });
  assert.deepEqual(srv.corpoErro(req(), null, falha), { error: 'A senha precisa ter ao menos 8 caracteres.', code: 'erro.senha_curta' });
});

test('erro sem chave: com status mantém a mensagem; sem status vira a reserva', () => {
  const doProvedor = Object.assign(new Error('invalid x-api-key'), { status: 400 });
  assert.deepEqual(srv.corpoErro(req(), null, doProvedor, 'srv.erro.geracao_falhou'), { error: 'invalid x-api-key' });
  assert.deepEqual(srv.corpoErro(req(), null, new Error('boom'), 'srv.erro.geracao_falhou'), { error: 'Não foi possível gerar o material com IA.', code: 'erro.geracao_falhou' });
});

test('erros das validações em lib/ saem pelas chaves, com o texto em português de sempre', () => {
  assert.throws(() => validateProject({ name: '', kind: 'apostila', settings: {} }), { message: 'Dê um nome ao projeto.', key: 'srv.erro.projeto_nome' });
  assert.throws(() => validateSupport({ tipo: 'nada' }), { message: 'Escolha o tipo da mensagem.', code: 'erro.suporte_tipo' });
  assert.throws(() => validateSupport({ tipo: 'duvida', email: 'a@b.co', mensagem: 'ok', anexos: [{ nome: 'x.exe', dados: 'AA==' }] }), { key: 'srv.erro.anexo_tipo', params: { arquivo: 'x.exe' } });
});

test('ressalva legal entra após a abertura de <main> em outro idioma e mantém html lang pt-BR', () => {
  const html = '<!doctype html><html lang="pt-BR"><body><main class="legal-doc">\n<h1>Termos</h1></body></html>';
  const en = srv.injetarRessalva(html, 'en', DICT);
  assert.match(en, /<main class="legal-doc">\n\s*<p class="ressalva-legal" lang="en" role="note">Only in Portuguese &lt;b&gt;&amp; more&lt;\/b&gt;\.<\/p>\n<h1>/);
  assert.match(en, /<html lang="pt-BR">/);
  assert.equal(srv.injetarRessalva(html, 'pt-BR', DICT), html);
  assert.equal(srv.injetarRessalva(html, 'es', DICT), html, 'sem a chave no dicionário, não injeta a chave crua');
  assert.match(srv.injetarRessalva('<body><h1>T</h1><p>x</p></body>', 'de', DICT), /<\/h1>\n\s*<p class="ressalva-legal" lang="de"/);
});

test('regra de idioma para a IA usa o nome do idioma', () => {
  assert.equal(srv.regraDeIdioma('en', DICT), 'Write ALL output in English.');
  assert.match(srv.regraDeIdioma('de'), /auf Deutsch/);
  assert.match(srv.regraDeIdioma('pt-BR'), /português do Brasil/);
  assert.match(app.withLanguageRule('Você revisa prompts em português do Brasil. Fim.', 'en'), /^Você revisa prompts\. Fim\. Write ALL the output.*English\.$/);
});

test('prévia e PDF seguem o idioma recebido; language inválido vira pt-BR', async () => {
  assert.match(app.renderDocument({ prompt: 'x', language: 'de' }), /<html lang="de">/);
  assert.match(app.renderDocument({ prompt: 'x', language: 'zz' }), /<html lang="pt-BR">.*Material didático/);
  assert.match(app.renderDocument({ prompt: 'x', language: { a: 1 } }), /<html lang="pt-BR">/);
  assert.equal((await app.renderPdf({ prompt: 'x', language: 'en' })).subarray(0, 5).toString(), '%PDF-');
  assert.match(app.embedImages('<body></body>', [{ data: 'aa' }], 'it'), /Illustrazioni del contenuto/);
});

test('páginas legais: ressalva em outro idioma, sem mudar o lang; pt-BR fica intacto', async () => {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    for (const pagina of ['termos.html', 'privacidade.html']) {
      const original = await (await fetch(`${base}/${pagina}`)).text();
      assert.doesNotMatch(original, /ressalva-legal/);
      const resposta = await fetch(`${base}/${pagina}`, { headers: { cookie: 'idioma=en' } });
      const html = await resposta.text();
      assert.match(html, /<html lang="pt-BR">/);
      assert.match(html, /<main[^>]*>\s*<p class="ressalva-legal" lang="en" role="note">/);
      assert.match(resposta.headers.get('vary'), /Cookie/);
    }
    const erro = await fetch(`${base}/api/auth/me`, { headers: { cookie: 'idioma=en' } });
    const corpo = await erro.json();
    assert.equal(erro.status, 401);
    assert.equal(corpo.code, 'erro.sessao_expirada');
    assert.ok(corpo.error);
    const ptBr = await (await fetch(`${base}/api/auth/me`)).json();
    assert.equal(ptBr.error, 'Sessão expirada. Entre novamente.');
  } finally {
    await new Promise(resolve => app.server.close(resolve));
  }
});

test('e-mail: lang, rodapé e assunto no idioma do destinatário (com o português como reserva)', async () => {
  const { html, text } = renderEmail({ title: 'T', paragraphs: ['p'] }, {}, false, 'de');
  assert.match(html, /<html lang="de">/);
  assert.match(text, /Kontakt: /, 'o rodapé segue o idioma do destinatário');
  const sent = [];
  const mailer = createMailer({ host: 'smtp.exemplo.com', from: 'x@exemplo.com' }, { sendMail: async message => { sent.push(message); } });
  await mailer.sendResetCode('a@b.co', '123456', 10, 'es');
  await mailer.sendResetCode('a@b.co', '123456', 10);
  assert.match(sent[0].html, /<html lang="es">/);
  assert.match(sent[1].html, /<html lang="pt-BR">/);
  assert.equal(sent[1].subject, 'GeradorOne: código para redefinir sua senha');
});

test('idioma da conta: aceita códigos suportados e vazio, recusa o resto', async () => {
  const linha = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana', email: 'a@b.co', phone: '35999998888', role: 'user', active: true, password_hash: 'h', must_change_password: false, pwd_version: 1, ai: {}, theme: '', language: '', terms_version: null, terms_accepted_at: null, created_at: new Date(), updated_at: new Date() };
  const client = { query: async (sql, params) => (sql.startsWith('SELECT') ? { rows: [linha] } : { rows: [{ ...linha, language: params[11] }] }) };
  const store = createUserStore({ tx: work => work(client), query: client.query });
  assert.equal((await store.update(linha.id, { language: 'EN-us', keepSessions: true })).language, 'en');
  assert.equal((await store.update(linha.id, { language: '', keepSessions: true })).language, '');
  await assert.rejects(store.update(linha.id, { language: 'xx' }), { code: 'erro.idioma_invalido', message: 'Idioma inválido.', status: 400 });
  await assert.rejects(store.update(linha.id, { language: null }), { code: 'erro.idioma_invalido' });
  assert.equal(app.db === undefined, false);
});

test('instruções para a IA em pt-BR seguem idênticas ao original (sem regra extra)', () => {
  const original = 'Você revisa prompts em português do Brasil. Fim.';
  assert.equal(app.withLanguageRule(original, 'pt-BR'), original);
});

test('e-mail de contato nos arquivos de idioma não quebra o JS nem injeta código', () => {
  const padrao = 'fulano@dominio.com.br';
  const fonte = `const d = { "faq.1": "Fale com ${padrao} para ajuda" };`;
  const malicioso = 'x"+alert(1)+"@a.co';
  const js = srv.trocarContato(fonte, '.js', padrao, malicioso);
  const d = new Function(`${js}; return d;`)();
  assert.equal(d['faq.1'], `Fale com ${malicioso} para ajuda`, 'o texto entra como dado, nunca como código');
  const html = srv.trocarContato('<p>fulano@dominio.com.br</p>', '.html', padrao, 'a<b>@c.co');
  assert.equal(html, '<p>a&lt;b&gt;@c.co</p>');
  assert.equal(srv.trocarContato('sem contato', '.js', padrao, 'ok@a.co'), 'sem contato');
});
