from django.contrib import admin

from .models import (
    Brand,
    Category,
    Product,
    ProductAlias,
    ProductImage,
    ProductPrice,
    Unit,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")
    search_fields = ("name",)


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("name", "short_name")
    search_fields = ("name", "short_name")


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    fields = ("image", "thumbnail", "sort_order", "is_primary")
    readonly_fields = ("thumbnail",)


class ProductPriceInline(admin.TabularInline):
    model = ProductPrice
    extra = 0
    can_delete = False
    readonly_fields = (
        "cost_price", "wholesale_price", "retail_price", "min_price",
        "effective_from", "reason",
    )

    def has_add_permission(self, request, obj=None) -> bool:
        return False


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name", "sku", "category", "brand", "unit",
        "cost_price", "retail_price", "min_price", "is_active",
    )
    list_filter = ("is_active", "category", "brand")
    search_fields = ("name", "sku", "barcode")
    inlines = [ProductImageInline, ProductPriceInline]
    autocomplete_fields = ("category", "brand", "unit")


@admin.register(ProductPrice)
class ProductPriceAdmin(admin.ModelAdmin):
    list_display = (
        "product", "effective_from", "cost_price", "retail_price", "min_price",
    )
    list_filter = ("effective_from",)
    search_fields = ("product__name", "product__sku")

    def has_change_permission(self, request, obj=None) -> bool:
        return False


@admin.register(ProductAlias)
class ProductAliasAdmin(admin.ModelAdmin):
    list_display = ("alias_text", "product", "supplier", "hit_count")
    list_filter = ("supplier",)
    search_fields = ("alias_text", "product__name", "product__sku")
    autocomplete_fields = ("product", "supplier")
