from rest_framework.permissions import BasePermission


class CanViewServiceRequests(BasePermission):
    message = "You do not have permission to view service request operations."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        can_view_all = user.is_superuser or (
            user.is_staff and user.has_perm("requests_api.view_servicerequest")
        )
        return bool(can_view_all or obj.owner_id == user.pk)


class CanViewAdminDashboard(BasePermission):
    message = "You do not have permission to view administrative service data."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_staff
            and (user.is_superuser or user.has_perm("requests_api.view_servicerequest"))
        )


class CanManageServiceRequests(BasePermission):
    message = "You do not have permission to manage service requests."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_staff
            and (user.is_superuser or user.has_perm("requests_api.change_servicerequest"))
        )