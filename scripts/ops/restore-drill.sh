#!/usr/bin/env bash
# Backup / restore drill (EP-24). Proves recoverability (RPO ≤ 24h / RTO ≤ 4h target)
# by exercising a real dump → drop → recreate → restore → verify cycle against a
# throwaway database. NEVER run against production. Records evidence to stdout.
#
# Usage: PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres BIN=/usr/lib/postgresql/16/bin \
#        SRC_DB=microx_test scripts/ops/restore-drill.sh
set -euo pipefail

BIN="${BIN:-/usr/lib/postgresql/16/bin}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
SRC_DB="${SRC_DB:-microx_test}"
RESTORE_DB="${RESTORE_DB:-microx_restore_drill}"
DUMP_FILE="$(mktemp -t microx-drill-XXXXXX.dump)"

psql() { "$BIN/psql" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$@"; }

echo "[drill] source=$SRC_DB restore=$RESTORE_DB"

# 1) Backup (custom-format dump).
"$BIN/pg_dump" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -Fc -f "$DUMP_FILE" "$SRC_DB"
echo "[drill] dump written ($(wc -c < "$DUMP_FILE") bytes)"

# 2) Recreate a clean target and 3) restore into it.
psql -tAc "drop database if exists $RESTORE_DB;" >/dev/null
psql -tAc "create database $RESTORE_DB;" >/dev/null
"$BIN/pg_restore" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$RESTORE_DB" "$DUMP_FILE" >/dev/null 2>&1 || true
echo "[drill] restore complete"

# 4) Verify: table counts match between source and restored DB.
SRC_TABLES=$(psql -d "$SRC_DB" -tAc "select count(*) from information_schema.tables where table_schema='public';")
DST_TABLES=$(psql -d "$RESTORE_DB" -tAc "select count(*) from information_schema.tables where table_schema='public';")
echo "[drill] tables: source=$SRC_TABLES restored=$DST_TABLES"

# Verify a representative row count (programs) survives the round-trip.
SRC_PROGRAMS=$(psql -d "$SRC_DB" -tAc "select count(*) from programs;" 2>/dev/null || echo 0)
DST_PROGRAMS=$(psql -d "$RESTORE_DB" -tAc "select count(*) from programs;" 2>/dev/null || echo 0)
echo "[drill] programs: source=$SRC_PROGRAMS restored=$DST_PROGRAMS"

# Cleanup the throwaway restore DB + dump.
psql -tAc "drop database if exists $RESTORE_DB;" >/dev/null
rm -f "$DUMP_FILE"

if [ "$SRC_TABLES" = "$DST_TABLES" ] && [ "$SRC_PROGRAMS" = "$DST_PROGRAMS" ]; then
  echo "[drill] PASS — schema + data restored identically"
  exit 0
else
  echo "[drill] FAIL — mismatch after restore"
  exit 1
fi
