import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import logger from './utils/logger.js';
import { initDatabase } from './utils/db.js';
import apiRouter from './routes/api.js';
import { createGenerateWorker } from './workers/generate-worker.js';
import browserManager from './services/browser-manager.js';

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRouter);

// Simple admin page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>HeyGen Wrapper v2</title>
      <style>
        body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .ok { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>HeyGen Wrapper v2</h1>
      <p>API is running. Check <a href="/api/health">/api/health</a> for status.</p>
      <h2>Quick Links</h2>
      <ul>
        <li><a href="/api/health">Health Check</a></li>
        <li><a href="/api/session/status">Session Status</a></li>
        <li><a href="/api/jobs">Job History</a></li>
      </ul>
      <h2>API Endpoints</h2>
      <pre>
POST /api/generate          - Generate video (multipart: audio, avatar_name, ...)
GET  /api/jobs/:job_id      - Get job status
GET  /api/jobs              - List jobs
GET  /api/downloads/:file   - Download video
GET  /api/health            - Health check
GET  /api/session/status    - Session status
      </pre>
    </body>
    </html>
  `);
});

async function bootstrap() {
  try {
    logger.info('Starting HeyGen Wrapper v2...');

    // Create required directories
    const dirs = [
      process.env.DATA_DIR || './data',
      process.env.VIDEOS_DIR || './videos',
      process.env.CHROME_PROFILE_DIR || './data/chrome-profile',
      './uploads'
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }

    // Initialize database
    await initDatabase();
    logger.info('Database initialized');

    // Initialize browser manager
    await browserManager.initialize();
    logger.info('Browser manager initialized');

    // Create worker
    const worker = createGenerateWorker();
    logger.info('Worker created', { 
      concurrency: process.env.MAX_CONCURRENT_JOBS || 1 
    });

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
      logger.info(`Visit http://localhost:${PORT} for info`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await worker.close();
      await browserManager.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Bootstrap failed', { error });
    process.exit(1);
  }
}

bootstrap();
