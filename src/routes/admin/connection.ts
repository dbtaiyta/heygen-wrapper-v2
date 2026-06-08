import { Router, Request, Response } from 'express';
import browserManager from '../../services/browser-manager.js';
import { chromium } from 'playwright';
import logger from '../../utils/logger.js';

const router = Router();

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

export default router;
