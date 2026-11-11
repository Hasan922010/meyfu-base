"""Zaxiralash va tiklash (Backup & Restore) testlari — CLAUDE.md 16, 7.7."""
from __future__ import annotations

import io
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.services.backup import (
    BackupError,
    create_backup,
    delete_backup,
    list_backups,
    restore_backup,
    save_uploaded_backup,
    validate_backup_filename,
)
from apps.users.constants import Role

User = get_user_model()


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        phone="+998900000001",
        password="test-password-123",
        role=Role.SUPER_ADMIN,
        full_name="Bosh Admin",
    )


@pytest.fixture
def manager(db):
    return User.objects.create_user(
        phone="+998900000002",
        password="test-password-123",
        role=Role.MANAGER,
        full_name="Menejer",
    )


@pytest.fixture
def distributor(db):
    return User.objects.create_user(
        phone="+998900000003",
        password="test-password-123",
        role=Role.DISTRIBUTOR,
        full_name="Tarqatuvchi",
    )


@pytest.mark.django_db
def test_create_and_list_backup(superuser):
    """Zaxira nusxasi yaratilishi va ro'yxatda to'g'ri ko'rinishi."""
    meta = create_backup(
        format_type="json",
        note="Test backup izohi",
        user=superuser,
    )
    assert meta["filename"].endswith(".json.gz")
    assert meta["format"] == "json"
    assert meta["size_bytes"] > 0
    assert meta["is_safety"] is False
    assert meta["note"] == "Test backup izohi"

    backups = list_backups()
    assert len(backups) >= 1
    found = next((b for b in backups if b["filename"] == meta["filename"]), None)
    assert found is not None
    assert found["checksum_sha256"] == meta["checksum_sha256"]
    assert found["valid"] is True


@pytest.mark.django_db
def test_restore_backup_with_auto_safety(superuser):
    """Zaxiradan tiklashda avtomatik himoya nusxasi yaratilishi va muvaffaqiyatli tiklanishi."""
    # Dastlabki backup
    b1 = create_backup(format_type="json", note="Boshlang'ich holat")

    # Yangi obyekt qo'shamiz
    User.objects.create_user(
        phone="+998909999999",
        password="extra-password",
        role=Role.DISTRIBUTOR,
        full_name="Qo'shimcha Xodim",
    )
    assert User.objects.filter(phone="+998909999999").exists()

    # Tiklash
    result = restore_backup(b1["filename"], user=superuser, create_safety=True)
    assert result["success"] is True
    assert result["restored_file"] == b1["filename"]
    assert result["safety_backup"] is not None
    assert result["safety_backup"].startswith("safety_")

    # Himoya zaxirasi saqlanganini va tiklashdan keyin qo'shilgan xodim o'chganini tekshirish
    assert not User.objects.filter(phone="+998909999999").exists()
    backups = list_backups()
    safety_found = any(b["filename"] == result["safety_backup"] for b in backups)
    assert safety_found is True


@pytest.mark.django_db
def test_restore_sqlite_binary_backup_replaces_file_atomically(tmp_path, settings, monkeypatch):
    """Binary .sqlite3.gz zaxiradan tiklash faylli SQLite bazasini atomik almashtiradi."""
    import gzip
    import sqlite3
    from types import SimpleNamespace

    from apps.core.services import backup as backup_mod

    settings.BACKUP_DIR = tmp_path
    src_db = tmp_path / "source.sqlite3"
    dest_db = tmp_path / "active.sqlite3"

    con = sqlite3.connect(str(src_db))
    con.execute("CREATE TABLE demo (id INTEGER PRIMARY KEY, val TEXT)")
    con.execute("INSERT INTO demo (val) VALUES ('zaxira_holati')")
    con.commit()
    con.close()

    gz_path = tmp_path / "binary_snap.sqlite3.gz"
    with src_db.open("rb") as f_in, gzip.open(gz_path, "wb") as f_out:
        f_out.write(f_in.read())

    # Active DB boshqa ma'lumot bilan + WAL/SHM qoldiqlari bilan
    con2 = sqlite3.connect(str(dest_db))
    con2.execute("CREATE TABLE demo (id INTEGER PRIMARY KEY, val TEXT)")
    con2.execute("INSERT INTO demo (val) VALUES ('keyingi_holat')")
    con2.commit()
    con2.close()
    (tmp_path / "active.sqlite3-wal").write_bytes(b"stale-wal")
    (tmp_path / "active.sqlite3-shm").write_bytes(b"stale-shm")

    monkeypatch.setitem(settings.DATABASES["default"], "NAME", str(dest_db))
    monkeypatch.setattr(backup_mod, "connections", SimpleNamespace(close_all=lambda: None))
    monkeypatch.setattr(
        backup_mod,
        "connection",
        SimpleNamespace(vendor="sqlite", ensure_connection=lambda: None),
    )

    res = restore_backup("binary_snap.sqlite3.gz", create_safety=False)
    assert res["success"] is True

    restored_con = sqlite3.connect(str(dest_db))
    rows = restored_con.execute("SELECT val FROM demo").fetchall()
    restored_con.close()
    assert rows == [("zaxira_holati",)]
    assert not (tmp_path / "active.sqlite3-wal").exists()
    assert not (tmp_path / "active.sqlite3-shm").exists()


