# Self-Hosted GitHub Runner Setup

This guide will help you set up a self-hosted GitHub Actions runner for automatic deployment of your NFL Picks application.

## Why Self-Hosted Runners?

**Advantages:**
- 🚀 **Faster deployments** - No SSH connection needed
- 🔒 **More secure** - Runs directly on your server
- 💰 **Cost effective** - No GitHub Actions minutes usage
- 🛠️ **More control** - Full access to your server environment
- 📦 **Simpler setup** - No SSH keys or secrets management needed

## Prerequisites

- A Linux server (Ubuntu/Debian recommended)
- Docker and Docker Compose installed
- Your project cloned to the server
- Admin access to your GitHub repository

## Setup Steps

### 1. Install GitHub Actions Runner

On your server, run these commands:

```bash
# Create a folder for the runner
mkdir actions-runner && cd actions-runner

# Download the latest runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract the installer
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
```

### 2. Configure the Runner

1. **Get registration token from GitHub:**
   - Go to your repository: `https://github.com/JuanMatute-Synergis/footballpool`
   - Click **Settings** → **Actions** → **Runners**
   - Click **New self-hosted runner**
   - Select **Linux** and copy the configuration command

2. **Configure the runner:**
   ```bash
   # Use the configuration command from GitHub (it will look like this):
   ./config.sh --url https://github.com/JuanMatute-Synergis/footballpool --token YOUR_TOKEN_HERE
   ```

3. **When prompted:**
   - **Runner group:** Press Enter (default)
   - **Runner name:** `nfl-picks-server` (or your preferred name)
   - **Work folder:** Press Enter (default)
   - **Labels:** `self-hosted,linux,production`

### 3. Install the Runner as a Service

```bash
# Install the service
sudo ./svc.sh install

# Start the service
sudo ./svc.sh start

# Check status
sudo ./svc.sh status
```

### 4. Set Up Project Directory

Make sure your project is in the right location:

```bash
# Navigate to your project directory
cd /path/to/your/footballpool

# Ensure it's a git repository
git remote -v

# Make sure Docker works
docker compose ps
```

### 5. Test the Setup

1. **Commit a small change** to trigger the workflow
2. **Check the Actions tab** in your GitHub repository
3. **Verify the runner appears** in Settings → Actions → Runners

## Workflow Files

Two deployment workflows are available:

### Option 1: Self-Hosted Runner (Recommended)
- **File:** `.github/workflows/deploy-self-hosted.yml`
- **Runs on:** `self-hosted` runner
- **Advantages:** Direct deployment, faster, more reliable

### Option 2: SSH-Based Deployment
- **File:** `.github/workflows/deploy.yml` 
- **Runs on:** GitHub's runners
- **Requires:** SSH secrets setup
- **Use when:** Self-hosted runner not available

## Managing the Runner

### Check Runner Status
```bash
sudo systemctl status actions.runner.JuanMatute-Synergis-footballpool.nfl-picks-server.service
```

### View Runner Logs
```bash
sudo journalctl -u actions.runner.JuanMatute-Synergis-footballpool.nfl-picks-server.service -f
```

### Restart Runner
```bash
sudo ./svc.sh stop
sudo ./svc.sh start
```

### Update Runner
```bash
# Stop the service
sudo ./svc.sh stop

# Download latest version
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract and restart
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
sudo ./svc.sh start
```

## Security Considerations

### Firewall Setup
```bash
# Allow SSH (if needed)
sudo ufw allow 22

# Allow your application port
sudo ufw allow 3001

# Enable firewall
sudo ufw enable
```

### Runner Security
- Runner runs as a service user (not root)
- Only has access to your repository
- Can only run workflows you define
- Isolated from other system processes

## Troubleshooting

### Runner Not Appearing
1. Check if the service is running: `sudo ./svc.sh status`
2. Check the logs: `sudo journalctl -u actions.runner.* -f`
3. Verify network connectivity to GitHub

### Deployment Failures
1. Check Docker is running: `docker ps`
2. Verify project directory permissions
3. Check container logs: `docker compose logs`

### Performance Issues
1. Ensure adequate disk space: `df -h`
2. Check memory usage: `free -h`
3. Monitor Docker resources: `docker system df`

## Next Steps

1. **Set up the runner** following steps 1-3
2. **Test with a commit** to verify automatic deployment
3. **Monitor the first few deployments** to ensure stability
4. **Set up monitoring** (optional) for production use

Your NFL Picks application will now automatically deploy whenever you push to the main branch! 🚀
