#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/frontend"
DST_DIR="${ROOT_DIR}/artifacts/meyfu-app"

usage() {
  echo "Usage: $0 [--sync|--check]" >&2
  exit 2
}

MODE="${1:---sync}"
case "$MODE" in
  --sync)
    rsync -a --delete "${SRC_DIR}/src/" "${DST_DIR}/src/"
    rsync -a --delete "${SRC_DIR}/public/" "${DST_DIR}/public/"
    diff -rq "${SRC_DIR}/src" "${DST_DIR}/src"
    diff -rq "${SRC_DIR}/public" "${DST_DIR}/public"
    echo "Synced frontend/{src,public} -> artifacts/meyfu-app/{src,public}"
    ;;
  --check)
    diff -rq "${SRC_DIR}/src" "${DST_DIR}/src"
    diff -rq "${SRC_DIR}/public" "${DST_DIR}/public"
    echo "OK: frontend/{src,public} matches artifacts/meyfu-app/{src,public}"
    ;;
  *)
    usage
    ;;
esac

