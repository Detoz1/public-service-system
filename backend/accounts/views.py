from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.conf import settings
import json
import hashlib
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import CitizenProfile


class AuthenticationThrottle(AnonRateThrottle):
    scope = "authentication"


def account_data(user):
    profile = getattr(user, "citizen_profile", None)
    can_view_admin = bool(
        user.is_staff
        and (user.is_superuser or user.has_perm("requests_api.view_servicerequest"))
    )
    return {
        "id": user.pk,
        "full_name": profile.full_name if profile else user.get_full_name() or user.username,
        "email": profile.email if profile else user.email,
        "phone": profile.phone if profile else "",
        "is_staff": user.is_staff,
        "can_view_admin": can_view_admin,
        "can_manage_requests": bool(
            can_view_admin
            and (user.is_superuser or user.has_perm("requests_api.change_servicerequest"))
        ),
    }


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthenticationThrottle])
def register(request):
    full_name = str(request.data.get("full_name", "")).strip()
    email = str(request.data.get("email", "")).strip().lower()
    phone = str(request.data.get("phone", "")).strip()
    password = request.data.get("password")

    if not full_name or len(full_name) > 150:
        return Response(
            {"full_name": ["Enter a name of no more than 150 characters."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not email or len(email) > 150:
        return Response(
            {"email": ["Enter an email address of no more than 150 characters."]},
            status=400,
        )
    if not phone or len(phone) > 20:
        return Response(
            {"phone": ["Enter a phone number of no more than 20 characters."]},
            status=400,
        )
    if not isinstance(password, str) or not password:
        return Response({"password": ["This field is required."]}, status=400)

    try:
        CitizenProfile._meta.get_field("email").run_validators(email)
        CitizenProfile._meta.get_field("phone").run_validators(phone)
        validate_password(password)
    except DjangoValidationError as exc:
        return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=email,
                email=email,
                password=password,
            )
            CitizenProfile.objects.create(
                user=user,
                full_name=full_name,
                email=email,
                phone=phone,
            )
    except IntegrityError:
        return Response(
            {"email": ["An account with this email already exists."]},
            status=status.HTTP_409_CONFLICT,
        )

    login(request, user)
    return Response(account_data(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthenticationThrottle])
def sign_in(request):
    email = str(request.data.get("email", "")).strip().lower()
    password = request.data.get("password")
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response(
            {"detail": "The email or password is incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    login(request, user)
    return Response(account_data(user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sign_out(request):
    sender = assistant_sender(request)
    try:
        rasa_root = settings.RASA_REST_URL.rsplit("/webhooks/", 1)[0]
        cleanup = Request(f"{rasa_root}/conversations/{sender}/tracker", method="DELETE")
        with urlopen(cleanup, timeout=2):
            pass
    except (HTTPError, URLError, TimeoutError, OSError):
        # Logout must still complete if Rasa is unavailable.
        pass
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_account(request):
    return Response(account_data(request.user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def assistant_chat(request):
    message = request.data.get("message")
    if not isinstance(message, str) or not message.strip() or len(message) > 2000:
        return Response({"detail": "Enter a message of 1 to 2000 characters."}, status=400)
    # The sender is scoped to this authenticated account; no browser-supplied
    # conversation identifier can access another citizen's Rasa tracker.
    sender = assistant_sender(request)
    try:
        rasa_request = Request(
            settings.RASA_REST_URL,
            data=json.dumps({
                "sender": sender,
                "message": message.strip(),
                "metadata": {
                    # Sent only to the configured private Rasa service, so its
                    # action server can use the existing Django session API.
                    "django_session": request.COOKIES.get(settings.SESSION_COOKIE_NAME, ""),
                    "csrf_token": request.COOKIES.get(settings.CSRF_COOKIE_NAME, ""),
                },
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(rasa_request, timeout=12) as result:
            payload = json.loads(result.read())
        replies = [item.get("text", "").strip() for item in payload if isinstance(item, dict) and item.get("text", "").strip()]
        if not replies:
            return Response({"detail": "The assistant could not prepare a reply. Please try again."}, status=503)
        return Response({"messages": replies})
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        return Response({"detail": "The assistant is temporarily unavailable. Please try again shortly."}, status=503)


def assistant_sender(request):
    session_id = request.COOKIES.get(settings.SESSION_COOKIE_NAME, "")
    session_tag = hashlib.sha256(session_id.encode()).hexdigest()[:20]
    return f"citizen-{request.user.pk}-{session_tag}"
