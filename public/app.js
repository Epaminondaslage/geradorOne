// Os valores (ids) seguem estáveis para os projetos antigos; só o nome e a descrição exibidos passam por t().
const styles = ['Cartoon', 'Hand-drawn', 'Doodle', 'Cartoon Educacional', 'Scientific Illustration', 'Futuristic Digital', 'Infográfico Moderno', 'Minimalista', '3D Educacional', 'Realista', 'Livro Didático', 'Colorido Infantil'];
const styleSlug = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
// O título em português segue aqui como referência; a tela usa js.recurso.<id>.titulo e .desc, e o prompt usa prompt.recurso.<id> (prompts.js).
const resources = [
  ['mapasMentais','◉','Mapas mentais','Síntese radial e conexões'],['diagramas','◇','Diagramas','Processos, relações e fluxos'],['ilustracoes','✦','Ilustrações','Conceitos, cenas e objetos'],['infograficos','▦','Infográficos','Dados e explicações visuais'],['graficos','⌁','Gráficos','Somente com dados verificáveis'],['quadros','▤','Quadros comparativos','Contrastes e classificações'],['linhas','↝','Linhas do tempo','Eventos em sequência'],['icones','⬡','Ícones e sinalização','Navegação e destaques']
];
const resourceSlug = name => name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const themeSlug = id => id.replace(/-/g, '_');
const THEME_LIST = ['papel', 'grafite', 'lousa', 'azul-tinta', 'sepia', 'alto-contraste'].map(id => ({
  id,
  get nome() { return t(`js.tema.${themeSlug(id)}.nome`); },
  get desc() { return t(`js.tema.${themeSlug(id)}.desc`); }
}));
const themeNames = Object.fromEntries(THEME_LIST.map(theme => [theme.id, theme.id]));
const themeLabel = id => t(`js.tema.${themeSlug(id)}.nome`);
const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'grafite' : 'papel');
function storedTheme() {
  let saved = null;
  try { saved = localStorage.getItem('apostila-theme'); } catch { /* armazenamento bloqueado */ }
  if (saved === 'light') saved = 'papel';
  if (saved === 'dark') saved = 'grafite';
  return themeNames[saved] || saved === 'sistema' ? saved : null;
}
// Sem escolha explícita, a primeira entrada é no tema Papel. "Seguir o sistema" é uma opção marcada pela pessoa
// (guardada como 'sistema'): claro vira Papel, escuro vira Grafite.
let themeFollowsSystem = storedTheme() === 'sistema';

function setTheme(theme, { persist = true } = {}) {
  document.documentElement.dataset.theme = theme;
  try { if (persist) localStorage.setItem('apostila-theme', themeFollowsSystem ? 'sistema' : theme); else localStorage.removeItem('apostila-theme'); } catch { /* armazenamento bloqueado */ }
  document.querySelector('#theme-name').textContent = themeLabel(theme);
  renderThemeView();
}

function saveThemeToAccount(theme) {
  if (!currentUser) return;
  postJson('api/auth/theme', { theme }).then(result => {
    if (result.ok) currentUser = result.data.user;
    else notify(t('js.tema.nao_salvo_conta'));
  });
}
function chooseTheme(id) {
  themeFollowsSystem = false;
  setTheme(id);
  saveThemeToAccount(id);
}
function followSystemTheme(on) {
  themeFollowsSystem = on;
  if (on) {
    setTheme(systemTheme());
    saveThemeToAccount('sistema');
  } else {
    const current = document.documentElement.dataset.theme;
    setTheme(current);
    saveThemeToAccount(current);
  }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeFollowsSystem) setTheme(systemTheme()); });

function renderThemeView() {
  const gallery = document.querySelector('#theme-gallery');
  if (!gallery) return;
  const current = document.documentElement.dataset.theme;
  document.querySelector('#theme-follow').checked = themeFollowsSystem;
  gallery.innerHTML = THEME_LIST.map(theme => `<button type="button" role="radio" class="theme-card" aria-checked="${theme.id === current}" data-theme-pick="${theme.id}">
    <span class="theme-mini" data-theme-scope="${theme.id}" aria-hidden="true"><span class="mini-rail"><i></i><i></i><i></i><i></i></span><span class="mini-sheet"><b>${t('js.tema.mini_apostila')}</b><i class="mini-field"></i><i class="mini-field"></i><em>${t('js.tema.mini_gerar')}</em></span></span>
    <span class="theme-meta"><span class="theme-line"><strong>${theme.nome}</strong><span class="theme-mark">${theme.id === current ? t('js.tema.em_uso') : ''}</span></span><span class="field-help">${theme.desc}</span></span>
  </button>`).join('');
}
document.querySelector('#theme-gallery').addEventListener('click', event => {
  const card = event.target.closest('[data-theme-pick]');
  if (card) chooseTheme(card.dataset.themePick);
});
document.querySelector('#theme-follow').addEventListener('change', event => followSystemTheme(event.target.checked));
setTheme(themeFollowsSystem ? systemTheme() : (storedTheme() || 'papel'), { persist: Boolean(storedTheme()) });

function renderStyleOptions(container, prefix) {
  const marcado = container.querySelector('input:checked')?.value;
  container.replaceChildren();
  styles.forEach((name, index) => container.insertAdjacentHTML('beforeend', `<div class="option"><input type="radio" name="estiloVisual" id="${prefix}-${index}" value="${name}" ${name === 'Livro Didático' ? 'checked' : ''}><label for="${prefix}-${index}"><span class="style-sample">${styleArt(index, prefix)}</span><strong>${t(`js.estilo.${styleSlug(name)}.nome`)}</strong><small>${t(`js.estilo.${styleSlug(name)}.desc`)}</small></label></div>`));
  if (marcado) { const escolhido = [...container.querySelectorAll('input')].find(input => input.value === marcado); if (escolhido) escolhido.checked = true; }
}
renderStyleOptions(document.querySelector('#style-options'), 'style');
renderStyleOptions(document.querySelector('#capa-style-options'), 'capa-style');
const resourceContainer = document.querySelector('#resource-options');
const visualSamples = {
  mapasMentais:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="24" cy="24" r="5"/><path d="M19.5 21.5 12 15M28.5 21.5 36 15M19.5 26.5 12 33M28.5 26.5 36 33"/><circle cx="9" cy="12.5" r="3.5"/><circle cx="39" cy="12.5" r="3.5"/><circle cx="9" cy="35.5" r="3.5"/><circle cx="39" cy="35.5" r="3.5"/></svg>',
  diagramas:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="4" width="20" height="9" rx="2"/><path d="M24 13v5"/><path d="M24 18 36 26 24 34 12 26Z"/><path d="M12 26H7v8M36 26h5v8"/><rect x="2" y="34" width="12" height="9" rx="2"/><rect x="34" y="34" width="12" height="9" rx="2"/></svg>',
  ilustracoes:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8" width="38" height="32" rx="2"/><circle cx="16" cy="19" r="3.5"/><path d="M5 35l11-9 8 7 7-6 12 9"/></svg>',
  infograficos:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="5" width="36" height="38" rx="2"/><path d="M12 12h14"/><path d="M12 36V28M19 36V20M26 36V25M33 36V16"/><path d="M12 36h24"/></svg>',
  graficos:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 6v35h36"/><path d="M12 32l9-10 7 5 12-16"/><path d="M34 11h6v6"/></svg>',
  quadros:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8" width="38" height="32" rx="2"/><path d="M5 18h38M17.7 8v32M30.3 8v32"/><path d="M9 13h4M21.5 13h4M34 13h4"/></svg>',
  linhas:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 24h38"/><circle cx="13" cy="24" r="3"/><circle cx="24" cy="24" r="3"/><circle cx="35" cy="24" r="3"/><path d="M13 21v-8M35 21v-8M24 27v8"/><path d="M9 13h8M31 13h8M20 35h8"/></svg>',
  icones:'<svg class="resource-icon" viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 5 42 37H6Z"/><path d="M24 17v10"/><circle cx="24" cy="32" r=".5"/></svg>'
};
function renderResources() {
  const marcados = new Set([...resourceContainer.querySelectorAll('input:checked')].map(input => input.name));
  resourceContainer.replaceChildren();
  resources.forEach(([name, icon]) => resourceContainer.insertAdjacentHTML('beforeend', `<div class="resource"><input type="checkbox" name="${name}" id="${name}"${marcados.has(name) ? ' checked' : ''}><label for="${name}"><span class="resource-demo" aria-hidden="true">${visualSamples[name] || icon}</span><span class="resource-text"><strong>${t(`js.recurso.${resourceSlug(name)}.titulo`)}</strong><small>${t(`js.recurso.${resourceSlug(name)}.desc`)}</small></span></label></div>`));
}
renderResources();

// Reaproveita os SVGs dos recursos visuais dentro do cérebro da marca.
// O contorno permanece fixo; somente o pictograma troca com fade suave.
const logoResourceSequence = ['infograficos', 'diagramas', 'ilustracoes', 'graficos', 'quadros', 'linhas', 'mapasMentais', 'icones'];
const animatedLogos = [...document.querySelectorAll('.logo')].map(logo => {
  const glyph = document.createElement('span');
  glyph.className = 'logo-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  logo.append(glyph);
  return { logo, glyph };
});
let logoResourceIndex = 0;

function renderLogoGlyph(index) {
  const svg = visualSamples[logoResourceSequence[index]];
  animatedLogos.forEach(({ glyph }) => { glyph.innerHTML = svg; });
}

renderLogoGlyph(logoResourceIndex);
const reducedLogoMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (!reducedLogoMotion.matches) {
  setInterval(() => {
    if (document.hidden) return;
    animatedLogos.forEach(({ logo }) => logo.classList.add('is-changing'));
    setTimeout(() => {
      logoResourceIndex = (logoResourceIndex + 1) % logoResourceSequence.length;
      renderLogoGlyph(logoResourceIndex);
      requestAnimationFrame(() => animatedLogos.forEach(({ logo }) => logo.classList.remove('is-changing')));
    }, 320);
  }, 2200);
}

const form = document.querySelector('#formulario');
const capaForm = document.querySelector('#form-capa');
const output = document.querySelector('#prompt-output');
const previewFrame = document.querySelector('#preview-frame');
const generatedFiles = document.querySelector('#generated-files');
const status = document.querySelector('#status');
const toast = document.querySelector('#toast');
const formFor = kind => (kind === 'capa' ? capaForm : form);
let currentUser = null;
const authScreen = document.querySelector('#auth-screen');
const appShell = document.querySelector('#shell');
const AUTH_PUBLIC = ['api/auth/login', 'api/auth/forgot', 'api/auth/confirm', 'api/auth/signup', 'api/auth/signup/confirm', 'api/auth/logout', 'api/auth/config'];

async function apiFetch(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  if (response.status === 401 && !AUTH_PUBLIC.includes(url)) showAuth('login', t('js.erro.sessao_expirada'));
  if (response.status === 403 && currentUser && !currentUser.mustChangePassword) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.code === 'PASSWORD_CHANGE_REQUIRED') { currentUser.mustChangePassword = true; showAuth('first'); }
  }
  return response;
}

function formatPhone(digits = '') {
  const d = String(digits).replace(/\D/g, '');
  const local = d.length > 11 && d.startsWith('55') ? d.slice(2) : d;
  const prefix = local.length !== d.length ? '+55 ' : '';
  if (local.length === 11) return `${prefix}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `${prefix}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return d;
}

function randomPassword(length = 14) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

