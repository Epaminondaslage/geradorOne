const dicionario = {
  'idioma.rotulo': 'Lingua',
  'legal.ressalva': 'Questo documento è disponibile solo in portoghese brasiliano. Il contratto è regolato dalla legge brasiliana e il pagamento viene elaborato in Brasile, in real brasiliani (BRL).'
};
if (typeof module === 'object' && module.exports) module.exports = dicionario;
else (window.I18N_DICT = window.I18N_DICT || {})['it'] = dicionario;
