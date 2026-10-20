const styles = [
  ['Cartoon','Traço amigável e expressivo'],['Hand-drawn','Aparência desenhada à mão'],['Doodle','Rabiscos leves e criativos'],['Cartoon Educacional','Cartoon com foco pedagógico'],['Scientific Illustration','Precisão científica'],['Futuristic Digital','Visual digital moderno'],['Infográfico Moderno','Blocos, ícones e dados'],['Minimalista','Poucos elementos, muito ar'],['3D Educacional','Volumes suaves em 3D'],['Realista','Aparência fotográfica'],['Livro Didático','Padrão editorial clássico'],['Colorido Infantil','Cores vivas para crianças']
];
const resources = [
  ['mapasMentais','◉','Mapas mentais','Síntese radial e conexões'],['diagramas','◇','Diagramas','Processos, relações e fluxos'],['ilustracoes','✦','Ilustrações','Conceitos, cenas e objetos'],['infograficos','▦','Infográficos','Dados e explicações visuais'],['graficos','⌁','Gráficos','Somente com dados verificáveis'],['quadros','▤','Quadros comparativos','Contrastes e classificações'],['linhas','↝','Linhas do tempo','Eventos em sequência'],['icones','⬡','Ícones e sinalização','Navegação e destaques']
];

const themeButton = document.querySelector('#theme-toggle');
const preferredTheme = localStorage.getItem('apostila-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  themeButton.querySelector('[aria-hidden]').textContent = theme === 'dark' ? '☀' : '☾';
  localStorage.setItem('apostila-theme', theme);
}
setTheme(preferredTheme);
themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

const styleContainer = document.querySelector('#style-options');
const styleSamples = ['● ᴗ ●','╱╲〰','✎ ✦ ☁','● ABC ✦','⌬ ⌖ ◌','◈ 01 ◈','▦ ↑ 72','— ○ —','◒ ◉ ◐','▣ ◉ ▣','Aa § 01','★ ● ▲'];
styles.forEach(([name, description], index) => styleContainer.insertAdjacentHTML('beforeend', `<div class="option"><input type="radio" name="estiloVisual" id="style-${index}" value="${name}" ${name === 'Livro Didático' ? 'checked' : ''}><label for="style-${index}"><span class="style-sample sample-${index}" aria-hidden="true">${styleSamples[index]}</span><strong>${name}</strong><small>${description}</small></label></div>`));
const resourceContainer = document.querySelector('#resource-options');
const visualSamples = {
  mapasMentais:'<span class="mm-core">A</span><i class="mm-dot d1"></i><i class="mm-dot d2"></i><i class="mm-dot d3"></i><b class="mm-edge e1"></b><b class="mm-edge e2"></b><b class="mm-edge e3"></b>',
  diagramas:'<span class="flow-box">1</span><b class="flow-arrow">→</b><span class="flow-box">2</span><b class="flow-arrow">→</b><span class="flow-box">3</span>',
  ilustracoes:'<i class="scene-sun"></i><i class="scene-hill h1"></i><i class="scene-hill h2"></i>',
  infograficos:'<span class="info-ring"></span><span class="info-lines"><i></i><i></i><i></i></span>',
  graficos:'<span class="chart-bars"><i></i><i></i><i></i><i></i></span><b class="chart-line">⌁</b>',
  quadros:'<span class="compare-card">A<br><i></i><i></i></span><b class="compare-vs">×</b><span class="compare-card">B<br><i></i><i></i></span>',
  linhas:'<span class="timeline-line"><i></i><i></i><i></i><i></i></span>',
  icones:'<span class="icon-set"><i>✓</i><i>!</i><i>?</i></span>'
};
resources.forEach(([name, icon, title, description]) => resourceContainer.insertAdjacentHTML('beforeend', `<div class="resource"><input type="checkbox" name="${name}" id="${name}" checked><label for="${name}"><span class="resource-demo" aria-hidden="true">${visualSamples[name] || icon}</span><strong>${title}</strong><small>${description}</small></label></div>`));

const form = document.querySelector('#formulario');
const output = document.querySelector('#prompt-output');
const resultModal = document.querySelector('#result-modal');
const previewFrame = document.querySelector('#preview-frame');
const status = document.querySelector('#status');
const toast = document.querySelector('#toast');
let currentPrompt = '';
let currentPreviewHtml = '';
let toastTimer;

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('show');
  toastTimer = setTimeout(() => { toast.classList.remove('show'); toast.hidden = true; }, 2600);
}

function dataObject() {
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  resources.forEach(([name]) => data[name] = fd.has(name));
  data.sugerirBncc = fd.has('sugerirBncc');
  return data;
}

function selectedResources(data) {
  return resources.filter(([name]) => data[name]).map(([, , title]) => title);
}

