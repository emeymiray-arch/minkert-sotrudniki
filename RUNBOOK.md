# Runbook — эксплуатация Minkert

Краткие действия при типичных инцидентах.

---

## 502 / 504 на сайте

1. Откройте Render → Web Service → **Logs**.
2. Проверьте `https://ВАШ-API.onrender.com/api/health`.
3. Если `db: down` — проблема Neon (лимит, sleep, неверный `DATABASE_URL`).
4. Если API «спит» (free tier) — дождитесь cold start ~1 мин или перейдите на Starter.
5. Vercel: проверьте `MINKERT_BACKEND_ORIGIN` (без `/api` в конце).

---

## Health check

| Endpoint | Назначение |
|----------|------------|
| `GET /api/health` | Render health probe: БД + миграции |
| `GET /api/health/data` | Счётчики записей — убедиться, что данные на месте |
| `GET /api/docs` | Swagger — проверка API после деплоя |

---

## Деплой новой версии

1. Merge в `main` → CI должен пройти (build, lint, e2e).
2. Render автодеплой → при старте `migrate deploy`.
3. Vercel автодеплой фронта.
4. Smoke-тест:
   ```bash
   curl -s https://API/api/health | jq
   curl -s https://API/api/health/data | jq
   ```

---

## Медленный CRM / поиск

1. Логи Render: ищите `slow: true` (запросы > 500 ms).
2. Убедитесь, что применены все миграции (`migrationCount` в health).
3. Neon: используйте **pooled** URL (`-pooler` в hostname).
4. См. `OPTIMIZATION.md` — фаза 2 (денормализация CRM).

---

## Мониторинг (опционально)

Задайте в Render:

```
SENTRY_DSN=https://...@sentry.io/...
SLOW_REQUEST_MS=500
SLOW_QUERY_MS=500
```

Ошибки 5xx и медленные запросы попадут в Sentry / логи.

---

## Ротация секретов

| Секрет | Эффект смены |
|--------|--------------|
| `JWT_ACCESS_SECRET` | Все access-токены недействительны, refresh работает |
| `DATABASE_URL` | Потеря данных, если указать пустую базу |
| `VAPID_*` | Push-уведомления перестанут работать до переподписки |

Перед сменой `DATABASE_URL` — **обязательный бэкап**.

---

## Контакты и эскалация

1. Логи Render + Neon dashboard
2. `./scripts/security-check.py --url https://API --yes`
3. `./scripts/test-neon-restore.sh` — проверка, что бэкап восстанавливается
4. Полное восстановление: `RECOVERY.md`
