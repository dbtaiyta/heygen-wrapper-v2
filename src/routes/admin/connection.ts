import { Router, Request, Response } from 'express';
import multer from 'multer';
import browserManager from '../../services/browser-manager.js';
import { chromium } from 'playwright';
import logger from '../../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const router = Router();

// Setup multer for ZIP file uploads
const upload = multer({
  dest: './uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Render connection page
router.get('/', (req: Request, res: Response) => {
  res.render('connection', { 
    title: 'Connection - HeyGen Wrapper v2',
    activePage: 'connection' 
  });
});

// Start browser session for login
router.post('/start', async (req: Request, res: Response) => {
  try {
    logger.info('Starting browser session for HeyGen login');
    
    // Launch browser in NON-headless mode so user can see and interact
    const browser = await chromium.launch({ 
      headless: false,
      args: ['--start-maximized']
    });
    
    const context = await browser.newContext({
      viewport: null
    });
    
    const page = await context.newPage();
    
    // Navigate to HeyGen login
    await page.goto('https://auth.heygen.com/login', { 
      waitUntil: 'networkidle' 
    });
    
    // Store browser instance for later session save
    (global as any).__loginBrowser = browser;
    (global as any).__loginContext = context;
    
    logger.info('Browser opened for login');
    
    res.json({ 
      success: true,
      message: 'Browser opened. Please login with Google and click Save Session when done.' 
    });
  } catch (error) {
    logger.error('Failed to start login browser', { error });
    res.status(500).json({ 
      error: 'Failed to open browser. Make sure you have display access.' 
    });
  }
});

// Save session after user logs in
router.post('/save', async (req: Request, res: Response) => {
  try {
    const browser = (global as any).__loginBrowser;
    const context = (global as any).__loginContext;
    
    if (!browser || !context) {
      return res.status(400).json({ error: 'No active login session' });
    }
    
    logger.info('Saving browser session');
    
    // Get cookies and storage state
    const storageState = await context.storageState();
    
    // Save to browser manager
    const profileDir = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';
    const fs = await import('fs/promises');
    await fs.mkdir(profileDir, { recursive: true });
    await fs.writeFile(
      `${profileDir}/session.json`, 
      JSON.stringify(storageState, null, 2)
    );
    
    // Close the login browser
    await browser.close();
    (global as any).__loginBrowser = null;
    (global as any).__loginContext = null;
    
    // Reinitialize browser manager with new session
    await browserManager.close();
    await browserManager.initialize();
    
    logger.info('Session saved successfully');
    
    res.json({ 
      success: true,
      message: 'Session saved! You can now generate videos.' 
    });
  } catch (error) {
    logger.error('Failed to save session', { error });
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// Clear session
router.post('/clear', async (req: Request, res: Response) => {
  try {
    const profileDir = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';
    const fs = await import('fs/promises');

    try {
      await fs.unlink(`${profileDir}/session.json`);
    } catch (e) {
      // File might not exist
    }

    await browserManager.close();
    await browserManager.initialize();

    res.json({ success: true, message: 'Session cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

// Upload session ZIP file
router.post('/upload', upload.single('session'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const zipPath = req.file.path;
    const profileDir = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';

    logger.info('Processing uploaded session ZIP', { zipPath, profileDir });

    // Create temp extraction directory
    const tempDir = `${profileDir}_temp_${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Extract ZIP file
      await execAsync(`unzip -o "${zipPath}" -d "${tempDir}"`);
      logger.info('ZIP extracted successfully');

      // Backup old profile if exists
      try {
        const backupDir = `${profileDir}_backup_${Date.now()}`;
        await fs.rename(profileDir, backupDir);
        logger.info('Old profile backed up', { backupDir });
      } catch (e) {
        // No existing profile, that's ok
      }

      // Move extracted content to profile directory
      await fs.rename(tempDir, profileDir);
      logger.info('New session installed');

      // Clean up
      await fs.unlink(zipPath);

      // Reinitialize browser with new session
      await browserManager.close();
      await browserManager.initialize();

      // Validate session
      const isValid = await browserManager.validateSession();

      res.json({
        success: true,
        message: 'Session uploaded and installed successfully!',
        sessionValid: isValid
      });
    } catch (error) {
      // Clean up temp directory on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (e) {}
      throw error;
    }
  } catch (error) {
    logger.error('Failed to upload session', { error });

    // Clean up uploaded file
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({
      error: 'Failed to upload session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download session as ZIP (for backup)
router.get('/download', async (req: Request, res: Response) => {
  try {
    const profileDir = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';
    const zipPath = `/tmp/heygen-session-${Date.now()}.zip`;

    // Create ZIP of profile directory
    await execAsync(`cd "${path.dirname(profileDir)}" && zip -r "${zipPath}" "${path.basename(profileDir)}"`);

    res.download(zipPath, 'heygen-session.zip', async (err) => {
      // Clean up temp file after download
      try {
        await fs.unlink(zipPath);
      } catch (e) {}

      if (err) {
        logger.error('Failed to send ZIP file', { error: err });
      }
    });
  } catch (error) {
    logger.error('Failed to create session ZIP', { error });
    res.status(500).json({ error: 'Failed to download session' });
  }
});

export default router;
