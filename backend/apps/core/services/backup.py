"""Zaxiralash va tiklash xizmati (Backup & Restore Service) — CLAUDE.md 16, 7.7.

Har qanday muhitda (Docker / Linux / Windows / Local) ishonchli ishlash:
1. PostgreSQL uchun: pg_dump/psql (mavjud bo'lsa) orqali gzipped SQL dump (.sql.gz).
2. Universal rejim: Django serializer orqali gzipped JSON fixture dump (.json.gz).
   Bu ma'lumotlar bazasi turiga (PostgreSQL / SQLite) bog'liq bo'lmagan holda ishlaydi.
3. SQLite uchun: gzipped SQLite dump / fayl nusxasi (.sqlite3.gz).

Xavfsizlik:
- Tiklashdan oldin AVTOMATIK ravishda pre-restore himoya nusxasi (safety snapshot) yaratiladi.
- Fayl nomlari path traversal (../) hujumlariga qarshi qat'iy tekshiriladi.
- Har bir zaxira fayli uchun SHA-256 xesh, hajm va metadata (.meta.json) saqlanadi.
- Barcha amallar AuditLog ga yoziladi.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
from datetime import UTC, datetime
from io import StringIO
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management import call_command
from django.db import connection, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

SAFE_FILENAME_RE = re.compile(r"^[a-zA-Z0-9_\-\.]+$")
SUPPORTED_EXTENSIONS = (".sql.gz", ".json.gz", ".sqlite3.gz", ".sql", ".json")

# Zaxiradan chiqariladigan ephemerik/avto-generatsiya modellar
EXCLUDE_MODELS_FOR_JSON = [
    "contenttypes",
    "auth.permission",
    "sessions.session",
    "users.websocketticket",
]


class BackupError(Exception):
    """Zaxira yaratishdagi xatolik."""


class RestoreError(Exception):
    """Zaxirani tiklashdagi xatolik."""


def get_backup_dir() -> Path:
    """Zaxiralar saqlanadigan jild yo'lini qaytaradi va mavjudligini ta'minlaydi."""
    backup_dir = Path(getattr(settings, "BACKUP_DIR", "/backups"))
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def calculate_sha256(file_path: Path) -> str:
    """Faylning SHA-256 xesh summasini hisoblaydi."""
    sha256 = hashlib.sha256()
    with file_path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def validate_backup_filename(filename: str) -> Path:
    """Fayl nomini tekshiradi va to'liq xavfsiz yo'lni qaytaradi (path traversal oldini olish)."""
    if not filename or not SAFE_FILENAME_RE.match(filename):
        raise BackupError("Yaroqsiz fayl nomi")
    if ".." in filename or "/" in filename or "\\" in filename:
        raise BackupError("Yaroqsiz fayl yo'li (path traversal aniqlandi)")

    backup_dir = get_backup_dir().resolve()
    target_path = (backup_dir / filename).resolve()

    if not str(target_path).startswith(str(backup_dir)):
        raise BackupError("Fayl zaxiralar jildidan tashqarida")

    return target_path


def _save_metadata(
    file_path: Path,
    *,
    format_type: str,
    db_engine: str,
    is_safety: bool,
    note: str = "",
    user: Any = None,
    record_counts: dict[str, int] | None = None,
) -> Path:
    meta_path = file_path.with_name(f"{file_path.name}.meta.json")
    stat = file_path.stat()
    created_at = datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat()
    meta = {
        "filename": file_path.name,
        "size_bytes": stat.st_size,
        "size_mb": round(stat.st_size / (1024 * 1024), 2),
        "created_at": created_at,
        "checksum_sha256": calculate_sha256(file_path),
        "format": format_type,
        "db_engine": db_engine,
        "is_safety": is_safety,
        "note": note,
        "record_counts": record_counts or {},
        "created_by": {
            "id": str(user.id) if user and getattr(user, "id", None) else None,
            "phone": getattr(user, "phone", "") if user else "system",
        },
    }
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return meta_path


def _read_metadata(file_path: Path) -> dict[str, Any]:
    meta_path = file_path.with_name(f"{file_path.name}.meta.json")
    if meta_path.is_file():
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass

    stat = file_path.stat()
    created_dt = datetime.fromtimestamp(stat.st_mtime, tz=UTC)
    filename = file_path.name
    fmt = "sql" if ".sql" in filename else ("json" if ".json" in filename else "sqlite")
    is_safety = filename.startswith("safety_")

    return {
        "filename": filename,
        "size_bytes": stat.st_size,
        "size_mb": round(stat.st_size / (1024 * 1024), 2),
        "created_at": created_dt.isoformat(),
        "checksum_sha256": calculate_sha256(file_path),
        "format": fmt,
        "db_engine": connection.vendor,
        "is_safety": is_safety,
        "note": "",
        "record_counts": {},
        "created_by": None,
    }


def list_backups() -> list[dict[str, Any]]:
    """Mavjud barcha zaxiralar ro'yxatini eng yangisidan boshlab qaytaradi."""
    backup_dir = get_backup_dir()
    results: list[dict[str, Any]] = []

    for path in backup_dir.iterdir():
        if not path.is_file():
            continue
        if path.name.endswith(".meta.json"):
            continue
        if not any(path.name.endswith(ext) for ext in SUPPORTED_EXTENSIONS):
            continue

        meta = _read_metadata(path)
        valid = True
        if path.name.endswith(".gz"):
            try:
                with gzip.open(path, "rb") as gz:
                    gz.read(128)
            except Exception:  # noqa: BLE001
                valid = False

        meta["valid"] = valid
        results.append(meta)

    results.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return results


