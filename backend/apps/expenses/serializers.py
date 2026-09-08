from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import DistributorExpense, ExpenseCategory, FuelLog

_MONEY = {"max_digits": 14, "decimal_places": 2}


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = (
            "id", "name", "icon", "color", "requires_receipt",
            "daily_limit", "paid_by", "is_active", "created_at",
        )
        read_only_fields = ("id", "created_at")


class FuelLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelLog
        fields = ("liters", "price_per_liter", "odometer", "station_name")


class DistributorExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_icon = serializers.CharField(source="category.icon", read_only=True)
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    payment_source_display = serializers.CharField(
        source="get_payment_source_display", read_only=True
    )
    fuel_log = FuelLogSerializer(read_only=True)

    class Meta:
        model = DistributorExpense
        fields = (
            "id", "distributor", "distributor_name", "date",
            "category", "category_name", "category_icon", "amount",
            "description", "receipt_image", "latitude", "longitude",
            "payment_source", "payment_source_display",
            "status", "status_display", "approved_by", "approved_at",
            "reject_reason", "is_deductible", "client_uuid", "fuel_log",
            "created_at",
        )
        read_only_fields = (
            "id", "distributor", "distributor_name", "status", "status_display",
            "approved_by", "approved_at", "reject_reason", "is_deductible",
            "created_at",
        )


class ExpenseCreateSerializer(serializers.Serializer):
    category = serializers.UUIDField()
    amount = serializers.DecimalField(**_MONEY, min_value=Decimal("0.01"))
    payment_source = serializers.ChoiceField(
        choices=["CASH_ON_HAND", "OWN_MONEY", "COMPANY_CARD"],
        default="CASH_ON_HAND",
    )
    date = serializers.DateField(required=False)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    receipt_image = serializers.ImageField(required=False, allow_null=True)
    fuel = FuelLogSerializer(required=False)
    client_uuid = serializers.UUIDField(required=False, allow_null=True)
    device_time = serializers.DateTimeField(required=False, allow_null=True)


class ExpenseRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)
