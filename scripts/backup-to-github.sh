#!/bin/bash

# GitHub Database Backup Script
# This script creates database backups and commits them to a backup branch

set -e

# Configuration
BACKUP_BRANCH="database-backups"
DB_PATH="./data/database.sqlite"
BACKUP_DIR="./database-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="database-backup-${TIMESTAMP}.sqlite"

echo "🔄 Starting database backup to GitHub..."

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at $DB_PATH"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create the backup
echo "📦 Creating database backup..."
cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_FILENAME"

# Get database stats
USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;")
PICK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM picks;")
LATEST_PICK=$(sqlite3 "$DB_PATH" "SELECT MAX(updated_at) FROM picks;")

echo "✅ Backup created: $BACKUP_FILENAME"
echo "   Users: $USER_COUNT"
echo "   Picks: $PICK_COUNT"
echo "   Latest Pick: $LATEST_PICK"

# Add to git
git add "$BACKUP_DIR/$BACKUP_FILENAME"

# Create commit message with database stats
COMMIT_MSG="Database backup $TIMESTAMP

Stats:
- Users: $USER_COUNT
- Picks: $PICK_COUNT
- Latest Activity: $LATEST_PICK
- Size: $(du -h "$BACKUP_DIR/$BACKUP_FILENAME" | cut -f1)"

git commit -m "$COMMIT_MSG"

# Push to backup branch
echo "🚀 Pushing backup to GitHub..."
git push origin HEAD:$BACKUP_BRANCH

echo "✅ Database backup completed and pushed to GitHub!"
echo "   Branch: $BACKUP_BRANCH"
echo "   File: $BACKUP_FILENAME"

# Cleanup old backups (keep last 10)
echo "🧹 Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -t database-backup-*.sqlite | tail -n +11 | xargs -r rm -f
cd ..

echo "🎉 Backup process completed successfully!"
