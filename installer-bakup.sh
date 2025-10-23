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
    if [ -z "$LICENSE_KEY" ] || [ "$LICENSE_KEY" == "null" ]; then
        echo "❌ License registration failed: $(echo "$RESPONSE" | jq -r '.message // "Unknown error"')"
        exit 1
    fi

    echo "{\"licenseKey\":\"$LICENSE_KEY\", \"email\":\"$EMAIL_RES\"}" > "$LICENSE_PATH"
    echo "✅ License registered. Key saved to $LICENSE_PATH"
    write_config "email" "$EMAIL_RES"
}

update_license() {
    local EMAIL="$1"
    [ -z "$EMAIL" ] && EMAIL=$(prompt_for_update)
    local MACHINE_CODE=$(get_machine_code)
    local EXISTING_LICENSE_KEY
    EXISTING_LICENSE_KEY=$(jq -r '.licenseKey // empty' "$LICENSE_PATH" 2>/dev/null || echo "")

    if [ -z "$EXISTING_LICENSE_KEY" ]; then
        echo "❌ No existing license found. Please register first."
        exit 1
    fi

    local RESPONSE
    RESPONSE=$(curl -s -X POST "$API_URL_UPDATE_LIC" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"machineCode\":\"$MACHINE_CODE\",\"licenseKey\":\"$EXISTING_LICENSE_KEY\"}")
    echo "RESPONSE-UPDATE: $RESPONSE"

    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ License update failed: Invalid response."
        exit 1
    fi

    local NEW_LICENSE_KEY EMAIL_RES
    NEW_LICENSE_KEY=$(echo "$RESPONSE" | jq -r '.license.licenseKey')
    EMAIL_RES=$(echo "$RESPONSE" | jq -r '.license.email')
    if [ -z "$NEW_LICENSE_KEY" ] || [ "$NEW_LICENSE_KEY" == "null" ]; then
        echo "❌ License update failed: $(echo "$RESPONSE" | jq -r '.message // "Unknown error"')"
        exit 1
    fi

    echo "{\"licenseKey\":\"$NEW_LICENSE_KEY\", \"email\":\"$EMAIL_RES\"}" > "$LICENSE_PATH"
    echo "✅ License updated. New key saved to $LICENSE_PATH"
    write_config "email" "$EMAIL_RES"
}

validate_license() {
    local LICENSE_KEY=$(jq -r '.licenseKey // empty' "$LICENSE_PATH" 2>/dev/null || echo "")
    local MACHINE_CODE=$(get_machine_code)

    if [ -z "$LICENSE_KEY" ]; then
        echo "❌ No license key found. Please register first."
        exit 1
    fi

    local RESPONSE
    RESPONSE=$(curl -s -X POST "$VALIDATE_API" -H "Content-Type: application/json" -d "{\"licenseKey\":\"$LICENSE_KEY\",\"machineCode\":\"$MACHINE_CODE\"}")

    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ License validation failed: Invalid response."
        return 1
    fi

    local IS_VALID
    IS_VALID=$(echo "$RESPONSE" | jq -r '.isValid')
    if [ "$IS_VALID" != "true" ]; then
        echo "❌ License is invalid: $(echo "$RESPONSE" | jq -r '.message // "Unknown error"')"
        return 1
    fi

    echo "✅ License is valid."
    return 0
}

# ------------------------------------------------
# Version Management
# ------------------------------------------------
get_latest_version() {
    local RESPONSE=$(curl -s "$LATEST_VERSION_API")
    echo "$RESPONSE" | jq -r '.latestVersion // empty'
}