def rotate_old_backups(keep_days: int = 30, min_keep: int = 3) -> int:
    """Eskirgan oddiy zaxiralarni o'chiradi (himoya nusxalari saqlanadi)."""
    backups = list_backups()
    standard_backups = [b for b in backups if not b.get("is_safety")]
    if len(standard_backups) <= min_keep:
        return 0

    cutoff = timezone.now() - timezone.timedelta(days=keep_days)
    deleted_count = 0

    for b in standard_backups[min_keep:]:
        created_str = b.get("created_at")
        if not created_str:
            continue
        try:
            created_dt = datetime.fromisoformat(created_str)
            if created_dt < cutoff:
                filename = b["filename"]
                delete_backup(filename)
                deleted_count += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("Eski zaxirani o'chirishda ogohlantirish: %s", exc)

    return deleted_count


def _dump_postgres_sql(out_path: Path) -> None:
    """PostgreSQL bazasini pg_dump orqali gzip qilib saqlaydi."""
    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        raise BackupError("pg_dump dasturi topilmadi")

    db_conf = settings.DATABASES["default"]
    env = os.environ.copy()
    if db_conf.get("PASSWORD"):
        env["PGPASSWORD"] = str(db_conf["PASSWORD"])

    cmd = [
        pg_dump,
        "--no-owner",
        "--no-privileges",
    ]
    if db_conf.get("HOST"):
        cmd.extend(["-h", str(db_conf["HOST"])])
    if db_conf.get("PORT"):
        cmd.extend(["-p", str(db_conf["PORT"])])
    if db_conf.get("USER"):
        cmd.extend(["-U", str(db_conf["USER"])])
    if db_conf.get("NAME"):
        cmd.extend(["-d", str(db_conf["NAME"])])

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        with gzip.open(out_path, "wb") as gz_out:
            if proc.stdout is not None:
                shutil.copyfileobj(proc.stdout, gz_out)
        _, stderr = proc.communicate()
        if proc.returncode != 0:
            if out_path.exists():
                out_path.unlink()
            raise BackupError(f"pg_dump xatosi (kod {proc.returncode}): {stderr.decode(errors='replace')}")
    except Exception as exc:
        if out_path.exists():
            out_path.unlink()
        raise BackupError(f"PostgreSQL zaxiralashda xatolik: {exc}") from exc


def _dump_django_json(out_path: Path) -> None:
    """Django serializer orqali barcha ma'lumotlarni gzipped JSON formatda saqlaydi."""
    buf = StringIO()
    call_command(
        "dumpdata",
        format="json",
        indent=2,
        natural_foreign=True,
        natural_primary=True,
        exclude=EXCLUDE_MODELS_FOR_JSON,
        stdout=buf,
    )
    raw_data = buf.getvalue().encode("utf-8")
    with gzip.open(out_path, "wb") as gz_out:
        gz_out.write(raw_data)


