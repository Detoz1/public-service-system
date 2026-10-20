import uuid

from django.conf import settings
from django.db import models


class ServiceRequest(models.Model):
    class Category(models.TextChoices):
        ROADS = "roads", "Roads and transport"
        WATER = "water", "Water and sanitation"
        WASTE = "waste", "Waste management"
        LIGHTING = "lighting", "Street lighting"
        PUBLIC_SAFETY = "safety", "Public safety"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In progress"
        RESOLVED = "resolved", "Resolved"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=160)
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField(max_length=5000)
    location = models.CharField(max_length=255)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="service_requests",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    evidence = models.ImageField(
        upload_to="request_evidence/%Y/%m/",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "-created_at"]),
            models.Index(fields=["status", "category"]),
        ]

    def __str__(self):
        return self.title


class RequestStatusUpdate(models.Model):
    request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="status_updates",
    )
    status = models.CharField(max_length=20, choices=ServiceRequest.Status.choices)
    previous_status = models.CharField(
        max_length=20,
        choices=ServiceRequest.Status.choices,
        blank=True,
        default="",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="request_status_updates",
    )
    note = models.CharField(max_length=500, blank=True)
    is_internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "pk"]

    def __str__(self):
        return f"{self.request_id}: {self.get_status_display()}"
