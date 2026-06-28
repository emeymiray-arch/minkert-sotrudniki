# Осталось только вам (2 действия в браузере)

Всё остальное уже настроено автоматически.

---

## 1. Сменить пароль Neon (5 мин) — важно для безопасности

Пароль базы был в переписке.

1. [console.neon.tech](https://console.neon.tech) → проект **winter-queen** → **Reset password**
2. Обновить `DATABASE_URL` в двух местах:
   - `backend/.env.neon` (на Mac)
   - Render → **minkert-api** → Environment → `DATABASE_URL`
3. Render → **Manual Deploy**

---

## 2. Sentry — мониторинг ошибок (10 мин, по желанию)

1. [sentry.io](https://sentry.io) → Create project → Node.js
2. Скопировать **DSN**
3. Render → Environment → `SENTRY_DSN` = ваш DSN → Redeploy

Без Sentry ошибки видны только в логах Render.

---

## Уже сделано (проверьте)

| Что | Где |
|-----|-----|
| База с данными (80 клиентов) | Neon winter-queen |
| Бэкапы каждые 3 дня | `backups/Minkert-Backups/` |
| Google Drive | папка **Minkert-Backups** |
| CI на GitHub | push в main |
| Health | `/api/health/data` |

Проверка API (подставьте ваш Render URL):
```bash
MINKERT_API_URL=https://ваш-api.onrender.com npm run verify:prod
```

---

## Еженедельно (30 сек)

- [drive.google.com](https://drive.google.com) → **Minkert-Backups** — новый файл раз в 3 дня
- Сайт открывается, CRM показывает клиентов
