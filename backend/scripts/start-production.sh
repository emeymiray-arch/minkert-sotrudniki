#!/usr/bin/env sh
# Production start: применить миграции к БД, затем поднять API.
# Данные в PostgreSQL сохраняются; migrate deploy только добавляет схему, не удаляет строки.
set -eu

cd "$(dirname "$0")/.."

echo "[start-production] Prisma migrate deploy…"
npx prisma migrate deploy

echo "[start-production] API starting…"
exec node dist/src/main.js
