import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import db from '../../utils/db.js';

const router = Router();

// Render API keys page
router.get('/', (req: Request, res: Response) => {
  res.render('api-keys', { 
    title: 'API Keys - HeyGen Wrapper v2',
    activePage: 'api-keys' 
  });
});

// Get all API keys (masked)
router.get('/data', async (req: Request, res: Response) => {
  try {
    const data = await db.read();
    const keys = (data.apiKeys || []).map((k: any) => ({
      id: k.id,
      name: k.name,
      masked_key: k.key.substring(0, 8) + '...' + k.key.substring(k.key.length - 4),
      key: k.key, // Full key for copy
      created_at: k.created_at,
      last_used: k.last_used
    }));
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

// Create new API key
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const key = 'hgw_' + randomBytes(32).toString('hex');
    const hashedKey = await bcrypt.hash(key, 10);

    const data = await db.read();
    if (!data.apiKeys) data.apiKeys = [];
    
    data.apiKeys.push({
      id: randomBytes(8).toString('hex'),
      name,
      key: hashedKey,
      created_at: new Date().toISOString(),
      last_used: null
    });

    await db.write();

    // Return unhashed key only once
    res.json({ key, message: 'API key created' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create key' });
  }
});

// Delete API key
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const data = await db.read();
    data.apiKeys = (data.apiKeys || []).filter((k: any) => k.id !== req.params.id);
    await db.write();
    res.json({ message: 'Key deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete key' });
  }
});

export default router;
