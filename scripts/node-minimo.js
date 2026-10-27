// Falha o build da imagem quando o Node é mais velho que o mínimo do package.json (engines.node, por exemplo ">=22.23.4").
// Por quê: o Dockerfile usa node:22-alpine e o build local reaproveita a imagem em cache. Em 26/10/2026, depois do boletim de segurança
// do Node de outubro, dois ambientes ficaram na 22.23.3 sem ninguém perceber. Rebuild com --pull baixa a base nova.
const fs = require('node:fs');
const path = require('node:path');

function partes(versao) {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(versao));
  return m ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)] : null;
}

// true se `versao` é igual ou maior que `minimo` (comparação numérica por parte; "22.23.10" é maior que "22.23.4").
function atende(versao, minimo) {
  const a = partes(versao);
  const b = partes(minimo);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

// engines.node ">=22.23.4" -> "22.23.4"; sem engines devolve null.
function minimoDoPacote(pacote) {
  const faixa = pacote?.engines?.node;
  const m = typeof faixa === 'string' ? />=\s*(\d+(?:\.\d+){0,2})/.exec(faixa) : null;
  return m ? m[1] : null;
}

if (require.main === module) {
  const pacote = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const minimo = minimoDoPacote(pacote);
  if (!minimo) { console.error('package.json sem engines.node no formato ">=X.Y.Z".'); process.exit(1); }
  if (!atende(process.versions.node, minimo)) {
    console.error(`Node ${process.versions.node} está abaixo do mínimo ${minimo} (package.json, engines.node). Refaça o build com "--pull" para baixar a imagem base nova.`);
    process.exit(1);
  }
  console.log(`Node ${process.versions.node} atende o mínimo ${minimo}.`);
}

module.exports = { atende, minimoDoPacote };
