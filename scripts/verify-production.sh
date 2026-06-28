#!/usr/bin/env bash
# Быстрая проверка продакшн API (задайте MINKERT_API_URL или аргументом).
set -euo pipefail

API="${1:-${MINKERT_API_URL:-}}"
if [[ -z "$API" ]]; then
  echo "Использование: MINKERT_API_URL=https://xxx.onrender.com $0"
  echo "           или: $0 https://xxx.onrender.com"
  exit 1
fi

API="${API%/}"
BASE="${API%/api}"

echo "═══ Проверка $BASE ═══"
echo ""
echo "Health:"
curl -sf "$BASE/api/health" | python3 -m json.tool 2>/dev/null || curl -sf "$BASE/api/health"
echo ""
echo "Data:"
curl -sf "$BASE/api/health/data" | python3 -m json.tool 2>/dev/null || curl -sf "$BASE/api/health/data"
echo ""
