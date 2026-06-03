#!/bin/bash

set -euo pipefail

export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
AI_DIR="$SCRIPT_DIR/ai_service"
FRONTEND_DIR="$SCRIPT_DIR/dynamic-label-front"
LOG_DIR="$SCRIPT_DIR/logs"
BOOT_LOG="$LOG_DIR/autostart.log"

mkdir -p "$LOG_DIR"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" | tee -a "$BOOT_LOG"
}

is_port_in_use() {
  local port=$1
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

ensure_prerequisites() {
  if ! command -v node >/dev/null 2>&1; then
    log "Node.js not found in PATH: $PATH"
    exit 1
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    log "Python 3 not found in PATH: $PATH"
    exit 1
  fi
}

start_backend() {
  if is_port_in_use 3000; then
    log "Backend already listening on 3000"
    return
  fi

  log "Starting backend..."
  cd "$SERVER_DIR"
  nohup env HOST=0.0.0.0 npm start >> "$LOG_DIR/backend.log" 2>&1 &
}

start_ai() {
  if is_port_in_use 8000; then
    log "AI service already listening on 8000"
    return
  fi

  log "Starting AI service..."
  cd "$AI_DIR"
  nohup "$AI_DIR/venv/bin/python" app.py >> "$LOG_DIR/ai.log" 2>&1 &
}

start_frontend() {
  if is_port_in_use 8080; then
    log "Frontend already listening on 8080"
    return
  fi

  log "Starting frontend..."
  cd "$FRONTEND_DIR"
  nohup npm run serve -- --host 0.0.0.0 --port 8080 --skip-plugins @vue/cli-plugin-eslint >> "$LOG_DIR/frontend.log" 2>&1 &
}

ensure_prerequisites
log "Autostart script triggered"
start_backend
sleep 3
start_ai
sleep 3
start_frontend
log "Autostart routine finished"
