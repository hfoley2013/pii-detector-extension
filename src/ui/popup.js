class PopupUI {
  constructor() {
    this.currentTab = null;
    this.refreshInterval = null;
    this.isExtensionActive = true;
    
    this.elements = {
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      piiCount: document.getElementById('piiCount'),
      tokenCount: document.getElementById('tokenCount'),
      sessionDuration: document.getElementById('sessionDuration'),
      piiTypesSection: document.getElementById('piiTypesSection'),
      piiTypesList: document.getElementById('piiTypesList'),
      toggleButton: document.getElementById('toggleButton'),
      toggleText: document.getElementById('toggleText'),
      clearButton: document.getElementById('clearButton'),
      detailedStatus: document.getElementById('detailedStatus'),
      currentSite: document.getElementById('currentSite')
    };

    this.initialize();
  }

  async initialize() {
    try {
      await this.getCurrentTab();
      await this.loadExtensionStatus();
      this.setupEventListeners();
      this.startAutoRefresh();
      
      console.log('Popup UI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize popup UI:', error);
      this.showError('Failed to initialize extension popup');
    }
  }

  async getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        this.currentTab = tabs[0];
        if (this.currentTab) {
          this.updateSiteInfo(this.currentTab.url);
        }
        resolve(this.currentTab);
      });
    });
  }

  updateSiteInfo(url) {
    try {
      const hostname = new URL(url).hostname;
      this.elements.currentSite.textContent = hostname;
      
      if (!hostname.includes('chatgpt.com')) {
        this.showUnsupportedSite();
      }
    } catch (error) {
      this.elements.currentSite.textContent = 'Unknown';
    }
  }

  showUnsupportedSite() {
    this.updateStatus('inactive', 'Unsupported Site');
    this.elements.detailedStatus.textContent = 'Extension only works on chatgpt.com';
    this.elements.toggleButton.disabled = true;
    this.elements.clearButton.disabled = true;
  }

  async loadExtensionStatus() {
    try {
      const response = await this.sendMessage({
        action: 'getExtensionStatus'
      });

      if (response && response.isActive) {
        this.updateUIWithStatus(response);
      } else {
        this.updateStatus('inactive', 'Inactive');
        this.elements.detailedStatus.textContent = 'Extension not active on this tab';
      }
    } catch (error) {
      console.error('Error loading extension status:', error);
      this.updateStatus('error', 'Error');
      this.elements.detailedStatus.textContent = 'Failed to load status';
    }
  }

  updateUIWithStatus(statusData) {
    const { stats } = statusData;
    
    if (stats) {
      this.elements.piiCount.textContent = stats.piiDetectedCount || 0;
      this.elements.tokenCount.textContent = stats.tokensReplacedCount || 0;
      
      if (stats.sessionDuration) {
        const minutes = Math.floor(stats.sessionDuration / (1000 * 60));
        this.elements.sessionDuration.textContent = `${minutes}m`;
      }

      if (stats.lastPiiTypes && stats.lastPiiTypes.length > 0) {
        this.showPiiTypes(stats.lastPiiTypes);
      } else {
        this.elements.piiTypesSection.style.display = 'none';
      }

      if (stats.piiDetectedCount > 0) {
        this.updateStatus('active', 'PII Detected');
        this.elements.detailedStatus.textContent = 'Actively protecting PII';
      } else {
        this.updateStatus('monitoring', 'Monitoring');
        this.elements.detailedStatus.textContent = 'Ready to protect PII';
      }
    } else {
      this.updateStatus('inactive', 'Inactive');
      this.elements.detailedStatus.textContent = 'Extension not initialized';
    }
  }

  showPiiTypes(piiTypes) {
    const uniqueTypes = [...new Set(piiTypes)];
    
    this.elements.piiTypesList.innerHTML = '';
    uniqueTypes.forEach(type => {
      const tag = document.createElement('span');
      tag.className = `pii-type-tag ${type}`;
      tag.textContent = type;
      this.elements.piiTypesList.appendChild(tag);
    });

    this.elements.piiTypesSection.style.display = 'block';
  }

  updateStatus(status, text) {
    this.elements.statusText.textContent = text;
    this.elements.statusDot.className = `status-dot ${status}`;

    switch (status) {
      case 'active':
        this.elements.statusDot.style.background = '#4caf50';
        break;
      case 'monitoring':
        this.elements.statusDot.style.background = '#2196f3';
        break;
      case 'error':
        this.elements.statusDot.style.background = '#f44336';
        break;
      case 'inactive':
        this.elements.statusDot.style.background = '#757575';
        break;
    }
  }

  setupEventListeners() {
    this.elements.toggleButton.addEventListener('click', () => {
      this.toggleExtension();
    });

    this.elements.clearButton.addEventListener('click', () => {
      this.clearSession();
    });
  }

  async toggleExtension() {
    try {
      this.isExtensionActive = !this.isExtensionActive;
      
      this.elements.toggleText.textContent = this.isExtensionActive ? 'Disable' : 'Enable';
      this.elements.toggleButton.className = this.isExtensionActive 
        ? 'control-button' 
        : 'control-button disabled';

      await this.sendMessage({
        action: 'toggleExtension'
      });

      this.updateStatus(
        this.isExtensionActive ? 'monitoring' : 'inactive',
        this.isExtensionActive ? 'Monitoring' : 'Disabled'
      );

    } catch (error) {
      console.error('Error toggling extension:', error);
      this.showError('Failed to toggle extension');
    }
  }

  async clearSession() {
    try {
      await this.sendMessage({
        action: 'clearTokenMappings'
      });

      this.elements.piiCount.textContent = '0';
      this.elements.tokenCount.textContent = '0';
      this.elements.sessionDuration.textContent = '0m';
      this.elements.piiTypesSection.style.display = 'none';

      this.updateStatus('monitoring', 'Session Cleared');
      this.elements.detailedStatus.textContent = 'Ready to protect PII';

    } catch (error) {
      console.error('Error clearing session:', error);
      this.showError('Failed to clear session');
    }
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.loadExtensionStatus();
    }, 2000);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  showError(message) {
    const existingError = document.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    const content = document.querySelector('.popup-content');
    content.insertBefore(errorDiv, content.firstChild);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  formatDuration(milliseconds) {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  destroy() {
    this.stopAutoRefresh();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupUI();
  
  window.addEventListener('beforeunload', () => {
    popup.destroy();
  });
});