function applyData(data) {
  Object.entries(data || {}).forEach(([name, value]) => {
    const fields = form.elements.namedItem(name);
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
  return `ATUE COMO ESPECIALISTA EM EDUCAÇÃO, DESIGN INSTRUCIONAL, DIREÇÃO DE ARTE EDITORIAL E PRODUÇÃO DE MATERIAL DIDÁTICO.\n\nTAREFA\nCrie um material do tipo "${data.tipo}" sobre "${text(data.assunto)}" para a disciplina "${text(data.disciplina)}". Entregue o conteúdo em português brasileiro.\n\n1. PERFIL PEDAGÓGICO\n- Público-alvo: ${data.publico}.\n- Objetivo de aprendizagem: ${text(data.objetivo)}.\n- Profundidade do conteúdo: ${data.profundidade}.\n- Estilo de escrita: ${data.escrita}.\n- Densidade do texto: ${data.densidade}.\n- Adapte linguagem, exemplos, vocabulário e progressão ao público.\n- Declare hipóteses quando faltarem dados indispensáveis.\n\n2. CONFIGURAÇÃO CURRICULAR E FONTES\n- Códigos BNCC informados: ${text(data.bncc, 'Nenhum')}.\n- ${bnccInstruction}\n- Material de referência obrigatório:\n${text(data.referencias, 'Nenhum material fornecido. Não invente fontes, normas, números, citações ou resultados.')}.\n- Diferencie explicitamente dados ilustrativos de dados medidos, documentados ou comprovados.\n\n3. ARQUITETURA DO MATERIAL\n- Apresente título, objetivos específicos, pré-requisitos e uma rota de aprendizagem.\n- Organize seções progressivas, com explicações completas, definições, exemplos resolvidos e aplicações contextualizadas quando pertinentes.\n- Inclua sínteses parciais, questões de verificação e indicações claras de transição entre assuntos.\n- Termine com síntese geral, atividades de fixação em dificuldade progressiva e gabarito comentado.\n- Faça revisão final de consistência pedagógica, conceitual, ortográfica e visual.\n\n4. SISTEMA VISUAL\n- Estilo visual: ${data.estiloVisual}.\n- Paleta: ${data.paleta}.\n- Formato prioritário: ${data.formato}.\n- Frequência: ${data.frequencia}.\n- Profundidade visual: ${data.profundidadeVisual}.\n- Recursos obrigatórios selecionados: ${visualItems.length ? visualItems.join(', ') : 'nenhum recurso obrigatório'}.\n- Use hierarquia tipográfica clara, espaçamento confortável, alto contraste, legendas e consistência visual. Garanta legibilidade em tela e impressão e não dependa apenas de cor para transmitir significado.\n\n5. ESPECIFICAÇÃO DOS RECURSOS VISUAIS\nPara cada recurso visual, entregue: (a) objetivo pedagógico; (b) posição sugerida; (c) conteúdo exato; (d) título e legenda; (e) descrição de produção; (f) texto alternativo acessível.\n${data.mapasMentais ? '- MAPAS MENTAIS: crie estruturas ricas, com conceito central, 4 a 7 ramos principais, sub-ramos, palavras-chave curtas, relações nomeadas e uma legenda. Evite listas lineares disfarçadas de mapa.\n' : ''}${data.diagramas ? '- DIAGRAMAS: especifique nós, setas, relações, direção de leitura e uma versão textual equivalente. Quando útil, forneça código Mermaid válido e simples.\n' : ''}${data.ilustracoes ? '- ILUSTRAÇÕES: escreva briefings objetivos com cena, elementos, composição, enquadramento, estilo, paleta, diversidade e restrições. Não presuma que a imagem foi gerada.\n' : ''}${data.infograficos ? '- INFOGRÁFICOS: combine hierarquia, blocos informativos, ícones, números e percurso de leitura. Use somente informações presentes ou verificáveis.\n' : ''}${data.graficos ? '- GRÁFICOS: escolha o tipo adequado à comparação. Não fabrique dados. Se não houver dados reais, forneça apenas o modelo, os campos necessários e marque qualquer exemplo como ILUSTRATIVO.\n' : ''}${data.quadros ? '- QUADROS COMPARATIVOS: defina critérios consistentes, cabeçalhos claros e notas para exceções.\n' : ''}${data.linhas ? '- LINHAS DO TEMPO: inclua apenas datas verificáveis e diferencie ordem didática de cronologia histórica.\n' : ''}${data.icones ? '- ÍCONES: use um conjunto consistente com rótulos, sem substituir informação essencial somente por símbolos.\n' : ''}\nOrientações adicionais: ${text(data.orientacoes)}.\n\n6. SAÍDA E MARCAÇÕES TÉCNICAS\n- Escreva o material completo, não apenas um sumário.\n- Marque cada visual com blocos [VISUAL: tipo], [OBJETIVO], [CONTEÚDO], [INSTRUÇÃO GRÁFICA], [LEGENDA] e [TEXTO ALTERNATIVO].\n- Para diagramas Mermaid, use blocos de código separados. Para gráficos, entregue uma tabela de dados antes da especificação do gráfico.\n- Não declare que imagens ou gráficos foram renderizados se apenas descreveu sua produção.\n- Use unidades do SI e notação correta quando aplicável.\n\nPRODUZA AGORA O MATERIAL SOLICITADO.`;
}

function updateCompletion() {
  const data = dataObject();
  const required = ['disciplina','assunto','publico'];
  const optional = ['objetivo','referencias','orientacoes'];
  const score = required.filter(k => data[k]).length * 20 + optional.filter(k => data[k]).length * 8 + selectedResources(data).length * 2;
  document.querySelector('#completion').textContent = `${Math.min(100, score)}%`;
}
form.addEventListener('input', updateCompletion);

form.addEventListener('submit', event => {
  event.preventDefault();
  let valid = true;
  form.querySelectorAll('[required]').forEach(field => { const bad = !field.value.trim(); field.setAttribute('aria-invalid', String(bad)); if (bad) valid = false; });
  if (!valid) { form.querySelector('[aria-invalid=true]').focus(); return; }
  const settings = dataObject();
  currentPrompt = `${generatePrompt(settings)}\n\n7. PARÂMETROS DE PRODUÇÃO DIGITAL\n- Formato dos diagramas: ${settings.formatoDiagrama}.\n- Política de imagens por IA: ${settings.modoImagem}.\n- Quando houver Mermaid ou SVG, forneça também uma descrição textual acessível.\n- Não inclua chaves, credenciais ou dados pessoais em prompts de serviços externos.`;
  output.textContent = currentPrompt;
  output.hidden = false;
  previewFrame.hidden = true;
  currentPreviewHtml = '';
  resultModal.showModal();
  status.textContent = 'Prompt montado no navegador. Os dados só são enviados ao servidor ao solicitar a prévia HTML.';
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
    button.classList.add('copied');
    button.querySelector('.copy-icon').textContent = '✓';
    button.querySelector('.copy-label').textContent = 'Copiado!';
    status.textContent = 'Prompt copiado para a área de transferência.';
    notify('Prompt copiado com sucesso');
    setTimeout(() => { button.classList.remove('copied'); button.querySelector('.copy-icon').textContent = '⧉'; button.querySelector('.copy-label').textContent = 'Copiar prompt'; }, 2200);
  } catch { status.textContent = 'Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.'; }
});
document.querySelector('#export-txt').addEventListener('click', () => download('prompt-apostila.txt', currentPrompt, 'text/plain;charset=utf-8'));
document.querySelector('#export-json').addEventListener('click', () => download('projeto-apostila.json', JSON.stringify({ version: 2, createdAt: new Date().toISOString(), settings: dataObject(), prompt: currentPrompt }, null, 2), 'application/json'));
document.querySelector('#preview').addEventListener('click', async () => {
  status.textContent = 'Preparando prévia…';
  try {
    if (!currentPreviewHtml) {
      const response = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: dataObject().assunto, prompt: currentPrompt }) });
      if (!response.ok) throw new Error('Falha na prévia');
      currentPreviewHtml = (await response.json()).html;
    }
    previewFrame.srcdoc = currentPreviewHtml;
    previewFrame.hidden = false;
    output.hidden = true;
    status.textContent = 'Prévia HTML exibida no modal.';
  } catch { status.textContent = 'Não foi possível gerar a prévia. O prompt continua disponível.'; }
});

