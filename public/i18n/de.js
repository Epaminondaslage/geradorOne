const dicionario = {
  'idioma.rotulo': 'Sprache',
  'legal.ressalva': 'Dieses Dokument ist nur auf brasilianischem Portugiesisch verfügbar. Der Vertrag unterliegt brasilianischem Recht, und die Zahlung wird in Brasilien in brasilianischen Real (BRL) abgewickelt.'
};
if (typeof module === 'object' && module.exports) module.exports = dicionario;
else (window.I18N_DICT = window.I18N_DICT || {})['de'] = dicionario;
