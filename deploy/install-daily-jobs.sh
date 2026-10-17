#!/usr/bin/env bash
# Instala (o reinstala) las tareas diarias de cron:
#   - 03:30 copia de seguridad de Postgres (backup-db.sh)
#   - 14:00 avisos de planes por vencer (send-reminders.sh); 14:00 UTC = 9:00 en Colombia.
# Las horas son las del reloj del servidor (`date` para verlo).
# Se puede correr varias veces: reemplaza las líneas anteriores en vez de duplicarlas.
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$dir/backup-db.sh" "$dir/send-reminders.sh"
backup="30 3 * * * $dir/backup-db.sh >> $HOME/renglon-backup.log 2>&1"
reminders="0 14 * * * $dir/send-reminders.sh >> $HOME/renglon-avisos.log 2>&1"

{ crontab -l 2>/dev/null | grep -v -e 'backup-db.sh' -e 'send-reminders.sh' || true; echo "$backup"; echo "$reminders"; } | crontab -
echo "Tareas instaladas:"
crontab -l | grep -e 'backup-db.sh' -e 'send-reminders.sh'
echo "Registros: $HOME/renglon-backup.log y $HOME/renglon-avisos.log"
