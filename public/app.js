const styles = [
  ['Cartoon','Traço amigável e expressivo'],['Hand-drawn','Aparência desenhada à mão'],['Doodle','Rabiscos leves e criativos'],['Cartoon Educacional','Cartoon com foco pedagógico'],['Scientific Illustration','Precisão científica'],['Futuristic Digital','Visual digital moderno'],['Infográfico Moderno','Blocos, ícones e dados'],['Minimalista','Poucos elementos, muito ar'],['3D Educacional','Volumes suaves em 3D'],['Realista','Aparência fotográfica'],['Livro Didático','Padrão editorial clássico'],['Colorido Infantil','Cores vivas para crianças']
];
const resources = [
  ['mapasMentais','◉','Mapas mentais','Síntese radial e conexões'],['diagramas','◇','Diagramas','Processos, relações e fluxos'],['ilustracoes','✦','Ilustrações','Conceitos, cenas e objetos'],['infograficos','▦','Infográficos','Dados e explicações visuais'],['graficos','⌁','Gráficos','Somente com dados verificáveis'],['quadros','▤','Quadros comparativos','Contrastes e classificações'],['linhas','↝','Linhas do tempo','Eventos em sequência'],['icones','⬡','Ícones e sinalização','Navegação e destaques']
];

const themeButton = document.querySelector('#theme-toggle');
const preferredTheme = localStorage.getItem('apostila-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const sunIcon = '<svg class="icon-svg" viewBox="0 0 20 20" width="17" height="17"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 2v2.2M10 15.8V18M18 10h-2.2M4.2 10H2M15.6 4.4l-1.5 1.5M5.9 14.1l-1.5 1.5M15.6 15.6l-1.5-1.5M5.9 5.9 4.4 4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const moonIcon = '<svg class="icon-svg" viewBox="0 0 20 20" width="17" height="17"><path d="M16 12.2A7 7 0 1 1 7.8 4a5.6 5.6 0 0 0 8.2 8.2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  themeButton.querySelector('.icon-slot').innerHTML = theme === 'dark' ? sunIcon : moonIcon;
  localStorage.setItem('apostila-theme', theme);
}
setTheme(preferredTheme);
themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

const styleContainer = document.querySelector('#style-options');
const styleSamples = ['● ᴗ ●','╱╲〰','✎ ✦ ☁','● ABC ✦','⌬ ⌖ ◌','◈ 01 ◈','▦ ↑ 72','— ○ —','◒ ◉ ◐','▣ ◉ ▣','Aa § 01','★ ● ▲'];
styles.forEach(([name, description], index) => styleContainer.insertAdjacentHTML('beforeend', `<div class="option"><input type="radio" name="estiloVisual" id="style-${index}" value="${name}" ${name === 'Livro Didático' ? 'checked' : ''}><label for="style-${index}"><span class="style-sample sample-${index}" aria-hidden="true">${styleSamples[index]}</span><strong>${name}</strong><small>${description}</small></label></div>`));
const resourceContainer = document.querySelector('#resource-options');
const visualSamples = {
  mapasMentais:'<img class="resource-icon" src="assets/icons/mapa-mental.png" alt="" width="56" height="56">',
  diagramas:'<svg class="resource-icon" viewBox="0 0 160 224" width="56" height="56" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><rect x="24" y="8" width="112" height="34" rx="10"/><path d="M34 25h70M112 25h14"/><path d="M80 42v16"/><rect x="48" y="58" width="64" height="26" rx="13"/><path d="M80 84v16"/><path d="M80 100 116 130 80 160 44 130Z"/><path d="M44 130 34 150M116 130 126 150"/><rect x="6" y="150" width="56" height="30" rx="10"/><path d="M16 165h26M58 165h4"/><rect x="98" y="150" width="56" height="30" rx="10"/><path d="M108 165h26M150 165h4"/><path d="M34 180 60 200M126 180 100 200"/><rect x="48" y="192" width="64" height="26" rx="13"/></svg>',
  ilustracoes:'<img class="resource-icon" src="assets/icons/ilustracoes.png" alt="" width="56" height="56">',
  infograficos:'<img class="resource-icon" src="assets/icons/infograficos.png" alt="" width="56" height="56">',
  graficos:'<img class="resource-icon" src="assets/icons/graficos.png" alt="" width="56" height="56">',
  quadros:'<img class="resource-icon" src="assets/icons/quadros.png" alt="" width="56" height="56">',
  linhas:'<img class="resource-icon" src="assets/icons/linhas.png" alt="" width="56" height="56">',
  icones:'<img class="resource-icon" src="assets/icons/icones.png" alt="" width="56" height="56">'
};
resources.forEach(([name, icon, title, description]) => resourceContainer.insertAdjacentHTML('beforeend', `<div class="resource"><input type="checkbox" name="${name}" id="${name}"><label for="${name}"><span class="resource-demo" aria-hidden="true">${visualSamples[name] || icon}</span><strong>${title}</strong><small>${description}</small></label></div>`));

