import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const BRAVE_PROFILE = '~/Library/Application Support/BraveSoftware/Brave-Browser/Profile 21';
const PROFILE_DIR = process.env.CHROME_PROFILE_DIR || './data/chrome-profile';
const ZIP_OUTPUT = './heygen-session.zip';

async function exportBraveSession() {
  console.log('🚀 Exporting HeyGen session from Brave\n');
  
  try {
    // Expand tilde in path
    const braveProfilePath = BRAVE_PROFILE.replace('~', process.env.HOME || '');
    
    // Check if Brave profile exists
    try {
      await fs.access(braveProfilePath);
      console.log('✓ Found Brave profile:', braveProfilePath);
    } catch (error) {
      console.error('❌ Brave profile not found:', braveProfilePath);
      console.log('\nPlease make sure:');
      console.log('  1. Brave is installed');
      console.log('  2. Profile "HEYGEN" exists (Profile 21)');
      process.exit(1);
    }

    // Create destination directory
    await fs.mkdir(PROFILE_DIR, { recursive: true });
    console.log('✓ Created destination directory:', PROFILE_DIR);

    // Copy Brave profile to wrapper profile directory
    console.log('\n📋 Copying Brave profile...');
    await execAsync(`rsync -a --delete "${braveProfilePath}/" "${PROFILE_DIR}/"`);
    console.log('✓ Profile copied successfully');

    // Create ZIP file
    console.log('\n📦 Creating ZIP file...');
    const profileDirName = path.basename(PROFILE_DIR);
    const profileParent = path.dirname(PROFILE_DIR);
    
    await execAsync(`cd "${profileParent}" && zip -r "${path.resolve(ZIP_OUTPUT)}" "${profileDirName}" -x "*.log" -x "*Cache*" -x "*cache*"`);
    console.log('✓ ZIP file created:', path.resolve(ZIP_OUTPUT));

    // Get file size
    const stats = await fs.stat(ZIP_OUTPUT);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log('\n✅ Session exported successfully!');
    console.log(`   File: ${path.resolve(ZIP_OUTPUT)}`);
    console.log(`   Size: ${sizeMB} MB`);
    
    console.log('\n📤 Next steps:');
    console.log('   1. Go to your dashboard: https://heygen-v2.dbtaiyta.cfd/settings/connection');
    console.log('   2. Upload heygen-session.zip');
    console.log('   3. Start generating videos!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\nPlease check:');
    console.log('  - Brave is closed (or profile is not in use)');
    console.log('  - You have read/write permissions');
    process.exit(1);
  }
}

exportBraveSession().catch(console.error);
