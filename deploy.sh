#!/bin/bash

# NFL Picks Production Deployment Script

set -e  # Exit on any error

echo "🏈 NFL Picks - Production Deployment"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Building and deploying NFL Picks application...${NC}"

# Stop existing container if running
echo "🛑 Stopping existing containers..."
docker-compose down || true

# Remove old images to ensure fresh build
echo "🗑️  Removing old images..."
docker-compose down --rmi all --volumes --remove-orphans || true

# Build and start the application
echo "🚀 Building and starting the application..."
docker-compose up --build -d

# Wait for the application to be ready
echo "⏳ Waiting for application to be ready..."
sleep 10

# Health check
echo "🔍 Checking application health..."
for i in {1..30}; do
    if curl -f -s http://localhost:3001/health > /dev/null; then
        echo -e "${GREEN}✅ Application is healthy and ready!${NC}"
        break
    elif [ $i -eq 30 ]; then
        echo -e "${RED}❌ Application failed to start after 5 minutes${NC}"
        echo "Checking logs..."
        docker-compose logs --tail=50
        exit 1
    else
        echo "Attempt $i/30: Application not ready yet..."
        sleep 10
    fi
done

# Display deployment information
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "====================================="
echo "🌐 Local access: http://localhost:3001"
echo "🌍 Public access: https://footballpool.golfleaguemanager.app (after Cloudflare setup)"
echo ""
echo "📊 Default admin credentials:"
echo "   Email: admin@nflpicks.com"
echo "   Password: admin123"
echo ""
echo "🔧 Management commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop app:  docker-compose down"
echo "   Restart:   docker-compose restart"
echo ""
echo -e "${YELLOW}⚠️  Next step: Configure Cloudflare tunnel${NC}"
echo "   1. Add footballpool.golfleaguemanager.app to your tunnel config"
echo "   2. Point it to http://localhost:3001"
echo "   3. Apply the tunnel configuration"
