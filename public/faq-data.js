// Perguntas e respostas da tela FAQ. Texto puro: parágrafos separados por linha em branco,
// listas com "- " e passos com "1. ". Ao mudar um rótulo ou fluxo do app, atualize aqui junto.
const FAQ_ITEMS = [
  // ---------- Primeiros passos ----------
  {
    categoria: 'Primeiros passos',
    pergunta: 'O que é o GeradorOne?',
    resposta: 'Um aplicativo web que gera prompts de imagem para apostilas e capas didáticas. Você descreve o material (disciplina, assunto, público, estilo visual) e o app monta um briefing completo para colar na sua ferramenta de IA.\n\nSe quiser, a sua própria chave de IA pode produzir o material pronto, em PDF ou HTML.'
  },
  {
    categoria: 'Primeiros passos',
    pergunta: 'Preciso pagar para usar?',
    resposta: 'Por enquanto não. O uso é gratuito, em fase de testes das funcionalidades. Está prevista uma assinatura mensal no futuro, sem data nem valor definidos.\n\nSe você usar a sua própria chave de IA, o custo das gerações com IA é cobrado pelo provedor, na sua conta (veja a categoria "IA e chave").'
  },
  {
    categoria: 'Primeiros passos',
    pergunta: 'O GeradorOne é código aberto?',
    resposta: 'Sim. O código-fonte é público em https://github.com/Epaminondaslage/geradorOne, sob a licença AGPL-3.0.\n\nVocê pode ler, usar e modificar o código. Quem oferecer uma versão modificada como serviço na internet precisa disponibilizar o código-fonte dessa versão, com a mesma licença. É um resumo: vale o texto completo, que está no arquivo LICENSE do repositório.'
  },
  {
    categoria: 'Primeiros passos',
    pergunta: 'Por onde eu começo?',
    resposta: '1. Abra "Apostila" ou "Capa" no menu.\n2. Preencha os campos com * (são os obrigatórios).\n3. Escolha o estilo das ilustrações, a paleta e o formato.\n4. Clique em "Gerar prompt completo" (Apostila) ou "Gerar prompt da capa" (Capa).\n5. No painel "Resultado", clique em "Copiar" e cole o prompt na sua ferramenta de IA de imagens.'
  },
  {
    categoria: 'Primeiros passos',
    pergunta: 'Qual a diferença entre gerar só o prompt e gerar o material com IA?',
    resposta: '- Só o prompt: o app monta o briefing e você o usa onde quiser. Funciona sem chave de IA e sem custo adicional.\n- Material com IA: o servidor usa a sua chave para produzir o material pronto (PDF ou HTML), com as imagens. Exige chave cadastrada em "Minha chave de IA" e é cobrado pelo provedor.\n\nO bloco "Gerar o material com IA" aparece na tela de Apostila.'
  },

  // ---------- Conta e acesso ----------
  {
    categoria: 'Conta e acesso',
    pergunta: 'Como crio minha conta?',
    resposta: '1. Na tela de entrada, clique em "Criar conta".\n2. Informe nome, e-mail e senha (mínimo de 8 caracteres) e repita a senha.\n3. Clique em "Enviar código". Você recebe um código de 6 dígitos por e-mail.\n4. Digite o código em até 10 minutos (são 5 tentativas). A conta é criada e você já entra no app.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Não vejo o link "Criar conta". O que fazer?',
    resposta: 'O link só aparece quando o administrador ativou o envio de e-mail do sistema. Sem ele, a tela de entrada mostra "Sem acesso? Peça ao administrador da sua escola para criar o seu usuário."\n\nPeça ao administrador para criar o seu usuário.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Não recebi o código por e-mail.',
    resposta: '- Procure na caixa de spam ou lixo eletrônico.\n- Confira se digitou o e-mail certo. Se precisar, volte e refaça o cadastro: um novo pedido gera um novo código.\n- Se esse e-mail já tem conta, o app não envia código de cadastro (e não avisa, por segurança). Nesse caso entre normalmente ou use "Esqueci a senha".\n- Depois de muitos pedidos seguidos, o app pede para aguardar 15 minutos.\n\nO código vale por 10 minutos.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Esqueci minha senha. Como recupero?',
    resposta: '1. Na tela de entrada, clique em "Esqueci a senha".\n2. Informe o e-mail e a nova senha.\n3. Digite o código de 6 dígitos que chegou por e-mail (vale 10 minutos).\n\nSe o link "Esqueci a senha" não aparece, o envio de e-mail está desligado: peça ao administrador para redefinir a sua senha.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Como troco minha senha?',
    resposta: 'Abra "Minha conta", vá em "Trocar senha", informe a senha atual, a nova senha (mínimo de 8 caracteres) e repita a nova senha. Depois clique em "Trocar senha".\n\nAs sessões antigas são encerradas ao trocar a senha.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Como altero meu nome, telefone ou e-mail?',
    resposta: 'Em "Minha conta", no bloco "Perfil", você edita o nome completo e o telefone e clica em "Salvar perfil".\n\nO e-mail aparece bloqueado para edição. Para trocá-lo, peça ao administrador.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Por que o app pede o meu telefone?',
    resposta: 'O telefone faz parte do cadastro do usuário. Quem cria a conta sozinho pode completá-lo depois: se estiver faltando, o app leva você para "Minha conta" para preenchê-lo. Use DDD + número, por exemplo (35) 99999-8888.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Quanto tempo fico conectado?',
    resposta: 'A sessão dura 7 dias. Ela é encerrada antes se você trocar a senha, se o administrador mudar o seu perfil ou e-mail, ou se a sua conta for desativada. Para sair na hora, use "Sair" no menu.'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'O app bloqueou meu login depois de algumas tentativas.',
    resposta: 'Depois de 8 tentativas erradas, o login fica bloqueado por 15 minutos, para proteger a conta. Aguarde e tente de novo. Se não lembra a senha, use "Esqueci a senha".'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Como baixo todos os meus dados?',
    resposta: '1. Abra "Minha conta".\n2. No bloco "Exportar meus dados", clique em "Baixar meus dados (JSON)".\n\nO arquivo traz os dados da sua conta (nome, e-mail, telefone, perfil e tema), as suas preferências de IA (provedor, modelos e se há chave salva), todos os seus projetos, com configurações e prompts, e as mensagens que você enviou ao suporte. A senha e o valor da chave de IA não entram no arquivo.\n\nO app não importa esse arquivo inteiro de volta. O botão "Importar arquivo JSON", em "Meus projetos", aceita um projeto por arquivo, exportado pelo botão "JSON" do painel "Resultado".'
  },
  {
    categoria: 'Conta e acesso',
    pergunta: 'Como excluo minha conta?',
    resposta: '1. Se quiser guardar os seus dados, baixe-os antes em "Minha conta", no bloco "Exportar meus dados".\n2. No mesmo lugar, vá até "Excluir minha conta".\n3. Digite a sua senha atual e clique em "Excluir minha conta". O botão muda para "Confirmar exclusão": clique de novo em até 5 segundos.\n\nA exclusão apaga a conta, todos os seus projetos e a sua chave de IA salva, e não dá para desfazer. Você sai do app na hora. Os dados saem do banco imediatamente; as cópias de segurança do banco são apagadas depois de 14 dias, e só então a sua conta some delas também.\n\nSe você é o único administrador ativo, o app não deixa excluir: antes, em "Usuários", torne outro usuário administrador. Se esqueceu a senha, use "Esqueci a senha" ou peça ao administrador para excluir a conta.'
  },

  // ---------- Apostila ----------
  {
    categoria: 'Apostila',
    pergunta: 'O que preciso preencher para gerar uma apostila?',
    resposta: 'Só três campos são obrigatórios, marcados com *:\n\n- Disciplina\n- Assunto principal\n- Público / faixa etária (escolha na lista; começa em "Selecione" e o prompt não é gerado sem escolher)\n\nTodo o resto tem um valor inicial ou é opcional. Uma faixa no fim do formulário mostra quanto já está preenchido.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'O que significam Profundidade e Estilo de escrita?',
    resposta: '- Profundidade define até onde o conteúdo vai: Introdutório, Básico, Intermediário (padrão), Avançado ou Completo.\n- Estilo de escrita define o tom do texto: Didático (padrão), Acadêmico, Conversacional, Objetivo, Lúdico ou Técnico.\n\nO campo "Objetivo de aprendizagem" é livre e opcional: descreva o que o aluno deve saber ao final.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Quantas páginas posso pedir?',
    resposta: 'De 1 a 12, nas opções 1, 2, 3, 4, 5, 6, 8, 10 e 12 páginas. O padrão é 1 página.\n\nCada página vira uma imagem. Com mais de uma página, o prompt traz o plano do material e pede uma página por vez.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Quais são os tipos de material?',
    resposta: 'São 13 tipos: Apostila didática (padrão), Material preparatório, Caderno de atividades, Resumo visual, Material para concurso, Guia do professor, Material de revisão, Material complementar, Guia de estudos, Mapa mental, Material profissional, Sequência didática e Outro.\n\nO tipo muda a estrutura da página, não o assunto.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Como escolho o estilo das ilustrações e as cores?',
    resposta: 'O estilo define o traço e o acabamento; as cores ficam em "Paleta", logo abaixo.\n\n- Estilos (12): Cartoon, Hand-drawn, Doodle, Cartoon Educacional, Scientific Illustration, Futuristic Digital, Infográfico Moderno, Minimalista, 3D Educacional, Realista, Livro Didático (padrão) e Colorido Infantil. Cada um tem uma miniatura de exemplo.\n- Paleta: Automática (padrão), Azul e turquesa, Terrosa e acolhedora, Vibrante infantil, Monocromática ou Alto contraste.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'O que é o "Formato prioritário"?',
    resposta: 'Diz para onde o material vai: Impressão A4 (padrão), Tela e impressão, Somente tela ou Apresentação 16:9. O prompt leva essa escolha em conta.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Como funcionam os códigos da BNCC?',
    resposta: '- "Códigos da BNCC (opcional)": digite os códigos ou use o botão "Escolher habilidades da BNCC" (veja a categoria "BNCC"). O app confere cada código na base de habilidades e avisa se algum não existir.\n- Os códigos reconhecidos entram no prompt junto com o texto oficial da habilidade. Códigos que o app não encontra entram marcados como "não encontrados", para a IA não tratá-los como válidos.\n- "Sugerir habilidades da BNCC": quando marcado, a IA só sugere habilidades se houver correspondência verificável.\n\nO GeradorOne não inventa códigos e instrui a IA a fazer o mesmo, mas a conferência final no documento oficial é sempre sua.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Para que serve o campo de texto ou material de referência?',
    resposta: 'Para colar definições, trechos, fontes ou observações obrigatórias que a IA deve respeitar. O app instrui a IA a não inventar códigos, fontes, normas ou dados fora do que você forneceu.\n\nNão inclua dados pessoais sensíveis nesse campo.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'O que são os recursos visuais?',
    resposta: 'São os tipos de elementos gráficos que o material pode ter: Mapas mentais, Diagramas, Ilustrações, Infográficos, Gráficos, Quadros comparativos, Linhas do tempo e Ícones e sinalização.\n\nAs opções começam desmarcadas: marque só as que quiser, ou use "Selecionar todos" e "Limpar seleção". Os gráficos usam apenas dados verificáveis.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Como ajusto a quantidade de elementos visuais e de texto?',
    resposta: '- Frequência visual: Essencial (1 por seção), Equilibrada (2 a 3 por seção, padrão) ou Intensa (4 ou mais por seção).\n- Profundidade visual: Simples, Detalhada (padrão) ou Avançada.\n- Densidade do texto: Enxuta, Equilibrada (padrão) ou Completa.\n\nHá ainda "Orientações visuais adicionais", um campo livre para pedidos específicos.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Em que formato saem os diagramas?',
    resposta: 'Em "Formato dos diagramas" você escolhe entre Mermaid + descrição textual (padrão), SVG editável + descrição textual ou Somente especificação visual.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'O que faz a opção "Imagens por IA"?',
    resposta: 'Define se o material com IA inclui imagens: "Gerar imagens reais e incorporar" (padrão) ou "Não usar imagens geradas por IA".\n\nNo modo com IA, as imagens são criadas e inseridas no HTML ou PDF, sem espaços reservados, e também ficam disponíveis como arquivos PNG separados. A frequência visual controla quantas imagens saem, de uma a três por material.'
  },
  {
    categoria: 'Apostila',
    pergunta: 'Como limpo o formulário e recomeço?',
    resposta: 'Clique em "Limpar formulário", ao lado do botão de gerar. Se você já salvou o projeto, ele continua em "Meus projetos"; só o que está na tela é zerado.'
  },

  // ---------- BNCC ----------
  {
    categoria: 'BNCC',
    pergunta: 'O que é a BNCC?',
    resposta: 'A Base Nacional Comum Curricular (BNCC) é o documento nacional que define o que os estudantes da Educação Básica devem aprender. Duas resoluções do Conselho Nacional de Educação (CNE) a instituíram:\n\n- Resolução CNE/CP nº 2, de 22 de dezembro de 2017, para a Educação Infantil e o Ensino Fundamental. Segundo a ementa, ela "institui e orienta a implantação da Base Nacional Comum Curricular, a ser respeitada obrigatoriamente ao longo das etapas e respectivas modalidades no âmbito da Educação Básica".\n- Resolução CNE/CP nº 4, de 17 de dezembro de 2018, para o Ensino Médio.\n\nA base legal é a LDB (Lei nº 9.394/1996), cujo art. 26 determina que os currículos da educação básica tenham uma base nacional comum.\n\nFontes: https://www.gov.br/mec/pt-br/cne/pdf/resolucoes-do-cne/cp/2017/rcp002_17.pdf, https://www.gov.br/mec/pt-br/cne/pdf/resolucoes-do-cne/cp/2018/rcp004_18.pdf e https://www.planalto.gov.br/ccivil_03/leis/l9394.htm'
  },
  {
    categoria: 'BNCC',
    pergunta: 'O que é uma habilidade da BNCC?',
    resposta: 'É uma das aprendizagens que a BNCC espera dos estudantes, escrita como uma ação. Exemplo, a habilidade EF06MA01 (Matemática, 6º ano): "Comparar, ordenar, ler e escrever números naturais e números racionais cuja representação decimal é finita, fazendo uso da reta numérica."\n\nNo Ensino Fundamental e no Ensino Médio, essas aprendizagens se chamam habilidades. Na Educação Infantil, são objetivos de aprendizagem e desenvolvimento. Cada uma tem um código próprio.\n\nO conjunto que o GeradorOne usa tem 1.721 aprendizagens: 93 da Educação Infantil, 1.304 do Ensino Fundamental, 183 do Ensino Médio e 141 do complemento de Computação.'
  },
  {
    categoria: 'BNCC',
    pergunta: 'Como leio o código de uma habilidade?',
    resposta: 'O código junta a etapa, o recorte, o componente e o número de ordem:\n\n- EF67LP08: EF é o Ensino Fundamental, 67 indica 6º e 7º anos, LP é Língua Portuguesa e 08 é o número de ordem.\n- EF06MA01: EF, 06 é o 6º ano, MA é Matemática, 01 é o número de ordem.\n- EI02TS01: EI é a Educação Infantil, 02 é o grupo de crianças bem pequenas (01 são bebês, 03 são crianças pequenas), TS é o campo de experiências "Traços, sons, cores e formas" e 01 é o número de ordem.\n- EM13LGG103: EM é o Ensino Médio, 13 indica que não há divisão por ano, LGG é a área Linguagens e suas Tecnologias, 1 é a competência específica e 03 completa o número.\n\nNo Ensino Fundamental, as siglas dos componentes são AR (Arte), CI (Ciências), EF (Educação Física), ER (Ensino Religioso), GE (Geografia), HI (História), LI (Língua Inglesa), LP (Língua Portuguesa) e MA (Matemática). Computação usa CO.\n\nDois cuidados: a sigla EF aparece como etapa e como Educação Física, e o número de ordem não indica a ordem em que ensinar.\n\nFonte: descrição dos códigos no modelo de dados do projeto bncc.dev, https://github.com/bncc-dev/bncc-dados'
  },
  {
    categoria: 'BNCC',
    pergunta: 'Onde a BNCC se aplica?',
    resposta: 'Nas três etapas da Educação Básica:\n\n- Educação Infantil, organizada em três grupos de crianças: bebês (0 a 1 ano e 6 meses), crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses) e crianças pequenas (4 anos a 5 anos e 11 meses).\n- Ensino Fundamental, do 1º ao 9º ano. Algumas habilidades valem para um bloco de anos, como as de 6º e 7º anos.\n- Ensino Médio, que não tem divisão por ano na BNCC. A seriação fica com os currículos.\n\nA Resolução CNE/CP nº 2/2017 diz que a BNCC deve ser respeitada ao longo das etapas e modalidades da Educação Básica. O dataset que o GeradorOne usa trata a Educação de Jovens e Adultos como modalidade que atravessa o Ensino Fundamental e o Ensino Médio.\n\nA BNCC é uma referência nacional. O currículo da sua rede de ensino ou da sua escola pode detalhar e organizar essas aprendizagens, então confira também a orientação local.'
  },
  {
    categoria: 'BNCC',
    pergunta: 'O que é o complemento de Computação da BNCC?',
    resposta: 'São as normas sobre Computação na Educação Básica, que complementam a BNCC. Vêm do Parecer CNE/CEB nº 2/2022 (aprovado em 17 de fevereiro de 2022) e da Resolução CNE/CEB nº 1, de 4 de outubro de 2022.\n\nSão 141 aprendizagens, com a sigla CO no código, como EF01CO01 ("Organizar objetos físicos ou digitais considerando diferentes características para esta organização, explicitando semelhanças (padrões) e diferenças."). No seletor do GeradorOne, Computação aparece como um componente de cada etapa.\n\nFontes: https://www.gov.br/mec/pt-br/cne/pdf/pareceres-do-cne/ceb/2022/pceb002_22.pdf e https://www.gov.br/mec/pt-br/cne/pdf/resolucoes-do-cne/ceb/2022/rceb001_22.pdf'
  },
  {
    categoria: 'BNCC',
    pergunta: 'Onde encontro o texto oficial da BNCC?',
    resposta: 'No site oficial da BNCC, do Ministério da Educação (MEC): https://basenacionalcomum.mec.gov.br/\n\nOs atos que a instituem ficam no site do Conselho Nacional de Educação:\n\n- Parecer CNE/CP nº 15/2017 (Educação Infantil e Ensino Fundamental): https://www.gov.br/mec/pt-br/cne/pdf/pareceres-do-cne/cp/2017/pcp015_17.pdf\n- Resolução CNE/CP nº 2/2017: https://www.gov.br/mec/pt-br/cne/pdf/resolucoes-do-cne/cp/2017/rcp002_17.pdf\n- Resolução CNE/CP nº 4/2018 (Ensino Médio): https://www.gov.br/mec/pt-br/cne/pdf/resolucoes-do-cne/cp/2018/rcp004_18.pdf\n- Parecer CNE/CEB nº 2/2022 (Computação): https://www.gov.br/mec/pt-br/cne/pdf/pareceres-do-cne/ceb/2022/pceb002_22.pdf\n\nO texto oficial é a referência final. Use a cópia do GeradorOne para escolher as habilidades e confira no documento do MEC antes de publicar um material.'
  },
  {
    categoria: 'BNCC',
    pergunta: 'De onde o GeradorOne tira as habilidades da BNCC?',
    resposta: 'De uma cópia do dataset aberto bncc.dev, mantido pela Profy. Ele reúne os textos oficiais da BNCC e do complemento de Computação, e o projeto informa que cada texto foi conferido contra o PDF homologado, com a página de origem de cada registro.\n\n- Versão dos dados no GeradorOne: dados-2026.08.\n- Licença: Creative Commons Atribuição 4.0 (CC BY 4.0), que exige dar o crédito. Por isso o seletor mostra a fonte.\n- Repositório: https://github.com/bncc-dev/bncc-dados\n- DOI: 10.5281/zenodo.21625233\n\nOs dados ficam no próprio servidor do GeradorOne. Nada que você digita vai para o bncc.dev. O dataset é de terceiros e não é um produto do MEC: em caso de diferença, vale o documento oficial.'
  },
  {
    categoria: 'BNCC',
    pergunta: 'Como escolho habilidades da BNCC no GeradorOne?',
    resposta: '1. Na Apostila, em "Configuração pedagógica", clique em "Escolher habilidades da BNCC".\n2. Filtre por "Etapa" (Educação Infantil, Ensino Fundamental ou Ensino Médio). Depois use o ano ou a faixa etária e o componente, a área ou o campo de experiências. Se preferir, digite uma palavra ou um código em "Buscar".\n3. Marque as habilidades que quiser. A seleção continua marcada mesmo se você mudar os filtros.\n4. Clique em "Usar as selecionadas". Os códigos vão para o campo "Códigos da BNCC".\n\nA lista mostra até 150 resultados por vez: use os filtros para refinar. Ao gerar o prompt, o texto oficial de cada habilidade entra nele, e o app avisa se algum código digitado não existe na base.'
  },

  // ---------- Suporte ----------
  {
    categoria: 'Suporte',
    pergunta: 'Como falo com o suporte?',
    resposta: '1. Abra "Suporte", no menu.\n2. Escolha o tipo da mensagem: "Crítica", "Sugestão", "Problema", "Dúvida" ou "Elogio".\n3. Escreva a mensagem (de 5 a 2.000 caracteres). Num problema, diga em qual tela estava e o que esperava ver.\n4. Confira o seu e-mail em "Seu e-mail (para a resposta)". O campo já vem com o e-mail da conta, e a resposta chega nele.\n5. Clique em "Enviar mensagem".\n\nVocê recebe na hora um número de protocolo na tela e uma confirmação por e-mail, que cita o protocolo. Muitas dúvidas já têm resposta na FAQ. Não envie senhas nem chaves de API.'
  },
  {
    categoria: 'Suporte',
    pergunta: 'Quais anexos posso enviar ao suporte?',
    resposta: '- Tipos aceitos: imagens (PNG, JPG, GIF e WEBP), PDF, TXT, LOG e CSV.\n- Limites: até 5 arquivos, 5 MB cada e 8 MB no total.\n\nPara anexar, clique em "Anexar arquivo", arraste os arquivos para a área tracejada ou cole um print de tela direto no texto da mensagem (Ctrl+V). Cada anexo aparece numa lista, e o "×" ao lado de cada um remove o arquivo antes do envio.\n\nO app confere o conteúdo do arquivo, além do nome: um arquivo com extensão de imagem que não é uma imagem é recusado. Um print do erro costuma ajudar mais do que a descrição. Antes de enviar, confira se ele não mostra senhas, chaves de API ou dados de outras pessoas.'
  },
  {
    categoria: 'Suporte',
    pergunta: 'Apareceu "Mensagem registrada" em vez de "Mensagem enviada". O que significa?',
    resposta: '"Mensagem enviada" quer dizer que o e-mail chegou à equipe e que você recebeu a confirmação. "Mensagem registrada" quer dizer que o GeradorOne guardou a sua mensagem com o protocolo, mas não conseguiu enviar o e-mail agora, por exemplo porque o envio de e-mails do sistema está desligado ou fora do ar.\n\nNesse caso, anote o protocolo que aparece na tela e, se for urgente, escreva para o contato oficial: fulano@dominio.com.br. Cite o protocolo e descreva o assunto de novo, porque os anexos não ficam guardados no sistema.'
  },
  {
    categoria: 'Suporte',
    pergunta: 'Quantas mensagens posso enviar ao suporte?',
    resposta: 'Até 5 por hora, por conta. Passando disso, o app avisa para aguardar um pouco. O limite evita envio em massa.\n\nSe precisa acrescentar algo a uma mensagem já enviada, responda ao e-mail de confirmação e cite o protocolo.'
  },
  {
    categoria: 'Suporte',
    pergunta: 'O que o GeradorOne guarda da minha mensagem ao suporte?',
    resposta: 'O sistema guarda o texto da mensagem, o tipo, o protocolo, o nome e o e-mail informados, a tela de onde você escreveu e o nome e o tamanho de cada anexo. Os próprios anexos não ficam guardados: eles seguem só no e-mail enviado à equipe.\n\nEssas mensagens aparecem no arquivo de "Baixar meus dados" e somem do sistema quando você exclui a conta. As cópias de segurança do banco são apagadas depois de 14 dias.'
  },

  // ---------- Capa ----------
  {
    categoria: 'Capa',
    pergunta: 'Que textos eu coloco na capa?',
    resposta: 'Em "Textos da capa", escreva exatamente como devem aparecer na imagem. Só o "Título principal" é obrigatório. Os demais são opcionais: Disciplina, Texto superior (já vem "Material de Estudos"), Subtítulo, Frase inferior, Série ou turma, Professor(a), Instituição e Público / faixa etária.\n\nO prompt pede que cada texto saia letra por letra, com a acentuação indicada.'
  },
  {
    categoria: 'Capa',
    pergunta: 'Quais opções de estilo e formato a capa tem?',
    resposta: '- Estilo da capa: os mesmos 12 estilos da Apostila.\n- Paleta: Automática, Azul e turquesa, Terrosa e acolhedora, Vibrante infantil, Monocromática ou Alto contraste.\n- Formato da capa: Impressão A4 (padrão), Somente tela ou Apresentação 16:9.\n- Elementos desejados na ilustração: campo livre e opcional, por exemplo "circuito elétrico, lâmpada, resistores e um multímetro".'
  },
  {
    categoria: 'Capa',
    pergunta: 'A capa também pode ser gerada pela IA do servidor?',
    resposta: 'O bloco "Gerar o material com IA" aparece só na Apostila. Para a capa, o app gera o prompt (uma imagem única, em página única, sem mockup): copie-o e use na sua ferramenta de imagens. Se tiver chave de IA, "Melhorar com IA" ajusta o prompt antes.'
  },

  // ---------- Resultado e exportação ----------
  {
    categoria: 'Resultado e exportação',
    pergunta: 'Onde aparece o prompt gerado e como copio?',
    resposta: 'No painel "Resultado", ao lado do formulário (no celular, na aba "Resultado"). A aba "Prompt" mostra o texto e a aba "Prévia" mostra uma pré-visualização em HTML.\n\nClique em "Copiar" para levar o texto para a área de transferência. O formulário não é apagado ao gerar.'
  },
  {
    categoria: 'Resultado e exportação',
    pergunta: 'O que fazem os botões TXT, JSON e PDF?',
    resposta: '- TXT: baixa o prompt em um arquivo de texto.\n- JSON: exporta o projeto, para guardar ou importar depois em "Meus projetos".\n- PDF: no modo só prompt, baixa o prompt/roteiro em PDF; no modo com IA, o PDF é o material didático completo produzido pelo modelo.'
  },
  {
    categoria: 'Resultado e exportação',
    pergunta: 'Como uso o "Melhorar com IA"?',
    resposta: '1. Com um prompt gerado, clique em "Melhorar com IA".\n2. Marque um ou mais "Ajustes rápidos": Mais detalhado, Mais simples, Mais visual, Mais didático, Mais profissional, Adaptar para crianças, Aumentar dificuldade ou Diminuir dificuldade.\n3. Se quiser, escreva uma "Instrução personalizada" (até 1.000 caracteres).\n4. Clique em "Aplicar".\n\nCom chave de IA cadastrada, a IA reescreve o prompt aplicando os ajustes. Sem chave, os ajustes são anexados ao fim do prompt.'
  },
  {
    categoria: 'Resultado e exportação',
    pergunta: 'Como gero o material pronto com a IA?',
    resposta: '1. Cadastre a sua chave em "Minha chave de IA".\n2. Na Apostila, preencha o formulário e gere o prompt.\n3. No bloco "Gerar o material com IA", escolha o "Formato de entrega": Arquivo PDF final ou Arquivo HTML autônomo.\n4. Clique em "Gerar material com IA".\n\nOs arquivos aparecem em uma janela, com nome, tipo e tamanho aproximado, e o botão "Salvar localmente". O PDF é um arquivo real, convertido pelo servidor. Se a IA não devolver as imagens obrigatórias, a entrega falha em vez de sair incompleta.'
  },
  {
    categoria: 'Resultado e exportação',
    pergunta: 'A geração com IA deu erro. O que faço?',
    resposta: '- Leia a mensagem na tela: ela costuma dizer o motivo.\n- Confira em "Minha chave de IA" se a chave está salva e é do provedor escolhido.\n- Confira no site do provedor se a chave está ativa e se há saldo ou limite disponível.\n- Tente de novo; falhas temporárias do provedor acontecem.\n\nEnquanto isso, o prompt continua disponível: dá para copiá-lo e usar em outra ferramenta.'
  },

  // ---------- Projetos ----------
  {
    categoria: 'Projetos',
    pergunta: 'Como salvo meu trabalho?',
    resposta: 'No topo da Apostila e da Capa aparece o caminho "Meus projetos / nome do projeto" e o estado (por exemplo, "não salvo"). Clique em "Salvar projeto". Use "Renomear" para dar um nome claro, como "Lei de Ohm, 2º ano".\n\nPara guardar uma variação, use "Salvar como novo" (aparece quando o projeto já foi salvo).'
  },
  {
    categoria: 'Projetos',
    pergunta: 'Onde ficam meus projetos e quem os vê?',
    resposta: 'Ficam salvos no servidor, na sua conta. Cada usuário vê somente os próprios projetos. Cada conta pode ter até 500 projetos.'
  },
  {
    categoria: 'Projetos',
    pergunta: 'Como abro ou excluo um projeto?',
    resposta: 'Em "Meus projetos", cada projeto tem dois botões de ícone: o lápis ("Abrir projeto"), que volta ao formulário de onde você parou, e a lixeira ("Excluir projeto"). Passe o mouse sobre o ícone para ver o nome.\n\nA lixeira pede confirmação, para ninguém apagar sem querer: o botão muda para "Confirmar exclusão" e você precisa clicar de novo em poucos segundos.'
  },
  {
    categoria: 'Projetos',
    pergunta: 'Posso exportar e importar projetos?',
    resposta: 'Sim. No painel "Resultado", o botão "JSON" exporta o projeto. Em "Meus projetos", o botão "Importar arquivo JSON" traz um projeto exportado antes, por exemplo de outro computador.'
  },

  // ---------- IA e chave ----------
  {
    categoria: 'IA e chave',
    pergunta: 'O que é BYOK?',
    resposta: 'Significa "Bring Your Own Key": traga a sua própria chave. Em vez de o GeradorOne ter uma chave única paga por todos, cada pessoa usa a chave da própria conta no provedor de IA.\n\nSem chave, o app continua gerando prompts normalmente; só os recursos de IA (gerar o material pronto e "Melhorar com IA" reescrevendo) ficam desligados.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Como cadastro minha chave de IA?',
    resposta: '1. Crie a chave no site do provedor (OpenAI, Google AI Studio ou Anthropic). As três próximas perguntas da categoria "Obter a chave de IA" mostram o passo a passo.\n2. No GeradorOne, abra "Minha chave de IA".\n3. Escolha o Provedor (OpenAI, Google Gemini ou Anthropic (Claude)) e cole a chave em "Chave da API".\n4. Confira o "Modelo de texto" e o "Modelo de imagem" (há sugestões na lista).\n5. Clique em "Salvar configuração". Vale na hora, sem reiniciar.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Minha chave fica segura no GeradorOne?',
    resposta: 'O app protege a chave de quatro formas:\n\n- Ela é guardada cifrada (AES-256-GCM) e ligada só à sua conta.\n- A chave usada para cifrar fica no arquivo de configuração do servidor, fora do banco de dados. Quem lesse só o banco veria texto ilegível.\n- Depois de salva, a chave nunca volta ao navegador. Você vê apenas os 4 últimos caracteres.\n- Outros usuários, inclusive administradores, só veem se você tem uma chave cadastrada, nunca o valor.\n\nA proteção tem um limite: quem administra o servidor tem acesso técnico ao banco e à chave de cifragem. Por isso vale seguir as dicas da próxima pergunta.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Como proteger minha chave de IA?',
    resposta: '- Use uma chave só para o GeradorOne. Assim você a revoga sem afetar outros usos.\n- Defina um limite de gasto no painel do provedor.\n- Trate a chave como uma senha: não envie por e-mail ou mensagem, não cole em documentos compartilhados e não a publique em repositórios de código.\n- Cadastre-a apenas no endereço oficial do GeradorOne da sua instituição.\n- Os provedores mostram o valor completo só na criação. Guarde a chave em um gerenciador de senhas; se perder, crie outra.\n- Se desconfiar de vazamento, exclua a chave no painel do provedor primeiro e depois use "Remover chave" no GeradorOne.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Como revogo uma chave que criei?',
    resposta: 'A revogação é feita no site do provedor, na mesma página onde você criou a chave. Na OpenAI, a página de chaves tem um ícone de lixeira ao lado de cada chave; aplicações que usam uma chave excluída podem deixar de funcionar. No Google AI Studio, use a página de chaves de API.\n\nDepois, no GeradorOne, abra "Minha chave de IA" e clique em "Remover chave", para não ficar uma chave inválida salva.'
  },

  {
    categoria: 'IA e chave',
    pergunta: 'Por que o GeradorOne usa BYOK em vez de uma chave única?',
    resposta: 'Com BYOK, cada pessoa usa a chave da própria conta no provedor de IA. O custo de cada geração vai para quem gerou, e não existe uma conta central pagando por todos.\n\nO GeradorOne é gratuito por enquanto e não cobra pelas gerações com IA. Quem cobra é o provedor, na sua conta, conforme o uso. O servidor não tem chave global.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Preciso de uma chave de IA para usar o GeradorOne?',
    resposta: 'Não. Sem chave você cria a conta, preenche a Apostila ou a Capa, gera o prompt, copia, exporta em TXT, JSON ou PDF e salva projetos. O prompt é para colar na ferramenta de imagens que você preferir.\n\nA chave só é necessária para os recursos em que o servidor chama uma IA por você. A próxima pergunta lista quais.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'O que só funciona com a minha chave?',
    resposta: '- "Gerar material com IA", na Apostila: o servidor usa a sua chave para produzir o material pronto, em PDF ou HTML, com as imagens.\n- "Melhorar com IA" reescrevendo o prompt: com chave, a IA reescreve o prompt aplicando os ajustes. Sem chave, os ajustes são só anexados ao fim do prompt.\n\nTodo o resto funciona sem chave.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Como sei se a minha chave está salva?',
    resposta: 'Abra "Minha chave de IA". A primeira linha da tela mostra o estado. Com chave salva, ela diz "Sua chave está salva" e mostra o provedor, o modelo de texto em uso e os 4 últimos caracteres da chave, no formato ••••1234. Sem chave, a linha avisa que você ainda não salvou uma.\n\nO valor completo nunca aparece de novo, nem para você.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'O app diz "Chave com formato inválido". O que significa?',
    resposta: 'O app confere o formato antes de salvar: a chave precisa ter de 8 a 512 caracteres, só com letras, números e os símbolos - _ . : ~ + / =. Espaço no meio, aspas ou quebra de linha fazem a conferência falhar.\n\nCopie a chave de novo, inteira, direto do painel do provedor, e cole sem aspas. Espaços no começo e no fim são removidos sozinhos. Se o formato estiver certo e as gerações ainda falharem, veja a pergunta sobre erro na geração com IA.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Posso ter chaves de mais de um provedor ao mesmo tempo?',
    resposta: 'Não. Cada conta guarda uma configuração por vez: um provedor (OpenAI, Google Gemini ou Anthropic), uma chave e os modelos. Ao trocar de provedor, a chave anterior sai e você informa a do novo provedor.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'O que são o "Modelo de texto" e o "Modelo de imagem"?',
    resposta: 'São os modelos que o provedor usa em cada tarefa. O modelo de texto escreve o material e reescreve o prompt em "Melhorar com IA". O modelo de imagem cria as ilustrações (a Anthropic não tem modelo de imagem).\n\nOs campos trazem sugestões na lista. Se você deixar um campo em branco, o app usa o modelo padrão do provedor escolhido. Se o provedor aposentar um modelo ou a sua conta não tiver acesso a ele, troque pelo nome de um modelo disponível na documentação do provedor.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Como controlo o gasto com a IA?',
    resposta: '- Defina um limite de gasto no painel do provedor.\n- Acompanhe o consumo no próprio painel do provedor, que é a fonte oficial dos valores.\n- O custo cresce com o que você pede: mais texto e mais imagens custam mais. Na Apostila, a "Frequência visual" define de uma a três imagens por material no modo com IA.\n- Para treinar ou testar, gere só o prompt, que não usa a chave.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Posso usar a chave de outra pessoa ou da instituição?',
    resposta: 'Só com autorização de quem é dono da chave, porque o custo de tudo o que você gerar cai na conta dela. Se a instituição quiser pagar, o mais seguro é criar uma chave separada para cada pessoa, cada uma com o seu limite de gasto, em vez de compartilhar uma só.\n\nQuem recebe a chave a cadastra normalmente, em "Minha chave de IA".'
  },

  // ---------- Obter a chave de IA ----------
  {
    categoria: 'Obter a chave de IA',
    pergunta: 'Como crio uma chave de API na OpenAI?',
    resposta: '1. Entre em https://platform.openai.com/api-keys. Faça login ou crie uma conta, se ainda não tiver.\n2. Crie uma nova chave. Se o painel pedir um nome, use um que identifique o uso, como "GeradorOne".\n3. Copie o valor completo na hora. A OpenAI mostra a chave inteira só uma vez; se perder, não dá para recuperar, e você precisa criar outra.\n4. No GeradorOne, abra "Minha chave de IA", escolha o provedor "OpenAI", cole a chave em "Chave da API" e clique em "Salvar configuração".\n\nO uso é cobrado pela OpenAI, na sua conta. Confira no painel dela o faturamento e defina um limite de gasto.\n\nAjuda oficial: https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key'
  },
  {
    categoria: 'Obter a chave de IA',
    pergunta: 'Como crio uma chave de API no Google Gemini?',
    resposta: '1. Entre em https://aistudio.google.com/apikey com a sua conta Google (Google AI Studio).\n2. Clique em "Create API key" e copie a chave gerada.\n3. No GeradorOne, abra "Minha chave de IA", escolha o provedor "Google Gemini", cole a chave em "Chave da API" e clique em "Salvar configuração".\n\nToda chave do Gemini fica ligada a um projeto do Google Cloud, que cuida do faturamento e das permissões. Quem usa o AI Studio pela primeira vez recebe um projeto e uma chave padrão depois de aceitar os termos. Quem já tem conta no Google Cloud precisa importar o projeto no AI Studio, na seção Dashboard > Projects, antes de criar a chave. Se o botão de criar chave não estiver disponível, a sua conta provavelmente não tem permissão no projeto: fale com quem administra o Google Cloud da sua instituição.\n\nSobre custos e faturamento, consulte a página de preços do Gemini no site do Google. Ajuda oficial: https://ai.google.dev/gemini-api/docs/api-key'
  },
  {
    categoria: 'Obter a chave de IA',
    pergunta: 'Como crio uma chave de API na Anthropic (Claude)?',
    resposta: '1. Entre em https://platform.claude.com/ com a sua conta, ou crie uma, e abra a página de chaves: https://platform.claude.com/settings/keys.\n2. Clique em "Create key", dê um nome (por exemplo, "GeradorOne") e escolha a validade da chave.\n3. Em "Linked account", deixe a sua conta. Se o painel oferecer a escolha de um workspace para a chave, escolha um (veja o aviso abaixo).\n4. Copie a chave na hora. O painel mostra o valor completo, que começa com sk-ant-, só uma vez. Se perder, crie outra.\n5. No GeradorOne, abra "Minha chave de IA", escolha o provedor "Anthropic (Claude)", cole a chave em "Chave da API" e clique em "Salvar configuração".\n\nAviso sobre workspace: uma chave que não está vinculada a um workspace só funciona se cada pedido informar o ID dele, e o GeradorOne não envia esse dado. Nesse caso a Anthropic responde com um erro dizendo que a chave não está vinculada a um workspace. Crie a chave de novo, vinculada a um workspace.\n\nO uso é cobrado pela Anthropic, na sua conta. Ajuda oficial: https://platform.claude.com/docs/en/get-api-key'
  },
  {
    categoria: 'Obter a chave de IA',
    pergunta: 'O que muda ao usar uma chave da Anthropic?',
    resposta: 'A Anthropic gera só texto. Por isso, com uma chave dela:\n\n- "Melhorar com IA" funciona normalmente.\n- "Gerar material com IA" funciona se, em "Imagens por IA", você escolher "Não usar imagens geradas por IA". O material sai sem ilustrações geradas, com os elementos visuais em CSS e SVG.\n- Se "Imagens por IA" estiver em "Gerar imagens reais e incorporar", o app avisa e não faz o pedido. Para ter imagens, use uma chave da OpenAI ou do Gemini.\n\nNa tela "Minha chave de IA", o campo "Modelo de imagem" fica desligado para a Anthropic. O "Modelo de texto" vem com claude-sonnet-5-5, e a lista traz também claude-opus-5-5, claude-haiku-5-5 e claude-fable-5-1.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Quanto custa usar a IA?',
    resposta: 'O GeradorOne não cobra por isso. Cada geração com IA e cada "Melhorar com IA" é cobrada pelo provedor, na sua conta. Defina um limite de gasto no site do provedor.\n\nGerar apenas o prompt não usa a sua chave e não tem custo.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Posso trocar de provedor ou remover a chave?',
    resposta: '- Remover: em "Minha chave de IA", clique em "Remover chave".\n- Trocar de provedor: escolha o novo provedor e informe a chave dele. Ao trocar, os modelos voltam ao padrão do novo provedor e a chave antiga é descartada se você não informar uma nova.\n\nPara apenas trocar a chave do mesmo provedor, cole a nova e salve. Deixar o campo em branco mantém a atual.'
  },
  {
    categoria: 'IA e chave',
    pergunta: 'Para onde vão os meus textos quando uso a IA?',
    resposta: 'Para o provedor que você escolheu (OpenAI, Google ou Anthropic), que os processa conforme os termos dele. Só acontece quando você usa um recurso de IA com a sua chave. Para gerar apenas o prompt, nada é enviado a um provedor de IA.'
  },

  // ---------- Aparência e celular ----------
  {
    categoria: 'Aparência e celular',
    pergunta: 'Como mudo o tema de cores?',
    resposta: 'Abra "Tema", no fim do menu. São seis temas: Papel, Grafite, Lousa, Azul-tinta, Sépia e Alto contraste, além da opção de seguir o sistema (Papel de dia, Grafite à noite). Na primeira entrada o tema é o Papel. A troca vale na hora e fica guardada na sua conta, então vale em qualquer aparelho.'
  },
  {
    categoria: 'Aparência e celular',
    pergunta: 'Como uso o app no celular?',
    resposta: 'A interface se adapta a telas pequenas. Na Apostila e na Capa, a tela se divide em duas abas, "Dados" e "Resultado": você preenche em "Dados" e, ao gerar, o app abre a aba "Resultado". O menu fica atrás do botão de menu no topo.'
  },
  {
    categoria: 'Aparência e celular',
    pergunta: 'Dá para esconder o menu lateral?',
    resposta: 'Sim. Use o botão "Recolher menu", no topo do menu, para deixar só os ícones. O app lembra a sua escolha neste aparelho.'
  },

  // ---------- Segurança e privacidade ----------
  {
    categoria: 'Segurança e privacidade',
    pergunta: 'O GeradorOne confere se o conteúdo está correto?',
    resposta: 'Não. O app monta o briefing e instrui a IA a não inventar códigos, fontes, normas, citações ou dados, mas ele não valida o que a IA devolve. Confira sempre os códigos da BNCC, os dados e as fontes do material final.'
  },
  {
    categoria: 'Segurança e privacidade',
    pergunta: 'Outras pessoas veem meus projetos?',
    resposta: 'Não. Cada usuário vê somente os próprios projetos, e a sua chave de IA não é visível para ninguém. O que você envia ao provedor de IA só sai do servidor quando você usa um recurso de IA.'
  },
  {
    categoria: 'Segurança e privacidade',
    pergunta: 'Por quanto tempo meus dados ficam guardados?',
    resposta: 'Enquanto a sua conta existir. Ao excluí-la, em "Minha conta", a conta, os projetos e a chave de IA saem do banco na hora.\n\nAs cópias de segurança do banco são mantidas por 14 dias (2 semanas) e depois apagadas. Por isso, os dados de uma conta excluída ainda podem constar nessas cópias por até 14 dias. Elas servem só para recuperar o servidor e não ficam acessíveis pelo app.'
  },
  {
    categoria: 'Segurança e privacidade',
    pergunta: 'Com quem falo sobre meus dados pessoais?',
    resposta: 'O contato oficial para dúvidas e pedidos sobre dados pessoais (acesso, correção, exclusão, privacidade) é Fulano, pelo e-mail fulano@dominio.com.br.\n\nVocê mesmo baixa os seus dados e exclui a conta em "Minha conta". O e-mail serve para o que a tela não resolve.'
  },
  {
    categoria: 'Segurança e privacidade',
    pergunta: 'Minha senha é guardada de forma segura?',
    resposta: 'A senha é guardada com um hash, nunca em texto aberto, e o login tem limite de tentativas. A sessão usa um cookie protegido (HttpOnly) e é encerrada quando a senha ou o perfil mudam.\n\nUse uma senha única e de pelo menos 8 caracteres.'
  },

  {
    categoria: 'Segurança e privacidade',
    pergunta: 'Onde leio os Termos de uso e a Política de privacidade?',
    resposta: 'Em três lugares: no rodapé da tela de login, no bloco "Termos e privacidade" de "Minha conta" e na caixa de aceite do cadastro. Cada link abre uma página pública, que você lê sem precisar entrar.\n\n- Termos de uso: cadastro, uso permitido, chave de IA, conteúdo gerado, assinatura futura e responsabilidades.\n- Política de privacidade: quais dados o GeradorOne guarda, para quê, com quem compartilha, por quanto tempo e como você exerce seus direitos pela LGPD.\n\nOs dois textos são um rascunho do responsável pelo projeto e ainda não passaram por revisão jurídica. As páginas dizem isso logo no topo.'
  },
  {
    categoria: 'Segurança e privacidade',
    pergunta: 'Preciso aceitar os termos para criar a conta?',
    resposta: 'Sim. Na tela "Criar conta", marque "Li e aceito os Termos de uso e a Política de privacidade". Sem a marca, o app não envia o código de confirmação.\n\nO GeradorOne guarda a versão que você aceitou e a data e hora do aceite. Essas duas informações aparecem em "Minha conta", no bloco "Termos e privacidade", e entram no arquivo de "Baixar meus dados".'
  },
  {
    categoria: 'Segurança e privacidade',
    pergunta: 'Apareceu a tela "Termos de uso e privacidade" depois do login. Por quê?',
    resposta: 'Isso acontece em dois casos: a sua conta foi criada antes de os termos existirem no app, ou os textos mudaram desde o seu último aceite. Os documentos têm uma versão, e o app pede um novo aceite quando ela muda.\n\nLeia os dois documentos, marque a caixa e clique em "Aceitar e continuar". Não há cobrança nem mudança nos seus projetos. Se não quiser aceitar, clique em "Sair". Para apagar os seus dados, entre em contato pelo e-mail fulano@dominio.com.br.'
  },

  // ---------- Administração ----------
  {
    categoria: 'Administração',
    pergunta: 'Como crio um usuário? (administradores)',
    resposta: '1. Abra "Configurações" no menu (só administradores veem) e escolha a aba "Usuários".\n2. Em "Novo usuário", informe nome completo, telefone, e-mail e o perfil (Usuário ou Administrador).\n3. Defina uma senha temporária (o botão "Gerar senha" cria uma) e clique em "Criar usuário".\n\nEntregue a senha temporária à pessoa com segurança. Ela precisa trocá-la no primeiro acesso.'
  },
  {
    categoria: 'Administração',
    pergunta: 'Como gerencio usuários existentes? (administradores)',
    resposta: 'Na aba "Usuários" de "Configurações" você busca por nome ou e-mail, filtra por perfil e, em cada linha, usa os botões de ícone: o lápis edita os dados (e ativa ou desativa a conta), a chave redefine a senha e a lixeira exclui o usuário. A lixeira pede um segundo clique para confirmar.\n\nAo redefinir, a nova senha temporária aparece uma única vez na tela, com o botão "Copiar senha", e a pessoa precisa trocá-la no próximo acesso. Excluir um usuário remove também os projetos dele. O sistema sempre mantém pelo menos um administrador ativo.'
  },
  {
    categoria: 'Administração',
    pergunta: 'Como configuro o e-mail que envia os códigos? (administradores)',
    resposta: '1. Abra "Configurações" no menu e escolha a aba "E-mail (SMTP)".\n2. Informe servidor, porta, tipo de conexão (STARTTLS, TLS direto ou sem criptografia), usuário, senha e remetente. Se quiser, preencha também "Endereço do app nos e-mails" e "E-mail de contato no rodapé": os dois aparecem no rodapé dos e-mails de cadastro e de redefinição de senha.\n3. Clique em "Salvar". A mudança vale na hora, sem reiniciar.\n4. Use "Enviar teste" para conferir: o e-mail chega no endereço que você digitar (em branco, no seu).\n\nA senha fica cifrada e nunca volta para a tela; deixar o campo em branco mantém a atual. "Voltar ao .env" apaga a configuração do painel e volta ao que está no arquivo de configuração do servidor.'
  },
  {
    categoria: 'Administração',
    pergunta: 'Por que "Criar conta" e "Esqueci a senha" sumiram? (administradores)',
    resposta: 'Os dois dependem do envio de e-mail. Se o e-mail estiver desligado ou sem configuração, eles ficam escondidos. Configure o servidor na aba "E-mail (SMTP)" de "Configurações" e os links voltam a aparecer.'
  },
  {
    categoria: 'Administração',
    pergunta: 'Como vejo se o backup está funcionando? (administradores)',
    resposta: 'Abra "Configurações" no menu e escolha a aba "Backup". No alto aparece "Protegido" quando o banco e a cópia externa rodaram dentro de 26 horas, ou "Atenção" com o motivo (cópia atrasada, falha ou sem registro).\n\nA aba mostra:\n- a data da última cópia do banco e do servidor inteiro (cópia externa);\n- a lista de cópias guardadas, com tamanho;\n- o log das execuções e as falhas recentes.\n\nO banco é copiado todo dia às 03:15 e as cópias ficam por 14 dias. A cópia externa do servidor inteiro roda às 03:30 e também guarda 14 dias. A aba só mostra a situação: ela não faz nem restaura cópias, isso é feito no servidor. Na instalação de desenvolvimento a aba avisa que não há registro de backup.'
  }
];

if (typeof module !== 'undefined') module.exports = { FAQ_ITEMS };
