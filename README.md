# HireTrack Installer Script

This Bash script automates the installation, configuration, and management of the **HireTrack** application. It handles dependencies, installs and configures Nginx, manages MongoDB (local or Atlas), registers and validates licenses, and supports application updates via an API. The script is designed to work on Linux and macOS systems.

## Features

- **Self-copying installer**: Copies itself to `~/.myapp/installer.sh` for consistent execution.
- **Dependency management**: Installs required tools like `curl`, `jq`, `tar`, `shasum`, Node.js, PM2, and MongoDB.
- **Nginx configuration**: Sets up Nginx as a reverse proxy with optional HTTPS using Let's Encrypt.
- **MongoDB support**: Configures MongoDB Atlas (cloud) or local MongoDB installation.
- **License management**: Registers and validates licenses via an API.
- **Version management**: Supports installing specific versions or auto-updating to the latest version.
- **Cron job for updates**: Optionally sets up a cron job to check for updates every 2 minutes.
- **Backup and rollback**: Creates backups before updates and supports rollback on failure.

## Prerequisites

- **Operating System**: Linux (Debian/Ubuntu or CentOS) or macOS.
- **Root/Superuser Access**: Required for installing system packages (e.g., Nginx, MongoDB).
- **Internet Access**: Needed for downloading dependencies, assets, and communicating with the API.
- **Homebrew**: Required on macOS for installing dependencies.

## Installation

1. **Download the Script**:
   Save the script as `installer.sh` and make it executable:
   ```bash
   chmod +x installer.sh