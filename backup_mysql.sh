#!/bin/bash

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/server/.env"
DEFAULT_BACKUP_ROOT="/Volumes/移动硬盘"
BACKUP_ROOT="${1:-$DEFAULT_BACKUP_ROOT}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing environment file: $ENV_FILE"
  exit 1
fi

if [ ! -d "$BACKUP_ROOT" ]; then
  echo "❌ Backup target is not mounted: $BACKUP_ROOT"
  echo "   Please connect the external drive first."
  exit 1
fi

DB_HOST="$(grep -m1 '^DB_HOST=' "$ENV_FILE" | cut -d'=' -f2-)"
DB_PORT="$(grep -m1 '^DB_PORT=' "$ENV_FILE" | cut -d'=' -f2-)"
DB_USER="$(grep -m1 '^DB_USER=' "$ENV_FILE" | cut -d'=' -f2-)"
DB_PASSWORD="$(grep -m1 '^DB_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2-)"
DB_NAME="$(grep -m1 '^DB_NAME=' "$ENV_FILE" | cut -d'=' -f2-)"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
  echo "❌ DB_USER or DB_NAME missing in $ENV_FILE"
  exit 1
fi

DATE_STAMP="$(date '+%Y%m%d')"
TIME_STAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_DIR="$BACKUP_ROOT/PilotInventoryBackup_$DATE_STAMP/mysql"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIME_STAMP}.sql"
LATEST_FILE="$BACKUP_DIR/${DB_NAME}_latest.sql"

mkdir -p "$BACKUP_DIR"

echo "🗄️  Backing up MySQL database..."
echo "   Database: $DB_NAME"
echo "   Target:   $BACKUP_FILE"

/opt/homebrew/bin/mysqldump \
  -h "$DB_HOST" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  "$DB_NAME" > "$BACKUP_FILE"

cp "$BACKUP_FILE" "$LATEST_FILE"

find "$BACKUP_ROOT" \
  -path "*/mysql/${DB_NAME}_*.sql" \
  ! -name "${DB_NAME}_latest.sql" \
  -type f \
  -mtime +"$RETENTION_DAYS" \
  -print \
  -delete >/tmp/pilot_mysql_pruned.log 2>/tmp/pilot_mysql_pruned.err || true

find "$BACKUP_ROOT" \
  -path "*/mysql" \
  -type d \
  -empty \
  -prune \
  -exec rmdir {} \; 2>/dev/null || true

echo "✅ Backup completed"
echo "   Saved:  $BACKUP_FILE"
echo "   Latest: $LATEST_FILE"
echo "   Retention: ${RETENTION_DAYS} days"
if [ -s /tmp/pilot_mysql_pruned.log ]; then
  echo "🧹 Removed old backups:"
  cat /tmp/pilot_mysql_pruned.log
fi
ls -lh "$BACKUP_FILE"