async function postJson(url, body) {
  const response = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

let currentPrompt = '';
let currentPreviewHtml = '';
let currentKind = 'apostila';
let currentProjectId = null;
let currentProjectKind = null;
let toastTimer;
let currentFiles = [];

function updateGenerationMode() {
  document.querySelector('.generate-label').textContent = t('js.gerar.prompt_completo');
}

let aiAvailable = false;
let aiImages = true;

async function checkAiAvailability() {
  const label = document.querySelector('#ai-availability');
  try {
    const response = await apiFetch('api/ai/status');
    const data = await response.json();
    aiAvailable = Boolean(data.available);
    aiImages = data.images !== false;
    label.textContent = data.available ? t(aiImages ? 'js.ia.disponivel' : 'js.ia.disponivel_sem_imagens', { provider: data.provider, model: data.model }) : t('js.ia.sem_chave');
    label.className = `field-status ${data.available ? 'available' : 'unavailable'}`;
  } catch {
    label.textContent = t('js.ia.erro_verificar');
    label.className = 'field-status unavailable';
  }
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('show');
  toastTimer = setTimeout(() => { toast.classList.remove('show'); toast.hidden = true; }, 2600);
}

function dataObject(target = form) {
  const fd = new FormData(target);
  const data = Object.fromEntries(fd.entries());
  if (target === form) {
    resources.forEach(([name]) => data[name] = fd.has(name));
    data.sugerirBncc = fd.has('sugerirBncc');
  }
  return data;
}

function selectedResources(data) {
  return resources.filter(([name]) => data[name]).map(([, , title]) => title);
}

function applyData(target, data) {
  Object.entries(data || {}).forEach(([name, value]) => {
    const fields = target.elements.namedItem(name);
    if (!fields) return;
    if (fields instanceof RadioNodeList) {
      [...fields].forEach(field => { field.checked = field.value === value; });
    } else if (fields.type === 'checkbox') {
      fields.checked = Boolean(value);
    } else if (typeof value === 'string') {
      fields.value = value;
      // Projetos salvos antes de 23/10/2026 guardam "Intensa — 4 ou mais por seção": escolhe a opção que começa com a mesma palavra.
      if (fields.tagName === 'SELECT' && fields.selectedIndex === -1 && name === 'frequencia') {
        const first = value.split(/\s/)[0];
        const match = [...fields.options].find(option => option.value.startsWith(first));
        if (match) fields.value = match.value;
      }
    }
  });
  updateCompletion();
}

// Os geradores de prompt (apostila, imagem e capa) ficam em prompts.js e recebem o t() do idioma atual.
const geradores = () => window.prompts.criarGeradores(window.t, window.idioma.idioma);

const workspace = document.querySelector('#workspace') || document.querySelector('.workspace');
const outPanel = document.querySelector('#out-panel');
const outEmpty = document.querySelector('#out-empty');
const outBody = document.querySelector('#out-body');
const outBadge = document.querySelector('#out-badge');
const resultActions = document.querySelector('#result-actions');
const projectName = document.querySelector('#project-name');
const saveProjectButton = document.querySelector('#save-project');
const saveProjectNewButton = document.querySelector('#save-project-new');
const improveBox = document.querySelector('#improve-box');
const improveOpen = document.querySelector('#improve-open');
const showPromptButton = document.querySelector('#show-prompt');
const previewButton = document.querySelector('#preview');
// Botões de ação (docs/PADRAO_ICONES.md): SVG estilo Feather, 16 px, traço 2, caixa 30×30 tonal, só o ícone com título.
// Na exclusão (dois cliques), o botão mostra o texto de confirmação enquanto está "armado".
const ACTION_ICONS = {
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  view: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  sync: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>'
};
function actionButton(kind, icon, title, attrs = '') {
  return `<button type="button" class="act act-${kind}" title="${title}" aria-label="${title}" ${attrs}><svg class="icon-svg" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ACTION_ICONS[icon]}</svg><span class="act-label"></span></button>`;
}
function armAction(button, confirmText, idleTitle, ms) {
  button.classList.add('armed');
  button.lastElementChild.textContent = confirmText;
  button.title = confirmText;
  button.setAttribute('aria-label', confirmText);
  setTimeout(() => {
    button.classList.remove('armed');
    button.lastElementChild.textContent = '';
    button.title = idleTitle;
    button.setAttribute('aria-label', idleTitle);
  }, ms);
}
const KIND_LABEL = { get apostila() { return t('js.projetos.tipo_apostila'); }, get capa() { return t('js.projetos.tipo_capa'); } };
const RESULT_BADGE = { get apostila() { return t('js.gerar.badge_apostila'); }, get capa() { return t('js.gerar.badge_capa'); } };

function updateCompletion() {
  const data = dataObject(form);
  const required = ['disciplina','assunto','publico'];
  const optional = ['objetivo','referencias','orientacoes'];
  const score = required.filter(k => data[k]).length * 20 + optional.filter(k => data[k]).length * 8 + selectedResources(data).length * 2;
  const percent = Math.min(100, score);
  document.querySelector('#completion').textContent = `${percent}%`;
  document.querySelector('#completion-ring').style.setProperty('--pct', percent);
}
form.addEventListener('input', () => { updateCompletion(); updateGenerationMode(); });
document.querySelector('#select-all-resources').addEventListener('click', () => { resources.forEach(([name]) => { form.elements.namedItem(name).checked = true; }); updateCompletion(); });
document.querySelector('#clear-resources').addEventListener('click', () => { resources.forEach(([name]) => { form.elements.namedItem(name).checked = false; }); updateCompletion(); });

function validateRequired(target) {
  let valid = true;
  target.querySelectorAll('[required]').forEach(field => { const bad = !field.value.trim(); field.setAttribute('aria-invalid', String(bad)); if (bad) valid = false; });
  if (!valid) target.querySelector('[aria-invalid=true]').focus();
  return valid;
}

let savedAtLabel = '';
const clockLabel = value => new Date(value || Date.now()).toLocaleTimeString(window.idioma.idioma, { hour: '2-digit', minute: '2-digit' });

function updateCrumbs() {
  document.querySelector('#crumb-name').textContent = projectName.value.trim() || t('js.projetos.novo');
  document.querySelector('#crumb-state').textContent = currentProjectId ? (savedAtLabel ? t('js.projetos.salvo_as', { hora: savedAtLabel }) : t('js.projetos.salvo')) : t('js.projetos.nao_salvo');
}
function setProjectName(value) {
  projectName.value = value;
  updateCrumbs();
}
function toggleRename(open) {
  const box = document.querySelector('#crumb-rename-box');
  box.hidden = !open;
  if (open) { projectName.focus(); projectName.select(); }
  updateCrumbs();
}

function syncSaveButtons() {
  saveProjectButton.querySelector('.save-label').textContent = t(currentProjectId ? 'js.projetos.atualizar' : 'js.projetos.salvar');
  saveProjectNewButton.hidden = !currentProjectId;
  if (!currentProjectId) savedAtLabel = '';
  updateCrumbs();
}

function setResultTab(tab) {
  showPromptButton.classList.toggle('active', tab === 'prompt');
  previewButton.classList.toggle('active', tab === 'preview');
  showPromptButton.setAttribute('aria-pressed', String(tab === 'prompt'));
  previewButton.setAttribute('aria-pressed', String(tab === 'preview'));
}

const isMobileLayout = () => matchMedia('(max-width: 900px)').matches;
// Celular: Dados e Resultado viram duas etapas, com o botão de gerar fixo no pé da tela.
const mobileSteps = document.querySelector('#mobile-steps');
function setStep(step) {
  workspace.dataset.step = step;
  mobileSteps.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.step === step)));
  if (isMobileLayout()) window.scrollTo({ top: 0 });
}
mobileSteps.addEventListener('click', event => {
  const button = event.target.closest('[data-step]');
  if (button) setStep(button.dataset.step);
});
document.querySelector('#mobile-projects').addEventListener('click', () => showView('projetos'));

let badgeAi = false;
let badgeTime = null;
function showResult({ prompt, kind, badge, files = false }) {
  badgeAi = files;
  badgeTime = new Date();
  currentPrompt = prompt;
  currentKind = kind;
  if (currentProjectId && currentProjectKind !== kind) currentProjectId = null;
  currentPreviewHtml = '';
  currentFiles = [];
  outEmpty.hidden = true;
  outBody.hidden = false;
  outBadge.textContent = `${badge} · ${new Date().toLocaleTimeString(window.idioma.idioma, { hour: '2-digit', minute: '2-digit' })}`;
  outBadge.hidden = false;
  output.textContent = prompt;
  output.hidden = files;
  previewFrame.hidden = true;
  generatedFiles.hidden = !files;
  resultActions.hidden = files;
  improveBox.hidden = true;
  improveOpen.setAttribute('aria-expanded', 'false');
  document.querySelector('#ai-block').hidden = kind !== 'apostila';
  setResultTab('prompt');
  syncSaveButtons();
  if (isMobileLayout()) setStep('resultado');
  else if (matchMedia('(max-width: 1180px)').matches) outPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelector('#generate-ai').addEventListener('click', () => {
  if (!aiAvailable) { notify(t('js.ia.salve_chave_gerar')); return; }
  if (!aiImages && form.elements.modoImagem.value === 'gerar') { notify(aiNoImagesMessage()); return; }
  const mode = form.elements.modoGeracao;
  mode.value = 'ai';
  form.requestSubmit();
  mode.value = 'prompt';
});
document.querySelector('#ai-change-key').addEventListener('click', () => showView('ia'));

function projectTitle() {
  const data = dataObject(formFor(currentKind));
  return (currentKind === 'capa' ? data.titulo : data.assunto) || 'Prompt GeradorOne';
}

// ---------- BNCC: seletor de habilidades ----------
// Os textos vêm de public/data/bncc.json (dataset bncc.dev, CC BY 4.0, gerado por scripts/build-bncc-data.js) e são carregados só quando precisam.
const bncc = { data: null, index: null, loading: null, selected: new Set() };
const BNCC_CODE = /\bE[IFM]\d{2}[A-Z]{2,3}\d{2,3}\b/gi;
const BNCC_RENDER_LIMIT = 150;
const bnccCodesIn = value => [...new Set((String(value || '').match(BNCC_CODE) || []).map(code => code.toUpperCase()))];
const bnccNormalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function loadBncc() {
  if (bncc.data) return Promise.resolve(bncc.data);
  if (!bncc.loading) {
    bncc.loading = fetch('data/bncc.json', { credentials: 'same-origin' })
      .then(response => { if (!response.ok) throw new Error('falha'); return response.json(); })
      .then(data => { bncc.data = data; bncc.index = new Map(data.itens.map(item => [item.c, item])); return data; })
      .catch(error => { bncc.loading = null; throw error; });
  }
  return bncc.loading;
}

// Bloco com o texto oficial das habilidades digitadas, para a IA não precisar adivinhar nem inventar.
async function bnccTextBlock(raw) {
  const codes = bnccCodesIn(raw);
  if (!codes.length) return '';
  try { await loadBncc(); } catch { return ''; }
  const known = codes.map(code => bncc.index.get(code)).filter(Boolean);
  const unknown = codes.filter(code => !bncc.index.has(code));
  return geradores().blocoBncc({ conhecidas: known, desconhecidas: unknown, fonte: bncc.data.fonte.nome, versao: bncc.data.versao });
}

const bnccEls = {
  open: document.querySelector('#bncc-open'), panel: document.querySelector('#bncc-picker'), hint: document.querySelector('#bncc-hint'),
  etapa: document.querySelector('#bncc-etapa'), recorte: document.querySelector('#bncc-recorte'), grupo: document.querySelector('#bncc-grupo'), busca: document.querySelector('#bncc-busca'),
  recorteLabel: document.querySelector('#bncc-recorte-label'), grupoLabel: document.querySelector('#bncc-grupo-label'),
  status: document.querySelector('#bncc-status'), list: document.querySelector('#bncc-list'), count: document.querySelector('#bncc-selecionadas'),
  clear: document.querySelector('#bncc-limpar'), use: document.querySelector('#bncc-usar'), versao: document.querySelector('#bncc-versao'), input: form.elements.bncc
};
const BNCC_STAGE_SHORT = { get EI() { return t('js.bncc.etapa_ei'); }, get EF() { return t('js.bncc.etapa_ef'); }, get EM() { return t('js.bncc.etapa_em'); } };
const BNCC_RECORTE = { get EI() { return t('js.bncc.recorte_ei'); }, get EF() { return t('js.bncc.recorte_ef'); }, EM: '' };
const BNCC_GRUPO = { get EI() { return t('js.bncc.grupo_ei'); }, get EF() { return t('js.bncc.grupo_ef'); }, get EM() { return t('js.bncc.grupo_em'); }, get '' () { return t('js.bncc.grupo_todos'); } };
const BNCC_EF_YEARS = Array.from({ length: 9 }, (_, index) => `${index + 1}º ano`);

function bnccFillSelect(select, values, placeholder = t('js.bncc.todos'), label = value => value) {
  select.replaceChildren(new Option(placeholder, ''), ...values.map(value => new Option(label(value), value)));
}

function bnccRefreshOptions() {
  const stage = bnccEls.etapa.value;
  const items = bncc.data.itens.filter(item => !stage || item.e === stage);
  const groups = [...new Set(items.map(item => item.g))].sort((a, b) => (a === 'Computação') - (b === 'Computação') || a.localeCompare(b, 'pt-BR'));
  bnccFillSelect(bnccEls.grupo, groups);
  bnccEls.grupoLabel.textContent = BNCC_GRUPO[stage];
  const ranges = stage === 'EI' ? [...new Set(items.flatMap(item => item.r))] : stage === 'EF' ? BNCC_EF_YEARS : [];
  // Os valores seguem em português (batem com o bncc.json); só o rótulo do ano é traduzido.
  bnccFillSelect(bnccEls.recorte, ranges, undefined, stage === 'EF' ? value => t('js.bncc.ano_n', { n: Number.parseInt(value, 10) }) : undefined);
  bnccEls.recorte.disabled = !ranges.length;
  bnccEls.recorteLabel.textContent = BNCC_RECORTE[stage] || (stage === 'EM' ? t('js.bncc.sem_seriacao') : t('js.bncc.ano_ou_faixa'));
}

function bnccMatches() {
  const stage = bnccEls.etapa.value;
  const range = bnccEls.recorte.value;
  const group = bnccEls.grupo.value;
  const words = bnccNormalize(bnccEls.busca.value.trim()).split(/\s+/).filter(Boolean);
  return bncc.data.itens.filter(item => {
    if (stage && item.e !== stage) return false;
    if (range && !item.r.includes(range)) return false;
    if (group && item.g !== group) return false;
    if (!words.length) return true;
    const haystack = bnccNormalize(`${item.c} ${item.t} ${item.h || ''} ${item.k || ''}`);
    return words.every(word => haystack.includes(word));
  });
}

function bnccRender() {
  if (!bncc.data) return;
  const matches = bnccMatches();
  const shown = matches.slice(0, BNCC_RENDER_LIMIT);
  bnccEls.list.replaceChildren(...shown.map(item => {
    const row = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'bncc-item';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = item.c;
    box.checked = bncc.selected.has(item.c);
    const body = document.createElement('span');
    const code = document.createElement('strong');
    code.className = 'bncc-code';
    code.textContent = item.c;
    const meta = document.createElement('small');
    meta.className = 'bncc-meta';
    meta.textContent = [BNCC_STAGE_SHORT[item.e], item.r.length ? item.r.join(', ') : '', item.g, item.h || ''].filter(Boolean).join(' · ');
    const text = document.createElement('span');
    text.className = 'bncc-text';
    text.textContent = item.t;
    body.append(code, ' ', meta, text);
    label.append(box, body);
    row.append(label);
    return row;
  }));
  bnccEls.status.textContent = !matches.length
    ? t('js.bncc.nenhuma_encontrada')
    : matches.length > shown.length ? t('js.bncc.mostrando', { mostradas: shown.length, total: matches.length }) : t.plural('js.bncc.habilidades', matches.length);
}

function bnccUpdateCount() {
  const total = bncc.selected.size;
  bnccEls.count.textContent = total ? t.plural('js.bncc.selecionadas', total) : t('js.bncc.nenhuma_selecionada');
  bnccEls.use.disabled = !total;
}

async function bnccCheckTyped() {
  const codes = bnccCodesIn(bnccEls.input.value);
  if (!codes.length) { bnccEls.hint.textContent = ''; bnccEls.hint.className = 'field-status'; return; }
  try { await loadBncc(); } catch { bnccEls.hint.textContent = ''; return; }
  const unknown = codes.filter(code => !bncc.index.has(code));
  bnccEls.hint.textContent = unknown.length ? t('js.bncc.nao_encontrei', { codigos: unknown.join(', ') }) : t.plural('js.bncc.reconhecidos', codes.length);
  bnccEls.hint.className = `field-status ${unknown.length ? 'unavailable' : 'available'}`;
}

let bnccTypedTimer;
bnccEls.input.addEventListener('input', () => { clearTimeout(bnccTypedTimer); bnccTypedTimer = setTimeout(bnccCheckTyped, 400); });

bnccEls.open.addEventListener('click', async () => {
  const open = bnccEls.panel.hidden;
  bnccEls.panel.hidden = !open;
  bnccEls.open.setAttribute('aria-expanded', String(open));
  if (!open) return;
  bnccEls.status.textContent = t('js.bncc.carregando');
  try {
    await loadBncc();
  } catch {
    bnccEls.status.textContent = t('js.bncc.erro_carregar');
    return;
  }
  bnccEls.versao.textContent = bncc.data.versao;
  bnccEls.etapa.value = '';
  bnccRefreshOptions();
  bnccEls.busca.value = '';
  bnccRender();
  bnccUpdateCount();
  bnccEls.busca.focus();
});

bnccEls.etapa.addEventListener('change', () => { bnccRefreshOptions(); bnccRender(); });
bnccEls.recorte.addEventListener('change', bnccRender);
bnccEls.grupo.addEventListener('change', bnccRender);
bnccEls.busca.addEventListener('input', bnccRender);
bnccEls.busca.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
bnccEls.list.addEventListener('change', event => {
  const box = event.target.closest('input[type=checkbox]');
  if (!box) return;
  if (box.checked) bncc.selected.add(box.value); else bncc.selected.delete(box.value);
  bnccUpdateCount();
});
bnccEls.clear.addEventListener('click', () => { bncc.selected.clear(); bnccRender(); bnccUpdateCount(); });
bnccEls.use.addEventListener('click', () => {
  const current = bnccEls.input.value.trim();
  const already = new Set(bnccCodesIn(current));
  const added = [...bncc.selected].filter(code => !already.has(code));
  bnccEls.input.value = [current, ...added].filter(Boolean).join(', ');
  bnccEls.input.dispatchEvent(new Event('input', { bubbles: true }));
  bnccEls.panel.hidden = true;
  bnccEls.open.setAttribute('aria-expanded', 'false');
  bncc.selected.clear();
  bnccEls.input.focus();
  notify(added.length ? t.plural('js.bncc.adicionadas', added.length) : t('js.bncc.ja_estavam'));
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateRequired(form)) return;
  const settings = dataObject(form);
  settings.bnccTextos = await bnccTextBlock(settings.bncc);
  const aiMode = settings.modoGeracao === 'ai';
  const prompt = aiMode ? geradores().montarPromptApostila(settings) : geradores().generateImagePrompt(settings);
  showResult({ prompt, kind: 'apostila', badge: aiMode ? t('js.gerar.badge_ia') : RESULT_BADGE.apostila, files: aiMode });
  if (!currentProjectId) setProjectName(settings.assunto);
  if (!aiMode) {
    status.textContent = t('js.gerar.prompt_montado');
    return;
  }
  generatedFiles.innerHTML = `<div class="ai-loading"><span class="ai-spinner" aria-hidden="true"></span><strong>${escapeUi(t('js.gerar.produzindo'))}</strong><span>${escapeUi(t('js.gerar.demora'))}</span></div>`;
  status.textContent = t('js.gerar.ia_criando');
  const button = document.querySelector('#generate-button');
  const label = button.querySelector('.generate-label');
  const originalLabel = label.textContent;
  button.disabled = true;
  label.innerHTML = '<span class="button-spinner" aria-hidden="true"></span>' + escapeUi(t('js.gerar.gerando'));
  try {
    const imageCount = settings.frequencia.startsWith('Intensa') ? 3 : settings.frequencia.startsWith('Equilibrada') ? 2 : 1;
    const response = await apiFetch('api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: settings.assunto, format: settings.formatoEntrega, prompt, generateImages: settings.modoImagem === 'gerar', imageCount, language: window.idioma.idioma }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('js.gerar.erro_material'));
    currentFiles = result.files || [];
    renderGeneratedFiles();
    status.textContent = t.plural('js.gerar.arquivos_gerados', currentFiles.length, { model: result.model });
    notify(t('js.msg.material_gerado'));
  } catch (error) {
    generatedFiles.innerHTML = `<div class="ai-loading"><strong>${escapeUi(t('js.gerar.erro_material'))}</strong><span>${escapeUi(error.message)}</span></div>`;
    status.textContent = error.message;
  } finally {
    button.disabled = false;
    label.textContent = originalLabel;
  }
});

capaForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!validateRequired(capaForm)) return;
  const settings = dataObject(capaForm);
  showResult({ prompt: geradores().generateCoverPrompt(settings), kind: 'capa', badge: RESULT_BADGE.capa });
  if (!currentProjectId) setProjectName(t('js.projetos.nome_capa', { titulo: settings.titulo }));
  status.textContent = t('js.gerar.prompt_capa_montado');
});