document.querySelector('#show-prompt').addEventListener('click', () => { previewFrame.hidden = true; output.hidden = false; status.textContent = 'Exibindo o prompt completo.'; });
document.querySelector('#close-modal').addEventListener('click', () => resultModal.close());
resultModal.addEventListener('click', event => { if (event.target === resultModal) resultModal.close(); });
document.querySelector('#export-pdf').addEventListener('click', async () => {
  status.textContent = 'Preparando versão para PDF…';
  try {
    if (!currentPreviewHtml) {
      const response = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: dataObject().assunto, prompt: currentPrompt }) });
      if (!response.ok) throw new Error('Falha no PDF');
      currentPreviewHtml = (await response.json()).html;
    }
    previewFrame.srcdoc = currentPreviewHtml;
    previewFrame.hidden = false;
    output.hidden = true;
    previewFrame.onload = () => { previewFrame.contentWindow.focus(); previewFrame.contentWindow.print(); status.textContent = 'Na janela de impressão, escolha “Salvar como PDF”.'; };
  } catch { status.textContent = 'Não foi possível preparar o PDF.'; }
});

updateCompletion();

document.querySelector('#save-draft').addEventListener('click', () => {
  localStorage.setItem('apostila-draft-v2', JSON.stringify(dataObject()));
  notify('Rascunho salvo neste navegador');
});

document.querySelector('#restore-draft').addEventListener('click', () => {
  const saved = localStorage.getItem('apostila-draft-v2');
  if (!saved) { notify('Nenhum rascunho salvo'); return; }
  try { applyData(JSON.parse(saved)); notify('Rascunho restaurado'); }
  catch { notify('O rascunho salvo não pôde ser lido'); }
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
    applyData(project.settings);
    notify('Projeto importado. Revise antes de gerar');
  } catch { notify('Projeto inválido. Use um JSON exportado pela plataforma'); }
  projectFile.value = '';
});
