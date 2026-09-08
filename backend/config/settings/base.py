"""Umumiy sozlamalar — barcha muhitlar uchun asos."""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, []),
    USE_S3=(bool, False),
    BUSINESS_DAY_START_HOUR=(int, 6),
    JWT_ACCESS_TOKEN_LIFETIME_MIN=(int, 15),
    JWT_REFRESH_TOKEN_LIFETIME_DAYS=(int, 7),
)

# .env faylni o'qish (mavjud bo'lsa)
env_file = BASE_DIR / ".env"
if env_file.exists():
    env.read_env(str(env_file))

SECRET_KEY = env("SECRET_KEY", default="insecure-dev-key-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# --- Ilovalar ---
DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "channels",
]

LOCAL_APPS = [
    "apps.core",
    "apps.users",
    "apps.catalog",
    "apps.warehouse",
    "apps.clients",
    "apps.sales",
    "apps.orders",
    "apps.dayclose",
    "apps.wallet",
    "apps.expenses",
    "apps.finance",
    "apps.reports",
    "apps.notifications",
    "apps.telegram_bot",
    "apps.ocr",
    "apps.payroll",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Ma'lumotlar bazasi ---
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default="postgres://meyfu:meyfu@localhost:5432/meyfu",
    ),
}
DATABASES["default"]["ATOMIC_REQUESTS"] = False
DATABASES["default"]["CONN_MAX_AGE"] = 60

# --- Redis: cache + channel layer ---
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# --- Celery ---
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TIMEZONE = env("TIME_ZONE", default="Asia/Tashkent")
CELERY_TASK_TRACK_STARTED = True
_crontab = None
try:  # crontab faqat celery mavjud bo'lganda
    from celery.schedules import crontab as _crontab
except ImportError:  # pragma: no cover
    pass

CELERY_BEAT_SCHEDULE: dict = {
    "dashboard-tick": {
        "task": "realtime.tasks.dashboard_tick",
        "schedule": 30.0,  # 30 soniya (CLAUDE.md 11)
    },
    "check-overdue-debts": {
        "task": "realtime.tasks.check_overdue_debts",
        "schedule": 3600.0,  # har soatda
    },
}
if _crontab is not None:
    # Vaqtlar UTC da (Asia/Tashkent = UTC+5)
    CELERY_BEAT_SCHEDULE.update({
        "integrity-check-nightly": {  # 02:30 Asia/Tashkent — backupdan keyin
            "task": "apps.core.tasks.check_integrity",
            "schedule": _crontab(hour=21, minute=30),
        },
        "telegram-daily-digest": {  # 20:00 Asia/Tashkent
            "task": "apps.telegram_bot.tasks.daily_digest",
            "schedule": _crontab(hour=15, minute=0),
        },
        "telegram-morning-loading": {  # 08:00 Asia/Tashkent
            "task": "apps.telegram_bot.tasks.morning_loading_reminder",
            "schedule": _crontab(hour=3, minute=0),
        },
        "telegram-evening-dayclose": {  # 21:00 Asia/Tashkent
            "task": "apps.telegram_bot.tasks.evening_dayclose_reminder",
            "schedule": _crontab(hour=16, minute=0),
        },
    })

# --- Auth ---
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_RENDERER_CLASSES": (
        ["rest_framework.renderers.JSONRenderer"]
        + (
            ["rest_framework.renderers.BrowsableAPIRenderer"]
            if DEBUG
            else []
        )
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/min",
        "user": "1000/min",
        "login": "10/min",
        "ocr": "20/min",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_TOKEN_LIFETIME_MIN")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_TOKEN_LIFETIME_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Distribution & Sales Management System API",
    "DESCRIPTION": "Maishiy kimyo mahsulotlari tarqatish va sotuv boshqaruv tizimi.",
    "VERSION": "1.0.0-mvp",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "ENUM_NAME_OVERRIDES": {
        "PaymentTypeEnum": "apps.sales.constants.PaymentType",
        # "status" maydoni ko'p modelda — har birini alohida nomlaymiz
        "SaleStatusEnum": "apps.sales.constants.SaleStatus",
        "DebtStatusEnum": "apps.sales.constants.DebtStatus",
        "DayCloseStatusEnum": "apps.dayclose.constants.DayCloseStatus",
        "ExpenseStatusEnum": "apps.expenses.constants.ExpenseStatus",
        "PayrollStatusEnum": "apps.payroll.constants.PayrollStatus",
        "PurchaseStatusEnum": "apps.warehouse.constants.PurchaseStatus",
        "LoadingStatusEnum": "apps.warehouse.constants.LoadingStatus",
        "ScanStatusEnum": "apps.ocr.constants.ScanStatus",
        "MatchStatusEnum": "apps.ocr.constants.MatchStatus",
    },
}

# --- CORS ---
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# --- I18N / vaqt ---
LANGUAGE_CODE = "uz"
TIME_ZONE = env("TIME_ZONE", default="Asia/Tashkent")
USE_I18N = True
USE_TZ = True  # barcha vaqtlar UTC saqlanadi

# "Ish kuni" boshlanish soati (CLAUDE.md 5.4)
BUSINESS_DAY_START_HOUR = env("BUSINESS_DAY_START_HOUR")

# --- Telegram bot (CLAUDE.md 15) ---
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
TELEGRAM_BOT_USERNAME = env("TELEGRAM_BOT_USERNAME", default="MeyFuBot")
TELEGRAM_WEBHOOK_SECRET = env("TELEGRAM_WEBHOOK_SECRET", default="dev-webhook-secret")

# --- Naklit OCR (CLAUDE.md 9) ---
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
OCR_MODEL = env("OCR_MODEL", default="claude-opus-5")
OCR_DAILY_COST_LIMIT_USD = env.float("OCR_DAILY_COST_LIMIT_USD", default=5.0)
OCR_MONTHLY_COST_LIMIT_USD = env.float("OCR_MONTHLY_COST_LIMIT_USD", default=100.0)
# $ / 1M token (claude-opus-5). OCR_MODEL o'zgarsa moslang.
OCR_PRICE_INPUT_PER_MTOK = env.float("OCR_PRICE_INPUT_PER_MTOK", default=5.0)
OCR_PRICE_OUTPUT_PER_MTOK = env.float("OCR_PRICE_OUTPUT_PER_MTOK", default=25.0)
OCR_FUZZY_THRESHOLD = env.int("OCR_FUZZY_THRESHOLD", default=85)

# --- Static / media ---
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Backup (CLAUDE.md 16) — tizim salomatligi sahifasi shu papkani kuzatadi ---
BACKUP_DIR = env("BACKUP_DIR", default="/backups")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- S3 / MinIO ---
USE_S3 = env("USE_S3")
if USE_S3:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "access_key": env("AWS_ACCESS_KEY_ID"),
                "secret_key": env("AWS_SECRET_ACCESS_KEY"),
                "bucket_name": env("AWS_STORAGE_BUCKET_NAME"),
                "endpoint_url": env("AWS_S3_ENDPOINT_URL"),
                "custom_domain": env("AWS_S3_CUSTOM_DOMAIN", default=None),
                "file_overwrite": False,
                "querystring_auth": True,
            },
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

# --- Logging (JSON-ga yaqin, 14 kun konteyner darajasida) ---
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.db.backends": {"level": "WARNING"},
        "apps": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
