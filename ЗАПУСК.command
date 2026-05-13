#!/bin/bash
# Дважды щёлкните по этому файлу в Finder — откроется терминал и запустится сайт.
cd "$(dirname "$0")" || exit 1

echo ""
echo "  Minkert — запуск"
echo "  Первый раз установка займёт 1–3 минуты."
echo ""
echo "  Потом откройте в браузере:  http://localhost:5173"
echo "  Логин:  admin@minkert.local"
echo "  Пароль: Demo123!"
echo ""
echo "  Остановка: в этом окне нажмите Control+C"
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "Нужен Node.js. Скачайте LTS: https://nodejs.org"
  read -r -p "Нажмите Enter чтобы закрыть окно..."
  exit 1
fi

if [ ! -f backend/.env ]; then
  echo "Нет файла backend/.env — скопируйте backend/.env.example в backend/.env и укажите DATABASE_URL (PostgreSQL)."
  read -r -p "Нажмите Enter чтобы закрыть окно..."
  exit 1
fi

echo "  Обновление схемы базы (миграции Prisma)…"
if ! (cd backend && npm run db:deploy); then
  echo ""
  echo "  Ошибка миграций. Запустите PostgreSQL и проверьте DATABASE_URL в backend/.env"
  echo "  Пример: brew services start postgresql@16"
  read -r -p "Нажмите Enter чтобы закрыть окно..."
  exit 1
fi

npm start

read -r -p "Нажмите Enter чтобы закрыть окно..."
