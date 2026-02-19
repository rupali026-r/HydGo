// Run this script to get your Google OAuth redirect URI
// Usage: node scripts/get-redirect-uri.js

const appJson = require('../app.json');

const scheme = appJson.expo.scheme;
const slug = appJson.expo.slug;

console.log('\n🔐 Google OAuth Configuration\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📱 For Development Builds & Production:');
console.log(`   ${scheme}:/\n`);

console.log('🧪 For Expo Go (Development):');
console.log(`   https://auth.expo.io/@YOUR_EXPO_USERNAME/${slug}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📋 Steps to configure Google Cloud Console:\n');
console.log('1. Go to https://console.cloud.google.com/');
console.log('2. Navigate to: APIs & Services → Credentials');
console.log('3. Find your Web OAuth 2.0 Client');
console.log('4. Add to "Authorized redirect URIs":\n');
console.log(`   • ${scheme}:/`);
console.log(`   • https://auth.expo.io/@YOUR_EXPO_USERNAME/${slug}`);
console.log('\n   Replace YOUR_EXPO_USERNAME with your actual Expo username');
console.log('   (Find it at: https://expo.dev/accounts/[username])\n');
console.log('5. Click Save\n');
