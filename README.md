# cover-letter

Веб-приложение для создания сопроводительного письма по вакансии и резюме. Требования и этапы находятся в `docs/TECHNICAL_SPECIFICATION.md` и `docs/DEVELOPMENT_PLAN.md`.

## Локальный запуск

Требуется Node.js 24.18.0.

1. `npm ci`
2. Скопировать `.env.example` в `.env` и заполнить значения локально.
3. Однократно включить tracked Git hooks: `npm run hooks:install`.
4. Создать `data/system_prompt.md` на основе согласованного рабочего промпта.
5. `npm run db:migrate`.
6. `npm run dev`.

Перед каждым локальным commit pre-commit hook автоматически синхронизирует `.env` в `data/.env.vps`. Ошибка синхронизации блокирует commit. Не используйте `--no-verify`.

После каждого успешного локального commit post-commit hook автоматически выполняет полный набор release-проверок и сообщает, готов ли commit к ручной выгрузке в GitHub и deployment на VPS. Для повторного ручного запуска используйте `npm run verify:release`.

Проверки: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. `npm run smoke` ожидает запущенный сервер и не вызывает LLM.

Production использует `/var/lib/cover-letter/system_prompt.md` и `/var/lib/cover-letter/cover-letter.sqlite`. Секреты, `data/`, рабочий промпт и БД запрещено добавлять в Git.
