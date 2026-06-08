import { chromium, Browser, BrowserContext, Page } from 'playwright';
import logger from '../utils/logger.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  cdpUrl: string;
  sessionId: string;
}

class BrowserViewerService {
  private sessions: Map<string, BrowserSession> = new Map();
  private wss: WebSocketServer | null = null;

  async initialize() {
    // WebSocket server for streaming browser screenshots
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      const sessionId = new URL(req.url!, 'http://localhost').searchParams.get('session');
      if (!sessionId) {
        ws.close();
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        ws.close();
        return;
      }

      logger.info('WebSocket client connected', { sessionId });

      // Stream screenshots
      const streamInterval = setInterval(async () => {
        try {
          if (!session.page) {
            clearInterval(streamInterval);
            return;
          }

          const screenshot = await session.page.screenshot({ 
            type: 'jpeg',
            quality: 80
          });
          
          if (ws.readyState === ws.OPEN) {
            ws.send(screenshot);
          }
        } catch (error) {
          clearInterval(streamInterval);
        }
      }, 100); // 10 FPS

      ws.on('close', () => {
        clearInterval(streamInterval);
        logger.info('WebSocket client disconnected', { sessionId });
      });

      // Handle mouse/keyboard events from client
      ws.on('message', async (data) => {
        try {
          const event = JSON.parse(data.toString());
          await this.handleUserInput(sessionId, event);
        } catch (error) {
          logger.error('Failed to handle user input', { error });
        }
      });
    });

    server.listen(6080, () => {
      logger.info('Browser viewer WebSocket server started on port 6080');
    });
  }

  async createSession(): Promise<{ sessionId: string; viewerUrl: string }> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Creating browser session', { sessionId });

      // Launch browser with CDP enabled
      const browser = await chromium.launch({
        headless: false, // Keep false so we can see it works locally
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--remote-debugging-port=0' // Random port
        ]
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      });

      const page = await context.newPage();

      // Navigate to HeyGen login
      await page.goto('https://app.heygen.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      const cdpUrl = '';

      this.sessions.set(sessionId, {
        browser,
        context,
        page,
        cdpUrl,
        sessionId
      });

      logger.info('Browser session created', { sessionId });

      return {
        sessionId,
        viewerUrl: `/browser-viewer?session=${sessionId}`
      };

    } catch (error) {
      logger.error('Failed to create browser session', { error });
      throw error;
    }
  }

  async handleUserInput(sessionId: string, event: any) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { page } = session;

    try {
      switch (event.type) {
        case 'mousemove':
          await page.mouse.move(event.x, event.y);
          break;
        case 'mousedown':
          await page.mouse.down();
          break;
        case 'mouseup':
          await page.mouse.up();
          break;
        case 'click':
          await page.mouse.click(event.x, event.y);
          break;
        case 'keydown':
          await page.keyboard.down(event.key);
          break;
        case 'keyup':
          await page.keyboard.up(event.key);
          break;
        case 'keypress':
          await page.keyboard.press(event.key);
          break;
        case 'type':
          await page.keyboard.type(event.text);
          break;
      }
    } catch (error) {
      logger.error('Failed to handle input', { error });
    }
  }

  async saveSession(sessionId: string, profileDir: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      logger.info('Saving browser session', { sessionId, profileDir });

      const storageState = await session.context.storageState();

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

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info('Closing browser session', { sessionId });

    try {
      await session.browser.close();
    } catch (error) {
      logger.error('Error closing browser', { error });
    }

    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  async cleanup() {
    logger.info('Cleaning up all browser sessions');
    
    for (const [sessionId, session] of this.sessions) {
      try {
        await session.browser.close();
      } catch (error) {
        logger.error('Error closing session', { sessionId, error });
      }
    }

    this.sessions.clear();

    if (this.wss) {
      this.wss.close();
    }
  }
}

export default new BrowserViewerService();
