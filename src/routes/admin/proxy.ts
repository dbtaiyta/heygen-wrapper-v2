import { Router, Request, Response } from 'express';
import db from '../../utils/db.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.render('proxy', { 
    title: 'Proxy Settings - HeyGen Wrapper v2',
    activePage: 'proxy' 
  });
});

router.get('/data', async (req: Request, res: Response) => {
  try {
    const data = await db.read();
    res.json({ config: data.proxyConfig || { type: 'none' } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load config' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = await db.read();
    data.proxyConfig = req.body;
    await db.write();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

router.post('/test', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    if (config.type === 'none') {
      return res.json({ success: true, message: 'No proxy configured' });
    }
    
    // Basic validation
    if (!config.host || !config.port) {
      return res.json({ success: false, message: 'Host and port required' });
    }
    
    res.json({ success: true, message: 'Proxy configuration looks good' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Test failed' });
  }
});

export default router;
