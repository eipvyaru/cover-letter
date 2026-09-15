# План разработки `cover-letter`

Статус: готов к исполнению после утверждения ТЗ 1.1.  
Базовая конфигурация: `cover-letter.ai-run.ru`, web `8792`, зарезервированный Playwright `8791`.

## Принципы выполнения

- Один проект в `C:\_Codex\cover-letter`, без вложенного `app`.
- Каждый законченный этап завершается относящимися к нему проверками и локальным Git-коммитом.
- Секреты, рабочий промпт, SQLite и весь `data/` не попадают в Git.
- Production-код, постоянные данные и writable-кэш разделены между `/var/www`, `/var/lib` и `/var/cache`.
- Playwright renderer, prompt editor, Telegram, email и worker не входят в первую версию.
- Deployment на VPS запускается вручную; push в GitHub выполняет владелец.

## Этап 1. Основа проекта

Результат:

- `AGENTS.md` и `deploy/project.json` с согласованной идентичностью;
- Git `main`, `.gitignore`, `.node-version`;
- Next.js 16, React 19, TypeScript strict, Zod 4;
- единая структура `src`, `migrations`, `scripts`, `deploy`, `tests`, `docs`, `data`;
- обязательные npm-команды и lockfile.

Проверка: чистая установка, lint/typecheck базового каркаса, отсутствие секретных файлов в Git.

## Этап 2. Конфигурация окружения

Результат:

- серверная Zod-схема окружения;
- `.env.example` без рабочих секретов;
- `sync-vps-env.ps1` и `verify-env-sync.mjs`;
- атомарный `data/.env.vps` с production-путями `/var/lib/cover-letter`;
- development и production start wrappers;
- безопасная процедура создания password hash и session secret.

Проверка: дубликаты ключей, отсутствие исходника, неподдерживаемый синтаксис, сохранение старого результата при ошибке, redacted-вывод.

## Этап 3. SQLite и миграции

Результат:

- адаптер `node:sqlite`;
- миграционный runner с checksum;
- таблицы `schema_migrations`, `admin_sessions`, `app_settings`, `generations`, `audit_events`;
- репозитории истории, сессий, настроек и audit;
- лимит 30 записей и срок 30 дней;
- UTF-8 BOM export без постоянного серверного файла.

Проверка: пустая БД, предыдущая схема с фикстурами, повторный запуск, WAL, конкурентная запись, retention и export.

## Этап 4. Безопасность и авторизация

Результат:

- login/logout/status через серверные сессии;
- hash-проверка пароля;
- cookie `cover_letter_admin`;
- Origin/CSRF middleware;
- rate limit 5 в минуту с отдельной политикой login и LLM;
- максимум 5 активных admin-сессий;
- request ID, безопасные ошибки и redacted logging;
- audit административных действий.

Проверка: перебор входа, истечение и отзыв сессии, cookie flags, Origin/CSRF, forwarded headers и разграничение visitor/admin.

## Этап 5. Получение источников

Результат:

- строгий URL validator;
- DNS/IP/redirect SSRF guard;
- HTTP-клиент с retries, timeout и byte limit;
- Cheerio-очистка и JSON-LD `JobPosting`;
- HeadHunter API fallback;
- ручной текст с приоритетом над URL;
- диагностические сведения без утечки полного текста в технические логи.

Проверка: public/private адреса, DNS rebinding fixtures, redirects, content types, CAPTCHA/JS-required ответы, HTML и HH fixtures.

## Этап 6. LLM-контур

Результат:

- ProxyAPI-совместимый серверный клиент;
- серверный allowlist моделей и default `openai/gpt-5.6-luna`;
- чтение внешнего системного промпта с version/hash;
- structured user payload и защита от prompt injection;
- основная генерация;
- парсер шести разделов;
- серверное добавление контактов;
- отдельный JSON quality check;
- usage aggregation;
- best-effort стоимость по ProxyAPI и ЦБ РФ.

Проверка: mock provider, timeout, redirects disabled, malformed result, warning/error paths, отсутствие temperature для неподдерживающей модели и отсутствие ключа в браузерном bundle.

## Этап 7. API и потоковый протокол

Результат:

- health, ready, config;
- admin session API;
- history API;
- `POST /api/generate` с Zod, role normalization, rate limit и NDJSON;
- стабильные progress/result/error events;
- сохранение письма при вторичных ошибках.

Проверка: частичные NDJSON chunks, disconnect клиента, warning после quality check, ошибка записи истории и readiness при недоступной БД/промпте.

## Этап 8. Интерфейс

Результат:

- визуальная система по `https://cl.ai-run.ru/`;
- двухколоночный desktop и одноколоночный mobile layout;
- форма, ручной ввод, admin settings;
- empty/loading/result состояния;
- вкладки «Письмо», «Анализ», «Источники и лог»;
- копирование и TXT download;
- admin login и история;
- accessibility и optional Model Context registration.

Проверка: desktop, tablet, 480 px и 320 px; keyboard navigation, focus trap, live regions, отсутствие horizontal scroll.

## Этап 9. Комплексные тесты

Результат:

- unit и integration suite;
- E2E основных пользовательских и административных сценариев;
- бесплатный default smoke;
- отдельный явно включаемый real-LLM smoke;
- CI-подобная локальная команда полного прогона.

Проверка: `lint`, `typecheck`, `test`, `build`, `smoke`, затем production start и health.

## Этап 10. Deployment и эксплуатация

Результат:

- `cover-letter.service` с hardening;
- Nginx HTTPS config с отключённым buffering для генерации;
- `/var/www/cover-letter`, `/var/lib/cover-letter`, `/var/cache/cover-letter` и корректные владельцы/права;
- ручная установка `.env.vps` и системного промпта;
- пошаговый deployment через GitHub и read-only deploy key;
- инструкции первого запуска, обновления, rollback и диагностики;
- описание внешнего полного backup VPS как ответственности системного администрирования.

Проверка: Nginx syntax, systemd restart, loopback-only ports, public HTTPS, ready/health, admin login, генерация, SQLite persistence и сохранение данных при обычном обновлении кода.

## Этап 11. Приёмка

Финальный чек-лист:

- все обязательные команды проходят;
- нет секретов и production-данных в Git;
- SSRF, CSRF, rate limit и admin boundary проверены;
- письмо содержит минимум три страха, matching и контакты;
- quality check и warning-сценарий работают;
- история ограничена 30 записями и 30 днями;
- UI корректен при 320 px;
- приложение слушает только `127.0.0.1:8792`;
- deployment не заменяет `/var/lib/cover-letter`;
- инструкция ручного deployment воспроизводима владельцем проекта.

## Порядок локальных коммитов

Предлагаемые завершённые изменения:

1. project identity and rules;
2. application scaffold and environment contract;
3. SQLite schema and repositories;
4. authentication and security controls;
5. protected source acquisition;
6. LLM generation and quality pipeline;
7. streaming API and history endpoints;
8. responsive user interface;
9. complete automated test suite;
10. production deployment and operations documentation;
11. acceptance fixes and release-ready state.

