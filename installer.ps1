# HireTrack Installation Script with License Management (PowerShell)
# This script installs all dependencies and sets up the license

param(
    [string]$SuperAdminApiUrl = "https://admin.yourcompany.com",
    [string]$AppVersion = "1.0.0"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

Write-Host "🚀 HireTrack Installation Script" -ForegroundColor $Blue
Write-Host "==================================" -ForegroundColor $Blue

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $Red
}

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if ($isAdmin) {
    Write-Warning "This script is running as administrator. This is not recommended for security reasons."
    $continue = Read-Host "Do you want to continue? (y/N)"
    if ($continue -notmatch "^[Yy]$") {
        exit 1
    }
}

# Get user email for license registration
Write-Host "📧 License Registration" -ForegroundColor $Blue
Write-Host "Please provide your email address for license registration:"
$UserEmail = Read-Host "Email"

if ([string]::IsNullOrEmpty($UserEmail)) {
    Write-Error "Email is required for license registration"
    exit 1
}

# Validate email format
$emailPattern = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
if ($UserEmail -notmatch $emailPattern) {
    Write-Error "Invalid email format"
    exit 1
}

Write-Status "Email validated: $UserEmail"

# Check system requirements
Write-Host "🔍 Checking System Requirements" -ForegroundColor $Blue

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    $nodeVersionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    
    if ($nodeVersionNumber -lt 18) {
        Write-Error "Node.js version 18+ is required. Current version: $nodeVersion"
        exit 1
    }
    Write-Status "Node.js version: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js 18+ first."
    Write-Host "Visit: https://nodejs.org/"
    exit 1
}

# Check if MongoDB is installed
try {
    mongod --version | Out-Null
    Write-Status "MongoDB is installed"
} catch {
    Write-Warning "MongoDB is not installed. Please install MongoDB first."
    Write-Host "Visit: https://docs.mongodb.com/manual/installation/"
    $continue = Read-Host "Do you want to continue without MongoDB? (y/N)"
    if ($continue -notmatch "^[Yy]$") {
        exit 1
    }
}

# Check if PM2 is installed
try {
    pm2 --version | Out-Null
    Write-Status "PM2 is already installed"
} catch {
    Write-Warning "PM2 is not installed. Installing PM2..."
    npm install -g pm2
    Write-Status "PM2 installed"
}

# Install dependencies
Write-Host "📦 Installing Dependencies" -ForegroundColor $Blue
if (Test-Path "package.json") {
    npm install
    Write-Status "Dependencies installed"
} else {
    Write-Error "package.json not found. Are you in the correct directory?"
    exit 1
}

# Generate machine code
Write-Host "🔑 Generating Machine Code" -ForegroundColor $Blue
$MachineCode = node -e "
const crypto = require('crypto');
const os = require('os');

const networkInterfaces = os.networkInterfaces();
const macAddress = Object.values(networkInterfaces)
  .flat()
  .find(iface => !iface.internal && iface.mac !== '00:00:00:00:00:00')?.mac || 'unknown';

