from datetime import timedelta

from django.contrib.auth.models import User
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from requests_api.models import RequestStatusUpdate, ServiceRequest


class DashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.citizen = User.objects.create_user(username="citizen")
        self.other_citizen = User.objects.create_user(username="other")
        ServiceRequest.objects.create(
            owner=self.citizen,
            title="First request",
            category=ServiceRequest.Category.ROADS,
            description="Road issue",
            location="Central",
            status=ServiceRequest.Status.RESOLVED,
        )
        ServiceRequest.objects.create(
            owner=self.other_citizen,
            title="Private request",
            category=ServiceRequest.Category.WATER,
            description="Water issue",
            location="Other",
        )

    def test_citizen_sees_only_their_own_statistics(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["totals"]["total"], 1)
        self.assertEqual(response.data["totals"]["resolved"], 1)

    def test_staff_account_dashboard_remains_owner_scoped(self):
        staff = User.objects.create_user(username="unprivileged-staff", is_staff=True)
        ServiceRequest.objects.create(
            owner=staff,
            title="Staff-owned test request",
            category=ServiceRequest.Category.ROADS,
            description="Isolated account metric",
            location="Test location",
        )
        self.client.force_authenticate(staff)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["totals"]["total"], 1)

    def test_admin_dashboard_is_staff_only(self):
        url = reverse("admin-dashboard")
        anonymous_response = self.client.get(url)
        self.assertEqual(anonymous_response.status_code, 403)

        self.client.force_authenticate(self.citizen)
        citizen_response = self.client.get(url)
        self.assertEqual(citizen_response.status_code, 403)

        operator = User.objects.create_user(username="operator", is_staff=True)
        operator.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="requests_api",
                codename="view_servicerequest",
            )
        )
        self.client.force_authenticate(operator)
        staff_response = self.client.get(url)
        self.assertEqual(staff_response.status_code, 200)
        self.assertEqual(staff_response.data["totals"]["total"], 2)
        self.assertEqual(staff_response.data["totals"]["resolved"], 1)
        self.assertEqual(staff_response.data["totals"]["resolution_rate"], 50.0)
        self.assertEqual(len(staff_response.data["recent_requests"]), 2)
        self.assertEqual(staff_response.data["totals"]["resolved_within_period"], 0)
        self.assertIsNone(staff_response.data["totals"]["average_resolution_hours"])

    def test_admin_dashboard_handles_empty_period_and_invalid_filters(self):
        operator = User.objects.create_user(username="operator", is_staff=True)
        operator.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="requests_api",
                codename="view_servicerequest",
            )
        )
        self.client.force_authenticate(operator)
        empty = self.client.get(reverse("admin-dashboard"), {"date_from": "2099-01-01"})
        self.assertEqual(empty.status_code, 200)
        self.assertEqual(empty.data["totals"]["total"], 0)
        self.assertEqual(empty.data["totals"]["resolution_rate"], 0.0)
        self.assertIsNone(empty.data["totals"]["average_resolution_hours"])

        invalid = self.client.get(
            reverse("admin-dashboard"),
            {"date_from": "not-a-date", "pending_age_days": 0},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_admin_dashboard_calculates_resolution_metrics_from_history(self):
        operator = User.objects.create_user(username="operator", is_staff=True)
        operator.user_permissions.add(
            Permission.objects.get(
                content_type__app_label="requests_api",
                codename="view_servicerequest",
            )
        )
        service_request = ServiceRequest.objects.create(
            owner=self.citizen,
            title="Resolved road issue",
            category=ServiceRequest.Category.ROADS,
            description="Road repair confirmed",
            location="Central",
            status=ServiceRequest.Status.RESOLVED,
        )
        created_at = timezone.now() - timedelta(hours=2, minutes=10)
        ServiceRequest.objects.filter(pk=service_request.pk).update(created_at=created_at)
        RequestStatusUpdate.objects.create(
            request=service_request,
            previous_status=ServiceRequest.Status.IN_PROGRESS,
            status=ServiceRequest.Status.RESOLVED,
            changed_by=operator,
            note="Repair verified.",
        )
        self.client.force_authenticate(operator)
        response = self.client.get(reverse("admin-dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["totals"]["resolved_within_period"], 1)
        self.assertEqual(response.data["totals"]["average_resolution_hours"], 2.2)
