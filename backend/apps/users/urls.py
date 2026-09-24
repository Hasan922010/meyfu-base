from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    UserViewSet,
    WebSocketTicketView,
)

# `auth/` prefiksi bilan mount qilinadi (config/urls.py)
urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("ws-ticket/", WebSocketTicketView.as_view(), name="ws-ticket"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path(
        "password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
]

_router = SimpleRouter()
_router.register("users", UserViewSet, basename="user")

# `/api/v1/` root'ga mount qilinadi (config/urls.py)
root_urlpatterns = _router.urls