[form, capaForm].forEach(target => target.addEventListener('reset', () => {
  currentProjectId = null;
  setProjectName('');
  syncSaveButtons();
  setTimeout(() => { updateCompletion(); updateGenerationMode(); });
}));

function escapeUi(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function fileBlob(file) {
  const binary = atob(file.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: file.mimeType });
}

function saveGeneratedFile(index) {
  const file = currentFiles[index];
  if (!file) return;
  const url = URL.createObjectURL(fileBlob(file));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: file.name });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(t('js.msg.pronto_salvar', { nome: file.name }));
}

function renderGeneratedFiles() {
  generatedFiles.innerHTML = currentFiles.map((file, index) => {
    const extension = file.name.split('.').pop().toUpperCase();
    const size = Math.round((file.data.length * .75) / 1024);
    return `<article class="generated-file"><span class="file-icon">${escapeUi(extension)}</span><div><h3>${escapeUi(file.name)}</h3><p>${escapeUi(t('js.exportar.arquivo_tamanho', { tipo: file.mimeType, kb: size }))}</p></div><button type="button" data-save-file="${index}">${escapeUi(t('js.exportar.salvar_local'))}</button></article>`;
  }).join('');
}

generatedFiles.addEventListener('click', event => {
  const button = event.target.closest('[data-save-file]');
  if (button) saveGeneratedFile(Number(button.dataset.saveFile));
});

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: name });
  anchor.click(); URL.revokeObjectURL(url);
}
document.querySelector('#copy').addEventListener('click', async () => {
  const button = document.querySelector('#copy');
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(currentPrompt);
    else {
      const area = Object.assign(document.createElement('textarea'), { value: currentPrompt });
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    const copyIcon = button.querySelector('.copy-icon');
    const defaultIconHtml = copyIcon.innerHTML;
    const defaultLabel = button.querySelector('.copy-label').textContent;
    button.classList.add('copied');
    copyIcon.innerHTML = '<svg class="icon-svg" viewBox="0 0 20 20" width="16" height="16"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.querySelector('.copy-label').textContent = t('js.msg.copiado');
    status.textContent = t('js.msg.prompt_copiado_area');
    notify(t('js.msg.prompt_copiado'));
    setTimeout(() => { button.classList.remove('copied'); copyIcon.innerHTML = defaultIconHtml; button.querySelector('.copy-label').textContent = defaultLabel; }, 2200);
  } catch { status.textContent = t('js.msg.erro_copiar'); }
});
document.querySelector('#export-txt').addEventListener('click', () => { download(`prompt-${currentKind}.txt`, currentPrompt, 'text/plain;charset=utf-8'); notify(t('js.exportar.txt_preparado')); });
document.querySelector('#export-json').addEventListener('click', () => { download('projeto-geradorone.json', JSON.stringify({ version: 3, kind: currentKind, createdAt: new Date().toISOString(), settings: dataObject(formFor(currentKind)), prompt: currentPrompt }, null, 2), 'application/json'); notify(t('js.exportar.json_preparado')); });
previewButton.addEventListener('click', async () => {
  status.textContent = t('js.exportar.preparando_previa');
  try {
    if (!currentPreviewHtml) {
      const response = await apiFetch('api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: projectTitle(), prompt: currentPrompt, language: window.idioma.idioma }) });
      if (!response.ok) throw new Error('Falha na prévia');
      currentPreviewHtml = (await response.json()).html;
    }
    previewFrame.srcdoc = currentPreviewHtml;
    previewFrame.hidden = false;
    output.hidden = true;
    setResultTab('preview');
    status.textContent = t('js.exportar.previa_exibida');
  } catch { status.textContent = t('js.exportar.erro_previa'); }
});
showPromptButton.addEventListener('click', () => { previewFrame.hidden = true; output.hidden = false; setResultTab('prompt'); status.textContent = t('js.exportar.exibindo_prompt'); });
document.querySelector('#export-pdf').addEventListener('click', async () => {
  status.textContent = t('js.exportar.gerando_pdf');
  try {
    const response = await apiFetch('api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: projectTitle(), prompt: currentPrompt, language: window.idioma.idioma }) });
    if (!response.ok) throw new Error('Falha no PDF');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement('a'), { href: url, download: 'prompt-geradorone.pdf' });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = t('js.exportar.pdf_baixado');
    notify(t('js.exportar.pdf_gerado'));
  } catch { status.textContent = t('js.exportar.erro_pdf'); }
});

// O primeiro item é a chave do rótulo (js.melhorar.<chave>) e da instrução (prompt.melhorar.<chave>); o segundo é o texto em português, só de referência.
const improveAdjustments = [
  ['detalhado', 'Aumente o detalhamento: mais subtópicos, exemplos e rótulos explicativos, sem ultrapassar o número de páginas.'],
  ['simples', 'Simplifique: menos blocos, frases mais curtas e vocabulário mais acessível.'],
  ['visual', 'Torne mais visual: mais esquemas, ícones e ilustrações, e menos texto.'],
  ['didatico', 'Reforce o caráter didático: progressão passo a passo, analogias do cotidiano e destaque para os conceitos-chave.'],
  ['profissional', 'Dê um tom mais técnico e profissional, com termos da área e aplicação prática.'],
  ['criancas', 'Adapte para crianças: linguagem simples, exemplos do dia a dia e visual acolhedor.'],
  ['dificuldade_mais', 'Aumente a dificuldade: conceitos mais aprofundados e exemplos mais desafiadores.'],
  ['dificuldade_menos', 'Diminua a dificuldade: foque no essencial, com exemplos básicos.'],
];
const improveStatus = document.querySelector('#improve-status');
const improveInstruction = document.querySelector('#improve-instruction');
const improveOptions = document.querySelector('#improve-options');
function renderImproveChips() {
  const marcados = new Set([...improveOptions.querySelectorAll('input:checked')].map(box => box.value));
  improveOptions.innerHTML = improveAdjustments.map(([chave], index) => `<label class="improve-chip"><input type="checkbox" name="adjust" value="${index}"${marcados.has(String(index)) ? ' checked' : ''}><span>${t(`js.melhorar.${chave}`)}</span></label>`).join('');
}
renderImproveChips();

function closeImprove() {
  improveBox.hidden = true;
  improveOpen.setAttribute('aria-expanded', 'false');
}

improveOpen.addEventListener('click', () => {
  if (!improveBox.hidden) { closeImprove(); return; }
  improveBox.querySelectorAll('[name=adjust]').forEach(box => { box.checked = false; });
  improveInstruction.value = '';
  improveStatus.textContent = '';
  document.querySelector('#improve-mode').textContent = aiAvailable
    ? t('js.melhorar.modo_ia')
    : t('js.melhorar.modo_sem_ia');
  improveBox.hidden = false;
  improveOpen.setAttribute('aria-expanded', 'true');
});
document.querySelector('#improve-cancel').addEventListener('click', closeImprove);

function replacePrompt(prompt) {
  currentPrompt = prompt;
  currentPreviewHtml = '';
  output.textContent = prompt;
  output.hidden = false;
  previewFrame.hidden = true;
  setResultTab('prompt');
}

document.querySelector('#improve-apply').addEventListener('click', async () => {
  const adjustments = [...improveBox.querySelectorAll('[name=adjust]:checked')].map(box => t(`prompt.melhorar.${improveAdjustments[Number(box.value)][0]}`));
  const instruction = improveInstruction.value.trim();
  if (!adjustments.length && !instruction) { improveStatus.textContent = t('js.melhorar.escolha'); return; }
  if (!aiAvailable) {
    replacePrompt(geradores().anexarAjustes(currentPrompt, [...adjustments, instruction]));
    closeImprove();
    notify(t('js.melhorar.anexados'));
    return;
  }
  const apply = document.querySelector('#improve-apply');
  apply.disabled = true;
  improveStatus.textContent = t('js.melhorar.reescrevendo');
  try {
    const response = await apiFetch('api/improve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: currentPrompt, adjustments, instruction, language: window.idioma.idioma }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('js.melhorar.erro'));
    replacePrompt(result.prompt);
    closeImprove();
    status.textContent = t('js.melhorar.melhorado_com', { model: result.model });
    notify(t('js.melhorar.melhorado_ia'));
  } catch (error) {
    improveStatus.textContent = error.message;
  } finally {
    apply.disabled = false;
  }
});

async function saveProject(asNew) {
  if (!currentPrompt) { notify(t('js.projetos.gere_antes')); return; }
  const name = projectName.value.trim();
  if (!name) { toggleRename(true); notify(t('js.projetos.de_nome')); return; }
  try {
    const response = await apiFetch('api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: asNew ? undefined : currentProjectId || undefined, name, kind: currentKind, settings: dataObject(formFor(currentKind)), prompt: currentPrompt }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('js.projetos.erro_salvar'));
    currentProjectId = result.project.id;
    currentProjectKind = result.project.kind;
    syncSaveButtons();
    savedAtLabel = clockLabel(result.project.updatedAt);
    updateCrumbs();
    status.textContent = t('js.projetos.salvo_em', { nome: result.project.name });
    notify(t('js.projetos.salvo_msg'));
  } catch (error) {
    status.textContent = error.message;
    notify(error.message);
  }
}
saveProjectButton.addEventListener('click', () => saveProject(false));
saveProjectNewButton.addEventListener('click', () => saveProject(true));
document.querySelector('#rename-project').addEventListener('click', () => toggleRename(document.querySelector('#crumb-rename-box').hidden));
projectName.addEventListener('input', updateCrumbs);
projectName.addEventListener('keydown', event => {
  if (event.key === 'Escape') { toggleRename(false); return; }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  toggleRename(false);
  if (currentProjectId && currentPrompt) saveProject(false);
});
document.querySelector('#crumb-projects').addEventListener('click', () => showView('projetos'));

const projectsList = document.querySelector('#projects-list');

async function loadProjects() {
  projectsList.innerHTML = `<p class="field-status">${escapeUi(t('js.projetos.carregando'))}</p>`;
  try {
    const response = await apiFetch('api/projects');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t('js.projetos.erro_carregar'));
    if (!data.projects.length) {
      projectsList.innerHTML = `<div class="projects-empty"><strong>${escapeUi(t('js.projetos.vazio_titulo'))}</strong><span>${escapeUi(t('js.projetos.vazio_texto'))}</span></div>`;
      return;
    }
    projectsList.innerHTML = data.projects.map(project => `<article class="project-card"><div class="project-main"><strong>${escapeUi(project.name)}</strong><small><span class="project-kind">${escapeUi(KIND_LABEL[project.kind] || project.kind)}</span>${escapeUi(new Date(project.updatedAt).toLocaleString(window.idioma.idioma, { dateStyle: 'short', timeStyle: 'short' }))}</small></div><div class="project-buttons">${actionButton('edit', 'edit', t('js.projetos.abrir'), `data-open-project="${escapeUi(project.id)}"`)}${actionButton('del', 'trash', t('js.projetos.excluir'), `data-delete-project="${escapeUi(project.id)}"`)}</div></article>`).join('');
  } catch (error) {
    projectsList.innerHTML = `<p class="field-status unavailable">${escapeUi(error.message)}</p>`;
  }
}

async function openProject(id) {
  try {
    const response = await apiFetch(`api/projects/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t('js.projetos.erro_abrir'));
    const { project } = data;
    const target = formFor(project.kind);
    target.reset();
    applyData(target, project.settings);
    currentProjectId = project.id;
    currentProjectKind = project.kind;
    showView(project.kind);
    showResult({ prompt: project.prompt, kind: project.kind, badge: RESULT_BADGE[project.kind] || t('js.projetos.projeto') });
    setProjectName(project.name);
    savedAtLabel = project.updatedAt ? clockLabel(project.updatedAt) : '';
    updateCrumbs();
    status.textContent = t('js.projetos.aberto_nome', { nome: project.name });
    notify(t('js.projetos.aberto'));
  } catch (error) {
    notify(error.message);
  }
}

async function deleteProject(id) {
  try {
    const response = await apiFetch(`api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t('js.projetos.erro_excluir'));
    if (currentProjectId === id) { currentProjectId = null; syncSaveButtons(); }
    notify(t('js.projetos.excluido'));
    loadProjects();
  } catch (error) {
    notify(error.message);
  }
}

projectsList.addEventListener('click', event => {
  const open = event.target.closest('[data-open-project]');
  if (open) { openProject(open.dataset.openProject); return; }
  const del = event.target.closest('[data-delete-project]');
  if (!del) return;
  if (del.classList.contains('armed')) { deleteProject(del.dataset.deleteProject); return; }
  armAction(del, t('js.projetos.confirmar_exclusao_curto'), t('js.projetos.excluir'), 3500);
});

const projectFile = document.querySelector('#project-file');
document.querySelector('#import-project').addEventListener('click', () => projectFile.click());
projectFile.addEventListener('change', async () => {
  const file = projectFile.files[0];
  if (!file) return;
  if (file.size > 1_000_000) { notify(t('js.msg.arquivo_grande')); return; }
  try {
    const project = JSON.parse(await file.text());
    if (!project.settings || typeof project.settings !== 'object') throw new Error('Formato inválido');
    const kind = project.kind === 'capa' ? 'capa' : 'apostila';
    const target = formFor(kind);
    target.reset();
    applyData(target, project.settings);
    currentProjectId = null;
    showView(kind);
    if (typeof project.prompt === 'string' && project.prompt) {
      showResult({ prompt: project.prompt, kind, badge: RESULT_BADGE[kind] });
      setProjectName('');
    }
    notify(t('js.projetos.importado'));
  } catch { notify(t('js.projetos.importado_invalido')); }
  projectFile.value = '';
});

const aiConfigForm = document.querySelector('#ai-config-form');
const aiConfigCurrent = document.querySelector('#ai-config-current');
const aiConfigStatus = document.querySelector('#ai-config-status');
const aiConfigProvider = document.querySelector('#ai-config-provider');
const aiConfigModelInput = document.querySelector('#ai-config-model');
const aiConfigImageModelInput = document.querySelector('#ai-config-image-model');

const AI_PROVIDER_LABEL = { openai: 'OpenAI', gemini: 'Gemini', anthropic: 'Anthropic' };
const aiNoImagesMessage = () => t('js.ia.sem_imagens_anthropic');

function applyAiConfigDatalists() {
  const provider = aiConfigProvider.value;
  aiConfigModelInput.setAttribute('list', `ai-text-models-${provider}`);
  aiConfigImageModelInput.setAttribute('list', `ai-image-models-${provider}`);
  // A Anthropic não gera imagens: o campo de modelo de imagem fica desligado.
  const noImages = provider === 'anthropic';
  aiConfigImageModelInput.disabled = noImages;
  aiConfigImageModelInput.placeholder = noImages ? t('js.ia.nao_se_aplica') : 'gpt-image-2.5-flare';
  if (noImages) aiConfigImageModelInput.value = '';
  aiConfigModelInput.placeholder = provider === 'anthropic' ? 'claude-sonnet-5-5' : provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-6-astra';
}
aiConfigProvider.addEventListener('change', () => {
  applyAiConfigDatalists();
  aiConfigModelInput.value = '';
  aiConfigImageModelInput.value = '';
});
applyAiConfigDatalists();

let aiConfigData = null;
function renderAiConfigCurrent() {
  if (!aiConfigData) return;
  const data = aiConfigData;
  const providerLabel = AI_PROVIDER_LABEL[data.provider] || 'OpenAI';
  aiConfigCurrent.textContent = data.hasApiKey ? t('js.ia.chave_salva', { dica: data.keyHint, provider: providerLabel, model: data.model }) : t('js.ia.sem_chave_salva', { provider: providerLabel });
  aiConfigCurrent.className = `field-status ${data.hasApiKey ? 'available' : 'unavailable'}`;
}

async function loadAiConfig() {
  aiConfigCurrent.textContent = t('js.ia.verificando');
  aiConfigCurrent.className = 'field-status';
  try {
    const response = await apiFetch('api/ai/config');
    const data = await response.json();
    aiConfigData = data;
    renderAiConfigCurrent();
    aiConfigProvider.value = data.provider || 'openai';
    applyAiConfigDatalists();
    aiConfigModelInput.value = data.model || '';
    aiConfigImageModelInput.value = data.imageModel || '';
    document.querySelector('#ai-config-key').value = '';
  } catch {
    aiConfigCurrent.textContent = t('js.ia.erro_config');
    aiConfigCurrent.className = 'field-status unavailable';
  }
}

aiConfigForm.addEventListener('submit', async event => {
  event.preventDefault();
  aiConfigStatus.textContent = t('js.msg.salvando');
  try {
    const body = {
      provider: aiConfigProvider.value,
      apiKey: document.querySelector('#ai-config-key').value,
      model: aiConfigModelInput.value,
      imageModel: aiConfigImageModelInput.value
    };
    const response = await apiFetch('api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('js.msg.erro_salvar'));
    aiConfigStatus.textContent = t('js.ia.config_salva');
    notify(t('js.ia.config_salva_toast'));
    await loadAiConfig();
    checkAiAvailability();
  } catch (error) {
    aiConfigStatus.textContent = error.message;
  }
});

document.querySelector('#ai-config-clear').addEventListener('click', async () => {
  aiConfigStatus.textContent = t('js.ia.removendo');
  try {
    const response = await apiFetch('api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearApiKey: true }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || t('js.ia.erro_remover'));
    aiConfigStatus.textContent = t('js.ia.chave_removida');
    notify(t('js.ia.chave_removida_toast'));
    await loadAiConfig();
    checkAiAvailability();
  } catch (error) {
    aiConfigStatus.textContent = error.message;
  }
});

const shell = document.querySelector('#shell');
const scrim = document.querySelector('#scrim');
const menuToggle = document.querySelector('#menu-toggle');
const menuOpenMobile = document.querySelector('#menu-open-mobile');

function updateMenuLabel() {
  menuToggle.setAttribute('aria-label', t(shell.classList.contains('collapsed') ? 'js.menu.expandir' : 'js.menu.recolher'));
}

function setCollapsed(collapsed) {
  shell.classList.toggle('collapsed', collapsed);
  menuToggle.setAttribute('aria-expanded', String(!collapsed));
  updateMenuLabel();
  try { localStorage.setItem('g1-sidebar', collapsed ? 'collapsed' : 'open'); } catch {}
}

function setMobileMenu(open) {
  shell.classList.toggle('menu-open', open);
  scrim.hidden = !open;
  menuOpenMobile.setAttribute('aria-expanded', String(open));
}

function toggleMenu() {
  if (isMobileLayout()) setMobileMenu(!shell.classList.contains('menu-open'));
  else setCollapsed(!shell.classList.contains('collapsed'));
}

menuToggle.addEventListener('click', toggleMenu);
menuOpenMobile.addEventListener('click', toggleMenu);
scrim.addEventListener('click', () => setMobileMenu(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && shell.classList.contains('menu-open')) setMobileMenu(false);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') { event.preventDefault(); toggleMenu(); }
});
matchMedia('(max-width: 900px)').addEventListener('change', () => setMobileMenu(false));

const VIEWS = ['inicio', 'apostila', 'capa', 'projetos', 'ia', 'conta', 'tema', 'config', 'faq', 'suporte', 'sobre'];
// Configurações reúne um assunto por aba; o endereço #usuarios, #smtp ou #backup abre a aba certa.
const CONFIG_TABS = ['usuarios', 'smtp', 'backup'];
let configTab = 'usuarios';

let supportOrigin = '';
function showView(name) {
  const previous = workspace.dataset.view;
  if (CONFIG_TABS.includes(name)) { configTab = name; name = 'config'; }
  if (!VIEWS.includes(name) || (name === 'config' && currentUser?.role !== 'admin')) name = 'inicio';
  workspace.dataset.view = name;
  document.querySelector('#crumbs').hidden = name !== 'apostila' && name !== 'capa';
  document.querySelector('#mobile-steps').hidden = name !== 'apostila' && name !== 'capa';
  setStep('dados');
  document.querySelectorAll('.view').forEach(view => { view.hidden = view.dataset.view !== name; });
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    if (item.dataset.view === name) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  if (name === 'projetos') loadProjects();
  if (name === 'ia') loadAiConfig();
  if (name === 'conta') fillAccount();
  if (name === 'tema') renderThemeView();
  if (name === 'config') showConfigTab(configTab);
  if (name === 'faq') renderFaq();
  if (name === 'suporte') { if (previous && previous !== 'suporte') supportOrigin = previous; fillSupport(); }
  setMobileMenu(false);
  try { history.replaceState(null, '', `#${name === 'config' ? configTab : name}`); } catch {}
  window.scrollTo({ top: 0 });
}

function showConfigTab(tab) {
  if (!CONFIG_TABS.includes(tab)) tab = 'usuarios';
  configTab = tab;
  document.querySelectorAll('.config-tab').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
  document.querySelectorAll('.config-pane').forEach(pane => { pane.hidden = pane.dataset.pane !== tab; });
  if (tab === 'usuarios') loadUsers();
  if (tab === 'smtp') loadSmtp();
  if (tab === 'backup') loadBackup();
  try { history.replaceState(null, '', `#${tab}`); } catch {}
}

document.querySelector('.config-tabs').addEventListener('click', event => {
  const button = event.target.closest('.config-tab');
  if (button) showConfigTab(button.dataset.tab);
});
document.querySelector('.config-tabs').addEventListener('keydown', event => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const step = event.key === 'ArrowRight' ? 1 : -1;
  const next = CONFIG_TABS[(CONFIG_TABS.indexOf(configTab) + step + CONFIG_TABS.length) % CONFIG_TABS.length];
  showConfigTab(next);
  document.querySelector(`#config-tab-${next}`).focus();
});

// Aba Backup: só mostra o que o servidor registrou (banco e cópias do PBS). Nada aqui executa ou restaura cópia.
const backupBox = document.querySelector('#backup-box');
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  const casas = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toLocaleString(window.idioma.idioma, { minimumFractionDigits: casas, maximumFractionDigits: casas })} ${units[unit]}`;
}
// O nome do arquivo guarda a data como AAAAMMDD-HHMM.
function formatStamp(stamp) {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(stamp || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])).toLocaleString(window.idioma.idioma, { dateStyle: 'short', timeStyle: 'short' }) : '-';
}
function formatWhen(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(window.idioma.idioma, { dateStyle: 'short', timeStyle: 'short' });
}
function backupEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function backupStat(label, value, note, late) {
  const box = backupEl('div', `backup-stat${late ? ' atrasada' : ''}`);
  box.append(backupEl('span', '', label), backupEl('strong', '', value), backupEl('small', '', note));
  return box;
}
function backupTable(headers, rows) {
  const wrap = backupEl('div', 'table-wrap');
  const table = backupEl('table', 'data-table');
  const head = document.createElement('tr');
  headers.forEach(text => head.append(backupEl('th', '', text)));
  const thead = document.createElement('thead');
  thead.append(head);
  const tbody = document.createElement('tbody');
  rows.forEach(cells => { const tr = document.createElement('tr'); cells.forEach(text => tr.append(backupEl('td', '', text))); tbody.append(tr); });
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}
let backupData = null;
function renderBackup(data) {
  backupData = data;
  backupBox.replaceChildren();
  if (!data.disponivel) {
    const alert = backupEl('div', `backup-alert${data.gravidade === 'erro' ? ' erro' : ''}`);
    alert.append(backupEl('strong', '', t(data.gravidade === 'erro' ? 'js.backup.sem_registro' : 'js.backup.sem_registro_aqui')), backupEl('span', '', data.aviso));
    backupBox.append(alert);
    return;
  }
  const alert = backupEl('div', `backup-alert${data.protegido ? '' : ' erro'}`);
  if (data.protegido) alert.append(backupEl('strong', '', t('js.backup.protegido')), backupEl('span', '', t('js.backup.protegido_texto')));
  else {
    const reasons = [];
    if (data.semBanco) reasons.push(t('js.backup.motivo_banco_sem_execucao'));
    else if (data.banco.atrasada) reasons.push(data.banco.ok ? t('js.backup.motivo_banco_antiga', { horas: data.banco.horasMax }) : t('js.backup.motivo_banco_falhou', { detalhe: data.banco.mensagem || t('js.backup.sem_detalhe') }));
    if (data.semPbs) reasons.push(t('js.backup.motivo_pbs_sem_execucao'));
    else if (data.pbs.atrasada) reasons.push(data.pbs.ok ? t('js.backup.motivo_pbs_antiga', { horas: data.pbs.horasMax }) : t('js.backup.motivo_pbs_falhou', { detalhe: data.pbs.mensagem || t('js.backup.sem_detalhe') }));
    alert.append(backupEl('strong', '', t('js.backup.atencao')), backupEl('span', '', `${reasons.join('; ')}.`));
  }
  backupBox.append(alert);

  const grid = backupEl('div', 'backup-grid');
  if (data.banco) {
    const last = data.banco.copias?.[0];
    grid.append(backupStat(t('js.backup.banco_dados'), formatWhen(data.banco.fim), `${data.banco.agenda || ''} · ${t('js.backup.guarda_dias', { dias: data.banco.retencaoDias })}${last ? ` · ${formatBytes(last.bytes)}` : ''}`, data.banco.atrasada));
    grid.append(backupStat(t('js.backup.copias_banco'), String(data.banco.copias?.length ?? 0), t('js.backup.arquivos_sql'), false));
  }
  if (data.pbs) {
    const last = data.pbs.snapshots?.[0];
    grid.append(backupStat(t('js.backup.copia_externa'), formatWhen(data.pbs.fim), `${data.pbs.agenda || ''} · ${t('js.backup.guarda_dias', { dias: data.pbs.retencaoDias })}${last ? ` · ${formatBytes(last.bytes)}` : ''}`, data.pbs.atrasada));
    grid.append(backupStat(t('js.backup.copias_pbs'), String(data.pbs.snapshots?.length ?? 0), t('js.backup.servidor_inteiro'), false));
  }
  backupBox.append(grid);

  if (data.banco?.copias?.length) {
    const section = backupEl('div', 'backup-section');
    section.append(backupEl('h3', '', t('js.backup.copias_banco')), backupTable([t('js.backup.quando'), t('js.backup.arquivo'), t('js.backup.tamanho')], data.banco.copias.map(copy => [formatStamp(copy.data), copy.nome, formatBytes(copy.bytes)])));
    backupBox.append(section);
  }
  if (data.pbs?.snapshots?.length) {
    const section = backupEl('div', 'backup-section');
    section.append(backupEl('h3', '', t('js.backup.copias_externas')), backupTable([t('js.backup.quando'), t('js.backup.tamanho')], data.pbs.snapshots.map(copy => [formatWhen(copy.data), formatBytes(copy.bytes)])));
    backupBox.append(section);
  }
  if (data.falhasRecentes?.length) {
    const section = backupEl('div', 'backup-section');
    section.append(backupEl('h3', '', t('js.backup.falhas_recentes')), backupEl('pre', 'backup-log', data.falhasRecentes.join('\n')));
    backupBox.append(section);
  }
  const logSection = backupEl('div', 'backup-section');
  logSection.append(backupEl('h3', '', t('js.backup.log')), backupEl('pre', 'backup-log', data.log?.length ? data.log.join('\n') : t('js.backup.nenhuma_execucao')));
  backupBox.append(logSection);
  const note = backupEl('p', 'pane-intro', t('js.backup.restaurar'));
  backupBox.append(note);
}
async function loadBackup() {
  backupBox.replaceChildren(backupEl('p', 'field-status', t('js.backup.verificando')));
  try {
    renderBackup(await smtpRequest('GET', 'api/settings/backup'));
  } catch (error) {
    backupBox.replaceChildren(backupEl('p', 'field-status unavailable', error.message));
  }
}


document.querySelector('[data-view-link]').addEventListener('click', event => {
  event.preventDefault();
  showView(event.currentTarget.dataset.viewLink);
});

// Início: demonstração dos 5 itens da Apostila, um de cada vez. O temporizador fica sempre ligado e confere as condições
// na hora de avançar, então nenhum estado preso (toque, foco do teclado) impede a animação de voltar. Pausa só com o mouse
// em cima (aparelho com mouse), no botão "Pausar animação" e com "reduzir movimento". Clicar num item reinicia a contagem.
function iniciarDemoInicio() {
  const demo = document.querySelector('.inicio-demo');
  if (!demo) return;
  const itens = [...demo.querySelectorAll('.inicio-item')];
  const quadros = [...demo.querySelectorAll('.inicio-quadro')];
  const foco = demo.querySelector('.inicio-foco');
  const pausa = demo.querySelector('.inicio-pausa');
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)');
  const comMouse = matchMedia('(hover: hover)');
  const quadroDoPasso = n => (n <= 3 ? 'dados' : n === 4 ? 'tipo' : 'gerar');
  let atual = 0;
  let timer = null;
  let pausado = reduzido.matches;

  function mostrar(indice) {
    atual = (indice + itens.length) % itens.length;
    const item = itens[atual];
    const passo = Number(item.dataset.passo);
    demo.dataset.passo = String(passo);
    itens.forEach(outro => outro.setAttribute('aria-pressed', String(outro === item)));
    quadros.forEach(quadro => { quadro.hidden = quadro.dataset.quadro !== quadroDoPasso(passo); });
    const caixa = item.dataset.foco ? item.dataset.foco.split(',').map(Number) : null;
    foco.hidden = !caixa;
    if (caixa) {
      ['x', 'y', 'w', 'h'].forEach((nome, i) => foco.style.setProperty(`--foco-${nome}`, `${caixa[i]}%`));
    }
  }
  function ligar() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (pausado || document.hidden || workspace.dataset.view !== 'inicio') return;
      if (comMouse.matches && demo.matches(':hover')) return;
      mostrar(atual + 1);
    }, 4000);
  }
  function atualizarBotao() {
    pausa.textContent = t(pausado ? 'js.inicio.continuar_animacao' : 'js.inicio.pausar_animacao');
    pausa.setAttribute('aria-pressed', String(pausado));
  }
  window.idioma.aoMudar(() => atualizarBotao());

  demo.classList.add('anim');
  pausa.hidden = false;
  atualizarBotao();
  itens.forEach((item, i) => item.addEventListener('click', () => { mostrar(i); ligar(); }));
  pausa.addEventListener('click', () => { pausado = !pausado; atualizarBotao(); ligar(); });
  reduzido.addEventListener('change', event => { pausado = event.matches; atualizarBotao(); });
  mostrar(0);
  ligar();
}
iniciarDemoInicio();

// Início: copia o prompt de exemplo inteiro (não só o trecho visível na caixa com rolagem).
document.querySelector('#copiar-exemplo')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  const texto = document.querySelector('#prompt-exemplo-texto').textContent;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(texto);
    else {
      const area = Object.assign(document.createElement('textarea'), { value: texto });
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    const rotulo = button.querySelector('.copy-label');
    const rotuloOriginal = rotulo.textContent;
    button.classList.add('copied');
    rotulo.textContent = t('js.msg.copiado');
    notify(t('js.msg.prompt_copiado'));
    setTimeout(() => { button.classList.remove('copied'); rotulo.textContent = rotuloOriginal; }, 2200);
  } catch { notify(t('js.msg.erro_copiar')); }
});

document.querySelector('#pane').addEventListener('click', event => {
  const go = event.target.closest('a[data-go-view]');
  if (!go) return;
  event.preventDefault();
  showView(go.dataset.goView);
});

document.querySelector('#sidebar').addEventListener('click', event => {
  const link = event.target.closest('a[data-view]');
  if (!link) return;
  event.preventDefault();
  showView(link.dataset.view);
});

try { if (localStorage.getItem('g1-sidebar') === 'collapsed') setCollapsed(true); } catch {}

function setError(form, message, ok = false) {
  const slot = form.querySelector('.auth-error');
  if (!slot) return;
  slot.textContent = message || '';
  slot.classList.toggle('ok', ok);
}

function showAuth(panel = 'login', message = '') {
  appShell.hidden = true;
  authScreen.hidden = false;
  authScreen.querySelectorAll('.auth-panel').forEach(form => {
    form.hidden = form.dataset.panel !== panel;
    setError(form, form.dataset.panel === panel ? message : '');
  });
  authScreen.querySelector(`[data-panel="${panel}"] input`)?.focus();
}

function updateUserBox() {
  if (!currentUser) return;
  document.querySelector('#user-email').textContent = t(currentUser.role === 'admin' ? 'js.perfil.admin' : 'js.perfil.usuario');
}

function startApp(user) {
  const switched = currentUser && currentUser.id !== user.id;
  currentUser = user;
  if (switched) { location.hash = ''; location.reload(); return; }
  window.idioma.usarIdiomaDaConta(user.language);
  if (!user.termsCurrent) { showAuth('terms'); return; }
  if (user.theme === 'sistema') { themeFollowsSystem = true; setTheme(systemTheme()); } else if (themeNames[user.theme]) { themeFollowsSystem = false; setTheme(user.theme); } else { themeFollowsSystem = false; setTheme('papel', { persist: false }); }
  document.querySelector('#user-name').textContent = user.name;
  updateUserBox();
  document.querySelectorAll('[data-admin]').forEach(item => { item.hidden = user.role !== 'admin'; });
  authScreen.hidden = true;
  appShell.hidden = false;
  updateCompletion();
  updateGenerationMode();
  checkAiAvailability();
  if (!user.phone) {
    showView('conta');
    notify(t('js.conta.informe_telefone'));
    return;
  }
  showView(location.hash.slice(1));
}

authScreen.addEventListener('click', event => {
  const go = event.target.closest('[data-auth-go]');
  if (go) showAuth(go.dataset.authGo);
});

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const email = formEl.email.value.trim();
  if (!email || !formEl.password.value) { setError(formEl, t('js.auth.informe_email_senha')); return; }
  setError(formEl, '');
  const submit = formEl.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const result = await postJson('api/auth/login', { email, password: formEl.password.value });
    if (!result.ok) { setError(formEl, result.data.error || t('js.auth.erro_entrar')); return; }
    formEl.password.value = '';
    if (result.data.user.mustChangePassword) {
      currentUser = result.data.user;
      document.querySelector('#first-form').current.value = '';
      showAuth('first');
    } else {
      startApp(result.data.user);
    }
  } finally {
    submit.disabled = false;
  }
});

// Cada título de tela ganha o mesmo ícone do botão correspondente no menu (copiado do próprio menu, para os dois nunca divergirem).
document.querySelectorAll('.view[data-view] .view-head h1').forEach(title => {
  const name = title.closest('.view').dataset.view;
  const icon = document.querySelector(`.nav-item[data-view="${name}"] svg`);
  if (!icon) return;
  const copy = icon.cloneNode(true);
  copy.removeAttribute('width');
  copy.removeAttribute('height');
  copy.classList.add('title-icon');
  title.prepend(copy);
});

// ---------- Fale com o suporte ----------
const supportForm = document.querySelector('#support-form');
const supportStatus = document.querySelector('#support-status');
const supportMessage = document.querySelector('#support-message');
const supportList = document.querySelector('#support-files');
const SUPPORT_MAX_FILES = 5;
const SUPPORT_MAX_FILE = 5 * 1024 * 1024;
const SUPPORT_MAX_TOTAL = 8 * 1024 * 1024;
const SUPPORT_EXT = /\.(png|jpe?g|gif|webp|pdf|txt|log|csv)$/i;
let supportFiles = [];

const supportSize = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString(window.idioma.idioma, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
function supportNotice(text, ok = false) { supportStatus.textContent = text; supportStatus.className = `status${text ? (ok ? ' ok' : ' error') : ''}`; }

function fillSupport() {
  if (currentUser) {
    if (!supportForm.nome.value) supportForm.nome.value = currentUser.name || '';
    if (!supportForm.email.value) supportForm.email.value = currentUser.email || '';
  }
}

function supportRender() {
  supportList.replaceChildren(...supportFiles.map((file, index) => {
    const item = document.createElement('li');
    const thumb = document.createElement('span');
    thumb.className = 'support-thumb';
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => { const image = document.createElement('img'); image.alt = ''; image.src = reader.result; thumb.replaceChildren(image); };
      reader.readAsDataURL(file);
    } else {
      thumb.textContent = (file.name.split('.').pop() || '').slice(0, 4).toUpperCase();
    }
    const label = document.createElement('span');
    label.className = 'support-file-name';
    const name = document.createElement('strong');
    name.textContent = file.name;
    const size = document.createElement('small');
    size.textContent = supportSize(file.size);
    label.append(name, size);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'support-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', t('js.suporte.remover', { nome: file.name }));
    remove.addEventListener('click', () => { supportFiles.splice(index, 1); supportRender(); });
    item.append(thumb, label, remove);
    return item;
  }));
}

function supportAdd(files) {
  const problems = [];
  [...files].forEach(original => {
    let file = original;
    const name = file.name || `imagem-colada.${(file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
    if (!file.name) file = new File([file], name, { type: file.type });
    const total = supportFiles.reduce((sum, item) => sum + item.size, 0);
    if (!SUPPORT_EXT.test(name)) problems.push(t('js.suporte.tipo_nao_aceito', { nome: name }));
    else if (supportFiles.length >= SUPPORT_MAX_FILES) problems.push(t('js.suporte.max_anexos'));
    else if (file.size > SUPPORT_MAX_FILE) problems.push(t('js.suporte.passa_5mb', { nome: name }));
    else if (total + file.size > SUPPORT_MAX_TOTAL) problems.push(t('js.suporte.passa_8mb'));
    else supportFiles.push(file);
  });
  supportRender();
  supportNotice(problems.join(' · '));
}

