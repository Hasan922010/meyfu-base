from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import Advance, CommissionRule, Payroll, PayrollDetail

_MONEY = {"max_digits": 14, "decimal_places": 2}


class CommissionRuleSerializer(serializers.ModelSerializer):
    scope_display = serializers.CharField(source="get_scope_display", read_only=True)

    class Meta:
        model = CommissionRule
        fields = (
            "id", "scope", "scope_display", "target_id", "percent",
            "valid_from", "valid_to", "priority", "is_active", "note",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class AdvanceSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )

    class Meta:
        model = Advance
        fields = (
            "id", "distributor", "distributor_name", "date", "amount", "note",
            "payroll", "created_at",
        )
        read_only_fields = ("id", "distributor_name", "payroll", "created_at")


class AdvanceCreateSerializer(serializers.Serializer):
    distributor = serializers.UUIDField()
    amount = serializers.DecimalField(**_MONEY, min_value=Decimal("0.01"))
    date = serializers.DateField(required=False)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class PayrollDetailSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="sale_item.product.name", read_only=True
    )
    sale_number = serializers.CharField(
        source="sale_item.sale.number", read_only=True
    )
    sale_date = serializers.DateField(source="sale_item.sale.date", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    beneficiary_name = serializers.CharField(
        source="beneficiary.full_name", read_only=True, default=None
    )

    class Meta:
        model = PayrollDetail
        fields = (
            "id", "sale_number", "sale_date", "product_name",
            "role", "role_display", "beneficiary", "beneficiary_name",
            "percent", "base_amount", "commission_amount",
        )


class PayrollSerializer(serializers.ModelSerializer):
    distributor_name = serializers.CharField(
        source="distributor.full_name", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    total_deductions = serializers.DecimalField(
        **_MONEY, read_only=True
    )

    class Meta:
        model = Payroll
        fields = (
            "id", "distributor", "distributor_name", "period",
            "total_sales", "total_profit", "commission_amount",
            "order_commission_amount", "delivery_commission_amount",
            "base_salary", "bonus",
            "deduction_shortage", "deduction_cash_diff", "deduction_expense",
            "reimbursement_expense", "advance", "total_deductions",
            "final_amount", "status", "status_display",
            "approved_by", "approved_at", "paid_at", "calculated_at", "note",
            "created_at",
        )
        read_only_fields = fields


class PayrollWithDetailsSerializer(PayrollSerializer):
    details = PayrollDetailSerializer(many=True, read_only=True)

    class Meta(PayrollSerializer.Meta):
        fields = (*PayrollSerializer.Meta.fields, "details")
        read_only_fields = fields


class PayrollCalculateSerializer(serializers.Serializer):
    distributor = serializers.UUIDField()
    period = serializers.DateField(help_text="oyning istalgan kuni (2026-09-01)")


class PayrollManualSerializer(serializers.Serializer):
    bonus = serializers.DecimalField(**_MONEY, required=False, min_value=Decimal("0"))
    deduction_shortage = serializers.DecimalField(
        **_MONEY, required=False, min_value=Decimal("0")
    )
    deduction_cash_diff = serializers.DecimalField(
        **_MONEY, required=False, min_value=Decimal("0")
    )
    deduction_expense = serializers.DecimalField(
        **_MONEY, required=False, min_value=Decimal("0")
    )
    reimbursement_expense = serializers.DecimalField(
        **_MONEY, required=False, min_value=Decimal("0")
    )
    note = serializers.CharField(required=False, allow_blank=True)
