#!/bin/bash
set -euo pipefail

# ------------------------------------------------
# Constants and Environment Variables
# ------------------------------------------------
INSTALLER_DEST="$HOME/.myapp/installer.sh"
APP_INSTALL_DIR="$HOME/.myapp/APP"
BACKUP_DIR="$HOME/.myapp/backup"
RELEASES_DIR="$HOME/.myapp/releases"
TMP_INSTALL_DIR="$HOME/.myapp/tmp_install"
CONFIG_PATH="$HOME/.myapp/config.json"
LICENSE_PATH="$HOME/.myapp/license.json"
SCRIPT_PATH="$HOME/.myapp/installer.sh"
LOG_DIR="$HOME/.myapp/logs"
CRON_LOG_FILE="$LOG_DIR/cron_update.log"
MANUAL_LOG_FILE="$LOG_DIR/manual_update.log"
ROLLBACK_LOG_FILE="$LOG_DIR/rollback.log"

API_URL="https://hiretrack-super-bunny.vercel.app/api/license/register"
API_URL_UPDATE_LIC="https://hiretrack-super-bunny.vercel.app/api/license/update"
VALIDATE_API="https://hiretrack-super-bunny.vercel.app/api/license/validate"
LATEST_VERSION_API="https://hiretrack-super-bunny.vercel.app/api/version/list"

MONGODB_VERSION="${MONGODB_VERSION:-7.0}"
NODE_VERSION_DEFAULT=20

mkdir -p "$APP_INSTALL_DIR" "$BACKUP_DIR" "$RELEASES_DIR" "$TMP_INSTALL_DIR" "$LOG_DIR"

# ------------------------------------------------
# Auto-copy Installer
# ------------------------------------------------
if [ "$(realpath "$0")" != "$INSTALLER_DEST" ]; then
    echo "📦 Copying installer to $HOME/.myapp..."
    mkdir -p "$HOME/.myapp"
    cp "$0" "$INSTALLER_DEST"
    chmod +x "$INSTALLER_DEST"
    echo "✅ Installer ready at $INSTALLER_DEST"
    #echo "▶️ Please re-run the installer: $INSTALLER_DEST --install"
    echo "🚀 Auto-running installer with --install..."
    #exec "$INSTALLER_DEST" --install
    exec "$INSTALLER_DEST" "$@"
    exit 0
fi

# ------------------------------------------------
# Utility Functions
# ------------------------------------------------
check_dep() {
    local CMD="$1"
    if ! command -v "$CMD" >/dev/null 2>&1; then
        echo "⚠ $CMD not found. Installing..."
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update
            sudo apt-get install -y "$CMD"
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y "$CMD"
        else
            echo "❌ Cannot install $CMD automatically. Please install it manually."
            exit 1
        fi
    fi
    echo "✅ $CMD is available."
}

get_machine_code() {
    local OS_TYPE
    OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')
    if [[ "$OS_TYPE" == "linux" ]]; then
        if [ -f /etc/machine-id ]; then
            cat /etc/machine-id
        else
            hostname | sha256sum | awk '{print $1}'
        fi
    elif [[ "$OS_TYPE" == "darwin" ]]; then
        hostname | shasum -a 256 | awk '{print $1}'
    else
        echo "❌ Unsupported OS: $OS_TYPE"
        exit 1
    fi
}

prompt_for_email() {
    read -p "Enter your email: " EMAIL
    if [ -z "$EMAIL" ]; then
        echo "❌ Email cannot be empty."
        exit 1
    fi
    echo "$EMAIL"
}
prompt_for_update() {
    read -p "Enter your email: " EMAIL
    if [ -z "$EMAIL" ]; then
        echo "❌ Email cannot be empty."
        exit 1
    fi
    echo "$EMAIL"
}

