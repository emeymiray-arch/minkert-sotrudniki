# Minkert — полный план оптимизации и масштабирования

Документ описывает аудит производительности, уже внедрённые изменения и дорожную карту до устойчивой работы при **1000+ клиентах** и высокой нагрузке на CRM/аналитику.

**Стек:** React 19 + Vite (Vercel) · NestJS 10 + Prisma 7 (Render) · PostgreSQL (Neon)

---

## 1. Диагностика (исходное состояние)

| Симптом | Причина |
|--------|---------|
| CRM 2–5 мин при ~60 клиентах | Полная выгрузка списков без пагинации, тяжёлые `include`, N+1 в уведомлениях и аналитике |
| Dashboard 6 HTTP-запросов | Каждая AI-карточка — отдельный endpoint |
| Рост нагрузки линейный | Отсутствие лимитов на вложенные коллекции (`getClient` → все процедуры/записи) |
| Медленный поиск по ФИО/телефону | `ILIKE '%q%'` без trigram-индексов |
| MASTER видит чужие записи (после relogin) | `linkedCrmMasterId` не пробрасывался из JWT strategy |

**Целевые метрики после оптимизации:**

- CRM списки: **< 500 ms** при 1000 клиентах (страница 50)
- Dashboard: **1 запрос**, **< 2 s** cold, **< 800 ms** warm
- Карточка клиента: **< 1 s** (30 процедур + 30 записей по умолчанию)
- Напоминания/cron: **O(1) запросов** на батч, не N+1

---

## 2. Внедрено (текущий релиз)

### 2.1 Общая инфраструктура пагинации

- `backend/src/common/pagination/pagination.util.ts` — `parsePagination`, `paginatedResult`, тип `Paginated<T>`
- `frontend/src/lib/pagination.ts` — зеркальный тип + `paginatedQuery()`
- Контракт API: `{ items, total, page, limit, pages }` вместо голого массива

### 2.2 Prisma — индексы

Миграция `20260616120000_performance_indexes`:

```sql
CREATE INDEX "CrmClient_updatedAt_idx" ON "CrmClient"("updatedAt");
CREATE INDEX "CrmClient_createdAt_idx" ON "CrmClient"("createdAt");
CREATE INDEX "CrmProcedure_procedureDate_idx" ON "CrmProcedure"("procedureDate");
```

В `schema.prisma` — те же индексы для будущих миграций.

### 2.3 CRM (`crm.service.ts`)

| Endpoint | Изменение |
|----------|-----------|
| `GET /crm/clients` | Пагинация, default limit 50, max 100 |
| `GET /crm/appointments` | Пагинация, lean select клиента |
| `GET /crm/intervals` | Пагинация |
| `GET /crm/repeat-needed` | Пагинация |
| `GET /crm/lost` | Пагинация |
| `GET /crm/clients/:id` | `proceduresLimit` / `appointmentsLimit` (default 30), без `photosBeforeAfter` в списках |

### 2.4 Уведомления (`notifications.service.ts`)

- Push по ролям: один `findMany` подписок + `createMany`
- Напоминания: предзагрузка недавних уведомлений, проверка в памяти (без `findFirst` на каждую запись)

### 2.5 Loyalty (`loyalty.service.ts`)

- Пагинация списка клиентов
- Штампы: только `{ slot, masterName }`, max 10 на клиента

### 2.6 Insights / Dashboard (`insights.service.ts`)

- `GET /insights/dashboard` — единый контекст + все AI-блоки в одном ответе
- `unifiedClients` — пагинация, типизированный merge с loyalty
- `loadDashboardContext` — интервалы через `listIntervals(..., 1, 500).items`
- `batchEmployeeOverviews` → `analytics.batchEmployeeRangeAnalytics` (один запрос задач)

### 2.7 Analytics (`analytics.service.ts`)

- `batchEmployeeRangeAnalytics()` — батчевый расчёт по диапазону дат

### 2.8 Operations / Tasks / Employees

- **Operations:** `taskListInclude` без comments/notes на доске; копирование чеклистов — preload map
- **Tasks:** rollover недели через `createMany`
- **Employees:** `bulkPatch` через `Promise.all`

### 2.9 Frontend

