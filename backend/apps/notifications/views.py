from __future__ import annotations

from django.db.models import QuerySet
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from apps.core.response import ok
from apps.core.viewsets import BaseReadOnlyViewSet

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(BaseReadOnlyViewSet):
    serializer_class = NotificationSerializer
    queryset = Notification.objects.none()
    filterset_fields = ("type", "is_read")
    ordering = ("-created_at",)

    def get_queryset(self) -> QuerySet[Notification]:
        if getattr(self, "swagger_fake_view", False) or (
            not self.request.user.is_authenticated
        ):
            return Notification.objects.none()
        return Notification.objects.filter(user=self.request.user)

    @extend_schema(summary="O'qilmagan bildirishnomalar soni")
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request: Request) -> Response:
        count = self.get_queryset().filter(is_read=False).count()
        return ok({"count": count})

    @extend_schema(summary="Bildirishnomani o'qilgan deb belgilash", request=None)
    @action(detail=True, methods=["post"])
    def read(self, request: Request, pk: str | None = None) -> Response:
        obj = self.get_object()
        if not obj.is_read:
            obj.is_read = True
            obj.read_at = timezone.now()
            obj.save(update_fields=["is_read", "read_at", "updated_at"])
        return ok(NotificationSerializer(obj).data)

    @extend_schema(summary="Barchasini o'qilgan deb belgilash", request=None)
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request: Request) -> Response:
        updated = self.get_queryset().filter(is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return ok({"updated": updated})
