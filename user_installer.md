# HireTrack – Secure User-Based Installation

This document describes the **recommended production installation** of HireTrack using a **dedicated Linux user**, **SSH key-based access**, and **restricted sudo permissions**.

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
- Port 54321 (SSH, if custom port is configured)

### Initial Setup Requirements
- Root access for initial user creation and sudo configuration
- SSH access to the server
- Outbound internet access for package installation

### Unsupported Environments
- Non-Ubuntu distributions (Debian, CentOS, RHEL, etc.)
- ARM architectures (ARM64, ARMv7)
- Ubuntu versions prior to 20.04
- Environments without root access for initial setup
- Development or staging environments (use appropriate installation methods)

---

## Part 1: Local Machine Setup

Perform these steps on your **local machine** (not on the server).

### Step 1: Generate SSH Key

Generate an SSH key pair for the hiretrack user:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_hiretrack
```

Follow the prompts. You can set a passphrase or leave it empty.

### Step 2: Copy Public Key

Display the public key to copy it:

```bash
cat ~/.ssh/id_ed25519_hiretrack.pub
```

**Copy the entire output** - you will need to paste it on the server in the next section.

---

## Part 2: Server Setup (Root Access Required)

Perform these steps on the **server** as the **root user** (or with sudo privileges).

### Step 1: Create Dedicated User

Create the dedicated hiretrack user:

```bash
sudo useradd -m -s /bin/bash hiretrack
```

Do NOT add this user to the sudo group.

Verify:

```bash
id hiretrack
```

### Step 2: Install SSH Public Key

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

Paste the public key you copied from your local machine (from Part 1, Step 2), then save and exit.

Set correct permissions:

```bash
sudo chmod 600 /home/hiretrack/.ssh/authorized_keys
sudo chown hiretrack:hiretrack /home/hiretrack/.ssh/authorized_keys
```

### Step 3: Harden SSH (Recommended)

Edit SSH configuration:

```bash
sudo nano /etc/ssh/sshd_config
```

FIND AND CHANGE THESE 4 LINES 
(Use Arrow keys to scroll. Remove '#' if present at the start of the line)

```text
Port 54321 (NOTE: make sure to add that port which is currently not using in other service)
PubkeyAuthentication yes
PermitRootLogin prohibit-password
PasswordAuthentication no (NOTE: that you have to make sure that one session is active)
```

Test SSH configuration:

```bash
sudo sshd -t
```

If the test passes, restart SSH:

```bash
sudo systemctl restart ssh
```

**Important**: Ensure you have an active SSH session before disabling password authentication, or you may lock yourself out.

### Step 4: Prepare Installer

Copy the installer to the hiretrack user's home directory:

```bash
sudo cp hiretrack-installer /home/hiretrack/hiretrack-installer
sudo chown root:hiretrack /home/hiretrack/hiretrack-installer
sudo chmod 750 /home/hiretrack/hiretrack-installer
```

### Step 5: Grant Restricted Sudo Permissions

Configure restricted sudo permissions for the hiretrack user:

```bash
sudo visudo -f /etc/sudoers.d/hiretrack
```

Paste the following restricted sudo rules (these permissions are permanent):

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

---

## Part 3: Run Installation (as hiretrack user)

Perform these steps as the **hiretrack user** (using the restricted sudo permissions configured in Part 2, Step 5).

### Step 1: Switch to hiretrack User

Switch to the hiretrack user:

```bash
su - hiretrack
```

### Step 2: Install Fail2Ban (Optional but Recommended)

Install Fail2Ban using sudo:

```bash
sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban
```

### Step 3: Configure Fail2Ban (Optional but Recommended)

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

Restart and verify:

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

#### Configuration Explanation

This configuration:
- Bans IP addresses after 5 failed authentication attempts
- Tracks failures within a 10-minute window
- Bans for 1 hour
- Protects SSH service only

#### Unban IP Address

To manually unban an IP address:

```bash
sudo fail2ban-client set sshd unbanip <IP_ADDRESS>
```

#### Disclaimer

Fail2Ban is optional and does not affect application behavior. Final tuning and monitoring are the system administrator's responsibility.

### Step 4: Run Installer

Run the installer:

```bash
./hiretrack-installer
```

The installer will use the restricted sudo permissions configured in Part 2, Step 5 to perform system-level operations without requiring a password.

Monitor the output for any errors or warnings. Installation typically takes 5-15 minutes depending on system resources and network speed.

---

## Security Guarantees

- SSH key-only access
- No interactive root shell
- Restricted sudo
- Optional brute-force protection

---

© HireTrack – Secure by design
