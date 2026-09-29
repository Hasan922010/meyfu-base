from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.users.constants import Role
from apps.warehouse.models import Warehouse

from .models import BranchPrice, Brand, Category, Product, ProductImage, ProductPrice, Unit
from .pricing import PRICE_FIELDS


class BranchPricedMixin:
    """Filial xodimiga o'z filiali narxini ko'rsatadi (v5: A7).

    View `branch_price_map` ni kontekstga qo'yadi ({product_id: BranchPrice}).
    """

    def to_representation(self, instance):
        data = super().to_representation(instance)
        override = (self.context.get("branch_price_map") or {}).get(instance.pk)
        if override is not None:
            for field in PRICE_FIELDS:
                if field in data:
                    data[field] = str(getattr(override, field))
        return data


class BranchPriceSerializer(serializers.ModelSerializer):
    """Filial narxi (markaz belgilaydi). Minimal narx chakanadan oshmasin (CLAUDE.md 7.1)."""

    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    base_wholesale_price = serializers.DecimalField(
        source="product.wholesale_price", max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = BranchPrice
        fields = (
            "id", "branch", "branch_name", "product", "product_name", "product_sku",
            "wholesale_price", "retail_price", "min_price", "base_wholesale_price",
            "updated_at",
        )
        read_only_fields = ("id", "updated_at")

    def validate(self, attrs: dict) -> dict:
        branch = attrs.get("branch", getattr(self.instance, "branch", None))
        if branch is not None and not branch.is_branch:
            raise serializers.ValidationError({"branch": "Faqat filial uchun narx belgilanadi."})
        retail = attrs.get("retail_price", getattr(self.instance, "retail_price", None))
        minimum = attrs.get("min_price", getattr(self.instance, "min_price", None))
        if retail is not None and minimum is not None and minimum > retail:
            raise serializers.ValidationError(
                {"min_price": "Minimal narx chakana narxdan katta bo'lmasligi kerak."}
            )
        return attrs


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "parent", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "name", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ("id", "name", "short_name", "created_at")
        read_only_fields = ("id", "created_at")


class ProductPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductPrice
        fields = (
            "id", "cost_price", "wholesale_price", "retail_price",
            "min_price", "effective_from", "reason", "created_at",
        )
        read_only_fields = fields


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ("id", "image", "thumbnail", "sort_order", "is_primary", "created_at")
        read_only_fields = fields


class ProductImageUploadSerializer(serializers.Serializer):
    images = serializers.ListField(
        child=serializers.ImageField(), allow_empty=False, max_length=12
    )


class ProductImagePatchSerializer(serializers.Serializer):
    sort_order = serializers.IntegerField(required=False, min_value=0)
    is_primary = serializers.BooleanField(required=False)


def _primary_thumb_url(obj, context) -> str | None:
    """Asosiy rasmning eskiz URL'i (yoki eski `Product.image`)."""
    images = list(obj.images.all())
    primary = next((i for i in images if i.is_primary), None) or (
        images[0] if images else None
    )
    target = None
    if primary is not None:
        target = primary.thumbnail or primary.image
    elif obj.image:
        target = obj.image
    if not target:
        return None
    request = context.get("request")
    return request.build_absolute_uri(target.url) if request else target.url


class ProductSerializer(BranchPricedMixin, serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    unit_name = serializers.CharField(source="unit.short_name", read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    image_thumb = serializers.SerializerMethodField()

    # Faqat yaratishda: boshlang'ich qoldiqni shu yerdan kiritish mumkin
    # (CLAUDE.md 6 — Ombor). ProductViewSet.perform_create'da ishlatiladi,
    # Product modelida saqlanmaydi.
    initial_stock_warehouse = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.filter(is_active=True),
        write_only=True, required=False, allow_null=True,
    )
    initial_stock_quantity = serializers.DecimalField(
        max_digits=14, decimal_places=3, write_only=True,
        required=False, allow_null=True, min_value=Decimal("0"),
    )

    class Meta:
        model = Product
        fields = (
            "id", "name", "sku", "barcode",
            "category", "category_name", "brand", "brand_name",
            "unit", "unit_name", "image", "images", "image_thumb",
            "cost_price", "wholesale_price", "retail_price", "min_price",
            "pack_quantity", "commission_percent", "min_stock_alert",
            "is_active", "created_at", "updated_at",
            "initial_stock_warehouse", "initial_stock_quantity",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_image_thumb(self, obj: Product) -> str | None:
        return _primary_thumb_url(obj, self.context)

    def validate(self, attrs: dict) -> dict:
        if (
            attrs.get("initial_stock_quantity")
            and not attrs.get("initial_stock_warehouse")
        ):
            raise serializers.ValidationError(
                {"initial_stock_warehouse": "Boshlang'ich qoldiq uchun ombor tanlang."}
            )
        self._validate_min_not_above_retail(attrs)
        # CLAUDE.md 2: MANAGER narx/foizni o'zgartirmaydi — faqat SUPER_ADMIN
        request = self.context.get("request")
        if request is None or self.instance is None:
            return attrs
        user = request.user
        if user.is_superuser or getattr(user, "role", None) == Role.SUPER_ADMIN:
            return attrs
        changed = [
            f for f in Product.PRICE_FIELDS
            if f in attrs and attrs[f] != getattr(self.instance, f)
        ]
        if changed:
            raise serializers.ValidationError(
                {
                    f: "Narx va foizni faqat SUPER_ADMIN o'zgartira oladi."
                    for f in changed
                }
            )
        return attrs

    def _validate_min_not_above_retail(self, attrs: dict) -> None:
        """CLAUDE.md 7.1: chakana narxda sotish min_price qoidasini buzmasligi kerak."""
        def current(field: str):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, None)

        retail, minimum = current("retail_price"), current("min_price")
        if retail is None or minimum is None:
            return
        if minimum > retail:
            raise serializers.ValidationError(
                {"min_price": "Minimal narx chakana narxdan katta bo'lmasligi kerak."}
            )


class ProductLiteSerializer(BranchPricedMixin, serializers.ModelSerializer):
    """Offline katalog sinxronizatsiyasi uchun yengil variant (CLAUDE.md 4.1)."""

    unit = serializers.CharField(source="unit.short_name", read_only=True)
    image_thumb = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id", "name", "sku", "barcode", "unit", "image", "image_thumb",
            "wholesale_price", "retail_price", "min_price",
            "pack_quantity", "is_active", "is_deleted", "updated_at",
        )
        read_only_fields = fields

    def get_image_thumb(self, obj: Product) -> str | None:
        return _primary_thumb_url(obj, self.context)
