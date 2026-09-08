from __future__ import annotations

from rest_framework import serializers

from apps.users.constants import Role

from .models import Brand, Category, Product, ProductImage, ProductPrice, Unit


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


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    unit_name = serializers.CharField(source="unit.short_name", read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    image_thumb = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id", "name", "sku", "barcode",
            "category", "category_name", "brand", "brand_name",
            "unit", "unit_name", "image", "images", "image_thumb",
            "cost_price", "wholesale_price", "retail_price", "min_price",
            "pack_quantity", "commission_percent", "min_stock_alert",
            "is_active", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_image_thumb(self, obj: Product) -> str | None:
        return _primary_thumb_url(obj, self.context)

    def validate(self, attrs: dict) -> dict:
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


class ProductLiteSerializer(serializers.ModelSerializer):
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
