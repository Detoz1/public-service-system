# Public Service Assistant Rasa configuration

This bundle adapts the existing Univerbot Rasa 3.6 environment without editing its source files, SQLite data, backups, or models. Django remains the public entry point. It forwards authenticated messages to Rasa; the Rasa action server calls the existing Django request endpoints using the signed-in citizen's short-lived Django session cookie. Do not expose the Rasa or action server ports publicly.

## Environment

Set `RASA_REST_URL=http://127.0.0.1:5005/webhooks/rest/webhook` in `backend/.env` and `DJANGO_API_URL=http://127.0.0.1:8000/api` for the Rasa action server. These are service URLs, not credentials. The session and CSRF cookies are forwarded only by the authenticated Django proxy to the configured private Rasa service. Configure TLS and a trusted private network if these services run on separate hosts.

## Start services

From the repository root, run these in separate terminals:

```sh
cd backend
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

```sh
cd backend/rasa_public_service
SANIC_HOST=127.0.0.1 /home/denno/univerbot/.venv/bin/rasa run actions --actions actions --port 5055
```

Train once, then run the Rasa server:

```sh
cd backend/rasa_public_service
/home/denno/univerbot/.venv/bin/rasa train --domain domain.yml --data data --config config.yml --out models
/home/denno/univerbot/.venv/bin/rasa run --enable-api --interface 127.0.0.1 --credentials credentials.yml --endpoints endpoints.yml --model models --port 5005
```

```sh
cd frontend
npm run dev
```

The original Univerbot virtual environment is used for Rasa 3.6.20 and its SDK. Keep its original project and university data intact.
