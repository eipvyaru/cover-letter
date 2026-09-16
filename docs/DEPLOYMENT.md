# Перенос `cover-letter` на Ubuntu VPS

Инструкция описывает первый deployment и последующие обновления приложения `https://cover-letter.ai-run.ru`.

## 1. Принятая схема

```text
GitHub (private repository)
        ↓ read-only deploy key
/var/www/cover-letter             исходный код и сборка
/var/www/cover-letter/.env        production-конфигурация
/var/lib/cover-letter             SQLite и системный промпт
/var/cache/cover-letter           writable-кэш Next.js
        ↓
systemd → 127.0.0.1:8792 → Nginx HTTPS
```

Playwright-сервис в текущей версии не устанавливается. Порт `8791` остаётся зарезервированным. Worker, Telegram и email отсутствуют.

Полный VPS резервируется средствами системного администрирования. Приложение не создаёт отдельную off-VPS копию.

## 2. Параметры, которые нужно подставить

В командах ниже замените:

- `<GITHUB_REPOSITORY>` — SSH URL приватного репозитория, например `git@github.com:owner/cover-letter.git`;
- `<DEPLOY_USER>` — существующий непривилегированный SSH-пользователь, выполняющий обновление кода;
- `<VPS_HOST>` — IP-адрес или SSH-имя VPS;
- `<SSH_PORT>` — SSH-порт, обычно `22`;
- `<RELEASE_COMMIT>` — полный hash проверенного Git-коммита.

Не подставляйте значения с угловыми скобками буквально.

## 3. Проверка локального проекта

На Windows в PowerShell:

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

Ожидаемая версия Node.js: `v24.18.0`. `git status --short` не должен показывать незакоммиченные исходники.

Файлы `.env`, `data/.env.vps`, `data/system_prompt.md` и SQLite не должны отображаться среди отслеживаемых Git-файлов:

```powershell
git ls-files .env data
```

Команда не должна вернуть ничего.

## 4. Публикация кода в GitHub

Remote добавляет и push выполняет владелец проекта вручную. Пример:

```powershell
git remote -v
git push origin main
```

Убедитесь в интерфейсе GitHub, что нужный commit присутствует в ветке `main`. Не загружайте `.env`, каталог `data`, production-промпт или базу через веб-интерфейс GitHub.

## 5. Подготовка Ubuntu

Подключитесь к VPS:

```bash
ssh -p <SSH_PORT> <DEPLOY_USER>@<VPS_HOST>
```

Проверьте Ubuntu, архитектуру и Node.js:

```bash
lsb_release -a
uname -m
node --version
npm --version
command -v node
command -v npm
```

На VPS должна быть та же patch-версия Node.js: `v24.18.0`. Если Node отсутствует или отличается, сначала установите именно эту версию утверждённым системным способом. Не продолжайте с неподдерживаемой версией.

Установите системные пакеты:

```bash
sudo apt-get update
sudo apt-get install -y git nginx certbot python3-certbot-nginx curl
```

## 6. Сервисный пользователь и каталоги

Создайте системного пользователя без интерактивного входа, если он ещё не существует:

```bash
id cover-letter >/dev/null 2>&1 || sudo useradd \
  --system \
  --home-dir /var/lib/cover-letter \
  --create-home \
  --shell /usr/sbin/nologin \
  cover-letter
```

Создайте каталоги:

```bash
sudo install -d -m 0755 -o <DEPLOY_USER> -g <DEPLOY_USER> /var/www/cover-letter
sudo install -d -m 0750 -o cover-letter -g cover-letter /var/lib/cover-letter
sudo install -d -m 0750 -o cover-letter -g cover-letter /var/lib/cover-letter/prompt-history
sudo install -d -m 0750 -o cover-letter -g cover-letter /var/cache/cover-letter
```

Код принадлежит deployment-пользователю. Данные и кэш принадлежат пользователю `cover-letter`. Само приложение не запускается от `root`.

## 7. Read-only deploy key для GitHub

Выполните от имени `<DEPLOY_USER>`:

```bash
install -d -m 0700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/cover-letter_github -C cover-letter-vps -N ''
cat ~/.ssh/cover-letter_github.pub
```

Добавьте выведенный публичный ключ в GitHub:

```text
Repository → Settings → Deploy keys → Add deploy key
```

Не включайте `Allow write access`. Приватный ключ остаётся только на VPS.

