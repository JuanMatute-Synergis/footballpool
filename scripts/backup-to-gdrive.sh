#!/bin/bash

# Google Drive Database Backup Script
# Backs up the NFL Picks SQLite database to Google Drive using rclone

set -e  # Exit on any error

# Configuration
DATABASE_PATH="./data/database.sqlite"
BACKUP_DIR="./backups"
GDRIVE_REMOTE="gdrive:NFL-Picks-Backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_ONLY=$(date +"%Y%m%d")
BACKUP_FILENAME="nfl-picks-db-${TIMESTAMP}.sqlite"
LOG_FILE="./logs/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p "$BACKUP_DIR"
mkdir -p "./logs"

log "${BLUE}🚀 Starting database backup - $(date)${NC}"

# Check if database exists
if [ ! -f "$DATABASE_PATH" ]; then
    log "${RED}❌ Database file not found: $DATABASE_PATH${NC}"
    exit 1
fi

# Check if rclone is configured
if ! rclone lsd gdrive: > /dev/null 2>&1; then
    log "${RED}❌ Google Drive not configured. Run: rclone config${NC}"
    log "${YELLOW}💡 Or run: ./scripts/setup-gdrive-backup.sh for help${NC}"
    exit 1
fi

# Get database size and info
DB_SIZE=$(du -h "$DATABASE_PATH" | cut -f1)
log "${BLUE}📊 Database size: $DB_SIZE${NC}"

# Create local backup
log "${YELLOW}📋 Creating local backup...${NC}"
cp "$DATABASE_PATH" "$BACKUP_DIR/$BACKUP_FILENAME"

# Verify local backup
if [ ! -f "$BACKUP_DIR/$BACKUP_FILENAME" ]; then
    log "${RED}❌ Failed to create local backup${NC}"
    exit 1
fi

# Test database integrity
log "${YELLOW}🔍 Verifying database integrity...${NC}"
if ! sqlite3 "$BACKUP_DIR/$BACKUP_FILENAME" "PRAGMA integrity_check;" | grep -q "ok"; then
    log "${RED}❌ Database integrity check failed${NC}"
    exit 1
fi

# Get database stats for verification
USERS_COUNT=$(sqlite3 "$BACKUP_DIR/$BACKUP_FILENAME" "SELECT COUNT(*) FROM users;")
PICKS_COUNT=$(sqlite3 "$BACKUP_DIR/$BACKUP_FILENAME" "SELECT COUNT(*) FROM picks;")
LATEST_PICK=$(sqlite3 "$BACKUP_DIR/$BACKUP_FILENAME" "SELECT MAX(updated_at) FROM picks;")

log "${GREEN}✅ Database verification:${NC}"
log "   Users: $USERS_COUNT"
log "   Picks: $PICKS_COUNT"
log "   Latest pick: $LATEST_PICK"

# Upload to Google Drive daily folder
log "${YELLOW}☁️ Uploading to Google Drive...${NC}"
rclone copy "$BACKUP_DIR/$BACKUP_FILENAME" "$GDRIVE_REMOTE/daily/" --progress

# Verify upload
if rclone lsf "$GDRIVE_REMOTE/daily/" | grep -q "$BACKUP_FILENAME"; then
    log "${GREEN}✅ Successfully uploaded to Google Drive${NC}"
else
    log "${RED}❌ Upload verification failed${NC}"
    exit 1
fi

# Weekly backup (on Sundays)
if [ "$(date +%u)" = "7" ]; then
    log "${BLUE}📅 Creating weekly backup...${NC}"
    WEEKLY_FILENAME="nfl-picks-weekly-${DATE_ONLY}.sqlite"
    cp "$BACKUP_DIR/$BACKUP_FILENAME" "$BACKUP_DIR/$WEEKLY_FILENAME"
    rclone copy "$BACKUP_DIR/$WEEKLY_FILENAME" "$GDRIVE_REMOTE/weekly/" --progress
    log "${GREEN}✅ Weekly backup completed${NC}"
fi

# Cleanup old local backups (keep last 7 days)
log "${YELLOW}🧹 Cleaning up old local backups...${NC}"
find "$BACKUP_DIR" -name "nfl-picks-db-*.sqlite" -mtime +7 -delete
find "$BACKUP_DIR" -name "nfl-picks-weekly-*.sqlite" -mtime +30 -delete

# Cleanup old Google Drive backups (keep last 30 daily, 12 weekly)
log "${YELLOW}🧹 Cleaning up old Google Drive backups...${NC}"

# Get list of daily backups and remove old ones
DAILY_BACKUPS=$(rclone lsf "$GDRIVE_REMOTE/daily/" --format "t" | sort -r | tail -n +31)
if [ ! -z "$DAILY_BACKUPS" ]; then
    echo "$DAILY_BACKUPS" | while read -r backup; do
        rclone delete "$GDRIVE_REMOTE/daily/$backup"
        log "   Deleted old daily backup: $backup"
    done
fi

# Get list of weekly backups and remove old ones
WEEKLY_BACKUPS=$(rclone lsf "$GDRIVE_REMOTE/weekly/" --format "t" | sort -r | tail -n +13)
if [ ! -z "$WEEKLY_BACKUPS" ]; then
    echo "$WEEKLY_BACKUPS" | while read -r backup; do
        rclone delete "$GDRIVE_REMOTE/weekly/$backup"
        log "   Deleted old weekly backup: $backup"
    done
fi

# Show Google Drive usage
log "${BLUE}💾 Google Drive backup summary:${NC}"
rclone about gdrive: 2>/dev/null | grep -E "Total|Used|Free" || log "   (Unable to get drive usage info)"

log "${GREEN}🎉 Backup completed successfully - $(date)${NC}"
log "   Local backup: $BACKUP_DIR/$BACKUP_FILENAME"
log "   Google Drive: $GDRIVE_REMOTE/daily/$BACKUP_FILENAME"
log ""
# Requires: brew install rclone (then run 'rclone config' to setup Google Drive)
