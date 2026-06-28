#!/usr/bin/env bash
# Копирует последний Neon-дамп в папку Google Drive (синхронизация через приложение Google).
# Не требует rclone — достаточно войти в Google Drive на Mac один раз.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
BACKUP_DIR="$(backup_root)"
LOG_DIR="$BACKUP_DIR"
FOLDER_NAME="${GDRIVE_FOLDER_NAME:-Minkert-Backups}"

find_gdrive_root() {
  local d
  for d in "$HOME/Library/CloudStorage"/GoogleDrive-*; do
    [[ -d "$d" ]] || continue
    if [[ -d "$d/My Drive" ]]; then
      echo "$d/My Drive"
      return 0
    fi
    if [[ -d "$d/Мой диск" ]]; then
      echo "$d/Мой диск"
      return 0
    fi
    echo "$d"
    return 0
  done
  if [[ -d "$HOME/Google Drive/My Drive" ]]; then
    echo "$HOME/Google Drive/My Drive"
    return 0
  fi
  return 1
}

pick_dump() {
  local best="" best_mtime=0 f m size
  for f in "$LOG_DIR"/minkert-neon-*.dump; do
    [[ -f "$f" ]] || continue
    size=$(stat -f%z "$f" 2>/dev/null || echo 0)
    [[ "$size" -le 1024 ]] && continue
    m=$(stat -f%m "$f" 2>/dev/null || echo 0)
    if [[ "$m" -gt "$best_mtime" ]]; then
      best_mtime=$m
      best=$f
    fi
  done
  echo "$best"
}

GDRIVE_ROOT="$(find_gdrive_root || true)"
if [[ -z "$GDRIVE_ROOT" ]]; then
  echo "GOOGLE_DRIVE_NOT_READY"
  exit 2
fi

TARGET="$GDRIVE_ROOT/$FOLDER_NAME"
mkdir -p "$TARGET"

DUMP="$(pick_dump)"
if [[ -z "$DUMP" ]]; then
  echo "Нет Neon-дампа для копирования" >&2
  exit 1
fi

cp -f "$DUMP" "$TARGET/"
echo "Скопировано: $(basename "$DUMP") → $TARGET/"
ls -lh "$TARGET/$(basename "$DUMP")"

# Все копии сохраняются навсегда — автоудаление отключено (BACKUP_POLICY.md)

echo "OK"
