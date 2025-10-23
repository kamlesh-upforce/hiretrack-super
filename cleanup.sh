# #!/bin/bash
# set -euo pipefail

# echo "⚠️ This script will clean up application files, configurations, cron jobs, Node.js, PM2, and Nginx site configurations."
# echo "⚠️ MongoDB and its services will NOT be removed as per your request."
# read -p "Are you sure you want to proceed with the cleanup? (y/N): " confirm
# if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
#     echo "Cleanup aborted."
#     exit 0
# fi

# echo "⚠️ Starting cleanup process..."

# # ------------------------------------------------
# # Configuration Paths
# # ------------------------------------------------
# APP_ROOT="$HOME/.myapp"
# CONFIG_PATH="$HOME/.myapp/config.json"
# PM2_APP_NAME="hiretrack"
# PM2_OTHER_APP_PATTERN="hiretrack-"

# # ------------------------------------------------
# # Check and Remove Application Files
# # ------------------------------------------------
# echo "1. Checking and removing application files in $APP_ROOT..."
# if [ -d "$APP_ROOT" ]; then
#     rm -rf "$APP_ROOT"
#     echo "✅ $APP_ROOT removed."
# else
#     echo "⚠ $APP_ROOT not found, skipping."
# fi

# # ------------------------------------------------
# # Check and Remove PM2 Processes and Configuration
# # ------------------------------------------------
# echo "2. Checking and removing PM2 processes and configurations..."
# if command -v pm2 >/dev/null 2>&1; then
#     echo "   - PM2 is installed, proceeding with cleanup..."
#     # Stop and delete processes matching the patterns
#     pm2 status 2>/dev/null | grep -E "($PM2_APP_NAME|$PM2_OTHER_APP_PATTERN)" | while read -r line ; do
#         APP_ID=$(echo "$line" | awk '{print $1}')
#         APP_NAME=$(echo "$line" | awk '{print $2}')
#         if [[ "$APP_ID" =~ ^[0-9]+$ ]]; then
#             echo "     - Stopping and deleting PM2 app: $APP_NAME (ID: $APP_ID)"
#             pm2 stop "$APP_ID" >/dev/null 2>&1 || true
#             pm2 delete "$APP_ID" >/dev/null 2>&1 || true
#         fi
#     done

#     # Clear PM2 saved list and daemon
#     pm2 unstartup systemd || true
#     pm2 save --force >/dev/null 2>&1 || true
#     pm2 kill >/dev/null 2>&1 || true
#     echo "✅ PM2 processes stopped and configuration cleared."
# else
#     echo "⚠ PM2 not found, skipping PM2 cleanup."
# fi

# # ------------------------------------------------
# # Check and Remove Cron Job
# # ------------------------------------------------
# INSTALLER_SCRIPT_NAME="installer.sh"
# CRON_NAME="hiretrack-autoupdate"

# echo "3. Checking and removing cron job and associated CRON_NAME comments..."
# if crontab -l 2>/dev/null | grep -q -e "$INSTALLER_SCRIPT_NAME --update" -e "# CRON_NAME:$CRON_NAME"; then
#     (crontab -l 2>/dev/null | grep -v -e "$INSTALLER_SCRIPT_NAME --update" -e "# CRON_NAME:$CRON_NAME" || true) | crontab - || true
#     echo "✅ Cron job and CRON_NAME comments removed."
# else
#     echo "⚠ No matching cron jobs found, skipping."
# fi

# # ------------------------------------------------
# # Skip MongoDB Removal
# # ------------------------------------------------
# echo "4. Skipping MongoDB removal as per request."

# # ------------------------------------------------
# # Check and Remove Nginx Site Configuration
# # ------------------------------------------------
# echo "5. Checking and removing Nginx site configurations..."
# if command -v nginx >/dev/null 2>&1; then
#     echo "   - Nginx is installed, proceeding with cleanup..."

#     # Detect OS
#     OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')

#     # Set OS-specific paths
#     if [[ "$OS_TYPE" == "darwin" ]]; then
#         NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
#     else
#         NGINX_CONF_DIR="/etc/nginx/sites-available"
#         NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
#     fi

#     # Get domain name from config.json if it exists
#     DOMAIN_NAME=""
#     if [ -f "$CONFIG_PATH" ] && command -v jq >/dev/null 2>&1; then
#         DOMAIN_NAME=$(jq -r '.serverName // empty' "$CONFIG_PATH" 2>/dev/null || echo "")
#     fi