def _dump_sqlite(out_path: Path) -> None:
    """SQLite bazasini xavfsiz nusxalaydi va siqadi."""
    db_name = settings.DATABASES["default"]["NAME"]
    if db_name == ":memory:":
        # Xotiradagi baza uchun JSON format ishlatiladi
        _dump_django_json(out_path)
        return

    source_path = Path(db_name)
    if not source_path.is_file():
        # Fayl topilmasa JSON formatiga o'tamiz
        _dump_django_json(out_path)
        return

    with source_path.open("rb") as f_in:
        with gzip.open(out_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)


def create_backup(
    *,
    format_type: str = "auto",
    note: str = "",
    is_safety: bool = False,
    user: Any = None,
) -> dict[str, Any]:
    """Yangi zaxira nusxasi yaratadi.

    format_type:
      - 'auto': Postgres bo'lsa va pg_dump bo'lsa SQL, aks holda JSON
      - 'sql': Faqat SQL dump (.sql.gz)
      - 'json': Universal Django JSON dump (.json.gz)
    """
    backup_dir = get_backup_dir()
    stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    prefix = "safety_" if is_safety else "db_"
    db_engine = connection.vendor

    chosen_format = format_type.lower()
    has_pg_dump = bool(shutil.which("pg_dump"))

    if chosen_format == "auto":
        if db_engine == "postgresql" and has_pg_dump:
            actual_format = "sql"
            ext = ".sql.gz"
        elif db_engine == "sqlite":
            actual_format = "json"
            ext = ".json.gz"
        else:
            actual_format = "json"
            ext = ".json.gz"
    elif chosen_format == "sql":
        actual_format = "sql"
        ext = ".sql.gz"
    elif chosen_format == "sqlite":
        actual_format = "sqlite"
        ext = ".sqlite3.gz"
    else:
        actual_format = "json"
        ext = ".json.gz"

    out_file = backup_dir / f"{prefix}{stamp}{ext}"

    logger.info("Zaxira nusxasi yaratilmoqda: %s (format: %s)", out_file.name, actual_format)

    try:
        if actual_format == "sql":
            _dump_postgres_sql(out_file)
        elif actual_format == "sqlite" and db_engine == "sqlite":
            _dump_sqlite(out_file)
        else:
            _dump_django_json(out_file)

        # Butunlik tekshiruvi
        if not out_file.exists():
            raise BackupError("Zaxira fayli yaratilmadi")

        size = out_file.stat().st_size
        if size < 20:  # Bo'sh gzip taxminan 20-30 bayt
            out_file.unlink(missing_ok=True)
            raise BackupError(f"Zaxira fayli yaroqsiz yoki bo'sh ({size} bayt)")

        # Gzip tekshiruvi
        with gzip.open(out_file, "rb") as gz:
            gz.read(64)

        meta = _read_metadata(out_file)
        meta["format"] = actual_format
        meta["is_safety"] = is_safety
        meta["note"] = note
        _save_metadata(
            out_file,
            format_type=actual_format,
            db_engine=db_engine,
            is_safety=is_safety,
            note=note,
            user=user,
        )

        # Audit yozuvi
        try:
            from apps.core.models import AuditLog

            AuditLog.objects.create(
                user=user if user and getattr(user, "is_authenticated", False) else None,
                action="backup.created",
                changes={
                    "filename": out_file.name,
                    "format": actual_format,
                    "size_bytes": size,
                    "size_mb": meta["size_mb"],
                    "is_safety": is_safety,
                    "note": note,
                },
            )
        except Exception as audit_err:  # noqa: BLE001
            logger.warning("AuditLog ga yozishda ogohlantirish: %s", audit_err)

        # Eski zaxiralarni tozalash (agar oddiy backup bo'lsa)
        if not is_safety:
            rotate_old_backups()

        return meta

    except Exception as exc:
        if out_file.exists():
            out_file.unlink(missing_ok=True)
        logger.exception("Zaxira nusxasini yaratishda xato: %s", exc)
        raise BackupError(f"Zaxira yaratilmadi: {exc}") from exc


