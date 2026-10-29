const dicionario = {
  'idioma.rotulo': 'Idioma',
  'legal.ressalva': 'Este documento solo está disponible en portugués de Brasil. El contrato se rige por la legislación brasileña y el pago se procesa en Brasil, en reales brasileños (BRL).'
};
if (typeof module === 'object' && module.exports) module.exports = dicionario;
else (window.I18N_DICT = window.I18N_DICT || {})['es'] = dicionario;
