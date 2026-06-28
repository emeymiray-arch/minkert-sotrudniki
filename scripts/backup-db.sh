#!/usr/bin/env bash
# Резервная копия PostgreSQL → backups/Minkert-Backups/minkert-{local|neon}-ДАТА.dump
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
ensure_backup_dir
BACKUP_DIR="$(backup_root)"

PG_DUMP="${PG_DUMP:-/opt/homebrew/opt/postgresql@17/bin/pg_dump}"
if ! command -v "$PG_DUMP" >/dev/null 2>&1; then
  PG_DUMP="/opt/homebrew/opt/postgresql@16/bin/pg_dump"
fi
if ! command -v "$PG_DUMP" >/dev/null 2>&1; then
  PG_DUMP="$(command -v pg_dump || true)"
fi
if [[ -z "$PG_DUMP" ]]; then
  echo "Ошибка: pg_dump не найден. Установите: brew install postgresql@17"
  exit 1
fi

ENV_FILE="$ROOT/backend/.env"
if [[ "${1:-}" == "neon" ]]; then
  ENV_FILE="$ROOT/backend/.env.neon"
fi

read_url() {
  if [[ -n "${BACKUP_DATABASE_URL:-}" ]]; then
    echo "$BACKUP_DATABASE_URL"
    return
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Нет файла $ENV_FILE" >&2
    exit 1
  fi
  grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'"
}

RAW_URL="$(read_url)"
URL="${RAW_URL//[?&]schema=public/}"
URL="${URL//\?schema=public&/?}"
URL="${URL%\?}"

STAMP="$(date +%Y%m%d-%H%M%S)"
LABEL="local"
[[ "${1:-}" == "neon" ]] && LABEL="neon"
OUT="$BACKUP_DIR/minkert-${LABEL}-${STAMP}.dump"

echo "Резервная копия → $OUT"
"$PG_DUMP" "$URL" -Fc -f "$OUT"
ls -lh "$OUT"
echo "Папка всех бэкапов: $BACKUP_DIR"
echo "Готово."
