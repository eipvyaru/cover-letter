# Перенос `cover-letter` на VPS с запуском от `root`

Эта инструкция — отдельный упрощённый вариант deployment для текущего этапа проекта. Она не создаёт deployment-пользователя или сервисного пользователя: получение кода, сборка, миграции и процесс приложения выполняются от `root`.

Это согласованное отступление от основного стандарта. Компрометация приложения в такой схеме потенциально даёт процессу права `root`. Ограничения systemd сохраняются, но не заменяют изоляцию непривилегированного пользователя.

## 1. Итоговая схема

```text
GitHub private repository
        ↓ read-only deploy key пользователя root
/var/www/cover-letter             код и production build
/var/www/cover-letter/.env        production-конфигурация
/var/lib/cover-letter             SQLite и системный промпт
/var/cache/cover-letter           writable-кэш Next.js
        ↓
systemd от root → 127.0.0.1:8792 → Nginx HTTPS
```

Playwright не устанавливается. Порт `8791` остаётся зарезервированным. Полный VPS резервируется средствами системного администрирования.

## 2. Значения для подстановки

Используйте согласованные значения и замените оставшиеся placeholders:

- `<GITHUB_REPOSITORY>` — SSH URL приватного GitHub-репозитория;
- VPS: `170.168.112.47`, SSH-порт: `22`;
- локальный SSH-ключ для VPS: `$env:USERPROFILE\.ssh\id_ed25519_vps`;
- `<RELEASE_COMMIT>` — полный hash проверенного коммита;
- `<PREVIOUS_COMMIT>` — commit для отката.

Угловые скобки в реальные команды не переносятся.

## 3. Проверка проекта на Windows

После каждого успешного локального commit эти проверки автоматически выполняет tracked post-commit hook. Он выводит итог `READY`, если commit готов к ручной выгрузке в GitHub и deployment на VPS, либо `NOT READY` с причиной. Уже созданный commit при ошибке проверки сохраняется, но выгружать и развёртывать его нельзя.

Для повторного ручного запуска полного набора проверок выполните:

```powershell
cd C:\_Codex\cover-letter
npm run verify:release
```

Состав автоматической проверки:

```powershell
cd C:\_Codex\cover-letter
node --version
npm ci
npm run db:migrate
npm run lint
npm run typecheck
npm test
npm run build
git status --short
git log -1 --oneline
```

Ожидаемая версия Node.js — `v24.18.0`. Рабочее дерево должно быть чистым.

Убедитесь, что секреты и данные не отслеживаются Git:

```powershell
git ls-files .env data
```

Команда не должна возвращать файлы.

## 4. Ручная публикация в GitHub

```powershell
git remote -v
git push origin main
git rev-parse HEAD
```

Проверьте, что нужный commit появился в GitHub. Не загружайте `.env`, `data/.env.vps`, рабочий промпт или SQLite.

## 5. Подключение к VPS

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_vps" -p 22 root@170.168.112.47
```

Проверьте систему:

```bash
id
lsb_release -a
uname -m
node --version
npm --version
command -v node
command -v npm
```

Команда `id` должна показать `uid=0(root)`. Версия Node.js должна быть `v24.18.0`. Если Node отсутствует или отличается, установите точную версию утверждённым для сервера способом до продолжения.

Установите необходимые пакеты:

```bash
apt-get update
apt-get install -y git nginx certbot python3-certbot-nginx curl
```

## 6. Каталоги

```bash
install -d -m 0755 -o root -g root /var/www/cover-letter
install -d -m 0750 -o root -g root /var/lib/cover-letter
install -d -m 0750 -o root -g root /var/lib/cover-letter/prompt-history
install -d -m 0750 -o root -g root /var/cache/cover-letter
```

Проверьте:

```bash
stat -c '%U:%G %a %n' \
  /var/www/cover-letter \
  /var/lib/cover-letter \
  /var/cache/cover-letter
```

Все перечисленные каталоги должны принадлежать `root:root`.

## 7. Read-only deploy key GitHub для root

```bash
install -d -m 0700 /root/.ssh
ssh-keygen -t ed25519 \
  -f /root/.ssh/cover-letter_github \
  -C cover-letter-vps-root \
  -N ''
