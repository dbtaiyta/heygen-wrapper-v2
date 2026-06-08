import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import logger from '../utils/logger.js';

class BrowserManager {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private profileDir: string;
  private headless: boolean;

  constructor() {
    this.profileDir = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';
    this.headless = process.env.HEADED_DEBUG !== 'true';
  }

  async initialize() {
    logger.info('Initializing browser manager', { 
      profileDir: this.profileDir, 
      headless: this.headless 
    });

    try {
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        headless: this.headless,
        viewport: { width: 1280, height: 720 },
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });

      this.page = this.context.pages()[0] || await this.context.newPage();
      
      logger.info('Browser initialized successfully');
      return this.page;
    } catch (error) {
      logger.error('Failed to initialize browser', { error });
      throw error;
    }
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.initialize();
    }
    return this.page!;
  }

  async validateSession(): Promise<boolean> {
    try {
      const page = await this.getPage();
      await page.goto('https://app.heygen.com/videos', { 
        timeout: 10000,
        waitUntil: 'domcontentloaded'
      });

      // If redirected to login, session expired
      if (page.url().includes('/login')) {
        logger.warn('Session expired - redirected to login');
        return false;
      }

      // Check for logged-in indicators
      const loggedIn = await page.locator('button[aria-label*="user"], [data-testid="user-menu"], .user-avatar').first().isVisible({ timeout: 5000 }).catch(() => false);
      
      logger.info('Session validation result', { loggedIn, currentUrl: page.url() });
      return loggedIn;
    } catch (error) {
      logger.error('Session validation failed', { error });
      return false;
    }
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
      logger.info('Browser closed');
    }
  }
}

export default new BrowserManager();