const supportFileInput = document.querySelector('#support-file');
const supportZone = document.querySelector('#support-zone');
document.querySelector('#support-attach').addEventListener('click', () => supportFileInput.click());
supportFileInput.addEventListener('change', () => { supportAdd(supportFileInput.files); supportFileInput.value = ''; });
['dragenter', 'dragover'].forEach(name => supportZone.addEventListener(name, event => { event.preventDefault(); supportZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(name => supportZone.addEventListener(name, event => { event.preventDefault(); supportZone.classList.remove('dragging'); }));
supportZone.addEventListener('drop', event => { if (event.dataTransfer?.files.length) supportAdd(event.dataTransfer.files); });
supportMessage.addEventListener('input', () => { document.querySelector('#support-count').textContent = `${supportMessage.value.length} / 2000`; });
supportMessage.addEventListener('paste', event => {
  const images = [...(event.clipboardData?.files || [])].filter(file => file.type.startsWith('image/'));
  if (images.length) { event.preventDefault(); supportAdd(images); }
});

function supportBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('leitura'));
    reader.readAsDataURL(file);
  });
}

supportForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#support-send');
  const body = { tipo: supportForm.tipo.value, mensagem: supportMessage.value.trim(), nome: supportForm.nome.value.trim(), email: supportForm.email.value.trim(), site: supportForm.site.value, origem: supportOrigin };
  if (body.mensagem.length < 5 && !supportFiles.length) { supportNotice(t('js.suporte.escreva')); supportMessage.focus(); return; }
  if (!/^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/.test(body.email)) { supportNotice(t('js.suporte.email_valido')); supportForm.email.focus(); return; }
  const rotuloOriginal = button.textContent;
  button.disabled = true;
  button.textContent = t('js.suporte.enviando');
  supportNotice('');
  try {
    body.anexos = await Promise.all(supportFiles.map(async file => ({ nome: file.name, dados: await supportBase64(file) })));
    const response = await apiFetch('api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || t('js.suporte.erro_enviar'));
    supportNotice(t(result.enviado ? 'js.suporte.enviada' : 'js.suporte.registrada', { protocolo: result.protocolo }), true);
    supportMessage.value = '';
    supportFiles = [];
    supportRender();
    document.querySelector('#support-count').textContent = '0 / 2000';
  } catch (error) {
    supportNotice(error.message);
  } finally {
    button.disabled = false;
    button.textContent = rotuloOriginal;
  }
});

