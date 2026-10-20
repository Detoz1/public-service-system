# Chatbot API Documentation

## 1. Endpoint

The browser calls the Django integration endpoint, not Rasa directly.

| Property | Value |
| --- | --- |
| Method/path | `POST /api/assistant/chat/` |
| Authentication | Existing Django session; DRF `IsAuthenticated` |
| Content type | `application/json` |
| CSRF | Required for session-authenticated POSTs; send `X-CSRFToken` and the matching cookies |
| Request timeout to Rasa | 12 seconds |
| Rasa target | `RASA_REST_URL`, default `http://127.0.0.1:5005/webhooks/rest/webhook` |

The route is registered in `backend/accounts/urls.py` and implemented in `backend/accounts/views.py`.

## 2. Request

JSON body:

```json
{"message": "I want to report a pothole"}
```

`message` must be a string containing non-whitespace text and may contain at most 2,000 characters. The frontend calls this endpoint through `api()` in `frontend/src/api.js`, which includes credentials, fetches a CSRF token for an unsafe method, and sends the CSRF header.

Sanitized `curl` example after authenticating and obtaining the Django cookies/CSRF value:

```bash
curl -i -X POST 'http://127.0.0.1:8000/api/assistant/chat/' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: sessionid=<SESSION_COOKIE>; csrftoken=<CSRF_COOKIE>' \
  -H 'X-CSRFToken: <CSRF_TOKEN>' \
  --data '{"message":"hello"}'
```

Do not use real cookie values in documentation, shell history shared with others, or support tickets.

## 3. Django-to-Rasa request

After authentication and validation, Django posts a Rasa REST payload equivalent to:

```json
{
  "sender": "citizen-<user-id>-<session-hash>",
  "message": "hello",
  "metadata": {
    "django_session": "<forwarded-session-cookie>",
    "csrf_token": "<forwarded-csrf-cookie>"
  }
}
```

The sender is derived by Django; clients cannot choose another conversation ID. Metadata values are internal credentials, not frontend response fields. They are forwarded to the configured Rasa service so the action server can call the existing authenticated Django APIs. Keep Rasa on loopback or a trusted private network and use TLS across hosts.

## 4. Responses

Successful Rasa text replies are normalized to HTTP 200:

```json
{
  "messages": [
    "Hello! I can help with local service issues, request submission, or checking an existing request. What do you need?"
  ]
}
```

`messages` contains all non-empty text messages returned by the Rasa REST connector. Non-text Rasa events are not included in this response.

## 5. Errors

| HTTP status | Condition | Example response |
| --- | --- | --- |
| 400 | `message` is missing, non-string, empty/whitespace, or over 2,000 chars | `{"detail":"Enter a message of 1 to 2000 characters."}` |
| 403 | No authenticated Django session (SessionAuthentication commonly represents this as 403) | `{"detail":"Authentication credentials were not provided."}` |
| 403 | CSRF check fails for an authenticated unsafe request | Django/DRF CSRF error response; refresh the CSRF cookie and header. |
| 405 | Method other than POST | DRF method-not-allowed response. |
| 503 | Rasa HTTP failure/timeout, malformed JSON, or no non-empty text replies | `{"detail":"The assistant is temporarily unavailable. Please try again shortly."}` or `{"detail":"The assistant could not prepare a reply. Please try again."}` |

Internal Rasa response bodies, stack traces, and exception messages are not returned by the proxy. The 12-second timeout covers the Django-to-Rasa request; Rasa custom actions have their own 2–10 second Django request timeouts.

The widget treats either 401 or 403 from the assistant endpoint as a session-expiry signal and returns the app to its signed-out state, including when a 403 was caused by CSRF validation.

## 6. Action API calls

Rasa custom actions call the existing backend endpoints through `DJANGO_API_URL` (default `http://127.0.0.1:8000/api`):

| Operation | Request | Result used by the action |
| --- | --- | --- |
| Status | `GET /requests/{uuid}/` with session cookie | Uses the returned `id`, `title`, and `status`; a 404 is reported as not found/available to the user. |
| Submit | `POST /requests/` with JSON `{title, category, description, location}` and session/CSRF | On HTTP 201, displays the actual ID returned by Django. On 400/401/403/network failure, it does not claim success. |

Django assigns request ownership from the authenticated session and validates the request with its existing serializer. Citizen detail queries are owner-scoped. The chatbot does not access the database directly.

## 7. Verification status

The endpoint implementation and anonymous-access rejection were checked. A live Rasa greeting and report-form start were verified. An authenticated browser request through this endpoint, a successful request creation, and an authenticated status lookup have not been exercised in this verification run. See [chatbot-testing-documentation.md](chatbot-testing-documentation.md).
