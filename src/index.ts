import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import logger from './utils/logger.js';
import { initDatabase } from './utils/db.js';
import apiRouter from './routes/api.js';
import adminRouter from './routes/admin/index.js';
import { createGenerateWorker } from './workers/generate-worker.js';
import browserManager from './services/browser-manager.js';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for Alpine.js
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', apiRouter);
app.use('/', adminRouter);

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
