# Public Service Assistant: Technical Documentation

## 1. Introduction

The Public Service Assistant is a compact chat widget in the authenticated Public Service Request System. It uses the adapted Univerbot Rasa project to recognize common public-service conversations, guide citizens through a request report, and look up request status through the existing Django API.

This document describes the implementation in `backend/rasa_public_service/`, `backend/accounts/`, and `frontend/src/`. The original `/home/denno/univerbot` project is used for its Rasa 3.6 environment; its university configuration and SQLite databases were not changed.

## 2. Objectives

The current implementation is designed to:

- Give authenticated users a floating, in-context way to talk to the assistant.
- Recognize greetings, issue-reporting requests, status questions, human-support requests, and out-of-scope messages.
- Collect a supported service category, issue description, and location, show a summary, and submit only after confirmation.
- Retrieve a request’s current status using the signed-in Django session and the existing ownership rules.
- Keep authentication and request records under Django’s control.

## 3. Scope and current status

| Capability | Implementation status |
| --- | --- |
| Authenticated-only floating chat | Implemented in the React authenticated layout and Django endpoint. |
| Rasa NLU and dialogue | Implemented with Rasa 3.6.20, DIET, rules, stories, and a trained model. |
| Guided request report | Implemented in the Rasa form and action server; actual authenticated submission was not exercised in the verification run. |
| Request status lookup | Implemented through the existing request detail endpoint; a live authenticated lookup was not exercised. |
| Image evidence in chat | Not implemented. The portal’s existing request form supports evidence images. |
| General public-service knowledge base | Not implemented. Responses are from configured utterances and actions, not a live government knowledge source. |
| Persistent chatbot history across browser reloads | Not implemented. The React messages are component state; Rasa uses its configured tracker store. |

The assistant does not connect to PostgreSQL directly, create database tables, or replace the portal’s request form or authentication system.

## 4. System architecture

```mermaid
flowchart LR
  Citizen --> Widget[React floating assistant]
  Widget -->|POST /api/assistant/chat/ with session cookie and CSRF| Django[Django accounts API]
  Django -->|Rasa REST webhook; per-session sender and auth metadata| Rasa[Rasa server and DIET model]
  Rasa -->|custom actions| ActionServer[Rasa SDK action server]
  ActionServer -->|session-authenticated GET /api/requests/{id}/| Django
  ActionServer -->|session-authenticated POST /api/requests/ after yes| Django
  Django -->|serializer, ownership, validation, request records| Database[(Configured application database)]
  Rasa -->|messages| Django
  Django -->|JSON messages| Widget
```

The browser communicates only with Django. The Django view at `POST /api/assistant/chat/` verifies `IsAuthenticated`, validates the message, and calls the configured Rasa REST webhook. It derives the Rasa sender from the Django user ID and a hash of the current session ID. The Rasa action server calls the existing Django request endpoints using the session and CSRF values supplied in Rasa message metadata. Django remains responsible for authentication, serializers, ownership, and persistence.

The action server must be reachable at the URL in `backend/rasa_public_service/endpoints.yml`. Rasa’s HTTP server is configured by `RASA_REST_URL` in `backend/.env`. Both services should be restricted to loopback or a trusted private network.

## 5. Technology stack

| Technology | Role in this implementation |
| --- | --- |
| Python 3.10.13 | Existing Rasa environment and Django backend runtime. |
| Rasa Open Source 3.6.20 | NLU pipeline, dialogue policies, tracker, REST webhook, model training. |
| Rasa SDK 3.6.2 | Custom actions and form validation in `actions.py`. |
| Django 5.2.18 and Django REST Framework | Authenticated assistant proxy and existing request APIs. |
| React 18.3.1 | Floating widget and message state, implemented in `frontend/src/App.jsx`. |
| Tailwind CSS 3.4.17 plus project CSS | Existing styling system and assistant widget styles. |
| `requests` in the Rasa environment | Rasa action server’s HTTP client for Django endpoints. |
| Configured application database | Stores request records through Django only. No Rasa database connection is configured. |

The backend `requirements.txt` does not install Rasa. Rasa runs from the existing Univerbot environment at `/home/denno/univerbot/.venv` in this workspace.

## 6. Message-processing workflow

