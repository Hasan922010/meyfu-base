from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.catalog.models import Product

from .models import (
    InventoryCount,
    InventoryCountItem,
    Loading,
    LoadingItem,
    Purchase,
    PurchaseItem,
    Stock,
    StockMovement,
    Supplier,
    Transfer,
    TransferItem,
    VanStock,
    Warehouse,
)
from .services.inventory import assign_number as assign_inventory_number
from .services.inventory import fill_inventory
from .services.loading import assign_number as assign_loading_number
from .services.purchase import assign_number
from .services.transfers import assign_number as assign_transfer_number


class WarehouseSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(
        source="manager.full_name", read_only=True, default=None
    )
    opening_confirmed_by_name = serializers.CharField(
        source="opening_confirmed_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = Warehouse
        fields = (
            "id", "name", "address", "phone", "is_active", "is_branch",
            "manager", "manager_name", "is_opening_locked",
            "opening_confirmed_at", "opening_confirmed_by", "opening_confirmed_by_name",
            "created_at",
        )
        read_only_fields = (
            "id", "created_at", "manager_name", "is_opening_locked",
            "opening_confirmed_at", "opening_confirmed_by", "opening_confirmed_by_name",
        )


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = (
            "id", "name", "phone", "inn", "address", "note",
            "is_active", "balance", "created_at",
        )
        read_only_fields = ("id", "balance", "created_at")


class SupplierOpeningBalanceSerializer(serializers.Serializer):
    """Ta'minotchi boshlang'ich qoldig'i — ishorali (musbat/manfiy)."""

    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.filter(is_active=True)
    )
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_amount(self, value: Decimal) -> Decimal:
        if value == Decimal("0"):
            raise serializers.ValidationError("Summa 0 bo'lishi mumkin emas.")
        return value


class SupplierTransactionSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    date = serializers.DateField(read_only=True)
    transaction_type = serializers.CharField(read_only=True)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    balance_after = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )
    note = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)


class StockOpeningBalanceSerializer(serializers.Serializer):
    """Mavjud mahsulot uchun boshlang'ich qoldiq (CLAUDE.md 6 — Ombor)."""

    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True)
    )
    warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(is_active=True)
    )
    quantity = serializers.DecimalField(
        max_digits=14, decimal_places=3, min_value=Decimal("0.001")
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")


class OpeningWarehouseSerializer(serializers.Serializer):
    """Ommaviy boshlang'ich qoldiq qaysi omborga yoziladi."""

    warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(is_active=True)
    )


