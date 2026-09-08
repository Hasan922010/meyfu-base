import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("meyfu")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
# `realtime` — Django app emas, alohida ko'rsatamiz
app.autodiscover_tasks(["realtime"])


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:  # pragma: no cover
    print(f"Request: {self.request!r}")