// FAQ: lista filtrável com resposta que abre na própria linha. O texto vem de faq-data.js e é montado por nós de texto (sem innerHTML).
const faqSearch = document.querySelector('#faq-search');
const faqBadges = document.querySelector('#faq-badges');
let faqCategoria = '';
let faqCategorias = [];
const faqList = document.querySelector('#faq-list');
const faqCount = document.querySelector('#faq-count');
let faqOpen = -1;
let faqReady = false;

const faqNormalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function faqEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Troca endereços https:// por links; o resto continua texto puro.
function faqInline(parent, text) {
  text.split(/(https:\/\/[^\s)]*[^\s).,;:])/).forEach(part => {
    if (/^https:\/\/[^\s)]*[^\s).,;:]$/.test(part)) {
      const link = faqEl('a', '', part);
      link.href = part;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      parent.append(link);
    } else if (part) {
      parent.append(part);
    }
  });
}

function faqAnswer(text) {
  const box = faqEl('div', 'faq-answer');
  text.split('\n\n').forEach(block => {
    const lines = block.split('\n');
    if (lines.every(line => line.startsWith('- '))) {
      const list = faqEl('ul');
      lines.forEach(line => { const item = faqEl('li'); faqInline(item, line.slice(2)); list.append(item); });
      box.append(list);
    } else if (lines.every(line => /^\d+\. /.test(line))) {
      const list = faqEl('ol');
      lines.forEach(line => { const item = faqEl('li'); faqInline(item, line.replace(/^\d+\. /, '')); list.append(item); });
      box.append(list);
    } else {
      const paragraph = faqEl('p');
      faqInline(paragraph, lines.join(' '));
      box.append(paragraph);
    }
  });
  return box;
}

