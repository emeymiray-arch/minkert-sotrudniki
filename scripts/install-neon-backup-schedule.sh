#!/usr/bin/env bash
# Устанавливает на macOS (launchd):
#   • бэкап Neon — каждые 3 дня (все копии хранятся)
#   • проверка восстановления — каждый понедельник в 09:00 (+ сразу при установке)
#
#   ./scripts/install-neon-backup-schedule.sh          — установить
#   ./scripts/install-neon-backup-schedule.sh remove — удалить
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
ensure_backup_dir
BACKUP_DIR="$(backup_root)"
BACKUP_LABEL="com.minkert.neon-backup"
RESTORE_LABEL="com.minkert.neon-restore-test"
BACKUP_PLIST="$HOME/Library/LaunchAgents/${BACKUP_LABEL}.plist"
RESTORE_PLIST="$HOME/Library/LaunchAgents/${RESTORE_LABEL}.plist"
BACKUP_RUNNER="$ROOT/scripts/run-neon-backup.sh"
RESTORE_RUNNER="$ROOT/scripts/run-neon-restore-test.sh"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-259200}"
RESTORE_HOUR="${RESTORE_TEST_HOUR:-13}"
RESTORE_MINUTE="${RESTORE_TEST_MINUTE:-0}"
RESTORE_WEEKDAY="${RESTORE_TEST_WEEKDAY:-1}" # 1 = понедельник

uid="$(id -u)"
domain="gui/${uid}"

unload_agent() {
  local plist="$1"
  launchctl bootout "$domain" "$plist" 2>/dev/null || true
}

if [[ "${1:-}" == "remove" ]]; then
  unload_agent "$BACKUP_PLIST"
  unload_agent "$RESTORE_PLIST"
  rm -f "$BACKUP_PLIST" "$RESTORE_PLIST"
  echo "Автобэкап и проверка восстановления отключены."
  exit 0
fi

if [[ ! -f "$ROOT/backend/.env.neon" ]]; then
  echo "Сначала создайте backend/.env.neon с DATABASE_URL из Neon."
  echo "Шаблон: cp backend/.env.neon.example backend/.env.neon"
  exit 1
fi

if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "Нужен backend/.env с локальным DATABASE_URL для проверки восстановления."
  exit 1
fi

chmod +x \
  "$ROOT/scripts/backup-db.sh" \
  "$BACKUP_RUNNER" \
  "$ROOT/scripts/test-neon-restore.sh" \
  "$RESTORE_RUNNER"

mkdir -p "$HOME/Library/LaunchAgents" "$BACKUP_DIR"

cat >"$BACKUP_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${BACKUP_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${BACKUP_RUNNER}</string>
  </array>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${BACKUP_DIR}/launchd-backup-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${BACKUP_DIR}/launchd-backup-stderr.log</string>
</dict>
</plist>
EOF

cat >"$RESTORE_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${RESTORE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${RESTORE_RUNNER}</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>${RESTORE_WEEKDAY}</integer>
    <key>Hour</key>
    <integer>${RESTORE_HOUR}</integer>
    <key>Minute</key>
    <integer>${RESTORE_MINUTE}</integer>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${BACKUP_DIR}/launchd-restore-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${BACKUP_DIR}/launchd-restore-stderr.log</string>
</dict>
</plist>
EOF

unload_agent "$BACKUP_PLIST"
unload_agent "$RESTORE_PLIST"

launchctl bootstrap "$domain" "$BACKUP_PLIST"
launchctl enable "$domain/${BACKUP_LABEL}" 2>/dev/null || true

launchctl bootstrap "$domain" "$RESTORE_PLIST"
launchctl enable "$domain/${RESTORE_LABEL}" 2>/dev/null || true

echo "Расписание установлено."
echo ""
echo "Бэкап Neon:"
echo "  Каждые $((INTERVAL_SECONDS / 86400)) дн., все копии в $BACKUP_DIR/"
echo "  Лог: $BACKUP_DIR/neon-backup.log"
echo ""
echo "Проверка восстановления:"
echo "  Каждый понедельник в $(printf '%02d:%02d' "$RESTORE_HOUR" "$RESTORE_MINUTE"), первая — сейчас"
echo "  Лог: $BACKUP_DIR/restore-test.log"
echo "  Тестовая БД: minkert_restore_test (локальный Postgres)"
echo ""
echo "Проверка:"
echo "  launchctl print ${domain}/${BACKUP_LABEL}"
echo "  launchctl print ${domain}/${RESTORE_LABEL}"
echo ""
echo "Вручную:"
echo "  ./scripts/test-neon-restore.sh"
echo ""
echo "Отключить: ./scripts/install-neon-backup-schedule.sh remove"
