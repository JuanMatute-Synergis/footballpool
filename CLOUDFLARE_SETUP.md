# Cloudflare Tunnel Setup for NFL Picks App

## Your Application Details
- **Local URL**: http://localhost:3001
- **Desired Public URL**: https://footballpool.golfleaguemanager.app

## Step-by-Step Setup Instructions

### Option 1: Add to Existing Tunnel Configuration

If you have an existing cloudflared configuration file, add this entry:

```yaml
ingress:
  - hostname: footballpool.golfleaguemanager.app
    service: http://localhost:3001
    originRequest:
      connectTimeout: 30s
      tlsTimeout: 20s
      tcpKeepAlive: true
      noHappyEyeballs: false
      keepAliveConnections: 10
      keepAliveTimeout: 1m30s
      httpHostHeader: footballpool.golfleaguemanager.app
  
  # Your other existing entries...
  # (keep your existing ingress rules here)
  
  # Catch-all rule (must be last)
  - service: http_status:404
```

### Option 2: Command Line Configuration

If you prefer to use the command line:

```bash
# Add DNS record for the subdomain
cloudflared tunnel route dns YOUR_TUNNEL_NAME footballpool.golfleaguemanager.app

# Then update your tunnel configuration to include the service mapping
```

### Option 3: Cloudflare Dashboard

1. Go to your Cloudflare dashboard
2. Navigate to Zero Trust > Access > Tunnels
3. Find your existing tunnel
4. Click "Configure"
5. Add a new public hostname:
   - **Subdomain**: footballpool
   - **Domain**: golfleaguemanager.app
   - **Service Type**: HTTP
   - **URL**: localhost:3001

## After Configuration

1. **Restart your cloudflared service**:
   ```bash
   # If using systemd
   sudo systemctl restart cloudflared
   
   # If running manually, restart your cloudflared process
   ```

2. **Test the configuration**:
   ```bash
   curl -I https://footballpool.golfleaguemanager.app/health
   ```

3. **Access your application**:
   - Public URL: https://footballpool.golfleaguemanager.app
   - Admin login: admin@nflpicks.com / admin123

## Troubleshooting

- **502 Bad Gateway**: Check that the application is running on localhost:3001
- **DNS not resolving**: Wait a few minutes for DNS propagation
- **Certificate errors**: Cloudflare handles SSL automatically

## Application Management

```bash
# View application logs
cd /Users/juanmatute/Projects/footballpool
docker-compose logs -f

# Stop application
docker-compose down

# Restart application
docker-compose restart

# Rebuild and deploy
./deploy.sh
```