const form = document.querySelector('#formulario');
const output = document.querySelector('#prompt-output');
const resultModal = document.querySelector('#result-modal');
const previewFrame = document.querySelector('#preview-frame');
const generatedFiles = document.querySelector('#generated-files');
const status = document.querySelector('#status');
const toast = document.querySelector('#toast');
let currentPrompt = '';
let currentPreviewHtml = '';
let toastTimer;
let workflowStage = 1;
let currentFiles = [];

function updateGenerationMode() {
  const ai = form.elements.modoGeracao.value === 'ai';
  document.querySelector('.generate-label').textContent = ai ? 'Gerar material com IA' : 'Gerar prompt completo';
}

async function checkAiAvailability() {
  const label = document.querySelector('#ai-availability');
  try {
    const response = await fetch('/api/ai/status');
    const data = await response.json();
    label.textContent = data.available ? `IA disponível no servidor · ${data.provider} · ${data.model}` : 'IA não configurada no servidor; o modo prompt continua disponível.';
    label.className = `field-status ${data.available ? 'available' : 'unavailable'}`;
  } catch {
    label.textContent = 'Não foi possível verificar a IA.';
    label.className = 'field-status unavailable';
  }
}

function setWorkflowStage(stage, formPercent = 100) {
  workflowStage = Math.max(workflowStage, stage);
  const progress = document.querySelector('#workflow-progress');
  const width = workflowStage === 1 ? Math.min(33, formPercent * .33) : workflowStage === 2 ? 66 : 100;
  progress.style.setProperty('--progress', `${width}%`);
  progress.querySelectorAll('li').forEach(item => {
    const number = Number(item.dataset.step);
    item.classList.toggle('complete', number < workflowStage);
    item.classList.toggle('active', number === workflowStage);
    if (number === workflowStage) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
  });
}

function updateResourceSummary() {
  const count = resources.filter(([name]) => form.elements.namedItem(name)?.checked).length;
  document.querySelector('#resource-summary').textContent = count ? `${count} recurso${count > 1 ? 's' : ''} selecionado${count > 1 ? 's' : ''}` : 'Escolha os recursos';
  document.querySelectorAll('[data-resource]').forEach(element => {
    const field = form.elements.namedItem(element.dataset.resource);
    element.classList.toggle('active', Boolean(field?.checked));
  });
}

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
  const percent = Math.min(100, score);
  document.querySelector('#completion').textContent = `${percent}%`;
  document.querySelector('#completion-ring').style.setProperty('--pct', percent);
  updateResourceSummary();
  if (workflowStage === 1) setWorkflowStage(1, Math.min(100, score));
}
form.addEventListener('input', () => { updateCompletion(); updateGenerationMode(); });
document.querySelector('#select-all-resources').addEventListener('click', () => { resources.forEach(([name]) => { form.elements.namedItem(name).checked = true; }); updateCompletion(); });
document.querySelector('#clear-resources').addEventListener('click', () => { resources.forEach(([name]) => { form.elements.namedItem(name).checked = false; }); updateCompletion(); });

