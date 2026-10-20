# Chatbot Testing Documentation

This document separates commands that can be rerun from checks actually observed in this workspace. Do not point tests at production or the unrelated `pesa` database. Use an isolated Django test database and a disposable development account for writes.

## 1. Automated and command-line checks

Run from the repository root unless a working directory is shown.

### Django system check

```bash
cd backend
.venv/bin/python manage.py check
```

Expected: `System check identified no issues`. **Observed:** passed in the implementation verification.

### Python syntax

```bash
cd backend
python -m py_compile accounts/views.py rasa_public_service/actions.py
```

Expected: no output and exit status 0. **Observed:** passed.

### Rasa data validation

```bash
cd backend/rasa_public_service
/home/denno/univerbot/.venv/bin/rasa data validate --domain domain.yml --data data --config config.yml
```

Expected: process exits successfully and no story conflicts. **Observed:** passed with no story conflicts. Rasa warned that `provide_reference` and `nlu_fallback` have one training example, that `provide_issue`/`provide_location` are not separately used in rules/stories, and that form prompt utterances are not directly referenced there. These warnings indicate training-data coverage limitations; form prompts are named by the active form.

### Rasa model training

```bash
cd backend/rasa_public_service
/home/denno/univerbot/.venv/bin/rasa train --domain domain.yml --data data --config config.yml --out models
```

Expected: a timestamped `.tar.gz` model under `models/`. **Observed:** training completed and produced `models/20261020-150907-stubborn-conflict.tar.gz`. DIET and TED were configured for 10 epochs. The corpus is small and training output alone is not an evaluation; no held-out accuracy claim is made.

## 2. Existing backend tests

The repository includes Django tests in `accounts/tests.py`, `requests_api/tests.py`, and `analytics_api/tests.py`. They cover authentication/session behavior, request ownership and permissions, request validation, status workflows, evidence images, and analytics. No dedicated automated test for `assistant_chat` was found.

Commands from `backend/`:

```bash
.venv/bin/python manage.py test accounts requests_api analytics_api
```

The test runner uses a test database. Verify the configured database settings before running; do not point tests at production or change/reset the live database. This suite was **not run** for the chatbot documentation verification.

## 3. Frontend build

```bash
cd frontend
npm run build
```

Expected: Vite completes production bundling. **Observed:** passed. The project has no frontend test or browser automation script in `package.json`; a successful build does not prove runtime or accessibility behavior.

## 4. Live checks observed

| Check | Result |
| --- | --- |
| Django `GET /api/csrf/` | Returned HTTP 200 and a CSRF cookie on the running local Django service. |
| Anonymous `POST /api/assistant/chat/` | Returned HTTP 403 with “Authentication credentials were not provided.” |
| Rasa `GET /status` | Returned the loaded model status. |
| Rasa REST greeting | Returned the configured greeting utterance. |
| Rasa report flow | “I want to report a pothole” returned the form’s category prompt. |
| Rasa action server startup | Started on loopback and registered all six custom/form validation actions. |

These checks establish that Django’s local endpoint and a Rasa model/action server were reachable at the time of testing. They do not establish a full authenticated browser-to-Rasa action-to-Django request flow.

## 5. Manual functional checks

Run Django, Rasa, and the action server using [chatbot-installation-guide.md](chatbot-installation-guide.md), then:

1. Open the portal while logged out. Confirm the assistant launcher is absent.
2. Sign in. Confirm one floating launcher appears across authenticated pages.
3. Open and close the window. Confirm its messages remain while the same page session is mounted.
4. Send “hello”; confirm a real configured Rasa response appears.
5. Send “I want to report a pothole”. Provide a category, description, and location. Review the summary. Reply “no” and confirm no request is created.
6. Repeat with a disposable development account and reply “yes”. Confirm a request is created in the intended development database and the assistant shows the ID returned by Django. Do not use production data for this test.
7. Ask to check status. Provide an actual ID owned by that account. Confirm the displayed status matches Django. Try another account’s request ID and confirm it is not revealed.
8. Sign out. Confirm the widget disappears and signing in again starts a session-scoped assistant conversation.
9. Narrow the browser to mobile width and test keyboard focus, Enter-to-send, Shift+Enter, close, and scrolling.

Steps 1–9 are a manual test procedure; only the checks in section 4 have been observed. Request creation, authenticated status retrieval, responsive browser behavior, and logout cleanup were not completed in this verification run.

## 6. Error and security checks

The following are recommended manual checks, not results already observed:

| Scenario | Expected behavior |
| --- | --- |
| Empty or >2,000 character message | Django returns HTTP 400; no Rasa request is made. |
| No session | Chat endpoint denies with HTTP 403. |
| Invalid CSRF token | Django rejects the unsafe request. |
| Rasa server stopped/unreachable | Django returns generic HTTP 503; frontend shows a helpful error without internal details. |
| Action server stopped | Rasa action invocation fails; no false successful submission/status is displayed. |
| Invalid or another user’s request ID | Existing Django endpoint returns no record to a citizen who does not own it; the action does not disclose another user’s status. |
| Django validation rejection | Submission action reports it was not submitted. |
| Logout while Rasa is unavailable | Django still logs out. Tracker cleanup is best-effort; verify retention behavior before production. |

## 7. Evaluation limitations

- The NLU data is small and validation reported low-example intents. Add examples and run held-out intent/entity evaluation before treating classification as reliable.
- No automated tests cover the new Django proxy or Rasa actions.
- The live checks did not use an authenticated test account to create or retrieve a request.
- No browser end-to-end, mobile layout, accessibility automation, production PostgreSQL, or deployment test was run.
- Session/CSRF values are forwarded in Rasa metadata; ensure the Rasa service is private and establish tracker retention controls.
