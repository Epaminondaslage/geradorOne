// Leitura da situação do backup, e nada além disso: o app não executa nem restaura cópias.
// O container é isolado (sem docker.sock, sem acesso ao host). Quem grava os arquivos de status é o cron
// do próprio servidor (scripts/backup-db.sh e, no Proxmox, o registro das cópias do PBS); aqui só se lê
// a pasta MONITOR_DIR, montada em modo somente leitura.
const fs = require('node:fs');
const path = require('node:path');

const MONITOR_DIR = process.env.MONITOR_DIR || path.join(__dirname, '..', 'monitor');
// Em produção a pasta deve existir. Sem ela, no desenvolvimento é o esperado; em produção é falha grave.
const ESPERADO = process.env.BACKUP_ESPERADO === '1';
const HORAS_MAX = 26;

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(MONITOR_DIR, file), 'utf8')); } catch { return null; }
}

function readLog(limit) {
  try { return fs.readFileSync(path.join(MONITOR_DIR, 'backup.log'), 'utf8').trimEnd().split('\n').filter(Boolean).slice(-limit); } catch { return []; }
}

function hoursSince(iso) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? (Date.now() - time) / 3_600_000 : Infinity;
}

// Uma rotina fica "atrasada" se falhou na última execução ou se a última cópia boa passou do limite da agenda.
function routineState(info) {
  if (!info) return { existe: false, atrasada: ESPERADO, ok: null };
  const late = info.ok === false || !(hoursSince(info.fim || info.ultimaCopia) <= HORAS_MAX);
  return { existe: true, atrasada: late, ok: info.ok !== false };
}

function situacao() {
  let available = false;
  try { available = fs.statSync(MONITOR_DIR).isDirectory(); } catch { /* pasta ausente */ }
  if (!available) {
    return {
      disponivel: false,
      gravidade: ESPERADO ? 'erro' : 'informacao',
      aviso: ESPERADO
        ? 'A pasta de status do backup não está acessível. As cópias podem ter parado: verifique o servidor.'
        : 'O backup roda apenas no servidor de produção. Esta instalação é de desenvolvimento e não tem registro de backup.'
    };
  }
  const banco = readJson('backup-db.json');
  const pbs = readJson('pbs.json');
  const logLines = readLog(200);
  const dbState = routineState(banco);
  const pbsState = routineState(pbs);
  return {
    disponivel: true,
    banco: banco && { ...banco, ...dbState, horasMax: HORAS_MAX },
    pbs: pbs && { ...pbs, ...pbsState, horasMax: HORAS_MAX },
    semBanco: !banco,
    semPbs: !pbs,
    protegido: Boolean(banco && pbs) && !dbState.atrasada && !pbsState.atrasada,
    falhasRecentes: logLines.filter(line => /falhou|erro|aviso/i.test(line)).slice(-5),
    log: logLines.slice(-60)
  };
}

module.exports = { situacao, MONITOR_DIR };
