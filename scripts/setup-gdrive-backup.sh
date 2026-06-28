#!/usr/bin/env bash
# Однократная настройка Google Drive для автобэкапов Minkert.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/scripts/.gdrive-backup.env"
REMOTE_NAME="${RCLONE_REMOTE_NAME:-minkert-gdrive}"
FOLDER="${GDRIVE_FOLDER:-Minkert-Backups}"

RCLONE="$(command -v rclone || true)"
if [[ -z "$RCLONE" ]]; then
  echo "Устанавливаю rclone…"
  brew install rclone
  RCLONE="$(command -v rclone)"
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Настройка Google Drive для бэкапов Minkert              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Будет создан rclone-remote: ${REMOTE_NAME}"
echo "Папка на Drive: ${FOLDER}/"
echo ""

if "$RCLONE" listremotes 2>/dev/null | grep -q "^${REMOTE_NAME}:$"; then
  echo "Remote «${REMOTE_NAME}» уже есть."
else
  echo "Сейчас откроется браузер — войдите в Google и разрешите доступ."
  echo "Нажмите Enter для продолжения…"
  read -r _

  "$RCLONE" config create "$REMOTE_NAME" drive scope drive

  echo ""
  echo "Remote «${REMOTE_NAME}» создан."
fi

cat >"$CONFIG" <<EOF
# Локальная настройка загрузки на Google Drive (не коммитить)
RCLONE_REMOTE=${REMOTE_NAME}:${FOLDER}
KEEP_ALL_BACKUPS=1
EOF

chmod 600 "$CONFIG"

echo ""
echo "Конфиг сохранён: scripts/.gdrive-backup.env"
echo ""
echo "Проверка — загрузка последнего дампа…"
"$ROOT/scripts/upload-backup-to-gdrive.sh" || {
  echo ""
  echo "Если загрузка не удалась — проверьте интернет и повторите:"
  echo "  ./scripts/upload-backup-to-gdrive.sh"
  exit 1
}

echo ""
echo "✓ Google Drive подключён."
echo "  Каждый автобэкап Neon (раз в 3 дня) будет копироваться на Drive."
echo "  Папка: Google Drive → ${FOLDER}/"
echo ""
echo "Вручную: npm run db:upload-gdrive"
