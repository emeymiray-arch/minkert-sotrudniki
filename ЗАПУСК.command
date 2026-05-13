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

npm start

read -r -p "Нажмите Enter чтобы закрыть окно..."
