#!/bin/bash
# Backup do Postgres do GeradorOne (SQL comprimido, permissão 600) com rotação de 14 dias.
# Uso: scripts/backup-db.sh        (agende no cron; a pasta é BACKUP_DIR ou ./backups)
# Ao terminar, grava o resultado em MONITOR_DIR (padrão ./monitor, legível pelo app): backup-db.json e backup.log.
# É o que a aba Backup de Configurações mostra. Nada ali tem dado de usuário.
set -uo pipefail
cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-$PWD/backups}"
MON="${MONITOR_DIR:-$PWD/monitor}"
RETENCAO=14
mkdir -p "$DIR" "$MON"
chmod 700 "$DIR"
chmod 755 "$MON"
INICIO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
FILE="$DIR/geradorone-$(date +%Y%m%d-%H%M).sql.gz"

registrar() { # $1 = ok|falhou, $2 = mensagem
  echo "$(date '+%Y-%m-%d %H:%M:%S') backup do banco $1: $2" >> "$MON/backup.log"
  tail -n 500 "$MON/backup.log" > "$MON/backup.log.tmp" && mv "$MON/backup.log.tmp" "$MON/backup.log"
  DIR="$DIR" MON="$MON" INICIO="$INICIO" STATUS="$1" MENSAGEM="$2" ARQUIVO="$FILE" RETENCAO="$RETENCAO" python3 - <<'PY'
import glob, json, os
dir_, mon = os.environ["DIR"], os.environ["MON"]
copias = []
for path in sorted(glob.glob(os.path.join(dir_, "geradorone-*.sql.gz")), reverse=True):
    info = os.stat(path)
    copias.append({"nome": os.path.basename(path), "bytes": info.st_size, "data": os.path.basename(path)[11:24]})
from datetime import datetime, timezone
agora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
ok = os.environ["STATUS"] == "ok"
status = {
    "rotina": "banco", "descricao": "Banco de dados (pg_dump comprimido)", "agenda": "diário 03:15",
    "retencaoDias": int(os.environ["RETENCAO"]), "inicio": os.environ["INICIO"], "fim": agora, "ok": ok,
    "mensagem": os.environ["MENSAGEM"], "copias": copias[:40],
}
tmp = os.path.join(mon, "backup-db.json.tmp")
with open(tmp, "w") as handle:
    json.dump(status, handle, ensure_ascii=False)
os.replace(tmp, os.path.join(mon, "backup-db.json"))
os.chmod(os.path.join(mon, "backup-db.json"), 0o644)
PY
  chmod 644 "$MON/backup.log" 2>/dev/null
}

umask 077
# Sob o Coolify o contêiner se chama db-<uuid>; o volume do banco é sempre geradorone_pgdata.
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --filter volume=geradorone_pgdata --format '{{.Names}}' | head -1)}"
DB_CONTAINER="${DB_CONTAINER:-gerador-one-db}"
if ! docker exec "$DB_CONTAINER" pg_dump -U geradorone --no-owner geradorone | gzip > "$FILE" || [ ! -s "$FILE" ]; then
  rm -f "$FILE"
  registrar falhou "pg_dump não gerou arquivo"
  echo "backup vazio, abortando" >&2
  exit 1
fi
find "$DIR" -name 'geradorone-*.sql.gz' -mtime +"$RETENCAO" -delete
registrar ok "$(basename "$FILE") ($(stat -c %s "$FILE") bytes)"
echo "$FILE"
