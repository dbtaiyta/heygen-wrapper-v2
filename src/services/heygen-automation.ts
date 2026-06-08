import { Page } from 'playwright';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class HeyGenAutomation {
  constructor(private page: Page) {}

  async selectAvatar(avatarName: string, avatarIndex: number = 0): Promise<void> {
    logger.info('Selecting avatar', { avatarName, avatarIndex });

    try {
      // Navigate to video creation page
      await this.page.goto('https://app.heygen.com/create/video', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await this.page.waitForTimeout(2000);

      // Click "My Avatars" tab (Mike's improvement)
      const myAvatarsTab = this.page.locator('button:has-text("My Avatars"), [role="tab"]:has-text("My Avatars")').first();
      if (await myAvatarsTab.isVisible({ timeout: 5000 })) {
        await myAvatarsTab.click();
        await this.page.waitForTimeout(1000);
        logger.info('Switched to My Avatars tab');
      }

      // Search for avatar by name
      const searchInput = this.page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill(avatarName);
        await this.page.waitForTimeout(1500);
        logger.info('Searched for avatar', { avatarName });
      }

      // Find avatar tile - try multiple selectors
      const avatarSelectors = [
        `.avatar-card:has-text("${avatarName}")`,
        `[data-avatar-name="${avatarName}"]`,
        `.avatar-item:has-text("${avatarName}")`,
        `div:has-text("${avatarName}")[role="button"]`
      ];

      let clicked = false;
      for (const selector of avatarSelectors) {
        try {
          const avatars = this.page.locator(selector);
          const count = await avatars.count();
          if (count > avatarIndex) {
            await avatars.nth(avatarIndex).click({ timeout: 5000 });
            clicked = true;
            logger.info('Avatar selected', { selector, index: avatarIndex });
            break;
          }
        } catch (err) {
          // Try next selector
        }
      }

      if (!clicked) {
        // Fallback: click any visible avatar-like element
        const fallback = this.page.locator('.avatar-card, .avatar-item, [class*="avatar"]').first();
        if (await fallback.isVisible({ timeout: 3000 })) {
          await fallback.click();
          logger.warn('Used fallback avatar selector');
        } else {
          throw new Error(`Avatar not found: ${avatarName}`);
        }
      }

      await this.page.waitForTimeout(1000);
      
      // Verify selection closed the picker (Mike's improvement)
      const pickerClosed = await this.page.locator('.avatar-picker-modal, [role="dialog"]').isVisible({ timeout: 2000 }).catch(() => false);
      if (pickerClosed) {
        logger.warn('Avatar picker still visible after selection');
      }

    } catch (error) {
      logger.error('Failed to select avatar', { error, avatarName });
      throw error;
    }
  }

  async uploadAudio(audioPath: string): Promise<void> {
    logger.info('Uploading audio', { audioPath });

    try {
      // Find audio upload input
      const fileInput = this.page.locator('input[type="file"][accept*="audio"]').first();
      
      if (!await fileInput.isVisible({ timeout: 5000 })) {
        // Click upload button to reveal input
        const uploadBtn = this.page.locator('button:has-text("Upload"), button:has-text("Audio")').first();
        if (await uploadBtn.isVisible({ timeout: 3000 })) {
          await uploadBtn.click();
          await this.page.waitForTimeout(500);
        }
      }

      await fileInput.setInputFiles(audioPath);
      logger.info('Audio file selected');

      // Wait for upload to complete
      await this.page.waitForTimeout(2000);

      // Check for upload progress or completion
      const uploadComplete = await this.page.locator('.upload-complete, .audio-preview, audio[src]').first().isVisible({ timeout: 30000 }).catch(() => false);
      
      if (!uploadComplete) {
        logger.warn('Audio upload verification uncertain');
      } else {
        logger.info('Audio upload completed');
      }

    } catch (error) {
      logger.error('Failed to upload audio', { error, audioPath });
      throw error;
    }
  }

  async generate(): Promise<void> {
    logger.info('Clicking generate button');

    try {
      const generateBtn = this.page.locator('button:has-text("Generate"), button:has-text("Create")').first();
      await generateBtn.click({ timeout: 10000 });
      
      await this.page.waitForTimeout(2000);
      logger.info('Generate button clicked');

    } catch (error) {
      logger.error('Failed to click generate', { error });
      throw error;
    }
  }

  async waitForCompletion(timeout: number = 600000): Promise<string> {
    logger.info('Waiting for video completion', { timeoutMs: timeout });

    const startTime = Date.now();
    let lastPhase = '';

    while (Date.now() - startTime < timeout) {
      try {
        // Navigate to videos list
        await this.page.goto('https://app.heygen.com/videos', { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });

        await this.page.waitForTimeout(2000);

        // Check for latest video status
        const videoCard = this.page.locator('.video-card, [data-testid="video-card"]').first();
        
        if (await videoCard.isVisible({ timeout: 5000 })) {
          // Check for processing/generating status
          const processing = await this.page.locator('text=/processing|generating|rendering/i').first().isVisible({ timeout: 2000 }).catch(() => false);
          
          if (processing) {
            const phase = await this.page.locator('text=/processing|generating|rendering/i').first().textContent().catch(() => 'processing');
            if (phase !== lastPhase) {
              logger.info('Video generation phase', { phase });
              lastPhase = phase || '';
            }
            await this.page.waitForTimeout(10000); // Check every 10s
            continue;
          }

          // Check for spinner bug (Mike's improvement)
          const videoElement = this.page.locator('video[src*="loading_behavior.webm"]').first();
          const hasSpinner = await videoElement.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (hasSpinner) {
            logger.warn('Detected spinner bug - still processing');
            await this.page.waitForTimeout(10000);
            continue;
          }

          // Check if video is ready (has download button or video element with real source)
          const ready = await this.page.locator('button:has-text("Download"), video[src]:not([src*="loading"])').first().isVisible({ timeout: 3000 }).catch(() => false);
          
          if (ready) {
            logger.info('Video generation complete');
            
            // Get download URL
            const downloadBtn = this.page.locator('button:has-text("Download"), a[download]').first();
            if (await downloadBtn.isVisible({ timeout: 3000 })) {
              const downloadUrl = await downloadBtn.getAttribute('href') || await this.extractVideoUrl();
              return downloadUrl;
            }

            return await this.extractVideoUrl();
          }
        }

        await this.page.waitForTimeout(10000);

      } catch (error) {
        logger.warn('Error checking completion status', { error });
        await this.page.waitForTimeout(5000);
      }
    }

    throw new Error('Video generation timeout');
  }

  private async extractVideoUrl(): Promise<string> {
    // Try to extract video URL from page
    const videoSrc = await this.page.locator('video[src]').first().getAttribute('src').catch(() => null);
    if (videoSrc && !videoSrc.includes('loading')) {
      return videoSrc;
    }

    // Try to find download link
    const downloadLink = await this.page.locator('a[href*=".mp4"]').first().getAttribute('href').catch(() => null);
    if (downloadLink) {
      return downloadLink;
    }

    throw new Error('Could not extract video URL');
  }

  async downloadVideo(videoUrl: string, outputPath: string): Promise<void> {
    logger.info('Downloading video', { videoUrl, outputPath });

    try {
      // Navigate to video URL or use CDP to download
      const response = await this.page.goto(videoUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });

      if (!response) {
        throw new Error('No response from video URL');
      }

      const buffer = await response.body();
      await fs.writeFile(outputPath, buffer);

      const stats = await fs.stat(outputPath);
      logger.info('Video downloaded', { 
        outputPath, 
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2)
      });

    } catch (error) {
      logger.error('Failed to download video', { error, videoUrl });
      throw error;
    }
  }
}
