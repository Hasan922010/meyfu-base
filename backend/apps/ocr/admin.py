from django.contrib import admin

from .models import InvoiceScan, InvoiceScanLine, InvoiceScanPage


class InvoiceScanPageInline(admin.TabularInline):
    model = InvoiceScanPage
    extra = 0


class InvoiceScanLineInline(admin.TabularInline):
    model = InvoiceScanLine
    extra = 0
    readonly_fields = ("raw_name", "raw_quantity", "raw_price", "match_status",
                       "match_confidence")


@admin.register(InvoiceScan)
class InvoiceScanAdmin(admin.ModelAdmin):
    list_display = (
        "created_at", "detected_invoice_number", "supplier", "status",
        "provider", "confidence", "cost_usd", "line_count",
    )
    list_filter = ("status", "provider", "scan_type")
    search_fields = ("detected_invoice_number", "detected_supplier_name")
    inlines = [InvoiceScanPageInline, InvoiceScanLineInline]
    readonly_fields = (
        "uploaded_by", "raw_text", "ai_response", "confidence", "provider",
        "tokens_used", "cost_usd", "processing_time_ms", "image_hash",
        "purchase", "confirmed_at",
    )
    date_hierarchy = "created_at"
