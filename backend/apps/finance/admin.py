from django.contrib import admin

from apps.core.admin import AppendOnlyAdmin

from .models import CashAccount, CashTransaction, CompanyExpense


@admin.register(CashAccount)
class CashAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "balance", "is_active")
    readonly_fields = ("balance",)


@admin.register(CashTransaction)
class CashTransactionAdmin(AppendOnlyAdmin):
    list_display = (
        "created_at", "transaction_type", "amount", "balance_after",
        "counterparty", "reference_type",
    )
    list_filter = ("transaction_type", "date")
    search_fields = ("counterparty", "reference_id", "note")
    date_hierarchy = "date"


@admin.register(CompanyExpense)
class CompanyExpenseAdmin(admin.ModelAdmin):
    list_display = ("date", "category", "amount", "paid_from_cash", "description")
    list_filter = ("category", "paid_from_cash", "date")
    search_fields = ("description",)
    date_hierarchy = "date"
