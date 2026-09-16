# Project rules

## Project identity

- `SLUG`: `cover-letter`
- `SERVICE_NAME`: `cover-letter`
- `PORT`: `8792`
- `SITE_DOMAIN`: `ai-run.ru`
- `HOST`: `cover-letter.ai-run.ru`
- `PLAYWRIGHT_PORT`: `8791`
- The public application URL is `https://cover-letter.ai-run.ru`.
- The application and Playwright ports must remain different and must not be reused by another local or VPS service.
- If `SLUG` equals `SITE_DOMAIN`, `HOST` must equal `SITE_DOMAIN`; do not append the domain a second time.
- The local project root is `C:\_Codex\cover-letter`.
- The VPS code root is `/var/www/cover-letter`.
- The VPS persistent data root is `/var/lib/cover-letter`.
- The VPS Next.js cache root is `/var/cache/cover-letter`.

## Conditional external integrations

- Apply Telegram requirements only when the project technical specification includes inbound or outbound Telegram data exchange.
- Apply email requirements only when the project technical specification includes inbound or outbound email data exchange.
- A displayed Telegram username, `t.me` link, email address, or `mailto:` link does not enable an integration.
- Apply inbound and outbound requirements independently. If a channel or direction is absent, do not create its adapter, environment variables, database tables, worker jobs, systemd units, or acceptance tests.
- This project currently includes neither Telegram nor email data exchange and therefore has no worker process.
- The Playwright renderer port is reserved, but the renderer remains disabled until a concrete need is approved.

## Synchronizing `.env` for VPS deployment

- The root file `C:\_Codex\cover-letter\.env` is the local development configuration and may contain secrets.
- Before every local Git commit, the tracked `.githooks/pre-commit` hook must automatically run:

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sync-vps-env.ps1
  ```

- Configure the repository once with `npm run hooks:install`. Never bypass this hook with `--no-verify`.
- The command must create or atomically replace `C:\_Codex\cover-letter\data\.env.vps`.
- The generated `.env.vps` must preserve all variables, comments, ordering, and secret values from the root `.env`, except for these production path substitutions:

  ```env
  SYSTEM_PROMPT_PATH=/var/lib/cover-letter/system_prompt.md
  DATABASE_PATH=/var/lib/cover-letter/cover-letter.sqlite
  ```

- Do not manually copy, print, log, summarize, or expose secret values while synchronizing or verifying the files.
- Verify synchronization using variable names and redacted values only.
- Never commit the root `.env`, `data/.env.vps`, or any other file inside `data/`.
- If synchronization fails, do not treat the `.env` modification as complete; report the failure and leave the last successfully generated `.env.vps` untouched.

## Database and system prompt changes

- Every database schema change must be implemented as a new numbered migration. Never rewrite a migration that may already have been applied.
- Store the production SQLite database at `/var/lib/cover-letter/cover-letter.sqlite` and the production system prompt at `/var/lib/cover-letter/system_prompt.md`.
- Store the local working database and prompt inside the ignored `C:\_Codex\cover-letter\data` directory.
- Store the working system prompt outside Git and production build output.
- The application does not provide an administrative prompt editor. Prompt replacement is a manual deployment operation.
- Save the previous prompt version before replacing it, write the new prompt atomically, and never print its full production content in logs or command output.

## Backup policy

- Application-managed off-VPS backups are not part of the current version.
- The complete VPS is backed up by system administration outside the application deployment workflow.
- Loss or administrative replacement of the production `.env`, system prompt, or SQLite database is an explicitly accepted current-stage operational risk.
- Document this deviation and the restore assumptions in the deployment guide; never commit production data or secrets as a substitute for backup.

## Automatic local Git commits

- After each completed, coherent project modification and its relevant verification, automatically create a local Git commit.
- Before committing, inspect `git status --short`, stage only the intended project files, and run `git diff --cached --check`.
- Never commit `.env`, any file inside `data/`, system prompts containing production data, secrets, dependencies, or build output.
- Use non-interactive Git commands. If no repository exists, initialize a local repository with the `main` branch.
- Do not add a remote or push commits unless the user explicitly requests it.
- Update README and deployment files in the same change whenever commands, paths, domain names, or ports change.
