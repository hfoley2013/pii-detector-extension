#!/usr/bin/env node
/**
 * Cross-platform file watcher for Chrome extension development
 *
 * Usage:
 *   node scripts/watch.js
 *
 * This watches for file changes and outputs instructions to reload.
 * For automatic reloading, use the Extensions Reloader Chrome extension
 * or the macOS-specific watch.sh script.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Files/directories to watch
const watchPaths = [
  'src',
  'manifest.json'
];

// Files to ignore
const ignorePatterns = [
  /node_modules/,
  /\.git/,
  /\.DS_Store/,
  /scripts/
];

function shouldIgnore(filePath) {
  return ignorePatterns.some(pattern => pattern.test(filePath));
}

function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

const handleChange = debounce((eventType, filename) => {
  if (shouldIgnore(filename || '')) return;

  console.log(`\n📝 [${formatTime()}] ${eventType}: ${filename}`);
  console.log('🔄 Reload the extension in Chrome:');
  console.log('   1. Go to chrome://extensions/');
  console.log('   2. Click the refresh icon on "PII Tokenization Extension"');
  console.log('   Or use keyboard shortcut if you set one up.\n');
}, 300);

console.log(`
🔄 PII Detector Extension Watcher
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Watching for changes in:
  • src/**/*
  • manifest.json

💡 Tip: Install "Extensions Reloader" from Chrome Web Store
   for one-click reloading, or set up a keyboard shortcut.

Press Ctrl+C to stop.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Set up watchers
watchPaths.forEach(watchPath => {
  const fullPath = path.join(ROOT_DIR, watchPath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ Path not found: ${watchPath}`);
    return;
  }

  try {
    fs.watch(fullPath, { recursive: true }, handleChange);
    console.log(`👁️ Watching: ${watchPath}`);
  } catch (err) {
    console.error(`❌ Error watching ${watchPath}:`, err.message);
  }
});

console.log('\n✅ Watcher started. Waiting for changes...\n');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n👋 Watcher stopped.');
  process.exit(0);
});
