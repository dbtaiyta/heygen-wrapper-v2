import { Router } from 'express';
import dashboardRouter from './dashboard.js';
import apiKeysRouter from './api-keys.js';
import connectionRouter from './connection.js';
import proxyRouter from './proxy.js';
import docsRouter from './docs.js';
import browserViewerRouter from './browser-viewer-route.js';

const router = Router();

// Mount all admin routes
router.use('/', dashboardRouter);
router.use('/api-keys', apiKeysRouter);
router.use('/settings/connection', connectionRouter);
router.use('/settings/proxy', proxyRouter);
router.use('/docs', docsRouter);

// Admin API routes
router.use('/admin/api-keys', apiKeysRouter);
router.use('/admin/session', connectionRouter);
router.use('/admin/proxy', proxyRouter);
router.use('/admin/browser', browserViewerRouter);

// Browser viewer page
router.use('/browser-viewer', browserViewerRouter);

export default router;