Перед добавлением GitHub в `known_hosts` сверьте опубликованный GitHub fingerprint с официальной документацией. Затем:

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 0600 ~/.ssh/known_hosts
```

Добавьте в `~/.ssh/config`:

```sshconfig
Host github-cover-letter
    HostName github.com
    User git
    IdentityFile ~/.ssh/cover-letter_github
    IdentitiesOnly yes
    StrictHostKeyChecking yes
```

Установите права и проверьте подключение:

```bash
chmod 0600 ~/.ssh/config
ssh -T github-cover-letter
```

GitHub обычно отвечает сообщением об успешной аутентификации без shell-доступа.

SSH URL репозитория для этого alias должен иметь вид:

```text
git@github-cover-letter:owner/cover-letter.git
```

## 8. Первое получение исходного кода

Каталог `/var/www/cover-letter` должен быть пустым перед первым clone:

```bash
git clone <GITHUB_REPOSITORY> /var/www/cover-letter
cd /var/www/cover-letter
git checkout main
git rev-parse HEAD
```

Если используется alias из предыдущего раздела, подставьте SSH URL с `github-cover-letter`.

Установите зависимости строго по lockfile и выполните проверки до установки production-секретов:

```bash
cd /var/www/cover-letter
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Build не должен вызывать LLM, обращаться к production-БД или отправлять внешние сообщения.

## 9. Передача конфигурации и промпта

Файл `data/.env.vps` автоматически обновляется pre-commit hook при каждом локальном commit. Ошибка синхронизации блокирует commit. Не используйте `git commit --no-verify`.

С Windows передайте файлы во временные файлы домашнего каталога deployment-пользователя:

```powershell
scp -P <SSH_PORT> .\data\.env.vps <DEPLOY_USER>@<VPS_HOST>:~/cover-letter.env.new
scp -P <SSH_PORT> .\data\system_prompt.md <DEPLOY_USER>@<VPS_HOST>:~/cover-letter.prompt.new
```

На VPS сначала ограничьте права staging-файлов:

```bash
chmod 0600 ~/cover-letter.env.new ~/cover-letter.prompt.new
```

Если production-промпт уже существует, сохраните предыдущую версию:

```bash
if sudo test -f /var/lib/cover-letter/system_prompt.md; then
  sudo cp --preserve=mode,ownership,timestamps \
    /var/lib/cover-letter/system_prompt.md \
    /var/lib/cover-letter/prompt-history/system_prompt.$(date -u +%Y%m%dT%H%M%SZ).md
fi
```

Установите файлы атомарно через `install` во временный файл и `mv`:

```bash
sudo install -o cover-letter -g cover-letter -m 0600 \
  ~/cover-letter.env.new /var/www/cover-letter/.env.new
sudo mv /var/www/cover-letter/.env.new /var/www/cover-letter/.env

sudo install -o cover-letter -g cover-letter -m 0640 \
  ~/cover-letter.prompt.new /var/lib/cover-letter/system_prompt.md.new
sudo mv /var/lib/cover-letter/system_prompt.md.new /var/lib/cover-letter/system_prompt.md

rm -f ~/cover-letter.env.new ~/cover-letter.prompt.new
```

Не запускайте `cat`, `diff` или другие команды, печатающие значения `.env` или полный prompt.

## 10. Миграции SQLite

Запустите миграции от имени сервисного пользователя:

```bash
cd /var/www/cover-letter
sudo -u cover-letter /usr/bin/npm run db:migrate
```

Если `command -v npm` показал другой абсолютный путь, используйте его вместо `/usr/bin/npm` во всех командах и unit-файле.

Проверьте права без вывода содержимого:

```bash
sudo stat -c '%U:%G %a %n' \
  /var/www/cover-letter/.env \
  /var/lib/cover-letter \
  /var/lib/cover-letter/system_prompt.md \
  /var/lib/cover-letter/cover-letter.sqlite
```

## 11. Writable-кэш Next.js

После build замените каталог `.next/cache` ссылкой на выделенный writable-кэш:

```bash
cd /var/www/cover-letter
if [ -d .next/cache ] && [ ! -L .next/cache ]; then
  mv .next/cache .next/cache.build
fi
ln -sfn /var/cache/cover-letter .next/cache
```

После успешного запуска старый `.next/cache.build` можно удалить вручную.