cat /root/.ssh/cover-letter_github.pub
```

Добавьте публичный ключ в GitHub:

```text
Repository → Settings → Deploy keys → Add deploy key
```

Флаг `Allow write access` не включайте. Приватный ключ остаётся только на VPS.

Сверьте GitHub host fingerprint с официальной документацией, затем:

```bash
ssh-keyscan github.com >> /root/.ssh/known_hosts
chmod 0600 /root/.ssh/known_hosts
```

Создайте `/root/.ssh/config`:

```sshconfig
Host github-cover-letter
    HostName github.com
    User git
    IdentityFile /root/.ssh/cover-letter_github
    IdentitiesOnly yes
    StrictHostKeyChecking yes
```

```bash
chmod 0600 /root/.ssh/config
ssh -T github-cover-letter
```

Для этого alias URL репозитория имеет вид:

```text
git@github-cover-letter:owner/cover-letter.git
```

## 8. Клонирование проекта

При первом deployment `/var/www/cover-letter` должен быть пустым:

```bash
git clone <GITHUB_REPOSITORY> /var/www/cover-letter
cd /var/www/cover-letter
git checkout main
git rev-parse HEAD
```

Установите зависимости и соберите приложение до передачи production-секретов:

```bash
cd /var/www/cover-letter
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Build не должен вызывать LLM или обращаться к production-БД.

## 9. Передача `.env` и системного промпта

Файл `data/.env.vps` автоматически обновляется pre-commit hook при каждом локальном commit. Ошибка синхронизации блокирует commit. Не используйте `git commit --no-verify`.

На Windows:

```powershell
scp -i "$env:USERPROFILE\.ssh\id_ed25519_vps" -P 22 .\data\.env.vps root@170.168.112.47:/root/cover-letter.env.new
scp -i "$env:USERPROFILE\.ssh\id_ed25519_vps" -P 22 .\data\system_prompt.md root@170.168.112.47:/root/cover-letter.prompt.new
```

На VPS:

```bash
chmod 0600 /root/cover-letter.env.new /root/cover-letter.prompt.new
```

Если prompt уже существует, сохраните его предыдущую версию:

```bash
if test -f /var/lib/cover-letter/system_prompt.md; then
  cp --preserve=mode,ownership,timestamps \
    /var/lib/cover-letter/system_prompt.md \
    /var/lib/cover-letter/prompt-history/system_prompt.$(date -u +%Y%m%dT%H%M%SZ).md
fi
```

Установите файлы через временные имена:

```bash
install -o root -g root -m 0600 \
  /root/cover-letter.env.new /var/www/cover-letter/.env.new
mv /var/www/cover-letter/.env.new /var/www/cover-letter/.env

install -o root -g root -m 0640 \
  /root/cover-letter.prompt.new /var/lib/cover-letter/system_prompt.md.new
mv /var/lib/cover-letter/system_prompt.md.new /var/lib/cover-letter/system_prompt.md

rm -f /root/cover-letter.env.new /root/cover-letter.prompt.new
```

Не используйте `cat` или `diff` для проверки секретных файлов.

## 10. Миграции

```bash
cd /var/www/cover-letter
npm run db:migrate
```

Проверьте наличие файлов без чтения содержимого:

```bash
stat -c '%U:%G %a %n' \
  /var/www/cover-letter/.env \
  /var/lib/cover-letter/system_prompt.md \
  /var/lib/cover-letter/cover-letter.sqlite
```

## 11. Кэш Next.js

```bash
cd /var/www/cover-letter
if [ -d .next/cache ] && [ ! -L .next/cache ]; then
  mv .next/cache .next/cache.build
fi
ln -sfn /var/cache/cover-letter .next/cache
```

После успешного запуска `.next/cache.build` можно удалить вручную.

## 12. Systemd с запуском от root

Проверьте абсолютный путь npm:

```bash
command -v npm
```

Если npm расположен не в `/usr/bin/npm`, исправьте `ExecStart` в `deploy/systemd/cover-letter-root.service` перед установкой.

