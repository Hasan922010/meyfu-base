from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import CashHandover, DailyReturn, DailyReturnItem, DayClose

_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class DailyReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = DailyReturnItem
        fields = ("id", "product", "product_name", "quantity", "condition",
                  "price", "amount")
        read_only_fields = ("id", "price", "amount", "product_name")


class DailyReturnSerializer(serializers.ModelSerializer):
    items = DailyReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = DailyReturn
        fields = ("id", "number", "date", "distributor", "warehouse",
                  "day_close", "total_amount", "note", "items", "created_at")
        read_only_fields = fields


class CashHandoverSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashHandover
        fields = ("id", "date", "distributor", "amount", "received_by",
                  "confirmed", "note", "created_at")
        read_only_fields = ("id", "received_by", "confirmed", "created_at")


class DayCloseSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    has_difference = serializers.BooleanField(read_only=True)
    daily_returns = DailyReturnSerializer(many=True, read_only=True)

    class Meta:
        model = DayClose
        fields = (
            "id", "date", "distributor", "distributor_name",
            "status", "status_display",
            "loaded_amount", "sold_amount", "returned_amount",
            "stock_difference_qty", "stock_difference_amount",
            "cash_sales_amount", "debt_collected_amount",
            "expense_amount", "expense_approved_amount",
            "cash_expected", "wallet_balance_end",
            "cash_handed_amount", "cash_difference",
            "debt_given_amount", "sales_count", "visits_count",
            "new_clients_count", "has_difference",
            "closed_by", "closed_at", "note", "daily_returns", "created_at",
        )
        read_only_fields = fields


class DayCloseReturnRowSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    quantity = serializers.DecimalField(**_QTY, min_value=Decimal("0.001"))
    condition = serializers.ChoiceField(
        choices=["GOOD", "DAMAGED", "EXPIRED"], default="GOOD"
    )


class DayCloseSubmitSerializer(serializers.Serializer):
    date = serializers.DateField(required=False)
    warehouse = serializers.UUIDField()
    cash_handed = serializers.DecimalField(**_MONEY, min_value=Decimal("0"))
    items = DayCloseReturnRowSerializer(many=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class DayClosePreviewSerializer(serializers.Serializer):
    """`GET /day-close/my-today/` — hali yopilmagan kun uchun jonli hisob."""

    date = serializers.DateField()
    loaded_amount = serializers.DecimalField(**_MONEY)
    sold_amount = serializers.DecimalField(**_MONEY)
    cash_sales_amount = serializers.DecimalField(**_MONEY)
    debt_collected_amount = serializers.DecimalField(**_MONEY)
    debt_given_amount = serializers.DecimalField(**_MONEY)
    cash_expected = serializers.DecimalField(**_MONEY)
    sales_count = serializers.IntegerField()
    visits_count = serializers.IntegerField()
    van_items = serializers.ListField()
