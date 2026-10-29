const dicionario = {
  'idioma.rotulo': 'Idioma',
  'legal.ressalva': 'Este documento está disponível apenas em português do Brasil. O contrato é regido pela legislação brasileira e o pagamento é processado no Brasil, em reais (BRL).'
};
if (typeof module === 'object' && module.exports) module.exports = dicionario;
else (window.I18N_DICT = window.I18N_DICT || {})['pt-BR'] = dicionario;
