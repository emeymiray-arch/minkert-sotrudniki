#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
BACKUP_DIR="$(backup_root)"
LOG_FILE="$BACKUP_DIR/restore-test.log"

export PATH="/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') — проверка восстановления ==="
  "$ROOT/scripts/test-neon-restore.sh"
  echo "=== проверка пройдена ==="
  echo
} >>"$LOG_FILE" 2>&1
