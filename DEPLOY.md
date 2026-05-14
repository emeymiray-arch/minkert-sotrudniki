# Выкладываем Minkert в интернет

## Почему на Vercel пишет «Запустите backend…»

Сборка Vite **вшивает** адрес API на момент `npm run build`. Если в Vercel **не задана** переменная **`VITE_API_URL`**, в продакшене используется запасной вариант **`http://localhost:3000/api`** — в браузере пользователя **нет** вашего локального Nest, поэтому запрос падает и показывается сообщение про backend.

**Что сделать:**

1. Задеплойте API на Render / Railway (см. ниже) и скопируйте публичный URL, например `https://minkert-api-xxxx.onrender.com`.
2. В **Vercel** → ваш проект → **Settings** → **Environment Variables**:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://minkert-api-xxxx.onrender.com/api` (обязательно суффикс **`/api`** — у Nest глобальный префикс).
   - Окружения: **Production** (и **Preview**, если нужно).
3. **Deployments** → последний деплой → **⋯** → **Redeploy** (или новый push), чтобы **пересобрать** фронт с новой переменной.

Переменные `VITE_*` не подхватываются «на лету» после сборки — только **пересборка**.

---

## Стек и структура backend (кратко)

| Слой | Технология |
|------|------------|
| Фреймворк | **NestJS 10** (модули, DI, guards) |
| HTTP | **Express** (через `@nestjs/platform-express`) |
| ORM | **Prisma 7** + драйвер **`@prisma/adapter-pg`** + **`pg`** |
| БД | **PostgreSQL** (схема в `prisma/schema.prisma`) |
| Аутентификация | **JWT** (`@nestjs/jwt`, `passport-jwt`), refresh-токены в таблице `RefreshToken` |
| Валидация | **class-validator** + `ValidationPipe` (whitelist) |

**Папки `backend/src`:** `auth/`, `users/`, `employees/`, `tasks/` (два контроллера: задачи сотрудника и PATCH задачи), `analytics/`, `prisma/`, `common/` (KPI, даты, константы дней). Точка входа: `main.ts`, префикс **`/api`**, порт **`PORT`** (по умолчанию 3000), bind **`0.0.0.0`**.

**Продакшен-старт:** `npm run start:prod` → `node dist/src/main.js`. В **Dockerfile** перед стартом: `npx prisma migrate deploy`.

---

## Куда деплоить backend

