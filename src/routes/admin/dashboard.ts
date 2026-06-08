import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.render('dashboard', { 
    title: 'Dashboard - HeyGen Wrapper v2',
    activePage: 'dashboard' 
  });
});

export default router;
