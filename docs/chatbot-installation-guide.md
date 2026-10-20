# Chatbot Installation Guide

This guide starts the assistant already integrated in this repository. The Django portal and React frontend remain the main application. Rasa is an additional service and its dependencies are not part of `backend/requirements.txt`.

## 1. Requirements

Verified in this workspace:

| Component | Version / requirement |
| --- | --- |
| Python for Django and Rasa | Python 3.10.13 |
| Django | 5.2.18, installed in `backend/.venv` |
| Rasa Open Source | 3.6.20 |
| Rasa SDK | 3.6.2 |
| Node.js / npm | Use the versions required by the existing frontend package; Vite 6.0.7 and React 18.3.1 are pinned. |
| Database | Existing Django configuration. Do not change database targets for chatbot setup. |

This workspace uses `/home/denno/univerbot/.venv` for Rasa. On another machine, use the existing compatible Univerbot environment path; do not assume that absolute path exists elsewhere. The adapted configuration and actions are under `backend/rasa_public_service/`.

## 2. Configure Django

From `backend/`, preserve any existing `.env`. If it does not exist, use the project template without overwriting:

```bash
cp -n .env.example .env
```

Set the Rasa webhook in `backend/.env`:

```dotenv
RASA_REST_URL=http://127.0.0.1:5005/webhooks/rest/webhook
```

No chatbot-specific database setting or migration is required. Leave the existing `DB_ENGINE` and database name unchanged. Never set the application to the unrelated `pesa` database.

The Django API host and Vite host must use the same browser hostname so session cookies are sent. The frontend `VITE_API_URL` is optional; unset, it uses the page hostname on port 8000. `frontend/.env.example` documents the optional setting.

## 3. Validate and train Rasa

From the repository root:

```bash
cd backend/rasa_public_service
/home/denno/univerbot/.venv/bin/rasa data validate --domain domain.yml --data data --config config.yml
/home/denno/univerbot/.venv/bin/rasa train --domain domain.yml --data data --config config.yml --out models
```

Validation should finish without story conflicts. The current small corpus can produce warnings for low-example intents and form prompts. Training writes a timestamped archive under `backend/rasa_public_service/models/`; it does not overwrite the original Univerbot model directory.

## 4. Start the Rasa action server

Open a dedicated terminal at the repository root. Set `DJANGO_API_URL` to the Django API host that the Rasa action process can reach. The action process does not load `backend/.env` itself.

```bash
cd backend/rasa_public_service
DJANGO_API_URL=http://127.0.0.1:8000/api SANIC_HOST=127.0.0.1 /home/denno/univerbot/.venv/bin/rasa run actions --actions actions --port 5055
```

The action server must remain running. `SANIC_HOST=127.0.0.1` keeps its listener on loopback.

## 5. Start the Rasa HTTP server

In another terminal:

```bash
cd backend/rasa_public_service
/home/denno/univerbot/.venv/bin/rasa run --enable-api --interface 127.0.0.1 --credentials credentials.yml --endpoints endpoints.yml --model models --port 5005
```

`--enable-api` is used for the logout tracker deletion endpoint. `--interface 127.0.0.1` restricts the server to loopback. Start the action server before sending conversations that invoke actions.

## 6. Start Django

In another terminal:

```bash
cd backend
source .venv/bin/activate
python manage.py check
python manage.py runserver 127.0.0.1:8000
```

Do not run migrations just for the assistant; it adds no database models. Follow the main [installation guide](installation-guide.md) for database verification and any pre-existing application migration needs.

## 7. Start React

In another terminal:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open the exact Vite URL shown in the terminal. For the default local setup, use the matching hostname consistently for Vite and the API (for example, `127.0.0.1` for both). If setting `VITE_API_URL`, use `http://127.0.0.1:8000/api` and update Django CORS/CSRF origins if needed.

## 8. Environment variables

| Variable | Used by | Example placeholder |
| --- | --- | --- |
| `RASA_REST_URL` | Django proxy; read from `backend/.env` | `http://127.0.0.1:5005/webhooks/rest/webhook` |
| `DJANGO_API_URL` | Rasa action server process | `http://127.0.0.1:8000/api` |
| `SANIC_HOST` | Rasa action server listener | `127.0.0.1` |
| `VITE_API_URL` | React; optional | `http://127.0.0.1:8000/api` |

Do not place database passwords, Django session cookies, or CSRF values in frontend environment variables. Django forwards the session/CSRF values to the configured Rasa service for actions; keep that service trusted and private.

## 9. Verify operation

1. Check `http://127.0.0.1:5005/status` returns model status JSON.
2. Sign in to the portal and confirm the floating assistant appears. It should not appear on the logged-out landing/login screens.
3. Send “hello”; expect a configured Rasa greeting.
4. Send “I want to report a pothole”; expect the assistant to ask for a service category. Complete the required fields, review the summary, and submit only with an explicit “yes”. Use a development account and an intended non-production database for any write test.
5. Ask to check a request; expect it to ask for the actual request ID before lookup.
6. Sign out and confirm the widget disappears.

## 10. Troubleshooting

| Symptom | Checks |
| --- | --- |
| “The assistant is temporarily unavailable” | Confirm Django is running, `RASA_REST_URL` points to port 5005 using the same hostname/interface, and Rasa has completed model loading. Django’s proxy timeout is 12 seconds. |
| Rasa responds to greetings but issue/status actions fail | Confirm the action server is running on 5055, `endpoints.yml` points to `http://127.0.0.1:5055/webhook`, and `DJANGO_API_URL` points to the reachable Django API. |
| Rasa says the session expired | Sign in again. Check that browser cookies are included and that the Rasa action server receives the metadata forwarded by Django. |
| CSRF failure on chat or request action | Keep browser and API hostnames consistent; the React API helper obtains a CSRF token. The Rasa action forwards Django’s CSRF cookie as `X-CSRFToken` on POST. |
| No model found | Run the `rasa train` command from the Rasa bundle directory and confirm the output exists under `models/`. |
| Invalid request category/details | Use one of the categories shown in the form. Django serializer validation is authoritative; rejected submissions are not reported as successful. |
| Port is already in use | Identify the existing process before stopping anything; do not terminate an unknown service. Choose a coordinated alternative port and update both service URL settings. |

Stop each foreground service with `Ctrl+C` in its own terminal. Keep Rasa and action-server ports private; this setup is for local development, not production deployment.
