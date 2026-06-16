#!/usr/bin/env bash
# Резервная копия PostgreSQL → backups/minkert-backup-ДАТА.dump
# Использование:
#   ./scripts/backup-db.sh              — из backend/.env (локальная база)
#   ./scripts/backup-db.sh neon         — из backend/.env.neon (облако, файл в .gitignore)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_DUMP="${PG_DUMP:-/opt/homebrew/opt/postgresql@16/bin/pg_dump}"
if ! command -v "$PG_DUMP" >/dev/null 2>&1; then
  PG_DUMP="$(command -v pg_dump || true)"
fi
if [[ -z "$PG_DUMP" ]]; then
  echo "Ошибка: pg_dump не найден. Установите: brew install postgresql@16"
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
# pg_dump не понимает ?schema=public
URL="${RAW_URL//[?&]schema=public/}"
URL="${URL//\?schema=public&/?}"
URL="${URL%\?}"

mkdir -p "$ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
LABEL="local"
[[ "${1:-}" == "neon" ]] && LABEL="neon"
OUT="$ROOT/backups/minkert-${LABEL}-${STAMP}.dump"

echo "Резервная копия → $OUT"
"$PG_DUMP" "$URL" -Fc -f "$OUT"
ls -lh "$OUT"
echo "Готово."