class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    available_quantity = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )
    # Audit m9: telefondagi ro'yxat birlik va "kam qoldi" belgisini ko'rsatadi
    product_unit = serializers.CharField(source="product.unit.short_name", read_only=True)
    min_stock_alert = serializers.DecimalField(
        source="product.min_stock_alert", max_digits=14, decimal_places=3, read_only=True
    )

    class Meta:
        model = Stock
        fields = (
            "id", "warehouse", "warehouse_name", "product", "product_name",
            "product_sku", "product_unit", "min_stock_alert",
            "quantity", "reserved_quantity", "available_quantity",
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
        from apps.catalog.pricing import branch_price_map, price_for
        from apps.core.branch import staff_branch

        loading.items.all().delete()
        # Narx ko'rsatilmasa — tarqatuvchi filialining optom narxi (v5: A7)
        branch = staff_branch(loading.distributor)
        price_map = branch_price_map(branch, [row["product"].pk for row in items_data])

        def _price(row):
            return row.get("price") or price_for(
                row["product"], branch, price_map
            ).wholesale_price

        LoadingItem.objects.bulk_create(
            [
                LoadingItem(
                    loading=loading,
                    product=row["product"],
                    quantity=row["quantity"],
                    price=_price(row),
                    amount=row["quantity"] * _price(row),
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


class InventoryCountItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_unit = serializers.CharField(source="product.unit.short_name", read_only=True)
    difference = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True, allow_null=True
    )

    class Meta:
        model = InventoryCountItem
        fields = (
            "id", "product", "product_name", "product_sku", "product_unit",
            "expected_qty", "actual_qty", "difference", "cost_price", "note",
        )
        read_only_fields = fields


class _InventorySummaryMixin(serializers.Serializer):
    """Ro'yxatda annotatsiyadan, detalda qatorlardan hisoblanadi."""

    items_count = serializers.SerializerMethodField()
    counted_count = serializers.SerializerMethodField()
    difference_amount = serializers.SerializerMethodField()

    def _summary(self, obj: InventoryCount) -> dict:
        if hasattr(obj, "annotated_items_count"):
            return {
                "items_count": obj.annotated_items_count,
                "counted_count": obj.annotated_counted_count,
                "difference_amount": obj.annotated_difference_amount or Decimal("0"),
            }
        items = list(obj.items.all())
        counted = [i for i in items if i.actual_qty is not None]
        return {
            "items_count": len(items),
            "counted_count": len(counted),
            "difference_amount": sum(
                (i.difference * i.cost_price for i in counted), Decimal("0")
            ),
        }

    def get_items_count(self, obj: InventoryCount) -> int:
        return self._summary(obj)["items_count"]

    def get_counted_count(self, obj: InventoryCount) -> int:
        return self._summary(obj)["counted_count"]

    def get_difference_amount(self, obj: InventoryCount) -> str:
        return str(self._summary(obj)["difference_amount"].quantize(Decimal("0.01")))


class InventoryCountListSerializer(_InventorySummaryMixin, serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = InventoryCount
        fields = (
            "id", "number", "warehouse", "warehouse_name", "date", "status",
            "status_display", "note", "confirmed_at", "created_at",
            "items_count", "counted_count", "difference_amount",
        )
        read_only_fields = (
            "id", "number", "status", "status_display", "confirmed_at", "created_at",
        )
        extra_kwargs = {"note": {"required": False, "allow_blank": True}}


class InventoryCountSerializer(InventoryCountListSerializer):
    items = InventoryCountItemSerializer(many=True, read_only=True)

    class Meta(InventoryCountListSerializer.Meta):
        fields = (*InventoryCountListSerializer.Meta.fields, "items")

    def validate_warehouse(self, value: Warehouse) -> Warehouse:
        if self.instance and value != self.instance.warehouse:
            raise serializers.ValidationError(
                "Omborni o'zgartirib bo'lmaydi — yangi hujjat oching."
            )
        return value

    def validate_date(self, value):
        # Raqam yil bo'yicha beriladi (INV-<yil>-...) — boshqa yilga ko'chsa mos kelmaydi
        if self.instance and value.year != self.instance.date.year:
            raise serializers.ValidationError(
                "Sanani boshqa yilga o'zgartirib bo'lmaydi — yangi hujjat oching."
            )
        return value

    @transaction.atomic
    def create(self, validated_data: dict) -> InventoryCount:
        count = InventoryCount(**validated_data)
        assign_inventory_number(count)
        count.save()
        return fill_inventory(count, user=count.created_by)


class InventoryItemInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    actual_qty = serializers.DecimalField(
        max_digits=14, decimal_places=3, min_value=Decimal("0"), allow_null=True
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class InventoryItemsUpdateSerializer(serializers.Serializer):
    items = InventoryItemInputSerializer(many=True, allow_empty=False)


class TransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_unit = serializers.CharField(source="product.unit.short_name", read_only=True)
    difference = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True, allow_null=True
    )

    class Meta:
        model = TransferItem
        fields = (
            "id", "product", "product_name", "product_sku", "product_unit",
            "quantity", "received_quantity", "difference", "cost_price",
        )
        read_only_fields = (
            "id", "product_name", "product_sku", "product_unit",
            "received_quantity", "difference", "cost_price",
        )


class TransferSerializer(serializers.ModelSerializer):
    items = TransferItemSerializer(many=True)
    from_warehouse_name = serializers.CharField(
        source="from_warehouse.name", read_only=True
    )
    to_warehouse_name = serializers.CharField(source="to_warehouse.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    sent_by_name = serializers.CharField(
        source="sent_by.full_name", read_only=True, default=None
    )
    received_by_name = serializers.CharField(
        source="received_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = Transfer
        fields = (
            "id", "number", "from_warehouse", "from_warehouse_name",
            "to_warehouse", "to_warehouse_name", "date", "status", "status_display",
            "note", "receive_note", "sent_at", "sent_by_name",
            "received_at", "received_by_name", "items", "created_at",
        )
        read_only_fields = (
            "id", "number", "status", "status_display", "receive_note", "sent_at",
            "sent_by_name", "received_at", "received_by_name", "created_at",
        )
        extra_kwargs = {"note": {"required": False, "allow_blank": True}}

    def validate_items(self, items: list[dict]) -> list[dict]:
        if not items:
            raise serializers.ValidationError("Kamida bitta tovar qo'shing.")
        products = [row["product"].pk for row in items]
        if len(products) != len(set(products)):
            raise serializers.ValidationError("Bir tovar ikki marta kiritilgan.")
        return items

    def validate(self, attrs: dict) -> dict:
        if self.instance and self.instance.status != "DRAFT":
            raise serializers.ValidationError("Faqat qoralamani tahrirlash mumkin.")
        current = self.instance
        source = attrs.get("from_warehouse", getattr(current, "from_warehouse", None))
        target = attrs.get("to_warehouse", getattr(current, "to_warehouse", None))
        if source is not None and source == target:
            raise serializers.ValidationError(
                {"to_warehouse": "Qayerga — boshqa ombor bo'lishi kerak."}
            )
        return attrs

    def _write_items(self, transfer: Transfer, items: list[dict]) -> None:
        transfer.items.all().delete()
        TransferItem.objects.bulk_create([
            TransferItem(
                transfer=transfer, product=row["product"], quantity=row["quantity"],
                cost_price=row["product"].cost_price, created_by=transfer.created_by,
            )
            for row in items
        ])

    @transaction.atomic
    def create(self, validated_data: dict) -> Transfer:
        items = validated_data.pop("items")
        transfer = Transfer(**validated_data)
        assign_transfer_number(transfer)
        transfer.save()
        self._write_items(transfer, items)
        return transfer

    @transaction.atomic
    def update(self, instance: Transfer, validated_data: dict) -> Transfer:
        items = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items is not None:
            self._write_items(instance, items)
        return instance


class TransferReceiveRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    received_quantity = serializers.DecimalField(
        max_digits=14, decimal_places=3, min_value=Decimal("0")
    )


class TransferReceiveSerializer(serializers.Serializer):
    items = TransferReceiveRowSerializer(many=True, required=False, default=list)
    note = serializers.CharField(
        required=False, allow_blank=True, default="", max_length=255
    )
