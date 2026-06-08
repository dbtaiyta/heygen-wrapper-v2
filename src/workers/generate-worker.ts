import { Worker, Job as BullJob } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import logger from '../utils/logger.js';
import browserManager from '../services/browser-manager.js';
import { HeyGenAutomation } from '../services/heygen-automation.js';
import db from '../utils/db.js';
import { Job } from '../types/index.js';

const VIDEOS_DIR = process.env.VIDEOS_DIR || './videos';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface GenerateJobData {
  job_id: string;
  audio_path: string;
  avatar_name: string;
  avatar_index?: number;
  orientation?: string;
  resolution?: string;
}

export function createGenerateWorker() {
  const worker = new Worker<GenerateJobData>(
    'generate-video',
    async (job: BullJob<GenerateJobData>) => {
      const { job_id, audio_path, avatar_name, avatar_index = 0 } = job.data;

      logger.info('Starting video generation job', { job_id, avatar_name });

      try {
        // Update job status: processing
        await updateJobStatus(job_id, 'processing', 10, 'validating-session');

        // Validate session
        const sessionValid = await browserManager.validateSession();
        if (!sessionValid) {
          throw new Error('SESSION_EXPIRED: Please reconnect HeyGen account');
        }

        await updateJobStatus(job_id, 'processing', 20, 'selecting-avatar');

        // Get page and create automation instance
        const page = await browserManager.getPage();
        const automation = new HeyGenAutomation(page);

        // Select avatar
        await automation.selectAvatar(avatar_name, avatar_index);
        await updateJobStatus(job_id, 'processing', 40, 'uploading-audio');

        // Upload audio
        await automation.uploadAudio(audio_path);
        await updateJobStatus(job_id, 'processing', 60, 'generating');

        // Generate video
        await automation.generate();
        await updateJobStatus(job_id, 'processing', 70, 'rendering');

        // Wait for completion
        const videoUrl = await automation.waitForCompletion();
        await updateJobStatus(job_id, 'processing', 90, 'downloading');

        // Download video
        const outputPath = path.join(VIDEOS_DIR, `${job_id}.mp4`);
        await automation.downloadVideo(videoUrl, outputPath);

        // Update job: complete
        await completeJob(job_id, outputPath);

        logger.info('Video generation completed', { job_id });
        return { job_id, status: 'complete' };

      } catch (error: any) {
        logger.error('Video generation failed', { job_id, error: error.message });
        await failJob(job_id, error.message);
        throw error;
      }
    },
    {
      connection: { url: REDIS_URL },
      concurrency: parseInt(process.env.MAX_CONCURRENT_JOBS || '1'),
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 }
    }
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

async function updateJobStatus(job_id: string, status: Job['status'], progress: number, phase: string) {
  await db.read();
  const job = db.data.jobs.find(j => j.job_id === job_id);
  if (job) {
    job.status = status;
    job.progress = progress;
    job.phase = phase;
    job.updated_at = new Date().toISOString();
    await db.write();
  }
}

async function completeJob(job_id: string, videoPath: string) {
  await db.read();
  const job = db.data.jobs.find(j => j.job_id === job_id);
  if (job) {
    job.status = 'complete';
    job.progress = 100;
    job.download_url = `/api/downloads/${job_id}.mp4`;
    job.completed_at = new Date().toISOString();
    await db.write();
  }
}

async function failJob(job_id: string, error: string) {
  await db.read();
  const job = db.data.jobs.find(j => j.job_id === job_id);
  if (job) {
    job.status = 'failed';
    job.error = error;
    job.failed_at = new Date().toISOString();
    await db.write();
  }
}
