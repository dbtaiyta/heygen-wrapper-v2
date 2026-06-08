import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

class VNCBrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private xvfbProcess: ChildProcess | null = null;
  private vncProcess: ChildProcess | null = null;
  private websockifyProcess: ChildProcess | null = null;
  private displayNumber: number = 99;
  private vncPort: number = 5999;
  private websocketPort: number = 6080;

  async startVNCBrowser(): Promise<{ url: string; websocketPort: number }> {
    try {
      logger.info('Starting VNC browser session');

      // Start Xvfb (virtual display)
      this.displayNumber = 99 + Math.floor(Math.random() * 100);
      const display = `:${this.displayNumber}`;
      
      logger.info('Starting Xvfb', { display });
      this.xvfbProcess = spawn('Xvfb', [
        display,
        '-screen', '0', '1280x720x24',
        '-ac',
        '+extension', 'RANDR'
      ]);

      // Wait for Xvfb to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start x11vnc
      this.vncPort = 5900 + this.displayNumber;
      logger.info('Starting x11vnc', { port: this.vncPort });
      
      this.vncProcess = spawn('x11vnc', [
        '-display', display,
        '-nopw',
        '-listen', '0.0.0.0',
        '-xkb',
        '-rfbport', this.vncPort.toString(),
        '-shared'
      ]);

      // Wait for VNC to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start websockify
      this.websocketPort = 6080 + Math.floor(Math.random() * 100);
      logger.info('Starting websockify', { websocketPort: this.websocketPort, vncPort: this.vncPort });
      
      this.websockifyProcess = spawn('websockify', [
        '--web', './node_modules/novnc',
        this.websocketPort.toString(),
        `localhost:${this.vncPort}`
      ]);

      // Wait for websockify to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Launch browser on the virtual display
      logger.info('Launching Chromium browser');
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ],
        env: {
          ...process.env,
          DISPLAY: display
        }
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 }
      });

      this.page = await this.context.newPage();

      // Navigate to HeyGen login
      await this.page.goto('https://app.heygen.com/login', {
        waitUntil: 'domcontentloaded'
      });

      logger.info('VNC browser started successfully', {
        websocketUrl: `ws://localhost:${this.websocketPort}`,
        vncUrl: `http://localhost:${this.websocketPort}/vnc.html`
      });

      return {
        url: `/vnc-viewer?port=${this.websocketPort}`,
        websocketPort: this.websocketPort
      };

    } catch (error) {
      logger.error('Failed to start VNC browser', { error });
      await this.cleanup();
      throw error;
    }
  }

  async saveSession(profileDir: string): Promise<boolean> {
    try {
      if (!this.context) {
        throw new Error('No active browser context');
      }

      logger.info('Saving browser session', { profileDir });
      
      const storageState = await this.context.storageState();
      
      const fs = await import('fs/promises');
      await fs.mkdir(profileDir, { recursive: true });
      await fs.writeFile(
        `${profileDir}/session.json`,
        JSON.stringify(storageState, null, 2)
      );

      logger.info('Session saved successfully');
      return true;
    } catch (error) {
      logger.error('Failed to save session', { error });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up VNC browser session');

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    if (this.websockifyProcess) {
      this.websockifyProcess.kill();
      this.websockifyProcess = null;
    }

    if (this.vncProcess) {
      this.vncProcess.kill();
      this.vncProcess = null;
    }

    if (this.xvfbProcess) {
      this.xvfbProcess.kill();
      this.xvfbProcess = null;
    }

    logger.info('VNC browser session cleaned up');
  }

  getCurrentPage(): Page | null {
    return this.page;
  }

  isActive(): boolean {
    return this.browser !== null && this.page !== null;
  }
}

export default new VNCBrowserService();
