from __future__ import annotations

from celery import shared_task


@shared_task(ignore_result=True)
def process_scan_task(scan_id: str) -> None:
    from .services.scan import process_scan

    process_scan(scan_id)