def test_restore_postgres_sql_uses_on_error_stop_and_single_transaction(tmp_path, monkeypatch):
    """PostgreSQL SQL tiklashda ON_ERROR_STOP=1 va --single-transaction bayroqlari uzatiladi."""
    import gzip

    from apps.core.services import backup as backup_mod

    sql_gz = tmp_path / "pg_dump.sql.gz"
    with gzip.open(sql_gz, "wb") as gz:
        gz.write(b"-- SQL dump\nSELECT 1;\n")

    captured: dict = {}

    class CaptureStream(io.BytesIO):
        def close(self):
            captured["sql_bytes"] = self.getvalue()
            super().close()

    class DummyProc:
        returncode = 0

        def __init__(self, cmd, **_kwargs):
            captured["cmd"] = cmd
            self.stdin = CaptureStream()

        def communicate(self):
            return b"", b""

    monkeypatch.setattr(backup_mod.shutil, "which", lambda _name: "/usr/bin/psql")
    monkeypatch.setattr(backup_mod.subprocess, "Popen", DummyProc)

    backup_mod._restore_postgres_sql(sql_gz)

    cmd = captured["cmd"]
    assert "-v" in cmd
    idx = cmd.index("-v")
    assert cmd[idx + 1] == "ON_ERROR_STOP=1"
    assert "--single-transaction" in cmd
    assert b"SELECT 1;" in captured["sql_bytes"]



@pytest.mark.django_db
def test_delete_backup(superuser):
    """Zaxira faylini o'chirish."""
    b = create_backup(format_type="json", note="O'chiriladigan")
    filename = b["filename"]

    assert any(x["filename"] == filename for x in list_backups())
    deleted = delete_backup(filename, user=superuser)
    assert deleted is True
    assert not any(x["filename"] == filename for x in list_backups())


def test_path_traversal_prevention():
    """Path traversal (../) hujumlarini rad etish."""
    with pytest.raises(BackupError):
        validate_backup_filename("../../../etc/passwd")

    with pytest.raises(BackupError):
        validate_backup_filename("..\\..\\windows\\win.ini")

    with pytest.raises(BackupError):
        validate_backup_filename("subfolder/file.sql.gz")

    with pytest.raises(BackupError):
        validate_backup_filename("invalid*name.sql.gz")


@pytest.mark.django_db
def test_upload_backup(superuser):
    """Tashqi zaxira faylini yuklash va metadatasini olish."""
    content = b"fake-gzip-data-header"
    uploaded = io.BytesIO(content)
    uploaded.name = "export_2026.json"

    meta = save_uploaded_backup(uploaded, user=superuser)
    assert "upload_" in meta["filename"]
    assert meta["size_bytes"] == len(content)


@pytest.mark.django_db
def test_api_backup_permissions(superuser, manager, distributor):
    """Rol ruxsatlari: SUPER_ADMIN hammasini, MANAGER faqat ko'rishni, DISTRIBUTOR esa kira olmasligini tekshirish."""
    client = APIClient()

    # 1. Distributordan rad etish (403)
    client.force_authenticate(user=distributor)
    res = client.get(reverse("v1:backup-list"))
    assert res.status_code == 403

    # 2. Menejer faqat ko'ra oladi (GET 200, POST 403)
    client.force_authenticate(user=manager)
    res_get = client.get(reverse("v1:backup-list"))
    assert res_get.status_code == 200
    res_post = client.post(reverse("v1:backup-create"), {"format": "json"})
    assert res_post.status_code == 403

    # 3. Super admin hammasini bajara oladi
    client.force_authenticate(user=superuser)
    res_create = client.post(reverse("v1:backup-create"), {"format": "json", "note": "API orqali"})
    assert res_create.status_code == 201
    created_file = res_create.data["data"]["filename"]

    # Ro'yxatda bor
    res_list = client.get(reverse("v1:backup-list"))
    assert res_list.status_code == 200
    assert any(b["filename"] == created_file for b in res_list.data["data"])

    # Yuklab olish
    res_dl = client.get(reverse("v1:backup-download", kwargs={"filename": created_file}))
    assert res_dl.status_code == 200
    res_dl.close()

    # Tiklash
    res_res = client.post(reverse("v1:backup-restore", kwargs={"filename": created_file}), {"create_safety": True})
    assert res_res.status_code == 200
    assert res_res.data["data"]["success"] is True

    # O'chirish
    res_del = client.delete(reverse("v1:backup-delete", kwargs={"filename": created_file}))
    assert res_del.status_code == 200


@pytest.mark.django_db
def test_scheduled_backup_task_failure_alert():
    """Tungi avtomatik backup task xato berganda adminga xabar yuborilishi (CLAUDE.md 16)."""
    from apps.core.tasks import scheduled_backup_task

    with patch("apps.core.services.backup.create_backup", side_effect=Exception("Disk to'lgan")):
        with patch("apps.notifications.services.notify_admins") as mock_notify:
            with patch("realtime.broadcast.broadcast") as mock_broadcast:
                with pytest.raises(Exception, match="Disk to'lgan"):
                    scheduled_backup_task()

                assert mock_notify.called
                call_args = mock_notify.call_args[1]
                assert call_args["type"] == "backup.failed"
                assert "Zaxira nusxa" in call_args["title"]
                assert mock_broadcast.called
