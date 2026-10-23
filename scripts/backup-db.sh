#!/bin/sh
# Backup do Postgres do GeradorOne (SQL comprimido, permissão 600) com rotação de 14 dias.
# Uso: scripts/backup-db.sh        (agende no cron; a pasta é BACKUP_DIR ou ./backups)
set -eu
cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-$PWD/backups}"
mkdir -p "$DIR"
chmod 700 "$DIR"
FILE="$DIR/geradorone-$(date +%Y%m%d-%H%M).sql.gz"
umask 077
docker exec gerador-one-db pg_dump -U geradorone --no-owner geradorone | gzip > "$FILE"
[ -s "$FILE" ] || { echo "backup vazio, abortando" >&2; rm -f "$FILE"; exit 1; }
find "$DIR" -name 'geradorone-*.sql.gz' -mtime +14 -delete
echo "$FILE"
