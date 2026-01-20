# HireTrack – Production Installation (Root Mode)

## System Requirements

### Minimum Production Specifications
- CPU: 2 cores
- RAM: 4 GB
- Disk: 20 GB available space
- OS: Ubuntu 20.04 LTS or later (x86_64 architecture)
- Network: Internet connectivity for package installation

### Recommended Production Specifications
- CPU: 4+ cores
- RAM: 4 GB or more
- Disk: 20 GB+ available space (SSD preferred)
- OS: Ubuntu 22.04 LTS or later (x86_64 architecture)
- Network: Stable internet connection with low latency

### Required Open Ports
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3000 (Next.js application, if not proxied)

### Unsupported Environments
- Non-Ubuntu distributions (Debian, CentOS, RHEL, etc.)
- ARM architectures (ARM64, ARMv7)
- Ubuntu versions prior to 20.04
- Non-root execution environments
- Development or staging environments (use appropriate installation methods)

## Installation Overview

This installation guide is intended for production environments on dedicated servers. The installer must be executed as the root user to perform system-level configuration, including:

- System package installation and updates
- Node.js and npm installation
- PM2 process manager setup
- Nginx web server configuration
- SSL certificate management
- Firewall configuration
- Service initialization

The installer is designed for single-server deployments where root access is available and appropriate for the deployment model.

## Root Login

Switch to root user:

```bash
sudo -i
```

Verify root access:

```bash
whoami
```

Expected output: `root`

## Prepare Installer

Ensure the installer file has execute permissions:

```bash
chmod +x hiretrack-installer
```

Verify the file is executable:

```bash
ls -l hiretrack-installer
```

Expected output should include `-rwxr-xr-x` or similar execute permissions.

## Run Installer

Execute the installer:

```bash
./hiretrack-installer
```

The installer will:
1. Update system packages
2. Install required dependencies (Node.js, npm, PM2, Nginx)
3. Configure the application
4. Set up process management
5. Configure web server
6. Initialize services

Monitor the output for any errors or warnings. Installation typically takes 5-15 minutes depending on system resources and network speed.

## Verification

After installation completes, verify services are running:

### Check PM2 Process Status

```bash
pm2 list
```

Expected output should show the HireTrack application process in `online` status.

### Check Nginx Service Status

```bash
systemctl status nginx
```

Expected output should show `active (running)`.

### Check Application Accessibility

```bash
curl -I http://localhost
```

Expected output should show HTTP 200 or 301/302 redirect status.

### View Application Logs

```bash
pm2 logs hiretrack
```

Replace `hiretrack` with the actual process name if different.

## Security Notes

### Root Execution Tradeoffs

Executing the installer as root provides the necessary privileges to:
- Install system packages without sudo prompts
- Configure system services (Nginx, PM2)
- Modify system-wide configurations
- Set up firewall rules

However, root execution also means:
- Any vulnerabilities in the installer script could affect the entire system
- Misconfiguration could impact system stability
- Audit trails should be maintained for compliance

### Least Privilege Alternative

For environments requiring least privilege execution, consider:
- User-based installation methods (if available)
- Manual installation following component-specific guides
- Containerized deployment (Docker, Kubernetes)
- Configuration management tools (Ansible, Puppet, Chef)

### Post-Installation Security

After installation:
1. Review firewall rules: `ufw status` or `iptables -L`
2. Verify SSL/TLS configuration if HTTPS is enabled
3. Review Nginx configuration: `/etc/nginx/sites-available/`
4. Check PM2 process configuration: `pm2 show <process-name>`
5. Review application logs for security-related messages
6. Ensure regular security updates are scheduled

### Maintenance

Regular maintenance tasks:
- Update system packages: `apt update && apt upgrade`

- Monitor PM2 processes: `pm2 monit`
- Review application logs: `pm2 logs`
- Backup application data and configurations
