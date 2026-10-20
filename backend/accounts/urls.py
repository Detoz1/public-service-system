from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf_token, name="csrf-token"),
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.sign_in, name="login"),
    path("auth/logout/", views.sign_out, name="logout"),
    path("auth/me/", views.current_account, name="current-account"),
    path("assistant/chat/", views.assistant_chat, name="assistant-chat"),
]