```bash
cd /var/www/cover-letter
install -o root -g root -m 0644 \
  deploy/systemd/cover-letter-root.service \
  /etc/systemd/system/cover-letter.service
systemctl daemon-reload
systemctl enable --now cover-letter.service
systemctl status cover-letter.service --no-pager
```

В альтернативном unit явно установлены:

```ini
User=root
Group=root
ProtectSystem=strict
NoNewPrivileges=true
ReadWritePaths=/var/lib/cover-letter /var/cache/cover-letter
```

Несмотря на запуск от root, приложение должно записывать только данные и кэш. Код, `.env` и системный prompt во время обычной работы не изменяются.

При ошибке:

```bash
journalctl -u cover-letter.service -n 100 --no-pager
```

Проверьте loopback:

```bash
ss -ltnp | grep ':8792'
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
```

Должен использоваться только `127.0.0.1:8792`, не `0.0.0.0:8792`.

## 13. Nginx и HTTPS

Если сертификат уже существует:

```bash
install -o root -g root -m 0644 \
  /var/www/cover-letter/deploy/nginx/cover-letter.conf \
  /etc/nginx/sites-available/cover-letter.conf
ln -sfn /etc/nginx/sites-available/cover-letter.conf \
  /etc/nginx/sites-enabled/cover-letter.conf
nginx -t
systemctl reload nginx
```

Если сертификата ещё нет, сначала создайте временный HTTP-only server block для `cover-letter.ai-run.ru`, проверьте DNS и HTTP, затем:

```bash
certbot --nginx -d cover-letter.ai-run.ru
```

После выпуска сертификата установите конфигурацию из репозитория и выполните:

```bash
nginx -t
systemctl reload nginx
```

После получения сертификата проверьте, что Certbot управляет им, включите системный таймер автообновления и выполните тестовое продление:

```bash
certbot certificates
systemctl enable --now certbot.timer
systemctl status certbot.timer --no-pager
systemctl list-timers certbot.timer --no-pager
certbot renew --dry-run
```

В выводе `certbot certificates` должен присутствовать `cover-letter.ai-run.ru`, таймер должен иметь состояние `active (waiting)`, а `certbot renew --dry-run` — завершиться без ошибок. Если проверка не прошла, не завершайте deployment; изучите журнал:

```bash
journalctl -u certbot.service -n 100 --no-pager
```

Конфигурации других сайтов не изменяйте. Порты `8791` и `8792` наружу не открывайте.

## 14. Проверка production

```bash
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
curl --fail --silent https://cover-letter.ai-run.ru/api/health
systemctl restart cover-letter.service
curl --fail --silent http://127.0.0.1:8792/api/health
journalctl -u cover-letter.service -n 50 --no-pager
```

В браузере проверьте административный вход, автоматическую и ручную загрузку источников, генерацию, NDJSON-прогресс, результат, историю, экспорт и мобильную ширину 320 px.

Real-LLM проверка расходует средства ProxyAPI и запускается только явно.

## 15. Обновление

Сначала локально выполните проверки, commit и ручной push. Запишите hash release-коммита.

На VPS убедитесь, что системный backup актуален:

```bash
cd /var/www/cover-letter
git status --short
git rev-parse HEAD
git fetch --prune origin
git checkout --detach <RELEASE_COMMIT>
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run db:migrate
systemctl restart cover-letter.service
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
curl --fail --silent https://cover-letter.ai-run.ru/api/health
```

Обычное обновление не заменяет `.env`, SQLite или системный prompt.

## 16. Откат

```bash
cd /var/www/cover-letter
systemctl stop cover-letter.service
git checkout --detach <PREVIOUS_COMMIT>
npm ci
npm run build
systemctl start cover-letter.service
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
```

Не восстанавливайте старую SQLite автоматически поверх новых данных. При несовместимой схеме используйте отдельно согласованный системный снимок VPS.

## 17. Диагностика

```bash
systemctl status cover-letter.service --no-pager
journalctl -u cover-letter.service -n 200 --no-pager
nginx -t
tail -n 100 /var/log/nginx/error.log
ss -ltnp | grep -E ':(80|443|8791|8792)\b'
df -h
```

Не выводите в логи или сообщения API-ключ, cookies, password hash, полный системный prompt, резюме, вакансии и raw LLM response.
