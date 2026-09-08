from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import (
    Debt,
    DebtPayment,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
)

_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = SaleItem
        fields = (
            "id", "product", "product_name", "product_sku", "quantity", "price",
            "cost_price", "discount_percent", "amount", "profit", "below_min_price",
        )
        read_only_fields = (
            "id", "cost_price", "amount", "profit", "below_min_price",
            "product_name", "product_sku",
        )


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )
    payment_type_display = serializers.CharField(
        source="get_payment_type_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    order_number = serializers.CharField(
        source="order.number", read_only=True, default=None
    )

    class Meta:
        model = Sale
        fields = (
            "id", "number", "date", "distributor", "distributor_name",
            "order", "order_number",
            "client", "client_name", "payment_type", "payment_type_display",
            "total_amount", "discount_amount", "paid_amount", "debt_amount",
            "due_date", "status", "status_display", "flagged", "flag_reason",
            "latitude", "longitude", "client_uuid", "is_synced", "device_time",
            "note", "items", "created_at",
        )
        read_only_fields = fields


class SaleLineInputSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    quantity = serializers.DecimalField(**_QTY, min_value=Decimal("0.001"))
    price = serializers.DecimalField(**_MONEY, min_value=Decimal("0"))
    discount_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=Decimal("0")
    )


class SaleCreateSerializer(serializers.Serializer):
    client = serializers.UUIDField()
    payment_type = serializers.ChoiceField(
        choices=["NAQD", "PLASTIK", "OTKAZMA", "QARZ", "ARALASH"]
    )
    items = SaleLineInputSerializer(many=True)
    date = serializers.DateField(required=False)
    paid_amount = serializers.DecimalField(**_MONEY, required=False)
    due_date = serializers.DateField(required=False, allow_null=True)
    discount_amount = serializers.DecimalField(
        **_MONEY, required=False, default=Decimal("0")
    )
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")
    client_uuid = serializers.UUIDField(required=False, allow_null=True)
    device_time = serializers.DateTimeField(required=False, allow_null=True)


class DebtSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)
    sale_number = serializers.CharField(
        source="sale.number", read_only=True, default=None
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = Debt
        fields = (
            "id", "client", "client_name", "sale", "sale_number",
            "amount", "paid_amount", "remaining", "due_date",
            "status", "status_display", "created_at",
        )
        read_only_fields = fields


class DebtPaymentSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(
        source="debt.client.name", read_only=True
    )

    class Meta:
        model = DebtPayment
        fields = (
            "id", "debt", "client_name", "amount", "payment_type",
            "collected_by", "date", "client_uuid", "device_time", "note",
            "created_at",
        )
        read_only_fields = ("id", "collected_by", "client_name", "created_at")


class DebtPaymentCreateSerializer(serializers.Serializer):
    debt = serializers.UUIDField()
    amount = serializers.DecimalField(**_MONEY, min_value=Decimal("0.01"))
    payment_type = serializers.ChoiceField(
        choices=["NAQD", "PLASTIK", "OTKAZMA"], default="NAQD"
    )
    date = serializers.DateField(required=False)
    client_uuid = serializers.UUIDField(required=False, allow_null=True)
    device_time = serializers.DateTimeField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class SaleReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleReturnItem
        fields = ("id", "product", "product_name", "quantity", "price", "amount")
        read_only_fields = ("id", "amount", "product_name")


class SaleReturnSerializer(serializers.ModelSerializer):
    items = SaleReturnItemSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    reason_display = serializers.CharField(
        source="get_reason_display", read_only=True
    )

    class Meta:
        model = SaleReturn
        fields = (
            "id", "number", "date", "distributor", "client", "client_name",
            "sale", "reason", "reason_display", "restock", "total_amount",
            "note", "items", "created_at",
        )
        read_only_fields = fields


class SaleReturnCreateSerializer(serializers.Serializer):
    client = serializers.UUIDField()
    reason = serializers.ChoiceField(choices=["BRAK", "MUDDAT", "KELISHMOVCHILIK"])
    sale = serializers.UUIDField(required=False, allow_null=True)
    restock = serializers.BooleanField(default=True)
    items = SaleLineInputSerializer(many=True)
    date = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    client_uuid = serializers.UUIDField(required=False, allow_null=True)


class BulkSyncOperationSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=["sale", "debt_payment", "sale_return", "visit", "expense",
                 "order_create", "order_fulfill"]
    )
    client_uuid = serializers.UUIDField()
    payload = serializers.JSONField()


class BulkSyncSerializer(serializers.Serializer):
    operations = BulkSyncOperationSerializer(many=True)
