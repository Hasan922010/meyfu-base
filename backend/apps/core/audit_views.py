"""Audit jurnali — faqat o'qish (CLAUDE.md 5.3, v5: B5)."""
from __future__ import annotations

import django_filters
from django.db.models import QuerySet
from rest_framework import serializers

from apps.users.constants import Role

from .models import AuditLog
from .viewsets import BaseReadOnlyViewSet


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ("id", "created_at", "user", "user_name", "action", "model_name",
                  "object_id", "changes", "ip", "user_agent")
        read_only_fields = fields


class AuditLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")
    action = django_filters.CharFilter(lookup_expr="istartswith")

    class Meta:
        model = AuditLog
        fields = ("user", "model_name", "action", "date_from", "date_to")


class AuditLogViewSet(BaseReadOnlyViewSet):
    """Kim, qachon, nimani o'zgartirdi. Filial rahbari — o'z filiali xodimlari."""

    serializer_class = AuditLogSerializer
    read_roles = (Role.SUPER_ADMIN, Role.MANAGER, Role.ACCOUNTANT)
    branch_lookup = "user__warehouse"
    filterset_class = AuditLogFilter
    search_fields = ("action", "model_name", "object_id", "user__full_name")
    ordering = ("-created_at",)

    def get_queryset(self) -> QuerySet[AuditLog]:
        return AuditLog.objects.select_related("user").order_by("-created_at")
