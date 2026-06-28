#!/usr/bin/env bash
# Загрузка последнего Neon-дампа на Google Drive через rclone.
#
# Однократная настройка: ./scripts/setup-gdrive-backup.sh
#
# Вручную:
#   ./scripts/upload-backup-to-gdrive.sh
#   ./scripts/upload-backup-to-gdrive.sh /path/to/file.dump
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
BACKUP_DIR="$(backup_root)"
LOG_DIR="$BACKUP_DIR"
CONFIG="$ROOT/scripts/.gdrive-backup.env"

if [[ -f "$CONFIG" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG"
fi

RCLONE_REMOTE="${RCLONE_REMOTE:-minkert-gdrive:Minkert-Backups}"
RCLONE="${RCLONE:-$(command -v rclone || true)}"

if [[ -z "$RCLONE" ]]; then
  echo "Ошибка: rclone не найден. Установите: brew install rclone" >&2
  exit 1
fi

REMOTE_NAME="${RCLONE_REMOTE%%:*}"
if ! "$RCLONE" listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
  echo "Ошибка: rclone remote «${REMOTE_NAME}» не настроен." >&2
  echo "Запустите один раз: ./scripts/setup-gdrive-backup.sh" >&2
  exit 1
fi

pick_dump() {
  if [[ -n "${1:-}" && -f "$1" ]]; then
    echo "$1"
    return
  fi
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

DUMP="$(pick_dump "${1:-}")"
if [[ -z "$DUMP" ]]; then
  echo "Нет пригодного Neon-дампа в $LOG_DIR" >&2
  exit 1
fi

BASENAME="$(basename "$DUMP")"
DEST="${RCLONE_REMOTE%/}/$BASENAME"

echo "Загрузка на Google Drive:"
echo "  файл: $DUMP ($(du -h "$DUMP" | awk '{print $1}'))"
echo "  путь: $DEST"

"$RCLONE" copyto "$DUMP" "$DEST" --progress

echo "Проверка на Drive:"
"$RCLONE" ls "$(dirname "$DEST")/" | grep -F "$BASENAME" || true

# Политика: бэкапы НЕ удаляются автоматически (ни на Drive, ни локально).
# См. BACKUP_POLICY.md

echo "Готово: $BASENAME на Google Drive."
