from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import Order, OrderItem

_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}
_PAYMENT_CHOICES = ["NAQD", "PLASTIK", "OTKAZMA", "QARZ", "ARALASH"]


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "id", "product", "product_name", "product_sku", "quantity",
            "delivered_quantity", "price", "amount",
        )
        read_only_fields = ("id", "delivered_quantity", "amount",
                            "product_name", "product_sku")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source="client.name", read_only=True)
    taken_by_name = serializers.CharField(source="taken_by.full_name", read_only=True)
    assigned_to_name = serializers.CharField(
        source="assigned_to.full_name", read_only=True, default=None
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id", "number", "date", "client", "client_name",
            "taken_by", "taken_by_name", "assigned_to", "assigned_to_name",
            "loading", "status", "status_display", "payment_intent",
            "desired_date", "total_amount", "note", "client_uuid", "device_time",
            "cancelled_at", "cancel_reason", "items", "created_at",
        )
        read_only_fields = fields


class OrderLineInputSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    quantity = serializers.DecimalField(**_QTY, min_value=Decimal("0.001"))
    price = serializers.DecimalField(**_MONEY, min_value=Decimal("0"))


class OrderCreateSerializer(serializers.Serializer):
    client = serializers.UUIDField()
    taken_by = serializers.UUIDField(required=False, allow_null=True)
    items = OrderLineInputSerializer(many=True)
    date = serializers.DateField(required=False)
    payment_intent = serializers.ChoiceField(
        choices=_PAYMENT_CHOICES, required=False, allow_blank=True, default=""
    )
    desired_date = serializers.DateField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    place = serializers.BooleanField(required=False, default=False)
    client_uuid = serializers.UUIDField(required=False, allow_null=True)
    device_time = serializers.DateTimeField(required=False, allow_null=True)


class OrderCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class FulfillLineInputSerializer(serializers.Serializer):
    item = serializers.UUIDField()
    delivered_quantity = serializers.DecimalField(**_QTY, min_value=Decimal("0"))
    price = serializers.DecimalField(
        **_MONEY, required=False, allow_null=True, min_value=Decimal("0")
    )


class OrderFulfillSerializer(serializers.Serializer):
    lines = FulfillLineInputSerializer(many=True)
    distributor = serializers.UUIDField(required=False, allow_null=True)
    payment_type = serializers.ChoiceField(
        choices=_PAYMENT_CHOICES, required=False, allow_blank=True
    )
    paid_amount = serializers.DecimalField(**_MONEY, required=False, allow_null=True)
    due_date = serializers.DateField(required=False, allow_null=True)
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")
    client_uuid = serializers.UUIDField(required=False, allow_null=True)
    device_time = serializers.DateTimeField(required=False, allow_null=True)


class LoadingFromOrdersSerializer(serializers.Serializer):
    distributor = serializers.UUIDField()
    warehouse = serializers.UUIDField()
    order_ids = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    date = serializers.DateField(required=False)