def _restore_postgres_sql(file_path: Path) -> None:
    """PostgreSQL SQL dumpini psql orqali tiklaydi."""
    psql = shutil.which("psql")
    if not psql:
        raise RestoreError("psql dasturi topilmadi")

    db_conf = settings.DATABASES["default"]
    env = os.environ.copy()
    if db_conf.get("PASSWORD"):
        env["PGPASSWORD"] = str(db_conf["PASSWORD"])

    cmd = [psql]
    if db_conf.get("HOST"):
        cmd.extend(["-h", str(db_conf["HOST"])])
    if db_conf.get("PORT"):
        cmd.extend(["-p", str(db_conf["PORT"])])
    if db_conf.get("USER"):
        cmd.extend(["-U", str(db_conf["USER"])])
    if db_conf.get("NAME"):
        cmd.extend(["-d", str(db_conf["NAME"])])

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )

    with gzip.open(file_path, "rb") if file_path.name.endswith(".gz") else file_path.open("rb") as f_in:
        shutil.copyfileobj(f_in, proc.stdin)
    proc.stdin.close()

    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        raise RestoreError(f"psql tiklash xatosi (kod {proc.returncode}): {stderr.decode(errors='replace')}")


def _restore_django_json(file_path: Path) -> None:
    """Django loaddata orqali ma'lumotlarni tiklaydi."""
    import tempfile

    # Gzip bo'lsa vaqtinchalik .json faylga ochamiz
    if file_path.name.endswith(".gz"):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            with gzip.open(file_path, "rb") as gz_in:
                shutil.copyfileobj(gz_in, tmp)
    else:
        tmp_path = file_path

    try:
        with transaction.atomic():
            call_command("loaddata", str(tmp_path), ignorenonexistent=True)
    except Exception as exc:
        raise RestoreError(f"loaddata xatosi: {exc}") from exc
    finally:
        if file_path.name.endswith(".gz") and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def restore_backup(
    filename: str,
    *,
    user: Any = None,
    create_safety: bool = True,
) -> dict[str, Any]:
    """Zaxira nusxasidan ma'lumotlarni tiklaydi.

    create_safety=True bo'lsa, tiklashdan oldin avtomatik himoya zaxira nusxasi yaratiladi.
    """
    file_path = validate_backup_filename(filename)
    if not file_path.is_file():
        raise RestoreError(f"Zaxira fayli topilmadi: {filename}")

    # Gzip butunligini oldindan tekshirish
    if filename.endswith(".gz"):
        try:
            with gzip.open(file_path, "rb") as gz:
                gz.read(256)
        except Exception as gz_err:
            raise RestoreError(f"Zaxira fayli shikastlangan (gzip xatosi): {gz_err}") from gz_err

    # 1. Avtomatik pre-restore himoya nusxasi
    safety_meta: dict[str, Any] | None = None
    if create_safety:
        logger.info("Tiklashdan oldingi himoya zaxirasi yaratilmoqda...")
        safety_meta = create_backup(
            format_type="auto",
            note=f"Avtomatik himoya nusxasi — '{filename}' tiklanishidan oldin olindi",
            is_safety=True,
            user=user,
        )

    # 2. Tiklash jarayoni
    logger.info("Tiklash boshlandi: %s", filename)
    db_engine = connection.vendor
    is_sql = ".sql" in filename
    is_json = ".json" in filename

    try:
        if is_sql and db_engine == "postgresql" and shutil.which("psql"):
            _restore_postgres_sql(file_path)
        elif is_json:
            _restore_django_json(file_path)
        else:
            # Agar mos SQL tiklash vositasi bo'lmasa, loaddata orqali urinib ko'rish
            _restore_django_json(file_path)

        # 3. Keshni tozalash
        from django.core.cache import cache

        cache.clear()

        # 4. Butunlik tekshiruvi (integrity check)
        from apps.core.services.integrity import run_integrity_check

        integrity_result = run_integrity_check()

        # 5. AuditLog
        try:
            from apps.core.models import AuditLog

            AuditLog.objects.create(
                user=user if user and getattr(user, "is_authenticated", False) else None,
                action="backup.restored",
                changes={
                    "restored_file": filename,
                    "safety_backup": safety_meta.get("filename") if safety_meta else None,
                    "integrity_ok": integrity_result.get("ok"),
                    "mismatch_count": integrity_result.get("mismatch_count"),
                },
            )
        except Exception as audit_err:  # noqa: BLE001
            logger.warning("AuditLog ga yozishda ogohlantirish: %s", audit_err)

        return {
            "success": True,
            "restored_file": filename,
            "safety_backup": safety_meta.get("filename") if safety_meta else None,
            "integrity": integrity_result,
        }

    except Exception as exc:
        logger.exception("Tiklash muvaffaqiyatsiz bo'ldi: %s", exc)
        raise RestoreError(f"Tiklash muvaffaqiyatsiz: {exc}") from exc


