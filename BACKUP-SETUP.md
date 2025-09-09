# Google Drive Backup Setup Guide

## 🎯 Overview
This setup provides automated daily backups of your NFL Picks database to Google Drive (15GB free).

## 📋 Quick Setup

### 1. Install rclone and configure Google Drive
```bash
# Run the setup script
./scripts/setup-gdrive-backup.sh

# Then configure rclone
rclone config
```

### 2. Follow the configuration steps:
1. Choose `n` for new remote
2. Name it `gdrive` 
3. Choose Google Drive (usually option 15)
4. Leave client_id and client_secret blank
5. Choose scope `1` (full access)
6. Leave root_folder_id blank
7. Choose `n` for advanced config
8. Choose `y` to auto config (opens browser)
9. Login to Google account and authorize
10. Choose `n` for team drive
11. Confirm configuration with `y`
12. Quit with `q`

### 3. Create backup folders
```bash
rclone mkdir gdrive:NFL-Picks-Backups
rclone mkdir gdrive:NFL-Picks-Backups/daily
rclone mkdir gdrive:NFL-Picks-Backups/weekly
```

### 4. Test the backup
```bash
./scripts/backup-to-gdrive.sh
```

## 🤖 Automated Backups

### Set up cron jobs for automatic backups:
```bash
# Edit crontab
crontab -e

# Add these lines:
0 2 * * * cd /Users/juanmatute/Projects/footballpool && ./scripts/backup-to-gdrive.sh >> ./logs/cron-backup.log 2>&1
0 1 * * 4,0,1 cd /Users/juanmatute/Projects/footballpool && ./scripts/backup-to-gdrive.sh >> ./logs/cron-backup.log 2>&1
```

This will:
- **Daily backup** at 2 AM
- **Extra backups** before game days (Thu, Sun, Mon at 1 AM)

## 📁 Backup Structure

```
Google Drive:
└── NFL-Picks-Backups/
    ├── daily/           (keeps last 30 days)
    │   ├── nfl-picks-db-20250909_020000.sqlite
    │   └── nfl-picks-db-20250910_020000.sqlite
    └── weekly/          (keeps last 12 weeks)
        ├── nfl-picks-weekly-20250908.sqlite
        └── nfl-picks-weekly-20250915.sqlite
```

## 🔧 Available Commands

### Manual backup:
```bash
./scripts/backup-to-gdrive.sh
```

### List available backups:
```bash
./scripts/restore-from-gdrive.sh
```

### Restore from backup:
```bash
./scripts/restore-from-gdrive.sh nfl-picks-db-20250909_120000.sqlite
```

### Check Google Drive usage:
```bash
rclone about gdrive:
```

## 🛡️ Backup Features

- ✅ **Database integrity verification** before upload
- ✅ **Automatic cleanup** (30 daily, 12 weekly backups)
- ✅ **Local backup creation** before restore
- ✅ **Deployment integration** (auto-backup before deployments)
- ✅ **Detailed logging** in `./logs/backup.log`
- ✅ **Progress indicators** during upload/download

## 🚨 Disaster Recovery

If you lose your database:

1. **List available backups:**
   ```bash
   ./scripts/restore-from-gdrive.sh
   ```

2. **Restore the latest backup:**
   ```bash
   ./scripts/restore-from-gdrive.sh nfl-picks-db-YYYYMMDD_HHMMSS.sqlite
   ```

3. **Verify the restoration:**
   - Check user count and picks
   - Test login functionality
   - Verify recent changes are present

## 📊 Monitoring

### Check backup logs:
```bash
tail -f ./logs/backup.log
```

### Check cron backup logs:
```bash
tail -f ./logs/cron-backup.log
```

### Verify backups exist:
```bash
rclone lsf gdrive:NFL-Picks-Backups/daily/ | head -5
```

## 💡 Tips

- **Free storage:** Google Drive provides 15GB free (plenty for years of database backups)
- **Security:** Backups include all user data, so keep your Google account secure
- **Frequency:** Daily backups are sufficient; game-day backups provide extra safety
- **Testing:** Test restoration process occasionally to ensure backups work
- **Monitoring:** Check backup logs weekly to ensure automation is working

## 🔒 Privacy Note

Database backups contain user emails, passwords (hashed), and picks. Keep your Google Drive secure and consider using a dedicated Google account for backups.
