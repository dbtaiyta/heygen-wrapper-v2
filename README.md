# HeyGen Wrapper v2

Production-grade HeyGen API wrapper with robust browser automation. Built to replace Nick's implementation with better session management and Mike Ye's improvements.

## Features

✅ **Robust Session Capture** - Playwright persistent context (no laggy noVNC)
✅ **Mike's Improvements** - Multi-avatar support, spinner bug detection, memory fixes
✅ **Job Queue** - BullMQ + Redis for async processing
✅ **API Compatible** - Drop-in replacement for Nick's wrapper
✅ **Production Ready** - Docker Compose, health checks, logging
✅ **MinIO Integration** - Auto-upload videos (optional)

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd heygen-wrapper-v2
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. First-Time Session Setup

```bash
npm run setup-session
# Browser will open - login with Google OAuth
# Session saves automatically
```

### 4. Start Server

```bash
# Development
npm run dev

# Production (Docker)
docker-compose up -d
```

## API Usage

### Generate Video

```bash
curl -X POST http://localhost:3000/api/generate \
  -F "audio=@voiceover.wav" \
  -F "avatar_name=weat4" \
  -F "avatar_index=0" \
  -F "orientation=landscape"
```

Response:
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "created_at": "2026-06-08T10:30:00Z"
}
```

### Check Job Status

```bash
curl http://localhost:3000/api/jobs/550e8400-e29b-41d4-a716-446655440000
```

Response:
```json
{
  "job_id": "550e8400-...",
  "status": "complete",
  "progress": 100,
  "download_url": "/api/downloads/550e8400-....mp4",
  "completed_at": "2026-06-08T10:38:00Z"
}
```

### Download Video

```bash
curl http://localhost:3000/api/downloads/550e8400-....mp4 -o video.mp4
```

## Deployment (Coolify)

1. Push code to git repo
2. Create Docker Resource in Coolify
3. Set environment variables (see `.env.example`)
4. Deploy
5. Run session setup:
   ```bash
   docker exec -it heygen-wrapper npm run setup-session
   ```

## Environment Variables

See `.env.example` for full list. Key variables:

- `ADMIN_PASSWORD` - Admin dashboard password
- `VIDEO_RETENTION_HOURS` - Auto-cleanup old videos (default: 24)
- `MAX_CONCURRENT_JOBS` - Concurrent video generation (default: 1, recommended: 2-4)
- `REDIS_URL` - Redis connection URL
- `MINIO_*` - MinIO configuration (optional)

## Architecture

```
n8n → Express API → BullMQ Queue → Playwright → HeyGen Web UI → Video Output
```

See `/docs/architecture.md` for details.

## Troubleshooting

### Session expired
Run `npm run setup-session` again.

### "Target closed" errors
Increase Docker memory and ensure `shm_size: 2gb` in docker-compose.yml.

### Avatar not found
Check avatar name exactly matches your HeyGen library. Use `avatar_index` if multiple avatars with same name.

## Credits

- Nick Winter - Original wrapper concept
- Mike Ye - Production improvements (multi-avatar, spinner detection, memory fixes)

## License

MIT
