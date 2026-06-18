#!/usr/bin/env bash
# Чеклист Minkert — запускайте из корня репозитория.
# Использование: bash scripts/run-owner-checklist.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Minkert — чеклист деплоя и защиты"
echo "══════════════════════════════════════════════════════════"
echo ""

# ── 1. GitHub push ──────────────────────────────────────────
echo "▶ Шаг 1/6: Push на GitHub"
echo "  Если ошибка «workflow scope» — см. SECURITY.md или:"
echo "  GitHub → Settings → Developer settings → PAT → включить workflow"
echo ""
git push origin main || {
  echo ""
  echo "⚠ Push не прошёл. Варианты:"
  echo "  A) Обновить PAT с scope workflow и снова: git push origin main"
  echo "  B) Push через GitHub Desktop / SSH"
  echo "  C) Временно без CI: git push origin main --no-verify (не поможет с PAT)"
  echo ""
}

# ── 2. Локальная сборка ───────────────────────────────────
echo ""
echo "▶ Шаг 2/6: Сборка backend"
cd "$ROOT/backend"
npm ci
npm run build

echo ""
echo "▶ Шаг 3/6: Тесты backend"
npm test

echo ""
echo "▶ Шаг 4/6: Сборка frontend"
cd "$ROOT/frontend"
npm ci
npm run build

# ── 5. Бэкап Neon (если настроен .env.neon) ───────────────
echo ""
echo "▶ Шаг 5/6: Бэкап базы Neon (опционально)"
cd "$ROOT"
if [[ -f backend/.env.neon ]]; then
  bash scripts/run-neon-backup.sh && echo "✓ Бэкап создан"
else
  echo "  Пропуск: нет backend/.env.neon"
  echo "  Создайте: cp backend/.env.neon.example backend/.env.neon и вставьте DATABASE_URL"
fi

# ── 6. Проверка безопасности ──────────────────────────────
echo ""
echo "▶ Шаг 6/6: Security check (подставьте свои URL или пропустите)"
API_URL="${MINKERT_API_URL:-}"
FRONT_URL="${MINKERT_FRONT_URL:-}"
if [[ -n "$API_URL" ]]; then
  python3 scripts/security-check.py --url "$API_URL" ${FRONT_URL:+--frontend "$FRONT_URL"} --yes
else
  echo "  Пропуск. Для проверки продакшена:"
  echo '  export MINKERT_API_URL="https://ваш-api.onrender.com"'
  echo '  export MINKERT_FRONT_URL="https://ваш-сайт.vercel.app"'
  echo "  python3 scripts/security-check.py --url \"\$MINKERT_API_URL\" --frontend \"\$MINKERT_FRONT_URL\" --yes"
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  После push проверьте вручную:"
echo "  • Render Dashboard → minkert-api → Plan = Starter"
echo "  • Render → Environment: CORS_ORIGIN, JWT_ACCESS_SECRET, DATABASE_URL"
echo "  • curl https://ВАШ-API.onrender.com/api/health"
echo "  • GitHub → Actions → CI зелёный"
echo "══════════════════════════════════════════════════════════"
echo ""