def delete_backup(filename: str, *, user: Any = None) -> bool:
    """Zaxira fayli va uning metadatasini o'chiradi."""
    file_path = validate_backup_filename(filename)
    if not file_path.is_file():
        raise BackupError(f"Zaxira fayli topilmadi: {filename}")

    meta_path = file_path.with_name(f"{file_path.name}.meta.json")
    stat = file_path.stat()
    size_bytes = stat.st_size

    file_path.unlink()
    if meta_path.is_file():
        meta_path.unlink()

    try:
        from apps.core.models import AuditLog

        AuditLog.objects.create(
            user=user if user and getattr(user, "is_authenticated", False) else None,
            action="backup.deleted",
            changes={"filename": filename, "size_bytes": size_bytes},
        )
    except Exception as audit_err:  # noqa: BLE001
        logger.warning("AuditLog ga yozishda ogohlantirish: %s", audit_err)

    return True


def save_uploaded_backup(uploaded_file: Any, *, user: Any = None) -> dict[str, Any]:
    """Tashqaridan yuklangan zaxira faylini tekshiradi va saqlaydi."""
    original_name = uploaded_file.name
    if not any(original_name.endswith(ext) for ext in SUPPORTED_EXTENSIONS):
        raise BackupError(
            f"Faqat quyidagi formatdagi zaxira fayllari qabul qilinadi: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    backup_dir = get_backup_dir()
    clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", original_name)
    if not clean_name.startswith(("db_", "safety_", "upload_")):
        clean_name = f"upload_{clean_name}"

    target_path = backup_dir / clean_name
    # Nom takrorlanmasligi uchun
    counter = 1
    stem = target_path.name
    while target_path.exists():
        target_path = backup_dir / f"{counter}_{stem}"
        counter += 1

    with target_path.open("wb") as dest:
        if hasattr(uploaded_file, "chunks"):
            for chunk in uploaded_file.chunks():
                dest.write(chunk)
        else:
            dest.write(uploaded_file.read())

    # Gzip bo'lsa tekshirish
    if target_path.name.endswith(".gz"):
        try:
            with gzip.open(target_path, "rb") as gz:
                gz.read(64)
        except Exception as gz_err:
            target_path.unlink(missing_ok=True)
            raise BackupError(f"Yuklangan fayl noto'g'ri yoki shikastlangan gzip: {gz_err}") from gz_err

    fmt = "sql" if ".sql" in target_path.name else ("json" if ".json" in target_path.name else "sqlite")
    _save_metadata(
        target_path,
        format_type=fmt,
        db_engine=connection.vendor,
        is_safety=False,
        note="Foydalanuvchi tomonidan yuklangan",
        user=user,
    )

    try:
        from apps.core.models import AuditLog

        AuditLog.objects.create(
            user=user if user and getattr(user, "is_authenticated", False) else None,
            action="backup.uploaded",
            changes={"filename": target_path.name, "size_bytes": target_path.stat().st_size},
        )
    except Exception as audit_err:  # noqa: BLE001
        logger.warning("AuditLog ga yozishda ogohlantirish: %s", audit_err)

    return _read_metadata(target_path)