// Categorias da FAQ como badges coloridos: a cor sai da posição da categoria na lista (as cores são tokens do tema, em design.css).
function faqCor(categoria) { return String(Math.max(0, faqCategorias.indexOf(categoria)) % 8); }
function faqBadge(categoria, { botao = false, inline = false, total = null } = {}) {
  const badge = faqEl(botao ? 'button' : 'span', inline ? 'faq-badge faq-cat-inline' : 'faq-badge');
  if (botao) { badge.type = 'button'; badge.dataset.faqCat = categoria; badge.setAttribute('aria-pressed', String(categoria === faqCategoria)); badge.title = t('js.faq.mostrar_so', { categoria }); }
  badge.dataset.cor = categoria === null ? 'todas' : faqCor(categoria);
  badge.append(faqEl('span', 'faq-badge-nome', categoria));
  if (total !== null) badge.append(faqEl('span', 'faq-badge-n', String(total)));
  return badge;
}
function renderFaqBadges() {
  const todas = faqEl('button', 'faq-badge');
  todas.type = 'button'; todas.dataset.faqCat = ''; todas.dataset.cor = 'todas';
  todas.setAttribute('aria-pressed', String(faqCategoria === ''));
  todas.append(faqEl('span', 'faq-badge-nome', t('js.faq.todas')), faqEl('span', 'faq-badge-n', String(FAQ_ITEMS.length)));
  const lista = faqCategorias.map(nome => faqBadge(nome, { botao: true, total: FAQ_ITEMS.filter(item => item.categoria === nome).length }));
  faqBadges.replaceChildren(todas, ...lista);
}
// Clicar no badge filtra; clicar de novo no badge ativo volta para Todas.
function faqFiltrarPor(categoria) {
  faqCategoria = faqCategoria === categoria ? '' : categoria;
  faqOpen = -1;
  renderFaq();
}

function renderFaq() {
  if (typeof FAQ_ITEMS === 'undefined') { faqList.replaceChildren(); faqCount.textContent = t('js.faq.erro_carregar'); return; }
  if (!faqReady) {
    faqCategorias = [...new Set(FAQ_ITEMS.map(item => item.categoria))];
    faqReady = true;
  }
  renderFaqBadges();
  const term = faqNormalize(faqSearch.value.trim());
  const category = faqCategoria;
  const shown = FAQ_ITEMS.map((item, index) => ({ item, index })).filter(({ item }) => (!category || item.categoria === category) && (!term || faqNormalize(`${item.pergunta} ${item.resposta} ${item.categoria}`).includes(term)));
  faqCount.textContent = t('js.faq.contagem', { n: shown.length, total: FAQ_ITEMS.length });
  const head = faqEl('thead');
  const headRow = faqEl('tr');
  [t('js.faq.categoria'), t('js.faq.pergunta')].forEach(label => headRow.append(faqEl('th', '', label)));
  head.append(headRow);
  const body = faqEl('tbody');
  if (!shown.length) {
    const row = faqEl('tr');
    const cell = faqEl('td', 'table-empty', t('js.faq.vazio'));
    cell.colSpan = 2;
    row.append(cell);
    body.append(row);
  }
  shown.forEach(({ item, index }) => {
    const open = index === faqOpen;
    const row = faqEl('tr', open ? 'faq-row open' : 'faq-row');
    const catCell = faqEl('td', 'faq-cat');
    catCell.append(faqBadge(item.categoria, { botao: true }));
    row.append(catCell);
    const cell = faqEl('td', 'faq-q');
    const button = faqEl('button', 'faq-toggle');
    button.type = 'button';
    button.dataset.faq = String(index);
    button.setAttribute('aria-expanded', String(open));
    button.append(faqBadge(item.categoria, { inline: true }), faqEl('span', 'faq-q-text', item.pergunta));
    cell.append(button);
    row.append(cell);
    body.append(row);
    if (open) {
      const answerRow = faqEl('tr', 'faq-answer-row');
      const answerCell = faqEl('td');
      answerCell.colSpan = 2;
      answerCell.append(faqAnswer(item.resposta));
      answerRow.append(answerCell);
      body.append(answerRow);
    }
  });
  faqList.replaceChildren(head, body);
}

