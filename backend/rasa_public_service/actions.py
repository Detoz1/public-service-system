import os
import re

import requests
from rasa_sdk import Action, Tracker, FormValidationAction
from rasa_sdk.events import SlotSet
from rasa_sdk.executor import CollectingDispatcher


API_URL = os.getenv("DJANGO_API_URL", "http://127.0.0.1:8000/api").rstrip("/")
UUID_PATTERN = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b")


def django_session(tracker):
    metadata = (tracker.latest_message or {}).get("metadata") or {}
    session_id = metadata.get("django_session")
    csrf_token = metadata.get("csrf_token")
    if not session_id:
        return None
    session = requests.Session()
    session.cookies.set("sessionid", session_id)
    if csrf_token:
        session.cookies.set("csrftoken", csrf_token)
        session.headers["X-CSRFToken"] = csrf_token
    return session


class ActionCheckRequestStatus(Action):
    def name(self):
        return "action_check_request_status"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain):
        text = (tracker.latest_message or {}).get("text", "")
        entity_id = next(tracker.get_latest_entity_values("request_id"), None)
        request_id = entity_id or (UUID_PATTERN.search(text).group(0) if UUID_PATTERN.search(text) else None)
        if not request_id:
            dispatcher.utter_message(text="Please share the request ID shown when you submitted it, and I’ll check its current status.")
            return []
        session = django_session(tracker)
        if session is None:
            dispatcher.utter_message(text="Your sign-in session has expired. Please sign in again before checking a request.")
            return []
        try:
            response = session.get(f"{API_URL}/requests/{request_id}/", timeout=(2, 8))
            if response.status_code == 404:
                dispatcher.utter_message(text="I couldn’t find that request in the requests available to your account. Check the ID and try again.")
            elif response.status_code in (401, 403):
                dispatcher.utter_message(text="Your sign-in session has expired. Please sign in again before checking a request.")
            elif response.ok:
                data = response.json()
                status = data.get("status")
                labels = {"pending": "Pending", "in_progress": "In progress", "resolved": "Resolved"}
                if status not in labels:
                    dispatcher.utter_message(text="The service returned an unexpected status. Please check again later.")
                else:
                    dispatcher.utter_message(text=f"Request {data.get('id')}: {data.get('title', 'Service request')} is {labels[status]}.")
            else:
                dispatcher.utter_message(text="I couldn’t retrieve the request status right now. Please try again shortly.")
        except (requests.RequestException, ValueError):
            dispatcher.utter_message(text="I couldn’t retrieve the request status right now. Please try again shortly.")
        return []


class ActionCancelIssue(Action):
    def name(self):
        return "action_cancel_issue"

    def run(self, dispatcher, tracker, domain):
        dispatcher.utter_message(text="Okay, I haven’t submitted anything. You can restart when you’re ready.")
        return [SlotSet("service_category", None), SlotSet("description", None), SlotSet("location", None), SlotSet("title", None)]


class ValidateIssueForm(FormValidationAction):
    def name(self):
        return "validate_issue_form"

    def validate_service_category(self, slot_value, dispatcher, tracker, domain):
        text = str(slot_value or "").strip().lower()
        aliases = {
            "road": "roads", "roads": "roads", "pothole": "roads", "transport": "roads",
            "water": "water", "sanitation": "water", "drainage": "water", "flood": "water",
            "waste": "waste", "garbage": "waste", "rubbish": "waste", "sanitation waste": "waste",
            "lighting": "lighting", "streetlight": "lighting", "street light": "lighting",
            "safety": "safety", "public safety": "safety", "other": "other",
        }
        category = next((value for alias, value in aliases.items() if alias in text), None)
        if category:
            return {"service_category": category}
        return {"service_category": None}

    def validate_description(self, slot_value, dispatcher, tracker, domain):
        value = str(slot_value or "").strip()
        return {"description": value if 5 <= len(value) <= 5000 else None}

    def validate_location(self, slot_value, dispatcher, tracker, domain):
        value = str(slot_value or "").strip()
        return {"location": value if 2 <= len(value) <= 255 else None}


class ActionSetIssueTitle(Action):
    def name(self):
        return "action_set_issue_title"

    def run(self, dispatcher, tracker, domain):
        text = str((tracker.latest_message or {}).get("text", "")).strip()
        title = re.sub(r"^(please\s+)?(report|submit|log)\s+(a|an|the)?\s*", "", text, flags=re.I).strip()
        title = title[:160] or "Public service issue"
        return [SlotSet("title", title)]


class ActionConfirmIssue(Action):
    def name(self):
        return "action_confirm_issue"

    def run(self, dispatcher, tracker, domain):
        category = tracker.get_slot("service_category")
        description = tracker.get_slot("description")
        location = tracker.get_slot("location")
        title = tracker.get_slot("title") or "Public service issue"
        if not all((category, description, location)):
            dispatcher.utter_message(text="I’m missing a required detail. Please start the report again so I can collect it.")
            return []
        dispatcher.utter_message(text=(
            f"Please review before submission:\nTitle: {title}\nCategory: {category}"
            f"\nDescription: {description}\nLocation: {location}\n"
            "Reply yes to submit this request, or no to cancel."
        ))
        return []


class ActionSubmitIssue(Action):
    def name(self):
        return "action_submit_issue"

    def run(self, dispatcher, tracker, domain):
        category = tracker.get_slot("service_category")
        description = tracker.get_slot("description")
        location = tracker.get_slot("location")
        title = tracker.get_slot("title") or "Public service issue"
        if not all((category, description, location)):
            dispatcher.utter_message(text="I don’t have all the required details, so nothing was submitted. Please start the report again.")
            return []
        session = django_session(tracker)
        if session is None:
            dispatcher.utter_message(text="Your sign-in session has expired, so nothing was submitted. Please sign in again and retry.")
            return []
        try:
            response = session.post(
                f"{API_URL}/requests/",
                json={"title": title[:160], "category": category, "description": description, "location": location},
                timeout=(2, 10),
            )
            if response.status_code in (401, 403):
                dispatcher.utter_message(text="Your sign-in session has expired, so nothing was submitted. Please sign in again and retry.")
            elif response.status_code == 201:
                request_id = response.json().get("id")
                if request_id:
                    dispatcher.utter_message(text=f"Your request was submitted successfully. Request ID: {request_id}.")
                else:
                    dispatcher.utter_message(text="The service accepted your request, but did not return an ID. Please check your request list in the portal.")
            elif response.status_code == 400:
                dispatcher.utter_message(text="The service could not accept the request details, so it was not submitted. Please review the category, description, and location, then try again through Submit a request in the portal.")
            else:
                dispatcher.utter_message(text="The request service is unavailable, so nothing was submitted. Please try again later or use Submit a request in the portal.")
        except (requests.RequestException, ValueError):
            dispatcher.utter_message(text="The request service is unavailable, so nothing was submitted. Please try again later or use Submit a request in the portal.")
        return [SlotSet("service_category", None), SlotSet("description", None), SlotSet("location", None), SlotSet("title", None)]
