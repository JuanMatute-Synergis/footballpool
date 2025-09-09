#!/bin/bash

# Restore database from Google Drive backup
# Usage: ./scripts/restore-from-gdrive.sh [backup-filename]

set -e

# Configuration
GDRIVE_REMOTE="gdrive:NFL-Picks-Backups"
LOCAL_BACKUP_DIR="./backups"
DATABASE_PATH="./data/database.sqlite"
LOG_FILE="./logs/restore.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

mkdir -p "$LOCAL_BACKUP_DIR"
mkdir -p "./logs"

log "${BLUE}🔄 Database restore from Google Drive${NC}"

# Check if rclone is configured
if ! rclone lsd gdrive: > /dev/null 2>&1; then
    log "${RED}❌ Google Drive not configured. Run: rclone config${NC}"
    exit 1
fi

# If backup filename not provided, show available backups
if [ -z "$1" ]; then
    log "${YELLOW}📋 Available backups:${NC}"
    log ""
    log "${BLUE}Daily backups:${NC}"
    rclone lsf "$GDRIVE_REMOTE/daily/" --format "tsp" | sort -r | head -10
    log ""
    log "${BLUE}Weekly backups:${NC}"
    rclone lsf "$GDRIVE_REMOTE/weekly/" --format "tsp" | sort -r | head -5
    log ""
    log "${YELLOW}Usage: ./scripts/restore-from-gdrive.sh <backup-filename>${NC}"
    log "Example: ./scripts/restore-from-gdrive.sh nfl-picks-db-20250909_120000.sqlite"
    exit 0
fi

BACKUP_FILENAME="$1"

# Try to find backup in daily folder first, then weekly
BACKUP_FOUND=""
if rclone lsf "$GDRIVE_REMOTE/daily/" | grep -q "$BACKUP_FILENAME"; then
    BACKUP_FOUND="$GDRIVE_REMOTE/daily/$BACKUP_FILENAME"
    log "${GREEN}✅ Found backup in daily folder${NC}"
elif rclone lsf "$GDRIVE_REMOTE/weekly/" | grep -q "$BACKUP_FILENAME"; then
    BACKUP_FOUND="$GDRIVE_REMOTE/weekly/$BACKUP_FILENAME"
    log "${GREEN}✅ Found backup in weekly folder${NC}"
else
    log "${RED}❌ Backup file not found: $BACKUP_FILENAME${NC}"
    exit 1
fi

# Download backup
log "${YELLOW}⬇️ Downloading backup from Google Drive...${NC}"
rclone copy "$BACKUP_FOUND" "$LOCAL_BACKUP_DIR/" --progress

# Verify download
LOCAL_BACKUP="$LOCAL_BACKUP_DIR/$BACKUP_FILENAME"
if [ ! -f "$LOCAL_BACKUP" ]; then
    log "${RED}❌ Failed to download backup${NC}"
    exit 1
fi

# Verify backup integrity
log "${YELLOW}🔍 Verifying backup integrity...${NC}"
if ! sqlite3 "$LOCAL_BACKUP" "PRAGMA integrity_check;" | grep -q "ok"; then
    log "${RED}❌ Backup integrity check failed${NC}"
    exit 1
fi

# Show backup info
USERS_COUNT=$(sqlite3 "$LOCAL_BACKUP" "SELECT COUNT(*) FROM users;")
PICKS_COUNT=$(sqlite3 "$LOCAL_BACKUP" "SELECT COUNT(*) FROM picks;")
LATEST_PICK=$(sqlite3 "$LOCAL_BACKUP" "SELECT MAX(updated_at) FROM picks;")

log "${GREEN}📊 Backup verification:${NC}"
log "   Users: $USERS_COUNT"
log "   Picks: $PICKS_COUNT"
log "   Latest pick: $LATEST_PICK"

# Confirm restore
log ""
log "${YELLOW}⚠️ This will replace your current database!${NC}"
read -p "Are you sure you want to restore? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "${BLUE}❌ Restore cancelled${NC}"
    exit 0
fi

# Stop containers if running
log "${YELLOW}🛑 Stopping containers...${NC}"
docker-compose stop || true

# Backup current database
if [ -f "$DATABASE_PATH" ]; then
    CURRENT_BACKUP="$DATABASE_PATH.before-restore-$(date +%Y%m%d_%H%M%S).backup"
    cp "$DATABASE_PATH" "$CURRENT_BACKUP"
    log "${GREEN}✅ Current database backed up to: $CURRENT_BACKUP${NC}"
fi

# Restore database
log "${YELLOW}🔄 Restoring database...${NC}"
cp "$LOCAL_BACKUP" "$DATABASE_PATH"

# Start containers
log "${YELLOW}🚀 Starting containers...${NC}"
docker-compose up -d

# Wait and verify
sleep 10
log "${YELLOW}🔍 Verifying restore...${NC}"

# Final verification
RESTORED_USERS=$(sqlite3 "$DATABASE_PATH" "SELECT COUNT(*) FROM users;")
RESTORED_PICKS=$(sqlite3 "$DATABASE_PATH" "SELECT COUNT(*) FROM picks;")

log "${GREEN}🎉 Restore completed successfully!${NC}"
log "   Restored users: $RESTORED_USERS"
log "   Restored picks: $RESTORED_PICKS"
log "   Application should be running at: http://localhost:3001"
