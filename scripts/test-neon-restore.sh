#!/usr/bin/env bash
# Проверка восстановления: последний Neon-дамп → локальная тестовая БД + подсчёт данных.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
BACKUP_DIR="$(backup_root)"
LOG_DIR="$BACKUP_DIR"
TEST_DB="${RESTORE_TEST_DB:-minkert_restore_test}"
ENV_FILE="$ROOT/backend/.env"

export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

PSQL="${PSQL:-$(command -v psql || true)}"
PG_RESTORE="${PG_RESTORE:-$(command -v pg_restore || true)}"

if [[ -z "$PSQL" || -z "$PG_RESTORE" ]]; then
  echo "Нужны psql и pg_restore (brew install postgresql@16)" >&2
  exit 1
fi

read_local_url() {
  if [[ -n "${RESTORE_TEST_DATABASE_URL:-}" ]]; then
    echo "$RESTORE_TEST_DATABASE_URL"
    return
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Нет $ENV_FILE для локального Postgres" >&2
    exit 1
  fi
  grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'"
}

admin_url() {
  local url="$1"
  url="${url%%\?*}"
  url="${url%/*}/postgres"
  echo "$url"
}

test_db_url() {
  local url="$1"
  url="${url%%\?*}"
  url="${url%/*}/${TEST_DB}"
  echo "$url"
}

pick_latest_valid_dump() {
  local best="" best_mtime=0 f m size
  for f in "$LOG_DIR"/minkert-neon-*.dump; do
    [[ -f "$f" ]] || continue
    size=$(stat -f%z "$f" 2>/dev/null || echo 0)
    if [[ "$size" -le 1024 ]]; then
      echo "Пропуск пустого/битого дампа: $(basename "$f") (${size} байт)" >&2
      continue
    fi
    m=$(stat -f%m "$f" 2>/dev/null || echo 0)
    if [[ "$m" -gt "$best_mtime" ]]; then
      best_mtime=$m
      best=$f
    fi
  done
  echo "$best"
}

DUMP="$(pick_latest_valid_dump)"

if [[ -z "$DUMP" ]]; then
  echo "Нет пригодных Neon-дампов (нужен размер > 1 КБ)" >&2
  exit 1
fi
LOCAL_URL="$(read_local_url)"
ADMIN_URL="$(admin_url "$LOCAL_URL")"
TARGET_URL="$(test_db_url "$LOCAL_URL")"

echo "Дамп: $(basename "$DUMP") ($(du -h "$DUMP" | awk '{print $1}'))"

"$PSQL" "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${TEST_DB};"
"$PSQL" "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${TEST_DB};"

set +e
"$PG_RESTORE" --no-owner --no-acl -d "$TARGET_URL" "$DUMP" >/dev/null 2>&1
restore_code=$?
set -e

if [[ $restore_code -gt 1 ]]; then
  echo "Ошибка pg_restore (код $restore_code)" >&2
  exit 1
fi

count_table() {
  local table="$1"
  "$PSQL" "$TARGET_URL" -t -A -c "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "—"
}

latest_client_update() {
  "$PSQL" "$TARGET_URL" -t -A -c \
    "SELECT COALESCE(MAX(\"updatedAt\")::text, '—') FROM \"CrmClient\";" 2>/dev/null || echo "—"
}

echo "Восстановление в БД «${TEST_DB}»: OK (код pg_restore: ${restore_code})"

crm_clients="$(count_table CrmClient)"
if [[ "$crm_clients" == "—" ]]; then
  echo "Ошибка: таблица CrmClient не найдена — дамп не восстановился" >&2
  exit 1
fi

echo "CrmClient:        ${crm_clients}"
echo "CrmAppointment:   $(count_table CrmAppointment)"
echo "CrmProcedure:     $(count_table CrmProcedure)"
echo "LoyaltyClient:    $(count_table LoyaltyClient)"
echo "LoyaltyStamp:     $(count_table LoyaltyStamp)"
echo "Последнее изменение CrmClient: $(latest_client_update)"
