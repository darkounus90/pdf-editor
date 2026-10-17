#!/usr/bin/env bash
# Copia de seguridad de Postgres con pg_dump (formato custom, comprimido).
# La corre cron una vez al día (ver install-daily-jobs.sh). Guarda las copias en
# $BACKUP_DIR (por defecto ~/renglon-backups) y borra las de más de $BACKUP_KEEP_DAYS días.
#
# Restaurar una copia (reemplaza el contenido actual de la base):
#   docker compose -f deploy/docker-compose.yml exec -T db \
#     pg_restore -U renglon -d renglon --clean --if-exists < ~/renglon-backups/renglon-AAAA-MM-DD-HHMM.dump
set -euo pipefail
cd "$(dirname "$0")"

dir="${BACKUP_DIR:-$HOME/renglon-backups}"
keep="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$dir"
chmod 700 "$dir"

file="$dir/renglon-$(date +%F-%H%M).dump"
# Se escribe a un temporal para no dejar una copia a medias si algo falla.
docker compose exec -T db pg_dump -U renglon -d renglon -Fc >"$file.tmp"
mv "$file.tmp" "$file"
chmod 600 "$file"

find "$dir" -name 'renglon-*.dump' -mtime +"$keep" -delete
echo "$(date -Is) copia lista: $file ($(du -h "$file" | cut -f1))"