| Платформа | Плюсы | Минусы |
|-----------|--------|--------|
| **[Render](https://render.com)** | Уже есть **`render.yaml`** в репо, free tier, понятные логи | Free web «засыпает», холодный старт ~30–60 с |
| **[Railway](https://railway.app)** | Очень быстрый деплой из GitHub, Postgres одной кнопкой | Платёжная карта / лимиты на free |
| **Fly.io**, **Coolify**, **VPS + Docker** | Полный контроль | Больше ручной настройки |

Для вашего кейса **Neon (Postgres) + Render (Node из `backend/`) + Vercel (фронт)** — минимум сюрпризов и уже описано в этом файле.

---

## PostgreSQL в production

- Удобно **Neon** или **Supabase**: управляемый Postgres, бэкапы, `sslmode=require` в `DATABASE_URL`.
- Строка подключения — **только** в секретах хостинга (Render/Railway), не в репозитории.
- После первого деплоя API один раз в Shell: `npx prisma db seed` (демо-пользователи), либо только миграции (`migrate deploy` уже в `startCommand` на Render).

---

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
   Он понадобится для Vercel (ниже).

---

## 3. Сайт на Vercel

Render здесь нужен **только как хост для API** (логин и данные без него не заработают). Вам не нужно «уметь Render»: достаточно **один раз** создать сервис по разделу 2 выше и **скопировать его URL** (строка в браузере вида `https://…onrender.com`) в переменную Vercel ниже.

### Рекомендуемый способ (меньше 404 на `/api`)

В репозитории в **корне** лежат `vercel.json` и `middleware.ts` — Vercel ищет middleware **рядом с тем `package.json`, который считается корнем проекта**. Проще всего привязать **весь репозиторий**, а не только папку `frontend`.

1. [vercel.com](https://vercel.com) → импортируйте репозиторий.
2. В шаге настройки (или позже: **Settings → General → Root Directory**):
   - поле **Root Directory** **очистите** (оставьте **пустым** — корень репозитория),  
   - **не** указывайте `frontend`.
3. Сборка подставится из корневого `vercel.json`: установка зависимостей в `frontend`, `npm run build` там же, выходная папка **`frontend/dist`**.
4. **Environment Variables** → **Add**:
   - **Key:** `MINKERT_BACKEND_ORIGIN`
   - **Value:** `https://minkert-api-xxxx.onrender.com` (**без** `/api` в конце — это только хост сервиса из Render).
5. **Deploy** / **Redeploy** (при смене переменных — с **Clear build cache**).

На **Render** в сервисе API в **`CORS_ORIGIN`** укажите URL сайта Vercel (например `https://ваш-проект.vercel.app`), сохраните и при необходимости **Manual Deploy** — иначе браузер может блокировать ответы API.

Проверка: откройте в браузере `https://ваш-сайт.vercel.app/api/health` — должен быть JSON с полем `ok` (не страница 404 Vercel). Если 404 — middleware не сработал: проверьте п.2 (корень репозитория) и что переменная задана.

### Если проект уже создан с Root Directory = `frontend`

Так тоже можно: тогда используются **`frontend/middleware.ts`** и **`frontend/vercel.json`**. В настройках сборки укажите **Build Command:** `npm run build`, **Output Directory:** `dist`, **Root Directory:** `frontend`. Переменная **`MINKERT_BACKEND_ORIGIN`** всё равно обязательна.

### Вариант без прокси (только Vercel + одна переменная)

В **Environment Variables** задайте при сборке **`VITE_API_URL`** = `https://ВАШ-API.onrender.com/api` (с **`https`** и с **`/api`**). Тогда **`MINKERT_BACKEND_ORIGIN`** не нужен; на Render в **`CORS_ORIGIN`** укажите URL сайта Vercel.

**Если на Vercel видите 502/503 при входе:** чаще всего «спит» бесплатный API на Render — откройте [dashboard.render.com](https://dashboard.render.com) → ваш сервис → **Open app**, подождите до минуты, обновите сайт на Vercel. Либо откройте в браузере `https://ваш-сервис.onrender.com/api/health` — должен быть JSON с `"ok":true`.

### Если на Vercel 502/503 при входе

Чаще всего «спит» бесплатный API на **Render**: [dashboard.render.com](https://dashboard.render.com) → ваш **Web Service** → **Open app**, подождите до минуты, снова откройте сайт на Vercel. Проверьте в браузере `https://ваш-сервис.onrender.com/api/health` — должен быть JSON с `"ok":true`. Если нет — смотрите **Logs** на Render (часто нет `DATABASE_URL` или не прошли миграции).

**Не задавайте одновременно** `MINKERT_BACKEND_ORIGIN` и `VITE_API_URL` с разными хостами: если задан `VITE_API_URL`, браузер ходит на него напрямую, прокси не используется.

---

## Проверка

- Сайт: `https://….vercel.app`
- Здоровье API: `https://….onrender.com/api/health`
- Вход: `admin@minkert.local` / `Demo123!` (после `prisma db seed` на Render)

---

## Свой домен (по желанию)

- В **Vercel**: Project → Settings → Domains — добавьте домен для фронта.
- В **Render**: Settings → Custom Domain — для API (или оставьте поддомен `onrender.com`).
- Обновите **`MINKERT_BACKEND_ORIGIN`** (если используете прокси) или **`VITE_API_URL`** (прямой URL) в Vercel и сделайте **Redeploy**, а на Render — **`CORS_ORIGIN`** под новые адреса.

---

## Docker (VPS / свой сервер)

В репозитории есть **`backend/Dockerfile`** и **`frontend/Dockerfile`**. На сервере с Docker можно собрать образы, передать `DATABASE_URL` и `VITE_API_URL` при сборке фронта, поднять nginx — это уже для администратора сервера.

---

## Важно про «бесплатно»

- **Render Free** API засыпает без запросов — первый клик после паузы может долго грузиться.
- **Neon** даёт лимиты по объёму — для демо и небольшой команды обычно достаточно.

Если нужен один провайдер «всё в одном», можно использовать **Railway** (БД + Node) по аналогии: те же переменные `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGIN`, сборка из папки `backend`, фронт отдельно на Vercel с **`MINKERT_BACKEND_ORIGIN`** или **`VITE_API_URL`**.