prompt_for_version() {
    read -p "Enter the version to install: " VERSION
    if [ -z "$VERSION" ]; then
        echo "❌ Version cannot be empty."
        exit 1
    fi
    VERSION=${VERSION#hiretrack-}
    echo "$VERSION"
}

write_env_mongo_url() {
    local APP_DIR="$1"
    local URL="$2"
    local ENV_FILE="$APP_DIR/.env"
    mkdir -p "$APP_DIR"
    if [ -f "$ENV_FILE" ]; then
        grep -v "^MONGODB_URI=" "$ENV_FILE" > "${ENV_FILE}.tmp" || true
        echo "MONGODB_URI=$URL" >> "${ENV_FILE}.tmp"
        mv "${ENV_FILE}.tmp" "$ENV_FILE"
    else
        echo "MONGODB_URI=$URL" > "$ENV_FILE"
    fi
    echo "✅ MongoDB URL updated in $ENV_FILE"
}

write_env_server_details() {
    local ENV_FILE="$APP_INSTALL_DIR/.env"
    mkdir -p "$APP_INSTALL_DIR"

    # Extract serverName from config.json
    local SERVER_NAME
    SERVER_NAME=$(jq -r '.serverName // empty' "$CONFIG_PATH")

    # Handle missing server name
    if [ -z "$SERVER_NAME" ] || [ "$SERVER_NAME" = "null" ]; then
        echo "⚠️ serverName not found in $CONFIG_PATH"
        return 0
    fi

    # Determine BASE_URL
    local BASE_URL
    if [[ "$SERVER_NAME" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
        BASE_URL="http://$SERVER_NAME:3000"
    elif [[ "$SERVER_NAME" =~ ^https?:// ]]; then
        BASE_URL="$SERVER_NAME"
    else
        BASE_URL="https://$SERVER_NAME"
    fi

    # Remove existing BASE_URL line if exists
    if [ -f "$ENV_FILE" ]; then
        grep -v "^BASE_URL=" "$ENV_FILE" > "${ENV_FILE}.tmp" || true
    else
        touch "${ENV_FILE}.tmp"
    fi

    # Write new BASE_URL
    echo "BASE_URL=$BASE_URL" >> "${ENV_FILE}.tmp"
    mv "${ENV_FILE}.tmp" "$ENV_FILE"

    echo "✅ BASE_URL updated in $ENV_FILE ($BASE_URL)"
}


write_config() {
    local KEY="$1"
    local VALUE="$2"
    jq --arg k "$KEY" --arg v "$VALUE" '.[$k]=$v' "$CONFIG_PATH" > "${CONFIG_PATH}.tmp" && mv "${CONFIG_PATH}.tmp" "$CONFIG_PATH"
}

# ------------------------------------------------
# Dependency Installation
# ------------------------------------------------
install_node() {
    local APP_DIR="$1"
    local NODE_VERSION

    if [ -n "$APP_DIR" ] && [ -f "$APP_DIR/.env" ]; then
        NODE_VERSION=$(grep -E '^NODE_VERSION=' "$APP_DIR/.env" | cut -d '=' -f2)
    fi
    NODE_VERSION=${NODE_VERSION:-$NODE_VERSION_DEFAULT}
    local NODE_MAJOR_VERSION
    NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')

    if command -v node >/dev/null 2>&1; then
        local CURRENT_VERSION
        CURRENT_VERSION=$(node -v | sed 's/v\([0-9]*\).*/\1/')
        if [ "$CURRENT_VERSION" = "$NODE_MAJOR_VERSION" ]; then
            echo "✅ Node.js version $NODE_MAJOR_VERSION.x already installed (found $(node -v))."
            return
        else
            echo "⚠ Node.js version $CURRENT_VERSION found, but version $NODE_MAJOR_VERSION.x required."
        fi
    else
        echo "⚠ Node.js not found."
    fi

    echo "📦 Installing Node.js version $NODE_MAJOR_VERSION globally..."
    local OS_TYPE
    OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')
    local CODENAME

    if [[ "$OS_TYPE" == "linux" ]]; then
        if command -v apt-get >/dev/null 2>&1; then
            CODENAME=$(lsb_release -cs 2>/dev/null || echo "focal")
            curl -fsSL "https://deb.nodesource.com/setup_$NODE_MAJOR_VERSION.x" | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v yum >/dev/null 2>&1; then
            curl -fsSL "https://rpm.nodesource.com/setup_$NODE_MAJOR_VERSION.x" | sudo -E bash -
            sudo yum install -y nodejs
        else
            echo "❌ Unsupported Linux package manager. Install Node.js manually."
            exit 1
        fi
    elif [[ "$OS_TYPE" == "darwin" ]]; then
        if ! command -v brew >/dev/null 2>&1; then
            echo "❌ Homebrew not found. Install Homebrew first."
            exit 1
        fi
        brew install node@$NODE_MAJOR_VERSION
        brew link node@$NODE_MAJOR_VERSION --force
    else
        echo "❌ Unsupported OS: $OS_TYPE"
        exit 1
    fi

    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        local INSTALLED_VERSION
        INSTALLED_VERSION=$(node -v | sed 's/v\([0-9]*\).*/\1/')
        if [ "$INSTALLED_VERSION" = "$NODE_MAJOR_VERSION" ]; then
            echo "✅ Node.js $NODE_MAJOR_VERSION and npm $(npm -v) installed successfully."
        else
            echo "❌ Failed to install Node.js $NODE_MAJOR_VERSION. Found version: $(node -v)."
            exit 1
        fi
    else
        echo "❌ Node.js installation failed."
        exit 1
    fi
}

check_pm2() {
    install_node ""
    if command -v pm2 >/dev/null 2>&1; then
        echo "✅ PM2 already installed."
    else
        echo "📦 Installing PM2 globally..."
        npm install -g pm2
        if command -v pm2 >/dev/null 2>&1; then
            echo "✅ PM2 installed."
        else
            echo "❌ Failed to install PM2."
            exit 1
        fi
    fi
}

install_and_start_mongodb() {
    local OS_TYPE
    OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')
    local LATEST_VERSION=""

    if command -v mongod >/dev/null 2>&1; then
        echo "✅ MongoDB already installed."
        [[ "$OS_TYPE" == "darwin" ]] && LATEST_VERSION=$(brew list --formula | grep -E '^mongodb-community@[0-9]+\.[0-9]+' | sort -V | tail -n 1)
    else
        echo "📦 Installing MongoDB $MONGODB_VERSION..."
        if [[ "$OS_TYPE" == "darwin" ]]; then
            [ ! -x "$(command -v brew)" ] && { echo "❌ Install Homebrew first"; exit 1; }
            brew tap mongodb/brew
            LATEST_VERSION=$(brew search mongodb-community@ | grep -Eo 'mongodb-community@[0-9]+\.[0-9]+' | sort -V | tail -n 1)
            [ -z "$LATEST_VERSION" ] && { echo "❌ MongoDB formula not found"; exit 1; }
            brew install "$LATEST_VERSION"
        elif [[ "$OS_TYPE" == "linux" ]]; then
            if command -v apt-get >/dev/null 2>&1; then
                sudo rm -f /etc/apt/sources.list.d/mongodb-org-*.list
                curl -fsSL https://www.mongodb.org/static/pgp/server-$MONGODB_VERSION.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-$MONGODB_VERSION.gpg
                local CODENAME=$(lsb_release -cs)
                if [[ "$CODENAME" == "noble" ]]; then
                    echo "⚠ Ubuntu Noble (24.04) detected. Using Jammy (22.04) repository for MongoDB $MONGODB_VERSION."
                    CODENAME="jammy"
                fi
                echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-$MONGODB_VERSION.gpg ] https://repo.mongodb.org/apt/ubuntu $CODENAME/mongodb-org/$MONGODB_VERSION multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-$MONGODB_VERSION.list
                sudo apt-get update
                if ! sudo apt-get install -y mongodb-org; then
                    echo "❌ Failed to install MongoDB $MONGODB_VERSION. Trying MongoDB 6.0 as fallback..."
                    MONGODB_VERSION="6.0"
                    sudo rm -f /etc/apt/sources.list.d/mongodb-org-$MONGODB_VERSION.list
                    curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg
                    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu $CODENAME/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
                    sudo apt-get update
                    if ! sudo apt-get install -y mongodb-org; then
                        echo "❌ Failed to install MongoDB. Please install it manually from https://www.mongodb.com/docs/manual/installation/"
                        exit 1
                    fi
                fi
            elif command -v yum >/dev/null 2>&1; then
                sudo yum install -y mongodb-org
            else
                echo "❌ Unsupported Linux. Install MongoDB manually."
                exit 1
            fi
        else
            echo "❌ Unsupported OS: $OS_TYPE"
            exit 1
        fi
    fi

    echo "▶️ Starting MongoDB service..."
    if [[ "$OS_TYPE" == "darwin" ]]; then
        [ -z "$LATEST_VERSION" ] && LATEST_VERSION="mongodb-community@$MONGODB_VERSION"
        brew services start "$LATEST_VERSION" || { echo "❌ Failed to start MongoDB via Homebrew"; exit 1; }
    elif [[ "$OS_TYPE" == "linux" ]]; then
        sudo systemctl start mongod || { echo "❌ Failed to start MongoDB"; exit 1; }
        sudo systemctl enable mongod || { echo "❌ Failed to enable MongoDB"; exit 1; }
    fi
    sleep 5
    if pgrep -x "mongod" >/dev/null; then
        echo "✅ MongoDB running"
        if command -v mongo >/dev/null 2>&1; then
            mongo --eval "db.adminCommand('ping')" >/dev/null 2>&1 && echo "✅ MongoDB connection verified" || { echo "❌ MongoDB connection failed"; exit 1; }
        else
            echo "⚠ MongoDB shell not found, skipping connection test"
        fi
    else
        echo "❌ MongoDB failed to start. Check logs at /var/log/mongodb/mongod.log"
        exit 1
    fi
}

# ------------------------------------------------
# Config and License Management
# ------------------------------------------------
create_default_config() {
    local PASSED_EMAIL="${1:-}"
    if [ ! -f "$CONFIG_PATH" ]; then
        echo '{"autoUpdate": true, "installedVersion": "none"}' > "$CONFIG_PATH"
        echo "✅ Default config created at $CONFIG_PATH"
    fi

    if [ -n "$PASSED_EMAIL" ]; then
        if ! echo "$PASSED_EMAIL" | grep -E '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' >/dev/null 2>&1; then
            echo "❌ Invalid email format: $PASSED_EMAIL"
            exit 1
        fi
        local EXISTING_EMAIL
        EXISTING_EMAIL=$(jq -r '.email // empty' "$CONFIG_PATH" 2>/dev/null || echo "")
        if [ -n "$EXISTING_EMAIL" ]; then
            echo "Existing email"
            exit 1
        fi
    fi
}

register_license() {
    # Check if license.json exists and contains a valid license key
    if [ -f "$LICENSE_PATH" ] && jq -e '.licenseKey' "$LICENSE_PATH" >/dev/null 2>&1; then
        local EXISTING_LICENSE_KEY
        EXISTING_LICENSE_KEY=$(jq -r '.licenseKey' "$LICENSE_PATH")
        if [ -n "$EXISTING_LICENSE_KEY" ] && [ "$EXISTING_LICENSE_KEY" != "null" ]; then
            echo "✅ License key already exists in $LICENSE_PATH. Skipping registration."
            return 0
        fi
    fi
    local EMAIL="$1"
    [ -z "$EMAIL" ] && EMAIL=$(prompt_for_email)
    local MACHINE_CODE=$(get_machine_code)

    local EXISTING_DB_CHOICE
    EXISTING_DB_CHOICE=$(jq -r '.dbChoice // empty' "$CONFIG_PATH")
    local SKIP_DB_SETUP=""
    if [ -n "$EXISTING_DB_CHOICE" ]; then
        echo "✅ Database preference already set: $EXISTING_DB_CHOICE"
        local EXISTING_DB_URL
        EXISTING_DB_URL=$(jq -r '.dbUrl // empty' "$CONFIG_PATH")
        [ -n "$EXISTING_DB_URL" ] && echo "🔗 Existing DB URL: $EXISTING_DB_URL"
        read -p "Do you want to override the database preference and URL? [y/N]: " OVERRIDE
        OVERRIDE=${OVERRIDE:-N}
        if [[ ! "$OVERRIDE" =~ ^[Yy]$ ]]; then
            SKIP_DB_SETUP=1
            # Ensure current .env reflects existing DB URL if present
            if [ -n "$EXISTING_DB_URL" ]; then
                write_env_mongo_url "$APP_INSTALL_DIR" "$EXISTING_DB_URL"
            fi
        fi
    fi

    if [ -z "$SKIP_DB_SETUP" ]; then
        echo "📦 Choose MongoDB option:"
        echo "1) MongoDB Atlas (cloud)"
        echo "2) Local MongoDB"
        read -p "Enter choice [1/2]: " DB_CHOICE

        local APP_DIR="$APP_INSTALL_DIR"
        local DB_URL
        if [ "$DB_CHOICE" == "1" ]; then
            read -p "Enter your MongoDB Atlas connection URL: " ATLAS_URL
            [ -z "$ATLAS_URL" ] && { echo "❌ MongoDB Atlas URL cannot be empty."; exit 1; }
            DB_URL="$ATLAS_URL"
            write_config "dbChoice" "atlas"
        elif [ "$DB_CHOICE" == "2" ]; then
            install_and_start_mongodb
            DB_URL="mongodb://localhost:27017/hiretrack"
            write_config "dbChoice" "local"
        else
            echo "❌ Invalid choice."
            exit 1
        fi
        write_env_mongo_url "$APP_DIR" "$DB_URL"
        write_config "dbUrl" "$DB_URL"
    fi

    local RESPONSE
    RESPONSE=$(curl -s -X POST "$API_URL" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"machineCode\":\"$MACHINE_CODE\"}")
    echo "RESPONSE-REGISTERATION: $RESPONSE"

    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ License registration failed: Invalid response."
        exit 1
    fi

    local LICENSE_KEY EMAIL_RES
    LICENSE_KEY=$(echo "$RESPONSE" | jq -r '.license.licenseKey')
    EMAIL_RES=$(echo "$RESPONSE" | jq -r '.license.email')
    if [ -z "$LICENSE_KEY" ] || [ "$LICENSE_KEY" == "null" ] || [ -z "$EMAIL_RES" ] || [ "$EMAIL_RES" == "null" ]; then
        echo "❌ License registration failed."
        exit 1
    fi

    echo "{\"licenseKey\":\"$LICENSE_KEY\"}" > "$LICENSE_PATH"
    echo "✅ License saved at $LICENSE_PATH"
    if [ -n "$EMAIL_RES" ] && [ "$EMAIL_RES" != "null" ]; then
        write_config "email" "$EMAIL_RES"
    fi
}
update_license() {
    local EMAIL="$1"
    [ -z "$EMAIL" ] && EMAIL=$(prompt_for_email)
    local MACHINE_CODE=$(get_machine_code)

    # Check if license.json exists and contains a license key
    if [ ! -f "$LICENSE_PATH" ] || ! jq -e '.licenseKey' "$LICENSE_PATH" >/dev/null 2>&1; then
        echo "❌ No valid license key found in $LICENSE_PATH. Please register a license first."
        exit 1
    fi
    local OLD_LICENSE_KEY
    OLD_LICENSE_KEY=$(jq -r '.licenseKey' "$LICENSE_PATH")

    local EXISTING_DB_CHOICE
    

    # Send update request with old license key
    local RESPONSE
    RESPONSE=$(curl -s -X PATCH "$API_URL_UPDATE_LIC" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"machineCode\":\"$MACHINE_CODE\",\"licenseKey\":\"$OLD_LICENSE_KEY\"}")

    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ License update failed: Invalid response."
        exit 1
    fi

    local NEW_LICENSE_KEY EMAIL_RES
    NEW_LICENSE_KEY=$(echo "$RESPONSE" | jq -r '.newLicenseKey')
    EMAIL_RES=$(echo "$RESPONSE" | jq -r '.email')
    if [ -z "$NEW_LICENSE_KEY" ] || [ "$NEW_LICENSE_KEY" == "null" ] || [ -z "$EMAIL_RES" ] || [ "$EMAIL_RES" == "null" ]; then
        echo "❌ License update failed."
        exit 1
    fi

    # Save new license key to license.json
    echo "{\"licenseKey\":\"$NEW_LICENSE_KEY\"}" > "$LICENSE_PATH"
    echo "✅ License updated and saved at $LICENSE_PATH"
    if [ -n "$EMAIL_RES" ] && [ "$EMAIL_RES" != "null" ]; then
        write_config "email" "$EMAIL_RES"
    fi
}

validate_license_and_get_asset() {
    local VERSION="${1:-}"
    if [ ! -f "$LICENSE_PATH" ]; then
        echo "❌ License not found. Please register first."
        exit 1
    fi

    local LICENSE_KEY=$(jq -r '.licenseKey' "$LICENSE_PATH")
    local MACHINE_CODE=$(get_machine_code)
    local INSTALLED_VERSION=$(jq -r '.installedVersion // "none"' "$CONFIG_PATH")
    local VERSION_TO_SEND="${VERSION:-$INSTALLED_VERSION}"
    local RESPONSE
    RESPONSE=$(curl -s -X POST "$VALIDATE_API" -H "Content-Type: application/json" -d "{\"licenseKey\":\"$LICENSE_KEY\",\"machineCode\":\"$MACHINE_CODE\",\"installedVersion\":\"$VERSION_TO_SEND\"}")
    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ License validation failed: Invalid response."
        exit 1
    fi

    local VALID ASSET_URL
    VALID=$(echo "$RESPONSE" | jq -r '.valid')
    ASSET_URL=$(echo "$RESPONSE" | jq -r '.asset')
    if [ "$VALID" != "true" ]; then
        echo "❌ License invalid or expired."
        exit 1
    fi
    echo "$ASSET_URL"
}

# ------------------------------------------------
# Version Management
# ------------------------------------------------
check_latest_version() {
    local RESPONSE=$(curl -s "$LATEST_VERSION_API")
    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Failed to get latest version info."
        exit 1
    fi
    local LATEST_VERSION=$(echo "$RESPONSE" | jq -r '.latestVerson // .latestVersion // empty')
    if [ -z "$LATEST_VERSION" ] || [ "$LATEST_VERSION" == "null" ]; then
        echo "❌ No latest version found."
        exit 1
    fi
    echo "$LATEST_VERSION"
}


# -------------------------------
# Rollback helper function
# -------------------------------
rollback() {
    local VERSION_TO_RESTORE="${1:-}"   # default to empty string if not passed

    if [ -z "$VERSION_TO_RESTORE" ]; then
        echo "❌ rollback() called without a version" | tee -a "$ROLLBACK_LOG_FILE"
        return 1
    fi

    # Ensure BACKUP_DIR is defined
    local BACKUP_DIR="${BACKUP_DIR:-$LOG_DIR/backups}"  
    local BACKUP_FILE="$BACKUP_DIR/backup-$VERSION_TO_RESTORE.tar"

    echo "🔄 Rolling back to version $VERSION_TO_RESTORE..." | tee -a "$ROLLBACK_LOG_FILE"

    # Remove current install directory
    # rm -rf "$APP_INSTALL_DIR" 2>&1 | tee -a "$ROLLBACK_LOG_FILE"
    if [ -d "$APP_INSTALL_DIR" ]; then
    sudo rm -rf --no-preserve-root "$APP_INSTALL_DIR" 2>&1 | tee -a "$ROLLBACK_LOG_FILE" || true
    fi

    if [ -f "$BACKUP_FILE" ]; then
        mkdir -p "$APP_INSTALL_DIR" 2>&1 | tee -a "$ROLLBACK_LOG_FILE"
        tar -xf "$BACKUP_FILE" -C "$APP_INSTALL_DIR" 2>&1 | tee -a "$ROLLBACK_LOG_FILE"
        cd "$APP_INSTALL_DIR" || exit
        echo "📦 Restoring dependencies..." | tee -a "$ROLLBACK_LOG_FILE"
        npm install --legacy-peer-deps 2>&1 | tee -a "$ROLLBACK_LOG_FILE"
        echo "🚀 Restarting previous version with PM2..." | tee -a "$ROLLBACK_LOG_FILE"

        # Check if PM2 is running and kill it
        pm2 kill 2>&1 | tee -a "$ROLLBACK_LOG_FILE" || true
        pm2 start "npm run start" --name "hiretrack-$VERSION_TO_RESTORE" --cwd "$APP_INSTALL_DIR" 2>&1 | tee -a "$ROLLBACK_LOG_FILE" || true
    else
        echo "⚠️ Backup not found. Killing PM2 processes..." | tee -a "$ROLLBACK_LOG_FILE"
        pm2 kill 2>&1 | tee -a "$ROLLBACK_LOG_FILE" || true
    fi

    echo "✅ Rollback completed." | tee -a "$ROLLBACK_LOG_FILE"
    write_config "installedVersion" "$VERSION_TO_RESTORE"
}

# -------------------------------
# Main update & install function
# -------------------------------
# check_update_and_install() {
#     create_default_config
#     local FLAG1="${1:-}"
#     local AUTO_UPDATE=$(jq -r '.autoUpdate' "$CONFIG_PATH")
#     local INSTALLED_VERSION=$(jq -r '.installedVersion // "none"' "$CONFIG_PATH")
   
#     # 🔹 Manual update check
#     if [ "$FLAG1" = "manually" ]; then
#         echo "⚡ Manual update triggered. Skipping auto-update check..."
#     else
#         if [ "$AUTO_UPDATE" != "true" ]; then
#             echo "✅ Auto-update disabled in config. Keeping version: $INSTALLED_VERSION"
#             return
#         fi
#     fi

#     local LATEST_VERSION=$(check_latest_version)
#     local NORMALIZED_INSTALLED=$(echo "${INSTALLED_VERSION#v}" | tr -d '[:space:]')
#     local NORMALIZED_LATEST=$(echo "${LATEST_VERSION#v}" | tr -d '[:space:]')

#     echo "🔍 INSTALLED_VERSION='$INSTALLED_VERSION', LATEST_VERSION='$LATEST_VERSION'"

#     if [ "$INSTALLED_VERSION" != "none" ] && [ "$NORMALIZED_INSTALLED" = "$NORMALIZED_LATEST" ]; then
#         echo "✅ Already up to date! Installed version: $INSTALLED_VERSION"
#         exit 0
#     fi

#     local ASSET_URL=$(validate_license_and_get_asset "$LATEST_VERSION")
#     if [ -z "$ASSET_URL" ] || [ "$ASSET_URL" = "null" ]; then
#         echo "❌ Failed to get asset URL."
#         exit 1
#     fi

#     local TMP_FILE="$HOME/.myapp/tmp_asset.tar.gz"
#     curl -L "$ASSET_URL" -o "$TMP_FILE" || { echo "❌ Download failed."; exit 1; }

#     local FILENAME=$(basename "$ASSET_URL")
#     local VERSION_NAME="${FILENAME%.tar.gz}"
#     VERSION_NAME=${VERSION_NAME#hiretrack-}

#     # --- BACKUP HANDLING (exclude node_modules) ---
#     local BACKUP_FILE="$BACKUP_DIR/backup-$INSTALLED_VERSION.tar"
#     mkdir -p "$BACKUP_DIR"
#     if [ "$INSTALLED_VERSION" != "none" ] && [ -d "$APP_INSTALL_DIR/node_modules" ]; then
#         echo "📦 Backing up current version excluding node_modules..."
#         rm -f "$BACKUP_DIR"/backup-*.tar 2>/dev/null
#         (cd "$APP_INSTALL_DIR" && tar --exclude='node_modules' -cf "$BACKUP_FILE" .)
#         echo "✅ Backup saved at: $BACKUP_FILE"
#     else
#         echo "⚠️ No valid installation found to backup."
#     fi

#     # --- INSTALLATION PROCESS ---
#     rm -rf "$APP_INSTALL_DIR"
#     mkdir -p "$APP_INSTALL_DIR"
#     tar -xzf "$TMP_FILE" -C "$APP_INSTALL_DIR" || { rollback "$INSTALLED_VERSION"; exit 1; }
#     rm "$TMP_FILE"

#     local DB_URL=$(jq -r '.dbUrl // empty' "$CONFIG_PATH")
#     [ -n "$DB_URL" ] && write_env_mongo_url "$APP_INSTALL_DIR" "$DB_URL"

#     [ ! -f "$APP_INSTALL_DIR/package.json" ] && { rollback "$INSTALLED_VERSION"; exit 1; }

#     install_node "$APP_INSTALL_DIR"

#     local DB_CHOICE=$(jq -r '.dbChoice // empty' "$CONFIG_PATH")
#     if [ "$DB_CHOICE" == "local" ]; then
#         install_and_start_mongodb
#     elif [ "$DB_CHOICE" != "atlas" ]; then
#         echo "❌ Invalid dbChoice."; exit 1
#     fi






#     cd "$APP_INSTALL_DIR" || exit
#     npm install --legacy-peer-deps || { rollback "$INSTALLED_VERSION"; exit 1; }
#     pm2 kill || true
#     # pm2 stop "hiretrack-$VERSION_NAME" 2>/dev/null || true
#     # pm2 delete "hiretrack-$VERSION_NAME" 2>/dev/null || true
#     pm2 start "npm run start" --name "hiretrack-$VERSION_NAME" --cwd "$APP_INSTALL_DIR" || { rollback "$INSTALLED_VERSION"; exit 1; }

#     sleep 5
#     pm2 describe "hiretrack-$VERSION_NAME" >/dev/null 2>&1 || { rollback "$INSTALLED_VERSION"; exit 1; }

#     echo "✅ New version $VERSION_NAME started successfully."
#     write_config "installedVersion" "$VERSION_NAME"

#     # # --- Clean old PM2 processes ---
#     # mapfile -t old_processes < <(pm2 jlist | jq -r '.[] | select(.name | startswith("hiretrack-")) | .name' | grep -v "hiretrack-$VERSION_NAME")
#     # for proc in "${old_processes[@]}"; do
#     #     [ -n "$proc" ] && { pm2 stop "$proc" || true;  pm2 delete "$proc" || true; }
#     # done

#     pm2 save --force

#     # migration call
#     if [ "$NORMALIZED_INSTALLED" != "none" ]; then
#         run_migrations "$NORMALIZED_INSTALLED" "$NORMALIZED_LATEST"
#     fi
#     echo "✅ Installed/Updated to $VERSION_NAME at $APP_INSTALL_DIR. Backup retained (node_modules excluded)."
# }



# check_update_and_install() {
#     create_default_config
#     local FLAG1="${1:-}"
#     local AUTO_UPDATE=$(jq -r '.autoUpdate' "$CONFIG_PATH")
#     local INSTALLED_VERSION=$(jq -r '.installedVersion // "none"' "$CONFIG_PATH")
#     local LOG_TO_FILE="false"
#     local TIMESTAMP
#     TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

#     # Enable logging only for manual updates
#     if [ "$FLAG1" = "manually" ]; then
#         LOG_TO_FILE="true"
#         echo "[$TIMESTAMP] ⚡ Manual update triggered. Starting update process..." | tee -a "$MANUAL_LOG_FILE"
#     fi

#     # Skip auto-update if disabled and not a manual update
#     if [ "$AUTO_UPDATE" != "true" ] && [ "$LOG_TO_FILE" != "true" ]; then
#         echo "✅ Auto-update disabled in config. Keeping version: $INSTALLED_VERSION"
#         return 0
#     fi

#     local LATEST_VERSION
#     LATEST_VERSION=$(check_latest_version) || LATEST_VERSION=""
#     local NORMALIZED_INSTALLED
#     NORMALIZED_INSTALLED=$(echo "${INSTALLED_VERSION#v}" | tr -d '[:space:]')
#     local NORMALIZED_LATEST
#     NORMALIZED_LATEST=$(echo "${LATEST_VERSION#v}" | tr -d '[:space:]')

#     if [ "$LOG_TO_FILE" = "true" ]; then
#         echo "[$TIMESTAMP] 🔍 Checking versions: Installed='$INSTALLED_VERSION', Latest='$LATEST_VERSION'" | tee -a "$MANUAL_LOG_FILE"
#     else
#         echo "🔍 Checking versions: Installed='$INSTALLED_VERSION', Latest='$LATEST_VERSION'"
#     fi

#     if [ -z "$LATEST_VERSION" ]; then
#         echo "❌ Unable to determine latest version. Aborting."
#         return 1
#     fi

#     if [ "$INSTALLED_VERSION" != "none" ] && [ "$NORMALIZED_INSTALLED" = "$NORMALIZED_LATEST" ]; then
#         echo "✅ Already up to date with version: $INSTALLED_VERSION"
#         return 0
#     fi

#     echo "🚀 Update available: Current=$INSTALLED_VERSION, Latest=$LATEST_VERSION"

#     local ASSET_URL
#     ASSET_URL=$(validate_license_and_get_asset "$LATEST_VERSION") || ASSET_URL=""
#     if [ -z "$ASSET_URL" ] || [ "$ASSET_URL" = "null" ]; then
#         echo "❌ Failed to retrieve asset URL for version $LATEST_VERSION"
#         return 1
#     fi

#     local TMP_FILE="$HOME/.myapp/tmp_asset.tar.gz"
#     echo "📥 Downloading update from: $ASSET_URL to $TMP_FILE"
#     curl -L "$ASSET_URL" -o "$TMP_FILE" || {
#         echo "❌ Failed to download update"
#         return 1
#     }

#     local FILENAME
#     FILENAME=$(basename "$ASSET_URL")
#     local VERSION_NAME
#     VERSION_NAME="${FILENAME%.tar.gz}"
#     VERSION_NAME=${VERSION_NAME#hiretrack-}

#     local BACKUP_FILE="$BACKUP_DIR/backup-$INSTALLED_VERSION.tar"
#     mkdir -p "$BACKUP_DIR"
#     if [ "$INSTALLED_VERSION" != "none" ] && [ -d "$APP_INSTALL_DIR/node_modules" ]; then
#         echo "📦 Creating backup of current version $INSTALLED_VERSION..."
#         rm -f "$BACKUP_DIR"/backup-*.tar 2>/dev/null
#         (cd "$APP_INSTALL_DIR" && tar --exclude='node_modules' -cf "$BACKUP_FILE" .)
#         echo "✅ Backup saved at: $BACKUP_FILE"
#     else
#         echo "⚠️ No valid installation found to backup"
#     fi

#     rm -rf "$APP_INSTALL_DIR"
#     mkdir -p "$APP_INSTALL_DIR"
#     if ! tar -xzf "$TMP_FILE" -C "$APP_INSTALL_DIR"; then
#         echo "❌ Failed to extract update. Rolling back..."
#         rollback "$INSTALLED_VERSION"
#         return 1
#     fi
#     rm -f "$TMP_FILE"

#     local DB_URL
#     DB_URL=$(jq -r '.dbUrl // empty' "$CONFIG_PATH")
#     [ -n "$DB_URL" ] && write_env_mongo_url "$APP_INSTALL_DIR" "$DB_URL"

#     if [ ! -f "$APP_INSTALL_DIR/package.json" ]; then
#         echo "❌ package.json not found in $APP_INSTALL_DIR"
#         rollback "$INSTALLED_VERSION"
#         return 1
#     fi

#     install_node "$APP_INSTALL_DIR" || {
#         echo "❌ install_node failed"
#         rollback "$INSTALLED_VERSION"
#         return 1
#     }

#     local DB_CHOICE
#     DB_CHOICE=$(jq -r '.dbChoice // empty' "$CONFIG_PATH")
#     if [ "$DB_CHOICE" = "local" ]; then
#         install_and_start_mongodb || {
#             echo "❌ install_and_start_mongodb failed"
#             return 1
#         }
#     elif [ "$DB_CHOICE" != "atlas" ] && [ -n "$DB_CHOICE" ]; then
#         echo "❌ Invalid database choice: $DB_CHOICE"
#         return 1
#     fi

#     cd "$APP_INSTALL_DIR" || {
#         echo "❌ Failed to cd into $APP_INSTALL_DIR"
#         rollback "$INSTALLED_VERSION"
#         return 1
#     }

#     if ! npm install --legacy-peer-deps; then
#         echo "❌ npm install failed. Rolling back..."
#         rollback "$INSTALLED_VERSION"
#         return 1
#     fi

#     # ✅ Use original PM2 start command (without --prefix)
#     pm2 stop "hiretrack-$VERSION_NAME" 2>/dev/null || true
#     pm2 delete "hiretrack-$VERSION_NAME" 2>/dev/null || true
#     # pm2 kill || true
#     if ! pm2 start "npm run start" --name "hiretrack-$VERSION_NAME" --cwd "$APP_INSTALL_DIR"; then
#         echo "❌ Failed to start application. Rolling back..."
#         rollback "$INSTALLED_VERSION"
#         return 1
#     fi

#     sleep 5
#     if ! pm2 describe "hiretrack-$VERSION_NAME" >/dev/null 2>&1; then
#         echo "❌ Application failed to start (PM2 describe failed). Rolling back..."
#         rollback "$INSTALLED_VERSION"
#         return 1
#     fi

#     echo "✅ Successfully started version $VERSION_NAME"
#     write_config "installedVersion" "$VERSION_NAME"

#      # 🔪 Kill all old hiretrack processes before starting the new one
#     echo "🧹 Cleaning up old PM2 processes..."
#     mapfile -t old_processes < <(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | test("^hiretrack-")) | .name' || true)

#     for proc in "${old_processes[@]:-}"; do
#         echo "⏹ Stopping and deleting process: $proc"
#         # pm2 stop "$proc" || true
#         # sleep 1
#         # pm2 delete "$proc" || true
#         pm2 kill "$proc" || true
#     done




#     pm2 save --force

#     if [ "$NORMALIZED_INSTALLED" != "none" ]; then
#         echo "📦 Running migrations from $NORMALIZED_INSTALLED to $NORMALIZED_LATEST..."
#         run_migrations "$NORMALIZED_INSTALLED" "$NORMALIZED_LATEST" || {
#             echo "❌ Migrations failed. Rolling back..."
#             rollback "$INSTALLED_VERSION"
#             return 1
#         }
#     fi

#     echo "✅ Successfully installed/updated to $VERSION_NAME at $APP_INSTALL_DIR"
#     return 0
# }
check_update_and_install() {
    create_default_config
    local FLAG1="${1:-}"
    local AUTO_UPDATE
    AUTO_UPDATE=$(jq -r '.autoUpdate' "$CONFIG_PATH")
    local INSTALLED_VERSION
    INSTALLED_VERSION=$(jq -r '.installedVersion // "none"' "$CONFIG_PATH")
    local TIMESTAMP
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    local LOG_TO_FILE="false"

    # 🔹 Detect manual update
    if [ "$FLAG1" = "manually" ]; then
        LOG_TO_FILE="true"
        echo "[$TIMESTAMP] ⚡ Manual update triggered." | tee -a "$MANUAL_LOG_FILE"
    fi

    # 🔹 Helper: unified echo wrapper
    log() {
        local MSG="$1"
        local NOW
        NOW=$(date '+%Y-%m-%d %H:%M:%S')
        if [ "$LOG_TO_FILE" = "true" ]; then
            echo "[$NOW] $MSG" | tee -a "$MANUAL_LOG_FILE"
        else
            echo "$MSG"
        fi
    }

    # ---------------------------------------------------
    # Begin update process
    # ---------------------------------------------------
    if [ "$AUTO_UPDATE" != "true" ] && [ "$LOG_TO_FILE" != "true" ]; then
        log "✅ Auto-update disabled. Keeping version: $INSTALLED_VERSION"
        return 0
    fi

    log "🔍 Checking latest version..."
    local LATEST_VERSION
    LATEST_VERSION=$(check_latest_version) || { log "❌ Failed to fetch latest version."; return 1; }

    local NORMALIZED_INSTALLED NORMALIZED_LATEST
    NORMALIZED_INSTALLED=$(echo "${INSTALLED_VERSION#v}" | tr -d '[:space:]')
    NORMALIZED_LATEST=$(echo "${LATEST_VERSION#v}" | tr -d '[:space:]')

    log "📋 Installed: $INSTALLED_VERSION | Latest: $LATEST_VERSION"

    if [ "$INSTALLED_VERSION" != "none" ] && [ "$NORMALIZED_INSTALLED" = "$NORMALIZED_LATEST" ]; then
        log "✅ Already up to date."
        return 0
    fi

    log "🚀 Update available: upgrading to $LATEST_VERSION"
    local ASSET_URL
    ASSET_URL=$(validate_license_and_get_asset "$LATEST_VERSION") || { log "❌ Failed to validate license."; return 1; }

    local TMP_FILE="$HOME/.myapp/tmp_asset.tar.gz"
    log "📥 Downloading $ASSET_URL → $TMP_FILE"
    curl -L "$ASSET_URL" -o "$TMP_FILE" || { log "❌ Download failed."; return 1; }

    local FILENAME VERSION_NAME
    FILENAME=$(basename "$ASSET_URL")
    VERSION_NAME="${FILENAME%.tar.gz}"
    VERSION_NAME=${VERSION_NAME#hiretrack-}

    # # Backup existing
    # local BACKUP_FILE="$BACKUP_DIR/backup-$INSTALLED_VERSION.tar"
    # if [ "$INSTALLED_VERSION" != "none" ] && [ -d "$APP_INSTALL_DIR" ]; then
    #     log "📦 Backing up current version..."
    #     tar --exclude='node_modules' -cf "$BACKUP_FILE" -C "$APP_INSTALL_DIR" .
    #     log "✅ Backup saved at: $BACKUP_FILE"
    # else
    #     log "⚠️ No existing installation to back up."
    # fi

    # --- BACKUP HANDLING ---
    local BACKUP_FILE="$BACKUP_DIR/backup-$INSTALLED_VERSION.tar"
    mkdir -p "$BACKUP_DIR"

    if [ "$INSTALLED_VERSION" != "none" ] && [ -d "$APP_INSTALL_DIR/node_modules" ]; then
        echo "📦 Backing up current version ($INSTALLED_VERSION)..."
        # Remove any old backup first (keep only one)
        if ls "$BACKUP_DIR"/backup-*.tar >/dev/null 2>&1; then
            echo "🧹 Removing old backup..."
            rm -f "$BACKUP_DIR"/backup-*.tar
        fi

        tar --exclude='node_modules' -cf "$BACKUP_FILE" -C "$APP_INSTALL_DIR" .
        echo "✅ Backup saved at: $BACKUP_FILE"
    else
        echo "⚠️ No valid installation found to backup (no node_modules or empty app dir)."
    fi



    # Extract
    rm -rf "$APP_INSTALL_DIR"
    mkdir -p "$APP_INSTALL_DIR"
    if ! tar -xzf "$TMP_FILE" -C "$APP_INSTALL_DIR"; then
        log "❌ Extraction failed. Rolling back..."
        rollback "$INSTALLED_VERSION"
        return 1
    fi
    rm -f "$TMP_FILE"
    log "✅ Extracted to: $APP_INSTALL_DIR"
    # Database setup
    local DB_URL DB_CHOICE
    DB_URL=$(jq -r '.dbUrl // empty' "$CONFIG_PATH")
    DB_CHOICE=$(jq -r '.dbChoice // empty' "$CONFIG_PATH")
    [ -n "$DB_URL" ] && write_env_mongo_url "$APP_INSTALL_DIR" "$DB_URL"

    install_node "$APP_INSTALL_DIR" || { log "❌ Node install failed."; rollback "$INSTALLED_VERSION"; return 1; }
    [ "$DB_CHOICE" = "local" ] && install_and_start_mongodb

    cd "$APP_INSTALL_DIR" || { log "❌ Failed to cd into app dir."; rollback "$INSTALLED_VERSION"; return 1; }

    npm install --legacy-peer-deps || { log "❌ npm install failed."; rollback "$INSTALLED_VERSION"; return 1; }
    write_env_server_details ;
    # ---------------------------------------------------
    # PM2 Restart Logic (fixed and robust)
    # ---------------------------------------------------
    log "🚀 Restarting PM2 process..."
    export PM2_HOME="$HOME/.pm2"

    # Kill all old hiretrack processes safely
    log "🗑️ Cleaning up old PM2 processes..."
    

    # Start new hiretrack process
    pm2 start "npm run start" --name "hiretrack-$VERSION_NAME" --cwd "$APP_INSTALL_DIR" || {
        log "❌ Failed to start. Rolling back..."
        pm2 delete "hiretrack-$VERSION_NAME" || true
        rollback "$INSTALLED_VERSION"
        return 1
    }

    ## Migrations

    if [ "$NORMALIZED_INSTALLED" != "none" ]; then
        log "📦 Running migrations from $NORMALIZED_INSTALLED to $NORMALIZED_LATEST..."
        run_migrations "$NORMALIZED_INSTALLED" "$NORMALIZED_LATEST" || {
            log "❌ Migrations failed. Rolling back..."
            rollback "$INSTALLED_VERSION"
            return 1
        }
    fi
    log "✅ Successfully installed/updated to $VERSION_NAME at $APP_INSTALL_DIR"
    write_config "installedVersion" "$VERSION_NAME"

    if [ -n "$INSTALLED_VERSION" ] && [ "$INSTALLED_VERSION" != "none" ]; then
     pm2 delete "hiretrack-$INSTALLED_VERSION" || true
    fi
    pm2 save --force >/dev/null 2>&1 || true
}


# ------------------------------------------------
# Migration Functions (Fail-Safe)
# ------------------------------------------------


run_migrations() {
    set +u  # prevent unbound variable errors

    local CURRENT_VERSION="${1:-none}"
    local TARGET_VERSION="${2:-none}"

    if [ "$CURRENT_VERSION" = "none" ]; then
        echo "✅ No migrations needed for fresh install." | tee -a "$LOG_DIR/migration.log"
        return 0
    fi

    echo "📦 Fetching migrations from $CURRENT_VERSION → $TARGET_VERSION ..." | tee -a "$LOG_DIR/migration.log"

    # Fetch releases from API
    local RESPONSE VERSIONS
    RESPONSE="$(curl -s "${LATEST_VERSION_API:-}" 2>/dev/null || true)"

    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "⚠️ Warning: Invalid or empty migration response — skipping migrations." | tee -a "$LOG_DIR/migration.log"
        return 0
    fi

    # Extract versions from API
    VERSIONS="$(echo "$RESPONSE" | jq -r '.versions[].version' 2>/dev/null || true)"
    if [ -z "$VERSIONS" ] || [ "$VERSIONS" = "null" ]; then
        echo "✅ No migrations required." | tee -a "$LOG_DIR/migration.log"
        return 0
    fi

    # Sort versions semantically and filter between CURRENT and TARGET if provided
    local FILTERED_VERSIONS
    FILTERED_VERSIONS="$(echo "$VERSIONS" | sort -V | awk -v CUR="$CURRENT_VERSION" -v TGT="$TARGET_VERSION" '
        (CUR == "none" || $0 > CUR) && (TGT == "none" || $0 <= TGT) { print $0 }'
    )"

    mkdir -p "$TMP_INSTALL_DIR" "$APP_INSTALL_DIR" "$LOG_DIR" >/dev/null 2>&1 || true

    for ver in $FILTERED_VERSIONS; do
        local MIG_URL MIG_FILE MIG_EXT
        MIG_URL="$(echo "$RESPONSE" | jq -r ".versions[] | select(.version == \"$ver\") .migrationScriptUrl // empty" 2>/dev/null || true)"
        MIG_EXT="$(echo "$MIG_URL" | grep -oE '\.[a-zA-Z0-9]+$' || echo "")"
        MIG_FILE="$TMP_INSTALL_DIR/migration_${ver}${MIG_EXT:-.cjs}"

        echo "──────────────────────────────────────────────" | tee -a "$LOG_DIR/migration.log"
        echo "🆕 Preparing migration for version: $ver" | tee -a "$LOG_DIR/migration.log"
        echo "MIG_URL  :: $MIG_URL" | tee -a "$LOG_DIR/migration.log"
        echo "MIG_FILE :: $MIG_FILE" | tee -a "$LOG_DIR/migration.log"

        if [ -n "$MIG_URL" ] && [ "$MIG_URL" != "null" ]; then
            echo "📥 Downloading migration for version $ver..." | tee -a "$LOG_DIR/migration.log"
            curl -s -L -o "$MIG_FILE" "$MIG_URL" 2>> "$LOG_DIR/migration.log"

            if [ ! -s "$MIG_FILE" ]; then
                echo "⚠️ Failed to download or file empty for $ver — check migration.log" | tee -a "$LOG_DIR/migration.log"
                rm -f "$MIG_FILE" >/dev/null 2>&1 || true
                continue
            fi

            echo "▶️ Running migration for version $ver..." | tee -a "$LOG_DIR/migration.log"
            (
                cd "$APP_INSTALL_DIR" 2>/dev/null || true

                # Load .env if present
                [ -f ".env" ] && export $(grep -v '^#' .env | xargs) >/dev/null 2>&1

                echo "📂 Using NODE_PATH=$APP_INSTALL_DIR/node_modules" | tee -a "$LOG_DIR/migration.log"

                # Run migration safely with local node_modules, assuming mongodb package is installed
                NODE_PATH="$APP_INSTALL_DIR/node_modules" node "$MIG_FILE" >> "$LOG_DIR/migration.log" 2>&1 || true
            )

            rm -f "$MIG_FILE" >/dev/null 2>&1 || true
            echo "✅ Migration for $ver completed (see migration.log for details)." | tee -a "$LOG_DIR/migration.log"
        else
            echo "ℹ️ No migration URL found for version $ver — skipping." | tee -a "$LOG_DIR/migration.log"
        fi
    done

    echo "✅ All available migrations processed (failures skipped safely)." | tee -a "$LOG_DIR/migration.log"
}



# ------------------------------------------------
# Nginx Setup Script
# ------------------------------------------------
setup_nginx() {
    local NGINX_SCRIPT="$HOME/.myapp/nginx_setup.sh"
    echo "🚀 Generating and running Nginx setup script..."

    cat <<-EOF > "$NGINX_SCRIPT"
	#!/bin/bash
	set -euo pipefail

	# ================================================
	# Nginx Setup Script for HireTrack Application
	# ================================================
	# This script must be run AFTER the main installation
	# It handles:
	# 1. Domain name collection from user
	# 2. Nginx installation
	# 3. SSL certificate setup (Let's Encrypt)
	# 4. Nginx configuration with proper proxy setup
	# 5. Include HTTPS block in configuration
	# ================================================

	echo "🚀 Starting Nginx Setup..."

	# ------------------------------------------------
	# Configuration Paths
	# ------------------------------------------------
	CONFIG_PATH="$HOME/.myapp/config.json"
	APP_PORT="\${APP_PORT:-3000}"
	NGINX_BACKUP_DIR="$HOME/.myapp/nginx-backups"
	NGINX_CONF_DIR="/etc/nginx/sites-available"
	NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"

	# Global variables
	DOMAIN_NAME=""
	EMAIL=""

	# ------------------------------------------------
	# Detect OS
	# ------------------------------------------------
	OS_TYPE=\$(uname | tr '[:upper:]' '[:lower:]')
	echo "🖥️  Detected OS: \$OS_TYPE"

	# ------------------------------------------------
	# Set OS-specific paths
	# ------------------------------------------------
	if [[ "\$OS_TYPE" == "darwin" ]]; then
	    NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
	    NGINX_ENABLED_DIR=""  # macOS doesn't use sites-enabled
	    LOG_DIR="/usr/local/var/log/nginx"
	else
	    LOG_DIR="/var/log/nginx"
	fi

	mkdir -p "\$NGINX_BACKUP_DIR"
	mkdir -p "\$LOG_DIR" 2>/dev/null || sudo mkdir -p "\$LOG_DIR"

	# ------------------------------------------------
	# Dependency check function
	# ------------------------------------------------
	check_dep() {
	    local CMD=\$1
	    if ! command -v "\$CMD" >/dev/null 2>&1; then
		echo "⚠️  \$CMD not found. Installing..."
		if command -v apt-get >/dev/null 2>&1; then
		    sudo apt-get update
		    sudo apt-get install -y "\$CMD"
		elif command -v yum >/dev/null 2>&1; then
		    sudo yum install -y "\$CMD"
		elif [[ "\$OS_TYPE" == "darwin" ]] && command -v brew >/dev/null 2>&1; then
		    brew install "\$CMD"
		else
		    echo "❌ Cannot install \$CMD automatically. Please install it manually."
		    exit 1
		fi
	    fi
	    echo "✅ \$CMD is available."
	}

	check_dep curl
	check_dep jq

	# ------------------------------------------------
	# Prompt for domain name
	# ------------------------------------------------
	prompt_for_domain() {
	    echo ""
	    echo "════════════════════════════════════════════════"
	    echo "  Domain Configuration"
	    echo "════════════════════════════════════════════════"
	    echo ""
	    echo "Please enter the domain name for your HireTrack instance."
	    echo "Examples:"
	    echo "  - release.hiretrack.in"
	    echo "  - demo.yourcompany.com"
	    echo "  - localhost (for local testing only)"
	    echo ""

	    while true; do
		read -p "🌐 Enter domain name: " DOMAIN_NAME

		# Trim whitespace
		DOMAIN_NAME=\$(echo "\$DOMAIN_NAME" | xargs)

		# Check if empty
		if [ -z "\$DOMAIN_NAME" ]; then
		    echo "❌ Domain name cannot be empty. Please try again."
		    echo ""
		    continue
		fi

		# Basic domain validation
		if [[ "\$DOMAIN_NAME" == "localhost" ]]; then
		    echo "⚠️  Using localhost (HTTP only, no SSL)"
		    break
		elif echo "\$DOMAIN_NAME" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\$'; then
		    echo "✅ Domain accepted: \$DOMAIN_NAME"
		    break
		else
		    echo "❌ Invalid domain format. Please use a valid domain like 'release.hiretrack.in'"
		    echo ""
		fi
	    done

	    # Confirm domain
	    echo ""
	    echo "📋 Domain Summary:"
	    echo "   Domain: \$DOMAIN_NAME"
	    echo ""
	    read -p "Is this correct? (Y/n): " CONFIRM

	    if [[ "\$CONFIRM" =~ ^[Nn]\$ ]]; then
		echo "❌ Aborted. Please run the script again."
		exit 1
	    fi

	    echo ""
	    echo "✅ Domain confirmed: \$DOMAIN_NAME"
	}

	# ------------------------------------------------
	# Prompt for email
	# ------------------------------------------------
	prompt_for_email() {
	    # Try to get email from config first
	    if [ -f "\$CONFIG_PATH" ]; then
		EMAIL=\$(jq -r '.email // empty' "\$CONFIG_PATH" 2>/dev/null || echo "")
	    fi

	    if [ -n "\$EMAIL" ]; then
		echo "✅ Using email from config: \$EMAIL"
		return
	    fi

	    echo ""
	    echo "📧 Email is required for SSL certificate registration (Let's Encrypt)"
	    echo ""

	    while true; do
		read -p "Enter your email address: " EMAIL

		# Trim whitespace
		EMAIL=\$(echo "\$EMAIL" | xargs)

		# Validate email format
		if [ -z "\$EMAIL" ]; then
		    echo "❌ Email cannot be empty."
		    continue
		elif echo "\$EMAIL" | grep -qE '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\$'; then  
		    echo "✅ Email accepted: \$EMAIL"
		    break
		else
		    echo "❌ Invalid email format. Please try again."
		fi
	    done
	}

	# ------------------------------------------------
	# Save domain to config
	# ------------------------------------------------
	save_domain_to_config() {
	    if [ -f "\$CONFIG_PATH" ]; then
		# Update existing config
		local TEMP_FILE
		TEMP_FILE=\$(mktemp)
		jq --arg domain "\$DOMAIN_NAME" '.serverName=\$domain' "\$CONFIG_PATH" > "\$TEMP_FILE"      
		mv "\$TEMP_FILE" "\$CONFIG_PATH"
		echo "✅ Domain saved to config: \$CONFIG_PATH"
	    else
		# Create new config
		mkdir -p "\$(dirname "\$CONFIG_PATH")"
		echo "{\"serverName\": \"\$DOMAIN_NAME\", \"email\": \"\$EMAIL\"}" > "\$CONFIG_PATH"       
		echo "✅ Config created with domain and email: \$CONFIG_PATH"
	    fi
	}

	# ------------------------------------------------
	# Check DNS resolution
	# ------------------------------------------------
	check_dns_resolution() {
	    if [ "\$DOMAIN_NAME" == "localhost" ]; then
		return 0
	    fi

	    echo ""
	    echo "🔍 Checking DNS resolution for \$DOMAIN_NAME..."

	    local DNS_IP
	    DNS_IP=\$(host "\$DOMAIN_NAME" 2>/dev/null | grep "has address" | head -n1 | awk '{print \$NF}')

	    if [ -z "\$DNS_IP" ]; then
		DNS_IP=\$(nslookup "\$DOMAIN_NAME" 2>/dev/null | grep "Address:" | tail -n1 | awk '{print \$NF}')
	    fi

	    if [ -n "\$DNS_IP" ]; then
		echo "✅ Domain resolves to: \$DNS_IP"

		# Get server's public IP
		local SERVER_IP
		SERVER_IP=\$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "unknown")

		if [ "\$SERVER_IP" != "unknown" ]; then
		    echo "   Server's public IP: \$SERVER_IP"

		    if [ "\$DNS_IP" == "\$SERVER_IP" ]; then
			echo "   ✅ DNS points to this server!"
		    else
			echo "   ⚠️  WARNING: DNS (\$DNS_IP) does not point to this server (\$SERVER_IP)" 
			echo "   SSL certificate generation may fail."
			echo ""
			read -p "Continue anyway? (y/N): " CONTINUE
			if [[ ! "\$CONTINUE" =~ ^[Yy]\$ ]]; then
			    echo "❌ Aborted. Please update your DNS records first."
			    exit 1
			fi
		    fi
		fi
	    else
		echo "⚠️  WARNING: Cannot resolve \$DOMAIN_NAME"
		echo "   Please ensure DNS is configured correctly."
		echo "   Your domain must point to this server's IP address."
		echo ""
		read -p "Continue anyway? (y/N): " CONTINUE
		if [[ ! "\$CONTINUE" =~ ^[Yy]\$ ]]; then
		    echo "❌ Aborted. Please configure DNS first."
		    exit 1
		fi
	    fi
	}

	# ------------------------------------------------
	# Check if application is running
	# ------------------------------------------------
	check_application() {
	    echo ""
	    echo "🔍 Checking if application is running on port \$APP_PORT..."
	    if ! lsof -Pi :\$APP_PORT -sTCP:LISTEN -t >/dev/null 2>&1 && ! netstat -an 2>/dev/null | grep -q ":\$APP_PORT.*LISTEN"; then
		echo "⚠️  WARNING: No service detected on port \$APP_PORT"
		echo "Please ensure your HireTrack application is running before continuing."
		read -p "Continue anyway? (y/N): " CONTINUE
		if [[ ! "\$CONTINUE" =~ ^[Yy]\$ ]]; then
		    echo "❌ Aborted. Please start your application first with:"
		    echo "   pm2 list  # Check running apps"
		    exit 1
		fi
	    else
		echo "✅ Application is running on port \$APP_PORT"
	    fi
	}

	# ------------------------------------------------
	# Install Nginx
	# ------------------------------------------------
	install_nginx() {
	    if command -v nginx >/dev/null 2>&1; then
		echo "✅ Nginx already installed (\$(nginx -v 2>&1 | cut -d'/' -f2))"
		return
	    fi

	    echo ""
	    echo "📦 Installing Nginx..."
	    if [[ "\$OS_TYPE" == "linux" ]]; then
		if command -v apt-get >/dev/null 2>&1; then
		    sudo apt-get update
		    sudo apt-get install -y nginx
		elif command -v yum >/dev/null 2>&1; then
		    sudo yum install -y epel-release
		    sudo yum install -y nginx
		else
		    echo "❌ Unsupported Linux package manager. Install Nginx manually."
		    exit 1
		fi
	    elif [[ "\$OS_TYPE" == "darwin" ]]; then
		if ! command -v brew >/dev/null 2>&1; then
		    echo "❌ Homebrew not found. Install Homebrew first from https://brew.sh"
		    exit 1
		fi
		brew install nginx
	    else
		echo "❌ Unsupported OS: \$OS_TYPE"
		exit 1
	    fi

	    if ! command -v nginx >/dev/null 2>&1; then
		echo "❌ Nginx installation failed."
		exit 1
	    fi

	    echo "✅ Nginx installed successfully."
	}

	# ------------------------------------------------
	# Start Nginx service
	# ------------------------------------------------
	start_nginx() {
	    echo ""
	    echo "▶️  Starting Nginx service..."

	    if [[ "\$OS_TYPE" == "linux" ]]; then
		sudo systemctl start nginx 2>/dev/null || true
		sudo systemctl enable nginx 2>/dev/null || true
	    elif [[ "\$OS_TYPE" == "darwin" ]]; then
		# Ensure nginx.conf includes servers directory
		if ! grep -q "include.*servers/\*" /usr/local/etc/nginx/nginx.conf 2>/dev/null; then    
		    echo "📝 Configuring Nginx to include servers directory..."
		    sudo sed -i '' '/http {/a\
    include /usr/local/etc/nginx/servers/*;
' /usr/local/etc/nginx/nginx.conf 2>/dev/null || {
			echo "⚠️  Please manually add this line to /usr/local/etc/nginx/nginx.conf:"    
			echo "   include /usr/local/etc/nginx/servers/*;"
			echo "   (inside the http {} block)"
		    }
		fi
		brew services start nginx
	    fi

	    sleep 2

	    if pgrep -x "nginx" >/dev/null; then
		echo "✅ Nginx is running"
	    else
		echo "❌ Nginx failed to start. Checking for errors..."
		sudo nginx -t
		exit 1
	    fi
	}

	# ------------------------------------------------
	# Setup SSL Certificate (Let's Encrypt)
	# ------------------------------------------------
	setup_ssl_certificate() {
	    local USE_HTTPS="false"
	    local CERT_PATH="/etc/letsencrypt/live/\$DOMAIN_NAME/fullchain.pem"
	    local KEY_PATH="/etc/letsencrypt/live/\$DOMAIN_NAME/privkey.pem"

	    echo ""
	    echo "🔐 Setting up SSL Certificate for \$DOMAIN_NAME..."

	    # Skip SSL for localhost
	    if [ "\$DOMAIN_NAME" == "localhost" ]; then
		echo "⚠️  Localhost detected. Skipping SSL setup (will use HTTP only)."
		echo "false"
		return
	    fi

	    # Install certbot if not present
	    echo "📦 Installing certbot for Let's Encrypt..."
	    if ! command -v certbot >/dev/null 2>&1; then
		if command -v snap >/dev/null 2>&1; then
		    echo "Installing certbot via snap..."
		    sudo snap install --classic certbot 2>/dev/null || true
		    sudo ln -sf /snap/bin/certbot /usr/bin/certbot 2>/dev/null || true
		elif command -v apt-get >/dev/null 2>&1; then
		    sudo apt-get update
		    sudo apt-get install -y certbot python3-certbot-nginx
		elif command -v yum >/dev/null 2>&1; then
		    sudo yum install -y certbot python3-certbot-nginx
		else
		    echo "❌ Cannot install certbot automatically."
		    echo "Please install certbot manually: https://certbot.eff.org/"
		    USE_HTTPS="false"
		    echo "\$USE_HTTPS"
		    return
		fi
	    fi

	    if ! command -v certbot >/dev/null 2>&1; then
		echo "❌ Certbot installation failed. Using HTTP only."
		USE_HTTPS="false"
		echo "\$USE_HTTPS"
		return
	    fi

	    echo "✅ Certbot is ready"

	    # Pre-flight checks
	    echo ""
	    echo "🔍 Pre-flight checks for SSL certificate..."
	    echo "   1. Domain: \$DOMAIN_NAME"
	    echo "   2. Email: \$EMAIL"

	    # Check port 80
	    echo "   3. Checking if port 80 is accessible..."
	    if sudo netstat -tlnp 2>/dev/null | grep -q ":80" || sudo lsof -i :80 2>/dev/null | grep -q nginx; then
		echo "   ✅ Port 80 is accessible"
	    else
		echo "   ⚠️  Port 80 may not be accessible (needed for Let's Encrypt verification)"     
	    fi

	    # Obtain or renew certificate
	    echo ""
	    echo "🔐 Obtaining/renewing Let's Encrypt certificate for \$DOMAIN_NAME..."
	    echo ""
	    echo "This will:"
	    echo "  - Verify domain ownership via HTTP-01 challenge"
	    echo "  - Install certificates at /etc/letsencrypt/live/\$DOMAIN_NAME/"
	    echo "  - Setup auto-renewal via certbot timer"
	    echo ""
	    read -p "Proceed with SSL certificate generation/renewal? (Y/n): " PROCEED_SSL

	    if [[ "\$PROCEED_SSL" =~ ^[Nn]\$ ]]; then
		echo "⚠️  Skipping SSL setup. Using HTTP only."
		USE_HTTPS="false"
		echo "\$USE_HTTPS"
		return
	    fi

	    # Try standalone mode
	    if sudo certbot certonly \
		--standalone \
		--non-interactive \
		--agree-tos \
		--email "\$EMAIL" \
		--preferred-challenges http \
		-d "\$DOMAIN_NAME" \
		--pre-hook "systemctl stop nginx 2>/dev/null || true" \
		--post-hook "systemctl start nginx 2>/dev/null || true" 2>&1 | tee /tmp/certbot_\$DOMAIN_NAME.log; then

		USE_HTTPS="true"
		echo ""
		echo "✅ Successfully obtained/renewed Let's Encrypt certificate for \$DOMAIN_NAME!"     
		echo "   Certificate: \$CERT_PATH"
		echo "   Private Key: \$KEY_PATH"
		echo "   Auto-renewal is configured via certbot timer."
	    else
		echo ""
		echo "❌ Failed to obtain/renew Let's Encrypt certificate for \$DOMAIN_NAME."
		echo ""
		echo "Common issues:"
		echo "  1. Domain '\$DOMAIN_NAME' doesn't point to this server"
		echo "  2. Firewall blocking port 80/443"
		echo "  3. Another service using port 80"
		echo ""
		echo "Check logs at: /tmp/certbot_\$DOMAIN_NAME.log"
		echo ""

		read -p "Proceed with HTTP only? (Y/n): " PROCEED_HTTP
		if [[ "\$PROCEED_HTTP" =~ ^[Nn]\$ ]]; then
		    echo "❌ Aborting. Please fix DNS/firewall issues and try again."
		    exit 1
		fi

		echo "⚠️  Proceeding with HTTP only for \$DOMAIN_NAME."
		echo "   You can add HTTPS later with:"
		echo "   sudo certbot certonly --nginx -d \$DOMAIN_NAME"
		USE_HTTPS="false"
	    fi

	    echo "\$USE_HTTPS"
	}

	# ------------------------------------------------
	# Configure Nginx
	# ------------------------------------------------
	configure_nginx() {
	    local USE_HTTPS="\$1"
	    local NGINX_CONF_FILE
	    local CERT_PATH="/etc/letsencrypt/live/\$DOMAIN_NAME/fullchain.pem"
	    local KEY_PATH="/etc/letsencrypt/live/\$DOMAIN_NAME/privkey.pem"

	    echo ""
	    echo "📝 Configuring Nginx for \$DOMAIN_NAME..."

	    # Set configuration file path
	    if [[ "\$OS_TYPE" == "linux" ]]; then
		NGINX_CONF_FILE="\$NGINX_CONF_DIR/\$DOMAIN_NAME"
		NGINX_ENABLED_FILE="\$NGINX_ENABLED_DIR/\$DOMAIN_NAME"
	    elif [[ "\$OS_TYPE" == "darwin" ]]; then
		NGINX_CONF_FILE="\$NGINX_CONF_DIR/\$DOMAIN_NAME"
		mkdir -p "\$NGINX_CONF_DIR"
	    fi

	    # Backup existing configuration
	    if [ -f "\$NGINX_CONF_FILE" ]; then
		local BACKUP_FILE="\$NGINX_BACKUP_DIR/\$DOMAIN_NAME.backup.\$(date +%s)"
		sudo cp "\$NGINX_CONF_FILE" "\$BACKUP_FILE"
		echo "📦 Backed up existing config to: \$BACKUP_FILE"
	    fi

	    # Generate HTTP configuration
	    local NGINX_CONF_CONTENT=\$(cat <<INNEREOF
# HireTrack Nginx Configuration
# Generated on: \$(date)
# Domain: \$DOMAIN_NAME
# Port: \$APP_PORT

server {
    listen 80;
    listen [::]:80;
    server_name \$DOMAIN_NAME;

    # Redirect HTTP to HTTPS if HTTPS is enabled
    \$( [ "\$USE_HTTPS" = "true" ] && echo "return 301 https://\\\$server_name\\\$request_uri;" || echo "" )

    client_max_body_size 500M;
    chunked_transfer_encoding on;

    # Buffer sizes
    proxy_buffer_size 256k;
    proxy_buffers 8 256k;
    proxy_busy_buffers_size 512k;
    large_client_header_buffers 4 16k;

    location / {
        proxy_pass http://localhost:\$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_buffering off;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Specific location for assets
    location /assets {
        proxy_pass http://localhost:\$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_buffering off;
        gzip off;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    error_log \$LOG_DIR/\${DOMAIN_NAME}.error.log;
    access_log \$LOG_DIR/\${DOMAIN_NAME}.access.log;
}
INNEREOF
)

	    # Append HTTPS block if not localhost
	    if [ "\$DOMAIN_NAME" != "localhost" ]; then
		NGINX_CONF_CONTENT+=\$(cat <<INNEREOF

# HTTPS server block
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name \$DOMAIN_NAME;

    client_max_body_size 500M;
    chunked_transfer_encoding on;

    # SSL configuration
    ssl_certificate \$CERT_PATH;
    ssl_certificate_key \$KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    add_header Strict-Transport-Security "max-age=63072000; includeSubdomains; preload";

    # Buffer sizes
    proxy_buffer_size 256k;
    proxy_buffers 8 256k;
    proxy_busy_buffers_size 512k;
    large_client_header_buffers 4 16k;

    location / {
        proxy_pass http://localhost:\$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_buffering off;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Specific location for assets
    location /assets {
        proxy_pass http://localhost:\$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_buffering off;
        gzip off;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    error_log \$LOG_DIR/\${DOMAIN_NAME}.error.log;
    access_log \$LOG_DIR/\${DOMAIN_NAME}.access.log;
}
INNEREOF
)
	    fi

	    # Write configuration file
	    echo "\$NGINX_CONF_CONTENT" | sudo tee "\$NGINX_CONF_FILE" >/dev/null
	    echo "✅ Configuration written to: \$NGINX_CONF_FILE"

	    # Enable site on Linux
	    if [[ "\$OS_TYPE" == "linux" ]]; then
		if [ ! -L "\$NGINX_ENABLED_FILE" ]; then
		    sudo ln -sf "\$NGINX_CONF_FILE" "\$NGINX_ENABLED_FILE"
		    echo "✅ Site enabled at: \$NGINX_ENABLED_FILE"
		fi
	    fi

	    # Test configuration
	    echo ""
	    echo "🧪 Testing Nginx configuration..."
	    if sudo nginx -t; then
		echo "✅ Configuration test passed!"
	    else
		echo "❌ Configuration test failed!"
		echo ""
		echo "Rolling back to previous configuration..."
		if [ -f "\$NGINX_BACKUP_DIR/\$DOMAIN_NAME.backup."* ]; then
		    local LATEST_BACKUP=\$(ls -t "\$NGINX_BACKUP_DIR"/\$DOMAIN_NAME.backup.* 2>/dev/null | head -n1)
		    if [ -n "\$LATEST_BACKUP" ]; then
			sudo cp "\$LATEST_BACKUP" "\$NGINX_CONF_FILE"
			echo "✅ Rolled back to: \$LATEST_BACKUP"
		    fi
		fi
		exit 1
	    fi

	    # Reload Nginx
	    echo ""
	    echo "🔄 Reloading Nginx..."
	    if [[ "\$OS_TYPE" == "linux" ]]; then
		sudo systemctl reload nginx
	    elif [[ "\$OS_TYPE" == "darwin" ]]; then
		brew services restart nginx
	    fi

	    sleep 2

	    if pgrep -x "nginx" >/dev/null; then
		echo "✅ Nginx reloaded successfully!"
	    else
		echo "❌ Nginx failed to reload!"
		exit 1
	    fi
	}

	# ------------------------------------------------
	# Verify setup
	# ------------------------------------------------
	verify_setup() {
	    local USE_HTTPS="\$1"

	    echo ""
	    echo "🔍 Verifying setup for \$DOMAIN_NAME..."

	    # Check Nginx process
	    if pgrep -x "nginx" >/dev/null; then
		echo "✅ Nginx process is running"
	    else
		echo "❌ Nginx process not found"
		return 1
	    fi

	    # Test HTTP
	    echo ""
	    echo "Testing HTTP connection to \$DOMAIN_NAME..."
	    local HTTP_CODE
	    HTTP_CODE=\$(curl -s -o /dev/null -w "%{http_code}" "http://localhost" -H "Host: \$DOMAIN_NAME" 2>/dev/null || echo "000")

	    if [[ "\$HTTP_CODE" =~ ^(200|301|302|404)\$ ]]; then
		echo "✅ HTTP connection successful (Status: \$HTTP_CODE)"
	    else
		echo "⚠️  HTTP connection returned status: \$HTTP_CODE"
	    fi

	    # Test HTTPS if enabled
	    if [ "\$USE_HTTPS" = "true" ] || [ "\$DOMAIN_NAME" != "localhost" ]; then
		echo ""
		echo "Testing HTTPS connection to \$DOMAIN_NAME..."
		local HTTPS_CODE
		HTTPS_CODE=\$(curl -s -o /dev/null -w "%{http_code}" "https://\$DOMAIN_NAME" --insecure 2>/dev/null || echo "000")

		if [[ "\$HTTPS_CODE" =~ ^(200|301|302|404)\$ ]]; then
		    echo "✅ HTTPS connection successful (Status: \$HTTPS_CODE)"
		else
		    echo "⚠️  HTTPS connection returned status: \$HTTPS_CODE"
		fi
	    fi

	    # Show log file paths
	    echo ""
	    echo "📋 Log files for \$DOMAIN_NAME:"
	    echo "   - Error log:  \$LOG_DIR/\${DOMAIN_NAME}.error.log"
	    echo "   - Access log: \$LOG_DIR/\${DOMAIN_NAME}.access.log"

	    # Show recent errors if any
	    if [ -f "\$LOG_DIR/\${DOMAIN_NAME}.error.log" ]; then
		local ERROR_COUNT
		ERROR_COUNT=\$(sudo tail -n 50 "\$LOG_DIR/\${DOMAIN_NAME}.error.log" 2>/dev/null | grep -c "error" || echo "0")
		if [ "\$ERROR_COUNT" -gt 0 ] 2>/dev/null; then
		    echo "   ⚠️  Found \$ERROR_COUNT recent errors. Check logs with:"
		    echo "      sudo tail -f \$LOG_DIR/\${DOMAIN_NAME}.error.log"
		fi
	    fi
	}

	# ------------------------------------------------
	# Print summary
	# ------------------------------------------------
	print_summary() {
	    local USE_HTTPS="\$1"

	    echo ""
	    echo "════════════════════════════════════════════════"
	    echo "✅ Nginx Setup Complete!"
	    echo "════════════════════════════════════════════════"
	    echo ""
	    echo "📋 Configuration Summary:"
	    echo "   - Domain Name: \$DOMAIN_NAME"
	    echo "   - Application Port: \$APP_PORT"
	    echo "   - Protocol: \$( [ "\$USE_HTTPS" = "true" ] || [ "\$DOMAIN_NAME" != "localhost" ] && echo "HTTP & HTTPS" || echo "HTTP only")"
	    echo ""

	    if [ "\$USE_HTTPS" = "true" ] || [ "\$DOMAIN_NAME" != "localhost" ]; then
		echo "🔐 SSL/TLS:"
		echo "   - Certificate: /etc/letsencrypt/live/\$DOMAIN_NAME/fullchain.pem"
		echo "   - Auto-renewal: Enabled (certbot timer)"
		echo "   - Test renewal: sudo certbot renew --dry-run"
		echo ""
	    fi

	    echo "🌐 Access your application:"
	    if [ "\$USE_HTTPS" = "true" ] || [ "\$DOMAIN_NAME" != "localhost" ]; then
		echo "   - https://\$DOMAIN_NAME"
		echo "   - http://\$DOMAIN_NAME (redirects to HTTPS)"
	    else
		echo "   - http://\$DOMAIN_NAME"
	    fi
	    echo ""

	    echo "📝 Nginx Commands:"
	    if [[ "\$OS_TYPE" == "linux" ]]; then
		echo "   - Test config:   sudo nginx -t"
		echo "   - Reload:        sudo systemctl reload nginx"
		echo "   - Restart:       sudo systemctl restart nginx"
		echo "   - Status:        sudo systemctl status nginx"
		echo "   - Logs:          sudo journalctl -u nginx -f"
	    elif [[ "\$OS_TYPE" == "darwin" ]]; then
		echo "   - Test config:   sudo nginx -t"
		echo "   - Reload:        brew services restart nginx"
		echo "   - Status:        brew services list | grep nginx"
		echo "   - Logs:          tail -f \$LOG_DIR/\${DOMAIN_NAME}.error.log"
	    fi
	    echo ""

	    echo "📁 Files:"
	    echo "   - Config:  \$( [ "\$OS_TYPE" == "linux" ] && echo "\$NGINX_CONF_DIR/\$DOMAIN_NAME" || echo "\$NGINX_CONF_DIR/\$DOMAIN_NAME")"
	    echo "   - Backups: \$NGINX_BACKUP_DIR/"
	    echo "   - Logs:    \$LOG_DIR/"
	    echo ""

	    if [ "\$USE_HTTPS" = "false" ] && [ "\$DOMAIN_NAME" != "localhost" ]; then
		echo "🔐 To add HTTPS later:"
		echo "   1. Ensure DNS points to this server"
		echo "   2. Run: sudo certbot certonly --nginx -d \$DOMAIN_NAME"
		echo "   3. Re-run this script or manually update Nginx config"
		echo ""
	    fi

	    echo "You can register the first organization from the URL given below: "
            echo "https://\$DOMAIN_NAME/register/org"

	    echo "════════════════════════════════════════════════"
	}

	# ------------------------------------------------
	# Cleanup function for errors
	# ------------------------------------------------
	cleanup_on_error() {
	    echo ""
	    echo "❌ Setup failed. Cleaning up..."

	    # Restore backup if exists
	    if [ -f "\$NGINX_BACKUP_DIR/\$DOMAIN_NAME.backup."* ]; then
		local LATEST_BACKUP=\$(ls -t "\$NGINX_BACKUP_DIR"/\$DOMAIN_NAME.backup.* 2>/dev/null | head -n1)
		if [ -n "\$LATEST_BACKUP" ]; then
		    echo "🔄 Restoring previous configuration..."
		    sudo cp "\$LATEST_BACKUP" "\$NGINX_CONF_DIR/\$DOMAIN_NAME" 2>/dev/null || true
		    sudo nginx -t && sudo systemctl reload nginx 2>/dev/null || brew services restart nginx 2>/dev/null
		fi
	    fi

	    echo "Please check the error messages above and try again."
	    exit 1
	}

	trap cleanup_on_error ERR

	# ------------------------------------------------
	# Main execution flow
	# ------------------------------------------------
	main() {
	    echo "════════════════════════════════════════════════"
	    echo "  HireTrack Nginx Setup Script"
	    echo "════════════════════════════════════════════════"
	    echo ""

	    # Step 1: Prompt for domain name
	    prompt_for_domain

	    # Step 2: Prompt for email
	    prompt_for_email

	    # Step 3: Save domain and email to config
	    save_domain_to_config

	    # Step 4: Check DNS resolution
	    check_dns_resolution

	    # Step 5: Check if application is running
	    check_application

	    # Step 6: Install Nginx
	    install_nginx

	    # Step 7: Start Nginx
	    start_nginx

	    # Step 8: Setup SSL
	    local USE_HTTPS
	    USE_HTTPS=\$(setup_ssl_certificate)

	    # Step 9: Configure Nginx with HTTP and HTTPS (if not localhost)
	    configure_nginx "\$USE_HTTPS"

	    # Step 10: Verify setup
	    verify_setup "\$USE_HTTPS"

	    # Step 11: Print summary
	    print_summary "\$USE_HTTPS"
	}

	# Run main function
	main
	EOF

    chmod +x "$NGINX_SCRIPT"
    echo "✅ Nginx setup script created at $NGINX_SCRIPT"

    # Execute Nginx setup script
    echo "▶️ Running Nginx setup..."
    bash "$NGINX_SCRIPT" || {
        echo "❌ Nginx setup failed. Check logs and try setting up the domain again by using the --domain command."
        exit 1
    }
    echo "✅ Nginx setup completed."
}

# ------------------------------------------------
# Restart PM2 Service
# ------------------------------------------------
restart_pm2_service() {
    local VERSION_NAME=$(jq -r '.installedVersion // empty' "$CONFIG_PATH")
    if [ -z "$VERSION_NAME" ]; then
        echo "❌ No installed version found in config. Cannot restart PM2 service."
        return 1
    fi

    echo "🔄 Restarting PM2 service for hiretrack-$VERSION_NAME..."
    pm2 restart "hiretrack-$VERSION_NAME" || {
        echo "❌ Failed to restart PM2 service hiretrack-$VERSION_NAME."
        return 1
    }
    pm2 save --force
    echo "✅ PM2 service hiretrack-$VERSION_NAME restarted successfully."
}

# ------------------------------------------------
# Cron Setup
# ------------------------------------------------
setup_cron() {
    local OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')
    local CRON_NAME="hiretrack-autoupdate"
    local CRON_ENTRY="*/2 * * * * PATH=/usr/local/bin:/usr/bin:/bin bash $SCRIPT_PATH --update >> $CRON_LOG_FILE 2>&1"

    if [[ "$OS_TYPE" == "linux" || "$OS_TYPE" == "darwin" ]]; then
        local CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

        # Check if the exact cron command already exists
        if ! echo "$CURRENT_CRON" | grep -Fq "$CRON_ENTRY"; then
            # Append comment and cron command
            (echo "$CURRENT_CRON"; echo "# CRON_NAME:$CRON_NAME"; echo "$CRON_ENTRY") | crontab -
            echo "✅ Cron job '$CRON_NAME' added. Logs: $CRON_LOG_FILE"
        else
            echo "✅ Cron job '$CRON_NAME' already exists. Logs: $CRON_LOG_FILE"
        fi
    else
        echo "❌ Unsupported OS: $OS_TYPE. Cannot setup cron."
    fi
}

# ------------------------------------------------
# Full Installation
# ------------------------------------------------
install_all() {
    local EMAIL="$1"
    [ -z "$EMAIL" ] && EMAIL=$(prompt_for_email)
    echo "==== Starting installation for $EMAIL ===="

    create_default_config "$EMAIL"
    [ ! -f "$LICENSE_PATH" ] && register_license "$EMAIL"
    check_update_and_install
    setup_cron
    setup_nginx
    restart_pm2_service

    echo "==== Installation complete! ===="
    exit 0
}
    # --help)
    #     echo "Usage: $0 [--install [email]] [--register [email]] [--update] [--setup-cron]"
    #     exit 0
    #     ;;

# ------------------------------------------------
# Main Entry Point
# ------------------------------------------------
check_dep curl
check_dep jq
check_dep tar
check_dep shasum
check_pm2

case "${1:-}" in
    --install)
        install_all "${2:-}"
        ;;
    --register)
        register_license "${2:-}"
        ;;
    --update)
	    check_update_and_install "${2:-}" 
       	;;
    --run-migrations)
        run_migrations "${2:-}" "${3:-}"
        ;;
    --rollback)
        VERSION_TO_USE="${2:-}"

        # If version is "none", return 1
        if [ "$VERSION_TO_USE" = "none" ]; then
            echo "❌ No previous version found to rollback."
            return 1
        fi

        # If version is empty, prompt the user
        if [ -z "$VERSION_TO_USE" ]; then
            VERSION_TO_USE=$(prompt_for_version) || exit 1
        fi

        rollback "$VERSION_TO_USE"
        ;;
    --setup-cron)
        setup_cron
        ;;
    --domain)
        setup_nginx
        ;;
    --update-license)
        update_license "${2:-}"
        ;;
    --help)
        echo "Usage:"
        echo "  $0 [command] [options]"
        echo
        echo "Commands:"
        echo "  --install [email]             Install the application (optionally register with email)"
        echo "  --update [mode]               Check for and install updates"
        echo "                                Example: $0 --update manual"
        echo "  --run-migrations [from] [to]  Run database migrations between versions"
        echo "                                Example: $0 --run-migrations 2.2.25 2.2.26"
        echo "  --rollback [version]          Roll back to a specific or previous version"
        echo "                                Example: $0 --rollback 2.2.25"
        echo "  --setup-cron                  Set up automatic update cron job"
        echo "  --domain                      Configure domain and Nginx setup"
        echo "  --update-license [key]        Update the license key manually"
        echo "  --help                        Show this help message and exit"
        echo
        exit 0
        ;;
    *)
        install_all "${2:-}"
        ;;
esac
