# Бэкапы на Google Drive

Да — **два места хранения надёжнее**: Mac (`backups/`) + Google Drive.

## Как это работает

```
Neon (продакшн) → pg_dump → backups/minkert-neon-*.dump → rclone → Google Drive/Minkert-Backups/
```

- Каждые **3 дня** (автобэкап macOS) — дамп + загрузка на Drive
- **Все копии хранятся навсегда** — автоудаление отключено (см. `BACKUP_POLICY.md`)
- Если сломается Mac — данные останутся в Drive и в Neon

---

## Однократная настройка (5 минут)

В терминале из корня проекта:

```bash
chmod +x scripts/setup-gdrive-backup.sh scripts/upload-backup-to-gdrive.sh
npm run neon:setup-gdrive
```

1. Откроется браузер → войдите в **ваш Google-аккаунт**
2. Нажмите **Разрешить** доступ к Google Drive
3. Скрипт загрузит последний бэкап для проверки

Папка на Drive: **Minkert-Backups/** (в «Мой диск»).

---

## Команды

| Команда | Действие |
|---------|----------|
| `npm run neon:setup-gdrive` | Первичная настройка Drive |
| `npm run db:backup:neon` | Бэкап Neon на Mac |
| `npm run db:upload-gdrive` | Загрузить последний дамп на Drive |
| `npm run neon:setup-backups` | Расписание (Mac + Drive) |

---

## Проверка

```bash
rclone ls minkert-gdrive:Minkert-Backups
```

Или в браузере: [drive.google.com](https://drive.google.com) → папка **Minkert-Backups**.

---

## Восстановление из Google Drive

```bash
# Скачать с Drive
rclone copy minkert-gdrive:Minkert-Backups/minkert-neon-ДАТА.dump ./backups/

# Восстановить в Neon (осторожно — перезапишет данные)
pg_restore -d "$DATABASE_URL" --no-owner --no-acl --clean --if-exists \
  backups/minkert-neon-ДАТА.dump
```

Подробнее: `RECOVERY.md`

---

## Настройки (scripts/.gdrive-backup.env)

```bash
RCLONE_REMOTE=minkert-gdrive:Minkert-Backups
KEEP_ALL_BACKUPS=1   # бэкапы не удаляются
```

Политика хранения: `BACKUP_POLICY.md`

---

## Если не работает

| Проблема | Решение |
|----------|---------|
| `rclone не найден` | `brew install rclone` |
| `remote не настроен` | `npm run neon:setup-gdrive` |
| Браузер не открылся | `rclone config reconnect minkert-gdrive:` |
| Ошибка доступа | Повторите setup, выберите тот же Google-аккаунт |

Файл `scripts/.gdrive-backup.env` в `.gitignore` — токены не попадают в git.
