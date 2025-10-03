# HireTrack Installer Script

This guide provides essential steps to install and configure the HireTrack application on Linux (Debian/Ubuntu or CentOS) or macOS using the provided installer script.

## Prerequisites

- Linux (Debian/Ubuntu or CentOS) or macOS
- A valid email address for license registration
- Internet access for downloading dependencies and the application

## Installation Steps

1. **Extract the Installer**

   - Save the `hiretrack.gz` file to your desired directory.
   - Extract it:
     ```bash
     tar -xzf hiretrack.gz
     ```
     <!-- - Navigate to the extracted directory:
       ```bash
       cd hiretrack-installer
       ``` -->

2. **Make the Script Executable**

   ```bash
   chmod +x installer.sh
   ```

3. **Run the Installer**

   ```bash
   ./installer.sh
   ```

   - Replace `your-email@example.com` with your email address.
   - If no email is provided, you’ll be prompted to enter one.

4. **Respond to Prompts**

   - **Email**: Enter a valid email if not provided in the command.
   - **MongoDB Setup**:
     - Choose `1` for MongoDB Atlas (cloud) and provide the connection URL.
     - Choose `2` for a local MongoDB (installed automatically).
   - **Domain Name**: Enter a domain ( e.g., `release.hiretrack.in` )
   - **SSL Setup**: For non-localhost domains, confirm SSL certificate generation or proceed with HTTP only. Otherwise It's important to continue with HTTPS.
   - **Application Check**: Ensure the app is running on port 3000; choose to continue if not detected.

5. **Verify Installation**
   - Upon completion, you’ll see:
     ```
     Installation completed
     🌐 Access your application:
        - https://<domain>
     You can register the first organization at:
     https://<domain>/register/org
     ```
   - Access the application via the provided URL in a browser.

## Troubleshooting

- **DNS Issues**: Ensure your domain points to your server’s IP for SSL setup.
- **MongoDB Errors**: Verify the Atlas URL or check local MongoDB logs at `/var/log/mongodb/mongod.log`.
- **Nginx Issues**: Check logs at `/var/log/nginx/<domain>.{access,error}.log`.
- **PM2**: View running processes with `pm2 list`.

For support, contact HireTrack Super Admin