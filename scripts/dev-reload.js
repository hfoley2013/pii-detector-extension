#!/usr/bin/env node
/**
 * Development Auto-Reload Script
 *
 * Watches for file changes and signals Chrome to reload the extension.
 *
 * Usage:
 *   node scripts/dev-reload.js
 *
 * Requirements:
 *   npm install chokidar ws
 */

const fs = require('fs');
const path = require('path');

// Check for required dependencies
try {
  require.resolve('chokidar');
  require.resolve('ws');
} catch (e) {
  console.log('📦 Installing required dependencies...');
  require('child_process').execSync('npm install chokidar ws --save-dev', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
}

const chokidar = require('chokidar');
const { WebSocketServer } = require('ws');

const ROOT_DIR = path.join(__dirname, '..');
const PORT = 8976;

// Start WebSocket server for communicating with the extension
const wss = new WebSocketServer({ port: PORT });

let connectedClients = [];

wss.on('connection', (ws) => {
  console.log('🔌 Extension connected to dev server');
  connectedClients.push(ws);

  ws.on('close', () => {
    connectedClients = connectedClients.filter(client => client !== ws);
    console.log('🔌 Extension disconnected');
  });
});

// Notify all connected extensions to reload
function notifyReload(changedFile) {
  const message = JSON.stringify({
    type: 'reload',
    file: changedFile,
    timestamp: Date.now()
  });

  connectedClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Watch for file changes
const watcher = chokidar.watch([
  'src/**/*.js',
  'manifest.json',
  'assets/**/*'
], {
  cwd: ROOT_DIR,
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/scripts/**'
  ],
  persistent: true,
  ignoreInitial: true
});

watcher
  .on('change', (filePath) => {
    console.log(`📝 Changed: ${filePath}`);
    notifyReload(filePath);
  })
  .on('add', (filePath) => {
    console.log(`➕ Added: ${filePath}`);
    notifyReload(filePath);
  })
  .on('unlink', (filePath) => {
    console.log(`➖ Removed: ${filePath}`);
    notifyReload(filePath);
  });

console.log(`
🔄 PII Detector Dev Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WebSocket server running on ws://localhost:${PORT}

Watching for changes in:
  • src/**/*.js
  • manifest.json
  • assets/**/*

To enable auto-reload, the extension needs the dev-reload
content script (already added to your extension).

Press Ctrl+C to stop.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
