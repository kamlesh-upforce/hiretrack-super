#!/bin/bash
set -e

# ---------------------------------------------
# 📦 Backup Script for .hiretrack (Exclude node_modules)
# ---------------------------------------------

ROOT_DIR="$PWD"
MYAPP_DIR="$ROOT_DIR/.hiretrack"
BACKUP_DIR="$ROOT_DIR/hiretrack-backup"
BACKUP_FILE="$BACKUP_DIR/myapp_backup.tar.gz"

log() {
    echo "[ $(date +"%Y-%m-%d %H:%M:%S") ] $1"
}

install_mongodump() {
    log "⚙️  Installing MongoDB Database Tools (includes mongodump)..."

    # Detect OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -y
            sudo apt-get install -y mongodb-database-tools
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y mongodb-database-tools
        else
            log "❌ Unsupported Linux package manager. Please install mongodump manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew >/dev/null 2>&1; then
            brew tap mongodb/brew
            brew install mongodb-database-tools
        else
            log "❌ Homebrew not found. Please install Homebrew or install mongodump manually."
            exit 1
        fi
    else
        log "❌ Unsupported OS. Please install mongodump manually."
        exit 1
    fi

    if ! command -v mongodump >/dev/null 2>&1; then
        log "❌ Installation failed — mongodump still not found."
        exit 1
    fi

    log "✅ mongodump installed successfully!"
}

# ---------------------------------------------
# 🧩 Pre-checks
# ---------------------------------------------

# Ensure .hiretrack exists
if [ ! -d "$MYAPP_DIR" ]; then
    log "❌ .hiretrack directory not found in root ($ROOT_DIR)"
    exit 1
fi

# Ensure mongodump exists (install if missing)
if ! command -v mongodump >/dev/null 2>&1; then
    log "⚠️  mongodump not found. Attempting to install..."
    install_mongodump
else
    log "✅ mongodump found: $(mongodump --version | head -n 1)"
fi

# ---------------------------------------------
# 🚀 Backup process
# ---------------------------------------------

log "🚀 Starting backup process..."
mkdir -p "$BACKUP_DIR"

log "🔎 Checking for take-snapshot.js in $MYAPP_DIR..."
SNAPSHOT_FILE="$MYAPP_DIR/take-snapshot.js"
if [ ! -f "$SNAPSHOT_FILE" ]; then
    log "❌ take-snapshot.js not found in $MYAPP_DIR"
    exit 1
fi

pushd "$MYAPP_DIR" > /dev/null

log "▶️ Running snapshot script..."
if ! command -v node >/dev/null 2>&1; then
    log "❌ node runtime not found in PATH"
    popd > /dev/null || true
    exit 1
fi

if ! node take-snapshot.js; then
    log "❌ take-snapshot.js failed"
    popd > /dev/null || true
    exit 1
fi

popd > /dev/null
log "✅ Snapshot script completed successfully"

# Step 1: Remove old backup if it exists
if [ -f "$BACKUP_FILE" ]; then
    log "🗑️ Removing old backup file..."
    rm -f "$BACKUP_FILE"
fi

# Step 2: Create tar.gz backup excluding node_modules
log "📦 Creating backup (excluding node_modules)..."
tar --exclude='*/node_modules' -czf "$BACKUP_FILE" -C "$ROOT_DIR" ".hiretrack"

# Step 3: Confirm
log "✅ Backup created successfully!"
log "📁 Backup file: $BACKUP_FILE"
log "🎉 Done!"
