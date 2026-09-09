"""SEC-001 — namuna (.env.example) fayllarida haqiqiy sir bo'lmasligi kerak.

Audit topilmasi: `backend/.env.example` da haqiqiy Telegram bot tokeni commit
qilingan edi (dastlabki commitdan beri butun tarixda).
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Bekor qilingan token — hech qachon qaytmasligi kerak (SEC-001)
_LEAKED_TELEGRAM_TOKEN = "***REMOVED***"

# Telegram bot token shakli: <8-10 raqam>:<35 belgi>
_TELEGRAM_TOKEN_RE = re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b")

# Sir bo'lishi mumkin bo'lgan kalitlar
_SECRET_KEY_NAMES = re.compile(
    r"(SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|PRIVATE)", re.IGNORECASE
)

# "Bu haqiqiy sir emas" belgilari
_PLACEHOLDER_HINTS = (
    "change-me", "changeme", "your-", "your_", "xxx", "example", "placeholder",
    "insecure", "dev-", "-dev", "replace", "todo", "<", "demo",
)


def _example_files() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    )
    return [
        REPO_ROOT / line
        for line in out.stdout.splitlines()
        if line.endswith(".env.example")
    ]


def test_example_files_found() -> None:
    files = _example_files()
    assert files, "git kuzatuvidagi .env.example fayl topilmadi"


@pytest.mark.parametrize(
    "path", _example_files(), ids=lambda p: str(p.relative_to(REPO_ROOT))
)
def test_env_example_has_no_real_secret(path: Path) -> None:
    text = path.read_text(encoding="utf-8")

    assert _LEAKED_TELEGRAM_TOKEN not in text, (
        f"{path.name}: bekor qilingan Telegram token qayta paydo bo'ldi (SEC-001)"
    )
    assert not _TELEGRAM_TOKEN_RE.search(text), (
        f"{path.name}: Telegram bot token shakli topildi — namunada bo'sh bo'lsin"
    )

    for lineno, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        if not value or not _SECRET_KEY_NAMES.search(key):
            continue
        low = value.lower()
        if any(hint in low for hint in _PLACEHOLDER_HINTS):
            continue
        # placeholder emas + uzun/tasodifiy ko'rinishli → shubhali
        assert len(value) < 20, (
            f"{path.name}:{lineno}: `{key.strip()}` haqiqiy sirga o'xshaydi "
            f"({len(value)} belgi). Namunada bo'sh yoki 'change-me-...' bo'lsin."
        )
