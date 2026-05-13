# Выкладываем Minkert в интернет

Нужны **три части**: база PostgreSQL, бэкенд (API), фронт (сайт). Один только Vercel недостаточно: на Vercel удобно разместить **React**, а **Nest и база** — на другом сервисе.

Ниже — простой рабочий вариант: **Neon (бесплатная БД) + Render (API) + Vercel (сайт)**.

---

## 1. База данных (Neon)

1. Зайдите на [https://neon.tech](https://neon.tech), зарегистрируйтесь.
2. Создайте проект → регион ближе к вам (например **Frankfurt**).
3. Скопируйте **Connection string** для Postgres (формат `postgresql://...@...neon.tech/neondb?sslmode=require`).
4. Сохраните строку — это будет **`DATABASE_URL`** для бэкенда.

---

## 2. API на Render

1. Зайдите на [https://render.com](https://render.com), подключите GitHub/GitLab с этим репозиторием.
2. **New +** → **Blueprint** → укажите репозиторий и файл **`render.yaml`** в корне (или создайте **Web Service** вручную):
   - **Root Directory:** `backend`
   - **Build Command:** `npm ci && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && npm run start:prod`
   - **Instance type:** Free (сервис «засыпает» без трафика — первый запрос может быть 30–60 с).
3. В **Environment** добавьте переменные:

| Переменная | Значение |
|------------|----------|
| `DATABASE_URL` | строка из Neon |
| `JWT_ACCESS_SECRET` | случайная длинная строка (в терминале: `openssl rand -hex 32`) |
| `CORS_ORIGIN` | пока можно `https://placeholder.vercel.app` — **после шага 3 замените** на реальный URL сайта с Vercel (можно несколько через запятую) |
| `PORT` | оставьте пустым или `10000` — Render сам подставит порт |

4. Дождитесь успешного деплоя. Откройте URL вида **`https://minkert-api-xxxx.onrender.com/api/health`** — должен быть JSON `{"ok":true,...}`.

5. **Один раз** засейте демо-пользователей (в панели Render → ваш сервис → **Shell**):

```bash
npx prisma db seed
```

Логины после сида: `admin@minkert.local` / `Demo123!` (как локально).

6. Скопируйте **публичный URL API** без пути, например `https://minkert-api-xxxx.onrender.com`.  
   Для фронта понадобится **`https://minkert-api-xxxx.onrender.com/api`** (с суффиксом **`/api`**).

---

## 3. Сайт на Vercel

1. Зайдите на [https://vercel.com](https://vercel.com), импортируйте **тот же репозиторий**.
2. При настройке проекта:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (или Other, если не определился)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. В **Environment Variables** добавьте:

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://ВАШ-API.onrender.com/api` |

4. **Deploy**. Скопируйте URL сайта, например `https://minkert.vercel.app`.

5. Вернитесь в **Render** → переменная **`CORS_ORIGIN`** = ваш URL Vercel (можно с запятой: `https://minkert.vercel.app,https://www.ваш-домен.ru` если подключите свой домен). Сохраните и сделайте **Manual Deploy** у сервиса API.

6. Снова откройте сайт на Vercel — вход и данные идут уже в **облачную** базу.

---

## Проверка

- Сайт: `https://….vercel.app`
- Здоровье API: `https://….onrender.com/api/health`
- Вход: `admin@minkert.local` / `Demo123!` (после `prisma db seed` на Render)

---

## Свой домен (по желанию)

- В **Vercel**: Project → Settings → Domains — добавьте домен для фронта.
- В **Render**: Settings → Custom Domain — для API (или оставьте поддомен `onrender.com`).
- Обновите **`VITE_API_URL`** в Vercel (пересборка) и **`CORS_ORIGIN`** на Render под новые адреса.

---

## Docker (VPS / свой сервер)

В репозитории есть **`backend/Dockerfile`** и **`frontend/Dockerfile`**. На сервере с Docker можно собрать образы, передать `DATABASE_URL` и `VITE_API_URL` при сборке фронта, поднять nginx — это уже для администратора сервера.

---

## Важно про «бесплатно»

- **Render Free** API засыпает без запросов — первый клик после паузы может долго грузиться.
- **Neon** даёт лимиты по объёму — для демо и небольшой команды обычно достаточно.

Если нужен один провайдер «всё в одном», можно использовать **Railway** (БД + Node) по аналогии: те же переменные `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGIN`, сборка из папки `backend`, фронт отдельно на Vercel с `VITE_API_URL`.
