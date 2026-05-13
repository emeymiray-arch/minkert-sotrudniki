## Minkert — платформа производительности команды

Стек монорепозитория для управления людьми, задачами и KPI-показателями на русском интерфейсе.

### Структура

- `backend` — NestJS + Prisma + PostgreSQL, JWT + refresh-токены, роли ADMIN / MANAGER / VIEWER  
- `frontend` — React + TypeScript + Tailwind + Radix + Framer Motion + Recharts + TanStack Query + Sonner

### Запуск локально

1. **База PostgreSQL** (нужна любая из опций ниже):

   **Вариант A — Docker** (если установлен Docker Desktop / Colima):

   `docker compose up -d db`

   Строка подключения по умолчанию совпадает с `backend/.env.example`.

   **Вариант B — без Docker (macOS + Homebrew):**

   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   # в PATH должен быть psql/createdb, например:
   # export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
   createdb minkert
   ```

   В `backend/.env` укажите пользователя macOS (часто совпадает с `whoami`), без пароля на локалхосте:

   `DATABASE_URL="postgresql://ВАШ_ЛОГИН@localhost:5432/minkert?schema=public"`

   Если заведёте роль `postgres` с паролем — используйте строку как в `.env.example`.

   **Вариант C — облако (Neon, Supabase и т.д.):**

   Создайте бесплатный проект Postgres, скопируйте `DATABASE_URL` в `backend/.env` — локально PostgreSQL не нужен.

2. **Бэкенд:**  
   - `cp backend/.env.example backend/.env` и при необходимости поправьте `DATABASE_URL`, `JWT_ACCESS_SECRET`
   - `cd backend`
   - `npm install`
   - `npx prisma migrate deploy`
   - `npm run db:seed` (демо-сценарии, логины в консоли скрипта)
   - `npm run start:dev`
3. **Фронтенд:**  
   - `cd frontend` → `npm install` → `npm run dev`  
   - В режиме разработки запросы идут на **`/api`**, Vite проксирует их на бэкенд `http://127.0.0.1:3000` (бэкенд должен быть запущен).  
   - Для сборки продакшена задайте `VITE_API_URL` (полный URL API). Чтобы в dev ходить на API напрямую, задайте `VITE_API_DIRECT=true` и при необходимости `VITE_API_URL`.

**Если не хотите разбираться в терминале:** в папке проекта дважды щёлкните файл **`ЗАПУСК.command`** (Mac) — установятся зависимости и запустятся сайт и API. Первый раз подождите 1–3 минуты, затем откройте http://localhost:5173

Откройте `http://localhost:5173` и войдите `admin@minkert.local / Demo123!` (ещё есть `lead@…` менеджер и `view@…` только просмотр).

**Ошибка 502 при сохранении:** почти всегда не запущен бэкенд на порту **3000**. Запустите `cd backend && npm run start:dev` **до** или **вместе** с фронтом. Из корня репозитория: `npm install` (один раз) и **`npm run dev`** — поднимутся API и Vite вместе.

### Ключевая доменная логика задач

- Каждая задача недели содержит 7 столбцов со статусом `0` (не выполнено), `1` (базово выполнено), `2` (перевыполнение).  
- Эти значения конвертируются в KPI: 100% за «1», 115% за «2», затем считаются дневные/недельные/месячные KPI и производные метрики (серии, топы, проблемные зоны).

### Темизация и хранилище браузера

- Тёмная тема задаётся по умолчанию (премиум-контраст), поддерживаются светлая и системная. Настройка хранится в `localStorage` вместе с токенами и профилем.

### Образы

- Контейнеры для production лежат в `backend/Dockerfile` и `frontend/Dockerfile`. Перед стартом бэкенд-контейнера прогоните `prisma migrate deploy` и передайте `DATABASE_URL`/секреты через оркестратор или entrypoint — миграции лучше выносить в отдельный job CI/CD.

### Выкладывание в интернет (Vercel + Render + Neon)

Пошаговая инструкция: **[DEPLOY.md](./DEPLOY.md)**. В корне есть **`render.yaml`** для быстрого создания API на Render.
