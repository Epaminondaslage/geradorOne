const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function load(env) {
  for (const key of ['MONITOR_DIR', 'BACKUP_ESPERADO']) delete process.env[key];
  Object.assign(process.env, env);
  delete require.cache[require.resolve('../lib/backup')];
  return require('../lib/backup');
}

const horasAtras = horas => new Date(Date.now() - horas * 3_600_000).toISOString();

test('backup: sem a pasta de status, desenvolvimento só informa e produção sinaliza erro', () => {
  const ausente = path.join(os.tmpdir(), 'g1-sem-monitor-' + Date.now());
  const dev = load({ MONITOR_DIR: ausente }).situacao();
  assert.equal(dev.disponivel, false);
  assert.equal(dev.gravidade, 'informacao');
  const prod = load({ MONITOR_DIR: ausente, BACKUP_ESPERADO: '1' }).situacao();
  assert.equal(prod.disponivel, false);
  assert.equal(prod.gravidade, 'erro');
});

test('backup: lê o status do banco e das cópias do PBS e marca atraso e falha', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-monitor-'));
  try {
    const lib = load({ MONITOR_DIR: dir, BACKUP_ESPERADO: '1' });
    // pasta existe, mas nada gravado ainda
    const vazio = lib.situacao();
    assert.equal(vazio.disponivel, true);
    assert.equal(vazio.protegido, false);
    assert.equal(vazio.semBanco, true);
    assert.equal(vazio.semPbs, true);

    fs.writeFileSync(path.join(dir, 'backup-db.json'), JSON.stringify({ ok: true, fim: horasAtras(2), copias: [{ nome: 'geradorone-20261023-0315.sql.gz', bytes: 1728 }] }));
    fs.writeFileSync(path.join(dir, 'pbs.json'), JSON.stringify({ ok: true, fim: horasAtras(3), snapshots: [{ data: horasAtras(3), bytes: 4360025642 }] }));
    fs.writeFileSync(path.join(dir, 'backup.log'), '2026-10-23 03:15:01 backup do banco ok: x\n2026-10-24 03:15:01 backup do banco falhou: y\n');
    const bom = lib.situacao();
    assert.equal(bom.protegido, true);
    assert.equal(bom.banco.atrasada, false);
    assert.equal(bom.banco.copias.length, 1);
    assert.equal(bom.pbs.snapshots[0].bytes, 4360025642);
    assert.equal(bom.falhasRecentes.length, 1);

    fs.writeFileSync(path.join(dir, 'backup-db.json'), JSON.stringify({ ok: true, fim: horasAtras(40) }));
    const atrasado = lib.situacao();
    assert.equal(atrasado.banco.atrasada, true);
    assert.equal(atrasado.protegido, false);

    fs.writeFileSync(path.join(dir, 'backup-db.json'), JSON.stringify({ ok: false, fim: horasAtras(1), mensagem: 'pg_dump não gerou arquivo' }));
    assert.equal(lib.situacao().banco.atrasada, true);

    fs.writeFileSync(path.join(dir, 'pbs.json'), '{ isto não é json');
    const quebrado = lib.situacao();
    assert.equal(quebrado.semPbs, true, 'arquivo ilegível conta como ausente, sem derrubar a tela');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.MONITOR_DIR;
    delete process.env.BACKUP_ESPERADO;
  }
});
