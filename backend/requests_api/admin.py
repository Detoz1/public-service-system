from django.contrib import admin

from .models import RequestStatusUpdate, ServiceRequest


class RequestStatusUpdateInline(admin.TabularInline):
    model = RequestStatusUpdate
    extra = 0
    readonly_fields = ("status", "changed_by", "note", "created_at")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "category", "status", "created_at")
    list_filter = ("status", "category", "created_at")
    search_fields = ("title", "description", "location", "owner__username")
    readonly_fields = ("id", "title", "category", "description", "location", "owner", "status", "evidence", "created_at", "updated_at")
    fields = readonly_fields
    inlines = (RequestStatusUpdateInline,)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RequestStatusUpdate)
class RequestStatusUpdateAdmin(admin.ModelAdmin):
    list_display = ("request", "status", "changed_by", "created_at")
    list_filter = ("status", "created_at")
    readonly_fields = ("request", "previous_status", "status", "changed_by", "note", "is_internal", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
