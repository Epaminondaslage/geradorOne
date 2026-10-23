const styles = [
  ['Cartoon','Traço amigável e expressivo'],['Hand-drawn','Aparência desenhada à mão'],['Doodle','Rabiscos leves e criativos'],['Cartoon Educacional','Cartoon com foco pedagógico'],['Scientific Illustration','Precisão científica'],['Futuristic Digital','Visual digital moderno'],['Infográfico Moderno','Blocos, ícones e dados'],['Minimalista','Poucos elementos, muito ar'],['3D Educacional','Volumes suaves em 3D'],['Realista','Aparência fotográfica'],['Livro Didático','Padrão editorial clássico'],['Colorido Infantil','Cores vivas para crianças']
];
const resources = [
  ['mapasMentais','◉','Mapas mentais','Síntese radial e conexões'],['diagramas','◇','Diagramas','Processos, relações e fluxos'],['ilustracoes','✦','Ilustrações','Conceitos, cenas e objetos'],['infograficos','▦','Infográficos','Dados e explicações visuais'],['graficos','⌁','Gráficos','Somente com dados verificáveis'],['quadros','▤','Quadros comparativos','Contrastes e classificações'],['linhas','↝','Linhas do tempo','Eventos em sequência'],['icones','⬡','Ícones e sinalização','Navegação e destaques']
];

const THEME_LIST = [
  { id: 'papel', nome: 'Papel', desc: 'Claro e quente, o padrão. Folha de caderno e caneta verde de correção.' },
  { id: 'grafite', nome: 'Grafite', desc: 'Escuro neutro para trabalhar à noite. Acento laranja de marca-texto.' },
  { id: 'lousa', nome: 'Lousa', desc: 'Verde-escuro de sala de aula, texto cor de giz e acento de giz amarelo.' },
  { id: 'azul-tinta', nome: 'Azul-tinta', desc: 'Claro e frio, com o azul da caneta esferográfica nas ações.' },
  { id: 'sepia', nome: 'Sépia', desc: 'Papel envelhecido e tinta marrom, para sessões longas de leitura.' },
  { id: 'alto-contraste', nome: 'Alto contraste', desc: 'Preto e branco puros, amarelo nas ações. Para baixa visão e projetor.' }
];
const themeNames = Object.fromEntries(THEME_LIST.map(theme => [theme.id, theme.nome]));
const systemTheme = () => (matchMedia('(prefers-color-scheme: dark)').matches ? 'grafite' : 'papel');
function storedTheme() {
  let saved = null;
  try { saved = localStorage.getItem('apostila-theme'); } catch { /* armazenamento bloqueado */ }
  if (saved === 'light') saved = 'papel';
  if (saved === 'dark') saved = 'grafite';
  return themeNames[saved] ? saved : null;
}
// Sem escolha explícita, o tema acompanha o sistema (claro vira Papel, escuro vira Grafite).
let themeFollowsSystem = !storedTheme();

function setTheme(theme, { persist = true } = {}) {
  document.documentElement.dataset.theme = theme;
  try { if (persist) localStorage.setItem('apostila-theme', theme); else localStorage.removeItem('apostila-theme'); } catch { /* armazenamento bloqueado */ }
  document.querySelector('#theme-name').textContent = themeNames[theme];
  renderThemeView();
}

function saveThemeToAccount(theme) {
  if (!currentUser) return;
  postJson('api/auth/theme', { theme }).then(result => {
    if (result.ok) currentUser = result.data.user;
    else notify('Tema aplicado neste navegador, mas não foi salvo na conta.');
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
    setTheme(systemTheme(), { persist: false });
    saveThemeToAccount('');
  } else {
    const current = document.documentElement.dataset.theme;
    setTheme(current);
    saveThemeToAccount(current);
  }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeFollowsSystem) setTheme(systemTheme(), { persist: false }); });

