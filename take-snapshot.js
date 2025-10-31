// backup.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------
// 📦 MongoDB Backup Script
// ---------------------------------------------

const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.error('❌ config.json not found.');
  process.exit(1);
}

const config = require(configPath);
const { dbUrl } = config;

// Validate DB URL
if (!dbUrl) {
  console.error('❌ Database URL (dbUrl) missing in config.json.');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dumpDir = path.join('/tmp', `mongo-dump-${timestamp}`);
const backupDir = path.join(__dirname, 'backups');
const tarFile = path.join(backupDir, `backup-${timestamp}.tar.gz`);

// Ensure backup directory exists
fs.mkdirSync(backupDir, { recursive: true });

// Build commands
const dumpCmd = `mongodump --uri="${dbUrl}" --out="${dumpDir}"`;
const compressCmd = `tar -czf "${tarFile}" -C "${dumpDir}" .`;
const cleanupCmd = `rm -rf "${dumpDir}"`;

// Log info
console.log('🧩 Starting MongoDB backup...');
console.log(`🔗 DB URL: ${dbUrl}`);
console.log(`📁 Backup Path: ${tarFile}`);
console.log('----------------------------------');

// Run backup
exec(`${dumpCmd} && ${compressCmd} && ${cleanupCmd}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Backup failed: ${error.message}`);
    return;
  }
  if (stderr && !stderr.includes('warning')) {
    console.error(`⚠ stderr: ${stderr}`);
  }
  console.log(`✅ Backup successful! Archive created at: ${tarFile}`);
});
