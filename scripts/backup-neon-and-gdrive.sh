#!/usr/bin/env bash
# Полный цикл: бэкап Neon → Google Drive (папка или rclone).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/opt/postgresql@17/bin:/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:$PATH"

echo "1/3 Бэкап Neon…"
"$ROOT/scripts/backup-db.sh" neon

echo ""
echo "2/3 Загрузка на Google Drive…"

if "$ROOT/scripts/sync-backup-to-gdrive-folder.sh" 2>/dev/null; then
  echo "✓ Google Drive (папка): готово"
  exit 0
fi

if [[ -f "$ROOT/scripts/.gdrive-backup.env" ]] && "$ROOT/scripts/upload-backup-to-gdrive.sh" 2>/dev/null; then
  echo "✓ Google Drive (rclone): готово"
  exit 0
fi

echo ""
echo "3/3 Google Drive ещё не подключён."
if [[ "$(uname)" == "Darwin" ]] && [[ ! -d "/Applications/Google Drive.app" ]]; then
  echo "Устанавливаю Google Drive…"
  brew install --cask google-drive 2>/dev/null || true
fi

if [[ -d "/Applications/Google Drive.app" ]]; then
  open -a "Google Drive" 2>/dev/null || open "/Applications/Google Drive.app" 2>/dev/null || true
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  Остался ОДИН шаг (30 секунд):                       ║"
  echo "║  1. Откроется Google Drive                           ║"
  echo "║  2. Войдите в свой Google-аккаунт                  ║"
  echo "║  3. Запустите снова: npm run backup:all              ║"
  echo "╚══════════════════════════════════════════════════════╝"
else
  echo "Установите Google Drive: brew install --cask google-drive"
fi
exit 0
