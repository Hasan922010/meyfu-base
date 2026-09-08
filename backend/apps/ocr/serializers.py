from __future__ import annotations

from rest_framework import serializers

from .models import InvoiceScan, InvoiceScanLine, InvoiceScanPage

_MONEY = {"max_digits": 14, "decimal_places": 2}
_QTY = {"max_digits": 14, "decimal_places": 3}


class InvoiceScanPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceScanPage
        fields = ("id", "image", "processed_image", "page_number")
        read_only_fields = fields


class InvoiceScanLineSerializer(serializers.ModelSerializer):
    matched_product_name = serializers.CharField(
        source="matched_product.name", read_only=True, default=None
    )
    final_product_name = serializers.CharField(
        source="final_product.name", read_only=True, default=None
    )
    match_status_display = serializers.CharField(
        source="get_match_status_display", read_only=True
    )

    class Meta:
        model = InvoiceScanLine
        fields = (
            "id", "line_number",
            "raw_name", "raw_quantity", "raw_unit", "raw_price", "raw_amount",
            "matched_product", "matched_product_name", "match_confidence",
            "match_status", "match_status_display",
            "final_product", "final_product_name",
            "final_quantity", "final_price",
            "low_confidence", "was_corrected", "is_confirmed",
        )
        read_only_fields = (
            "id", "line_number", "raw_name", "raw_quantity", "raw_unit",
            "raw_price", "raw_amount", "matched_product", "matched_product_name",
            "match_confidence", "match_status", "match_status_display",
            "final_product_name", "low_confidence", "is_confirmed",
        )


class InvoiceScanLineUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceScanLine
        fields = ("final_product", "final_quantity", "final_price")

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.was_corrected = True
        instance.save(update_fields=[
            "final_product", "final_quantity", "final_price",
            "was_corrected", "updated_at",
        ])
        return instance


class InvoiceScanSerializer(serializers.ModelSerializer):
    pages = InvoiceScanPageSerializer(many=True, read_only=True)
    lines = InvoiceScanLineSerializer(many=True, read_only=True)
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.full_name", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    line_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = InvoiceScan
        fields = (
            "id", "uploaded_by", "uploaded_by_name", "warehouse", "supplier",
            "scan_type", "status", "status_display",
            "detected_invoice_number", "detected_date", "detected_total",
            "detected_supplier_name", "confidence", "provider",
            "tokens_used", "cost_usd", "processing_time_ms", "error_message",
            "purchase", "confirmed_at", "line_count",
            "pages", "lines", "created_at",
        )
        read_only_fields = (
            "id", "uploaded_by", "uploaded_by_name", "status", "status_display",
            "detected_invoice_number", "detected_date", "detected_total",
            "detected_supplier_name", "confidence", "provider", "tokens_used",
            "cost_usd", "processing_time_ms", "error_message", "purchase",
            "confirmed_at", "line_count", "pages", "lines", "created_at",
        )


class InvoiceScanCreateSerializer(serializers.Serializer):
    warehouse = serializers.UUIDField()
    supplier = serializers.UUIDField(required=False, allow_null=True)
    scan_type = serializers.ChoiceField(
        choices=["INVOICE", "RECEIPT"], default="INVOICE"
    )
    images = serializers.ListField(
        child=serializers.ImageField(), min_length=1, max_length=10
    )


class InvoiceScanUpdateSerializer(serializers.Serializer):
    """Yetkazib beruvchi / raqam / sanani tuzatish (tekshirish ekrani)."""

    supplier = serializers.UUIDField(required=False, allow_null=True)
    detected_invoice_number = serializers.CharField(
        required=False, allow_blank=True
    )
    detected_date = serializers.DateField(required=False, allow_null=True)


class ReceiptScanSerializer(serializers.Serializer):
    image = serializers.ImageField()
