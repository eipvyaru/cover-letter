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

- GitHub-репозиторий — `git@github-cover-letter:eipvyaru/cover-letter.git`;
- VPS: `170.168.112.47`, SSH-порт: `22`;
- локальный SSH-ключ для VPS: `$env:USERPROFILE\.ssh\id_ed25519_vps`;
- `<RELEASE_COMMIT>` — полный hash проверенного коммита;
- `<PREVIOUS_COMMIT>` — commit для отката.

Угловые скобки в реальные команды не переносятся.

## 3. Проверка проекта на Windows

После каждого успешного локального commit эти проверки автоматически выполняет tracked post-commit hook. Установка зависимостей, миграции, lint, typecheck, тесты и production build выполняются во временном чистом Git worktree, поэтому запущенный локальный сервер не блокирует проверку. Hook выводит итог `READY`, если commit готов к ручной выгрузке в GitHub и deployment на VPS, либо `NOT READY` с причиной. Уже созданный commit при ошибке проверки сохраняется, но выгружать и развёртывать его нельзя.

Для повторного ручного запуска полного набора проверок выполните:

```powershell
cd C:\_Codex\cover-letter
npm.cmd run verify:release
```

Состав автоматической проверки:

```powershell
cd C:\_Codex\cover-letter
node --version
npm ci
npm audit --audit-level=moderate
npm run db:migrate
npm run lint
npm run typecheck
npm test
npm run build
git status --short
git log -1 --oneline
```

Ожидаемая версия Node.js — `v24.21.0`. Рабочее дерево должно быть чистым.

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

Команда `id` должна показать `uid=0(root)`. Версия Node.js должна быть `v24.21.0`. Если Node отсутствует или отличается, установите точную версию утверждённым для сервера способом до продолжения.

Установите необходимые пакеты:

```bash
apt-get update
apt-get install -y git nginx certbot python3-certbot-nginx curl nano
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

```bash
nano /root/.ssh/config
```

`nano` создаст файл, если его ещё нет. Вставьте:

```sshconfig
Host github-cover-letter
    HostName github.com
    User git
    IdentityFile /root/.ssh/cover-letter_github
    IdentitiesOnly yes
    StrictHostKeyChecking yes
```

Сохраните файл в `nano`:

```text
Ctrl+O
Enter
Ctrl+X
```

Затем обязательно выставьте правильные права:

```bash
chmod 0600 /root/.ssh/config
```

Проверьте существование и права:

```bash
ls -l /root/.ssh/config
```

Ожидаемо:

```text
-rw------- 1 root root ... /root/.ssh/config
```

Проверьте настройку:

```bash
ssh -T github-cover-letter
```

Если Deploy Key уже добавлен в GitHub, должно появиться сообщение `successfully authenticated`. GitHub не предоставляет shell, поэтому успешная команда `ssh -T` штатно завершается с кодом `1`; это не ошибка настройки ключа.

Для этого alias URL репозитория имеет вид:

```text
git@github-cover-letter:owner/cover-letter.git
```

## 8. Клонирование проекта

При первом deployment `/var/www/cover-letter` должен быть пустым. Проверьте каталог:

```bash
ls -la /var/www/cover-letter
git clone git@github-cover-letter:eipvyaru/cover-letter.git /var/www/cover-letter
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

Чтобы разрешить автоматическую загрузку сайтов в зоне `.ru`, у которых доменное имя начинается с латинской буквы и далее содержит только латинские буквы или цифры, задайте в локальном `.env` перед синхронизацией:

```env
SOURCE_ALLOWED_HOST_MASKS_JSON='["*.^[A-Za-z][A-Za-z0-9]*$.ru"]'
```

Значение является JSON-массивом масок. Указанная `.ru` маска должна оставаться первым элементом; дополнительные маски добавляются отдельными строками, например `SOURCE_ALLOWED_HOST_MASKS_JSON='["*.^[A-Za-z][A-Za-z0-9]*$.ru","*.example.com","hh.ru"]'`. Префикс `*.` разрешает любое число корректных поддоменов. Первой маске соответствуют `hh.ru`, `api.hh.ru`, `a1.ru` и `www.a1.ru`; не соответствуют `1a.ru`, `a-b.ru`, `example.com` и `example.ru.evil.com`. Также поддерживаются точные домены и обычные wildcard-маски `*.example.com`. Произвольные регулярные выражения не выполняются. Пустое или отсутствующее значение сохраняет поддержку любых публичных доменов. Во всех режимах приватные адреса блокируются при DNS-проверке и непосредственно при сетевом соединении.

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

После первого запуска приложение сохранит исходный `system_prompt.md` как версию в `/var/lib/cover-letter/prompt-history/` и создаст там `active.json`. Новые версии загружайте через настройки администратора и выбирайте текущую там же. После появления `active.json` ручная замена `system_prompt.md` не переключает активную версию. Для переноса версий между серверами переносите весь `prompt-history/` вместе с `active.json` защищённым способом. Ни одна версия промпта или `active.json` не должна попадать в GitHub.

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