## 12. Установка systemd unit

Проверьте путь npm:

```bash
command -v npm
```

Если это не `/usr/bin/npm`, исправьте `ExecStart` в копии unit-файла перед установкой.

```bash
cd /var/www/cover-letter
sudo install -o root -g root -m 0644 \
  deploy/systemd/cover-letter.service \
  /etc/systemd/system/cover-letter.service
sudo systemctl daemon-reload
sudo systemctl enable --now cover-letter.service
sudo systemctl status cover-letter.service --no-pager
```

При ошибке:

```bash
sudo journalctl -u cover-letter.service -n 100 --no-pager
```

Проверьте, что сервер слушает только loopback:

```bash
sudo ss -ltnp | grep ':8792'
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
```

Ожидаются `127.0.0.1:8792`, `{"status":"ok"}` и `{"status":"ready"}`. Порта `0.0.0.0:8792` быть не должно.

## 13. Установка Nginx и HTTPS

Если сертификат для домена уже существует, установите готовый конфиг:

```bash
sudo install -o root -g root -m 0644 \
  /var/www/cover-letter/deploy/nginx/cover-letter.conf \
  /etc/nginx/sites-available/cover-letter.conf
sudo ln -sfn /etc/nginx/sites-available/cover-letter.conf \
  /etc/nginx/sites-enabled/cover-letter.conf
sudo nginx -t
sudo systemctl reload nginx
```

Если сертификата ещё нет, сначала создайте временный HTTP-only server block для `cover-letter.ai-run.ru`, проверьте `nginx -t`, reload и доступность домена. Затем выпустите сертификат:

```bash
sudo certbot --nginx -d cover-letter.ai-run.ru
```

После выпуска сертификата установите готовый конфиг из репозитория и снова выполните:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Не изменяйте конфигурации других сайтов.

## 14. Финальная проверка

На VPS:

```bash
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
curl --fail --silent https://cover-letter.ai-run.ru/api/health
sudo systemctl restart cover-letter.service
curl --fail --silent http://127.0.0.1:8792/api/health
sudo journalctl -u cover-letter.service -n 50 --no-pager
```

Из браузера проверьте:

1. страницу без горизонтального скролла;
2. административный вход;
3. загрузку вакансии и резюме;
4. ручной ввод источников;
5. генерацию и NDJSON-прогресс;
6. письмо, анализ и источники;
7. копирование и скачивание TXT;
8. историю, экспорт и очистку;
9. мобильную ширину 320 px.

Real-LLM проверка расходует средства ProxyAPI и выполняется только явно.

## 15. Обновление приложения

### Локально

```powershell
cd C:\_Codex\cover-letter
npm ci
npm run lint
npm run typecheck
npm test
npm run build
git status --short
git push origin main
```

Запишите полный hash предназначенного для deployment коммита:

```powershell
git rev-parse HEAD
```

### На VPS

Убедитесь, что системное резервирование VPS актуально. Затем:

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
sudo -u cover-letter /usr/bin/npm run db:migrate
sudo systemctl restart cover-letter.service
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
curl --fail --silent https://cover-letter.ai-run.ru/api/health
```

Обычное обновление кода не заменяет `.env`, SQLite или системный промпт. Если `.env` изменялся, pre-commit hook уже обновил `data/.env.vps`; передайте этот файл отдельной защищённой операцией.

## 16. Откат кода

Запишите текущий и предыдущий commit до обновления. Для отката:

```bash
cd /var/www/cover-letter
sudo systemctl stop cover-letter.service
git checkout --detach <PREVIOUS_COMMIT>
npm ci
npm run build
sudo systemctl start cover-letter.service
curl --fail --silent http://127.0.0.1:8792/api/health
curl --fail --silent http://127.0.0.1:8792/api/ready
```

Не восстанавливайте старую SQLite поверх новых данных автоматически. Если откатываемый код несовместим с текущей схемой, остановитесь и используйте отдельно согласованный план восстановления системного снимка VPS.

## 17. Диагностика

```bash
sudo systemctl status cover-letter.service --no-pager
sudo journalctl -u cover-letter.service -n 200 --no-pager
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
sudo ss -ltnp | grep -E ':(80|443|8791|8792)\b'
df -h
```

Технические логи не должны содержать API-ключ, cookies, пароль, полный системный промпт, тексты резюме и вакансий или полный LLM-ответ.
