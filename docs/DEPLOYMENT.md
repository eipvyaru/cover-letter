# Ручной deployment на Ubuntu VPS

## Первый запуск

1. Установить Node.js 24.18.0 и npm; проверить `node --version`.
2. Создать непривилегированного пользователя `cover-letter`, каталоги `/var/www/cover-letter`, `/var/lib/cover-letter`, `/var/cache/cover-letter` и назначить данные/кэш пользователю сервиса.
3. Настроить read-only deploy key GitHub для deployment-пользователя и клонировать репозиторий в `/var/www/cover-letter`.
4. В локальном проекте синхронизировать `.env.vps`, передать его отдельной защищённой операцией как `/var/www/cover-letter/.env`, установить права `600`. Не выводить содержимое.
5. Отдельно передать системный промпт в `/var/lib/cover-letter/system_prompt.md`, установить права `640` и сохранить предыдущую версию перед заменой.
6. Выполнить `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:migrate`.
7. Установить `deploy/systemd/cover-letter.service`, проверить абсолютный путь npm, выполнить `systemctl daemon-reload` и включить сервис.
8. Установить Nginx-конфигурацию, выпустить сертификат, выполнить `nginx -t` и reload.
9. Проверить loopback `/api/health`, `/api/ready`, публичный HTTPS, вход администратора, генерацию и запись истории.

## Обновление

Убедиться в актуальном системном снимке VPS. Затем вручную выполнить fetch/checkout утверждённого commit, `npm ci`, проверки, build, миграции и restart. Обычное обновление не заменяет `.env`, `/var/lib/cover-letter` или системный промпт.

## Откат

Переключить checkout на предыдущий проверенный commit, выполнить `npm ci`, build и restart. Базу автоматически не откатывать поверх новых данных. При несовместимой миграции использовать отдельно согласованный системный снимок VPS.
