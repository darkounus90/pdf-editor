#!/usr/bin/env bash
# Pide a la web que envíe los avisos de planes por vencer. La corre cron una vez
# al día (ver install-daily-jobs.sh). Usa DOMAIN y CRON_SECRET de deploy/.env.
set -euo pipefail
cd "$(dirname "$0")"

read_env() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"; }
domain="$(read_env DOMAIN)"
secret="$(read_env CRON_SECRET)"
if [ -z "$secret" ]; then
  echo "$(date -Is) falta CRON_SECRET en deploy/.env; no se envían avisos"
  exit 0
fi

echo "$(date -Is) $(curl -fsS --max-time 60 -H "Authorization: Bearer $secret" "https://$domain/api/cron/avisos")"
