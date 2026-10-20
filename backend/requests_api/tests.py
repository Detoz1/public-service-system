from django.contrib.auth.models import Permission, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from io import BytesIO
from rest_framework.test import APIClient

from .models import RequestStatusUpdate, ServiceRequest


class ServiceRequestApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.citizen = User.objects.create_user(
            username="citizen@example.test",
            email="citizen@example.test",
            password="A-strong-password-82",
        )
        self.other_citizen = User.objects.create_user(
            username="other@example.test",
            email="other@example.test",
            password="A-strong-password-82",
        )
        self.staff = User.objects.create_user(
            username="staff",
            email="staff@example.test",
            password="A-strong-password-82",
            is_staff=True,
        )
        self.staff.user_permissions.add(
            *Permission.objects.filter(
                content_type__app_label="requests_api",
                codename__in=("view_servicerequest", "change_servicerequest"),
            )
        )

    def request_payload(self, **overrides):
        return {
            "title": "Broken streetlight",
            "category": ServiceRequest.Category.LIGHTING,
            "description": "The light is out on the main road.",
            "location": "Main Road",
            **overrides,
        }

    def test_anonymous_users_cannot_view_requests(self):
        response = self.client.get(reverse("request-list"))
        self.assertEqual(response.status_code, 403)

    def test_staff_without_model_permissions_only_sees_own_requests(self):
        limited_staff = User.objects.create_user(username="limited-staff", is_staff=True)
        owned_request = ServiceRequest.objects.create(
            owner=limited_staff, **self.request_payload(title="Staff-owned request")
        )
        ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload()
        )
        self.client.force_authenticate(limited_staff)
        response = self.client.get(reverse("request-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], str(owned_request.pk))
        self.assertEqual(
            self.client.patch(
                reverse("request-detail", kwargs={"pk": owned_request.pk}),
                {"status": ServiceRequest.Status.IN_PROGRESS},
                format="json",
            ).status_code,
            403,
        )

    def test_citizen_creates_pending_request_and_cannot_view_another_citizens_request(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(reverse("request-list"), self.request_payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], ServiceRequest.Status.PENDING)
        service_request = ServiceRequest.objects.get(pk=response.data["id"])
        self.assertEqual(service_request.owner, self.citizen)
        self.assertEqual(service_request.status_updates.count(), 1)

        self.client.force_authenticate(self.other_citizen)
        detail = self.client.get(
            reverse("request-detail", kwargs={"pk": service_request.pk})
        )
        self.assertEqual(detail.status_code, 404)

    def test_citizen_cannot_create_request_with_non_pending_status(self):
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("request-list"),
            self.request_payload(status=ServiceRequest.Status.RESOLVED),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ServiceRequest.objects.exists())

    def test_citizen_cannot_change_status(self):
        service_request = ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload()
        )
        self.client.force_authenticate(self.citizen)
        response = self.client.patch(
            reverse("request-detail", kwargs={"pk": service_request.pk}),
            {"status": ServiceRequest.Status.RESOLVED},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.PENDING)

    def test_staff_can_update_status_and_history_is_recorded(self):
        service_request = ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload()
        )
        self.client.force_authenticate(self.staff)
        response = self.client.patch(
            reverse("request-detail", kwargs={"pk": service_request.pk}),
            {
                "status": ServiceRequest.Status.IN_PROGRESS,
                "note": "Assigned to a team.",
                "expected_updated_at": service_request.updated_at.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.IN_PROGRESS)
        history = list(service_request.status_updates.order_by("created_at"))
        self.assertEqual(history[-1].previous_status, ServiceRequest.Status.PENDING)
        self.assertEqual(history[-1].status, ServiceRequest.Status.IN_PROGRESS)
        self.assertEqual(
            RequestStatusUpdate.objects.get(request=service_request).note,
            "Assigned to a team.",
        )

    def test_staff_transition_workflow_requires_resolution_note(self):
        service_request = ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload()
        )
        self.client.force_authenticate(self.staff)
        detail_url = reverse("request-detail", kwargs={"pk": service_request.pk})
        invalid_transition = self.client.patch(
            detail_url,
            {
                "status": ServiceRequest.Status.RESOLVED,
                "note": "Resolved without investigation.",
                "expected_updated_at": service_request.updated_at.isoformat(),
            },
            format="json",
        )
        self.assertEqual(invalid_transition.status_code, 400)

        started = self.client.patch(
            detail_url,
            {
                "status": ServiceRequest.Status.IN_PROGRESS,
                "note": "Assigned for inspection.",
                "expected_updated_at": service_request.updated_at.isoformat(),
            },
            format="json",
        )
        self.assertEqual(started.status_code, 200)
        service_request.refresh_from_db()
        missing_resolution_note = self.client.patch(
            detail_url,
            {
                "status": ServiceRequest.Status.RESOLVED,
                "expected_updated_at": service_request.updated_at.isoformat(),
            },
            format="json",
        )
        self.assertEqual(missing_resolution_note.status_code, 400)

    def test_stale_staff_update_is_rejected(self):
        service_request = ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload()
        )
        stale_timestamp = service_request.updated_at.isoformat()
        self.client.force_authenticate(self.staff)
        url = reverse("request-detail", kwargs={"pk": service_request.pk})
        self.client.patch(
            url,
            {
                "status": ServiceRequest.Status.IN_PROGRESS,
                "note": "First update.",
                "expected_updated_at": stale_timestamp,
            },
            format="json",
        )
        stale_response = self.client.patch(
            url,
            {
                "status": ServiceRequest.Status.RESOLVED,
                "note": "Stale update.",
                "expected_updated_at": stale_timestamp,
            },
            format="json",
        )
        self.assertEqual(stale_response.status_code, 409)
        service_request.refresh_from_db()
        self.assertEqual(service_request.status, ServiceRequest.Status.IN_PROGRESS)

    def test_internal_notes_are_staff_only(self):
        service_request = ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload()
        )
        url = reverse("request-detail", kwargs={"pk": service_request.pk})
        self.client.force_authenticate(self.staff)
        note_response = self.client.post(
            f"{url}notes/",
            {"note": "Follow up with the service team."},
            format="json",
        )
        self.assertEqual(note_response.status_code, 201)
        self.assertTrue(note_response.data["status_updates"][0]["is_internal"])

        self.client.force_authenticate(self.citizen)
        citizen_response = self.client.get(url)
        self.assertEqual(citizen_response.status_code, 200)
        self.assertEqual(citizen_response.data["status_updates"], [])

    def test_staff_filters_by_location_date_and_ordering(self):
        older = ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload(location="North Ward")
        )
        ServiceRequest.objects.create(
            owner=self.other_citizen, **self.request_payload(title="Other", location="South Ward")
        )
        self.client.force_authenticate(self.staff)
        response = self.client.get(
            reverse("request-list"),
            {"location": "north", "date_from": older.created_at.date().isoformat(), "ordering": "created_at"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["location"], "North Ward")

    def test_admin_cannot_mass_assign_owner_or_timestamp(self):
        service_request = ServiceRequest.objects.create(
            owner=self.citizen, **self.request_payload()
        )
        self.client.force_authenticate(self.staff)
        response = self.client.patch(
            reverse("request-detail", kwargs={"pk": service_request.pk}),
            {
                "owner": self.staff.pk,
                "expected_updated_at": service_request.updated_at.isoformat(),
                "note": "Should not change ownership.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        service_request.refresh_from_db()
        self.assertEqual(service_request.owner, self.citizen)

    def test_status_filter_rejects_invalid_values(self):
        self.client.force_authenticate(self.staff)
        response = self.client.get(reverse("request-list"), {"status": "unknown"})
        self.assertEqual(response.status_code, 400)

    def test_evidence_image_size_is_limited(self):
        self.client.force_authenticate(self.citizen)
        image = SimpleUploadedFile(
            "large.png",
            b"x" * (5 * 1024 * 1024 + 1),
            content_type="image/png",
        )
        response = self.client.post(
            reverse("request-list"),
            self.request_payload(evidence=image),
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)

    def test_valid_evidence_image_is_accepted(self):
        image_bytes = BytesIO()
        Image.new("RGB", (8, 8), color="blue").save(image_bytes, format="PNG")
        image = SimpleUploadedFile(
            "evidence.png",
            image_bytes.getvalue(),
            content_type="image/png",
        )
        self.client.force_authenticate(self.citizen)
        response = self.client.post(
            reverse("request-list"),
            self.request_payload(evidence=image),
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["evidence"].endswith(".png"))