1. After `GET /api/auth/me/` confirms an authenticated account, React renders the widget inside the shared authenticated layout.
2. The user opens the floating button and sends a message. Enter sends; Shift+Enter inserts a newline.
3. The frontend uses the shared `api()` helper, which sends browser credentials and obtains/sends a CSRF token for the unsafe POST.
4. Django checks authentication and requires `message` to be a non-empty string no longer than 2,000 characters.
5. Django posts `{sender, message, metadata}` to `RASA_REST_URL` with a 12-second timeout. The sender is scoped to the account and current Django session.
6. Rasa applies the configured NLU pipeline and dialogue policy. It replies with a configured utterance or calls a custom action.
7. For a request action, the action server uses the Django session to call `/api/requests/` or `/api/requests/{uuid}/`. The endpoint applies normal Django authentication, serializer validation, ownership, and permission checks.
8. Django returns Rasa text replies as `{"messages": ["..."]}`. React appends each reply to the conversation.
9. On logout, the widget unmounts and clears in-memory messages. Django attempts to delete the session-scoped Rasa tracker before ending the session; cleanup failure does not prevent logout.

## 7. Natural-language processing

The actual pipeline in `config.yml` is:

| Component | Configured role |
| --- | --- |
| `WhitespaceTokenizer` | Tokenizes text on whitespace. |
| `RegexFeaturizer` | Adds regular-expression features. |
| `LexicalSyntacticFeaturizer` | Adds token-context features. |
| `CountVectorsFeaturizer` | Creates word-token count features. |
| `CountVectorsFeaturizer` with `char_wb`, n-grams 1–4 | Adds character n-gram features. |
| `DIETClassifier` | Learns intent classification and entity recognition; configured for 10 epochs. |
| `EntitySynonymMapper` | Applies configured entity synonyms; no synonym list is currently defined. |
| `FallbackClassifier` | Selects NLU fallback below confidence threshold 0.45, with ambiguity threshold 0.1. |

The configured policies are `RulePolicy`, `MemoizationPolicy`, and `TEDPolicy` (10 epochs, history 5). The adapted bundle does not configure `ResponseSelector`, spaCy, NLTK, or a retrieval system. The original Univerbot may contain other dependencies, but they are not part of this bundle’s active pipeline.

The only entity declared in the domain is `request_id`. Training examples annotate UUID-shaped IDs, and the status action also searches the raw latest message for a UUID. The form’s `service_category` is a text slot, not a Rasa entity; custom validation maps category words and aliases to Django’s actual category values.

## 8. Intents and entities

Intents below are taken from `data/nlu.yml` and `domain.yml`:

| Intent | Purpose and representative training example |
| --- | --- |
| `greet` | Greetings, e.g. “hello” or “habari”. |
| `goodbye` | End a conversation, e.g. “that's all thanks”. |
| `affirm` / `deny` | Confirm or cancel a pending submission, e.g. “yes” / “don't submit”. |
| `report_issue` | Begin the issue form, e.g. “I want to report a pothole”. |
| `ask_submit` | Ask how to report; answers with the configured submission prompt. |
| `ask_status` | Ask to check a request, e.g. “has my issue been resolved”. |
| `provide_reference` | Supply a standalone request UUID. |
| `provide_issue` | Example descriptions such as blocked drainage or an uncollected rubbish issue. |
| `provide_location` | Example location text such as “opposite the county offices”. |
| `request_human` | Ask to speak to a person or officer. |
| `out_of_scope` | Example unrelated questions. |
| `nlu_fallback` | Unrecognized or unclear message examples. |

The request form asks for one of the backend-supported category values: `roads`, `water`, `waste`, `lighting`, `safety`, or `other`. Validation maps words such as “pothole” to `roads`, “drainage” to `water`, and “streetlight” to `lighting`. The Django serializer remains authoritative and may reject invalid values.

## 9. Dialogue management

The rules start the issue form after `report_issue`, run `action_set_issue_title`, and activate `issue_form`. The form collects `service_category`, `description`, and `location`. When complete, `action_confirm_issue` presents a summary and requests an explicit yes/no response. `affirm` invokes `action_submit_issue`; `deny` invokes `action_cancel_issue` and clears the captured slots.