#     if [ -n "$DOMAIN_NAME" ]; then
#         echo "   - Found domain: $DOMAIN_NAME in $CONFIG_PATH"

#         # Remove Nginx configuration files
#         if [[ "$OS_TYPE" == "linux" ]]; then
#             NGINX_CONF_FILE="$NGINX_CONF_DIR/$DOMAIN_NAME"
#             NGINX_ENABLED_FILE="$NGINX_ENABLED_DIR/$DOMAIN_NAME"
#             if [ -f "$NGINX_CONF_FILE" ]; then
#                 sudo rm -f "$NGINX_CONF_FILE"
#                 echo "   - Removed Nginx config: $NGINX_CONF_FILE"
#             else
#                 echo "   - Nginx config not found: $NGINX_CONF_FILE, skipping."
#             fi
#             if [ -L "$NGINX_ENABLED_FILE" ]; then
#                 sudo rm -f "$NGINX_ENABLED_FILE"
#                 echo "   - Removed Nginx enabled site link: $NGINX_ENABLED_FILE"
#             else
#                 echo "   - Nginx enabled site link not found: $NGINX_ENABLED_FILE, skipping."
#             fi
#         elif [[ "$OS_TYPE" == "darwin" ]]; then
#             NGINX_CONF_FILE="$NGINX_CONF_DIR/$DOMAIN_NAME"
#             if [ -f "$NGINX_CONF_FILE" ]; then
#                 sudo rm -f "$NGINX_CONF_FILE"
#                 echo "   - Removed Nginx config: $NGINX_CONF_FILE"
#             else
#                 echo "   - Nginx config not found: $NGINX_CONF_FILE, skipping."
#             fi
#         fi

#         # Reload Nginx to apply changes
#         if pgrep -x "nginx" >/dev/null; then
#             echo "   - Testing Nginx configuration..."
#             if sudo nginx -t >/dev/null 2>&1; then
#                 echo "   - Reloading Nginx..."
#                 if [[ "$OS_TYPE" == "linux" ]]; then
#                     sudo systemctl reload nginx || true
#                 elif [[ "$OS_TYPE" == "darwin" ]]; then
#                     brew services restart nginx || true
#                 fi
#                 echo "   - Nginx reloaded successfully."
#             else
#                 echo "   ⚠ Nginx configuration test failed, please check manually."
#             fi
#         else
#             echo "   - Nginx not running, skipping reload."
#         fi
#     else
#         echo "   - No domain found in $CONFIG_PATH, skipping Nginx config removal."
#     fi
# else
#     echo "⚠ Nginx not found, skipping Nginx cleanup."
# fi
# echo "✅ Nginx site configurations cleanup complete."

# # ------------------------------------------------
# # Check and Remove Node.js and PM2 Global Install
# # ------------------------------------------------
# echo "6. Checking and removing Node.js and globally installed npm packages (PM2)..."
# if command -v npm >/dev/null 2>&1; then
#     echo "   - Uninstalling PM2 globally..."
#     npm uninstall -g pm2 || true
#     echo "✅ PM2 global uninstall complete."
# else
#     echo "⚠ npm not found, skipping PM2 global uninstall."
# fi

# if command -v node >/dev/null 2>&1; then
#     echo "   - Node.js is installed, proceeding with removal..."
#     if command -v apt-get >/dev/null 2>&1; then
#         echo "   - Removing Node.js via apt..."
#         sudo apt-get purge -y nodejs || true
#         sudo apt-get autoremove -y || true
#         sudo rm -f /etc/apt/sources.list.d/nodesource.list
#         sudo rm -f /etc/apt/sources.list.d/nodesource.list.save
#         echo "✅ Node.js removed."
#     else
#         echo "⚠ Node.js found but installed outside of apt, please remove manually if necessary."
#     fi
# else
#     echo "⚠ Node.js not found, skipping removal."
# fi

# # ------------------------------------------------
# # Check and Remove Less Essential Dependencies (jq)
# # ------------------------------------------------
# echo "7. Checking and removing less essential dependencies (jq)..."
# if command -v apt-get >/dev/null 2>&1 && dpkg -s jq >/dev/null 2>&1; then
#     sudo apt-get purge -y jq || true
#     echo "✅ jq removed."
#     sudo apt-get autoremove -y
#     sudo apt-get update
# else
#     echo "⚠ jq not found or non-APT system, skipping removal."
# fi

