#!/bin/bash

# Dropbox Database Backup Script
# Requires: Dropbox-Uploader (https://github.com/andreafabrizi/Dropbox-Uploader)

set -e

# Configuration
DB_PATH="./data/database.sqlite"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="nfl-picks-backup-${TIMESTAMP}.sqlite"
DROPBOX_UPLOADER="./scripts/dropbox_uploader.sh"  # Path to dropbox_uploader.sh

echo "🔄 Starting database backup to Dropbox..."

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found at $DB_PATH"
    exit 1
fi

# Check if Dropbox Uploader is available
if [ ! -f "$DROPBOX_UPLOADER" ]; then
    echo "❌ Dropbox Uploader not found"
    echo "   Download from: https://github.com/andreafabrizi/Dropbox-Uploader"
    echo "   Place dropbox_uploader.sh in ./scripts/"
    exit 1
fi

# Get database stats
USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;")
PICK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM picks;")
LATEST_PICK=$(sqlite3 "$DB_PATH" "SELECT MAX(updated_at) FROM picks;")
DB_SIZE=$(du -h "$DB_PATH" | cut -f1)

echo "📦 Creating backup with stats:"
echo "   Users: $USER_COUNT"
echo "   Picks: $PICK_COUNT"
echo "   Latest Pick: $LATEST_PICK"
echo "   Size: $DB_SIZE"

# Upload current database
echo "☁️ Uploading to Dropbox..."
"$DROPBOX_UPLOADER" upload "$DB_PATH" "/nfl-picks-backups/database.sqlite"

# Upload timestamped version
"$DROPBOX_UPLOADER" upload "$DB_PATH" "/nfl-picks-backups/$BACKUP_FILENAME"

# Create and upload metadata
METADATA_FILE="/tmp/backup-metadata-${TIMESTAMP}.txt"
cat > "$METADATA_FILE" << EOF
NFL Picks Database Backup
========================
Backup Date: $(date)
Timestamp: $TIMESTAMP
Filename: $BACKUP_FILENAME

Database Statistics:
- Users: $USER_COUNT
- Picks: $PICK_COUNT
- Latest Pick: $LATEST_PICK
- File Size: $DB_SIZE

Restore Instructions:
1. Download the backup file from Dropbox
2. Stop the application: docker-compose stop
3. Replace database: cp downloaded-backup.sqlite ./data/database.sqlite
4. Start application: docker-compose up -d
EOF

"$DROPBOX_UPLOADER" upload "$METADATA_FILE" "/nfl-picks-backups/backup-info-${TIMESTAMP}.txt"
rm "$METADATA_FILE"

echo "✅ Backup completed!"
echo "   Location: Dropbox -> /nfl-picks-backups/"
echo "   Files: database.sqlite, $BACKUP_FILENAME"

# List recent backups
echo "📋 Recent backups:"
"$DROPBOX_UPLOADER" list "/nfl-picks-backups/" | grep "backup-.*\.sqlite" | tail -5

echo "🎉 Dropbox backup completed successfully!"