faqSearch.addEventListener('input', () => { faqOpen = -1; renderFaq(); });
faqBadges.addEventListener('click', event => {
  const badge = event.target.closest('[data-faq-cat]');
  if (badge) faqFiltrarPor(badge.dataset.faqCat);
});
faqList.addEventListener('click', event => {
  const badge = event.target.closest('[data-faq-cat]');
  if (badge) { faqFiltrarPor(badge.dataset.faqCat); return; }
  const button = event.target.closest('[data-faq]');
  if (!button) return;
  const index = Number(button.dataset.faq);
  faqOpen = faqOpen === index ? -1 : index;
  renderFaq();
  faqList.querySelector(`[data-faq="${index}"]`)?.focus();
});

const smtpForm = document.querySelector('#smtp-form');
const smtpCurrent = document.querySelector('#smtp-current');
const smtpStatus = document.querySelector('#smtp-status');
const SMTP_SOURCES = { get painel() { return t('js.smtp.fonte_painel'); }, get env() { return t('js.smtp.fonte_env'); }, get nenhum() { return t('js.smtp.fonte_nenhum'); } };

async function smtpRequest(method, url, body) {
  const response = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || t('js.smtp.erro_concluir'));
  return data;
}

function fillSmtp(data) {
  smtpForm.host.value = data.host || '';
  smtpForm.port.value = data.port || 587;
  smtpForm.mode.value = data.secure ? 'tls' : (data.requireTLS || data.source === 'nenhum') ? 'starttls' : 'none';
  smtpForm.user.value = data.user || '';
  smtpForm.pass.value = '';
  smtpForm.from.value = data.from || '';
  smtpForm.appUrl.value = data.appUrl || '';
  smtpForm.contactEmail.value = data.contactEmail || '';
  smtpCurrent.textContent = data.enabled ? t('js.smtp.ativo', { fonte: SMTP_SOURCES[data.source] }) + (data.hasPass ? t('js.smtp.senha_salva') : '') : t('js.smtp.desligado');
  smtpCurrent.className = `field-status ${data.enabled ? 'available' : 'unavailable'}`;
}

async function loadSmtp() {
  smtpStatus.textContent = '';
  try {
    fillSmtp(await smtpRequest('GET', 'api/settings/smtp'));
  } catch (error) {
    smtpCurrent.textContent = error.message;
    smtpCurrent.className = 'field-status unavailable';
  }
}

smtpForm.addEventListener('submit', async event => {
  event.preventDefault();
  smtpStatus.textContent = t('js.msg.salvando');
  try {
    const mode = smtpForm.mode.value;
    const data = await smtpRequest('PUT', 'api/settings/smtp', { host: smtpForm.host.value, port: smtpForm.port.value, secure: mode === 'tls', requireTLS: mode === 'starttls', user: smtpForm.user.value, pass: smtpForm.pass.value, from: smtpForm.from.value, appUrl: smtpForm.appUrl.value, contactEmail: smtpForm.contactEmail.value });
    fillSmtp(data);
    smtpStatus.textContent = t('js.smtp.salva_aplicada');
    notify(t('js.smtp.salva_toast'));
    loadAuthConfig();
  } catch (error) {
    smtpStatus.textContent = error.message;
  }
});

document.querySelector('#smtp-reset').addEventListener('click', async () => {
  smtpStatus.textContent = t('js.smtp.voltando');
  try {
    fillSmtp(await smtpRequest('DELETE', 'api/settings/smtp'));
    smtpStatus.textContent = t('js.smtp.painel_removido');
    loadAuthConfig();
  } catch (error) {
    smtpStatus.textContent = error.message;
  }
});

document.querySelector('#smtp-test-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const status = document.querySelector('#smtp-test-status');
  status.textContent = t('js.suporte.enviando');
  try {
    const data = await smtpRequest('POST', 'api/settings/smtp/test', { to: formEl.to.value.trim() });
    status.textContent = data.message;
  } catch (error) {
    status.textContent = error.message;
  }
});

let signupEmail = '';
document.querySelector('#signup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const name = formEl.name.value.trim();
  const email = formEl.email.value.trim();
  if (!name || !email) { setError(formEl, t('js.auth.informe_nome_email')); return; }
  if (formEl.password.value.length < 8) { setError(formEl, t('js.auth.senha_min')); return; }
  if (formEl.password.value !== formEl.repeat.value) { setError(formEl, t('js.auth.senhas_nao_conferem')); return; }
  if (!formEl.terms.checked) { setError(formEl, t('js.auth.aceite_termos_criar')); return; }
  setError(formEl, '');
  const submit = formEl.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const result = await postJson('api/auth/signup', { name, email, password: formEl.password.value, acceptTerms: true });
    if (!result.ok) { setError(formEl, result.data.error || t('js.auth.erro_codigo_enviar')); return; }
    signupEmail = email;
    formEl.password.value = '';
    formEl.repeat.value = '';
    document.querySelector('#signup-confirm-info').textContent = t('js.auth.cadastro_confirmar_info', { mensagem: result.data.message });
    showAuth('signup-confirm');
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#signup-confirm-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const result = await postJson('api/auth/signup/confirm', { email: signupEmail, code: formEl.code.value.trim() });
  if (!result.ok) { setError(formEl, result.data.error || t('js.auth.codigo_invalido')); return; }
  formEl.code.value = '';
  startApp(result.data.user);
});

let resetEmail = '';
document.querySelector('#forgot-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const email = formEl.email.value.trim();
  if (!email || formEl.password.value.length < 8) { setError(formEl, t('js.auth.forgot_info')); return; }
  setError(formEl, '');
  const result = await postJson('api/auth/forgot', { email, password: formEl.password.value });
  if (!result.ok) { setError(formEl, result.data.error || t('js.auth.erro_codigo_enviar')); return; }
  resetEmail = email;
  formEl.password.value = '';
  document.querySelector('#confirm-info').textContent = t('js.auth.confirmar_info', { mensagem: result.data.message });
  showAuth('confirm');
});

document.querySelector('#confirm-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const result = await postJson('api/auth/confirm', { email: resetEmail, code: formEl.code.value.trim() });
  if (!result.ok) { setError(formEl, result.data.error || t('js.auth.codigo_invalido')); return; }
  formEl.code.value = '';
  showAuth('login');
  setError(authScreen.querySelector('#login-form'), result.data.message, true);
});

document.querySelector('#first-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (formEl.password.value.length < 8) { setError(formEl, t('js.auth.nova_senha_min')); return; }
  if (formEl.password.value !== formEl.repeat.value) { setError(formEl, t('js.auth.senhas_nao_conferem')); return; }
  const result = await postJson('api/auth/change-password', { current: formEl.current.value, password: formEl.password.value });
  if (!result.ok) { setError(formEl, result.data.error || t('js.auth.erro_trocar_senha')); return; }
  formEl.reset();
  startApp(result.data.user);
});

async function logout() {
  await apiFetch('api/auth/logout', { method: 'POST' });
  location.hash = '';
  location.reload();
}
document.querySelector('#logout-button').addEventListener('click', logout);
document.querySelector('#first-logout').addEventListener('click', logout);
document.querySelector('#terms-logout').addEventListener('click', logout);

// Texto do bloco "Termos e privacidade" em Minha conta: versão e data do aceite.
function fillLegalAccount() {
  const info = document.querySelector('#legal-account-info');
  if (!info || !currentUser) return;
  if (!currentUser.termsAcceptedAt) { info.textContent = t('js.conta.docs_regem'); return; }
  const at = new Date(currentUser.termsAcceptedAt);
  const day = at.toLocaleDateString(window.idioma.idioma);
  const hour = at.toLocaleTimeString(window.idioma.idioma, { hour: '2-digit', minute: '2-digit' });
  const [ano, mes, dia] = currentUser.termsVersion.split('-').map(Number);
  info.textContent = t('js.conta.aceitou_versao', { versao: new Date(ano, mes - 1, dia).toLocaleDateString(window.idioma.idioma), dia: day, hora: hour });
}

document.querySelector('#terms-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (!formEl.terms.checked) { setError(formEl, t('js.auth.marque_termos')); return; }
  setError(formEl, '');
  const submit = formEl.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const result = await postJson('api/auth/accept-terms', { accept: true });
    if (!result.ok) { setError(formEl, result.data.error || t('js.auth.erro_aceite')); return; }
    formEl.terms.checked = false;
    startApp(result.data.user);
  } finally {
    submit.disabled = false;
  }
});

function fillAccount() {
  if (!currentUser) return;
  const profile = document.querySelector('#profile-form');
  profile.name.value = currentUser.name;
  profile.phone.value = formatPhone(currentUser.phone);
  profile.email.value = currentUser.email;
  fillLegalAccount();
  document.querySelector('#account-summary').textContent = `${t(currentUser.role === 'admin' ? 'js.perfil.admin' : 'js.perfil.usuario')} · ${currentUser.email}`;
  document.querySelector('#profile-status').textContent = '';
  document.querySelector('#password-status').textContent = '';
}

document.querySelector('#profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.querySelector('#profile-status');
  const formEl = event.currentTarget;
  const faltavaTelefone = !currentUser.phone;
  const result = await postJson('api/auth/profile', { name: formEl.name.value, phone: formEl.phone.value });
  if (!result.ok) { status.textContent = result.data.error || t('js.msg.erro_salvar'); return; }
  currentUser = result.data.user;
  formEl.phone.value = formatPhone(currentUser.phone);
  document.querySelector('#user-name').textContent = currentUser.name;
  status.textContent = t('js.conta.perfil_salvo');
  notify(t('js.conta.perfil_salvo_toast'));
  // Cadastro novo: o app leva a "Minha conta" para pedir o telefone; ao salvar o telefone, segue para o Início.
  if (faltavaTelefone && currentUser.phone) showView('inicio');
});

document.querySelector('#password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const status = document.querySelector('#password-status');
  if (formEl.password.value.length < 8) { status.textContent = t('js.auth.nova_senha_min'); return; }
  if (formEl.password.value !== formEl.repeat.value) { status.textContent = t('js.auth.senhas_nao_conferem'); return; }
  const result = await postJson('api/auth/change-password', { current: formEl.current.value, password: formEl.password.value });
  if (!result.ok) { status.textContent = result.data.error || t('js.auth.erro_trocar_senha'); return; }
  formEl.reset();
  currentUser = result.data.user;
  status.textContent = t('js.conta.senha_alterada');
  notify(t('js.conta.senha_alterada_toast'));
});

