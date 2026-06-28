# Осталось только вам (3 действия в браузере)

Всё остальное уже настроено автоматически.

---

## 1. Включить CI на GitHub (3 мин)

Код запушен, но файл CI нужно добавить через сайт GitHub (ограничение токена):

1. Откройте [github.com/emeymiray-arch/minkert-sotrudniki](https://github.com/emeymiray-arch/minkert-sotrudniki)
2. **Add file** → **Create new file**
3. Путь: `.github/workflows/ci.yml`
4. Скопируйте содержимое из файла `scripts/github-ci.yml` в репозитории (на GitHub откройте этот файл и Copy raw)
5. **Commit changes**

После этого каждый push в `main` будет автоматически проверять сборку и тесты.

---

## 2. Сменить пароль Neon (5 мин) — важно для безопасности

Пароль базы был в переписке.

1. [console.neon.tech](https://console.neon.tech) → проект **winter-queen** → **Reset password**
2. Обновить `DATABASE_URL` в двух местах:
   - `backend/.env.neon` (на Mac)
   - Render → **minkert-api** → Environment → `DATABASE_URL`
3. Render → **Manual Deploy**

---

## 3. Sentry — мониторинг ошибок (10 мин, по желанию)

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
