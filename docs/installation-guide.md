# Installation Guide

This guide sets up the Public Service Request System for local development. Commands assume the project root is the current directory unless a step says otherwise. The backend and frontend run in separate terminals.

> **Protect existing data:** The backend folder contains a SQLite database in this workspace, and this environment may also contain unrelated databases. Never point this application at the separate `pesa` database. Confirm the configured database before running migrations; do not reset, flush, or recreate a database as part of setup.

## 1. Prerequisites

- Python 3.10 or later
- Node.js 20 or later and npm
- PostgreSQL 14 or later, only if you choose PostgreSQL instead of SQLite

Check the installed versions:

```bash
python --version
node --version
npm --version
```

## 2. Set up the backend environment

From the project root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

For Windows PowerShell, use the activation command below instead:

```powershell
.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, follow your organization's policy for running local virtual-environment scripts; do not change machine-wide execution policy just for this project.

The pinned backend requirements install Django, Django REST Framework, CORS support, dotenv configuration, Pillow, and the PostgreSQL driver.

## 3. Configure the backend

Django loads optional settings from `backend/.env`. The tracked `backend/.env.example` is a template, not a ready-to-use production configuration. From the `backend/` directory, create a local copy without overwriting an existing file:

```bash
cp -n .env.example .env
```

If `.env` already exists, inspect and edit that local file rather than replacing it. Keep it private and out of source control. Do not paste secrets, passwords, or tokens into documentation or support messages.

### Option A: SQLite for local development

SQLite is selected when `DB_ENGINE` is unset or is set to `sqlite`. The database file is `backend/db.sqlite3`.

If you copied `.env.example`, edit `.env` and change `DB_ENGINE=postgresql` to:

```dotenv
DB_ENGINE=sqlite
```

The other database fields are not used for SQLite. Do not replace or remove an existing `db.sqlite3`; it may contain project data.

### Option B: PostgreSQL

Choose PostgreSQL only when a PostgreSQL server and a dedicated application database have already been provisioned. Set these values in `backend/.env`:

```dotenv
DB_ENGINE=postgresql
DB_NAME=your_dedicated_database
DB_USER=your_application_user
DB_PASSWORD=your_local_database_password
DB_HOST=127.0.0.1
DB_PORT=5432
```

Use a database and user dedicated to this application. A database administrator should provision them and grant the application user only the permissions it needs. The sample values in `.env.example` are placeholders; do not assume that the example database or credentials exist. Never configure `DB_NAME=pesa`.

### Django and browser-origin settings

Configure the following variables as appropriate for the local environment:

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django signing key. Required when debug is disabled. Keep it private. |
| `DJANGO_DEBUG` | Debug setting; defaults to true when unset. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hostnames accepted by Django. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call the API. |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated browser origins trusted for CSRF checks. |
| `RASA_REST_URL` | Rasa REST webhook used by the authenticated assistant proxy. The adapted Rasa configuration is in `backend/rasa_public_service/`; the Rasa runtime uses the existing Univerbot Python environment. |

Vite is configured to run at `http://127.0.0.1:5173`. The default Django settings allow common local Vite origins. If you change the frontend host or port, update both the CORS and CSRF trusted-origin settings to match. The frontend defaults the API host to the current browser hostname on port 8000. Keep frontend and API hostnames consistent (`localhost` and `127.0.0.1` are different browser cookie hosts).

## 4. Verify the database target before migrating

With the virtual environment active and from `backend/`, print the resolved database engine and name:

```bash
python manage.py shell -c "from django.conf import settings; db = settings.DATABASES['default']; print('engine:', db['ENGINE']); print('name:', db['NAME'])"
```

Confirm that the output is the intended SQLite file or the dedicated application PostgreSQL database. If it is unexpected, stop and correct `.env` before continuing. Do not run migration commands when the configured target is `pesa` or any other unintended database.

## 5. Check and apply migrations

After verifying the database target:

```bash
python manage.py check
python manage.py showmigrations
python manage.py migrate
```

`showmigrations` reports which migrations are applied. `migrate` applies pending migrations to the configured database and can change its schema. Preserve existing data and take an appropriate backup before migrating a database that already contains important records. Do not use `flush`, database deletion, or reset commands as an installation shortcut.

To create a Django superuser interactively, when required:

```bash
python manage.py createsuperuser
```

Enter the password privately at the prompt. The public registration form creates citizen accounts, not administrators.

## 6. Install frontend dependencies

Open a second terminal at the project root:

```bash
cd frontend
npm install
```

No frontend environment file is required for the default local setup. If setting `VITE_API_URL`, point it at the API on port 8000 and use the same hostname as the one in the browser, for example:

```dotenv
VITE_API_URL=http://127.0.0.1:8000/api
```

Restart Vite after changing frontend environment variables.

## 7. Start the backend and frontend

### Terminal 1: Django backend

From the project root:

```bash
cd backend
source .venv/bin/activate
python manage.py runserver 127.0.0.1:8000
```

For Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1` before starting Django.

### Terminal 2: Vite frontend

From the project root:

```bash
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173` in a browser. The API base is `http://127.0.0.1:8000/api/`. Use the exact same hostname for the page and API to ensure the browser sends session cookies.

### Terminals 3 and 4: Rasa assistant (optional)

The assistant needs both the Rasa action server and Rasa HTTP server. From the repository root, follow [Chatbot Installation Guide](chatbot-installation-guide.md) to validate/train the model and start both services. Keep them bound to loopback for local development. Set `RASA_REST_URL` in `backend/.env` to the running Rasa webhook.

Stop either development server with `Ctrl+C` in its terminal.

## 8. Run verification checks

Backend checks, from `backend/` with the virtual environment active:

```bash
python manage.py check
python manage.py test
python manage.py makemigrations --check --dry-run
```

Frontend production build, from `frontend/`:

```bash
npm run build
```

The test command uses Django's isolated test database. The migration check is a dry run and does not apply migrations.

## 9. Development versus production

`runserver`, Vite's development server, debug defaults, SQLite fallback, and local media serving are intended for development. Production requires deployment-specific configuration for HTTPS, secret management, allowed hosts and origins, database access, static assets, durable media storage, and private Rasa/action services. The adapted Rasa bundle is included under `backend/rasa_public_service/`, but the Rasa runtime is installed separately in the existing Univerbot environment and must be started separately.
