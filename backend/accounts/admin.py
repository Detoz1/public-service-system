from django.contrib import admin

from .models import CitizenProfile


@admin.register(CitizenProfile)
class CitizenProfileAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "phone", "user")
    search_fields = ("full_name", "email", "phone", "user__username")