# echo "---"
# echo "✅ Cleanup complete. Your test environment is ready for a fresh run of the installer script!"




#!/bin/bash
set -euo pipefail

echo "⚠️ This script will clean up application files, configurations, cron jobs, Node.js, PM2, and Nginx site configurations."
echo "⚠️ MongoDB and its services will NOT be removed as per your request."
read -p "Are you sure you want to proceed with the cleanup? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cleanup aborted."
    exit 0
fi

echo "⚠️ Starting cleanup process..."

# ------------------------------------------------
# Configuration Paths
# ------------------------------------------------
APP_ROOT="$HOME/.myapp"
CONFIG_PATH="$HOME/.myapp/config.json"
PM2_APP_NAME="hiretrack"
PM2_OTHER_APP_PATTERN="hiretrack-"

# ------------------------------------------------
# Check and Remove Application Files
# ------------------------------------------------
echo "1. Checking and removing application files in $APP_ROOT..."
if [ -d "$APP_ROOT" ]; then
    rm -rf "$APP_ROOT"
    echo "✅ $APP_ROOT removed."
else
    echo "⚠ $APP_ROOT not found, skipping."
fi

# ------------------------------------------------
# Check and Remove PM2 Processes and Configuration
# ------------------------------------------------
echo "2. Checking and removing PM2 processes and configurations..."
if command -v pm2 >/dev/null 2>&1; then
    echo "   - PM2 is installed, proceeding with cleanup..."
    # Capture pm2 status output and check for matching processes
    PM2_OUTPUT=$(pm2 status 2>/dev/null | grep -E "($PM2_APP_NAME|$PM2_OTHER_APP_PATTERN)" || true)
    if [ -n "$PM2_OUTPUT" ]; then
        echo "$PM2_OUTPUT" | while read -r line ; do
            APP_ID=$(echo "$line" | awk '{print $1}')
            APP_NAME=$(echo "$line" | awk '{print $2}')
            if [[ "$APP_ID" =~ ^[0-9]+$ ]]; then
                echo "     - Stopping and deleting PM2 app: $APP_NAME (ID: $APP_ID)"
                pm2 stop "$APP_ID" >/dev/null 2>&1 || true
                pm2 delete "$APP_ID" >/dev/null 2>&1 || true
            fi
        done
    else
        echo "     - No matching PM2 processes found."
    fi

    # Clear PM2 saved list and daemon
    pm2 unstartup systemd || true
    pm2 save --force >/dev/null 2>&1 || true
    pm2 kill >/dev/null 2>&1 || true
    echo "✅ PM2 processes stopped and configuration cleared."
else
    echo "⚠ PM2 not found, skipping PM2 cleanup."
fi

# ------------------------------------------------
# Check and Remove Cron Job
# ------------------------------------------------
INSTALLER_SCRIPT_NAME="installer.sh"
CRON_NAME="hiretrack-autoupdate"

echo "3. Checking and removing cron job and associated CRON_NAME comments..."
if crontab -l 2>/dev/null | grep -q -e "$INSTALLER_SCRIPT_NAME --update" -e "# CRON_NAME:$CRON_NAME"; then
    (crontab -l 2>/dev/null | grep -v -e "$INSTALLER_SCRIPT_NAME --update" -e "# CRON_NAME:$CRON_NAME" || true) | crontab - || true
    echo "✅ Cron job and CRON_NAME comments removed."
else
    echo "⚠ No matching cron jobs found, skipping."
fi

# ------------------------------------------------
# Skip MongoDB Removal
# ------------------------------------------------
echo "4. Skipping MongoDB removal as per request."