Other rules handle greetings, goodbye, status questions, human-support requests, out-of-scope messages, and NLU fallback. `stories.yml` contains greeting, submission, and cancellation paths. Rasa’s tracker carries context for the sender ID. No tracker store is configured in `endpoints.yml`; Rasa therefore uses its default tracker-store behavior. The bundle does not configure a custom business-hours flow, escalation queue, or human-agent handoff.

## 10. Custom actions

All actions are in `backend/rasa_public_service/actions.py` and are registered with the action server.

| Action | Inputs and processing | Output / dependencies |
| --- | --- | --- |
| `action_check_request_status` | Reads a `request_id` entity or UUID from the latest text. If absent, asks for the ID. Otherwise GETs `/api/requests/{uuid}/` using the Django session. | Shows the returned title, ID, and one of the recognized statuses. 404, auth failures, invalid payloads, and network failures receive citizen-safe replies. Uses `DJANGO_API_URL` and `requests`. |
| `validate_issue_form` | Validates category aliases, description length (5–5,000), and location length (2–255). | Returns normalized slot values to the Rasa form; it does not persist data. |
| `action_set_issue_title` | Uses the initiating message, removes a leading report/submit phrase where matched, and truncates to 160 characters. | Sets the title slot. |
| `action_confirm_issue` | Reads title, category, description, and location slots. | Shows a summary and asks for explicit confirmation; makes no API call. |
| `action_submit_issue` | Runs after `affirm`; posts title, category, description, and location to `/api/requests/`. | On HTTP 201, shows the ID returned by Django. On validation, auth, or service failure, states that submission did not complete. Clears report slots afterward. |
| `action_cancel_issue` | Runs after `deny`. | Says nothing was submitted and clears report slots. |

These actions do not read or write SQLite or PostgreSQL directly. No action collects phone/email or image evidence.

## 11. Knowledge and data sources

General responses are fixed utterances in `domain.yml`, with intent examples in `data/nlu.yml`. There is no civic-service FAQ database, web retrieval, government directory API, or generative model configured. Request status and request creation are the only live data operations in custom actions, and both go through Django REST Framework.

## 12. Backend integration and API

`POST /api/assistant/chat/` is declared in `backend/accounts/urls.py` and implemented in `backend/accounts/views.py`. It requires `IsAuthenticated`, uses session authentication, and validates the message. Success returns a `messages` array. The Rasa webhook receives the current session ID and CSRF cookie in metadata so actions can call the existing session-authenticated API. Rasa HTTP failures, malformed responses, and no text replies return HTTP 503 with a generic error. The proxy timeout is 12 seconds.

The request API is provided by `requests_api` at `/api/requests/`. `ServiceRequestViewSet.get_queryset()` scopes citizens to `owner=request.user`; authorized staff may view broader records according to existing permissions. `perform_create()` assigns the current Django user as owner and records the initial status update. Request fields and validation come from `ServiceRequestSerializer` and `ServiceRequest`.

## 13. Frontend integration

`AssistantWidget` is rendered once in the authenticated branch of `App.jsx`, not on the logged-out landing or login screens. It has a circular bottom-right launcher and a compact floating panel, welcome message, citizen/assistant bubbles, scrollable log, multiline input, send and close controls, loading text, and an error alert. Closing preserves messages in component state; logging out unmounts the widget and clears them. The styling is in `index.css`, with mobile sizing, focus-visible styles, and reduced-motion handling.

The shared `api()` helper sends `credentials: "include"` and obtains a CSRF token for unsafe methods. If the assistant endpoint returns 401/403, the widget clears the app account state and returns to the logged-out flow.

## 14. Authentication, authorization, and privacy

Django protects the chat proxy with `IsAuthenticated`. Rasa request actions reuse the authenticated Django session and call existing endpoints; they do not accept a citizen ID from the browser. Citizen request lookups therefore remain constrained by the existing owner queryset. Authorized staff behavior follows existing backend permissions.