Если сертификата ещё нет, выполните следующие шаги.

### 13.1. Временная HTTP-конфигурация

Создайте временный HTTP-only конфиг Nginx:

```bash
nano /etc/nginx/sites-available/cover-letter-http.conf
```

Вставьте:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name cover-letter.ai-run.ru;

    location / {
        proxy_pass http://127.0.0.1:8792;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Сохраните файл:

```text
Ctrl+O
Enter
Ctrl+X
```

Включите временный сайт, проверьте конфигурацию и только после успешной проверки перезагрузите Nginx:

```bash
ln -sfn \
  /etc/nginx/sites-available/cover-letter-http.conf \
  /etc/nginx/sites-enabled/cover-letter-http.conf
nginx -t
systemctl reload nginx
```

Не удаляйте и не изменяйте конфигурации других сайтов. Схема на этом этапе: `cover-letter.ai-run.ru → Nginx :80 → 127.0.0.1:8792`; порт `8792` наружу не открывается.

### 13.2. Проверка HTTP

Сначала проверьте backend напрямую:

```bash
curl --fail --silent --show-error http://127.0.0.1:8792/api/health
curl --fail --silent --show-error http://127.0.0.1:8792/api/ready
```

Затем проверьте HTTP через Nginx и публичный DNS:

```bash
curl --fail --silent --show-error \
  http://cover-letter.ai-run.ru/api/health
```

Ожидаемое тело ответа: `{"status":"ok"}`. Убедитесь, что `http://cover-letter.ai-run.ru` доступен также с внешнего компьютера. Если проверка не проходит, Certbot пока не запускайте.

### 13.3. Получение сертификата

```bash
certbot --nginx -d cover-letter.ai-run.ru
```

После успешного выпуска сертификата установите финальный конфиг из репозитория, включите его и удалите только временный symlink этого проекта:

```bash
install -o root -g root -m 0644 \
  /var/www/cover-letter/deploy/nginx/cover-letter.conf \
  /etc/nginx/sites-available/cover-letter.conf
ln -sfn \
  /etc/nginx/sites-available/cover-letter.conf \
  /etc/nginx/sites-enabled/cover-letter.conf
rm -f /etc/nginx/sites-enabled/cover-letter-http.conf
nginx -t
systemctl reload nginx
```

Проверьте HTTPS:

```bash
curl --fail --silent --show-error \
  https://cover-letter.ai-run.ru/api/health
```

Ожидаемое тело ответа: `{"status":"ok"}`. Проверка не зависит от того, согласовал ли клиент HTTP/1.1 или HTTP/2.

### 13.4. Автоматическое обновление сертификата

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

Real-LLM проверка расходует средства KodikRouter и запускается только явно.

## 15. Обновление

### 15.1. Обязательная проверка на Windows

Все изменения должны быть уже зафиксированы локальным commit. Выполните команды в одном окне PowerShell:

```powershell
cd C:\_Codex\cover-letter

$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne 'main') { throw "Ожидалась ветка main, получена: $currentBranch" }

git status --short
if (git status --porcelain) { throw 'Рабочее дерево содержит незакоммиченные изменения.' }

npm.cmd run verify:release
if ($LASTEXITCODE -ne 0) { throw 'Release-проверка завершилась ошибкой. Push и deployment запрещены.' }

if (git status --porcelain) { throw 'После release-проверки рабочее дерево перестало быть чистым.' }
$releaseCommit = (git rev-parse HEAD).Trim()
git log -1 --oneline
Write-Host "RELEASE_COMMIT=$releaseCommit"
```

В конце проверки должно появиться сообщение `READY: this commit passed all local checks and is ready for manual push to GitHub and deployment to the VPS.` Запишите выведенное значение `RELEASE_COMMIT`.

### 15.2. Ручная выгрузка проверенного commit в GitHub

Продолжайте в том же окне PowerShell, чтобы сохранилась переменная `$releaseCommit`:

```powershell
git remote -v
git remote get-url origin

git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Не удалось выполнить push в GitHub.' }

$remoteLine = git ls-remote origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or -not $remoteLine) { throw 'Не удалось прочитать main из GitHub.' }
$remoteCommit = ($remoteLine -split '\s+')[0]
if ($remoteCommit -ne $releaseCommit) {
  throw "GitHub main содержит $remoteCommit вместо $releaseCommit"
}

Write-Host "GitHub подтверждён: $remoteCommit"
```

Не продолжайте deployment, если `npm.cmd run verify:release`, `git push` или сравнение hash завершилось ошибкой. В следующих командах вместо `<RELEASE_COMMIT>` используйте подтверждённое значение `$releaseCommit`. Пример значения: `2d3281cee68e02d0de39a7b3ce13f28044eeaadc`.

После подключения к VPS задайте подтверждённый commit один раз и выполняйте подразделы 15.3–15.4 в том же shell-сеансе:

```bash
read -r -p 'RELEASE_COMMIT: ' RELEASE_COMMIT
test -n "$RELEASE_COMMIT"
```

Например: `RELEASE_COMMIT=2d3281cee68e02d0de39a7b3ce13f28044eeaadc`. В остальных VPS-командах значение берётся из переменной `$RELEASE_COMMIT`.

### 15.3. Передача версий системного промпта

Этот шаг выполняйте, когда локально добавлены версии в `C:\_Codex\cover-letter\data\prompt-history`. Файлы промптов не передаются через GitHub. В том же окне PowerShell создайте staging-каталог на VPS и скопируйте туда все версии вместе с указателем активной версии:

```powershell
cd C:\_Codex\cover-letter

$promptSource = (Resolve-Path -LiteralPath '.\data\prompt-history').Path
$activePrompt = Join-Path $promptSource 'active.json'
if (-not (Test-Path -LiteralPath $activePrompt -PathType Leaf)) {
  throw 'Не найден data\prompt-history\active.json. Сначала выберите текущий промпт в настройках администратора.'
}

$promptFiles = @(Get-ChildItem -LiteralPath $promptSource -File -Filter '*.md')
if ($promptFiles.Count -eq 0) { throw 'В data\prompt-history нет версий промпта.' }

$promptStage = "/root/cover-letter-prompts-$releaseCommit"
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_vps" -p 22 root@170.168.112.47 `
  "install -d -o root -g root -m 0700 '$promptStage'"
if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать staging-каталог для промптов.' }

foreach ($file in $promptFiles) {
  scp -i "$env:USERPROFILE\.ssh\id_ed25519_vps" -P 22 `
    $file.FullName "root@170.168.112.47:${promptStage}/"
  if ($LASTEXITCODE -ne 0) { throw "Не удалось передать версию промпта: $($file.Name)" }
}

scp -i "$env:USERPROFILE\.ssh\id_ed25519_vps" -P 22 `
  $activePrompt "root@170.168.112.47:${promptStage}/active.json"
if ($LASTEXITCODE -ne 0) { throw 'Не удалось передать active.json.' }

Write-Host "PROMPT_STAGE=$promptStage"
```

На VPS продолжайте в том же shell-сеансе:

```bash
set -euo pipefail

test -n "${RELEASE_COMMIT:-}"
PROMPT_STAGE="/root/cover-letter-prompts-$RELEASE_COMMIT"
PROMPT_TARGET=/var/lib/cover-letter/prompt-history

test "$PROMPT_STAGE" = "/root/cover-letter-prompts-$RELEASE_COMMIT"
test -d "$PROMPT_STAGE"
test -s "$PROMPT_STAGE/active.json"

install -d -o root -g root -m 0700 "$PROMPT_TARGET"

prompt_count=0
for file in "$PROMPT_STAGE"/*.md; do
  [ -e "$file" ] || continue
  install -o root -g root -m 0600 \
    "$file" "$PROMPT_TARGET/$(basename "$file")"
  prompt_count=$((prompt_count + 1))
done
[ "$prompt_count" -gt 0 ]

install -o root -g root -m 0600 \
  "$PROMPT_STAGE/active.json" "$PROMPT_TARGET/active.json.new"
mv "$PROMPT_TARGET/active.json.new" "$PROMPT_TARGET/active.json"

find "$PROMPT_TARGET" -maxdepth 1 -type f \
  -printf '%u:%g %m %TY-%Tm-%Td %TH:%TM:%TS %f\n'

rm -rf -- "$PROMPT_STAGE"
```

Команды добавляют новые версии, не удаляя уже имеющиеся на VPS. `active.json` заменяется атомарно и переносит выбранную локально текущую версию. Не используйте `cat` или `diff`: содержимое промптов не должно попадать в терминальные логи.

### 15.4. Обновление VPS

На VPS убедитесь, что системный backup актуален:

```bash
set -euo pipefail

test -n "${RELEASE_COMMIT:-}"

cd /var/www/cover-letter

if [ -n "$(git status --porcelain)" ]; then
  echo "Рабочее дерево VPS содержит изменения:"
  git status --short
  exit 1
fi

PREVIOUS_COMMIT=$(git rev-parse HEAD)
echo "PREVIOUS_COMMIT=$PREVIOUS_COMMIT"

git fetch --prune origin
git checkout --detach "$RELEASE_COMMIT"

if [ "$(git rev-parse HEAD)" != "$RELEASE_COMMIT" ]; then
  echo "На VPS выбран commit, отличный от RELEASE_COMMIT"
  exit 1
fi

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

Перед продолжением сохраните выведенное значение `PREVIOUS_COMMIT`: оно потребуется для отката. Благодаря `set -euo pipefail` deployment прекращается при первой ошибке. Обычное обновление не заменяет `.env`, SQLite или системный prompt.

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