check_update_and_install() {
    local TARGET_VERSION="${1:-}"
    local FORCE="${2:-false}"
    local INSTALLED_VERSION=$(jq -r '.installedVersion // "none"' "$CONFIG_PATH")
    local OLD_VERSION="$INSTALLED_VERSION"

    if [ "$INSTALLED_VERSION" == "none" ] || [ -z "$INSTALLED_VERSION" ]; then
        INSTALLED_VERSION="none"
    fi

    if [ -z "$TARGET_VERSION" ]; then
        TARGET_VERSION=$(get_latest_version)
        if [ -z "$TARGET_VERSION" ]; then
            echo "❌ Failed to fetch latest version."
            exit 1
        fi
    fi

    if [ "$INSTALLED_VERSION" == "$TARGET_VERSION" ] && [ "$FORCE" != "true" ]; then
        echo "✅ Already on version $TARGET_VERSION. No update needed."
        return 0
    fi

    echo "📦 Installing/Updating to version $TARGET_VERSION..."

    # Validate license before proceeding
    validate_license || exit 1

    # Fetch release info
    local RELEASE_INFO=$(curl -s "$LATEST_VERSION_API")
    local ASSET_URL=$(echo "$RELEASE_INFO" | jq -r ".versions[] | select(.version == \"$TARGET_VERSION\") .assets[0].browser_download_url // empty")
    local SHA256_URL="$ASSET_URL.sha256"

    if [ -z "$ASSET_URL" ]; then
        echo "❌ No asset found for version $TARGET_VERSION."
        exit 1
    fi

    # Download asset and SHA
    local ASSET_FILE="$TMP_INSTALL_DIR/hiretrack-$TARGET_VERSION.tar.gz"
    local SHA_FILE="$ASSET_FILE.sha256"
    curl -L -o "$ASSET_FILE" "$ASSET_URL"
    curl -L -o "$SHA_FILE" "$SHA256_URL"

    # Verify SHA
    local EXPECTED_SHA=$(cat "$SHA_FILE" | awk '{print $1}')
    local ACTUAL_SHA=$(shasum -a 256 "$ASSET_FILE" | awk '{print $1}')
    if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
        echo "❌ SHA256 mismatch for version $TARGET_VERSION."
        rm "$ASSET_FILE" "$SHA_FILE"
        exit 1
    fi
    rm "$SHA_FILE"

    # Backup current installation if exists
    if [ -d "$APP_INSTALL_DIR" ] && [ "$INSTALLED_VERSION" != "none" ]; then
        local BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
        mv "$APP_INSTALL_DIR" "$BACKUP_DIR/$BACKUP_NAME"
        echo "✅ Backup created: $BACKUP_DIR/$BACKUP_NAME"
    fi

    # Extract new version
    mkdir -p "$TMP_INSTALL_DIR/hiretrack-$TARGET_VERSION"
    tar -xzf "$ASSET_FILE" -C "$TMP_INSTALL_DIR/hiretrack-$TARGET_VERSION" --strip-components=1
    rm "$ASSET_FILE"

    # Move to releases
    mkdir -p "$RELEASES_DIR"
    mv "$TMP_INSTALL_DIR/hiretrack-$TARGET_VERSION" "$RELEASES_DIR/hiretrack-$TARGET_VERSION"

    # Symlink to APP
    ln -sfn "$RELEASES_DIR/hiretrack-$TARGET_VERSION" "$APP_INSTALL_DIR"

    # Install Node dependencies
    install_node "$APP_INSTALL_DIR"
    cd "$APP_INSTALL_DIR"
    if [ ! -d "node_modules" ] || [ "$FORCE" == "true" ]; then
        npm install --production
    fi

    # Run migrations if updating from an old version
    if [ "$OLD_VERSION" != "none" ]; then
        run_migrations "$OLD_VERSION" "$TARGET_VERSION"
    fi

    # Setup PM2
    local PM2_NAME="hiretrack-$TARGET_VERSION"
    if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
        pm2 restart "$PM2_NAME"
    else
        pm2 start ecosystem.config.js --name "$PM2_NAME"
    fi
    pm2 save --force

    # Update config
    write_config "installedVersion" "$TARGET_VERSION"

    echo "✅ Installation/Update to $TARGET_VERSION complete."
}

install_specific_version() {
    local VERSION="$1"
    [ -z "$VERSION" ] && VERSION=$(prompt_for_version)
    check_update_and_install "$VERSION" "true"
}

# ------------------------------------------------
# Migration Functions
# ------------------------------------------------
run_migrations() {
    local CURRENT_VERSION="$1"
    local TARGET_VERSION="$2"

    if [ "$CURRENT_VERSION" == "none" ]; then
        echo "✅ No migrations needed for fresh install."
        return 0
    fi

    echo "📦 Fetching migrations from $CURRENT_VERSION to $TARGET_VERSION..."
    local API_URL_WITH_PARAMS="${LATEST_VERSION_API}?currentVersion=${CURRENT_VERSION}&upgradeVersion=${TARGET_VERSION}"
    local RESPONSE=$(curl -s "$API_URL_WITH_PARAMS")

    if [ -z "$RESPONSE" ] || ! echo "$RESPONSE" | jq . >/dev/null 2>&1; then
        echo "❌ Failed to fetch migrations: Invalid response."
        exit 1
    fi

    local VERSIONS=$(echo "$RESPONSE" | jq -r '.versions[].version' 2>/dev/null)

    if [ -z "$VERSIONS" ]; then
        echo "✅ No migrations required."
        return 0
    fi

    for ver in $VERSIONS; do
        local MIG_URL=$(echo "$RESPONSE" | jq -r ".versions[] | select(.version == \"$ver\") .migrationScriptUrl // empty")

        if [ -n "$MIG_URL" ] && [ "$MIG_URL" != "null" ]; then
            local MIG_FILE="$TMP_INSTALL_DIR/migration_${ver}.js"
            echo "📥 Downloading migration for version $ver..."
            curl -s -o "$MIG_FILE" "$MIG_URL"
            if [ $? -ne 0 ]; then
                echo "❌ Failed to download migration for $ver."
                rm -f "$MIG_FILE"
                exit 1
            fi

            echo "▶️ Running migration for version $ver..."
            cd "$APP_INSTALL_DIR"
            node "$MIG_FILE"
            if [ $? -ne 0 ]; then
                echo "❌ Migration failed for $ver."
                rm -f "$MIG_FILE"
                exit 1
            fi

            rm -f "$MIG_FILE"
            echo "✅ Migration for $ver completed."
        else
            echo "ℹ️ No migration URL for version $ver. Skipping."
        fi
    done

    echo "✅ All migrations completed."
}