- **CrmPage:** пагинация клиентов/записей/интервалов, `PaginationBar`, узкая инвалидация кэша
- **LoyaltyPage:** адаптация под `Paginated`
- **DashboardPage:** один `useQuery` на `/insights/dashboard`
- **AppointmentBookingForm:** поиск клиентов через `Paginated.items`

### 2.10 Deploy (`render.yaml`)

- `prisma migrate deploy` **не** в `buildCommand` — миграции применяются вручную после бэкапа (`scripts/apply-safe-indexes.sql`)
- `startCommand: npm run start:prod`

### 2.11 Auth — исправление MASTER scope

- `jwt.strategy.ts` — проброс `linkedCrmMasterId` из payload в `JwtUserPayload`

### 2.12 Резервное копирование Neon

- `scripts/backup-db.sh`, `run-neon-backup.sh`, `install-neon-backup-schedule.sh`
- Еженедельный restore-test (понедельник 13:00), хранение всех бэкапов

---

## 3. Дорожная карта — фаза 2 (рекомендуется)

### 3.1 Поиск — trigram-индексы (высокий приоритет) ✅

Миграция `20260618120000_trigram_search` — `pg_trgm` + GIN на `fullName`, `phone`, `phoneNormalized`.

### 3.2 Денормализация CRM (высокий приоритет)

Поля на `CrmClient` (обновлять в транзакции при создании процедуры/записи):

| Поле | Назначение |
|------|------------|
| `lastServiceAt` | Последний визит |
| `lastServiceName` | Название последней услуги |
| `lastMasterId` | Последний мастер |
| `daysSinceLastVisit` | Вычислять в SELECT или materialized |

Убирает подзапросы в `listIntervals`, `lostClients`, `dueForRepeat`.

### 3.3 Карточка клиента — lazy load вкладок

- Первая загрузка: шапка + счётчики (`_count`)
- Вкладки «Процедуры» / «Записи» / «Фото»: отдельные endpoints с пагинацией
- Infinite scroll (`useInfiniteQuery`) вместо классической пагинации в UI

### 3.4 Виртуализация списков (средний приоритет)

- `@tanstack/react-virtual` для таблиц CRM при limit 100+
- Снижает DOM-узлы и время reconciliation React

### 3.5 Кэширование на backend (средний приоритет)

| Данные | TTL | Механизм |
|--------|-----|----------|
| Справочники (мастера, услуги) | 5–15 мин | In-memory / Redis |
| Dashboard context | 60–120 s | Cache key по `salonId` + дате |
| Аналитика за закрытый период | 24 h | Invalidation при новой процедуре |

На Render free/paid без Redis — `cache-manager` + memory store достаточно для одного инстанса.

### 3.6 Connection pooling (средний приоритет)

- Neon: использовать **pooled** connection string (`-pooler` в hostname)
- Prisma: `connection_limit` в URL, `pgbouncer=true` при transaction mode
- Избегать длинных транзакций в cron-задачах

### 3.7 Индексы — дополнительные

```sql
-- Записи по дате и мастеру (расписание, фильтры)
CREATE INDEX "CrmAppointment_startsAt_masterId_idx" ON "CrmAppointment"("startsAt", "masterId");
CREATE INDEX "CrmAppointment_clientId_startsAt_idx" ON "CrmAppointment"("clientId", "startsAt" DESC);

-- Уведомления для cron
CREATE INDEX "Notification_createdAt_type_idx" ON "Notification"("createdAt", "type");

-- Задачи операций
CREATE INDEX "OpsTask_boardId_status_idx" ON "OpsTask"("boardId", "status");
```

### 3.8 Users / Settings (низкий приоритет)

- `listUsers()` — пагинация или hard cap 200 (сейчас без лимита; на практике < 50 аккаунтов)
- Аудит всех `findMany` без `take` в кодовой базе (скрипт `scripts/security-check.py` расширить)

### 3.9 Observability (низкий приоритет)

- Structured logging (pino) с `requestId`
- Slow query log: Prisma middleware > 500 ms
- Health check расширить: `SELECT 1`, версия миграций
- Sentry / Logtail на Render для production errors

### 3.10 Frontend — React Query tuning

```ts
// Глобальные defaults (queryClient)
staleTime: 30_000,
gcTime: 5 * 60_000,
refetchOnWindowFocus: false, // для тяжёлых списков
```

- `placeholderData: keepPreviousData` на пагинированных списках CRM
- Prefetch следующей страницы при hover на «Далее»

### 3.11 API versioning / breaking changes

