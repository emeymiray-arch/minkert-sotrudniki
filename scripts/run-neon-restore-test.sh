#!/usr/bin/env bash
# Обёртка для launchd: еженедельная проверка восстановления Neon-дампа.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$ROOT/backups/restore-test.log"

export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p "$ROOT/backups"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') — проверка восстановления ==="
  "$ROOT/scripts/test-neon-restore.sh"
  echo "=== проверка пройдена ==="
  echo
} >>"$LOG_FILE" 2>&1
