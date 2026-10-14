#!/usr/bin/env bash
# Lo ejecuta cron cada 5 minutos. Si main cambió en GitHub y la CI de ese
# commit pasó, vuelve a desplegar con update.sh. Si la CI falló, no despliega
# y no lo vuelve a intentar con ese mismo commit.
set -euo pipefail

REPO="darkounus90/pdf-editor"
cd "$(dirname "$0")/.."

# Evita dos ejecuciones a la vez si un despliegue tarda más de 5 minutos.
exec 9>/tmp/renglon-auto-update.lock
flock -n 9 || exit 0

git fetch -q origin main
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse origin/main)
[ "$local_sha" = "$remote_sha" ] && exit 0

skip_file="$HOME/.renglon-skip-sha"
[ -f "$skip_file" ] && [ "$(cat "$skip_file")" = "$remote_sha" ] && exit 0

log() { echo "$(date -Is) $*"; }

ci=$(curl -fsS "https://api.github.com/repos/$REPO/actions/runs?head_sha=$remote_sha&per_page=1" |
  python3 -c 'import json,sys; r=json.load(sys.stdin).get("workflow_runs") or [{}]; print(r[0].get("status","none"), r[0].get("conclusion"))') || {
  log "no se pudo consultar la CI de ${remote_sha:0:7}; se reintenta luego"
  exit 0
}

case "$ci" in
  "completed success")
    log "desplegando ${remote_sha:0:7}"
    ./deploy/update.sh
    log "desplegado ${remote_sha:0:7}"
    ;;
  completed\ *)
    log "la CI de ${remote_sha:0:7} terminó en '${ci#completed }'; no se despliega"
    echo "$remote_sha" >"$skip_file"
    ;;
  *)
    # La CI aún no empieza o sigue corriendo: se revisa en la próxima vuelta.
    exit 0
    ;;
esac
