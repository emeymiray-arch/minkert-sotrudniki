#!/usr/bin/env bash
# Единая папка всех бэкапов Minkert (Mac + то же имя на Google Drive).
MINKERT_BACKUP_DIR_NAME="Minkert-Backups"

backup_root() {
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  echo "$root/backups/$MINKERT_BACKUP_DIR_NAME"
}

ensure_backup_dir() {
  mkdir -p "$(backup_root)"
}

# Перенос старых файлов из backups/ в backups/Minkert-Backups/ (один раз)
migrate_legacy_backups() {
  local root dir legacy
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  dir="$root/backups/$MINKERT_BACKUP_DIR_NAME"
  mkdir -p "$dir"

  shopt -s nullglob
  for legacy in \
    "$root/backups"/minkert-*.dump \
    "$root/backups"/sync-to-neon-*.dump \
    "$root/backups"/*.log; do
    [[ -e "$legacy" ]] || continue
    [[ "$(dirname "$legacy")" == "$dir" ]] && continue
    mv "$legacy" "$dir/" 2>/dev/null || true
  done
  shopt -u nullglob
}
