import uuid

from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import RequestStatusUpdate, ServiceRequest
from .permissions import CanManageServiceRequests, CanViewServiceRequests


class RequestPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class RequestStatusUpdateSerializer(serializers.ModelSerializer):
    changed_by = serializers.SerializerMethodField()

    class Meta:
        model = RequestStatusUpdate
        fields = ("previous_status", "status", "changed_by", "note", "is_internal", "created_at")

    def get_changed_by(self, obj):
        if obj.changed_by is None:
            return "System"
        profile = getattr(obj.changed_by, "citizen_profile", None)
        return profile.full_name if profile else obj.changed_by.get_full_name() or obj.changed_by.username


class ServiceRequestSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()
    status_updates = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = (
            "id",
            "title",
            "category",
            "description",
            "location",
            "owner",
            "owner_name",
            "owner_email",
            "status",
            "evidence",
            "created_at",
            "updated_at",
            "status_updates",
        )
        read_only_fields = (
            "id",
            "owner",
            "owner_name",
            "owner_email",
            "created_at",
            "updated_at",
            "status_updates",
        )

    def get_owner_name(self, obj):
        profile = getattr(obj.owner, "citizen_profile", None)
        return profile.full_name if profile else obj.owner.get_full_name() or obj.owner.username

    def get_owner_email(self, obj):
        profile = getattr(obj.owner, "citizen_profile", None)
        return profile.email if profile else obj.owner.email

    def get_status_updates(self, obj):
        updates = obj.status_updates.all()
        request = self.context.get("request")
        if request and not (
            request.user.is_superuser
            or request.user.has_perm("requests_api.change_servicerequest")
        ):
            updates = updates.filter(is_internal=False)
        return RequestStatusUpdateSerializer(updates, many=True, context=self.context).data

    def validate(self, attrs):
        if self.instance is None and "status" in self.initial_data:
            raise serializers.ValidationError(
                {"status": "New service requests always start as pending."}
            )
        return attrs

    def validate_evidence(self, image):
        if image is None:
            return image
        if image.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Image files must be 5 MB or smaller.")
        try:
            image_format = image.image.format
        except AttributeError:
            raise serializers.ValidationError("Upload a valid image file.")
        if image_format not in {"JPEG", "PNG", "WEBP"}:
            raise serializers.ValidationError("Upload a JPEG, PNG, or WebP image.")
        return image


class StaffRequestUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ServiceRequest.Status.choices, required=False)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, trim_whitespace=True)
    expected_updated_at = serializers.DateTimeField()

    def validate(self, attrs):
        if "status" not in attrs and not attrs.get("note"):
            raise serializers.ValidationError("Provide a status change or a progress update.")
        return attrs


class InternalNoteSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)


class ServiceRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceRequestSerializer
    permission_classes = (IsAuthenticated,)
    pagination_class = RequestPagination
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    http_method_names = ("get", "post", "patch", "head", "options")

    def get_queryset(self):
        status_updates = RequestStatusUpdate.objects.select_related("changed_by")
        if not (
            self.request.user.is_superuser
            or self.request.user.has_perm("requests_api.change_servicerequest")
        ):
            status_updates = status_updates.filter(is_internal=False)
        queryset = ServiceRequest.objects.select_related(
            "owner", "owner__citizen_profile"
        ).prefetch_related(
            Prefetch("status_updates", queryset=status_updates)
        )
        can_view_all = self.request.user.is_superuser or (
            self.request.user.is_staff
            and self.request.user.has_perm("requests_api.view_servicerequest")
        )
        if not can_view_all:
            queryset = queryset.filter(owner=self.request.user)

        for field, choices in (
            ("status", ServiceRequest.Status.values),
            ("category", ServiceRequest.Category.values),
        ):
            value = self.request.query_params.get(field)
            if value:
                if value not in choices:
                    raise ValidationError({field: "Select a valid filter value."})
                queryset = queryset.filter(**{field: value})

        search = self.request.query_params.get("search", "").strip()
        if len(search) > 200:
            raise ValidationError({"search": "Search text must be 200 characters or fewer."})
        if search:
            search_query = (
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(location__icontains=search)
                | Q(owner__username__icontains=search)
                | Q(owner__citizen_profile__full_name__icontains=search)
            )
            try:
                search_query |= Q(pk=uuid.UUID(search))
            except ValueError:
                pass
            queryset = queryset.filter(search_query).distinct()

        location = self.request.query_params.get("location", "").strip()
        if len(location) > 255:
            raise ValidationError({"location": "Location filter must be 255 characters or fewer."})
        if location:
            queryset = queryset.filter(location__icontains=location)

        start_date = self._date_filter("date_from")
        end_date = self._date_filter("date_to")
        if start_date and end_date and start_date > end_date:
            raise ValidationError({"date_to": "End date must be on or after the start date."})
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        ordering = self.request.query_params.get("ordering", "-created_at")
        allowed_ordering = {"created_at", "-created_at", "updated_at", "-updated_at", "status", "-status"}
        if ordering not in allowed_ordering:
            raise ValidationError({"ordering": "Select a supported sort order."})
        return queryset.order_by(ordering, "pk")

    def _date_filter(self, parameter):
        value = self.request.query_params.get(parameter)
        if not value:
            return None
        try:
            parsed = parse_date(value)
        except ValueError:
            parsed = None
        if parsed is None:
            raise ValidationError({parameter: "Enter a valid date in YYYY-MM-DD format."})
        return parsed

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [CanViewServiceRequests()]
        if self.action in {"partial_update", "notes"}:
            return [CanManageServiceRequests()]
        return super().get_permissions()

    @transaction.atomic
    def perform_create(self, serializer):
        service_request = serializer.save(owner=self.request.user)
        RequestStatusUpdate.objects.create(
            request=service_request,
            status=service_request.status,
            previous_status="",
            changed_by=self.request.user,
            note="Request submitted.",
        )

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        unexpected = set(request.data) - {"status", "note", "expected_updated_at"}
        if unexpected:
            raise ValidationError({field: "This field cannot be changed here." for field in unexpected})

        instance = self._get_locked_object(request)
        self.check_object_permissions(request, instance)
        previous_status = instance.status
        serializer = StaffRequestUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["expected_updated_at"] != instance.updated_at:
            return Response(
                {"detail": "This request changed since it was opened. Refresh it before saving."},
                status=409,
            )

        new_status = serializer.validated_data.get("status", previous_status)
        note = serializer.validated_data.get("note", "")
        status_changed = new_status != previous_status
        allowed_transitions = {
            ServiceRequest.Status.PENDING: {ServiceRequest.Status.IN_PROGRESS},
            ServiceRequest.Status.IN_PROGRESS: {ServiceRequest.Status.RESOLVED},
            ServiceRequest.Status.RESOLVED: set(),
        }
        if status_changed and new_status not in allowed_transitions[previous_status]:
            raise ValidationError({"status": "Requests must move from pending to in progress, then to resolved."})
        if status_changed and new_status == ServiceRequest.Status.RESOLVED and not note:
            raise ValidationError({"note": "Add a resolution update before marking this request resolved."})
        if not status_changed and not note:
            raise ValidationError({"detail": "Provide a status change or a progress update."})

        if status_changed:
            instance.status = new_status
            instance.save(update_fields=("status", "updated_at"))
        RequestStatusUpdate.objects.create(
            request=instance,
            previous_status=previous_status,
            status=new_status,
            changed_by=request.user,
            note=note,
            is_internal=False,
        )
        instance._prefetched_objects_cache.pop("status_updates", None)
        return Response(self.get_serializer(instance).data)

    @action(detail=True, methods=("post",), permission_classes=(CanManageServiceRequests,))
    @transaction.atomic
    def notes(self, request, *args, **kwargs):
        unexpected = set(request.data) - {"note"}
        if unexpected:
            raise ValidationError({field: "This field is not accepted." for field in unexpected})
        serializer = InternalNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = self._get_locked_object(request)
        self.check_object_permissions(request, instance)
        RequestStatusUpdate.objects.create(
            request=instance,
            previous_status=instance.status,
            status=instance.status,
            changed_by=request.user,
            note=serializer.validated_data["note"],
            is_internal=True,
        )
        instance._prefetched_objects_cache.pop("status_updates", None)
        return Response(self.get_serializer(instance).data, status=201)

    def _get_locked_object(self, request):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        queryset = self.filter_queryset(self.get_queryset().select_for_update())
        instance = get_object_or_404(
            queryset,
            **{lookup_url_kwarg: self.kwargs[lookup_url_kwarg]},
        )
        self.check_object_permissions(request, instance)
        return instance
