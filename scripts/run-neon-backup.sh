#!/usr/bin/env bash
# Обёртка для launchd: бэкап Neon + Google Drive + лог.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
ensure_backup_dir
BACKUP_DIR="$(backup_root)"
LOG_FILE="$BACKUP_DIR/neon-backup.log"

export PATH="/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') — старт ==="
  echo "Папка: $BACKUP_DIR"

  if [[ ! -f "$ROOT/backend/.env.neon" ]]; then
    echo "Ошибка: нет $ROOT/backend/.env.neon"
    exit 1
  fi

  "$ROOT/scripts/backup-db.sh" neon

  if "$ROOT/scripts/sync-backup-to-gdrive-folder.sh" 2>/dev/null; then
    echo "Google Drive (папка): OK"
  elif [[ -f "$ROOT/scripts/.gdrive-backup.env" ]] && "$ROOT/scripts/upload-backup-to-gdrive.sh" 2>/dev/null; then
    echo "Google Drive (rclone): OK"
  else
    echo "Google Drive: не подключён"
  fi

  shopt -s nullglob
  dumps=( "$BACKUP_DIR"/minkert-neon-*.dump )
  shopt -u nullglob
  echo "Всего Neon-копий в папке: ${#dumps[@]}"

  echo "=== готово ==="
  echo
} >>"$LOG_FILE" 2>&1
