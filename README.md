# cover-letter

Веб-приложение для создания сопроводительного письма по вакансии и резюме. Требования и этапы находятся в `docs/TECHNICAL_SPECIFICATION.md` и `docs/DEVELOPMENT_PLAN.md`.

## Локальный запуск

Требуется Node.js 24.18.0.

1. `npm ci`
2. Скопировать `.env.example` в `.env` и заполнить значения локально.
3. После изменения `.env`: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-vps-env.ps1`
4. Создать `data/system_prompt.md` на основе согласованного рабочего промпта.
5. `npm run db:migrate`
6. `npm run dev`

Проверки: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. `npm run smoke` ожидает запущенный сервер и не вызывает LLM.

Production использует `/var/lib/cover-letter/system_prompt.md` и `/var/lib/cover-letter/cover-letter.sqlite`. Секреты, `data/`, рабочий промпт и БД запрещено добавлять в Git.
