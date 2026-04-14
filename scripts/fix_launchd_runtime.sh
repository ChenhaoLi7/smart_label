#!/bin/bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${HOME}/pilot_inventory_runtime"
LOG_DIR="${RUNTIME_DIR}/logs"
LAUNCH_DIR="${HOME}/Library/LaunchAgents"
ENV_FILE="${PROJECT_DIR}/server/.env"

mkdir -p "${RUNTIME_DIR}" "${LOG_DIR}" "${LAUNCH_DIR}"

cat > "${RUNTIME_DIR}/autostart-launcher.sh" <<EOF
#!/bin/bash
set -euo pipefail
PROJECT_DIR="${PROJECT_DIR}"
LOG_DIR="${LOG_DIR}"
SCRIPT_PATH="\${PROJECT_DIR}/autostart_services.sh"
{
  echo "[\$(date '+%Y-%m-%d %H:%M:%S')] launchd requested service autostart"
  if [ ! -f "\${SCRIPT_PATH}" ]; then
    echo "Missing script: \${SCRIPT_PATH}"
    exit 1
  fi
  /usr/bin/open -a Terminal "\${SCRIPT_PATH}"
  echo "[\$(date '+%Y-%m-%d %H:%M:%S')] Terminal launch request sent"
} >> "\${LOG_DIR}/autostart-launcher.log" 2>&1
EOF
chmod +x "${RUNTIME_DIR}/autostart-launcher.sh"

if [ -f "${ENV_FILE}" ]; then
  grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=' "${ENV_FILE}" > "${RUNTIME_DIR}/mysql-backup.env"
else
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

cat > "${RUNTIME_DIR}/mysql-backup-launcher.sh" <<'EOF'
#!/bin/bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

RUNTIME_DIR="${HOME}/pilot_inventory_runtime"
LOG_DIR="${RUNTIME_DIR}/logs"
ENV_FILE="${RUNTIME_DIR}/mysql-backup.env"
BACKUP_ROOT="/Volumes/移动硬盘"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE_STAMP="$(date '+%Y%m%d')"
TIME_STAMP="$(date '+%Y%m%d_%H%M%S')"

exec >> "${LOG_DIR}/mysql-backup-run.log" 2>&1

echo "[${TIME_STAMP}] MySQL backup started"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing runtime DB env file: ${ENV_FILE}"
  exit 1
fi

if [ ! -d "${BACKUP_ROOT}" ]; then
  echo "Backup target is not mounted: ${BACKUP_ROOT}"
  exit 1
fi

source "${ENV_FILE}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

if [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ]; then
  echo "DB_USER or DB_NAME is missing in ${ENV_FILE}"
  exit 1
fi

BACKUP_DIR="${BACKUP_ROOT}/PilotInventoryBackup_${DATE_STAMP}/mysql"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIME_STAMP}.sql"
LATEST_FILE="${BACKUP_DIR}/${DB_NAME}_latest.sql"

mkdir -p "${BACKUP_DIR}"

/opt/homebrew/bin/mysqldump \
  -h "${DB_HOST}" \
  -P "${DB_PORT}" \
  -u "${DB_USER}" \
  -p"${DB_PASSWORD:-}" \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  "${DB_NAME}" > "${BACKUP_FILE}"

cp "${BACKUP_FILE}" "${LATEST_FILE}"

find "${BACKUP_ROOT}" \
  -path "*/mysql/${DB_NAME}_*.sql" \
  ! -name "${DB_NAME}_latest.sql" \
  -type f \
  -mtime +"${RETENTION_DAYS}" \
  -delete 2>/dev/null || true

find "${BACKUP_ROOT}" \
  -path "*/mysql" \
  -type d \
  -empty \
  -prune \
  -exec rmdir {} \; 2>/dev/null || true

echo "[${TIME_STAMP}] Backup completed: ${BACKUP_FILE}"
EOF
chmod +x "${RUNTIME_DIR}/mysql-backup-launcher.sh"

cat > "${LAUNCH_DIR}/com.pilot.inventory.autostart.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.pilot.inventory.autostart</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>${RUNTIME_DIR}/autostart-launcher.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd-autostart.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd-autostart.err.log</string>
    <key>WorkingDirectory</key>
    <string>${RUNTIME_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
  </dict>
</plist>
EOF

cat > "${LAUNCH_DIR}/com.pilot.inventory.mysql-backup.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.pilot.inventory.mysql-backup</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>${RUNTIME_DIR}/mysql-backup-launcher.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>0</integer>
      <key>Minute</key>
      <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd-backup.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd-backup.err.log</string>
    <key>WorkingDirectory</key>
    <string>${RUNTIME_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
  </dict>
</plist>
EOF

launchctl unload "${LAUNCH_DIR}/com.pilot.inventory.autostart.plist" 2>/dev/null || true
launchctl unload "${LAUNCH_DIR}/com.pilot.inventory.mysql-backup.plist" 2>/dev/null || true
launchctl load "${LAUNCH_DIR}/com.pilot.inventory.autostart.plist"
launchctl load "${LAUNCH_DIR}/com.pilot.inventory.mysql-backup.plist"

echo "Runtime launchd jobs installed into ${RUNTIME_DIR}"
echo "Autostart plist: ${LAUNCH_DIR}/com.pilot.inventory.autostart.plist"
echo "Backup plist:    ${LAUNCH_DIR}/com.pilot.inventory.mysql-backup.plist"
