# API Documentation

All JSON API routes are under `/api/`. Unless stated otherwise, endpoints use Django REST Framework session authentication and return JSON. The frontend includes credentials and obtains a CSRF token before unsafe methods. A client outside the browser must retain the session cookie and send the CSRF cookie value in `X-CSRFToken` for `POST`, `PATCH`, and other unsafe requests.

## Authentication and common behavior

- `GET /api/csrf/` is public and sets the CSRF cookie.
- Registration and login create a Django session on success.
- Session-protected routes require the session cookie. With this project's session authentication, unauthenticated/unauthorized requests may appear as HTTP 403 rather than 401.
- Registration and login share an anonymous throttle of 10 requests per minute.
- Validation errors generally use HTTP 400 with a `detail` string or field-to-message mapping.
- JSON date filters use `YYYY-MM-DD`; timestamps are ISO 8601.

## Endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/csrf/` | Public | Return a CSRF token and set its cookie. |
| POST | `/api/auth/register/` | Public + CSRF | Register a citizen and sign them in. |
| POST | `/api/auth/login/` | Public + CSRF | Authenticate and start a session. |
| POST | `/api/auth/logout/` | Authenticated + CSRF | End the session. |
| GET | `/api/auth/me/` | Authenticated | Return account identity and derived capabilities. |
| POST | `/api/assistant/chat/` | Authenticated + CSRF | Forward a message to configured Rasa service. |
| GET | `/api/requests/` | Authenticated | List only own requests, or all requests for authorized staff. |
| POST | `/api/requests/` | Authenticated + CSRF | Create a request owned by the current user. |
| GET | `/api/requests/{uuid}/` | Owner or authorized staff | Retrieve request details and visible history. |
| PATCH | `/api/requests/{uuid}/` | Staff with change permission + CSRF | Change status and/or add a citizen-visible update. |
| POST | `/api/requests/{uuid}/notes/` | Staff with change permission + CSRF | Add an internal note. |
| GET | `/api/analytics/dashboard/` | Authenticated | Return current user's statistics. |
| GET | `/api/analytics/admin-dashboard/` | Staff with view permission | Return staff-wide analytics. |
| GET | `/admin/` | Django staff | Django administration site (HTML, not a JSON API). |

The staff portal requires `is_staff` plus `requests_api.view_servicerequest` for the queue and analytics. Status changes and internal notes require `is_staff` plus `requests_api.change_servicerequest`. Superusers bypass the model permission check. A staff account without the required view permission remains owner-scoped.

## Account requests and responses

### Register: `POST /api/auth/register/`

JSON fields:

| Field | Type | Requirement/limit |
| --- | --- | --- |
| `full_name` | string | Required, non-empty, max 150 characters. |
| `email` | string | Required, max 150 characters, valid email; normalized to lowercase. |
| `phone` | string | Required, max 20 characters; validated as a phone-like string. |
| `password` | string | Required; checked against configured Django password validators. |

Successful response: HTTP 201 and the account object described below. The response is also authenticated as a session. Duplicate email returns HTTP 409. Invalid fields or password return HTTP 400.

### Login: `POST /api/auth/login/`

JSON fields: `email` and `password` (both strings). Successful response: HTTP 200 and account object. Invalid credentials return HTTP 400 with a `detail` message.

### Account object

```json
{
  "id": 7,
  "full_name": "Example Citizen",
  "email": "citizen@example.test",
  "phone": "+255 700 123 456",
  "is_staff": false,
  "can_view_admin": false,
  "can_manage_requests": false
}
```

Example values are illustrative, not credentials or workspace user data.

### Current account and logout

`GET /api/auth/me/` returns the account object. `POST /api/auth/logout/` accepts an empty JSON object and returns HTTP 204 with no response body. Unsafe requests require CSRF.

## Service requests

### Create: `POST /api/requests/`

Required fields:

| Field | Type | Limit / accepted values |
| --- | --- | --- |
| `title` | string | Max 160 characters. |
| `category` | string | `roads`, `water`, `waste`, `lighting`, `safety`, or `other`. |
| `description` | string | Max 5,000 characters. |
| `location` | string | Max 255 characters. |
| `evidence` | file | Optional JPEG, PNG, or WebP image, max 5 MB. |

Use `multipart/form-data` when uploading evidence; JSON may be used when no file is sent. The server sets `owner` from the session and sets initial status to `pending`. Sending a `status` on create is rejected. Response: HTTP 201 and request object.

### List and filters: `GET /api/requests/`

