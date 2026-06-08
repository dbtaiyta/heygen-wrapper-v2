import express, { Request, Response } from 'express';
import multer from 'multer';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger.js';
import db from '../utils/db.js';
import browserManager from '../services/browser-manager.js';
import { Job } from '../types/index.js';

const router = express.Router();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const VIDEOS_DIR = process.env.VIDEOS_DIR || './videos';

// Setup multer for file uploads
const upload = multer({ dest: './uploads/' });

// Initialize queue
const generateQueue = new Queue('generate-video', {
  connection: { url: REDIS_URL }
});

// POST /api/generate - Generate video with audio upload
router.post('/generate', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file required' });
    }

    const { avatar_name, avatar_index = '0', title, orientation, resolution } = req.body;

    if (!avatar_name) {
      return res.status(400).json({ error: 'avatar_name required' });
    }

    const job_id = uuidv4();
    const job: Job = {
      job_id,
      status: 'queued',
      progress: 0,
      avatar_name,
      avatar_index: parseInt(avatar_index),
      orientation,
      resolution,
      created_at: new Date().toISOString()
    };

    // Save job to DB
    await db.read();
    db.data.jobs.push(job);
    await db.write();

    // Add to queue
    await generateQueue.add('generate', {
      job_id,
      audio_path: req.file.path,
      avatar_name,
      avatar_index: parseInt(avatar_index),
      orientation,
      resolution
    });

    logger.info('Job queued', { job_id, avatar_name });

    res.status(202).json({
      job_id,
      status: 'queued',
      created_at: job.created_at
    });

  } catch (error: any) {
    logger.error('Failed to create job', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs/:job_id - Get job status
router.get('/jobs/:job_id', async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;

    await db.read();
    const job = db.data.jobs.find(j => j.job_id === job_id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);

  } catch (error: any) {
    logger.error('Failed to get job', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs - List jobs (admin)
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string;
    const avatar_name = req.query.avatar_name as string;

    await db.read();
    let jobs = [...db.data.jobs];

    // Filter
    if (status) {
      jobs = jobs.filter(j => j.status === status);
    }
    if (avatar_name) {
      jobs = jobs.filter(j => j.avatar_name === avatar_name);
    }

    // Sort by created_at desc
    jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Paginate
    const total = jobs.length;
    const start = (page - 1) * limit;
    const paginatedJobs = jobs.slice(start, start + limit);

    res.json({
      jobs: paginatedJobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    logger.error('Failed to list jobs', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/downloads/:filename - Download video
router.get('/downloads/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(VIDEOS_DIR, filename);

    // Security: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    logger.error('Failed to download file', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/health - Health check (public)
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check session status
    const sessionValid = await browserManager.validateSession().catch(() => false);

    // Get queue stats
    const queueStats = await generateQueue.getJobCounts('waiting', 'active', 'completed', 'failed');

    // Get storage info
    let videosCount = 0;
    let diskUsage = 0;
    try {
      const files = await fs.readdir(VIDEOS_DIR);
      videosCount = files.length;
      for (const file of files) {
        const stats = await fs.stat(path.join(VIDEOS_DIR, file));
        diskUsage += stats.size;
      }
    } catch (err) {
      // Ignore storage errors
    }

    res.json({
      status: 'ok',
      session: sessionValid ? 'connected' : 'expired',
      queue: {
        waiting: queueStats.waiting,
        active: queueStats.active,
        completed: queueStats.completed,
        failed: queueStats.failed
      },
      storage: {
        videos_cached: videosCount,
        disk_usage_mb: Math.round(diskUsage / 1024 / 1024)
      },
      uptime_seconds: Math.floor(process.uptime())
    });

  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// GET /api/session/status - Session status
router.get('/session/status', async (req: Request, res: Response) => {
  try {
    const valid = await browserManager.validateSession();

    res.json({
      status: valid ? 'connected' : 'expired',
      last_verified: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Session status check failed', { error: error.message });
    res.json({
      status: 'unknown',
      error: error.message
    });
  }
});

export default router;
