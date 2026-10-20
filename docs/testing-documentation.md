# Testing Documentation

## Test coverage currently present

Automated backend tests use Django's test framework and Django REST Framework's `APIClient`. They cover:

- **Accounts (`accounts/tests.py`)**: password hashing, successful session registration, role-elevation rejection, duplicate registration, password validation, login/logout.
- **Requests (`requests_api/tests.py`)**: anonymous access denial, staff scoping/permissions, owner isolation, request creation and initial history, invalid initial status, citizen status-change denial, staff workflow and audit records, resolution-note requirement, stale update conflict, internal-note visibility, filters, mass-assignment rejection, and evidence-image validation.
- **Analytics (`analytics_api/tests.py`)**: citizen scoping, staff account scoping, admin permission checks, empty/invalid filters, and resolution metrics from history.

The frontend `package.json` provides `dev`, `build`, and `preview` scripts; it does not define an automated frontend test script. No browser end-to-end test suite was found in the inspected project.

## Reproduce the checks

From the repository root:

```bash
cd backend
source .venv/bin/activate
python manage.py check
python manage.py test
python manage.py makemigrations --check --dry-run
```

Then, in another terminal:

```bash
cd frontend
npm run build
```

`manage.py test` creates and destroys Django's isolated test database; it does not require migrating the normal development database. `makemigrations --check --dry-run` checks migration state without writing migrations or applying them.

## Verification performed for this documentation

Commands were run in this workspace on 2026-10-20:

| Command | Result |
| --- | --- |
| `cd backend && .venv/bin/python manage.py test` | Passed: 24 tests, 0 failures/errors. Django reported no system-check issues during the run. |
| `cd backend && .venv/bin/python manage.py check` | Passed: no issues identified. |
| `cd backend && .venv/bin/python manage.py makemigrations --check --dry-run` | Passed: no changes detected. |
| `cd frontend && npm run build` | Passed: Vite production build completed. |

These are point-in-time results; run the commands again after code or dependency changes.

## Known limitations

- Tests cover backend API logic and authorization but do not provide browser-driven frontend or accessibility automation.
- A successful frontend build confirms compilation/bundling, not runtime browser behavior.
- Automated tests do not establish production security, deployment readiness, live PostgreSQL configuration, or external-service availability.
- The assistant proxy depends on an external Rasa endpoint; that external system was not verified as part of these checks.
- No live data migration was run during this documentation task.
