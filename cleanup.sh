#!/bin/bash
set -euo pipefail

APP_ROOT="$HOME/.hiretrack"
PM2_APP_PATTERN="hiretrack"

echo "🧹 Starting safe cleanup..."
echo "--------------------------------------------------"

echo "🔎 Searching for backup.sh from root..."
BACKUP_SCRIPT=$(find / \
    -path /proc -prune -o -path /sys -prune -o -path /dev -prune -o -path /run -prune -o \
    -path /var/lib/docker -prune -o -type f -name 'backup.sh' -print -quit 2>/dev/null || true)

if [ -n "$BACKUP_SCRIPT" ]; then
    echo "📍 Found backup script at: $BACKUP_SCRIPT"
    echo "🔐 Making it executable..."
    chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true

    echo "▶️ Running backup.sh (will not stop cleanup on non-zero exit)..."
    if bash "$BACKUP_SCRIPT"; then
        echo "✅ backup.sh completed successfully."
    else
        echo "⚠️ backup.sh exited with a non-zero status; continuing cleanup."
    fi
else
    echo "⚠️ No backup.sh found from root, skipping backup step."
fi

# ------------------------------------------------
# 1. Selective Cleanup of .hiretrack
# ------------------------------------------------
if [ -d "$APP_ROOT" ]; then
    echo "📁 Cleaning application data (keeping backups, assets, and configs)..."

    TMP_DIR=$(mktemp -d)
    mkdir -p "$TMP_DIR/backups" "$TMP_DIR/assets"

    # Preserve key data
    [ -d "$APP_ROOT/backups" ] && cp -r "$APP_ROOT/backups" "$TMP_DIR/"
    [ -d "$APP_ROOT/assets" ] && cp -r "$APP_ROOT/assets" "$TMP_DIR/"
    [ -f "$APP_ROOT/config.json" ] && cp "$APP_ROOT/config.json" "$TMP_DIR/"
    [ -f "$APP_ROOT/license.json" ] && cp "$APP_ROOT/license.json" "$TMP_DIR/"

    # Remove all except preserved files
    find "$APP_ROOT" -mindepth 1 -maxdepth 1 \
        ! -name "backups" \
        ! -name "assets" \
        ! -name "config.json" \
        ! -name "license.json" \
        -exec rm -rf {} +

    # Restore preserved data (ensures safe copy)
    cp -r "$TMP_DIR/"* "$APP_ROOT/" 2>/dev/null || true
    rm -rf "$TMP_DIR"

    echo "✅ Cleanup done. (backups, assets, config.json, license.json preserved)"
else
    echo "⚠️ No .hiretrack directory found, skipping file cleanup."
fi

# ------------------------------------------------
# 2. PM2 Process Cleanup (keep PM2 installed)
# ------------------------------------------------
if command -v pm2 >/dev/null 2>&1; then
    echo "🧩 Checking PM2 processes..."
    PM2_MATCHING_APPS=$(pm2 list | awk '/hiretrack-/ {print $2}' || true)

    if [ -n "$PM2_MATCHING_APPS" ]; then
        echo "⏹ Stopping and deleting PM2 apps starting with 'hiretrack-'..."
        for app in $PM2_MATCHING_APPS; do
            echo "   → Removing $app ..."
            pm2 stop "$app" >/dev/null 2>&1 || true
            pm2 delete "$app" >/dev/null 2>&1 || true
        done
        pm2 save >/dev/null 2>&1 || true
        echo "✅ All 'hiretrack-*' PM2 apps stopped and removed."
    else
        echo "✅ No 'hiretrack-*' PM2 processes found."
    fi
else
    echo "⚠️ PM2 not installed, skipping process cleanup."
fi


echo "--------------------------------------------------"
echo "✨ Cleanup completed successfully!"
echo "--------------------------------------------------"