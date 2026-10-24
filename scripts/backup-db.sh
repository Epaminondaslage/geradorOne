#!/bin/bash
# Backup do Postgres do GeradorOne (SQL comprimido, permissão 600), com rotação de 14 dias.
# Uso: scripts/backup-db.sh        (agende no cron; a pasta é BACKUP_DIR ou ./backups)
#
# Ao terminar, grava o resultado em MONITOR_DIR (padrão ./monitor, legível pelo app): backup-db.json e backup.log.
# É o que a aba Backup de Configurações mostra. Nada ali tem dado de usuário.
#
# Modo "rotina no HD" (produção; ver o cron em /etc/cron.d/geradorone-backup):
#   BACKUP_DIR=/backup/lxc-geradorone   pasta própria no HD de backup, nunca no SSD
#   BACKUP_MOUNT=/backup/lxc-geradorone aborta se a pasta não for o ponto de montagem (HD ausente cairia no SSD em silêncio)
#   BACKUP_STATUS_JSON=1                grava status.json na pasta, no formato das outras rotinas do HD
#   BACKUP_COPY_ENV=1                   copia o .env (segredos, modo 600) como env_<data>, com a mesma retenção
set -uo pipefail
cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-$PWD/backups}"
MON="${MONITOR_DIR:-$PWD/monitor}"
RETENCAO="${RETENCAO_DIAS:-14}"
INICIO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Nome no padrão das rotinas do HD (<nome>_AAAAMMDD_HHMMSS), reconhecido pela tela de Backup. Horário local (Brasília no CT de produção).
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$DIR/geradorone_$STAMP.sql.gz"
mkdir -p "$MON"
chmod 755 "$MON"

status_json() { # $1 = true|false, $2 = mensagem (formato das rotinas do HD: rotina, descricao, inicio, fim, ok, mensagem)
  [ "${BACKUP_STATUS_JSON:-0}" = "1" ] && [ -d "$DIR" ] || return 0
  printf '{"rotina":"lxc-geradorone","descricao":"Banco e .env do GeradorOne (prod)","inicio":"%s","fim":"%s","ok":%s,"mensagem":"%s"}\n' \
    "$INICIO" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$(echo "$2" | tr '"' "'")" > "$DIR/status.json" || true
}

registrar() { # $1 = ok|falhou, $2 = mensagem
  echo "$(date '+%Y-%m-%d %H:%M:%S') backup do banco $1: $2" >> "$MON/backup.log"
  tail -n 500 "$MON/backup.log" > "$MON/backup.log.tmp" && mv "$MON/backup.log.tmp" "$MON/backup.log"
  if [ "$1" = "ok" ]; then status_json true "$2"; else status_json false "$2"; fi
  DIR="$DIR" MON="$MON" INICIO="$INICIO" STATUS="$1" MENSAGEM="$2" RETENCAO="$RETENCAO" python3 - <<'PY'
import glob, json, os
dir_, mon = os.environ["DIR"], os.environ["MON"]
copias = []
for path in sorted(glob.glob(os.path.join(dir_, "geradorone[_-]*.sql.gz")), reverse=True):
    info = os.stat(path)
    nome = os.path.basename(path)
    # novo: geradorone_AAAAMMDD_HHMMSS; antigo: geradorone-AAAAMMDD-HHMM. A tela quer AAAAMMDD-HHMM.
    partes = nome[len("geradorone_"):-len(".sql.gz")].replace("-", "_").split("_")
    data = partes[0] + "-" + partes[1][:4] if len(partes) > 1 else ""
    copias.append({"nome": nome, "bytes": info.st_size, "data": data})
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

falha() { # $1 = mensagem
  rm -f "$FILE"
  registrar falhou "$1"
  echo "ERRO: $1" >&2
  exit 1
}

# Se o HD não estiver montado, a pasta cairia no SSD em silêncio.
if [ -n "${BACKUP_MOUNT:-}" ]; then
  mkdir -p "$DIR"
  PONTO=$(df --output=target "$DIR" | tail -1)
  [ "$PONTO" = "$BACKUP_MOUNT" ] || falha "destino $DIR não está no HD ($BACKUP_MOUNT não montado? ponto atual: $PONTO)"
fi
mkdir -p "$DIR"
chmod 700 "$DIR"

umask 077
# Sob o Coolify o contêiner se chama db-<uuid>; o volume do banco é sempre geradorone_pgdata.
DB_CONTAINER="${DB_CONTAINER:-$(docker ps --filter volume=geradorone_pgdata --format '{{.Names}}' | head -1)}"
DB_CONTAINER="${DB_CONTAINER:-gerador-one-db}"
if ! docker exec "$DB_CONTAINER" pg_dump -U geradorone --no-owner geradorone </dev/null | gzip > "$FILE" || [ ! -s "$FILE" ]; then
  falha "pg_dump não gerou arquivo"
fi
gunzip -t "$FILE" || falha "arquivo corrompido (gunzip -t)"
FIM=$(zcat "$FILE" | tail -5)   # variável, não pipe com grep -q: com pipefail o grep fecha o pipe antes e a checagem falharia
case "$FIM" in *"PostgreSQL database dump complete"*) ;; *) falha "dump incompleto" ;; esac

if [ "${BACKUP_COPY_ENV:-0}" = "1" ] && [ -f .env ]; then
  install -m 600 .env "$DIR/env_$STAMP"
fi

find "$DIR" -maxdepth 1 \( -name 'geradorone[_-]*.sql.gz' -o -name 'env_*' \) -mtime +"$RETENCAO" -delete
registrar ok "$(basename "$FILE") ($(stat -c %s "$FILE") bytes)"
echo "$FILE"
