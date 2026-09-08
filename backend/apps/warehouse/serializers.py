from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import (
    Loading,
    LoadingItem,
    Purchase,
    PurchaseItem,
    Stock,
    StockMovement,
    Supplier,
    VanStock,
    Warehouse,
)
from .services.loading import assign_number as assign_loading_number
from .services.purchase import assign_number


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ("id", "name", "address", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = (
            "id", "name", "phone", "inn", "address", "note",
            "is_active", "created_at",
        )
        read_only_fields = ("id", "created_at")


class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    available_quantity = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )

    class Meta:
        model = Stock
        fields = (
            "id", "warehouse", "warehouse_name", "product", "product_name",
            "product_sku", "quantity", "reserved_quantity", "available_quantity",
            "updated_at",
        )
        read_only_fields = fields


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    movement_type_display = serializers.CharField(
        source="get_movement_type_display", read_only=True
    )

    class Meta:
        model = StockMovement
        fields = (
            "id", "movement_type", "movement_type_display", "warehouse",
            "product", "product_sku", "quantity", "balance_after",
            "from_location", "to_location", "reference_type", "reference_id",
            "user", "note", "created_at",
        )
        read_only_fields = fields


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PurchaseItem
        fields = (
            "id", "product", "product_name", "quantity", "cost_price", "amount",
        )
        read_only_fields = ("id", "amount", "product_name")


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = Purchase
        fields = (
            "id", "number", "supplier", "supplier_name", "warehouse",
            "warehouse_name", "invoice_number", "date",
            "total_amount", "paid_amount", "debt_amount",
            "source", "status", "status_display", "confirmed_at",
            "note", "items", "created_at",
        )
        read_only_fields = (
            "id", "number", "total_amount", "debt_amount", "status",
            "status_display", "confirmed_at", "created_at",
        )
        extra_kwargs = {
            "invoice_number": {"required": False, "allow_blank": True},
            "note": {"required": False, "allow_blank": True},
        }
        # supplier+invoice_number unique-together avtomatik validator'i
        # `invoice_number` ni majburiy qilib qo'yadi — bo'sh raqamli qabullar uchun
        # o'chirib, tekshiruvni validate()'da qo'lda qilamiz (DB constraint saqlanadi).
        validators: list = []

    def validate(self, attrs: dict) -> dict:
        if self.instance and self.instance.status != "DRAFT":
            raise serializers.ValidationError(
                "Tasdiqlangan qabulni tahrirlab bo'lmaydi."
            )
        invoice = attrs.get(
            "invoice_number",
            getattr(self.instance, "invoice_number", "") if self.instance else "",
        )
        supplier = attrs.get(
            "supplier",
            getattr(self.instance, "supplier", None) if self.instance else None,
        )
        if invoice and supplier:
            dup = Purchase.objects.filter(
                supplier=supplier, invoice_number=invoice
            )
            if self.instance:
                dup = dup.exclude(pk=self.instance.pk)
            if dup.exists():
                raise serializers.ValidationError(
                    {"invoice_number": "Bu yetkazib beruvchida shunday nakladnoy bor."}
                )
        return attrs

    def _write_items(self, purchase: Purchase, items_data: list[dict]) -> None:
        purchase.items.all().delete()
        PurchaseItem.objects.bulk_create(
            [
                PurchaseItem(
                    purchase=purchase,
                    product=row["product"],
                    quantity=row["quantity"],
                    cost_price=row["cost_price"],
                    amount=row["quantity"] * row["cost_price"],
                    created_by=purchase.created_by,
                )
                for row in items_data
            ]
        )

    @transaction.atomic
    def create(self, validated_data: dict) -> Purchase:
        items_data = validated_data.pop("items", [])
        purchase = Purchase(**validated_data)
        assign_number(purchase)
        purchase.save()
        self._write_items(purchase, items_data)
        purchase.recalc_totals()
        purchase.save(update_fields=["total_amount", "debt_amount", "updated_at"])
        return purchase

    @transaction.atomic
    def update(self, instance: Purchase, validated_data: dict) -> Purchase:
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            self._write_items(instance, items_data)
        instance.recalc_totals()
        instance.save(update_fields=["total_amount", "debt_amount", "updated_at"])
        return instance


class PurchasePaymentSerializer(serializers.Serializer):
    paid_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0")
    )


class VanStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    unit = serializers.CharField(source="product.unit.short_name", read_only=True)
    image = serializers.ImageField(source="product.image", read_only=True)
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )

    class Meta:
        model = VanStock
        fields = (
            "id", "distributor", "distributor_name", "product", "product_name",
            "product_sku", "unit", "image", "quantity", "updated_at",
        )
        read_only_fields = fields


class LoadingItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    price = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )

    class Meta:
        model = LoadingItem
        fields = ("id", "product", "product_name", "quantity", "price", "amount")
        read_only_fields = ("id", "amount", "product_name")


class LoadingSerializer(serializers.ModelSerializer):
    items = LoadingItemSerializer(many=True)
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = Loading
        fields = (
            "id", "number", "date", "distributor", "distributor_name",
            "warehouse", "warehouse_name", "status", "status_display",
            "total_amount", "sent_at", "confirmed_at", "note", "items",
            "created_at",
        )
        read_only_fields = (
            "id", "number", "status", "status_display", "total_amount",
            "sent_at", "confirmed_at", "created_at",
        )

    def validate(self, attrs: dict) -> dict:
        if self.instance and self.instance.status != "DRAFT":
            raise serializers.ValidationError(
                "Faqat qoralama yuklamani tahrirlash mumkin."
            )
        return attrs

    def _write_items(self, loading: Loading, items_data: list[dict]) -> None:
        loading.items.all().delete()
        LoadingItem.objects.bulk_create(
            [
                LoadingItem(
                    loading=loading,
                    product=row["product"],
                    quantity=row["quantity"],
                    price=row.get("price") or row["product"].wholesale_price,
                    amount=row["quantity"]
                    * (row.get("price") or row["product"].wholesale_price),
                    created_by=loading.created_by,
                )
                for row in items_data
            ]
        )

    @transaction.atomic
    def create(self, validated_data: dict) -> Loading:
        items_data = validated_data.pop("items", [])
        loading = Loading(**validated_data)
        assign_loading_number(loading)
        loading.save()
        self._write_items(loading, items_data)
        loading.recalc_total()
        loading.save(update_fields=["total_amount", "updated_at"])
        return loading

    @transaction.atomic
    def update(self, instance: Loading, validated_data: dict) -> Loading:
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            self._write_items(instance, items_data)
        instance.recalc_total()
        instance.save(update_fields=["total_amount", "updated_at"])
        return instance
