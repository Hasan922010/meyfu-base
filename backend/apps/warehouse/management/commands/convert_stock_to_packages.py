"""Eski dona harakatlarini qadoq birligiga o'girib, qoldiqni qayta hisoblash."""
from django.core.management.base import BaseCommand

from apps.warehouse.services.stock import (
    convert_product_prices_to_packages,
    convert_warehouse_history_to_packages,
)


class Command(BaseCommand):
    help = "Eski dona harakatlari va katalog narxlarini qadoq birligiga o'girib qayta hisoblaydi."

    def handle(self, *args, **options):
        res = convert_warehouse_history_to_packages()
        prices = convert_product_prices_to_packages()
        self.stdout.write(
            self.style.SUCCESS(
                f"Qayta hisoblandi: {res['products']} ta mahsulot, "
                f"{res['movements']} ta harakat, {prices} ta narx."
            )
        )