# ------------------------------------------------
# Nginx Setup
# ------------------------------------------------
setup_nginx() {
    local OS_TYPE=$(uname | tr '[:upper:]' '[:lower:]')
    local NGINX_SCRIPT="$HOME/.myapp/nginx_setup.sh"
    local DOMAIN_NAME=$(jq -r '.domain // empty' "$CONFIG_PATH")
    local APP_PORT=3000  # Assuming default port; adjust if needed

    if [ -z "$DOMAIN_NAME" ]; then
        read -p "Enter domain name (or localhost): " DOMAIN_NAME
        if [ -z "$DOMAIN_NAME" ]; then
            echo "❌ Domain name cannot be empty."
            exit 1
        fi
        write_config "domain" "$DOMAIN_NAME"
    fi

    # Create Nginx setup script
    cat << EOF > "$NGINX_SCRIPT"
#!/bin/bash
set -euo pipefail

DOMAIN_NAME="$DOMAIN_NAME"
APP_PORT=$APP_PORT
OS_TYPE="$OS_TYPE"
LOG_DIR="$LOG_DIR"

# Nginx paths
if [[ "\$OS_TYPE" == "linux" ]]; then
    NGINX_CONF_DIR="/etc/nginx/sites-available"
    NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
    NGINX_CONF_FILE="\$NGINX_CONF_DIR/\$DOMAIN_NAME"
    NGINX_ENABLED_FILE="\$NGINX_ENABLED_DIR/\$DOMAIN_NAME"
    NGINX_BACKUP_DIR="/etc/nginx/backup"
elif [[ "\$OS_TYPE" == "darwin" ]]; then
    NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
    NGINX_CONF_FILE="\$NGINX_CONF_DIR/\$DOMAIN_NAME.conf"
    NGINX_BACKUP_DIR="/usr/local/etc/nginx/backup"
else
    echo "❌ Unsupported OS: \$OS_TYPE"
    exit 1
fi

mkdir -p "\$NGINX_BACKUP_DIR" "\$LOG_DIR"

# ------------------------------------------------
# Prompt functions
# ------------------------------------------------
prompt_for_domain() {
    if [ -z "\$DOMAIN_NAME" ]; then
        read -p "Enter domain name (or localhost): " DOMAIN_NAME
        [ -z "\$DOMAIN_NAME" ] && { echo "❌ Domain name required"; exit 1; }
    fi
    echo "🌐 Using domain: \$DOMAIN_NAME"
}

prompt_for_email() {
    local EMAIL
    read -p "Enter email for SSL notifications: " EMAIL
    [ -z "\$EMAIL" ] && { echo "❌ Email required for SSL"; exit 1; }
    echo "\$EMAIL"
}

# ------------------------------------------------
# Check DNS
# ------------------------------------------------
check_dns_resolution() {
    if [ "\$DOMAIN_NAME" == "localhost" ]; then
        return 0
    fi

    echo "🔍 Checking DNS resolution for \$DOMAIN_NAME..."
    if ! nslookup "\$DOMAIN_NAME" >/dev/null 2>&1; then
        echo "⚠️  DNS not resolving. Please configure DNS before proceeding."
        read -p "Continue anyway? [y/N]: " CONTINUE
        [[ ! "\$CONTINUE" =~ ^[Yy]$ ]] && exit 1
    else
        echo "✅ DNS resolves successfully"
    fi
}

# ------------------------------------------------
# Check application
# ------------------------------------------------
check_application() {
    echo "🔍 Checking if application is running on port \$APP_PORT..."
    if curl -s "http://localhost:\$APP_PORT" >/dev/null 2>&1; then
        echo "✅ Application responding on port \$APP_PORT"
    else
        echo "⚠️  Application not responding on port \$APP_PORT"
        read -p "Continue anyway? [y/N]: " CONTINUE
        [[ ! "\$CONTINUE" =~ ^[Yy]$ ]] && exit 1
    fi
}

# ------------------------------------------------
# Install Nginx
# ------------------------------------------------
install_nginx() {
    if command -v nginx >/dev/null 2>&1; then
        echo "✅ Nginx already installed"
        return 0
    fi

    echo "📦 Installing Nginx..."
    if [[ "\$OS_TYPE" == "linux" ]]; then
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update
            sudo apt-get install -y nginx
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y nginx
        else
            echo "❌ Unsupported package manager"
            exit 1
        fi
    elif [[ "\$OS_TYPE" == "darwin" ]]; then
        if ! command -v brew >/dev/null 2>&1; then
            echo "❌ Install Homebrew first"
            exit 1
        fi
        brew install nginx
    fi

    if ! command -v nginx >/dev/null 2>&1; then
        echo "❌ Nginx installation failed"
        exit 1
    fi
    echo "✅ Nginx installed"
}

# ------------------------------------------------
# Start Nginx
# ------------------------------------------------
start_nginx() {
    echo "▶️ Starting Nginx..."
    if [[ "\$OS_TYPE" == "linux" ]]; then
        sudo systemctl start nginx || { echo "❌ Failed to start Nginx"; exit 1; }
        sudo systemctl enable nginx
    elif [[ "\$OS_TYPE" == "darwin" ]]; then
        brew services start nginx || { echo "❌ Failed to start Nginx"; exit 1; }
    fi

    if pgrep -x "nginx" >/dev/null; then
        echo "✅ Nginx started"
    else
        echo "❌ Nginx failed to start"
        exit 1
    fi
}

# ------------------------------------------------
# SSL Setup
# ------------------------------------------------
setup_ssl_certificate() {
    if [ "\$DOMAIN_NAME" == "localhost" ]; then
        echo "ℹ️ Skipping SSL for localhost"
        return "false"
    fi

    if command -v certbot >/dev/null 2>&1; then
        echo "✅ Certbot already installed"
    else
        echo "📦 Installing Certbot..."
        if [[ "\$OS_TYPE" == "linux" ]]; then
            if command -v apt-get >/dev/null 2>&1; then
                sudo apt-get update
                sudo apt-get install -y certbot python3-certbot-nginx
            elif command -v yum >/dev/null 2>&1; then
                sudo yum install -y certbot python3-certbot-nginx
            else
                echo "❌ Unsupported package manager"
                exit 1
            fi
        elif [[ "\$OS_TYPE" == "darwin" ]]; then
            brew install certbot
        fi
    fi

    if [ ! -f "/etc/letsencrypt/live/\$DOMAIN_NAME/fullchain.pem" ]; then
        local EMAIL=\$(prompt_for_email)
        echo "🔐 Obtaining SSL certificate..."
        sudo certbot certonly --nginx -d "\$DOMAIN_NAME" --non-interactive --agree-tos -m "\$EMAIL" || {
            echo "⚠️  SSL setup failed. Continuing with HTTP only."
            return "false"
        }
    else
        echo "✅ Existing SSL certificate found"
    fi

    # Setup auto-renewal
    if [[ "\$OS_TYPE" == "linux" ]]; then
        (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | sudo crontab -
    fi

    return "true"
}

# ------------------------------------------------
# Configure Nginx
# ------------------------------------------------
configure_nginx() {
    local USE_HTTPS="\$1"
    local CERT_PATH="/etc/letsencrypt/live/\$DOMAIN_NAME/fullchain.pem"
    local KEY_PATH="/etc/letsencrypt/live/\$DOMAIN_NAME/privkey.pem"

    # Backup existing config
    if [ -f "\$NGINX_CONF_FILE" ]; then
        local BACKUP_FILE="\$NGINX_BACKUP_DIR/\$DOMAIN_NAME.backup.\$(date +%Y%m%d_%H%M%S)"
        sudo cp "\$NGINX_CONF_FILE" "\$BACKUP_FILE"
        echo "✅ Backup created: \$BACKUP_FILE"
    fi

    # Generate configuration content
    local NGINX_CONF_CONTENT=\$(cat <<INNEREOF
# HTTP server block (always present)
server {
    listen 80;
    listen [::]:80;
    server_name \$DOMAIN_NAME;

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
}


# ------------------------------------------------
# Main Entry Point
# ------------------------------------------------
check_dep curl
check_dep jq
check_dep tar
check_dep shasum
check_pm2
# --install-version)
    #     install_specific_version "${2:-}"
    #     ;;
case "${1:-}" in
    --install)
        install_all "${2:-}"
        ;;
    --register)
        register_license "${2:-}"
        ;;
    --update)
	check_update_and_install "${2:-}" "${3:-}"
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
        echo "Usage: $0 [--install [email]] [--register [email]] [--update] [--setup-cron]"
        exit 0
        ;;
    *)
        install_all "${2:-}"
        ;;
esac