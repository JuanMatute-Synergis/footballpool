# GitHub Actions Deployment Setup

This repository includes a GitHub Actions workflow for automatic deployment to your production server.

## Required Secrets

To use the deployment workflow, you need to set up the following secrets in your GitHub repository:

### Repository Secrets Setup

1. Go to your GitHub repository
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the following:

#### Required Secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `HOST` | Your server's IP address or domain | `192.168.1.100` or `myserver.com` |
| `USERNAME` | SSH username for your server | `ubuntu` or `root` |
| `SSH_KEY` | Private SSH key for server access | Contents of your `~/.ssh/id_rsa` file |

#### Optional Secrets:

| Secret Name | Default Value | Description |
|-------------|---------------|-------------|
| `PORT` | `22` | SSH port for your server |
| `PROJECT_PATH` | `/opt/footballpool` | Path where your project is deployed |

## SSH Key Setup

### 1. Generate SSH Key (if you don't have one)
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions@footballpool"
```

### 2. Copy Public Key to Server
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub username@your-server
```

### 3. Add Private Key to GitHub Secrets
```bash
cat ~/.ssh/id_rsa
```
Copy the entire output (including `-----BEGIN` and `-----END` lines) and paste it as the `SSH_KEY` secret.

## Server Prerequisites

Your production server should have:
- Git installed
- Docker and Docker Compose installed
- Your project cloned to the specified path
- SSH access configured

## Workflow Behavior

The workflow will:
1. **Trigger** on every push to the `main` branch
2. **Connect** to your server via SSH
3. **Pull** the latest changes from git
4. **Stop** existing containers
5. **Rebuild** and start containers with latest code
6. **Wait** 30 seconds for startup
7. **Health Check** the API endpoint
8. **Report** success or failure

## Manual Deployment

You can also trigger the deployment manually:
1. Go to **Actions** tab in your GitHub repository
2. Click on **Deploy to Production** workflow
3. Click **Run workflow** button

## Troubleshooting

### Common Issues:

1. **SSH Connection Failed**
   - Verify `HOST`, `USERNAME`, and `SSH_KEY` secrets
   - Ensure SSH key is properly formatted
   - Check server firewall settings

2. **Git Pull Failed**
   - Ensure the project directory exists on server
   - Verify git repository is properly initialized
   - Check file permissions

3. **Docker Build Failed**
   - Check Docker and Docker Compose are installed
   - Verify sufficient disk space
   - Review container logs

4. **Health Check Failed**
   - Application may need more startup time
   - Check if port 3000 is available
   - Review application logs

### Viewing Logs:
```bash
# On your server
cd /opt/footballpool  # or your PROJECT_PATH
docker-compose logs --tail=50
```
