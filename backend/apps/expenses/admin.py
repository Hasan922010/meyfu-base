from django.contrib import admin

from .models import DistributorExpense, ExpenseCategory, FuelLog


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "paid_by", "requires_receipt", "daily_limit", "is_active")
    list_filter = ("paid_by", "requires_receipt", "is_active")
    search_fields = ("name",)


class FuelLogInline(admin.StackedInline):
    model = FuelLog
    extra = 0


@admin.register(DistributorExpense)
class DistributorExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "date", "distributor", "category", "amount", "payment_source",
        "status", "approved_by",
    )
    list_filter = ("status", "payment_source", "category", "date")
    search_fields = ("distributor__full_name", "description")
    inlines = [FuelLogInline]
    readonly_fields = ("approved_by", "approved_at", "client_uuid", "device_time",
                       "is_deductible")
    date_hierarchy = "date"