function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map(part => parseInt(part, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const formatRatio = ratio => `${ratio.toFixed(1).replace('.', ',')}:1`;

function renderThemeView() {
  const gallery = document.querySelector('#theme-gallery');
  if (!gallery) return;
  const current = document.documentElement.dataset.theme;
  document.querySelector('#theme-follow').checked = themeFollowsSystem;
  gallery.innerHTML = THEME_LIST.map(theme => `<button type="button" role="radio" class="theme-card" aria-checked="${theme.id === current}" data-theme-pick="${theme.id}">
    <span class="theme-mini" data-theme-scope="${theme.id}" aria-hidden="true"><span class="mini-rail"><i></i><i></i><i></i><i></i></span><span class="mini-sheet"><b>Apostila</b><i class="mini-field"></i><i class="mini-field"></i><em>Gerar prompt</em></span></span>
    <span class="theme-meta"><span class="theme-line"><strong>${theme.nome}</strong><span class="theme-mark">${theme.id === current ? 'Em uso' : ''}</span></span><span class="field-help">${theme.desc}</span></span>
  </button>`).join('');
  document.querySelector('#theme-tokens-name').textContent = themeNames[current];
  const css = getComputedStyle(document.documentElement);
  const token = name => css.getPropertyValue(name).trim();
  const [paper, accent] = [token('--paper'), token('--accent')];
  const rows = [
    ['--bg', 'fundo'], ['--paper', 'folha e campos'],
    ['--ink', formatRatio(contrastRatio(token('--ink'), paper))],
    ['--muted', formatRatio(contrastRatio(token('--muted'), paper))],
    ['--line', 'divisória'],
    ['--field', formatRatio(contrastRatio(token('--field'), paper))],
    ['--accent', formatRatio(contrastRatio(accent, paper))],
    ['--accent-ink', `${formatRatio(contrastRatio(token('--accent-ink'), accent))} no acento`],
    ['--danger', formatRatio(contrastRatio(token('--danger'), paper))]
  ];
  document.querySelector('#theme-tokens-body').innerHTML = rows.map(([name, note]) => `<tr><td><span class="token-name"><span class="token-chip tok${name.slice(1)}" aria-hidden="true"></span><strong>${name}</strong></span></td><td class="num">${token(name).toUpperCase()}</td><td class="num num-col">${note}</td></tr>`).join('');
}
document.querySelector('#theme-gallery').addEventListener('click', event => {
  const card = event.target.closest('[data-theme-pick]');
  if (card) chooseTheme(card.dataset.themePick);
});
document.querySelector('#theme-follow').addEventListener('change', event => followSystemTheme(event.target.checked));
setTheme(storedTheme() || systemTheme(), { persist: !themeFollowsSystem });

function renderStyleOptions(container, prefix) {
  styles.forEach(([name, description], index) => container.insertAdjacentHTML('beforeend', `<div class="option"><input type="radio" name="estiloVisual" id="${prefix}-${index}" value="${name}" ${name === 'Livro Didático' ? 'checked' : ''}><label for="${prefix}-${index}"><span class="style-sample">${styleArt(index, prefix)}</span><strong>${name}</strong><small>${description}</small></label></div>`));
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
resources.forEach(([name, icon, title, description]) => resourceContainer.insertAdjacentHTML('beforeend', `<div class="resource"><input type="checkbox" name="${name}" id="${name}"><label for="${name}"><span class="resource-demo" aria-hidden="true">${visualSamples[name] || icon}</span><span class="resource-text"><strong>${title}</strong><small>${description}</small></span></label></div>`));

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
const AUTH_PUBLIC = ['api/auth/login', 'api/auth/forgot', 'api/auth/confirm', 'api/auth/logout', 'api/auth/config'];

async function apiFetch(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  if (response.status === 401 && !AUTH_PUBLIC.includes(url)) showAuth('login', 'Sua sessão expirou. Entre novamente.');
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
  document.querySelector('.generate-label').textContent = 'Gerar prompt completo';
}

let aiAvailable = false;

async function checkAiAvailability() {
  const label = document.querySelector('#ai-availability');
  try {
    const response = await apiFetch('api/ai/status');
    const data = await response.json();
    aiAvailable = Boolean(data.available);
    label.textContent = data.available ? `${data.provider} · texto ${data.model}` : 'Sem chave de IA: salve a sua em "Minha chave de IA" para gerar o material pronto. O prompt continua disponível.';
    label.className = `field-status ${data.available ? 'available' : 'unavailable'}`;
  } catch {
    label.textContent = 'Não foi possível verificar a IA.';
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
    }
  });
  updateCompletion();
}

function text(value, fallback = 'Não informado') { return value?.trim() || fallback; }

function generatePrompt(data) {
  const visualItems = selectedResources(data);
  const bnccInstruction = data.sugerirBncc
    ? 'Sugira habilidades da BNCC somente quando houver correspondência verificável com a etapa e o componente curricular. Informe código e descrição fiel; se não puder verificar, declare a limitação e não invente.'
    : 'Use apenas os códigos da BNCC fornecidos. Não acrescente códigos por inferência.';
  return `ATENÇÃO: siga rigorosamente todas as especificações abaixo. NÃO misture o tipo de material ou o estilo visual com outros não solicitados, NÃO altere o formato pedido e NÃO presuma informações que não foram fornecidas.\n\nATUE COMO ESPECIALISTA EM EDUCAÇÃO, DESIGN INSTRUCIONAL, DIREÇÃO DE ARTE EDITORIAL E PRODUÇÃO DE MATERIAL DIDÁTICO.\n\nTAREFA\nCrie um material do tipo "${data.tipo}" (OBRIGATORIAMENTE este tipo, não outro) sobre "${text(data.assunto)}" para a disciplina "${text(data.disciplina)}". Entregue o conteúdo em português brasileiro, sem termos em inglês ou outras variações do português.\n\n1. PERFIL PEDAGÓGICO\n- Público-alvo: ${data.publico}.\n- Objetivo de aprendizagem: ${text(data.objetivo)}.\n- Profundidade do conteúdo: ${data.profundidade}.\n- Estilo de escrita: ${data.escrita}.\n- Densidade do texto: ${data.densidade}.\n- Extensão alvo: ${data.extensao}.\n- Adapte linguagem, exemplos, vocabulário e progressão ao público.\n- Declare hipóteses quando faltarem dados indispensáveis.\n\n2. CONFIGURAÇÃO CURRICULAR E FONTES\n- Códigos BNCC informados: ${text(data.bncc, 'Nenhum')}.\n- ${bnccInstruction}\n- Material de referência obrigatório:\n${text(data.referencias, 'Nenhum material fornecido. Não invente fontes, normas, números, citações ou resultados.')}\n- Diferencie explicitamente dados ilustrativos de dados medidos, documentados ou comprovados.\n\n3. ARQUITETURA DO MATERIAL\n- Apresente título, objetivos específicos, pré-requisitos e uma rota de aprendizagem.\n- Organize seções progressivas, com explicações completas, definições, exemplos resolvidos e aplicações contextualizadas quando pertinentes.\n- Inclua sínteses parciais, questões de verificação e indicações claras de transição entre assuntos.\n- Termine com síntese geral, atividades de fixação em dificuldade progressiva e gabarito comentado.\n- Respeite a extensão alvo definida no item 1 (${data.extensao}): dimensione o número de seções, a profundidade de cada uma e a quantidade de recursos visuais para que o material completo não ultrapasse o limite superior de páginas dessa faixa.\n- Faça revisão final de consistência pedagógica, conceitual, ortográfica e visual.\n\n4. SISTEMA VISUAL\n- Estilo visual: ${data.estiloVisual}.\n- Paleta: ${data.paleta}.\n- Formato prioritário: ${data.formato}.\n- Frequência: ${data.frequencia}.\n- Profundidade visual: ${data.profundidadeVisual}.\n- Recursos obrigatórios selecionados: ${visualItems.length ? visualItems.join(', ') : 'nenhum recurso obrigatório'}.\n- Use hierarquia tipográfica clara, espaçamento confortável, alto contraste, legendas e consistência visual. Garanta legibilidade em tela e impressão e não dependa apenas de cor para transmitir significado.\n- Não use figuras infantis ou personagens caso o público não seja infantil. Se houver personagens, eles devem ser da faixa etária de ${data.publico}, condizentes com o público-alvo.\n\n5. ESPECIFICAÇÃO DOS RECURSOS VISUAIS\nPara cada recurso visual, entregue: (a) objetivo pedagógico; (b) posição sugerida; (c) conteúdo exato; (d) título e legenda; (e) descrição de produção; (f) texto alternativo acessível.\n${data.mapasMentais ? '- MAPAS MENTAIS: crie estruturas ricas, com conceito central, 4 a 7 ramos principais, sub-ramos, palavras-chave curtas, relações nomeadas e uma legenda. Evite listas lineares disfarçadas de mapa.\n' : ''}${data.diagramas ? '- DIAGRAMAS: especifique nós, setas, relações, direção de leitura e uma versão textual equivalente. Quando útil, forneça código Mermaid válido e simples.\n' : ''}${data.ilustracoes ? '- ILUSTRAÇÕES: escreva briefings objetivos com cena, elementos, composição, enquadramento, estilo, paleta, diversidade e restrições. Não presuma que a imagem foi gerada.\n' : ''}${data.infograficos ? '- INFOGRÁFICOS: combine hierarquia, blocos informativos, ícones, números e percurso de leitura. Use somente informações presentes ou verificáveis.\n' : ''}${data.graficos ? '- GRÁFICOS: escolha o tipo adequado à comparação. Não fabrique dados. Se não houver dados reais, forneça apenas o modelo, os campos necessários e marque qualquer exemplo como ILUSTRATIVO.\n' : ''}${data.quadros ? '- QUADROS COMPARATIVOS: defina critérios consistentes, cabeçalhos claros e notas para exceções.\n' : ''}${data.linhas ? '- LINHAS DO TEMPO: inclua apenas datas verificáveis e diferencie ordem didática de cronologia histórica.\n' : ''}${data.icones ? '- ÍCONES: use um conjunto consistente com rótulos, sem substituir informação essencial somente por símbolos.\n' : ''}\nOrientações adicionais: ${text(data.orientacoes)}.\n\n6. SAÍDA E MARCAÇÕES TÉCNICAS\n- Escreva o material completo, não apenas um sumário.\n- Marque cada visual com blocos [VISUAL: tipo], [OBJETIVO], [CONTEÚDO], [INSTRUÇÃO GRÁFICA], [LEGENDA] e [TEXTO ALTERNATIVO].\n- Para diagramas Mermaid, use blocos de código separados. Para gráficos, entregue uma tabela de dados antes da especificação do gráfico.\n- Não declare que imagens ou gráficos foram renderizados se apenas descreveu sua produção.\n- Use unidades do SI e notação correta quando aplicável.\n\n7. MICROTEXTOS OBRIGATÓRIOS DE ABERTURA\n- Título em caixa alta com o assunto principal.\n- Linha de apoio: disciplina | tipo de material | público-alvo.\n- De 2 a 3 frases curtas explicando o que o leitor vai entender ao final.\n- Uma lista de 4 a 6 bullets resumindo os pontos-chave, cada um com no máximo uma linha.\n\n8. CHECKLIST DE QUALIDADE (VERIFIQUE ANTES DE ENTREGAR)\n- O tipo de material e o estilo visual pedidos foram respeitados sem mistura com outros?\n- A extensão ficou dentro do limite definido no item 1?\n- Todo dado, número, citação ou fonte sem comprovação está marcado como ILUSTRATIVO ou foi omitido?\n- Cada recurso visual selecionado tem objetivo pedagógico, posição, conteúdo, legenda e texto alternativo?\n- A progressão é lógica, sem presumir conhecimento ainda não apresentado?\n- Não há atividades, exercícios ou gabarito fora do que foi solicitado?\n- Todo o texto está em português do Brasil, sem erros de revisão?\n\nPRODUZA AGORA O MATERIAL SOLICITADO.`;
}

const imagePageFormats = {
  'Somente tela': 'página vertical 4:5 (1080x1350 px), otimizada para leitura em tela',
  'Apresentação 16:9': 'página horizontal 16:9 (1920x1080 px), layout de slide',
};
const defaultPageFormat = 'página vertical A4 (210x297 mm), margens amplas, layout editorial de apostila impressa';

const typeProfiles = {
  'Apostila didática': {
    apoio: 'Apostila Didática',
    foco: 'explicar o tema de forma progressiva, do conceito básico à aplicação',
    microtextos: ['3 frases curtas de abertura explicando o que o aluno vai aprender.', 'Definição principal em uma caixa de destaque.', '5 bullets com ✓ resumindo os pontos-chave.', '2 exemplos práticos curtos iniciados por "Ex.:".'],
    restricao: 'NÃO inclua exercícios, questões nem gabarito. A página é explicativa.',
  },
  'Material de revisão': {
    apoio: 'Revisão Rápida',
    foco: 'revisar o essencial do que já foi estudado, destacando erros comuns',
    microtextos: ['1 frase de abertura dizendo o que será revisado.', '6 bullets com ✓ com os pontos essenciais.', 'Caixa "Erros comuns" com 3 itens curtos.', 'Caixa "Lembre-se" com a regra ou fórmula principal.'],
    restricao: 'NÃO introduza conteúdo novo: revise apenas o essencial do tema.',
  },
  'Caderno de atividades': {
    apoio: 'Caderno de Atividades',
    foco: 'praticar o conteúdo com atividades em dificuldade crescente',
    microtextos: ['Caixa "Relembre" com a regra ou fórmula principal, em no máximo 2 linhas.', '4 a 6 atividades numeradas, em dificuldade crescente, com linhas ou espaço em branco para a resposta.', 'Formatos variados: completar, associar, calcular, verdadeiro ou falso, interpretar figura.', 'Enunciados curtos, claros e sem ambiguidade, com valores numéricos coerentes.'],
    restricao: 'NÃO mostre as respostas na mesma página das atividades.',
  },
  'Guia de estudos': {
    apoio: 'Guia de Estudos',
    foco: 'orientar o estudo autônomo do tema em etapas',
    microtextos: ['Objetivo do estudo em 1 frase.', 'Roteiro de 4 a 5 etapas numeradas: o que estudar e em que ordem.', 'Caixa "Checklist de domínio" com 4 itens marcáveis.', '1 dica de estudo prática.'],
    restricao: 'NÃO inclua gabarito nem exercícios resolvidos extensos.',
  },
  'Resumo visual': {
    apoio: 'Guia Visual Rápido',
    foco: 'condensar o tema em uma visão geral rápida e visual',
    microtextos: ['3 frases curtas de abertura explicando o que o aluno vai entender.', '5 bullets com ✓ resumindo os pontos-chave.', '2 exemplos práticos curtos iniciados por "Ex.:".'],
    restricao: 'NÃO inclua atividades, exercícios, questões nem gabarito. A página é apenas explicativa/visual.',
  },
  'Mapa mental': {
    apoio: 'Mapa Mental',
    foco: 'mostrar as relações entre os conceitos do tema',
    microtextos: ['Nó central: o tema em caixa alta.', 'Ramos principais: os grandes conceitos do tema, em palavras-chave.', 'Sub-ramos: definições, fórmulas, exemplos e relações, em frases de no máximo 5 palavras.'],
    restricao: 'NÃO inclua atividades, exercícios, gabarito, parágrafos ou texto corrido. NÃO gere layout em colunas, de apostila ou de infográfico: apenas mapa mental.',
  },
  'Material para concurso': {
    apoio: 'Preparatório para Concursos',
    foco: 'condensar o que é mais cobrado em provas, com pegadinhas e macetes',
    microtextos: ['Caixa "Como costuma ser cobrado" com 2 a 3 itens.', '5 bullets com os pontos mais importantes.', 'Caixa "Pegadinhas" com 3 itens.', '1 macete ou mnemônico, somente se for amplamente conhecido e correto.'],
    restricao: 'NÃO invente estatísticas de bancas nem cite questões ou bancas reais.',
  },
  'Material profissional': {
    apoio: 'Material Profissional',
    foco: 'aplicar o tema à prática de trabalho, com procedimento e segurança',
    microtextos: ['Contexto de aplicação profissional em 1 a 2 frases.', 'Procedimento em 4 a 6 passos numerados.', 'Caixa "Atenção / Segurança" com os cuidados essenciais.', 'Caixa "Na prática" com 1 situação real de trabalho.'],
    restricao: 'Cite normas técnicas somente com número e conteúdo corretos; se houver dúvida, escreva "consulte a norma vigente".',
  },
  'Material preparatório': {
    apoio: 'Material Preparatório',
    foco: 'preparar para uma prova ou etapa com o que é essencial e o que praticar',
    microtextos: ['Objetivo da preparação em 1 frase.', 'Mapa dos conteúdos mais cobrados: 4 a 6 tópicos em ordem de prioridade.', 'Caixa "Como estudar" com 3 passos.', 'Caixa "Atenção" com 3 erros comuns.', 'Mini-checklist de domínio com 4 itens marcáveis.'],
    restricao: 'NÃO inclua questões resolvidas extensas nem gabarito; indique o que praticar. NÃO invente estatísticas de provas.',
  },
  'Material complementar': {
    apoio: 'Material Complementar',
    foco: 'ampliar o tema com curiosidades, aplicações e contexto além do conteúdo básico',
    microtextos: ['Pergunta instigante de abertura.', 'Texto-resumo curto (2 a 3 frases) que amplia o conteúdo.', 'Caixa "Você sabia?" com 2 curiosidades corretas e verificáveis.', 'Caixa "Na vida real" com 1 aplicação prática.', 'Caixa "Para ir além" com 2 sugestões de aprofundamento, sem citar sites, livros ou autores específicos.'],
    restricao: 'NÃO invente curiosidades, datas, fontes ou números: use só fatos amplamente conhecidos e corretos.',
  },
  'Outro': {
    apoio: 'Material Didático',
    foco: 'apresentar o tema conforme as orientações adicionais indicadas',
    microtextos: ['2 a 3 frases curtas de abertura.', '4 a 6 bullets com os pontos-chave.', '1 exemplo prático curto.'],
    restricao: 'Siga as orientações adicionais indicadas e NÃO inclua gabarito.',
  },
  'Guia do professor': {
    apoio: 'Guia do Professor',
    foco: 'apoiar o professor a conduzir a aula sobre o tema',
    microtextos: ['Objetivos da aula em 2 a 3 bullets.', 'Sequência da aula em 3 a 4 momentos numerados, com tempo sugerido.', 'Caixa "Dificuldades previstas" com 2 a 3 itens.', 'Caixa "Pergunta disparadora" com 1 pergunta para iniciar a aula.'],
    restricao: 'Linguagem dirigida ao professor, não ao aluno.',
  },
  'Sequência didática': {
    apoio: 'Sequência Didática',
    foco: 'organizar o ensino do tema em etapas encadeadas',
    microtextos: ['Objetivo geral em 1 frase.', '4 a 5 etapas numeradas, cada uma com título, ação principal e resultado esperado.', 'Seta ou linha conectando as etapas na ordem.', 'Caixa "Avaliação" com a forma de verificar a aprendizagem.'],
    restricao: 'Mantenha cada etapa curta e visual.',
  },
};

const typeLayouts = {
  'Mapa mental': [
    'A saída é EXCLUSIVAMENTE um MAPA MENTAL: não é apostila, não é infográfico em colunas, não é lista de texto.',
    'Nó central com o tema em destaque, dentro de uma forma marcante (nuvem, balão ou caixa arredondada), no centro da página.',
    '4 a 7 ramos principais saindo do centro e distribuídos por toda a altura da página; cada ramo com uma cor própria, mantendo a paleta.',
    'Cada ramo com 2 a 4 sub-ramos; cada nó com no máximo 5 palavras.',
    'Linhas curvas e orgânicas ligando os nós, mais grossas perto do centro e mais finas nas pontas.',
    'Um ícone pequeno ao lado de cada ramo principal, ligado ao conceito daquele ramo.',
    'O mapa ocupa a página inteira, equilibrado, sem áreas vazias grandes e sem nada cortado.',
  ],
  'Caderno de atividades': [
    'Layout de folha de atividades: cabeçalho com título e linha "Nome: ________  Turma: ______  Data: ___/___/___".',
    'Atividades em blocos separados, numeradas em ordem de dificuldade, cada uma com enunciado em negrito e área de resposta (linhas, quadros ou espaço para cálculo).',
    'Ilustrações e esquemas servem de base para as questões (ex.: figura para completar, esquema para analisar, tabela para preencher).',
  ],
  'Material profissional': [
    'Layout de ficha técnica de procedimento: cabeçalho com tema e área de aplicação, passos em fluxo numerado de cima para baixo.',
    'Caixa de segurança com cor de alerta e ícone de atenção, sempre visível.',
    'Imagens de equipamentos, ferramentas e situações reais de trabalho, com rótulos.',
  ],
  'Guia de estudos': [
    'Layout de trilha: etapas numeradas ligadas por um caminho ou linha, do início ao fim da página.',
    'Checklist com caixas de marcação no rodapé.',
  ],
  'Sequência didática': [
    'Layout em linha do tempo vertical ou horizontal com as etapas na ordem de execução, ligadas por setas.',
  ],
  'Material para concurso': [
    'Layout de ficha de revisão densa e organizada: blocos compactos, destaques fortes para pegadinhas e para o que mais cai.',
  ],
  'Material de revisão': [
    'Layout de ficha de revisão: blocos compactos e escaneáveis, com destaque para fórmulas e regras.',
  ],
  'Material preparatório': [
    'Layout de painel de preparação: tópicos em cartões ordenados por prioridade, cada um com um selo de prioridade (alta, média ou baixa).',
    'Caixas "Como estudar", "Atenção" e o checklist de domínio em faixa própria, bem visíveis.',
  ],
  'Material complementar': [
    'Layout de página de revista educativa: pergunta de abertura em destaque, uma ilustração principal grande e caixas laterais "Você sabia?", "Na vida real" e "Para ir além".',
  ],
};

const typeElements = {
  'Mapa mental': 'Use somente elementos de mapa mental: nós, ramos, conectores rotulados, ícones e, se fizer sentido, 1 a 2 balões de reforço ("Dica rápida", "Atenção").',
};

const styleProfiles = {
  'Cartoon': {
    ilustracao: 'ilustrações em cartoon com contorno preto definido, formas arredondadas, expressões claras e cores chapadas',
    pagina: 'blocos com bordas grossas arredondadas, balões de fala e setas desenhadas com energia',
    tipografia: 'títulos em fonte display arredondada e encorpada; corpo em sem serifa simples',
    evitar: 'sombras realistas, texturas fotográficas e traço técnico',
  },
  'Hand-drawn': {
    ilustracao: 'desenhos feitos à mão com traço de caneta e lápis levemente irregular, hachuras e aquarela suave',
    pagina: 'fundo de papel levemente texturizado, molduras e setas desenhadas à mão, anotações à margem',
    tipografia: 'títulos em letra manuscrita legível; corpo em sem serifa limpa para garantir leitura',
    evitar: 'vetores perfeitos, gradientes digitais e aparência 3D',
  },
  'Doodle': {
    ilustracao: 'rabiscos e doodles em traço fino de caneta, ícones simples desenhados, estrelas, setas e sublinhados',
    pagina: 'composição solta, como página de caderno de anotações visuais (sketchnote), com fundo branco ou pautado',
    tipografia: 'títulos em letras desenhadas em caixa alta; corpo em manuscrita clara ou sem serifa',
    evitar: 'excesso de cor, fotografias e blocos rígidos',
  },
  'Cartoon Educacional': {
    ilustracao: 'cartoon didático: personagens simpáticos e objetos do tema com contorno limpo, explicando os conceitos',
    pagina: 'cartões arredondados, personagem guia com balão de fala, etapas numeradas e caixas de destaque',
    tipografia: 'títulos encorpados e amigáveis; corpo em sem serifa muito legível',
    evitar: 'humor que distraia do conteúdo e elementos sem função pedagógica',
  },
  'Scientific Illustration': {
    ilustracao: 'ilustração científica precisa, em corte ou vista técnica, com proporções corretas, linhas de chamada e rótulos',
    pagina: 'layout de prancha técnica, figuras numeradas (Fig. 1, Fig. 2) com legendas e escala quando aplicável',
    tipografia: 'títulos sóbrios; rótulos pequenos e nítidos; corpo em sem serifa técnica',
    evitar: 'personagens, cartoon e simplificações que distorçam o conceito',
  },
  'Futuristic Digital': {
    ilustracao: 'visual digital futurista: linhas de circuito, elementos em neon, interfaces holográficas e ícones vetoriais finos',
    pagina: 'fundo escuro azul-marinho ou grafite, painéis translúcidos com bordas luminosas e grade sutil',
    tipografia: 'títulos em sem serifa geométrica larga; corpo claro sobre fundo escuro com contraste alto',
    evitar: 'texturas de papel, traço manual e excesso de brilho que prejudique a leitura',
  },
  'Infográfico Moderno': {
    ilustracao: 'ícones vetoriais flat, pictogramas, gráficos simples e números em destaque',
    pagina: 'grade modular rígida, blocos de cor chapada, fluxos com setas e dados visualmente hierarquizados',
    tipografia: 'títulos em sem serifa bold; números grandes; corpo curto',
    evitar: 'ilustrações detalhadas, texturas e decoração sem dado',
  },
  'Minimalista': {
    ilustracao: 'ícones e ilustrações de linha fina, poucos elementos, apenas o essencial',
    pagina: 'muito espaço em branco, no máximo 2 cores de destaque, alinhamento rigoroso e poucos blocos',
    tipografia: 'uma família sem serifa em pesos diferentes; hierarquia por tamanho e espaço',
    evitar: 'sombras, molduras, excesso de ícones e caixas coloridas',
  },
  '3D Educacional': {
    ilustracao: 'objetos e esquemas em 3D estilizado, volumes suaves, iluminação macia e materiais foscos',
    pagina: 'fundo claro, objetos 3D como protagonistas de cada bloco, rótulos com linhas de chamada',
    tipografia: 'sem serifa arredondada e limpa; rótulos legíveis sobre os objetos',
    evitar: 'fotorrealismo excessivo e cenas carregadas',
  },
  'Realista': {
    ilustracao: 'imagens com aparência fotográfica realista de objetos, equipamentos e situações reais do tema',
    pagina: 'fotos recortadas ou em molduras limpas, com rótulos e linhas de chamada sobre as imagens',
    tipografia: 'sem serifa sóbria e editorial; legendas sob as imagens',
    evitar: 'cartoon, rabiscos e elementos fantasiosos',
  },
  'Livro Didático': {
    ilustracao: 'ilustrações editoriais limpas de livro didático brasileiro, com contorno suave e cores equilibradas',
    pagina: 'fundo branco, cartões de cantos arredondados com sombra suave, faixas de título coloridas, etapas numeradas em círculos e ícones lineares consistentes',
    tipografia: 'títulos grandes, subtítulos médios e corpo pequeno, no máximo 2 famílias sem serifa',
    evitar: 'estética de pôster publicitário e excesso de efeitos',
  },
  'Colorido Infantil': {
    ilustracao: 'ilustrações alegres com cores vivas, formas simples e arredondadas',
    pagina: 'blocos coloridos, molduras divertidas, ícones grandes e muitos elementos visuais de apoio',
    tipografia: 'títulos grandes e arredondados; corpo grande e muito legível',
    evitar: 'tons escuros, traço técnico e texto denso',
  },
};

function pagePlan(total, tipo) {
  if (total === 1) return [];
  const plan = [`Página 1: abertura — título, visão geral do tema e conceito central.`];
  const answerPage = tipo === 'Caderno de atividades';
  const lastContent = answerPage ? total - 1 : total;
  for (let page = 2; page < lastContent; page += 1) plan.push(`Página ${page}: desenvolvimento — parte ${page - 1} do tema (divida o conteúdo em subtópicos lógicos, sem repetir páginas anteriores).`);
  if (lastContent >= 2) plan.push(answerPage ? `Página ${lastContent}: atividades finais de maior dificuldade.` : `Página ${lastContent}: síntese — resumo final, pontos-chave e conexões entre as partes.`);
  if (answerPage) plan.push(`Página ${total}: gabarito comentado de todas as atividades, com resolução curta.`);
  return plan;
}

function generateImagePrompt(data) {
  const profile = typeProfiles[data.tipo] || typeProfiles['Apostila didática'];
  const tipoNome = data.tipo === 'Outro' ? 'Material didático' : data.tipo;
  const style = styleProfiles[data.estiloVisual] || styleProfiles['Livro Didático'];
  const formato = imagePageFormats[data.formato] || defaultPageFormat;
  const total = Math.max(1, Number.parseInt(data.paginas, 10) || 1);
  const assunto = text(data.assunto);
  const disciplina = text(data.disciplina);
  const visualItems = selectedResources(data);
  const plan = pagePlan(total, data.tipo);
  const childAudience = ['Educação Infantil', 'Ensino Fundamental I'].includes(data.publico);
  const learners = { 'Adulto': 'adultos', 'Outro': 'pessoas do público-alvo' }[data.publico] || `alunos de ${data.publico}`;
  const extras = [
    data.objetivo?.trim() && `Objetivo: ${data.objetivo.trim()}`,
    data.bncc?.trim() && `Habilidades BNCC: ${data.bncc.trim()}`,
  ].filter(Boolean);
  const lines = [
    'ATENÇÃO: ESTE É UM PROMPT PARA GERAÇÃO DE IMAGEM.',
    total === 1
      ? `A saída esperada é UMA IMAGEM ÚNICA: uma página visual de ${tipoNome.toLowerCase()} sobre ${assunto}, em ${formato}.`
      : `A saída esperada é uma sequência de ${total} IMAGENS, uma por página, de ${tipoNome.toLowerCase()} sobre ${assunto}, em ${formato}. Gere UMA imagem por vez.`,
    `O estilo visual deve ser OBRIGATORIAMENTE: ${data.estiloVisual}. Não misture com outros estilos.`,
    `O tipo de material deve ser OBRIGATORIAMENTE: ${tipoNome}.`,
    'Não responda com texto explicativo: produza a imagem descrita abaixo.',
    '',
    'PAPEL',
    'Atue como designer instrucional e ilustrador de material didático visual brasileiro.',
    '',
    'CONTEXTO',
    `Disciplina: ${disciplina}`,
    `Tema: ${assunto}`,
    `Público: ${data.publico}`,
    `Nível de profundidade: ${data.profundidade}`,
    `Tipo de material: ${tipoNome}`,
    `Formato da página: ${formato}`,
    `Total de páginas: ${total} ${total === 1 ? 'página' : 'páginas'}`,
    `Estilo de escrita: ${data.escrita}`,
    `Estilo visual: ${data.estiloVisual}`,
    `Paleta visual: ${data.paleta}`,
    ...extras,
    '',
    'MISSÃO',
    `${total === 1 ? 'Gerar a IMAGEM de uma página completa' : `Gerar ${total} páginas`} de ${tipoNome.toLowerCase()} sobre ${assunto}, no estilo ${data.estiloVisual}, ${total === 1 ? 'pronta' : 'prontas'} para impressão. Foco do material: ${profile.foco}.`,
    '',
    '1) DESCRIÇÃO DA IMAGEM (PRINCIPAL)',
    `Página didática de ${tipoNome.toLowerCase()} sobre "${assunto}" em ${disciplina}, no padrão de material educacional brasileiro.`,
    `Siga RIGOROSAMENTE o estilo ${data.estiloVisual}:`,
    `- Ilustração: ${style.ilustracao}.`,
    `- Página: ${style.pagina}.`,
    `- Tipografia: ${style.tipografia}.`,
    `- Evite: ${style.evitar}.`,
    childAudience
      ? `Personagens, se houver, devem ser crianças da faixa etária de ${data.publico}.`
      : `NÃO use figuras infantis nem imagens de crianças. Personagens, se houver, devem ser ${learners}, condizentes com o público-alvo.`,
    'Cada ilustração deve representar diretamente um conceito do conteúdo; nada decorativo sem função.',
    'Textos curtos, rótulos em negrito e legíveis. Priorize a explicação visual sobre o texto corrido.',
    'Seções bem delimitadas, espaço generoso entre os blocos, margens amplas e nenhum elemento cortado nas bordas.',
    'Conceitos-chave em caixas de destaque ("Dica", "Atenção", "Resumo") no visual do estilo escolhido.',
    data.paleta === 'Automática'
      ? 'Paleta automática: escolha cores que combinem com o estilo e o tema, com alto contraste entre texto e fundo.'
      : `Paleta ${data.paleta}: aplique-a em todo o material, com alto contraste entre texto e fundo.`,
    'Fórmulas, unidades, símbolos e valores numéricos devem estar corretos e coerentes entre si.',
    'Os textos de ensino são a prioridade: conteúdo correto, legível e focado no aprendizado.',
    'Todo o texto em português do Brasil, sem termos em inglês. Sem mockup e sem marca d\'água.',
    ...(typeLayouts[data.tipo] ? ['', `REGRA DE LAYOUT — ${data.tipo.toUpperCase()} (prevalece sobre qualquer outra instrução de layout)`, ...typeLayouts[data.tipo].map(rule => `- ${rule}`), ...(data.tipo === 'Mapa mental' && ['Doodle', 'Hand-drawn'].includes(data.estiloVisual) ? ['- Fundo de folha de caderno: pauta sutil azul-clara, margem vermelha à esquerda e espiral metálica na lateral; traço de caneta ou marcador e pequenos adesivos (estrelas, setas, lâmpadas) ao lado dos nós principais.'] : [])] : []),
    '',
    '2) MICROTEXTOS DENTRO DA IMAGEM',
    `Título em caixa alta: ${assunto.toUpperCase()}`,
    `Linha de apoio: ${disciplina} | ${profile.apoio} | ${data.publico}`,
    ...profile.microtextos,
    '',
    '3) ELEMENTOS VISUAIS',
    ...(typeElements[data.tipo] ? [typeElements[data.tipo]] : [
      `Use de 4 a 6 elementos visuais${visualItems.length ? `, priorizando: ${visualItems.join(', ')}` : ''}. Para cada um, defina o que representa e por que ajuda a aprender.`,
      'Opções: comparação lado a lado, esquema ou diagrama rotulado, fluxo de etapas com setas, tabela simples, ícones coloridos, caixa "Dica rápida" e mini-glossário ilustrado.',
    ]),
    '',
    '4) DIFICULDADE DOS ALUNOS',
    `Identifique a principal dificuldade de ${learners} ao estudar ${assunto} e faça o visual resolvê-la.`,
  ];
  if (data.referencias?.trim()) lines.push('', 'CONTEÚDO DE REFERÊNCIA (USE OBRIGATORIAMENTE)', data.referencias.trim());
  if (plan.length) lines.push('', `PLANO DE PÁGINAS (${total})`, ...plan, 'Distribua os microtextos e elementos visuais entre as páginas conforme o plano: título e abertura na Página 1, resumo final na última.', '', 'Gere AGORA somente a Página 1. Depois de cada imagem, aguarde eu escrever "próxima" para gerar a página seguinte.', 'Mantenha em todas as páginas exatamente o mesmo estilo, paleta, tipografia e identidade visual, e numere cada página no rodapé (ex.: 1/' + total + ').');
  lines.push(
    '',
    'RESTRIÇÃO',
    profile.restricao,
    '',
    'CRITÉRIOS DE QUALIDADE',
    '- Progressão lógica e linguagem adequada ao público.',
    '- Não presumir conhecimento ainda não apresentado; explicar termos técnicos na primeira ocorrência.',
    '- Evitar redundância e texto decorativo.',
    '- Não inventar informações factuais, técnicas ou normativas; havendo incerteza, sinalizar a necessidade de validação.',
  );
  if (data.orientacoes?.trim()) lines.push('', 'ORIENTAÇÕES ADICIONAIS', data.orientacoes.trim());
  return lines.join('\n');
}

const coverFormats = {
  'Somente tela': 'vertical 4:5 (1080x1350 px), otimizada para tela',
  'Apresentação 16:9': 'horizontal 16:9 (1920x1080 px)',
};

function generateCoverPrompt(data) {
  const formato = coverFormats[data.formato] || 'vertical A4 (210x297 mm)';
  const style = styleProfiles[data.estiloVisual] || styleProfiles['Livro Didático'];
  const titulo = text(data.titulo);
  const disciplina = data.disciplina?.trim();
  const tema = disciplina ? `${titulo} (${disciplina})` : titulo;
  const childAudience = ['Educação Infantil', 'Ensino Fundamental I'].includes(data.publico);
  const learners = { 'Adulto': 'adultos', 'Outro': 'pessoas do público-alvo' }[data.publico] || `alunos de ${data.publico}`;
  const texts = [
    ['Texto superior', data.textoSuperior],
    ['Título principal', data.titulo],
    ['Subtítulo', data.subtitulo],
    ['Frase inferior', data.fraseInferior],
    ['Série', data.serie],
    ['Professor(a)', data.professor],
    ['Instituição', data.instituicao],
  ].filter(([, value]) => value?.trim());
  const hasCredits = [data.serie, data.professor, data.instituicao].some(value => value?.trim());
  const lines = [
    'ATENÇÃO: ESTE É UM PROMPT PARA GERAÇÃO DE IMAGEM.',
    `A saída esperada é UMA IMAGEM ÚNICA: a arte frontal de uma capa de apostila educacional, em formato ${formato}.`,
    `O estilo visual deve ser OBRIGATORIAMENTE: ${data.estiloVisual}. Não misture com outros estilos.`,
    'Não responda com texto explicativo: produza somente a imagem descrita abaixo.',
    '',
    'PAPEL',
    'Atue como designer gráfico editorial especializado em capas de material didático brasileiro.',
    '',
    'CONTEXTO',
    ...(disciplina ? [`Disciplina: ${disciplina}`] : []),
    `Tema da capa: ${titulo}`,
    `Público: ${data.publico}`,
    `Estilo visual: ${data.estiloVisual}`,
    `Paleta visual: ${data.paleta}`,
    '',
    'TEXTOS DA CAPA (escreva exatamente como abaixo, letra por letra, com a acentuação indicada)',
    ...texts.map(([label, value]) => `${label}: "${value.trim()}"`),
    'Nenhum outro texto deve aparecer na capa: não invente slogans, datas, selos, logotipos ou assinaturas.',
    '',
    `DIREÇÃO DE ARTE — ${data.estiloVisual.toUpperCase()}`,
    `- Ilustração: ${style.ilustracao}.`,
    `- Página: ${style.pagina}.`,
    `- Tipografia: ${style.tipografia}.`,
    `- Evite: ${style.evitar}.`,
    '',
    'COMPOSIÇÃO',
    '- Hierarquia tipográfica: texto superior pequeno, título principal muito grande e dominante, subtítulo médio e frase inferior pequena na base.',
    `- Título em destaque, no centro ou no terço superior, com ilustrações ao redor relacionadas a ${tema}, sem cobrir nenhum texto.`,
    ...(data.elementos?.trim() ? [`- Elementos obrigatórios na ilustração: ${data.elementos.trim()}.`] : []),
    ...(hasCredits ? ['- Série, professor(a) e instituição em texto pequeno e discreto, em uma área própria (rodapé ou canto), sem competir com o título.'] : []),
    '- Margens amplas, nada cortado nas bordas e alto contraste entre texto e fundo; tipografia extremamente legível.',
    data.paleta === 'Automática'
      ? '- Paleta automática: escolha cores que combinem com o estilo e o tema.'
      : `- Paleta ${data.paleta}: aplique-a em toda a capa.`,
    childAudience
      ? `- Personagens, se houver, devem ser crianças da faixa etária de ${data.publico}.`
      : `- NÃO use figuras infantis nem imagens de crianças. Personagens, se houver, devem ser ${learners}.`,
    '',
    'RESTRIÇÕES',
    '- Evite excesso de elementos e fundos poluídos.',
    `- Formato ${formato}.`,
    '- Sem mockup. Sem livro físico, sem sombra de livro e sem moldura de dispositivo: apenas a arte frontal da capa.',
    "- Sem marca d'água.",
    '- Todo o texto em português do Brasil, sem erros de grafia.',
  ];
  return lines.join('\n');
}

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
const ICON_OPEN = '<svg class="icon-svg" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>';
const ICON_TRASH = '<svg class="icon-svg" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';
const KIND_LABEL = { apostila: 'Apostila', capa: 'Capa' };
const RESULT_BADGE = { apostila: 'Prompt da apostila', capa: 'Prompt da capa' };

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

function syncSaveButtons() {
  saveProjectButton.querySelector('.save-label').textContent = currentProjectId ? 'Atualizar projeto' : 'Salvar em Meus projetos';
  saveProjectNewButton.hidden = !currentProjectId;
}

function setResultTab(tab) {
  showPromptButton.classList.toggle('active', tab === 'prompt');
  previewButton.classList.toggle('active', tab === 'preview');
  showPromptButton.setAttribute('aria-pressed', String(tab === 'prompt'));
  previewButton.setAttribute('aria-pressed', String(tab === 'preview'));
}

function showResult({ prompt, kind, badge, files = false }) {
  currentPrompt = prompt;
  currentKind = kind;
  if (currentProjectId && currentProjectKind !== kind) currentProjectId = null;
  currentPreviewHtml = '';
  currentFiles = [];
  outEmpty.hidden = true;
  outBody.hidden = false;
  outBadge.textContent = `${badge} · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
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
  if (matchMedia('(max-width: 1180px)').matches) outPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelector('#generate-ai').addEventListener('click', () => {
  if (!aiAvailable) { notify('Salve a sua chave em "Minha chave de IA" para gerar o material.'); return; }
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

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateRequired(form)) return;
  const settings = dataObject(form);
  const pages = Math.max(1, Number.parseInt(settings.paginas, 10) || 1);
  settings.extensao = `${pages} ${pages === 1 ? 'página' : 'páginas'}, no máximo`;
  const aiMode = settings.modoGeracao === 'ai';
  let prompt;
  if (!aiMode) {
    prompt = generateImagePrompt(settings);
  } else {
    const deliveryInstruction = settings.formatoEntrega === 'pdf'
      ? `- Entregue UM ÚNICO ARQUIVO PDF FINAL, completo e pronto para download.\n- NÃO entregue HTML, arquivos Python (.py), scripts, notebooks, código-fonte ou instruções para gerar o PDF.\n- Use as ferramentas de criação de documentos disponíveis para produzir e anexar o PDF pronto.\n- Os mapas mentais, diagramas, infográficos, gráficos e ilustrações selecionados devem estar VISUALMENTE renderizados dentro do PDF, não apenas descritos.\n- Se imagens raster não estiverem disponíveis, crie ilustrações vetoriais e incorpore-as ao PDF.\n- Não responda apenas com texto: a entrega obrigatória é o arquivo .pdf final.`
      : `- Entregue UM ÚNICO arquivo HTML completo, autônomo e pronto para abrir no navegador.\n- Incorpore todo o CSS e todos os SVGs dentro do próprio HTML. Não crie arquivos auxiliares.\n- NÃO gere arquivos Python (.py), scripts de renderização, notebooks ou pacotes de projeto.\n- Os recursos selecionados devem aparecer VISUALMENTE no HTML, não apenas como descrição.\n- Se imagens raster não estiverem disponíveis, produza ilustrações vetoriais em SVG acessível dentro do HTML.\n- Não responda com uma explicação: entregue o HTML final completo em um único bloco de código.`;
    prompt = `${generatePrompt(settings)}\n\n9. PARÂMETROS DE PRODUÇÃO DIGITAL\n- Formato dos diagramas: ${settings.formatoDiagrama}.\n- Política de imagens por IA: ${settings.modoImagem}.\n- Formato final selecionado: ${settings.formatoEntrega === 'pdf' ? 'PDF' : 'HTML'}.\n- Não inclua chaves, credenciais ou dados pessoais em prompts de serviços externos.\n\n10. FORMATO DE ENTREGA OBRIGATÓRIO\n${deliveryInstruction}`;
    if (settings.modoImagem === 'gerar') prompt += '\n\n11. IMAGENS OBRIGATÓRIAS\n- Gere imagens reais com IA e incorpore-as visualmente ao material final, se a plataforma usada tiver ferramenta própria de geração de imagem.\n- Se a plataforma não tiver ferramenta de geração de imagem raster, produza ilustrações vetoriais em SVG acessível e renderizadas no próprio arquivo, seguindo a mesma especificação do briefing.\n- Não entregue prompts de imagem, descrições de produção, caixas vazias ou espaços reservados no lugar das imagens.\n- A entrega está incompleta se nenhum visual estiver de fato renderizado (raster ou vetorial) no arquivo final.\n- Disponibilize também as imagens geradas como arquivos PNG separados quando a plataforma permitir.';
  }
  showResult({ prompt, kind: 'apostila', badge: aiMode ? 'Material gerado com IA' : RESULT_BADGE.apostila, files: aiMode });
  if (!currentProjectId) projectName.value = settings.assunto;
  if (!aiMode) {
    status.textContent = 'Prompt montado no navegador. Os dados só são enviados ao servidor ao pedir a prévia, o PDF ou melhorar com IA.';
    return;
  }
  generatedFiles.innerHTML = '<div class="ai-loading"><span class="ai-spinner" aria-hidden="true"></span><strong>Produzindo o material…</strong><span>Esta etapa pode levar alguns minutos. Não saia desta página.</span></div>';
  status.textContent = 'A IA está criando e finalizando o arquivo solicitado.';
  const button = document.querySelector('#generate-button');
  const label = button.querySelector('.generate-label');
  const originalLabel = label.textContent;
  button.disabled = true;
  label.innerHTML = '<span class="button-spinner" aria-hidden="true"></span>Gerando…';
  try {
    const imageCount = settings.frequencia.startsWith('Intensa') ? 3 : settings.frequencia.startsWith('Equilibrada') ? 2 : 1;
    const response = await apiFetch('api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: settings.assunto, format: settings.formatoEntrega, prompt, generateImages: settings.modoImagem === 'gerar', imageCount }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o material.');
    currentFiles = result.files || [];
    renderGeneratedFiles();
    status.textContent = `${currentFiles.length} arquivo${currentFiles.length === 1 ? '' : 's'} gerado${currentFiles.length === 1 ? '' : 's'} com ${result.model}. Escolha onde salvar.`;
    notify('Material gerado com sucesso');
  } catch (error) {
    generatedFiles.innerHTML = `<div class="ai-loading"><strong>Não foi possível gerar o material.</strong><span>${escapeUi(error.message)}</span></div>`;
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
  showResult({ prompt: generateCoverPrompt(settings), kind: 'capa', badge: RESULT_BADGE.capa });
  if (!currentProjectId) projectName.value = `Capa — ${settings.titulo}`;
  status.textContent = 'Prompt da capa montado no navegador.';
});

[form, capaForm].forEach(target => target.addEventListener('reset', () => {
  currentProjectId = null;
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
  notify(`${file.name} pronto para salvar`);
}

function renderGeneratedFiles() {
  generatedFiles.innerHTML = currentFiles.map((file, index) => {
    const extension = file.name.split('.').pop().toUpperCase();
    const size = Math.round((file.data.length * .75) / 1024);
    return `<article class="generated-file"><span class="file-icon">${escapeUi(extension)}</span><div><h3>${escapeUi(file.name)}</h3><p>${escapeUi(file.mimeType)} · aproximadamente ${size} KB</p></div><button type="button" data-save-file="${index}">Salvar localmente</button></article>`;
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
    button.classList.add('copied');
    copyIcon.innerHTML = '<svg class="icon-svg" viewBox="0 0 20 20" width="16" height="16"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.querySelector('.copy-label').textContent = 'Copiado!';
    status.textContent = 'Prompt copiado para a área de transferência.';
    notify('Prompt copiado com sucesso');
    setTimeout(() => { button.classList.remove('copied'); copyIcon.innerHTML = defaultIconHtml; button.querySelector('.copy-label').textContent = 'Copiar'; }, 2200);
  } catch { status.textContent = 'Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.'; }
});
document.querySelector('#export-txt').addEventListener('click', () => { download(`prompt-${currentKind}.txt`, currentPrompt, 'text/plain;charset=utf-8'); notify('Arquivo TXT preparado'); });
document.querySelector('#export-json').addEventListener('click', () => { download('projeto-geradorone.json', JSON.stringify({ version: 3, kind: currentKind, createdAt: new Date().toISOString(), settings: dataObject(formFor(currentKind)), prompt: currentPrompt }, null, 2), 'application/json'); notify('Projeto JSON preparado'); });
previewButton.addEventListener('click', async () => {
  status.textContent = 'Preparando prévia…';
  try {
    if (!currentPreviewHtml) {
      const response = await apiFetch('api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: projectTitle(), prompt: currentPrompt }) });
      if (!response.ok) throw new Error('Falha na prévia');
      currentPreviewHtml = (await response.json()).html;
    }
    previewFrame.srcdoc = currentPreviewHtml;
    previewFrame.hidden = false;
    output.hidden = true;
    setResultTab('preview');
    status.textContent = 'Prévia HTML exibida.';
  } catch { status.textContent = 'Não foi possível gerar a prévia. O prompt continua disponível.'; }
});
showPromptButton.addEventListener('click', () => { previewFrame.hidden = true; output.hidden = false; setResultTab('prompt'); status.textContent = 'Exibindo o prompt completo.'; });
document.querySelector('#export-pdf').addEventListener('click', async () => {
  status.textContent = 'Gerando arquivo PDF…';
  try {
    const response = await apiFetch('api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: projectTitle(), prompt: currentPrompt }) });
    if (!response.ok) throw new Error('Falha no PDF');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement('a'), { href: url, download: 'prompt-geradorone.pdf' });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'PDF gerado e baixado.';
    notify('PDF gerado com sucesso');
  } catch { status.textContent = 'Não foi possível preparar o PDF.'; }
});

const improveAdjustments = [
  ['Mais detalhado', 'Aumente o detalhamento: mais subtópicos, exemplos e rótulos explicativos, sem ultrapassar o número de páginas.'],
  ['Mais simples', 'Simplifique: menos blocos, frases mais curtas e vocabulário mais acessível.'],
  ['Mais visual', 'Torne mais visual: mais esquemas, ícones e ilustrações, e menos texto.'],
  ['Mais didático', 'Reforce o caráter didático: progressão passo a passo, analogias do cotidiano e destaque para os conceitos-chave.'],
  ['Mais profissional', 'Dê um tom mais técnico e profissional, com termos da área e aplicação prática.'],
  ['Adaptar para crianças', 'Adapte para crianças: linguagem simples, exemplos do dia a dia e visual acolhedor.'],
  ['Aumentar dificuldade', 'Aumente a dificuldade: conceitos mais aprofundados e exemplos mais desafiadores.'],
  ['Diminuir dificuldade', 'Diminua a dificuldade: foque no essencial, com exemplos básicos.'],
];
const improveStatus = document.querySelector('#improve-status');
const improveInstruction = document.querySelector('#improve-instruction');
document.querySelector('#improve-options').innerHTML = improveAdjustments.map(([label], index) => `<label class="improve-chip"><input type="checkbox" name="adjust" value="${index}"><span>${label}</span></label>`).join('');

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
    ? 'A IA configurada no servidor vai reescrever o prompt aplicando os ajustes.'
    : 'IA não configurada: os ajustes serão anexados ao fim do prompt. Configure a chave em "Minha chave de IA" para a IA reescrever o prompt.';
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
  const adjustments = [...improveBox.querySelectorAll('[name=adjust]:checked')].map(box => improveAdjustments[Number(box.value)][1]);
  const instruction = improveInstruction.value.trim();
  if (!adjustments.length && !instruction) { improveStatus.textContent = 'Escolha ao menos um ajuste ou escreva uma instrução.'; return; }
  if (!aiAvailable) {
    replacePrompt(`${currentPrompt}\n\nAJUSTES SOLICITADOS\n${[...adjustments, instruction].filter(Boolean).map(item => `- ${item}`).join('\n')}`);
    closeImprove();
    notify('Ajustes anexados ao prompt');
    return;
  }
  const apply = document.querySelector('#improve-apply');
  apply.disabled = true;
  improveStatus.textContent = 'A IA está reescrevendo o prompt…';
  try {
    const response = await apiFetch('api/improve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: currentPrompt, adjustments, instruction }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível melhorar o prompt.');
    replacePrompt(result.prompt);
    closeImprove();
    status.textContent = `Prompt melhorado com ${result.model}.`;
    notify('Prompt melhorado com IA');
  } catch (error) {
    improveStatus.textContent = error.message;
  } finally {
    apply.disabled = false;
  }
});

async function saveProject(asNew) {
  const name = projectName.value.trim();
  if (!name) { projectName.focus(); notify('Dê um nome ao projeto'); return; }
  try {
    const response = await apiFetch('api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: asNew ? undefined : currentProjectId || undefined, name, kind: currentKind, settings: dataObject(formFor(currentKind)), prompt: currentPrompt }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o projeto.');
    currentProjectId = result.project.id;
    currentProjectKind = result.project.kind;
    syncSaveButtons();
    status.textContent = `Projeto "${result.project.name}" salvo em Meus projetos.`;
    notify('Projeto salvo em Meus projetos');
  } catch (error) {
    status.textContent = error.message;
    notify(error.message);
  }
}
saveProjectButton.addEventListener('click', () => saveProject(false));
saveProjectNewButton.addEventListener('click', () => saveProject(true));

const projectsList = document.querySelector('#projects-list');

async function loadProjects() {
  projectsList.innerHTML = '<p class="field-status">Carregando projetos…</p>';
  try {
    const response = await apiFetch('api/projects');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os projetos.');
    if (!data.projects.length) {
      projectsList.innerHTML = '<div class="projects-empty"><strong>Nenhum projeto salvo</strong><span>Gere uma apostila ou capa e use "Salvar em Meus projetos" no resultado.</span></div>';
      return;
    }
    projectsList.innerHTML = data.projects.map(project => `<article class="project-card"><div class="project-main"><strong>${escapeUi(project.name)}</strong><small><span class="project-kind">${escapeUi(KIND_LABEL[project.kind] || project.kind)}</span>${escapeUi(new Date(project.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}</small></div><div class="project-buttons"><button type="button" data-open-project="${escapeUi(project.id)}">${ICON_OPEN}Abrir</button><button type="button" class="danger" data-delete-project="${escapeUi(project.id)}">${ICON_TRASH}Excluir</button></div></article>`).join('');
  } catch (error) {
    projectsList.innerHTML = `<p class="field-status unavailable">${escapeUi(error.message)}</p>`;
  }
}

async function openProject(id) {
  try {
    const response = await apiFetch(`api/projects/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível abrir o projeto.');
    const { project } = data;
    const target = formFor(project.kind);
    target.reset();
    applyData(target, project.settings);
    currentProjectId = project.id;
    currentProjectKind = project.kind;
    showView(project.kind);
    showResult({ prompt: project.prompt, kind: project.kind, badge: RESULT_BADGE[project.kind] || 'Projeto' });
    projectName.value = project.name;
    status.textContent = `Projeto "${project.name}" aberto.`;
    notify('Projeto aberto');
  } catch (error) {
    notify(error.message);
  }
}

async function deleteProject(id) {
  try {
    const response = await apiFetch(`api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível excluir o projeto.');
    if (currentProjectId === id) { currentProjectId = null; syncSaveButtons(); }
    notify('Projeto excluído');
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
  del.classList.add('armed');
  del.lastChild.textContent = 'Confirmar exclusão';
  setTimeout(() => { del.classList.remove('armed'); del.lastChild.textContent = 'Excluir'; }, 3500);
});

const projectFile = document.querySelector('#project-file');
document.querySelector('#import-project').addEventListener('click', () => projectFile.click());
projectFile.addEventListener('change', async () => {
  const file = projectFile.files[0];
  if (!file) return;
  if (file.size > 1_000_000) { notify('Arquivo maior que 1 MB não aceito'); return; }
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
      projectName.value = '';
    }
    notify('Projeto importado. Revise antes de gerar');
  } catch { notify('Projeto inválido. Use um JSON exportado pela plataforma'); }
  projectFile.value = '';
});

const aiConfigForm = document.querySelector('#ai-config-form');
const aiConfigCurrent = document.querySelector('#ai-config-current');
const aiConfigStatus = document.querySelector('#ai-config-status');
const aiConfigProvider = document.querySelector('#ai-config-provider');
const aiConfigModelInput = document.querySelector('#ai-config-model');
const aiConfigImageModelInput = document.querySelector('#ai-config-image-model');

function applyAiConfigDatalists() {
  const provider = aiConfigProvider.value;
  aiConfigModelInput.setAttribute('list', `ai-text-models-${provider}`);
  aiConfigImageModelInput.setAttribute('list', `ai-image-models-${provider}`);
}
aiConfigProvider.addEventListener('change', () => {
  applyAiConfigDatalists();
  aiConfigModelInput.value = '';
  aiConfigImageModelInput.value = '';
});
applyAiConfigDatalists();

async function loadAiConfig() {
  aiConfigCurrent.textContent = 'Verificando configuração…';
  aiConfigCurrent.className = 'field-status';
  try {
    const response = await apiFetch('api/ai/config');
    const data = await response.json();
    const providerLabel = data.provider === 'gemini' ? 'Gemini' : 'OpenAI';
    aiConfigCurrent.textContent = data.hasApiKey ? `Sua chave está salva (${data.keyHint}) · ${providerLabel} · modelo ${data.model}` : `Você ainda não salvou uma chave (${providerLabel}). Gerar com IA e Melhorar com IA exigem a sua chave.`;
    aiConfigCurrent.className = `field-status ${data.hasApiKey ? 'available' : 'unavailable'}`;
    aiConfigProvider.value = data.provider || 'openai';
    applyAiConfigDatalists();
    aiConfigModelInput.value = data.model || '';
    aiConfigImageModelInput.value = data.imageModel || '';
    document.querySelector('#ai-config-key').value = '';
  } catch {
    aiConfigCurrent.textContent = 'Não foi possível carregar a configuração atual.';
    aiConfigCurrent.className = 'field-status unavailable';
  }
}

aiConfigForm.addEventListener('submit', async event => {
  event.preventDefault();
  aiConfigStatus.textContent = 'Salvando…';
  try {
    const body = {
      provider: aiConfigProvider.value,
      apiKey: document.querySelector('#ai-config-key').value,
      model: aiConfigModelInput.value,
      imageModel: aiConfigImageModelInput.value
    };
    const response = await apiFetch('api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
    aiConfigStatus.textContent = 'Configuração salva. Aplicada imediatamente, sem reiniciar o servidor.';
    notify('Configuração de IA salva');
    await loadAiConfig();
    checkAiAvailability();
  } catch (error) {
    aiConfigStatus.textContent = error.message;
  }
});

document.querySelector('#ai-config-clear').addEventListener('click', async () => {
  aiConfigStatus.textContent = 'Removendo chave…';
  try {
    const response = await apiFetch('api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearApiKey: true }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível remover a chave.');
    aiConfigStatus.textContent = 'Chave removida.';
    notify('Chave de IA removida');
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
const isMobileLayout = () => matchMedia('(max-width: 900px)').matches;

function setCollapsed(collapsed) {
  shell.classList.toggle('collapsed', collapsed);
  menuToggle.setAttribute('aria-expanded', String(!collapsed));
  menuToggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
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

const VIEWS = ['inicio', 'apostila', 'capa', 'projetos', 'ia', 'conta', 'tema', 'usuarios'];

function showView(name) {
  if (!VIEWS.includes(name) || (name === 'usuarios' && currentUser?.role !== 'admin')) name = 'inicio';
  workspace.dataset.view = name;
  document.querySelectorAll('.view').forEach(view => { view.hidden = view.dataset.view !== name; });
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    if (item.dataset.view === name) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
  });
  if (name === 'projetos') loadProjects();
  if (name === 'ia') loadAiConfig();
  if (name === 'conta') fillAccount();
  if (name === 'tema') renderThemeView();
  if (name === 'usuarios') loadUsers();
  setMobileMenu(false);
  try { history.replaceState(null, '', `#${name}`); } catch {}
  window.scrollTo({ top: 0 });
}


document.querySelector('[data-view-link]').addEventListener('click', event => {
  event.preventDefault();
  showView(event.currentTarget.dataset.viewLink);
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

function startApp(user) {
  const switched = currentUser && currentUser.id !== user.id;
  currentUser = user;
  if (switched) { location.hash = ''; location.reload(); return; }
  if (user.theme && themeNames[user.theme]) { themeFollowsSystem = false; setTheme(user.theme); } else { themeFollowsSystem = true; setTheme(systemTheme(), { persist: false }); }
  document.querySelector('#user-name').textContent = user.name;
  document.querySelector('#user-email').textContent = user.role === 'admin' ? 'Administrador' : 'Usuário';
  document.querySelectorAll('[data-admin]').forEach(item => { item.hidden = user.role !== 'admin'; });
  authScreen.hidden = true;
  appShell.hidden = false;
  updateCompletion();
  updateGenerationMode();
  checkAiAvailability();
  if (!user.phone) {
    showView('conta');
    notify('Informe seu telefone para completar o cadastro');
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
  if (!email || !formEl.password.value) { setError(formEl, 'Informe e-mail e senha.'); return; }
  setError(formEl, '');
  const submit = formEl.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const result = await postJson('api/auth/login', { email, password: formEl.password.value });
    if (!result.ok) { setError(formEl, result.data.error || 'Não foi possível entrar.'); return; }
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

let resetEmail = '';
document.querySelector('#forgot-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const email = formEl.email.value.trim();
  if (!email || formEl.password.value.length < 8) { setError(formEl, 'Informe o e-mail e uma nova senha com ao menos 8 caracteres.'); return; }
  setError(formEl, '');
  const result = await postJson('api/auth/forgot', { email, password: formEl.password.value });
  if (!result.ok) { setError(formEl, result.data.error || 'Não foi possível enviar o código.'); return; }
  resetEmail = email;
  formEl.password.value = '';
  document.querySelector('#confirm-info').textContent = `${result.data.message} Digite abaixo o código recebido.`;
  showAuth('confirm');
});

document.querySelector('#confirm-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const result = await postJson('api/auth/confirm', { email: resetEmail, code: formEl.code.value.trim() });
  if (!result.ok) { setError(formEl, result.data.error || 'Código inválido ou expirado.'); return; }
  formEl.code.value = '';
  showAuth('login');
  setError(authScreen.querySelector('#login-form'), result.data.message, true);
});

document.querySelector('#first-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  if (formEl.password.value.length < 8) { setError(formEl, 'A nova senha precisa ter ao menos 8 caracteres.'); return; }
  if (formEl.password.value !== formEl.repeat.value) { setError(formEl, 'As senhas não conferem.'); return; }
  const result = await postJson('api/auth/change-password', { current: formEl.current.value, password: formEl.password.value });
  if (!result.ok) { setError(formEl, result.data.error || 'Não foi possível trocar a senha.'); return; }
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

function fillAccount() {
  if (!currentUser) return;
  const profile = document.querySelector('#profile-form');
  profile.name.value = currentUser.name;
  profile.phone.value = formatPhone(currentUser.phone);
  profile.email.value = currentUser.email;
  document.querySelector('#account-summary').textContent = `${currentUser.role === 'admin' ? 'Administrador' : 'Usuário'} · ${currentUser.email}`;
  document.querySelector('#profile-status').textContent = '';
  document.querySelector('#password-status').textContent = '';
}

document.querySelector('#profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.querySelector('#profile-status');
  const formEl = event.currentTarget;
  const result = await postJson('api/auth/profile', { name: formEl.name.value, phone: formEl.phone.value });
  if (!result.ok) { status.textContent = result.data.error || 'Não foi possível salvar.'; return; }
  currentUser = result.data.user;
  formEl.phone.value = formatPhone(currentUser.phone);
  document.querySelector('#user-name').textContent = currentUser.name;
  status.textContent = 'Perfil salvo.';
  notify('Perfil salvo');
});

document.querySelector('#password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formEl = event.currentTarget;
  const status = document.querySelector('#password-status');
  if (formEl.password.value.length < 8) { status.textContent = 'A nova senha precisa ter ao menos 8 caracteres.'; return; }
  if (formEl.password.value !== formEl.repeat.value) { status.textContent = 'As senhas não conferem.'; return; }
  const result = await postJson('api/auth/change-password', { current: formEl.current.value, password: formEl.password.value });
  if (!result.ok) { status.textContent = result.data.error || 'Não foi possível trocar a senha.'; return; }
  formEl.reset();
  currentUser = result.data.user;
  status.textContent = 'Senha alterada. Suas outras sessões foram encerradas.';
  notify('Senha alterada');
});

const usersList = document.querySelector('#users-list');
const tempBox = document.querySelector('#temp-password-box');

function showTempPassword(name, password) {
  tempBox.hidden = false;
  tempBox.innerHTML = `<p><strong>Senha temporária de ${escapeUi(name)}:</strong></p><code>${escapeUi(password)}</code><p>Copie e entregue com segurança. Ela não será exibida de novo e precisa ser trocada no primeiro acesso.</p><button type="button" class="ghost" id="copy-temp">Copiar senha</button>`;
  tempBox.querySelector('#copy-temp').addEventListener('click', async event => {
    const button = event.currentTarget;
    try { await navigator.clipboard.writeText(password); button.textContent = 'Copiada'; } catch { button.textContent = 'Selecione e copie manualmente'; }
  });
}

let usersData = [];
const usersSearch = document.querySelector('#users-search');
const usersRoleFilter = document.querySelector('#users-role-filter');
const usersCount = document.querySelector('#users-count');
const USER_HEAD = '<thead><tr><th scope="col">Nome</th><th scope="col">Telefone</th><th scope="col">E-mail</th><th scope="col">Perfil</th><th scope="col">Situação</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>';

function userGroupHtml(user) {
  const id = escapeUi(user.id);
  const self = currentUser && user.id === currentUser.id;
  const notes = [user.hasApiKey ? 'chave de IA cadastrada' : 'sem chave de IA', user.mustChangePassword ? 'troca de senha pendente' : '', self ? 'você' : ''].filter(Boolean).join(' · ');
  return `<tbody class="user-group" data-user-id="${id}">
    <tr class="user-row">
      <th scope="row"><span class="user-name">${escapeUi(user.name)}</span><small>${notes}</small></th>
      <td class="num">${escapeUi(formatPhone(user.phone)) || '—'}</td>
      <td class="wrap">${escapeUi(user.email)}</td>
      <td>${user.role === 'admin' ? 'Administrador' : 'Usuário'}</td>
      <td>${user.active ? 'Ativo' : 'Inativo'}</td>
      <td class="row-actions">
        <button type="button" data-edit-user="${id}">Editar</button>
        <button type="button" data-reset-user="${id}">Redefinir senha</button>
        <button type="button" class="danger" data-delete-user="${id}">${ICON_TRASH}<span>Excluir</span></button>
      </td>
    </tr>
    <tr class="user-edit-row" hidden>
      <td colspan="6">
        <form class="user-card" data-user-id="${id}" novalidate>
          <div class="user-fields">
            <label>Nome<input name="name" value="${escapeUi(user.name)}" maxlength="120" required></label>
            <label>Telefone<input name="phone" type="tel" value="${escapeUi(formatPhone(user.phone))}" placeholder="(35) 99999-8888" maxlength="22"></label>
            <label>E-mail<input name="email" type="email" value="${escapeUi(user.email)}" required></label>
            <label>Perfil<select name="role"><option value="user"${user.role === 'user' ? ' selected' : ''}>Usuário</option><option value="admin"${user.role === 'admin' ? ' selected' : ''}>Administrador</option></select></label>
            <label class="user-active"><input name="active" type="checkbox"${user.active ? ' checked' : ''}>Ativo</label>
          </div>
          <div class="project-buttons"><button type="submit">Salvar</button><button type="button" data-cancel-edit>Cancelar</button></div>
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
    ? USER_HEAD + shown.map(userGroupHtml).join('')
    : `${USER_HEAD}<tbody><tr><td colspan="6" class="table-empty">Nenhum usuário encontrado.</td></tr></tbody>`;
  usersCount.textContent = `${shown.length} de ${usersData.length}`;
}
usersSearch.addEventListener('input', renderUsers);
usersRoleFilter.addEventListener('change', renderUsers);

async function loadUsers() {
  usersList.innerHTML = '<tbody><tr><td class="table-empty">Carregando usuários…</td></tr></tbody>';
  try {
    const response = await apiFetch('api/users');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os usuários.');
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
  if (!body.name.trim() || !body.phone.trim() || !body.email.trim() || !body.password) { status.textContent = 'Preencha nome, telefone, e-mail e senha.'; return; }
  if (body.password.length < 8) { status.textContent = 'A senha precisa ter ao menos 8 caracteres.'; return; }
  const result = await postJson('api/users', body);
  if (!result.ok) { status.textContent = result.data.error || 'Não foi possível criar o usuário.'; return; }
  status.textContent = `Usuário ${result.data.user.email} criado. Entregue a senha temporária com segurança: ela será trocada no primeiro acesso.`;
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
  if (!response.ok) { status.textContent = data.error || 'Não foi possível salvar.'; return; }
  status.textContent = 'Salvo.';
  notify('Usuário atualizado');
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
    if (!result.ok) { notify(result.data.error || 'Não foi possível redefinir.'); return; }
    showTempPassword(result.data.user.name, result.data.temporaryPassword);
    notify('Senha redefinida');
    loadUsers();
    return;
  }
  if (!del) return;
  if (!del.classList.contains('armed')) {
    del.classList.add('armed');
    del.lastElementChild.textContent = 'Confirmar (apaga os projetos)';
    setTimeout(() => { del.classList.remove('armed'); del.lastElementChild.textContent = 'Excluir'; }, 4000);
    return;
  }
  const response = await apiFetch(`api/users/${encodeURIComponent(del.dataset.deleteUser)}`, { method: 'DELETE' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { notify(data.error || 'Não foi possível excluir.'); return; }
  notify(`Usuário excluído (${data.removedProjects} projeto(s) apagado(s))`);
  loadUsers();
});

document.querySelector('#toggle-password').addEventListener('click', event => {
  const button = event.currentTarget;
  const field = document.querySelector('#login-password');
  const show = field.type === 'password';
  field.type = show ? 'text' : 'password';
  button.textContent = show ? 'Ocultar' : 'Mostrar';
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
});

async function bootstrapAuth() {
  try {
    const config = await (await fetch('api/auth/config')).json();
    authScreen.querySelector('[data-auth-go="forgot"]').hidden = !config.emailReset;
  } catch {}
  try {
    const response = await fetch('api/auth/me', { credentials: 'same-origin' });
    if (response.ok) {
      const { user } = await response.json();
      if (user.mustChangePassword) { currentUser = user; showAuth('first'); } else startApp(user);
      return;
    }
  } catch {}
  showAuth('login');
}
bootstrapAuth();
