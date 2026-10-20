# User Guide

## 1. Open the portal

Start the Django backend and Vite frontend as described in the [Installation Guide](installation-guide.md), then open the Vite URL in a browser. Use the same hostname consistently (for example, `127.0.0.1`) for the frontend and API so browser session cookies are included.

## 2. Citizen guide

### Register

1. Choose the registration option on the landing page.
2. Enter your full name, email address, phone number, and password.
3. Submit the form. A successful registration signs you in.

The server validates the email and phone and applies Django's configured password validators. Public registration creates a citizen account; it cannot grant staff privileges.

### Sign in and sign out

1. Choose **Login** and enter the registered email and password.
2. After successful sign-in, the portal opens your request dashboard.
3. Choose **Sign out** in the header to end the session.

There is no implemented password-reset flow in this workspace. Contact the system administrator if account recovery is needed.

### Submit a request

1. From your citizen dashboard, choose **Submit a request**.
2. Enter a short title, select a service category, provide the location, and describe the issue.
3. Optionally attach a JPEG, PNG, or WebP image no larger than 5 MB.
4. Submit the request.

New requests start with status **Pending**. The system records the submitting account as owner and adds an initial history entry. The request categories are Roads and transport, Water and sanitation, Waste management, Street lighting, Public safety, and Other.

### Track progress

Your dashboard lists only your requests. Open a request to view its reference UUID, description, evidence link when present, current status, and citizen-visible progress history. Staff updates are visible when recorded as public progress. Internal staff notes are not shown.

The available statuses are:

1. **Pending** — awaiting review.
2. **In progress** — being handled.
3. **Resolved** — marked resolved by authorized staff.

The portal has no email or SMS notification delivery; check the dashboard for updates.

### Public Service Assistant

An assistant widget is present in the authenticated citizen interface. It sends messages to `/api/assistant/chat/`, which proxies to an external Rasa service. This workspace does not include that service; the assistant may be unavailable unless a compatible service is separately configured and running.

## 3. Staff and administrator guide

### Staff access

The **Admin** entry opens the staff portal at `/#/admin`. Sign in using an existing staff-capable account. A citizen registration does not create an administrator.

The portal capabilities are derived from Django account permissions:

- Queue and analytics: `is_staff` and `requests_api.view_servicerequest`.
- Status/progress updates and internal notes: `is_staff` and `requests_api.change_servicerequest`.
- Superusers have Django's normal permission bypass.

An authorized administrator can create or manage staff accounts and permissions through Django's admin interface. A full administrator can be created interactively from the backend directory with:

```bash
python manage.py createsuperuser
```

The password is entered privately at the terminal prompt. Django admin request and history records are read-only; use the portal for supported request status and note updates.

### Review the request queue

From the staff portal, choose **Service requests**. Use the search field, status/category selectors, location, and date bounds to filter results. Open a result to inspect its details and history. The queue is paginated; the API defaults to 10 entries per page and permits up to 50.

Search can match title, description, location, citizen name/email-derived username, or request UUID. Only staff with view permission see the cross-citizen queue. Staff without that permission do not get global access merely by having `is_staff`.

### Update status or progress

From an open request detail:

1. In **Citizen-visible progress**, choose the next allowed status or leave the status unchanged to add a progress note.
2. Enter a note when resolving a request; the note is required for resolution.
3. Save the update.

The supported transitions are `Pending → In progress → Resolved`. Skipping a state or reopening a resolved request is rejected. The form submits the request's current update timestamp; if another update has occurred, refresh the request and retry.

### Add an internal note

Use **Internal staff note** on the request detail page to record a staff-only follow-up. Internal notes do not change request status and are omitted from citizen history.

### Use overview and analytics

- **Overview** shows status totals, recent request summaries, monthly submissions, and frequent locations.
- **Analytics** shows totals and trends and supports start/end dates and category filters.

Staff analytics omit requester contact information from recent-request summaries. The API also supports a pending-age threshold (default 7 days), though the current analytics UI does not expose that parameter.

## 4. Troubleshooting

- **The portal returns to login or shows an authentication error:** verify the backend is running and use matching frontend/API hostnames (`localhost` and `127.0.0.1` are distinct cookie hosts). Sign in again.
- **A staff member sees only their own requests:** check `is_staff` and the `requests_api.view_servicerequest` permission.
- **Update actions are missing or forbidden:** check the `requests_api.change_servicerequest` permission as well as `is_staff`.
- **A status update returns a conflict:** reopen/refresh the request and retry with the latest version.
- **The assistant does not reply:** the separately configured Rasa service may be unavailable; assistant integration is not included in this workspace.

Do not share passwords, session cookies, CSRF tokens, or private user data when requesting support.
