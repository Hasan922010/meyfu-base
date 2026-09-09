#!/usr/bin/env bash
# Oddiy sir skaneri — commitdan oldin ishlating yoki pre-commit hook sifatida:
#   ln -sf ../../scripts/check-secrets.sh .git/hooks/pre-commit
#
# Kuzatuvdagi (yoki staged) fayllarda haqiqiy sirga o'xshash qiymatlarni qidiradi.
# To'liq yechim emas — asosiy nazorat: sirlar faqat .env (git'siz).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Tekshiriladigan fayllar: staged bo'lsa o'shalar, aks holda hammasi
if git diff --cached --quiet 2>/dev/null; then
  FILES="$(git ls-files)"
else
  FILES="$(git diff --cached --name-only --diff-filter=ACM)"
fi

FAIL=0
report() { echo "❌ $1"; FAIL=1; }

for f in $FILES; do
  [ -f "$f" ] || continue
  case "$f" in
    *.png|*.jpg|*.jpeg|*.gif|*.pdf|*.ttf|*.woff*|*.ico|*.lock|*.min.js) continue ;;
  esac

  # Telegram bot token: <8-10 raqam>:<35 belgi>
  if grep -Eq '\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b' "$f"; then
    report "$f: Telegram bot token shakli"
  fi
  # AWS access key
  if grep -Eq '\bAKIA[0-9A-Z]{16}\b' "$f"; then
    report "$f: AWS access key ID shakli"
  fi
  # PEM/private key
  if grep -q 'BEGIN [A-Z ]*PRIVATE KEY' "$f"; then
    report "$f: private key blok"
  fi
  # .env.example — SECRET/TOKEN/PASSWORD qatorlarida uzun qiymat
  case "$f" in
    *.env.example)
      if grep -En '(SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY)[A-Z_]*=[^[:space:]#"'"'"']{20,}' "$f" \
         | grep -Eiv 'change-me|your-|example|placeholder|insecure|dev-|replace|<' >/dev/null; then
        report "$f: namuna faylda haqiqiy sirga o'xshash qiymat"
      fi
      ;;
  esac
done

if [ "$FAIL" -ne 0 ]; then
  echo
  echo "Sir topildi — commit to'xtatildi. Sirlarni .env (git'siz) ga ko'chiring."
  exit 1
fi
echo "✅ Sir topilmadi"
