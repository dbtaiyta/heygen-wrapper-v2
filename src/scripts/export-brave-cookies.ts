import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BRAVE_PROFILE = '~/Library/Application Support/BraveSoftware/Brave-Browser/Profile 21';
const PROFILE_DIR = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';
const ZIP_OUTPUT = './heygen-session.zip';

async function exportBraveCookies() {
  console.log('🚀 Converting Brave session to Playwright format\n');

  try {
    const braveProfilePath = BRAVE_PROFILE.replace('~', process.env.HOME || '');

    // Check if Brave profile exists
    await fs.access(braveProfilePath);
    console.log('✓ Found Brave profile:', braveProfilePath);

    // Launch Playwright with Brave profile to convert it
    console.log('\n📋 Converting session format...');
    console.log('⏳ This will open a browser window briefly...\n');

    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox'
      ]
    });

    // Navigate to HeyGen to verify session
    const page = context.pages()[0] || await context.newPage();
    console.log('🔍 Checking HeyGen session...');
    
    await page.goto('https://app.heygen.com/videos', { 
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // Wait a bit for any redirects
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    
    if (currentUrl.includes('/login')) {
      console.log('\n❌ Session is not valid - redirected to login page');
      console.log('   Please login to HeyGen in Brave first!');
      await context.close();
      process.exit(1);
    }

    console.log('✓ Session is valid!');
    console.log('✓ Playwright profile created at:', PROFILE_DIR);

    await context.close();

    // Create ZIP file
    console.log('\n📦 Creating ZIP file...');
    const profileDirName = path.basename(PROFILE_DIR);
    const profileParent = path.dirname(PROFILE_DIR);

    await execAsync(`cd "${profileParent}" && zip -r "${path.resolve(ZIP_OUTPUT)}" "${profileDirName}" -x "*.log" -x "*Cache*" -x "*cache*"`);

    const stats = await fs.stat(ZIP_OUTPUT);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('✓ ZIP file created:', path.resolve(ZIP_OUTPUT));
    console.log('✓ Size:', sizeMB, 'MB');

    console.log('\n✅ Session exported successfully!');
    console.log('\n📤 Next steps:');
    console.log('   1. Go to: https://heygen-v2.dbtaiyta.cfd/settings/connection');
    console.log('   2. Upload heygen-session.zip');
    console.log('   3. Start generating videos!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

exportBraveCookies().catch(console.error);
