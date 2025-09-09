#!/bin/bash

# Cloudflare Tunnel Configuration Update Script
# This script updates your cloudflared config to include footballpool.golfleaguemanager.app

set -e

echo "🌐 Updating Cloudflare Tunnel Configuration"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CURRENT_CONFIG="/usr/local/etc/cloudflared/config.yml"
BACKUP_CONFIG="/usr/local/etc/cloudflared/config.yml.backup.$(date +%Y%m%d-%H%M%S)"
NEW_CONFIG="/Users/juanmatute/Projects/footballpool/updated-cloudflared-config.yml"

echo -e "${YELLOW}📋 Current configuration:${NC}"
echo "================================"
sudo cat "$CURRENT_CONFIG"
echo "================================"
echo ""

echo -e "${YELLOW}📝 Proposed new configuration:${NC}"
echo "================================"
cat "$NEW_CONFIG"
echo "================================"
echo ""

# Ask for confirmation
read -p "Do you want to update the cloudflared configuration? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Configuration update cancelled${NC}"
    exit 0
fi

echo -e "${YELLOW}💾 Creating backup of current configuration...${NC}"
sudo cp "$CURRENT_CONFIG" "$BACKUP_CONFIG"
echo -e "${GREEN}✅ Backup created: $BACKUP_CONFIG${NC}"

echo -e "${YELLOW}📝 Updating configuration...${NC}"
sudo cp "$NEW_CONFIG" "$CURRENT_CONFIG"
echo -e "${GREEN}✅ Configuration updated${NC}"

echo -e "${YELLOW}🔄 Restarting cloudflared service...${NC}"
# Try different methods to restart cloudflared
if sudo brew services restart cloudflared 2>/dev/null; then
    echo -e "${GREEN}✅ Cloudflared restarted via Homebrew services${NC}"
elif sudo launchctl unload /Library/LaunchDaemons/com.cloudflare.cloudflared.plist && sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cloudflared.plist 2>/dev/null; then
    echo -e "${GREEN}✅ Cloudflared restarted via launchctl${NC}"
else
    echo -e "${YELLOW}⚠️  Please manually restart your cloudflared service${NC}"
    echo "   You can try: sudo brew services restart cloudflared"
fi

echo ""
echo -e "${GREEN}🎉 Configuration Update Complete!${NC}"
echo "=================================="
echo "🌐 Your NFL Picks app should now be available at:"
echo "   https://footballpool.golfleaguemanager.app"
echo ""
echo "⏳ Note: DNS propagation may take a few minutes"
echo ""
echo "🧪 Test your configuration:"
echo "   curl -I https://footballpool.golfleaguemanager.app/health"
echo ""
echo "🔄 If you need to rollback:"
echo "   sudo cp $BACKUP_CONFIG $CURRENT_CONFIG"
echo "   sudo brew services restart cloudflared"
