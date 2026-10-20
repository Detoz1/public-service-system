from django.urls import path

from .views import admin_dashboard, dashboard

urlpatterns = [
    path("dashboard/", dashboard, name="dashboard"),
    path("admin-dashboard/", admin_dashboard, name="admin-dashboard"),
]
