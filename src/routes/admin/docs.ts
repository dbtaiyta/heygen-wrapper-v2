import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.render('docs', { 
    title: 'API Documentation - HeyGen Wrapper v2',
    activePage: 'docs' 
  });
});

export default router;
