"""Ma'lumot migratsiyalari uchun barqaror yordamchilar (faqat `apps.get_model` bilan)."""
from __future__ import annotations


def backfill_branch_from_distributor(app_label: str, *model_names: str):
    """Mavjud hujjatlarga tarqatuvchining filialini yozadi (`branch` bo'sh bo'lsa).

    Faqat `is_branch=True` omborlar — markaz hujjatlari `branch=None` qoladi.
    """

    def forwards(apps, schema_editor) -> None:
        Warehouse = apps.get_model("warehouse", "Warehouse")
        branch_ids = list(Warehouse.objects.filter(is_branch=True).values_list("pk", flat=True))
        for name in model_names:
            Model = apps.get_model(app_label, name)
            for branch_id in branch_ids:
                Model.objects.filter(
                    branch__isnull=True, distributor__warehouse_id=branch_id
                ).update(branch_id=branch_id)

    return forwards
