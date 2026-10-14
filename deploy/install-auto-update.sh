#!/usr/bin/env bash
# Instala (o reinstala) la tarea de cron que despliega solo los cambios de main.
# Se puede correr varias veces: reemplaza la línea anterior en vez de duplicarla.
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$dir/auto-update.sh" "$dir/update.sh"
line="*/5 * * * * $dir/auto-update.sh >> $HOME/renglon-deploy.log 2>&1"

{ crontab -l 2>/dev/null | grep -v 'auto-update.sh' || true; echo "$line"; } | crontab -
echo "Tarea instalada:"
crontab -l | grep 'auto-update.sh'
echo "Registro: $HOME/renglon-deploy.log"