The Django session cookie is HttpOnly in the browser. However, this implementation forwards session and CSRF cookie values from Django to the configured Rasa service in message metadata to enable the action server’s Django API calls. Rasa and its action server must be trusted and kept on loopback or a protected private network; use TLS between services on separate hosts. Do not expose Rasa ports publicly or log metadata. The custom actions do not log these values. Logout asks Rasa to delete the session-specific tracker, but cleanup errors are swallowed so logout can complete. A tracker may therefore remain in Rasa’s default store until that store/process clears it if Rasa is unavailable during logout.

The current action client expects Django’s default cookie names, `sessionid` and `csrftoken`. If those names are customized, update `django_session()` in `actions.py` and verify the metadata contract. In the frontend, any assistant HTTP 401/403 is treated as an expired session and clears the account state; this includes a CSRF-related 403.

The Rasa REST server is not independently authenticated by this bundle. Network isolation is part of the security boundary. Configure a secure tracker store and retention policy before production if persistent tracking is enabled.

## 15. Errors and fallbacks

- Empty, non-string, or over-2,000-character messages receive HTTP 400.
- Missing text replies, Rasa timeout/unavailability, malformed JSON, or HTTP failures return HTTP 503 with a generic assistant-unavailable message.
- NLU fallback returns the configured `utter_fallback` response.
- A status question without an ID asks for the request ID. The action handles 404 and session/API errors without inventing a status.
- A rejected request submission is not presented as successful. A 201 response must include the ID before the assistant claims success.
- Django or Rasa internal exceptions and response bodies are not passed through to the citizen.

## 16. Installation and configuration

See [chatbot-installation-guide.md](chatbot-installation-guide.md). The key variables are `RASA_REST_URL` for Django and `DJANGO_API_URL` for custom actions. The action server uses the existing Rasa environment; Rasa dependencies are not in `backend/requirements.txt`. The chatbot adds no Django model or migration.

## 17. Training and model management

From `backend/rasa_public_service/`, validate with:

```bash
/home/denno/univerbot/.venv/bin/rasa data validate --domain domain.yml --data data --config config.yml
```

Train with:

```bash
/home/denno/univerbot/.venv/bin/rasa train --domain domain.yml --data data --config config.yml --out models
```

The verified workspace model is `models/20261020-150907-stubborn-conflict.tar.gz`. Training uses only the adapted bundle, not the original university model or SQLite files. Keep a known-good model archive before replacing it, and validate/test changed data before promotion.

## 18. Testing and evaluation

The Rasa data validator reported no story structure conflicts. Rasa training completed, but validation warned that `provide_reference` and `nlu_fallback` have only one training example and noted unused training intents/form prompts. The small corpus and low TED training accuracy mean intent quality has not been established by a held-out evaluation.

In the documented verification run, Django `manage.py check`, Python compilation, and the React production build passed. A live Rasa greeting and start of the report form were also observed. An anonymous POST to the Django assistant endpoint returned 403. Authenticated request creation, status retrieval, session-expiration UI, mobile browser layout, and full React→Django→Rasa→action→Django flows were not verified. See [chatbot-testing-documentation.md](chatbot-testing-documentation.md) for commands and limitations.

## 19. Deployment and maintenance

The current deployment is a development setup with separate Django, Rasa, and action-server processes. Django’s debug server, local HTTP Rasa webhook, and default tracker behavior are not production deployment recommendations. Production requires supervised services, private networking/TLS, secure secrets, explicit tracker retention/storage, monitoring, a deployment-grade Django server, and tests against a non-production database. Keep model training and deployment artifacts separate from the original Univerbot model directory.

## 20. Limitations and future improvements

Confirmed limitations:

- Small Rasa training set; confidence and generalization need held-out evaluation.
- No user-uploaded image through chat, while the portal request form supports evidence images.
- No human-agent queue or civic knowledge source.
- Session and CSRF values pass through Rasa metadata; tracker cleanup is best-effort.
- Full authenticated end-to-end request flows have not been tested.

Possible future work includes adding validated training examples, entity/slot extraction, an authenticated short-lived service delegation mechanism instead of forwarding the Django session, an image flow using the existing upload endpoint, retention controls, and automated API/UI integration tests.

## 21. Conclusion

The assistant provides an authenticated Rasa-powered interface for issue reporting and request status lookup while keeping identity, request validation, ownership, and storage in Django. Operational readiness still depends on running the Rasa services and completing authenticated end-to-end testing.
