import { chromium } from 'playwright';
import path from 'path';

const PROFILE_DIR = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';

async function setupSession() {
  console.log('🚀 HeyGen Session Setup\n');
  console.log('This will open a browser window for you to login to HeyGen.');
  console.log('After successful login, the session will be saved for future use.\n');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });

  const page = context.pages()[0] || await context.newPage();
  
  console.log('📖 Opening HeyGen login page...\n');
  await page.goto('https://app.heygen.com/login');

  console.log('⏳ Please login manually in the browser window...');
  console.log('   - Use Google OAuth for best results');
  console.log('   - Check "Remember me" if available');
  console.log('   - Wait until you see the HeyGen dashboard\n');

  // Wait for navigation to dashboard (indicates successful login)
  try {
    await page.waitForURL('**/app.heygen.com/**', { timeout: 300000 }); // 5 minutes
    
    console.log('✅ Login successful!');
    console.log('✅ Session saved to:', PROFILE_DIR);
    console.log('\nYou can now close this browser and start the wrapper.');
    
  } catch (error) {
    console.error('❌ Timeout or error during login:', error);
    console.log('\nPlease try again.');
  }

  await context.close();
}

setupSession().catch(console.error);
