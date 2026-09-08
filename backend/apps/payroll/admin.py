from django.contrib import admin

from .models import Advance, CommissionRule, Payroll, PayrollDetail


@admin.register(CommissionRule)
class CommissionRuleAdmin(admin.ModelAdmin):
    list_display = ("scope", "percent", "priority", "valid_from", "valid_to",
                    "is_active")
    list_filter = ("scope", "is_active")
    search_fields = ("note",)


class PayrollDetailInline(admin.TabularInline):
    model = PayrollDetail
    extra = 0
    can_delete = False
    readonly_fields = ("sale_item", "role", "beneficiary", "percent", "base_amount",
                       "commission_amount")

    def has_add_permission(self, request, obj=None) -> bool:
        return False


@admin.register(Payroll)
class PayrollAdmin(admin.ModelAdmin):
    list_display = ("distributor", "period", "commission_amount", "final_amount",
                    "status", "approved_by")
    list_filter = ("status", "period")
    search_fields = ("distributor__full_name",)
    date_hierarchy = "period"
    inlines = [PayrollDetailInline]
    readonly_fields = ("approved_by", "approved_at", "paid_at", "calculated_at",
                       "company_expense", "final_amount")


@admin.register(Advance)
class AdvanceAdmin(admin.ModelAdmin):
    list_display = ("distributor", "date", "amount", "payroll")
    list_filter = ("date",)
    search_fields = ("distributor__full_name", "note")
    readonly_fields = ("wallet_transaction_id", "cash_transaction_id", "payroll")
