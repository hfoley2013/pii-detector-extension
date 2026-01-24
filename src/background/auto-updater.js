/**
 * Auto-Updater for Development/Private Distribution
 *
 * This checks a remote URL for new versions and notifies the user
 * when an update is available. For unpacked extensions, the user
 * needs to manually reload, but this makes them aware.
 *
 * For production, use the Chrome Web Store instead.
 */

const AUTO_UPDATE_CONFIG = {
  // GitHub raw URL to your manifest.json (or a version.json file)
  versionCheckUrl: 'https://raw.githubusercontent.com/YOUR_USERNAME/PiiDetector/main/manifest.json',

  // How often to check for updates (in milliseconds)
  checkInterval: 30 * 60 * 1000, // 30 minutes

  // Enable/disable auto-update checking
  enabled: false  // Set to true and update the URL above to enable
};

class ExtensionAutoUpdater {
  constructor() {
    this.currentVersion = chrome.runtime.getManifest().version;
    this.lastCheck = null;
  }

  async checkForUpdates() {
    if (!AUTO_UPDATE_CONFIG.enabled) {
      return { updateAvailable: false, reason: 'Auto-update disabled' };
    }

    try {
      const response = await fetch(AUTO_UPDATE_CONFIG.versionCheckUrl, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const remoteManifest = await response.json();
      const remoteVersion = remoteManifest.version;

      this.lastCheck = new Date().toISOString();

      if (this.isNewerVersion(remoteVersion, this.currentVersion)) {
        console.log(`🔄 Update available: ${this.currentVersion} → ${remoteVersion}`);

        // Show notification to user
        this.showUpdateNotification(remoteVersion);

        return {
          updateAvailable: true,
          currentVersion: this.currentVersion,
          newVersion: remoteVersion
        };
      }

      console.log(`✅ Extension is up to date (v${this.currentVersion})`);
      return { updateAvailable: false, currentVersion: this.currentVersion };

    } catch (error) {
      console.warn('⚠️ Update check failed:', error.message);
      return { updateAvailable: false, error: error.message };
    }
  }

  isNewerVersion(remote, current) {
    const remoteParts = remote.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
      const r = remoteParts[i] || 0;
      const c = currentParts[i] || 0;

      if (r > c) return true;
      if (r < c) return false;
    }

    return false;
  }

  showUpdateNotification(newVersion) {
    // Check if we have notification permission
    chrome.notifications.create('pii-update-available', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
      title: 'PII Detector Update Available',
      message: `Version ${newVersion} is available. Click to update.`,
      priority: 1
    });
  }

  startPeriodicChecks() {
    if (!AUTO_UPDATE_CONFIG.enabled) return;

    // Check immediately on startup
    this.checkForUpdates();

    // Then check periodically
    setInterval(() => {
      this.checkForUpdates();
    }, AUTO_UPDATE_CONFIG.checkInterval);

    console.log('🔄 Auto-update checker started');
  }
}

// Export for use in background script
if (typeof window !== 'undefined') {
  window.ExtensionAutoUpdater = ExtensionAutoUpdater;
}

// Auto-start if in service worker context
if (typeof self !== 'undefined' && self.registration) {
  const updater = new ExtensionAutoUpdater();
  updater.startPeriodicChecks();
}
