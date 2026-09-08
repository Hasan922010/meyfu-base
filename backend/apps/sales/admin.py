from django.contrib import admin

from .models import (
    Debt,
    DebtPayment,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
)


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("cost_price", "amount", "profit", "below_min_price")
    autocomplete_fields = ("product",)


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        "number", "date", "distributor", "client", "payment_type",
        "total_amount", "debt_amount", "status", "flagged",
    )
    list_filter = ("status", "flagged", "payment_type", "date")
    search_fields = ("number", "client__name", "distributor__full_name")
    inlines = [SaleItemInline]
    readonly_fields = (
        "number", "total_amount", "paid_amount", "debt_amount",
        "flagged", "flag_reason", "client_uuid", "device_time",
    )
    date_hierarchy = "date"


@admin.register(SaleReturn)
class SaleReturnAdmin(admin.ModelAdmin):
    list_display = ("number", "date", "distributor", "client", "reason",
                    "restock", "total_amount")
    list_filter = ("reason", "restock")
    search_fields = ("number", "client__name")


admin.site.register(SaleReturnItem)


@admin.register(Debt)
class DebtAdmin(admin.ModelAdmin):
    list_display = ("client", "sale", "amount", "paid_amount", "remaining",
                    "status", "due_date")
    list_filter = ("status",)
    search_fields = ("client__name", "sale__number")
    readonly_fields = ("remaining", "status")


@admin.register(DebtPayment)
class DebtPaymentAdmin(admin.ModelAdmin):
    list_display = ("debt", "amount", "payment_type", "collected_by", "date")
    list_filter = ("payment_type", "date")
    search_fields = ("debt__client__name",)