// Exportar meus dados: baixa um JSON com a conta, as preferências de IA e todos os projetos.
document.querySelector('#export-account-button').addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = document.querySelector('#export-account-status');
  button.disabled = true;
  status.textContent = t('js.conta.preparando_arquivo');
  try {
    const response = await apiFetch('api/auth/export');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || t('js.conta.erro_exportar'));
    download(`geradorone-conta-${data.exportedAt.slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
    const total = data.projects.length;
    status.textContent = t.plural('js.conta.arquivo_baixado', total);
    notify(t('js.conta.dados_exportados'));
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

// Excluir a própria conta: pede a senha e exige um segundo clique em "Confirmar exclusão" (o botão volta ao normal em 5 s).
const GONE_KEY = 'g1-conta-excluida';
let deleteArmTimer;
document.querySelector('#delete-account-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const button = document.querySelector('#delete-account-button');
  const status = document.querySelector('#delete-account-status');
  if (!formEl.password.value) { status.textContent = t('js.conta.informe_senha_atual'); return; }
  if (!button.classList.contains('armed')) {
    button.dataset.rotulo = button.textContent;
    button.classList.add('armed');
    button.textContent = t('js.projetos.confirmar_exclusao');
    status.textContent = t('js.conta.clique_de_novo');
    clearTimeout(deleteArmTimer);
    deleteArmTimer = setTimeout(() => { button.classList.remove('armed'); button.textContent = button.dataset.rotulo; status.textContent = ''; }, 5000);
    return;
  }
  clearTimeout(deleteArmTimer);
  button.disabled = true;
  status.textContent = t('js.conta.excluindo');
  const result = await postJson('api/auth/delete-account', { password: formEl.password.value });
  button.disabled = false;
  button.classList.remove('armed');
  button.textContent = button.dataset.rotulo || button.textContent;
  if (!result.ok) { status.textContent = result.data.error || t('js.conta.erro_excluir'); return; }
  formEl.reset();
  try { sessionStorage.setItem(GONE_KEY, '1'); } catch {}
  location.hash = '';
  location.reload();
});

const usersList = document.querySelector('#users-list');
const tempBox = document.querySelector('#temp-password-box');

function showTempPassword(name, password) {
  tempBox.hidden = false;
  tempBox.innerHTML = `<p><strong>${escapeUi(t('js.usuarios.senha_temporaria_de', { nome: name }))}</strong></p><code>${escapeUi(password)}</code><p>${escapeUi(t('js.usuarios.senha_temporaria_aviso'))}</p><button type="button" class="ghost" id="copy-temp">${escapeUi(t('js.usuarios.copiar_senha'))}</button>`;
  tempBox.querySelector('#copy-temp').addEventListener('click', async event => {
    const button = event.currentTarget;
    try { await navigator.clipboard.writeText(password); button.textContent = t('js.usuarios.copiada'); } catch { button.textContent = t('js.usuarios.copiar_manual'); }
  });
}

let usersData = [];
const usersSearch = document.querySelector('#users-search');
const usersRoleFilter = document.querySelector('#users-role-filter');
const usersCount = document.querySelector('#users-count');
const userHead = () => `<thead><tr><th scope="col">${escapeUi(t('js.usuarios.col_nome'))}</th><th scope="col">${escapeUi(t('js.usuarios.col_telefone'))}</th><th scope="col">${escapeUi(t('js.usuarios.col_email'))}</th><th scope="col">${escapeUi(t('js.usuarios.col_perfil'))}</th><th scope="col">${escapeUi(t('js.usuarios.col_situacao'))}</th><th scope="col"><span class="sr-only">${escapeUi(t('js.usuarios.col_acoes'))}</span></th></tr></thead>`;

function userGroupHtml(user) {
  const id = escapeUi(user.id);
  const self = currentUser && user.id === currentUser.id;
  const notes = escapeUi([t(user.hasApiKey ? 'js.usuarios.com_chave' : 'js.usuarios.sem_chave'), user.mustChangePassword ? t('js.usuarios.troca_pendente') : '', self ? t('js.usuarios.voce') : ''].filter(Boolean).join(' · '));
  return `<tbody class="user-group" data-user-id="${id}">
    <tr class="user-row">
      <th scope="row"><span class="user-name">${escapeUi(user.name)}</span><small>${notes}</small></th>
      <td class="num">${escapeUi(formatPhone(user.phone)) || '—'}</td>
      <td class="wrap">${escapeUi(user.email)}</td>
      <td>${t(user.role === 'admin' ? 'js.perfil.admin' : 'js.perfil.usuario')}</td>
      <td>${t(user.active ? 'js.usuarios.ativo' : 'js.usuarios.inativo')}</td>
      <td class="row-actions">
        ${actionButton('edit', 'edit', t('js.usuarios.editar'), `data-edit-user="${id}"`)}
        ${actionButton('neutral', 'key', t('js.usuarios.redefinir'), `data-reset-user="${id}"`)}
        ${actionButton('del', 'trash', t('js.usuarios.excluir'), `data-delete-user="${id}"`)}
      </td>
    </tr>
    <tr class="user-edit-row" hidden>
      <td colspan="6">
        <form class="user-card" data-user-id="${id}" novalidate>
          <div class="user-fields">
            <label>${t('js.usuarios.col_nome')}<input name="name" value="${escapeUi(user.name)}" maxlength="120" required></label>
            <label>${t('js.usuarios.col_telefone')}<input name="phone" type="tel" value="${escapeUi(formatPhone(user.phone))}" placeholder="(35) 99999-8888" maxlength="22"></label>
            <label>${t('js.usuarios.col_email')}<input name="email" type="email" value="${escapeUi(user.email)}" required></label>
            <label>${t('js.usuarios.col_perfil')}<select name="role"><option value="user"${user.role === 'user' ? ' selected' : ''}>${t('js.perfil.usuario')}</option><option value="admin"${user.role === 'admin' ? ' selected' : ''}>${t('js.perfil.admin')}</option></select></label>
            <label class="user-active"><input name="active" type="checkbox"${user.active ? ' checked' : ''}>${t('js.usuarios.ativo')}</label>
          </div>
          <div class="project-buttons"><button type="submit">${t('js.usuarios.salvar')}</button><button type="button" data-cancel-edit>${t('js.usuarios.cancelar')}</button></div>
          <p class="status" role="status"></p>
        </form>
      </td>
    </tr>
  </tbody>`;
}

function renderUsers() {
  const term = usersSearch.value.trim().toLowerCase();
  const role = usersRoleFilter.value;
  const shown = usersData.filter(user => (!role || user.role === role) && (!term || `${user.name} ${user.email}`.toLowerCase().includes(term)));
  usersList.innerHTML = shown.length
    ? userHead() + shown.map(userGroupHtml).join('')
    : `${userHead()}<tbody><tr><td colspan="6" class="table-empty">${escapeUi(t('js.usuarios.nenhum'))}</td></tr></tbody>`;
  usersCount.textContent = t('js.usuarios.contagem', { n: shown.length, total: usersData.length });
}
usersSearch.addEventListener('input', renderUsers);
usersRoleFilter.addEventListener('change', renderUsers);

async function loadUsers() {
  usersList.innerHTML = `<tbody><tr><td class="table-empty">${escapeUi(t('js.usuarios.carregando'))}</td></tr></tbody>`;
  try {
    const response = await apiFetch('api/users');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t('js.usuarios.erro_carregar'));
    usersData = data.users;
    renderUsers();
  } catch (error) {
    usersList.innerHTML = `<tbody><tr><td class="table-empty field-status unavailable">${escapeUi(error.message)}</td></tr></tbody>`;
  }
}

document.querySelector('#generate-password').addEventListener('click', () => {
  document.querySelector('#user-create-form').password.value = randomPassword();
});

document.querySelector('#user-create-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const status = document.querySelector('#user-create-status');
  const body = { name: formEl.name.value, phone: formEl.phone.value, email: formEl.email.value, role: formEl.role.value, password: formEl.password.value };
  if (!body.name.trim() || !body.phone.trim() || !body.email.trim() || !body.password) { status.textContent = t('js.usuarios.preencha'); return; }
  if (body.password.length < 8) { status.textContent = t('js.auth.senha_min'); return; }
  const result = await postJson('api/users', body);
  if (!result.ok) { status.textContent = result.data.error || t('js.usuarios.erro_criar'); return; }
  status.textContent = t('js.usuarios.criado', { email: result.data.user.email });
  tempBox.hidden = true;
  formEl.reset();
  loadUsers();
});

usersList.addEventListener('submit', async event => {
  event.preventDefault();
  const card = event.target.closest('.user-card');
  if (!card) return;
  const status = card.querySelector('.status');
  const response = await apiFetch(`api/users/${encodeURIComponent(card.dataset.userId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: card.name.value, phone: card.phone.value, email: card.email.value, role: card.role.value, active: card.active.checked }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { status.textContent = data.error || t('js.msg.erro_salvar'); return; }
  status.textContent = t('js.usuarios.salvo');
  notify(t('js.usuarios.atualizado'));
  loadUsers();
});

usersList.addEventListener('click', async event => {
  const reset = event.target.closest('[data-reset-user]');
  const del = event.target.closest('[data-delete-user]');
  const edit = event.target.closest('[data-edit-user]');
  const group = event.target.closest('.user-group');
  if (edit || event.target.closest('[data-cancel-edit]')) {
    const row = group.querySelector('.user-edit-row');
    row.hidden = !edit;
    if (edit) row.querySelector('input[name="name"]').focus();
    return;
  }
  if (reset) {
    const result = await postJson(`api/users/${encodeURIComponent(reset.dataset.resetUser)}/reset-password`, {});
    if (!result.ok) { notify(result.data.error || t('js.usuarios.erro_redefinir')); return; }
    showTempPassword(result.data.user.name, result.data.temporaryPassword);
    notify(t('js.usuarios.senha_redefinida'));
    loadUsers();
    return;
  }
  if (!del) return;
  if (!del.classList.contains('armed')) {
    armAction(del, t('js.usuarios.confirmar_apaga'), t('js.usuarios.excluir'), 4000);
    return;
  }
  const response = await apiFetch(`api/users/${encodeURIComponent(del.dataset.deleteUser)}`, { method: 'DELETE' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { notify(data.error || t('js.usuarios.erro_excluir')); return; }
  notify(t.plural('js.usuarios.excluido', data.removedProjects));
  loadUsers();
});

// Olho para mostrar e ocultar a senha em todo campo de senha. O do login já vem pronto no HTML; os demais ganham o botão aqui.
const EYE_PATHS = {
  open: ['<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/>', '<circle cx="12" cy="12" r="3"/>'],
  closed: ['<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.64 0 8.62 2.92 9.94 7a10.8 10.8 0 0 1-1.6 3.04"/>', '<path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/>', '<path d="M17.48 17.5A10.75 10.75 0 0 1 12 19c-4.64 0-8.62-2.92-9.94-7a10.8 10.8 0 0 1 3.4-4.84"/>', '<path d="m2 2 20 20"/>']
};
const eyeSvg = (kind, hidden) => `<svg class="icon-svg eye-${kind}" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${hidden ? ' hidden' : ''}>${EYE_PATHS[kind].join('')}</svg>`;
const eyeLabel = (field, show) => t(`js.olho.${show ? 'ocultar' : 'mostrar'}_${field.name === 'apiKey' ? 'chave' : 'senha'}`);

function addEyeToggle(field) {
  if (field.closest('.input-join')) return;
  const wrap = document.createElement('span');
  wrap.className = 'input-join';
  field.replaceWith(wrap);
  const button = document.createElement('button');
  button.className = 'eye-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', eyeLabel(field, false));
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = eyeSvg('open', false) + eyeSvg('closed', true);
  wrap.append(field, button);
}
document.querySelectorAll('input[type="password"]').forEach(addEyeToggle);

document.addEventListener('click', event => {
  const button = event.target.closest('.eye-toggle');
  if (!button) return;
  const field = button.parentElement.querySelector('input');
  if (!field) return;
  const show = field.type === 'password';
  field.type = show ? 'text' : 'password';
  // SVG não tem a propriedade hidden: troca pelo atributo.
  button.querySelector('.eye-open').toggleAttribute('hidden', show);
  button.querySelector('.eye-closed').toggleAttribute('hidden', !show);
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', eyeLabel(field, show));
});

async function loadAuthConfig() {
  try {
    const config = await (await fetch('api/auth/config')).json();
    authScreen.querySelector('[data-auth-go="forgot"]').hidden = !config.emailReset;
    authScreen.querySelector('#signup-on').hidden = !config.signup;
    authScreen.querySelector('#signup-off').hidden = Boolean(config.signup);
  } catch {}
}

async function bootstrapAuth() {
  await loadAuthConfig();
  try {
    const response = await fetch('api/auth/me', { credentials: 'same-origin' });
    if (response.ok) {
      const { user } = await response.json();
      if (user.mustChangePassword) { currentUser = user; showAuth('first'); } else startApp(user);
      return;
    }
  } catch {}
  showAuth('login');
  try {
    if (sessionStorage.getItem(GONE_KEY)) {
      sessionStorage.removeItem(GONE_KEY);
      setError(authScreen.querySelector('#login-form'), t('js.auth.conta_excluida'), true);
    }
  } catch {}
}
// ---------- Idioma: refaz o que o JS desenhou e guarda a escolha na conta ----------
function updateCopyLabels() {
  const copy = document.querySelector('#copy');
  if (copy && !copy.classList.contains('copied')) copy.querySelector('.copy-label').textContent = t('js.msg.copiar');
  const exemplo = document.querySelector('#copiar-exemplo');
  if (exemplo && !exemplo.classList.contains('copied')) exemplo.querySelector('.copy-label').textContent = t('js.inicio.copiar_prompt');
}
window.idioma.aoMudar(codigo => {
  renderStyleOptions(document.querySelector('#style-options'), 'style');
  renderStyleOptions(document.querySelector('#capa-style-options'), 'capa-style');
  renderResources();
  renderImproveChips();
  document.querySelector('#theme-name').textContent = themeLabel(document.documentElement.dataset.theme);
  renderThemeView();
  updateGenerationMode();
  updateCrumbs();
  syncSaveButtons();
  updateMenuLabel();
  updateUserBox();
  if (currentUser) checkAiAvailability();
  if (currentFiles.length) renderGeneratedFiles();
  if (bncc.data && !bnccEls.panel.hidden) {
    const [faixa, grupo] = [bnccEls.recorte.value, bnccEls.grupo.value];
    bnccRefreshOptions();
    bnccEls.recorte.value = faixa;
    bnccEls.grupo.value = grupo;
    bnccRender();
    bnccUpdateCount();
  } else if (bncc.data) bnccUpdateCount();
  applyAiConfigDatalists();
  renderAiConfigCurrent();
  if (backupData) renderBackup(backupData);
  if (usersData.length) renderUsers();
  // A FAQ guarda os nomes das categorias na primeira abertura: zera para os badges e a lista trocarem de idioma.
  faqReady = false;
  faqCategoria = '';
  faqOpen = -1;
  if (workspace.dataset.view === 'faq') renderFaq();
  if (workspace.dataset.view === 'projetos') loadProjects();
  if (workspace.dataset.view === 'conta') fillLegalAccount();
  updateCopyLabels();
  if (!outBadge.hidden && badgeTime) outBadge.textContent = `${badgeAi ? t('js.gerar.badge_ia') : RESULT_BADGE[currentKind]} · ${badgeTime.toLocaleTimeString(window.idioma.idioma, { hour: '2-digit', minute: '2-digit' })}`;
  if (currentUser) document.querySelector('#account-summary').textContent = `${t(currentUser.role === 'admin' ? 'js.perfil.admin' : 'js.perfil.usuario')} · ${currentUser.email}`;
  bnccCheckTyped();
  // O seletor também dispara este ouvinte quando a conta define o idioma; só grava se for diferente do que a conta já tem.
  if (currentUser && codigo !== (currentUser.language || '')) {
    postJson('api/auth/language', { language: codigo }).then(result => { if (result.ok && result.data.user) currentUser = result.data.user; });
  }
});
updateMenuLabel();
updateCopyLabels();
syncSaveButtons();
bnccUpdateCount();
bootstrapAuth();
