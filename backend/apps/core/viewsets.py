"""Umumiy ViewSet bazasi va javob o'rash mixin'i."""
from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import Serializer

from .permissions import RolePermission


class EnvelopeResponseMixin:
    """Barcha muvaffaqiyatli javoblarni {success, data} ga keltiradi (CLAUDE.md 10).

    Xatolar `exceptions.api_exception_handler` da o'raladi; pagination
    `DefaultPagination` da. Bu yerda qolgan holatlar (retrieve/create/custom action).
    """

    def finalize_response(
        self, request: Request, response: Response, *args, **kwargs
    ) -> Response:
        response = super().finalize_response(request, response, *args, **kwargs)
        if not hasattr(response, "data"):
            # File/streaming javoblar (masalan PDF) — o'ramaymiz
            return response
        data = response.data
        already = isinstance(data, dict) and ("success" in data or "error" in data)
        if not already and response.status_code < 400:
            response.data = {"success": True, "data": data if data is not None else {}}
        return response


class BaseModelViewSet(EnvelopeResponseMixin, viewsets.ModelViewSet):
    """`created_by` ni avtomatik to'ldiradi, rolga asoslangan ruxsatni qo'llaydi.

    View'da `read_roles` / `write_roles` (yoki `allowed_roles`) belgilang.
    """

    permission_classes = [IsAuthenticated, RolePermission]

    def perform_create(self, serializer: Serializer) -> None:
        serializer.save(created_by=self.request.user)


class BaseReadOnlyViewSet(EnvelopeResponseMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, RolePermission]
