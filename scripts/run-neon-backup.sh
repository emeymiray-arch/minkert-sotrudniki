#!/usr/bin/env bash
# Обёртка для launchd: бэкап Neon + лог (все копии сохраняются).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT/backups"
LOG_FILE="$LOG_DIR/neon-backup.log"

export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p "$LOG_DIR"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') — старт ==="

  if [[ ! -f "$ROOT/backend/.env.neon" ]]; then
    echo "Ошибка: нет $ROOT/backend/.env.neon (см. backend/.env.neon.example)"
    exit 1
  fi

  "$ROOT/scripts/backup-db.sh" neon

  shopt -s nullglob
  dumps=( "$LOG_DIR"/minkert-neon-*.dump )
  shopt -u nullglob
  echo "Всего Neon-копий в архиве: ${#dumps[@]}"

  echo "=== готово ==="
  echo
} >>"$LOG_FILE" 2>&1
