from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import CitizenProfile


class CitizenAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.get(reverse("csrf-token"))
        self.csrf_token = self.client.cookies["csrftoken"].value

    def post(self, url, payload):
        self.client.get(reverse("csrf-token"))
        self.csrf_token = self.client.cookies["csrftoken"].value
        return self.client.post(
            reverse(url),
            payload,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

    def registration_data(self, **overrides):
        return {
            "full_name": "Jordan Citizen",
            "email": "jordan@example.test",
            "phone": "+255 700 123 456",
            "password": "A-strong-password-82",
            **overrides,
        }

    def test_registration_creates_hashed_password_and_authenticated_session(self):
        response = self.post("register", self.registration_data())
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["is_staff"])
        self.assertFalse(response.data["can_view_admin"])
        self.assertFalse(response.data["can_manage_requests"])
        self.assertNotIn("password", response.data)
        user = User.objects.get(username="jordan@example.test")
        self.assertNotEqual(user.password, "A-strong-password-82")
        self.assertTrue(user.check_password("A-strong-password-82"))
        self.assertEqual(CitizenProfile.objects.get(user=user).full_name, "Jordan Citizen")
        self.assertEqual(self.client.get(reverse("current-account")).status_code, 200)

    def test_registration_cannot_elevate_account_role(self):
        response = self.post(
            "register",
            self.registration_data(is_staff=True, is_superuser=True, permissions=["*"]),
        )
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="jordan@example.test")
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.user_permissions.count(), 0)

    def test_duplicate_registration_is_rejected(self):
        self.post("register", self.registration_data())
        response = self.post("register", self.registration_data(email="JORDAN@example.test"))
        self.assertEqual(response.status_code, 409)

    def test_invalid_password_is_rejected(self):
        response = self.post("register", self.registration_data(password="short"))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_login_and_logout(self):
        User.objects.create_user(
            username="jordan@example.test",
            email="jordan@example.test",
            password="A-strong-password-82",
        )
        response = self.post(
            "login",
            {"email": "JORDAN@example.test", "password": "A-strong-password-82"},
        )
        self.assertEqual(response.status_code, 200)
        logout_response = self.post("logout", {})
        self.assertEqual(logout_response.status_code, 204)
