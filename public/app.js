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

let aiAvailable = false;

async function checkAiAvailability() {
  const label = document.querySelector('#ai-availability');
  try {
    const response = await fetch('api/ai/status');
    const data = await response.json();
    aiAvailable = Boolean(data.available);
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
    'Ilustrações e esquemas servem de base para as questões (ex.: circuito para analisar, figura para completar).',
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
      ? `A saída esperada é UMA IMAGEM ÚNICA: uma página visual de ${data.tipo.toLowerCase()} sobre ${assunto}, em ${formato}.`
      : `A saída esperada é uma sequência de ${total} IMAGENS, uma por página, de ${data.tipo.toLowerCase()} sobre ${assunto}, em ${formato}. Gere UMA imagem por vez.`,
    `O estilo visual deve ser OBRIGATORIAMENTE: ${data.estiloVisual}. Não misture com outros estilos.`,
    `O tipo de material deve ser OBRIGATORIAMENTE: ${data.tipo}.`,
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
    `Tipo de material: ${data.tipo}`,
    `Formato da página: ${formato}`,
    `Total de páginas: ${total} ${total === 1 ? 'página' : 'páginas'}`,
    `Estilo de escrita: ${data.escrita}`,
    `Estilo visual: ${data.estiloVisual}`,
    `Paleta visual: ${data.paleta}`,
    ...extras,
    '',
    'MISSÃO',
    `${total === 1 ? 'Gerar a IMAGEM de uma página completa' : `Gerar ${total} páginas`} de ${data.tipo.toLowerCase()} sobre ${assunto}, no estilo ${data.estiloVisual}, ${total === 1 ? 'pronta' : 'prontas'} para impressão. Foco do material: ${profile.foco}.`,
    '',
    '1) DESCRIÇÃO DA IMAGEM (PRINCIPAL)',
    `Página didática de ${data.tipo.toLowerCase()} sobre "${assunto}" em ${disciplina}, no padrão de material educacional brasileiro.`,
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
    ...(typeLayouts[data.tipo] ? ['', `REGRA DE LAYOUT — ${data.tipo.toUpperCase()} (prevalece sobre qualquer outra instrução de layout)`, ...typeLayouts[data.tipo].map(rule => `- ${rule}`)] : []),
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
  const pages = Math.max(1, Number.parseInt(settings.paginas, 10) || 1);
  settings.extensao = `${pages} ${pages === 1 ? 'página' : 'páginas'}, no máximo`;
  if (settings.modoGeracao !== 'ai') {
    currentPrompt = generateImagePrompt(settings);
  } else {
  const deliveryInstruction = settings.formatoEntrega === 'pdf'
    ? `- Entregue UM ÚNICO ARQUIVO PDF FINAL, completo e pronto para download.\n- NÃO entregue HTML, arquivos Python (.py), scripts, notebooks, código-fonte ou instruções para gerar o PDF.\n- Use as ferramentas de criação de documentos disponíveis para produzir e anexar o PDF pronto.\n- Os mapas mentais, diagramas, infográficos, gráficos e ilustrações selecionados devem estar VISUALMENTE renderizados dentro do PDF, não apenas descritos.\n- Se imagens raster não estiverem disponíveis, crie ilustrações vetoriais e incorpore-as ao PDF.\n- Não responda apenas com texto: a entrega obrigatória é o arquivo .pdf final.`
    : `- Entregue UM ÚNICO arquivo HTML completo, autônomo e pronto para abrir no navegador.\n- Incorpore todo o CSS e todos os SVGs dentro do próprio HTML. Não crie arquivos auxiliares.\n- NÃO gere arquivos Python (.py), scripts de renderização, notebooks ou pacotes de projeto.\n- Os recursos selecionados devem aparecer VISUALMENTE no HTML, não apenas como descrição.\n- Se imagens raster não estiverem disponíveis, produza ilustrações vetoriais em SVG acessível dentro do HTML.\n- Não responda com uma explicação: entregue o HTML final completo em um único bloco de código.`;
  currentPrompt = `${generatePrompt(settings)}\n\n7. PARÂMETROS DE PRODUÇÃO DIGITAL\n- Formato dos diagramas: ${settings.formatoDiagrama}.\n- Política de imagens por IA: ${settings.modoImagem}.\n- Formato final selecionado: ${settings.formatoEntrega === 'pdf' ? 'PDF' : 'HTML'}.\n- Não inclua chaves, credenciais ou dados pessoais em prompts de serviços externos.\n\n8. FORMATO DE ENTREGA OBRIGATÓRIO\n${deliveryInstruction}`;
  if (settings.modoImagem === 'gerar') currentPrompt += '\n\n9. IMAGENS OBRIGATÓRIAS\n- Gere imagens reais com IA e incorpore-as visualmente ao material final, se a plataforma usada tiver ferramenta própria de geração de imagem.\n- Se a plataforma não tiver ferramenta de geração de imagem raster, produza ilustrações vetoriais em SVG acessível e renderizadas no próprio arquivo, seguindo a mesma especificação do briefing.\n- Não entregue prompts de imagem, descrições de produção, caixas vazias ou espaços reservados no lugar das imagens.\n- A entrega está incompleta se nenhum visual estiver de fato renderizado (raster ou vetorial) no arquivo final.\n- Disponibilize também as imagens geradas como arquivos PNG separados quando a plataforma permitir.';
  }
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
    const response = await fetch('api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: settings.assunto, format: settings.formatoEntrega, prompt: currentPrompt, generateImages: settings.modoImagem === 'gerar', imageCount }) });
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
      const response = await fetch('api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: dataObject().assunto, prompt: currentPrompt }) });
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
    const response = await fetch('api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: dataObject().assunto || 'Prompt GeradorOne', prompt: currentPrompt }) });
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
    const response = await fetch('api/ai/config');
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
    const response = await fetch('api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    const response = await fetch('api/ai/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearApiKey: true }) });
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
const improveModal = document.querySelector('#improve-modal');
const improveForm = document.querySelector('#improve-form');
const improveStatus = document.querySelector('#improve-status');
document.querySelector('#improve-options').innerHTML = improveAdjustments.map(([label], index) => `<label class="improve-chip"><input type="checkbox" name="adjust" value="${index}"><span>${label}</span></label>`).join('');

document.querySelector('#improve-open').addEventListener('click', () => {
  improveForm.reset();
  improveStatus.textContent = '';
  document.querySelector('#improve-mode').textContent = aiAvailable
    ? 'A IA configurada no servidor vai reescrever o prompt aplicando os ajustes.'
    : 'IA não configurada: os ajustes serão anexados ao fim do prompt. Configure a chave em "Config API IA" para a IA reescrever o prompt.';
  improveModal.showModal();
});
['#improve-close', '#improve-cancel'].forEach(selector => document.querySelector(selector).addEventListener('click', () => improveModal.close()));

function showPrompt(prompt) {
  currentPrompt = prompt;
  currentPreviewHtml = '';
  output.textContent = prompt;
  output.hidden = false;
  previewFrame.hidden = true;
}

improveForm.addEventListener('submit', async event => {
  event.preventDefault();
  const adjustments = [...improveForm.querySelectorAll('[name=adjust]:checked')].map(box => improveAdjustments[Number(box.value)][1]);
  const instruction = document.querySelector('#improve-instruction').value.trim();
  if (!adjustments.length && !instruction) { improveStatus.textContent = 'Escolha ao menos um ajuste ou escreva uma instrução.'; return; }
  if (!aiAvailable) {
    showPrompt(`${currentPrompt}\n\nAJUSTES SOLICITADOS\n${[...adjustments, instruction].filter(Boolean).map(item => `- ${item}`).join('\n')}`);
    improveModal.close();
    notify('Ajustes anexados ao prompt');
    return;
  }
  const apply = document.querySelector('#improve-apply');
  apply.disabled = true;
  improveStatus.textContent = 'A IA está reescrevendo o prompt…';
  try {
    const response = await fetch('api/improve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: currentPrompt, adjustments, instruction }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível melhorar o prompt.');
    showPrompt(result.prompt);
    improveModal.close();
    status.textContent = `Prompt melhorado com ${result.model}.`;
    notify('Prompt melhorado com IA');
  } catch (error) {
    improveStatus.textContent = error.message;
  } finally {
    apply.disabled = false;
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
