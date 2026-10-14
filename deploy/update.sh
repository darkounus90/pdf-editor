#!/usr/bin/env bash
# Actualiza la app en el servidor con la última versión de main.
set -euo pipefail
cd "$(dirname "$0")"
git -C .. pull --ff-only
docker compose up -d --build
docker image prune -f
docker compose ps
