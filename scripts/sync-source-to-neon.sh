#!/usr/bin/env bash
# Полная копия данных из любой PostgreSQL-базы → Neon (backend/.env.neon).
#
# Использование:
#   # Источник = DATABASE_URL из Render (вставьте в команду или в файл)
#   SOURCE_DATABASE_URL='postgresql://...' ./scripts/sync-source-to-neon.sh
#
#   # Или источник из файла backend/.env.production (создайте сами, в .gitignore)
#   ./scripts/sync-source-to-neon.sh production
#
#   # Локальная база → Neon
#   ./scripts/sync-source-to-neon.sh local
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=backup-paths.sh
source "$ROOT/scripts/backup-paths.sh"
migrate_legacy_backups
ensure_backup_dir
BACKUP_DIR="$(backup_root)"
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

PG_DUMP="${PG_DUMP:-$(command -v pg_dump)}"
PG_RESTORE="${PG_RESTORE:-$(command -v pg_restore)}"
PSQL="${PSQL:-$(command -v psql)}"

read_url_from_file() {
  local f="$1"
  grep -E '^DATABASE_URL=' "$f" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'"
}

normalize_url() {
  local u="$1"
  u="${u//[?&]schema=public/}"
  u="${u//\?schema=public&/?}"
  u="${u%\?}"
  echo "$u"
}

SOURCE_MODE="${1:-}"
if [[ -n "${SOURCE_DATABASE_URL:-}" ]]; then
  SRC="$(normalize_url "$SOURCE_DATABASE_URL")"
elif [[ "$SOURCE_MODE" == "local" ]]; then
  SRC="$(normalize_url "$(read_url_from_file "$ROOT/backend/.env")")"
elif [[ "$SOURCE_MODE" == "production" ]]; then
  SRC="$(normalize_url "$(read_url_from_file "$ROOT/backend/.env.production")")"
else
  echo "Укажите источник:"
  echo "  SOURCE_DATABASE_URL='postgresql://...' $0"
  echo "  $0 local"
  echo "  $0 production   # backend/.env.production"
  exit 1
fi

if [[ ! -f "$ROOT/backend/.env.neon" ]]; then
  echo "Нет backend/.env.neon" >&2
  exit 1
fi

NEON="$(normalize_url "$(read_url_from_file "$ROOT/backend/.env.neon")")"

echo "═══ Синхронизация PostgreSQL → Neon ═══"
echo "Источник:  $(echo "$SRC" | sed -E 's#://[^@]+@#://***@#')"
echo "Назначение: $(echo "$NEON" | sed -E 's#://[^@]+@#://***@#')"
echo ""

echo "── Данные в ИСТОЧНИКЕ ──"
for t in User Employee CrmClient CrmAppointment CrmProcedure CrmMaster LoyaltyClient OpsTask OpsViolation OpsProblem OpsFinanceDay AppNotification Task; do
  c=$("$PSQL" "$SRC" -t -A -c "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null || echo "—")
  printf "  %-18s %s\n" "$t" "$c"
done

echo ""
read -r -p "Продолжить копирование в Neon? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Отменено."
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/sync-to-neon-${STAMP}.dump"
mkdir -p "$BACKUP_DIR"

echo "Бэкап источника → $DUMP"
"$PG_DUMP" "$SRC" -Fc -f "$DUMP"

echo "Восстановление в Neon (это заменит данные в Neon копией из источника)..."
"$PG_RESTORE" -d "$NEON" --no-owner --no-acl --clean --if-exists "$DUMP" 2>&1 | tail -10 || true

echo ""
echo "── Данные в NEON после копирования ──"
for t in User Employee CrmClient CrmAppointment CrmProcedure CrmMaster LoyaltyClient OpsTask OpsViolation OpsProblem OpsFinanceDay AppNotification Task; do
  c=$("$PSQL" "$NEON" -t -A -c "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null || echo "—")
  printf "  %-18s %s\n" "$t" "$c"
done

echo ""
echo "Применение миграций..."
(cd "$ROOT/backend" && DATABASE_URL="$NEON" npx prisma migrate deploy)

echo ""
echo "Готово. Сделайте бэкап Neon:"
echo "  ./scripts/backup-db.sh neon"
