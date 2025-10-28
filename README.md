# HireTrack Installer Script

This guide provides essential steps to install and configure the HireTrack application on **Linux (Debian/Ubuntu or CentOS)** or **macOS** using the provided `installer.sh` script.

---

## Prerequisites

- **Operating System**: Linux (Debian/Ubuntu or CentOS) or macOS
- **Valid Email Address**: Registered with the HireTrack Super Admin for license validation
- **Internet Access**: Required for downloading dependencies, assets, and license validation
- **Required Tools**:
  - `curl`, `jq`, `tar`, `shasum` (automatically checked and installed if missing)

---

## Installation Steps

1. **Make the Script Executable**

   ```bash
   chmod +x installer.sh
   ```
2. **Run the Installer**

   ```bash
   ./installer.sh
   ```
   OR


   ```bash
   bash installer.sh
   ```

   > The installer will automatically:
   > - Copy itself to `~/.myapp/installer.sh` for future use
   > - Install Node.js, PM2, and MongoDB (if needed)
   > - Register license
   > - Download and deploy the latest version
   > - Configure Nginx with domain and SSL
   > - Set up auto-updates via cron

---

## Setup Options

The installer supports the following command-line options:

```bash
./installer.sh [option]
```

| Option | Description |
|-------|-------------|
| `--domain` | Configure domain name and Nginx (with optional SSL via Let's Encrypt) |
| `--help` | Display usage information |

---

### Using `--domain`

```bash
./installer.sh --domain
```

You will be prompted to:

1. **Enter Domain Name**  
   Example: `release.hiretrack.in`, `demo.yourcompany.com`, or `localhost`

2. **Enter Email Address**  
   Used for SSL certificate (Let's Encrypt) if not `localhost`

3. **DNS & Port Checks**  
   Ensures domain resolves to your server and port 3000 is active

4. **SSL Setup (Recommended)**  
   Automatically installs `certbot` and generates HTTPS certificate

5. **Nginx Configuration**  
   Sets up reverse proxy with proper buffering, WebSocket support, and logging

---

### Using `--help`

```bash
./installer.sh --help
```

```
Usage:
  ./installer.sh [command] [options]

Commands:
  --install [email]             Install the application (optionally register with email)
  --update [mode]               Check for and install updates
  --run-migrations [from] [to]  Run database migrations between versions
  --rollback [version]          Roll back to a specific or previous version
  --setup-cron                  Set up automatic update cron job
  --domain                      Configure domain and Nginx setup
  --update-license [key]        Update the license key manually
  --help                        Show this help message and exit
```

---

## Respond to Prompts

During setup, you may see the following prompts:

- **Email**: Enter your registered HireTrack email
- **Domain Name**: Enter your public domain (e.g., `release.hiretrack.in`)
- **MongoDB Setup**:
  - Choose `1` for **MongoDB Atlas** → provide connection URL
  - Choose `2` for **Local MongoDB** → auto-installed
- **SSL Setup**: Confirm HTTPS (recommended for non-localhost)
- **Application Check**: Ensures app is running on port `3000`

---

## Verify Installation

Upon successful completion, you’ll see:

```
Installation completed
Access your application:
   - https://<your-domain>
You can register the first organization at:
https://<your-domain>/register/org
```

Open the URL in your browser to access HireTrack.

---

## Troubleshooting

| Issue | Solution |
|------|----------|
| **DNS Issues** | Ensure domain points to server IP. Use `dig` or `nslookup` to verify. |
| **MongoDB Errors** | Check logs: `tail -f /var/log/mongodb/mongod.log` |
| **Nginx Issues** | Check logs: `sudo tail -f /var/log/nginx/<domain>.{access,error}.log` |
| **PM2 Issues** | View processes: `pm2 list` <br> Restart: `pm2 restart hiretrack-*` |
| **SSL Failed** | Ensure port 80 is open and DNS is correct. Re-run `--domain` after fixing. |

---

## Useful Commands

```bash
# Check PM2 status
pm2 list

# View logs
pm2 logs hiretrack-<version>

# Restart app
pm2 restart hiretrack-<version>

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Support

For issues, contact the **HireTrack Super Admin**.

> **Note**: The installer auto-copies itself to `~/.myapp/installer.sh` and can be reused anytime.