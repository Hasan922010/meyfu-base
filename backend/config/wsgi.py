import os

from django.core.wsgi import get_wsgi_application

from env_bootstrap import apply_settings_module

apply_settings_module()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

application = get_wsgi_application()
