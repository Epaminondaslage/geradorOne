const dicionario = {
  'idioma.rotulo': 'Language',
  'legal.ressalva': 'This document is available only in Brazilian Portuguese. The agreement is governed by Brazilian law and payment is processed in Brazil, in Brazilian reais (BRL).'
};
if (typeof module === 'object' && module.exports) module.exports = dicionario;
else (window.I18N_DICT = window.I18N_DICT || {})['en'] = dicionario;