# ------------------------------------------------
# Check and Remove Nginx Site Configuration
# ------------------------------------------------
echo "5. Checking and removing Nginx site configurations..."
if command -v nginx >/dev/null 2>&1; then
    echo "   - Nginx is installed, proceeding with cleanup..."

    # Detect OS
    OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')

    # Set OS-specific paths
    if [[ "$OS_TYPE" == "darwin" ]]; then
        NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
    else
        NGINX_CONF_DIR="/etc/nginx/sites-available"
        NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
    fi

    # Get domain name from config.json if it exists
    DOMAIN_NAME=""
    if [ -f "$CONFIG_PATH" ] && command -v jq >/dev/null 2>&1; then
        DOMAIN_NAME=$(jq -r '.serverName // empty' "$CONFIG_PATH" 2>/dev/null || echo "")
    fi

    if [ -n "$DOMAIN_NAME" ]; then
        echo "   - Found domain: $DOMAIN_NAME in $CONFIG_PATH"

        # Remove Nginx configuration files
        if [[ "$OS_TYPE" == "linux" ]]; then
            NGINX_CONF_FILE="$NGINX_CONF_DIR/$DOMAIN_NAME"
            NGINX_ENABLED_FILE="$NGINX_ENABLED_DIR/$DOMAIN_NAME"
            if [ -f "$NGINX_CONF_FILE" ]; then
                sudo rm -f "$NGINX_CONF_FILE"
                echo "   - Removed Nginx config: $NGINX_CONF_FILE"
            else
                echo "   - Nginx config not found: $NGINX_CONF_FILE, skipping."
            fi
            if [ -L "$NGINX_ENABLED_FILE" ]; then
                sudo rm -f "$NGINX_ENABLED_FILE"
                echo "   - Removed Nginx enabled site link: $NGINX_ENABLED_FILE"
            else
                echo "   - Nginx enabled site link not found: $NGINX_ENABLED_FILE, skipping."
            fi
        elif [[ "$OS_TYPE" == "darwin" ]]; then
            NGINX_CONF_FILE="$NGINX_CONF_DIR/$DOMAIN_NAME"
            if [ -f "$NGINX_CONF_FILE" ]; then
                sudo rm -f "$NGINX_CONF_FILE"
                echo "   - Removed Nginx config: $NGINX_CONF_FILE"
            else
                echo "   - Nginx config not found: $NGINX_CONF_FILE, skipping."
            fi
        fi

        # Reload Nginx to apply changes
        if pgrep -x "nginx" >/dev/null; then
            echo "   - Testing Nginx configuration..."
            if sudo nginx -t >/dev/null 2>&1; then
                echo "   - Reloading Nginx..."
                if [[ "$OS_TYPE" == "linux" ]]; then
                    sudo systemctl reload nginx || true
                elif [[ "$OS_TYPE" == "darwin" ]]; then
                    brew services restart nginx || true
                fi
                echo "   - Nginx reloaded successfully."
            else
                echo "   ⚠ Nginx configuration test failed, please check manually."
            fi
        else
            echo "   - Nginx not running, skipping reload."
        fi
    else
        echo "   - No domain found in $CONFIG_PATH, skipping Nginx config removal."
    fi
else
    echo "⚠ Nginx not found, skipping Nginx cleanup."
fi
echo "✅ Nginx site configurations cleanup complete."

# ------------------------------------------------
# Check and Remove Node.js and PM2 Global Install
# ------------------------------------------------
echo "6. Checking and removing Node.js and globally installed npm packages (PM2)..."
if command -v npm >/dev/null 2>&1; then
    echo "   - Uninstalling PM2 globally..."
    npm uninstall -g pm2 || true
    echo "✅ PM2 global uninstall complete."
else
    echo "⚠ npm not found, skipping PM2 global uninstall."
fi

if command -v node >/dev/null 2>&1; then
    echo "   - Node.js is installed, proceeding with removal..."
    if command -v apt-get >/dev/null 2>&1; then
        echo "   - Removing Node.js via apt..."
        sudo apt-get purge -y nodejs || true
        sudo apt-get autoremove -y || true
        sudo rm -f /etc/apt/sources.list.d/nodesource.list
        sudo rm -f /etc/apt/sources.list.d/nodesource.list.save
        echo "✅ Node.js removed."
    else
        echo "⚠ Node.js found but installed outside of apt, please remove manually if necessary."
    fi
else
    echo "⚠ Node.js not found, skipping removal."
fi

# ------------------------------------------------
# Check and Remove Less Essential Dependencies (jq)
# ------------------------------------------------
echo "7. Checking and removing less essential dependencies (jq)..."
if command -v apt-get >/dev/null 2>&1 && dpkg -s jq >/dev/null 2>&1; then
    sudo apt-get purge -y jq || true
    echo "✅ jq removed."
    sudo apt-get autoremove -y
    sudo apt-get update
else
    echo "⚠ jq not found or non-APT system, skipping removal."
fi

echo "---"
echo "✅ Cleanup complete. Your test environment is ready for a fresh run of the installer script!"

