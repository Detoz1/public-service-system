# Public Service Request System

A web portal for citizens to submit and track community service requests and for authorized staff to review, update, and analyze them.

## Features

- Citizen registration and login using Django sessions.
- Owner-scoped request submission and request history.
- Optional JPEG, PNG, or WebP evidence images (maximum 5 MB).
- Staff request queue with search, filters, sorting, and pagination.
- Audited status transitions and citizen-visible progress updates.
- Staff-only internal notes.
- Citizen and staff dashboards backed by request data.
- Responsive React interface and Django REST API.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, Tailwind CSS 3 |
| Backend | Python, Django 5.2, Django REST Framework |
| Database | SQLite fallback or PostgreSQL |
| Authentication | Django session cookies and CSRF protection |
| Image handling | Pillow |

## Prerequisites

- Python 3.10 or later
- Node.js 20 or later and npm
- PostgreSQL 14 or later only if using PostgreSQL

## Project layout

```text
backend/
  accounts/       Accounts, authentication, and assistant proxy endpoint
  analytics_api/  Citizen and staff analytics endpoints
  config/         Django configuration and root URL routing
  requests_api/   Request model, permissions, API, and workflow
  manage.py
  requirements.txt
  .env.example
frontend/
  src/            React application and API client
  package.json
  vite.config.js
docs/
  system-documentation.md
  installation-guide.md
  api-documentation.md
  testing-documentation.md
  user-guide.md
```

## Installation and configuration

From the project root, create and activate the Python environment, then install backend dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1`.

The backend defaults to SQLite when `DB_ENGINE` is unset or set to `sqlite`. For PostgreSQL, configure the database variables in `backend/.env` and point them to a dedicated application database. Do not use or alter the separate `pesa` database. See the [installation guide](docs/installation-guide.md) for safe database verification and migration steps.

Install frontend dependencies in a second terminal:

```bash
cd frontend
npm install
```

If `VITE_API_URL` is not configured, the frontend uses the current browser hostname on port 8000. If overriding it, use the same hostname as the frontend so session cookies work.

## Start the application

Terminal 1 — backend, from the project root:

```bash
cd backend
source .venv/bin/activate
python manage.py runserver
```

Terminal 2 — frontend, from the project root:

```bash
cd frontend
npm run dev
```

Open the Vite URL, normally `http://127.0.0.1:5173`. The Django API is normally at `http://127.0.0.1:8000/api/`. Use the same hostname in the browser and API URL.

## Documentation

- [System documentation](docs/system-documentation.md)
- [Installation guide](docs/installation-guide.md)
- [API documentation](docs/api-documentation.md)
- [Testing documentation](docs/testing-documentation.md)
- [User guide](docs/user-guide.md)

## Scope and limitations

The implemented request lifecycle is `pending → in_progress → resolved`; there is no rejected state, assignment workflow, deletion API, email/SMS notification service, or built-in password recovery flow. The `/api/assistant/chat/` endpoint proxies to a separately configured Rasa service; that service is not part of this workspace, so its availability and behavior cannot be verified here. The Django development server's media handling is for local development, not production.
