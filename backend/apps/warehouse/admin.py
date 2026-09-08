from django.contrib import admin

from apps.core.admin import AppendOnlyAdmin

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


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "address", "is_active")
    search_fields = ("name",)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "inn", "is_active")
    search_fields = ("name", "phone", "inn")


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("product", "warehouse", "quantity", "reserved_quantity")
    list_filter = ("warehouse",)
    search_fields = ("product__name", "product__sku")
    readonly_fields = ("quantity", "reserved_quantity")

    def has_add_permission(self, request) -> bool:
        return False


@admin.register(StockMovement)
class StockMovementAdmin(AppendOnlyAdmin):
    list_display = (
        "created_at", "movement_type", "product", "warehouse",
        "quantity", "balance_after", "user",
    )
    list_filter = ("movement_type", "warehouse")
    search_fields = ("product__name", "product__sku", "reference_id")
    date_hierarchy = "created_at"


class PurchaseItemInline(admin.TabularInline):
    model = PurchaseItem
    extra = 0
    autocomplete_fields = ("product",)
    readonly_fields = ("amount",)


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = (
        "number", "supplier", "warehouse", "date", "status",
        "total_amount", "paid_amount", "debt_amount",
    )
    list_filter = ("status", "source", "warehouse")
    search_fields = ("number", "invoice_number", "supplier__name")
    inlines = [PurchaseItemInline]
    autocomplete_fields = ("supplier", "warehouse")

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.status == "CONFIRMED":
            return [f.name for f in self.model._meta.fields]
        return ("number", "total_amount", "debt_amount", "confirmed_at")


class LoadingItemInline(admin.TabularInline):
    model = LoadingItem
    extra = 0
    autocomplete_fields = ("product",)
    readonly_fields = ("amount",)


@admin.register(Loading)
class LoadingAdmin(admin.ModelAdmin):
    list_display = (
        "number", "distributor", "warehouse", "date", "status",
        "total_amount", "confirmed_at",
    )
    list_filter = ("status", "warehouse")
    search_fields = ("number", "distributor__full_name")
    inlines = [LoadingItemInline]
    autocomplete_fields = ("distributor", "warehouse")
    readonly_fields = ("number", "total_amount", "sent_at", "confirmed_at")


@admin.register(VanStock)
class VanStockAdmin(admin.ModelAdmin):
    list_display = ("distributor", "product", "quantity", "updated_at")
    list_filter = ("distributor",)
    search_fields = ("product__name", "product__sku", "distributor__full_name")
    readonly_fields = ("quantity",)

    def has_add_permission(self, request) -> bool:
        return False