The response is paginated:

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": []
}
```

Default page size is 10; `page_size` may be set up to 50. Supported query parameters:

| Parameter | Meaning |
| --- | --- |
| `page` | 1-based page number. |
| `page_size` | Page length, max 50. |
| `search` | Search title, description, location, owner username/name, or UUID; max 200 characters. |
| `status` | Filter by `pending`, `in_progress`, or `resolved`. |
| `category` | Filter by one of the supported categories. |
| `location` | Case-insensitive partial location filter; max 255 characters. |
| `date_from`, `date_to` | Inclusive creation-date bounds in `YYYY-MM-DD`. Start must not exceed end. |
| `ordering` | `created_at`, `-created_at`, `updated_at`, `-updated_at`, `status`, or `-status`; default `-created_at`. |

The query filters are available to authenticated request-list callers, but the result set remains owner-scoped unless the caller has staff-wide view permission.

### Request object

```json
{
  "id": "2c75d2d7-bb2d-4c61-a550-e0e3bf812547",
  "title": "Streetlight not working",
  "category": "lighting",
  "description": "The light is out near the main road.",
  "location": "Main Road",
  "owner": 7,
  "owner_name": "Example Citizen",
  "owner_email": "citizen@example.test",
  "status": "pending",
  "evidence": null,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z",
  "status_updates": []
}
```

The identifiers, person details, and dates above are examples. The evidence value is a URL or `null`. Citizens receive only their own requests; a non-owner's detail lookup returns HTTP 404. Internal status updates are omitted for users without change permission.

### Staff progress update: `PATCH /api/requests/{uuid}/`

JSON fields:

| Field | Type | Requirement |
| --- | --- | --- |
| `expected_updated_at` | ISO 8601 timestamp | Required current version from the request object. |
| `status` | string | Optional next status; transitions only `pending → in_progress → resolved`. |
| `note` | string | Optional, max 500 characters. Required when resolving; also used for a note-only progress update. |

Provide a status change or non-empty note. A successful response is HTTP 200 and the updated request object. A stale `expected_updated_at` returns HTTP 409. An invalid transition or missing resolution note returns HTTP 400. Only the explicitly accepted fields may be changed; ownership and timestamps cannot be mass-assigned.

### Internal note: `POST /api/requests/{uuid}/notes/`

JSON: `{"note": "Staff-only follow-up"}`. Note is required and max 500 characters. Response: HTTP 201 and updated request object. Its history event has `is_internal: true` and is hidden from citizens.

### Status-history item

Each visible `status_updates` item contains `previous_status`, `status`, `changed_by`, `note`, `is_internal`, and `created_at`. On initial submission the previous status is empty. History is ordered oldest first.

## Analytics

### Citizen: `GET /api/analytics/dashboard/`

Always scoped to the authenticated user. Response shape:

```json
{
  "totals": {"total": 0, "pending": 0, "in_progress": 0, "resolved": 0},
  "categories": [{"category": "roads", "count": 0, "label": "Roads and transport"}],
  "monthly": [{"month": "Jan 2026", "count": 0}]
}
```

`monthly` contains up to six available monthly submission buckets.

### Staff: `GET /api/analytics/admin-dashboard/`

Requires staff view permission. Optional query parameters: `date_from`, `date_to` (creation date bounds), `category`, and `pending_age_days` (integer 1–365, default 7). Invalid filters return HTTP 400.

Response contains:

- `filters`: applied date/category values and pending age threshold.
- `totals`: `total`, `pending`, `in_progress`, `resolved`, `resolution_rate`, `resolved_within_period`, `average_resolution_hours`, and `pending_older_than_days`.
- `statuses`, `categories`, `monthly`, and `locations`: count series.
- `recent_requests`: up to eight summaries with request ID, title, category, status, location, and creation date; contact details are not included.

Resolution rate is resolved request count divided by total requests in the selected creation-date/category set (zero when empty). Resolution events and average resolution duration use public history events transitioning from `in_progress` to `resolved`; average hours is `null` when there are no qualifying events.

## Assistant proxy

`POST /api/assistant/chat/` accepts `{"message":"..."}` for an authenticated session. Message length must be 1–2,000 characters. If the configured Rasa service returns text replies, the API returns `{"messages":["..."]}`. Invalid messages return HTTP 400; unavailable service or no usable replies returns HTTP 503. The external Rasa service is not included in this workspace and its behavior is not verified.

## Error status summary

| HTTP status | Meaning in this API |
| --- | --- |
| 200 | Successful read, login, or update. |
| 201 | Resource/account created. |
| 204 | Successful logout; no body. |
| 400 | Invalid credentials, request fields, filter, or transition. |
| 403 | Authenticated user lacks permission, session authentication denies access, or CSRF validation fails. |
| 404 | Unknown request or request outside citizen ownership scope. |
| 409 | Duplicate registration email or stale request update. |
| 429 | Authentication throttle exceeded. |
| 503 | Assistant service unavailable or no usable reply. |

Error bodies are generally JSON, commonly `{"detail":"..."}` or a field-keyed validation object. Django/DRF may return framework-formatted details for authentication and CSRF failures.