const machineString = \`\${os.platform()}-\${os.arch()}-\${os.hostname()}-\${macAddress}\`;
const machineCode = crypto.createHash('sha256').update(machineString).digest('hex').substring(0, 16);

"

Write-Status "Machine code generated: $MachineCode"

# Register license with superadmin
Write-Host "📝 Registering License" -ForegroundColor $Blue
Write-Host "Registering license with superadmin API..."

$licenseBody = @{
    machineCode = $MachineCode
    version = $AppVersion
    email = $UserEmail
} | ConvertTo-Json

try {
    $LicenseResponse = Invoke-RestMethod -Uri "$SuperAdminApiUrl/api/license/register" -Method Post -Body $licenseBody -ContentType "application/json"
    
    if ($LicenseResponse.message) {
        Write-Status "License registered successfully"
        
        $LicenseKey = $LicenseResponse.license.licenseKey
        if ($LicenseKey) {
            Write-Status "License key received: $LicenseKey"
            
            # Create license.json file
            $licenseData = @{
                licenseKey = $LicenseKey
                machineCode = $MachineCode
                email = $UserEmail
                version = $AppVersion
                lastValidated = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                isValid = $true
            } | ConvertTo-Json -Depth 3
            
            $licenseData | Out-File -FilePath "license.json" -Encoding UTF8
            Write-Status "License file created: license.json"
        } else {
            Write-Error "Failed to extract license key from response"
            exit 1
        }
    } else {
        Write-Error "License registration failed"
        Write-Host "Response: $($LicenseResponse | ConvertTo-Json)"
        exit 1
    }
} catch {
    Write-Error "Failed to connect to superadmin API: $($_.Exception.Message)"
    exit 1
}

# Validate license
Write-Host "✅ Validating License" -ForegroundColor $Blue
$validationBody = @{
    licenseKey = $LicenseKey
    machineCode = $MachineCode
    installedVersion = $AppVersion
} | ConvertTo-Json

try {
    $ValidationResponse = Invoke-RestMethod -Uri "$SuperAdminApiUrl/api/license/validate" -Method Post -Body $validationBody -ContentType "application/json"
    
    if ($ValidationResponse.valid) {
        Write-Status "License validation successful"
    } else {
        Write-Error "License validation failed"
        Write-Host "Response: $($ValidationResponse | ConvertTo-Json)"
        exit 1
    }
} catch {
    Write-Error "License validation failed: $($_.Exception.Message)"
    exit 1
}

# Create environment file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "⚙️ Creating Environment File" -ForegroundColor $Blue
    
    # Generate JWT secret
    $jwtSecret = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    
    $envContent = @"
# Database
MONGODB_URI=mongodb://localhost:27017/hiretrack

# JWT
JWT_SECRET=$jwtSecret

# Superadmin API
SUPERADMIN_API_URL=$SuperAdminApiUrl

# App Configuration
NODE_ENV=production
PORT=3000

# License (auto-generated)
LICENSE_KEY=$LicenseKey
MACHINE_CODE=$MachineCode
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Status "Environment file created: .env"
} else {
    Write-Warning "Environment file already exists, skipping creation"
}

# Build the application
Write-Host "🔨 Building Application" -ForegroundColor $Blue
if ((Test-Path "next.config.js") -or (Test-Path "next.config.mjs")) {
    npm run build
    Write-Status "Application built successfully"
} else {
    Write-Warning "Next.js config not found, skipping build"
}

# Create Windows service (optional)
Write-Host "🔧 Creating Windows Service" -ForegroundColor $Blue
$createService = Read-Host "Do you want to create a Windows service for auto-start? (y/N)"
if ($createService -match "^[Yy]$") {
    if ($isAdmin) {
        $serviceName = "HireTrack"
        $servicePath = (Get-Location).Path
        $nodePath = (Get-Command node).Source
        
        try {
            # Remove existing service if it exists
            $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($existingService) {
                Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
                sc.exe delete $serviceName
            }
            
            # Create new service
            New-Service -Name $serviceName -BinaryPathName "$nodePath $servicePath\server.js" -DisplayName "HireTrack Application" -Description "HireTrack SaaS Application" -StartupType Automatic
            Write-Status "Windows service created and configured for auto-start"
        } catch {
            Write-Warning "Failed to create Windows service: $($_.Exception.Message)"
        }
    } else {
        Write-Warning "Administrator privileges required to create Windows service"
    }
}

# Final validation
Write-Host "🎯 Final License Validation" -ForegroundColor $Blue
$finalValidation = node -e "
const fs = require('fs');
const licenseData = JSON.parse(fs.readFileSync('license.json', 'utf8'));
console.log('License Key:', licenseData.licenseKey);
console.log('Machine Code:', licenseData.machineCode);
console.log('Email:', licenseData.email);
console.log('Version:', licenseData.version);
console.log('Valid:', licenseData.isValid);
"

Write-Host $finalValidation

# Success message
Write-Host "🎉 Installation Complete!" -ForegroundColor $Green
Write-Host "==================================" -ForegroundColor $Green
Write-Status "All dependencies installed"
Write-Status "License registered and validated"
Write-Status "Application configured"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor $Blue
Write-Host "1. Start MongoDB service"
Write-Host "2. Start the application: npm start"
Write-Host "3. Visit: http://localhost:3000"
Write-Host ""
Write-Host "Important:" -ForegroundColor $Yellow
Write-Host "- Keep your license.json file secure"
Write-Host "- Do not share your license key"
Write-Host "- Contact support if you encounter any issues"
Write-Host ""
Write-Host "Support: support@yourcompany.com" -ForegroundColor $Blue