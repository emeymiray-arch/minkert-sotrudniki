# Neon + автобэкапы — инструкция

## Текущий статус (проверено)

| Что | Статус |
|-----|--------|
| `backend/.env.neon` | Настроен |
| Подключение к Neon | Работает (`neondb`) |
| Миграции на Neon | Все применены |
| Автобэкап (macOS) | Установлен — каждые **3 дня** |
| Проверка восстановления | Каждый **понедельник 13:00** |
| Папка бэкапов | `backups/minkert-neon-*.dump` |

---

## 1. Подключение Neon к Render (продакшн API)

1. Откройте [console.neon.tech](https://console.neon.tech) → ваш проект.
2. **Connection details** → скопируйте строку **Pooled** (hostname с `-pooler`).
3. [dashboard.render.com](https://dashboard.render.com) → сервис **minkert-api** → **Environment**.
4. Вставьте в `DATABASE_URL`:
   ```
   postgresql://USER:PASS@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
5. **Save** → **Manual Deploy** (или дождитесь автодеплоя).
6. Проверка:
   ```
   https://ВАШ-API.onrender.com/api/health
   https://ВАШ-API.onrender.com/api/health/data
   ```

> Строка в `backend/.env.neon` и в Render должна указывать на **одну и ту же** базу Neon.

---

## 2. Локальная разработка

**Вариант A — локальный Postgres** (у вас сейчас):
- `backend/.env` → `127.0.0.1:5432/minkert`
- Данные локальные, Neon не затрагивается.

**Вариант B — работать напрямую с Neon:**
```bash
# В backend/.env замените DATABASE_URL на строку из .env.neon
cp backend/.env.neon backend/.env   # или скопируйте только DATABASE_URL
cd backend && npx prisma migrate deploy
npm run start:dev
```

---

## 3. Автобэкапы

### Уже установлено

```bash
./scripts/install-neon-backup-schedule.sh
```

- Бэкап: каждые 3 дня → `backups/minkert-neon-ДАТА.dump`
- Лог: `backups/neon-backup.log`
- Восстановление-тест: понедельник → `backups/restore-test.log`

### Вручную

```bash
npm run db:backup:neon          # из корня репо
# или
./scripts/backup-db.sh neon
```

### Проверить, что расписание живо

```bash
launchctl print gui/$(id -u)/com.minkert.neon-backup
tail -20 backups/neon-backup.log
```

### Проверить, что дамп восстанавливается

```bash
./scripts/test-neon-restore.sh
```

Нужен **локальный Postgres** (`backend/.env` → localhost) — для теста создаётся БД `minkert_restore_test`.

### Отключить автобэкап

```bash
./scripts/install-neon-backup-schedule.sh remove
```

---

## 4. Восстановление из бэкапа

Если Neon потерян или нужна копия на новой базе:

```bash
pg_restore -d "postgresql://USER:PASS@HOST/neondb?sslmode=require" \
  --no-owner --no-acl \
  backups/minkert-neon-YYYYMMDD-HHMMSS.dump
```

Подробнее: `RECOVERY.md`

---

## 5. Важно: храните копии вне Mac

Скопируйте `backups/minkert-neon-*.dump` на Google Drive или внешний диск — **дополнительная** копия (основная уже грузится автоматически).

Политика: **все бэкапы хранятся вечно** — см. `BACKUP_POLICY.md`.

---

## 6. Создать Neon с нуля (если ещё нет аккаунта)

1. [neon.tech](https://neon.tech) → Sign up (можно через GitHub).
2. **New Project** → регион ближе к Frankfurt (как Render).
3. Скопируйте **Connection string** (Pooled).
4. Создайте файл:
   ```bash
   cp backend/.env.neon.example backend/.env.neon
   # Вставьте DATABASE_URL в backend/.env.neon
   ```
5. Примените схему:
   ```bash
   cd backend && npx prisma migrate deploy
   ```
6. Первый admin (только на пустой базе, один раз):
   ```bash
   ALLOW_BOOTSTRAP=true npm run start:dev
   # POST /api/auth/bootstrap или seed:
   npm run db:seed
   ```
7. Установите автобэкапы:
   ```bash
   ./scripts/install-neon-backup-schedule.sh
   ```
