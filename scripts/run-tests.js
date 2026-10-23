#!/usr/bin/env node
// Sobe um Postgres descartável em Docker, roda a suíte com TEST_DATABASE_URL e remove o contêiner no fim.
// Com TEST_DATABASE_URL já definida, usa esse Postgres e não sobe nada.
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const IMAGE = 'postgres:17-alpine';
const name = `g1-test-pg-${process.pid}`;
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

function startPostgres() {
  const run = sh('docker', ['run', '-d', '--rm', '--name', name, '-e', 'POSTGRES_PASSWORD=pgTestSegredo9xQ', '-p', '127.0.0.1::5432', IMAGE, '-c', 'fsync=off', '-c', 'max_connections=200']);
  if (run.status !== 0) throw new Error(`Não foi possível iniciar o Postgres de teste: ${run.stderr.trim()}`);
  const port = sh('docker', ['port', name, '5432/tcp']).stdout.trim().split(':').pop();
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    if (sh('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']).status === 0) {
      // O servidor reinicia uma vez durante a inicialização; confirma duas respostas seguidas.
      if (sh('docker', ['exec', name, 'psql', '-U', 'postgres', '-h', '127.0.0.1', '-tAc', 'SELECT 1']).status === 0) return `postgres://postgres:pgTestSegredo9xQ@127.0.0.1:${port}/postgres`;
    }
    spawnSync('sleep', ['0.5']);
  }
  throw new Error('O Postgres de teste não ficou pronto a tempo.');
}

let started = false;
const stop = () => { if (started) { sh('docker', ['stop', '-t', '1', name]); started = false; } };
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });

try {
  const env = { ...process.env };
  if (!env.TEST_DATABASE_URL) { env.TEST_DATABASE_URL = startPostgres(); started = true; }
  const files = require('node:fs').readdirSync(path.join(__dirname, '..', 'test')).filter(file => file.endsWith('.test.js')).map(file => path.join('test', file));
  const child = spawn('node', ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit', env, cwd: path.join(__dirname, '..') });
  child.on('exit', code => { stop(); process.exit(code ?? 1); });
} catch (error) {
  stop();
  console.error(error.message);
  process.exit(1);
}
