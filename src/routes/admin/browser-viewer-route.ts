import { Router, Request, Response } from 'express';
import browserViewer from '../../services/browser-viewer.js';
import logger from '../../utils/logger.js';

const router = Router();

// Start new browser session
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { sessionId, viewerUrl } = await browserViewer.createSession();
    res.json({
      success: true,
      sessionId,
      viewerUrl
    });
  } catch (error) {
    logger.error('Failed to start browser session', { error });
    res.status(500).json({
      error: 'Failed to start browser session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Save session
router.post('/:sessionId/save', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const profileDir = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';
    
    const success = await browserViewer.saveSession(sessionId, profileDir);
    
    if (success) {
      // Reinitialize main browser manager
      const browserManager = await import('../../services/browser-manager.js');
      await browserManager.default.close();
      await browserManager.default.initialize();
      
      res.json({
        success: true,
        message: 'Session saved successfully!'
      });
    } else {
      res.status(500).json({
        error: 'Failed to save session'
      });
    }
  } catch (error) {
    logger.error('Failed to save session', { error });
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// Close session
router.post('/:sessionId/close', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    await browserViewer.closeSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close session' });
  }
});

// Render browser viewer page
router.get('/viewer', (req: Request, res: Response) => {
  const sessionId = req.query.session as string;
  if (!sessionId) {
    return res.status(400).send('Session ID required');
  }

  res.render('browser-viewer', {
    title: 'Browser Viewer - HeyGen Wrapper v2',
    sessionId
  });
});

export default router;
