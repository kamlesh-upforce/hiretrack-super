# HireTrack – Complete Installation Guide

This comprehensive guide covers the complete installation process for HireTrack, including system requirements, security hardening, and both user-based and root-based installation approaches.

---

## Table of Contents

1. [System Requirements & Prerequisites](#1-system-requirements--prerequisites)
2. [Installation Approach Selection](#2-installation-approach-selection)
3. [Part A: User-Based Installation](#3-part-a-user-based-installation)
4. [Part B: Root-Based Installation](#4-part-b-root-based-installation)
5. [Common Steps: Run Installer](#5-common-steps-run-installer)
6. [Post-Installation Verification](#6-post-installation-verification)

---

## 1. System Requirements & Prerequisites

### System Requirements

#### Minimum Production Specifications
- **RAM**: 4 GB
- **Disk**: 20 GB available space
- **OS**: Ubuntu 20.04 LTS or later (x86_64 architecture)
- **Network**: Internet connectivity for package installation

#### Required Open Ports
- **Port 80** (HTTP)
- **Port 443** (HTTPS)
- **Port 3000** (Next.js application, if not proxied)

#### Unsupported Environments
- Non-Ubuntu distributions (Debian, CentOS, RHEL, etc.)
- ARM architectures (ARM64, ARMv7)
- Ubuntu versions prior to 20.04

### Prerequisites

Before starting the installation, ensure you have the following:

- **Domain Name** (Required): A valid domain name that points to your server's IP address
  - The domain must have DNS A record configured to point to your server's public IP
  - Example: `app.yourcompany.com` or `hiretrack.yourdomain.com`
  - The installer will prompt for this domain name during Nginx setup
  - SSL certificate generation (Let's Encrypt) requires the domain to resolve correctly
  
- **Root or Sudo Access**: Initial root or sudo access to the server for user setup (if using user-based installation)

- **SSH Access**: Ability to connect to the server via SSH

- **Email Address**: Valid email address for SSL certificate registration (Let's Encrypt)

---

## 2. Installation Approach Selection

Choose your installation approach based on your security and operational requirements:

### **Option 1: User-Based Installation** ⭐ **RECOMMENDED & MORE SECURE**

**Why User-Based Installation is Better:**
- ✅ **Enhanced Security**: Better security isolation and reduced attack surface
- ✅ **Restricted Permissions**: Limited sudo access with only necessary commands allowed
- ✅ **Principle of Least Privilege**: User only has access to what's needed for the application
- ✅ **Better Audit Trail**: Clear separation of user actions vs system actions
- ✅ **Damage Limitation**: If compromised, attacker has limited system access
- ✅ **Industry Best Practice**: Follows security best practices for production deployments

**Trade-offs:**
- ⚠️ Requires initial root access for user setup (one-time setup)
- ⚠️ Slightly more complex initial configuration

**Use this approach if:**
- You're deploying to production
- Security is a priority
- You want to follow industry best practices
- You need better audit trails

### **Option 2: Root-Based Installation**

**Characteristics:**
- ✅ Simpler setup process (fewer steps)
- ✅ Direct system access
- ⚠️ **Higher Security Risk**: Full system privileges required
- ⚠️ **No Permission Restrictions**: Complete system access
- ⚠️ **Increased Attack Surface**: Compromise affects entire system

**Use this approach if:**
- You're in a controlled/isolated environment
- You need quick setup for testing
- You understand and accept the security implications

---

### **Recommendation**

**For production deployments, we strongly recommend the User-Based Installation approach** as it provides significantly better security posture, follows industry best practices, and limits potential damage in case of compromise.

**Choose your path:**
- For **User-Based Installation** (Recommended), proceed to [Part A: User-Based Installation](#3-part-a-user-based-installation)
- For **Root-Based Installation**, proceed to [Part B: Root-Based Installation](#4-part-b-root-based-installation)

---

## 3. Part A: User-Based Installation

This section covers the complete user-based installation process: SSH key generation, user creation, SSH hardening, sudo permissions, and Fail2Ban setup.

### Step 1: Local Machine Setup (Generate SSH Key)

Perform these steps on your **local machine** (not on the server).

#### Generate SSH Key Pair

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_hiretrack
```

Follow the prompts. You can set a passphrase or leave it empty.

#### Display Public Key

```bash
cat ~/.ssh/id_ed25519_hiretrack.pub
```

**Copy the entire output** - you will need to paste it on the server in the next step.

---

### Step 2: Server Setup (Root Access Required)

Perform these steps on the **server** as the **root user** (or with sudo privileges).

#### Step 2.1: Create Dedicated User

Create the dedicated hiretrack user:

```bash
sudo useradd -m -s /bin/bash hiretrack
```

Verify the user was created:

```bash
id hiretrack
```

Expected output should show the hiretrack user and group.

#### Step 2.2: Setup SSH Public Key Authentication

Create the SSH directory and set permissions:

```bash
sudo mkdir -p /home/hiretrack/.ssh
sudo chmod 700 /home/hiretrack/.ssh
sudo chown hiretrack:hiretrack /home/hiretrack/.ssh
```

Create the authorized_keys file:

```bash
sudo nano /home/hiretrack/.ssh/authorized_keys
```

Paste the public key you copied from your local machine (from Step 1), then save and exit (Ctrl+X, Y, Enter).

Set correct permissions:

```bash
sudo chmod 600 /home/hiretrack/.ssh/authorized_keys
sudo chown hiretrack:hiretrack /home/hiretrack/.ssh/authorized_keys
```

#### Step 2.3: Harden SSH Configuration (Recommended)

Edit SSH configuration:

```bash
sudo nano /etc/ssh/sshd_config
```

Find and modify these lines (remove '#' if present at the start):

```text
Port 22                    # Or use a custom port like 54321
PubkeyAuthentication yes
PermitRootLogin prohibit-password
PasswordAuthentication no  # WARNING: Ensure you have an active SSH session before disabling
```

**Important**: Before setting `PasswordAuthentication no`, ensure you have:
1. Successfully tested SSH key authentication
2. An active SSH session open (in case you need to revert)

Test SSH configuration:

```bash
sudo sshd -t
```

If the test passes, restart SSH:

```bash
sudo systemctl restart ssh
```

#### Step 2.4: Prepare Installer

Copy the installer to the hiretrack user's home directory:

```bash
sudo cp hiretrack-installer /home/hiretrack/hiretrack-installer
sudo chown root:hiretrack /home/hiretrack/hiretrack-installer
sudo chmod 750 /home/hiretrack/hiretrack-installer
```

#### Step 2.5: Grant Restricted Sudo Permissions

Configure restricted sudo permissions for the hiretrack user:

```bash
sudo visudo -f /etc/sudoers.d/hiretrack
```

Paste the following restricted sudo rules:

```text
Defaults:hiretrack !authenticate
Defaults:hiretrack env_reset
Defaults:hiretrack secure_path=/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin
Defaults:hiretrack noexec

hiretrack ALL=(root) NOPASSWD: \
  /usr/bin/apt-get *, \
  /bin/systemctl *, \
  /usr/bin/tee /etc/nginx/sites-available/*, \
  /usr/bin/ln -sf /etc/nginx/sites-available/* /etc/nginx/sites-enabled/*, \
  /usr/sbin/nginx -t, \
  /usr/bin/certbot *, \
  /usr/bin/crontab *, \
  /usr/bin/fail2ban-client *
```

Save and exit. Verify the sudoers file syntax:

```bash
sudo visudo -c
```

Expected output: `/etc/sudoers.d/hiretrack: parsed OK`

---

### Step 3: Switch to User Account

Switch to the hiretrack user:

```bash
su - hiretrack
```

Verify you're now the hiretrack user:

```bash
whoami
```

Expected output: `hiretrack`

---

### Step 4: Install and Configure Fail2Ban (Optional but Recommended)

Fail2Ban provides brute-force protection for SSH and other services. This step is **optional but highly recommended** for production environments.

#### Installation

```bash
sudo apt-get update
sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban
```

#### Configuration (Optional but Recommended)

Fail2Ban works out of the box with default settings. Configuration is optional but recommended to make behavior explicit and auditable.

Create configuration file:

```bash
sudo nano /etc/fail2ban/jail.local
```

Paste the following configuration:

```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
```

#### Restart and Verify

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

#### Configuration Explanation

This configuration:
- Bans IP addresses after **5 failed authentication attempts**
- Tracks failures within a **10-minute window**
- Bans for **1 hour**
- Protects **SSH service only**

#### Unban IP Address

To manually unban an IP address:

```bash
sudo fail2ban-client set sshd unbanip <IP_ADDRESS>
```

#### Disclaimer

Fail2Ban is optional and does not affect application behavior. Final tuning and monitoring are the system administrator's responsibility.

---

**Proceed to [Common Steps: Run Installer](#5-common-steps-run-installer)**

---

## 4. Part B: Root-Based Installation

If you've selected the root-based installation approach, you can proceed directly to running the installer.

### Quick Setup (Optional)

If you want to set up SSH key authentication for root (recommended), follow these steps:

#### Step 1: Local Machine Setup (Generate SSH Key)

On your **local machine**, generate an SSH key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_root
```

Display the public key:

```bash
cat ~/.ssh/id_ed25519_root.pub
```

**Copy the entire output**.

#### Step 2: Server Setup (Root Access)

On the **server** as root, setup SSH public key:

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
nano /root/.ssh/authorized_keys
```

Paste the public key, save and exit, then:

```bash
chmod 600 /root/.ssh/authorized_keys
```

#### Step 3: Prepare Installer

Ensure the installer file has execute permissions:

```bash
chmod +x hiretrack-installer
```

---

**Proceed directly to [Common Steps: Run Installer](#5-common-steps-run-installer)**

---

## 5. Common Steps: Run Installer

### For User-Based Installation

Ensure you're logged in as the hiretrack user:

```bash
whoami
```

Expected output: `hiretrack`

Run the installer:

```bash
./hiretrack-installer
```

The installer will use the restricted sudo permissions configured earlier to perform system-level operations without requiring a password.

### For Root-Based Installation

Ensure you're logged in as root:

```bash
whoami
```

Expected output: `root`

Run the installer:

```bash
./hiretrack-installer
```

The installer will perform system-level operations directly as root.

---

### Installation Process

The installer will:
1. Check and install system dependencies (Node.js, npm, PM2, Nginx, MongoDB)
2. Register or validate your license
3. Download and extract the latest HireTrack application
4. Configure the application environment
5. Set up PM2 process management
6. Configure Nginx reverse proxy
7. Set up SSL certificates (Let's Encrypt)
8. Configure automatic updates via cron
9. Start the application

Monitor the output for any errors or warnings. Installation typically takes **5-15 minutes** depending on system resources and network speed.

---

### Installation Output

At the end of installation, you'll see a prominent registration URL:

```
════════════════════════════════════════════════
  🎯 REGISTRATION URL
════════════════════════════════════════════════

You can register the first organization from the URL below:

   ╔═══════════════════════════════════════════════════════════╗
   ║                                                           ║
   ║   https://your-domain.com/register/org                   ║
   ║                                                           ║
   ╚═══════════════════════════════════════════════════════════╝
```

Copy this URL and access it in your browser to complete the organization registration.

---

## 6. Post-Installation Verification

### Check PM2 Process Status

```bash
pm2 list
```

Expected output should show the HireTrack application process in `online` status.

### Check Nginx Service Status

**For User-Based Installation:**
```bash
sudo systemctl status nginx
```

**For Root-Based Installation:**
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
pm2 logs
```

Replace with specific process name if needed: `pm2 logs hiretrack-v1.0.38`

### Check Cron Jobs

**For User-Based Installation:**
```bash
crontab -l
```

**For Root-Based Installation:**
```bash
crontab -l
```

Expected output should show:
- Auto-update cron job
- Snapshot cron job (if configured)

### Verify SSL Certificate (if HTTPS enabled)

**For User-Based Installation:**
```bash
sudo certbot certificates
```

**For Root-Based Installation:**
```bash
certbot certificates
```

---

## Security Checklist

After installation, verify the following security measures:

- [ ] SSH key authentication is working
- [ ] Password authentication is disabled (if configured)
- [ ] Fail2Ban is running (if installed)
- [ ] Firewall rules are configured (UFW or iptables)
- [ ] SSL/TLS certificates are valid and auto-renewing
- [ ] Regular security updates are scheduled
- [ ] Application logs are being monitored
- [ ] Backups are configured (snapshot cron job)

---

## Troubleshooting

### SSH Connection Issues

If you're locked out after disabling password authentication:
1. Use console access (KVM/IPMI) if available
2. Revert SSH configuration: `PasswordAuthentication yes`
3. Restart SSH service
4. Test key authentication before disabling passwords again

### Installer Fails

Check logs:
- Application logs: `pm2 logs`
- Installer logs: `~/.hiretrack/logs/`
- System logs: `journalctl -xe`

### Nginx Not Starting

Check configuration:

**For User-Based Installation:**
```bash
sudo nginx -t
```

**For Root-Based Installation:**
```bash
nginx -t
```

Review error logs:

**For User-Based Installation:**
```bash
sudo tail -f /var/log/nginx/error.log
```

**For Root-Based Installation:**
```bash
tail -f /var/log/nginx/error.log
```

### Certificate Issues

Check certificate status:

**For User-Based Installation:**
```bash
sudo certbot certificates
```

**For Root-Based Installation:**
```bash
certbot certificates
```

Renew manually if needed:

**For User-Based Installation:**
```bash
sudo certbot renew
```

**For Root-Based Installation:**
```bash
certbot renew
```

---

## Maintenance

### Regular Updates

The installer sets up automatic updates via cron. To manually update:

```bash
~/.hiretrack/installer.sh --update manually
```

### Backup

Backups are automatically created via the snapshot cron job. To create a manual backup:

```bash
node ~/.hiretrack/take-snapshot.js
```

### Monitoring

Monitor application health:
```bash
pm2 monit
```

View recent logs:
```bash
pm2 logs --lines 100
```

---

## Support

For issues or questions:
- Check application logs: `pm2 logs`
- Review installer logs: `~/.hiretrack/logs/`
- Contact HireTrack support

---

## Security Guarantees

### User-Based Installation
- ✅ SSH key-only access
- ✅ No interactive root shell
- ✅ Restricted sudo permissions
- ✅ Optional brute-force protection (Fail2Ban)
- ✅ Principle of least privilege

### Root-Based Installation
- ✅ SSH key-only access
- ✅ Optional brute-force protection (Fail2Ban)
- ⚠️ Full system privileges (use with caution)

---

© HireTrack – Secure by design
