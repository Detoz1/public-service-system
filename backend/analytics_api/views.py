from datetime import timedelta

from django.db.models import Avg, Count, DateTimeField, DurationField, ExpressionWrapper, F, OuterRef, Subquery
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from requests_api.models import RequestStatusUpdate, ServiceRequest
from requests_api.permissions import CanViewAdminDashboard


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    queryset = ServiceRequest.objects.filter(owner=request.user)

    totals = {
        "total": queryset.count(),
        "pending": queryset.filter(status=ServiceRequest.Status.PENDING).count(),
        "in_progress": queryset.filter(status=ServiceRequest.Status.IN_PROGRESS).count(),
        "resolved": queryset.filter(status=ServiceRequest.Status.RESOLVED).count(),
    }
    category_counts = list(
        queryset.values("category").annotate(count=Count("id")).order_by("category")
    )
    for item in category_counts:
        item["label"] = ServiceRequest.Category(item["category"]).label

    monthly_counts = list(
        queryset.annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")[:6]
    )
    return Response(
        {
            "totals": totals,
            "categories": category_counts,
            "monthly": [
                {"month": item["month"].strftime("%b %Y"), "count": item["count"]}
                for item in monthly_counts
            ],
        }
    )


@api_view(["GET"])
@permission_classes([CanViewAdminDashboard])
def admin_dashboard(request):
    date_from = _date_filter(request, "date_from")
    date_to = _date_filter(request, "date_to")
    category = request.query_params.get("category")
    if date_from and date_to and date_from > date_to:
        raise ValidationError({"date_to": "End date must be on or after the start date."})
    if category and category not in ServiceRequest.Category.values:
        raise ValidationError({"category": "Select a valid service category."})

    try:
        pending_age_days = int(request.query_params.get("pending_age_days", "7"))
    except ValueError as exc:
        raise ValidationError({"pending_age_days": "Enter a whole number from 1 to 365."}) from exc
    if not 1 <= pending_age_days <= 365:
        raise ValidationError({"pending_age_days": "Enter a whole number from 1 to 365."})

    queryset = ServiceRequest.objects.all()
    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)
    if category:
        queryset = queryset.filter(category=category)

    status_counts = list(queryset.values("status").annotate(count=Count("id")).order_by("status"))
    totals_by_status = {row["status"]: row["count"] for row in status_counts}
    total = sum(totals_by_status.values())
    resolved_count = totals_by_status.get(ServiceRequest.Status.RESOLVED, 0)
    category_counts = list(
        queryset.values("category").annotate(count=Count("id")).order_by("-count", "category")
    )
    for row in category_counts:
        row["label"] = ServiceRequest.Category(row["category"]).label

    recent = queryset.select_related("owner").order_by("-created_at", "pk")[:8]
    recent_requests = [
        {
            "id": str(item.pk),
            "title": item.title,
            "category": item.category,
            "status": item.status,
            "location": item.location,
            "created_at": item.created_at,
        }
        for item in recent
    ]

    monthly_queryset = queryset.filter(created_at__gte=timezone.now() - timedelta(days=183))
    monthly_counts = list(
        monthly_queryset.annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )
    location_counts = list(
        queryset.exclude(location="")
        .values("location")
        .annotate(count=Count("id"))
        .order_by("-count", "location")[:10]
    )

    resolution_updates = RequestStatusUpdate.objects.filter(
        status=ServiceRequest.Status.RESOLVED,
        previous_status=ServiceRequest.Status.IN_PROGRESS,
        is_internal=False,
    )
    if date_from:
        resolution_updates = resolution_updates.filter(created_at__date__gte=date_from)
    if date_to:
        resolution_updates = resolution_updates.filter(created_at__date__lte=date_to)
    first_resolution = Subquery(
        RequestStatusUpdate.objects.filter(
            request_id=OuterRef("pk"),
            status=ServiceRequest.Status.RESOLVED,
            previous_status=ServiceRequest.Status.IN_PROGRESS,
            is_internal=False,
        )
        .order_by("created_at")
        .values("created_at")[:1],
        output_field=DateTimeField(),
    )
    resolved_requests = ServiceRequest.objects.filter(status=ServiceRequest.Status.RESOLVED).annotate(
        resolved_at=first_resolution
    ).exclude(resolved_at__isnull=True)
    if date_from:
        resolved_requests = resolved_requests.filter(resolved_at__date__gte=date_from)
    if date_to:
        resolved_requests = resolved_requests.filter(resolved_at__date__lte=date_to)
    if category:
        resolved_requests = resolved_requests.filter(category=category)
    average_duration = resolved_requests.annotate(
        resolution_time=ExpressionWrapper(
            F("resolved_at") - F("created_at"),
            output_field=DurationField(),
        )
    ).aggregate(value=Avg("resolution_time"))["value"]

    pending_cutoff = timezone.now() - timedelta(days=pending_age_days)
    pending_older_than = queryset.filter(
        status=ServiceRequest.Status.PENDING,
        created_at__lt=pending_cutoff,
    ).count()

    return Response(
        {
            "filters": {
                "date_from": date_from,
                "date_to": date_to,
                "category": category,
                "pending_age_days": pending_age_days,
            },
            "totals": {
                "total": total,
                "pending": totals_by_status.get(ServiceRequest.Status.PENDING, 0),
                "in_progress": totals_by_status.get(ServiceRequest.Status.IN_PROGRESS, 0),
                "resolved": resolved_count,
                "resolution_rate": round(resolved_count * 100 / total, 1) if total else 0.0,
                "resolved_within_period": resolution_updates.count(),
                "average_resolution_hours": round(average_duration.total_seconds() / 3600, 1)
                if average_duration
                else None,
                "pending_older_than_days": pending_older_than,
            },
            "statuses": [
                {
                    "status": row["status"],
                    "label": ServiceRequest.Status(row["status"]).label,
                    "count": row["count"],
                }
                for row in status_counts
            ],
            "categories": category_counts,
            "monthly": [
                {"month": row["month"].strftime("%b %Y"), "count": row["count"]}
                for row in monthly_counts[-6:]
            ],
            "locations": location_counts,
            "recent_requests": recent_requests,
        }
    )


def _date_filter(request, parameter):
    value = request.query_params.get(parameter)
    if not value:
        return None
    try:
        parsed = parse_date(value)
    except ValueError:
        parsed = None
    if parsed is None:
        raise ValidationError({parameter: "Enter a valid date in YYYY-MM-DD format."})
    return parsed
