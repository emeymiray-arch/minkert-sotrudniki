# Восстановление Minkert после сбоя

**Главный принцип:** все данные (клиенты, записи, финансы, сотрудники, задачи) хранятся в **PostgreSQL**. Фронтенд и API — «оболочка». Если программа «сдохла», достаточно подключить ту же базу (или восстановить из дампа) — API при старте сам применит схему.

---

## Сценарий A: API упал, база жива (Neon / Render)

1. Убедитесь, что `DATABASE_URL` в Render указывает на **ту же** базу Neon.
2. Redeploy API на Render (или перезапуск контейнера).
3. При старте выполняется `prisma migrate deploy` — только добавляет таблицы/индексы, **данные не удаляются**.
4. Проверка:
   ```bash
   curl https://ВАШ-API.onrender.com/api/health
   curl https://ВАШ-API.onrender.com/api/health/data
   ```
   В `health/data` должны быть ненулевые счётчики `users`, `crmClients` и т.д.

---

## Сценарий B: Потеряна база Neon — восстановление из дампа

1. Найдите последний дамп в `backups/minkert-neon-*.dump` (или скачайте из облачного хранилища).
2. Создайте новый проект Postgres (Neon) или очистите существующий.
3. Восстановите:
   ```bash
   pg_restore -d "postgresql://USER:PASS@HOST/neondb?sslmode=require" \
     --no-owner --no-acl backups/minkert-neon-YYYYMMDD-HHMMSS.dump
   ```
4. Обновите `DATABASE_URL` в Render на новую строку подключения.
5. Redeploy API — миграции догонят схему до актуальной версии.
6. Проверьте `/api/health/data`.

---

## Сценарий C: Полная переустановка (новый сервер / VPS)

1. Клонируйте репозиторий.
2. Задайте `backend/.env`:
   ```
   DATABASE_URL=...   # ваша существующая база или восстановленный дамп
   JWT_ACCESS_SECRET=...  # тот же секрет, что был раньше, иначе все разлогинятся
   CORS_ORIGIN=https://ваш-сайт.vercel.app
   ```
3. Запуск:
   ```bash
   npm run setup
   cd backend && npm run start:prod
   ```
4. Фронтенд: задеплойте на Vercel с `MINKERT_BACKEND_ORIGIN` на новый API.

**Важно:** `JWT_ACCESS_SECRET` при смене инвалидирует все access-токены (пользователи перелогинятся). Refresh-токены в БД сохранятся.

---

## Сценарий D: Локальная проверка «база + API»

```bash
docker compose up -d db
cp backend/.env.example backend/.env
# Вставьте DATABASE_URL из Neon, если тестируете прод-базу
cd backend && npm run db:deploy && npm run start:prod
curl http://localhost:3000/api/health/data
```

---

## Что НЕ трогает ваши данные

| Действие | Безопасно для данных? |
|----------|----------------------|
| `prisma migrate deploy` | ✅ Да — только DDL |
| Redeploy API / Vercel | ✅ Да |
| `npm run db:seed` без `SEED_FORCE` | ✅ Да — пропускается если есть данные |
| `SEED_FORCE=1 npm run db:seed` | ❌ Удаляет демо-данные |
| `prisma migrate reset` | ❌ **Удаляет всё** |

---

## Автобэкапы

```bash
# Раз в 3 дня + еженедельная проверка восстановления (macOS)
./scripts/install-neon-backup-schedule.sh

# Ручной бэкап Neon
./scripts/backup-db.sh neon
```

Храните копии дампов **вне** ноутбука (Google Drive, S3, внешний диск).
