from __future__ import annotations

from rest_framework import serializers

from .constants import WEEKDAYS
from .models import Client, ClientVisit, Route


class RouteSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True, default=None
    )
    clients_count = serializers.IntegerField(read_only=True)
    days_display = serializers.SerializerMethodField()

    class Meta:
        model = Route
        fields = (
            "id", "name", "distributor", "distributor_name",
            "days_of_week", "days_display", "is_active",
            "clients_count", "created_at",
        )
        read_only_fields = ("id", "created_at", "clients_count")

    def get_days_display(self, obj: Route) -> list[str]:
        return [str(WEEKDAYS[d]) for d in obj.days_of_week if d in WEEKDAYS]


class ClientSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(
        source="route.name", read_only=True, default=None
    )
    client_type_display = serializers.CharField(
        source="get_client_type_display", read_only=True
    )
    debt_available = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = Client
        fields = (
            "id", "name", "owner_name", "phone", "phone2", "address",
            "latitude", "longitude", "route", "route_name",
            "client_type", "client_type_display",
            "debt_limit", "current_debt", "debt_available",
            "inn", "photo", "is_blocked", "note",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "current_debt", "created_at", "updated_at")


class ClientLiteSerializer(serializers.ModelSerializer):
    """Offline sinxronizatsiya uchun (CLAUDE.md 4.1)."""

    class Meta:
        model = Client
        fields = (
            "id", "name", "owner_name", "phone", "address",
            "latitude", "longitude", "route", "client_type",
            "debt_limit", "current_debt", "is_blocked",
            "is_deleted", "updated_at",
        )
        read_only_fields = fields


class ClientVisitSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    result_display = serializers.CharField(
        source="get_result_display", read_only=True
    )
    checked_in_at = serializers.DateTimeField(required=False)

    class Meta:
        model = ClientVisit
        fields = (
            "id", "client", "client_name", "distributor",
            "checked_in_at", "latitude", "longitude",
            "result", "result_display", "photo", "note",
            "client_uuid", "device_time", "created_at",
        )
        read_only_fields = ("id", "distributor", "created_at")