Текущий релиз меняет формат list-endpoints. Если есть внешние потребители:

- Заголовок `Accept: application/vnd.minkert.v2+json`
- Или query `?legacy=array` (временно) — **не реализовано**, только внутренний фронт обновлён

---

## 4. Чеклист по модулям

### CRM

- [x] Пагинация всех списков
- [x] Лимиты вложенных данных в `getClient`
- [x] Lean includes в appointments list
- [x] Индексы updatedAt / createdAt / procedureDate
- [x] Trigram поиск
- [ ] Денормализация last visit
- [ ] Lazy tabs + infinite scroll
- [ ] Виртуализация таблицы

### Dashboard / Insights

- [x] Один HTTP-запрос
- [x] Батч employee analytics
- [x] Пагинация unified clients
- [ ] Server-side cache dashboard
- [ ] Stale-while-revalidate на фронте

### Notifications

- [x] Batch push
- [x] Batch reminders без N+1
- [ ] Индекс по createdAt+type
- [ ] Очередь (BullMQ) при > 500 push за раз

### Loyalty

- [x] Пагинация
- [x] Lean stamps select
- [ ] Кэш счётчиков штампов

### Operations / Tasks

- [x] Lean task list
- [x] Batch copy checklist
- [x] createMany rollover
- [ ] Пагинация доски при > 100 задач

### Analytics

- [x] batchEmployeeRangeAnalytics
- [ ] Pre-aggregated daily stats table
- [ ] Materialized view для finance charts

### Auth / Security

- [x] linkedCrmMasterId в JWT strategy
- [ ] Ротация refresh tokens batch cleanup cron
- [ ] Rate limiting на `/auth/login`

### Infra

- [x] migrate deploy в build
- [x] Neon backup automation
- [ ] Pooled DATABASE_URL
- [ ] Render plan upgrade + health checks
- [ ] CDN cache static assets (Vercel — по умолчанию)

---

## 5. Нагрузочное тестирование

### Локально

```bash
# Сид 1000 клиентов (добавить скрипт prisma/seed-large.ts при необходимости)
cd backend && npx prisma db seed

# k6 или autocannon
npx autocannon -c 10 -d 30 -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/crm/clients?page=1&limit=50"
```

### Критерии приёмки

| Endpoint | p95 | Ошибки |
|----------|-----|--------|
| GET /crm/clients?page=1&limit=50 | < 400 ms | 0% |
| GET /insights/dashboard | < 1500 ms | 0% |
| GET /crm/clients/:id | < 800 ms | 0% |
| POST /crm/appointments | < 300 ms | 0% |

---

## 6. Порядок деплоя

1. `git push` → Render build (без автоматических миграций БД)
2. Проверить `/api/health`
3. **Опционально** после бэкапа: выполнить `scripts/apply-safe-indexes.sql` в Neon SQL Editor
4. Vercel redeploy фронта (если не auto)
4. Smoke-test: CRM списки, Dashboard, запись на приём MASTER-аккаунтом
5. Мониторинг 24 ч: Neon CPU, Render memory, slow queries

---

## 7. Оценка масштаба

| Клиентов | Без фазы 2 | С фазой 2 (trigram + denorm + cache) |
|----------|------------|--------------------------------------|
| 100 | Штатно | Штатно |
| 500 | Штатно | Штатно |
| 1000 | Приемлемо (пагинация) | Комфортно |
| 5000+ | Нужна фаза 2 + read replicas | Штатно на одном Neon Pro |

---

## 8. Файлы изменений (справочник)

| Область | Путь |
|---------|------|
| Пагинация BE | `backend/src/common/pagination/pagination.util.ts` |
| CRM | `backend/src/crm/crm.service.ts`, `crm.controller.ts` |
| Frontend CRM | `frontend/src/pages/CrmPage.tsx` |
| Dashboard | `backend/src/insights/insights.service.ts`, `frontend/src/pages/DashboardPage.tsx` |
| JWT fix | `backend/src/auth/strategies/jwt.strategy.ts` |
| Миграция | `backend/prisma/migrations/20260616120000_performance_indexes/` |
| Deploy | `render.yaml` |
| Backup | `scripts/backup-db.sh`, `run-neon-backup.sh` |

---

*Последнее обновление: 2026-06-08 — фаза 1 завершена, сборки backend/frontend проходят.*
