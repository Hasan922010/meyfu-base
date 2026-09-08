from django.contrib import admin

from .models import (
    CashHandover,
    DailyReturn,
    DailyReturnItem,
    DayClose,
)


class DailyReturnItemInline(admin.TabularInline):
    model = DailyReturnItem
    extra = 0
    readonly_fields = ("price", "amount")


@admin.register(DailyReturn)
class DailyReturnAdmin(admin.ModelAdmin):
    list_display = ("number", "date", "distributor", "warehouse", "total_amount")
    list_filter = ("date",)
    search_fields = ("number", "distributor__full_name")
    inlines = [DailyReturnItemInline]


@admin.register(CashHandover)
class CashHandoverAdmin(admin.ModelAdmin):
    list_display = ("date", "distributor", "amount", "confirmed", "received_by")
    list_filter = ("confirmed", "date")
    search_fields = ("distributor__full_name",)


@admin.register(DayClose)
class DayCloseAdmin(admin.ModelAdmin):
    list_display = (
        "date", "distributor", "status", "sold_amount",
        "cash_expected", "cash_handed_amount", "cash_difference",
        "stock_difference_qty",
    )
    list_filter = ("status", "date")
    search_fields = ("distributor__full_name",)
    date_hierarchy = "date"
    readonly_fields = [f.name for f in DayClose._meta.fields]

    def has_change_permission(self, request, obj=None) -> bool:
        # CLAUDE.md 7.7 — yopilgan kun faqat SUPER_ADMIN tomonidan (bu yerda ko'rish)
        return request.user.is_superuser
