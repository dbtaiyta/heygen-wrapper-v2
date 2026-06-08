# Deployment Guide

## Option 1: Coolify (Recommended)

### Prerequisites
- Coolify instance running
- Redis available (can use Coolify's built-in Redis service)

### Steps

1. **Push to GitHub**
   ```bash
   # Create repo on GitHub first, then:
   git remote add origin https://github.com/YOUR_USERNAME/heygen-wrapper-v2.git
   git push -u origin main
   ```

2. **Create Resource in Coolify**
   - Go to Coolify Dashboard
   - Create New Resource → Docker Compose
   - Connect your GitHub repo
   - Select `docker-compose.yml`

3. **Set Environment Variables**
   In Coolify environment settings:
   ```
   ADMIN_PASSWORD=your-secure-password
   VIDEO_RETENTION_HOURS=24
   MAX_CONCURRENT_JOBS=1
   HEADED_DEBUG=false
   LOG_LEVEL=info
   ```

4. **Configure Domain**
   - Add domain in Coolify: `heygen-v2.dbtaiyta.cfd`
   - Coolify auto-configures Traefik reverse proxy

5. **Deploy**
   - Click Deploy in Coolify
   - Wait for build to complete

6. **Setup HeyGen Session (First Time Only)**
   ```bash
   # SSH into server
   ssh user@your-server
   
   # Exec into container
   docker exec -it heygen-wrapper-heygen-wrapper-1 npm run setup-session
   
   # Or if using Coolify's docker names:
   docker ps | grep heygen
   docker exec -it <container-name> npm run setup-session
   ```

   This opens a browser. Login with Google OAuth, then session saves to `/data/chrome-profile`.

7. **Verify**
   ```bash
   curl https://heygen-v2.dbtaiyta.cfd/api/health
   ```

   Should return:
   ```json
   {
     "status": "ok",
     "session": "connected",
     ...
   }
   ```

## Option 2: Manual Docker Deployment

```bash
# 1. Clone repo on server
git clone https://github.com/YOUR_USERNAME/heygen-wrapper-v2.git
cd heygen-wrapper-v2

# 2. Create .env
cp .env.example .env
# Edit .env with your settings

# 3. Start services
docker-compose up -d

# 4. Setup session
docker exec -it heygen-wrapper npm run setup-session

# 5. Check logs
docker-compose logs -f heygen-wrapper
```

## Option 3: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start Redis locally
docker run -d -p 6379:6379 redis:7-alpine

# 3. Create .env
cp .env.example .env
# Set HEADED_DEBUG=true for visible browser

# 4. Setup session
npm run setup-session

# 5. Start dev server
npm run dev

# Server runs on http://localhost:3000
```

## Post-Deployment

### Integrate with n8n

Update your n8n HeyGen nodes to use new endpoint:

**Old:**
```
https://heygen-api.dbtaiyta.cfd/api/generate
```

**New:**
```
https://heygen-v2.dbtaiyta.cfd/api/generate
```

Request format identical - no changes needed!

### Monitor Health

```bash
# Check health
curl https://heygen-v2.dbtaiyta.cfd/api/health

# Check session status
curl https://heygen-v2.dbtaiyta.cfd/api/session/status

# List recent jobs
curl https://heygen-v2.dbtaiyta.cfd/api/jobs?limit=10
```

### Session Maintenance

If session expires (after 7-30 days), run setup again:

```bash
docker exec -it heygen-wrapper npm run setup-session
```

### Scaling

To run 2 videos concurrently:

1. Update environment variable: `MAX_CONCURRENT_JOBS=2`
2. Ensure server has enough resources (4 CPU cores, 8GB RAM recommended)
3. Restart service

## Troubleshooting

### Session keeps expiring
- Ensure "Remember me" checked during login
- Check Chrome profile volume is persistent: `docker volume ls`
- Session typically lasts 7-30 days

### "Target closed" errors
- Check `shm_size: 2gb` in docker-compose.yml
- Increase container memory limit
- Check `ipc: host` is set

### Videos not completing
- Check logs: `docker-compose logs -f heygen-wrapper`
- Increase timeout if needed
- Check HeyGen account isn't rate-limited

### Avatar not found
- Avatar name must match exactly (case-sensitive)
- Check available avatars at https://app.heygen.com
- Use `avatar_index` if multiple avatars share name

## Backup & Restore

### Backup Chrome Profile (session)
```bash
tar -czf chrome-profile-backup.tar.gz data/chrome-profile/
```

### Restore Chrome Profile
```bash
tar -xzf chrome-profile-backup.tar.gz -C data/
docker-compose restart heygen-wrapper
```

### Backup Job Database
```bash
cp data/db.json db-backup-$(date +%Y%m%d).json
```
