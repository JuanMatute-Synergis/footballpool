#!/bin/bash

# Google Drive Backup Setup Script for NFL Picks Database
# This script installs rclone and sets up Google Drive backup

echo "🔧 Setting up Google Drive backup for NFL Picks database..."

# Check if rclone is installed
if ! command -v rclone &> /dev/null; then
    echo "📦 Installing rclone..."
    
    # Install rclone based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install rclone
        else
            echo "❌ Homebrew not found. Please install Homebrew first:"
            echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl https://rclone.org/install.sh | sudo bash
    else
        echo "❌ Unsupported OS. Please install rclone manually from https://rclone.org/downloads/"
        exit 1
    fi
else
    echo "✅ rclone is already installed"
fi

echo ""
echo "🔑 Now we need to configure Google Drive..."
echo ""
echo "📋 Follow these steps:"
echo "1. Run: rclone config"
echo "2. Choose 'n' for new remote"
echo "3. Name it 'gdrive'"
echo "4. Choose Google Drive (usually option 15)"
echo "5. Leave client_id and client_secret blank (press Enter)"
echo "6. Choose scope '1' (full access)"
echo "7. Leave root_folder_id blank"
echo "8. Leave service_account_file blank"
echo "9. Choose 'n' for advanced config"
echo "10. Choose 'y' to auto config (this will open browser)"
echo "11. Login to your Google account and authorize rclone"
echo "12. Choose 'n' for team drive"
echo "13. Choose 'y' to confirm the configuration"
echo "14. Choose 'q' to quit config"
echo ""
echo "After configuration, run: ./scripts/backup-to-gdrive.sh to test"
echo ""

# Create the backup directory structure on Google Drive
echo "📁 Creating backup folder structure..."
echo "After rclone config, run these commands to set up folders:"
echo "  rclone mkdir gdrive:NFL-Picks-Backups"
echo "  rclone mkdir gdrive:NFL-Picks-Backups/daily"
echo "  rclone mkdir gdrive:NFL-Picks-Backups/weekly"
echo ""

echo "🎉 Setup script completed!"
echo "Next steps:"
echo "1. Run: rclone config"
echo "2. Follow the configuration steps above"
echo "3. Test with: ./scripts/backup-to-gdrive.sh"