form.addEventListener('submit', async event => {
  event.preventDefault();
  let valid = true;
  form.querySelectorAll('[required]').forEach(field => { const bad = !field.value.trim(); field.setAttribute('aria-invalid', String(bad)); if (bad) valid = false; });
  if (!valid) { form.querySelector('[aria-invalid=true]').focus(); return; }
  const settings = dataObject();
  const deliveryInstruction = settings.formatoEntrega === 'pdf'
    ? `- Entregue UM ÚNICO ARQUIVO PDF FINAL, completo e pronto para download.\n- NÃO entregue HTML, arquivos Python (.py), scripts, notebooks, código-fonte ou instruções para gerar o PDF.\n- Use as ferramentas de criação de documentos disponíveis para produzir e anexar o PDF pronto.\n- Os mapas mentais, diagramas, infográficos, gráficos e ilustrações selecionados devem estar VISUALMENTE renderizados dentro do PDF, não apenas descritos.\n- Se imagens raster não estiverem disponíveis, crie ilustrações vetoriais e incorpore-as ao PDF.\n- Não responda apenas com texto: a entrega obrigatória é o arquivo .pdf final.`
    : `- Entregue UM ÚNICO arquivo HTML completo, autônomo e pronto para abrir no navegador.\n- Incorpore todo o CSS e todos os SVGs dentro do próprio HTML. Não crie arquivos auxiliares.\n- NÃO gere arquivos Python (.py), scripts de renderização, notebooks ou pacotes de projeto.\n- Os recursos selecionados devem aparecer VISUALMENTE no HTML, não apenas como descrição.\n- Se imagens raster não estiverem disponíveis, produza ilustrações vetoriais em SVG acessível dentro do HTML.\n- Não responda com uma explicação: entregue o HTML final completo em um único bloco de código.`;
  currentPrompt = `${generatePrompt(settings)}\n\n7. PARÂMETROS DE PRODUÇÃO DIGITAL\n- Formato dos diagramas: ${settings.formatoDiagrama}.\n- Política de imagens por IA: ${settings.modoImagem}.\n- Formato final selecionado: ${settings.formatoEntrega === 'pdf' ? 'PDF' : 'HTML'}.\n- Não inclua chaves, credenciais ou dados pessoais em prompts de serviços externos.\n\n8. FORMATO DE ENTREGA OBRIGATÓRIO\n${deliveryInstruction}`;
  if (settings.modoImagem === 'gerar') currentPrompt += '\n\n9. IMAGENS OBRIGATÓRIAS\n- Gere imagens reais com IA e incorpore-as visualmente ao material final, se a plataforma usada tiver ferramenta própria de geração de imagem.\n- Se a plataforma não tiver ferramenta de geração de imagem raster, produza ilustrações vetoriais em SVG acessível e renderizadas no próprio arquivo, seguindo a mesma especificação do briefing.\n- Não entregue prompts de imagem, descrições de produção, caixas vazias ou espaços reservados no lugar das imagens.\n- A entrega está incompleta se nenhum visual estiver de fato renderizado (raster ou vetorial) no arquivo final.\n- Disponibilize também as imagens geradas como arquivos PNG separados quando a plataforma permitir.';
  const aiMode = settings.modoGeracao === 'ai';
  document.querySelector('#result-title').textContent = aiMode ? 'Material gerado com IA' : 'Prompt da apostila';
  document.querySelector('.result-actions').hidden = aiMode;
  output.textContent = currentPrompt;
  output.hidden = aiMode;
  previewFrame.hidden = true;
  generatedFiles.hidden = !aiMode;
  currentPreviewHtml = '';
  currentFiles = [];
  setWorkflowStage(2);
  resultModal.showModal();
  if (!aiMode) {
    status.textContent = 'Prompt montado no navegador. Os dados só são enviados ao servidor ao solicitar a prévia HTML.';
    return;
  }
  generatedFiles.innerHTML = '<div class="ai-loading"><span class="ai-spinner" aria-hidden="true"></span><strong>Produzindo o material…</strong><span>Esta etapa pode levar alguns minutos. Não feche esta janela.</span></div>';
  status.textContent = 'A IA está criando e finalizando o arquivo solicitado.';
  const button = document.querySelector('#generate-button');
  const label = button.querySelector('.generate-label');
  const originalLabel = label.textContent;
  button.disabled = true;
  label.innerHTML = '<span class="button-spinner" aria-hidden="true"></span>Gerando…';
  try {
    const imageCount = settings.frequencia.startsWith('Intensa') ? 3 : settings.frequencia.startsWith('Equilibrada') ? 2 : 1;
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: settings.assunto, format: settings.formatoEntrega, prompt: currentPrompt, generateImages: settings.modoImagem === 'gerar', imageCount }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o material.');
    currentFiles = result.files || [];
    renderGeneratedFiles();
    setWorkflowStage(3);
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
    setWorkflowStage(3);
    status.textContent = 'Prompt copiado para a área de transferência.';
    notify('Prompt copiado com sucesso');
    setTimeout(() => { button.classList.remove('copied'); copyIcon.innerHTML = defaultIconHtml; button.querySelector('.copy-label').textContent = 'Copiar prompt'; }, 2200);
  } catch { status.textContent = 'Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.'; }
});
document.querySelector('#export-txt').addEventListener('click', () => { download('prompt-apostila.txt', currentPrompt, 'text/plain;charset=utf-8'); setWorkflowStage(3); notify('Arquivo TXT preparado'); });
document.querySelector('#export-json').addEventListener('click', () => { download('projeto-apostila.json', JSON.stringify({ version: 2, createdAt: new Date().toISOString(), settings: dataObject(), prompt: currentPrompt }, null, 2), 'application/json'); setWorkflowStage(3); notify('Projeto JSON preparado'); });
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
  setWorkflowStage(3);
  status.textContent = 'Gerando arquivo PDF…';
  try {
    const response = await fetch('/api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: dataObject().assunto || 'Prompt GeradorOne', prompt: currentPrompt }) });
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

updateCompletion();
updateGenerationMode();
checkAiAvailability();

const aiConfigModal = document.querySelector('#ai-config-modal');
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
    const response = await fetch('/api/ai/config');
    const data = await response.json();
    const providerLabel = data.provider === 'gemini' ? 'Gemini' : 'OpenAI';
    aiConfigCurrent.textContent = data.hasApiKey ? `Chave configurada · ${providerLabel} · modelo ${data.model}` : `Nenhuma chave configurada (${providerLabel}).`;
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

document.querySelector('#ai-config-open').addEventListener('click', () => { aiConfigStatus.textContent = ''; loadAiConfig(); aiConfigModal.showModal(); });
document.querySelector('#ai-config-close').addEventListener('click', () => aiConfigModal.close());
aiConfigModal.addEventListener('click', event => { if (event.target === aiConfigModal) aiConfigModal.close(); });

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
    const response = await fetch('/api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    const response = await fetch('/api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearApiKey: true }) });
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
