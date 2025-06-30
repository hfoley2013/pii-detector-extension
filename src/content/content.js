// IMMEDIATE TEST - This should appear first if content script loads
console.log('🚨🚨🚨 PII EXTENSION CONTENT SCRIPT LOADING - START 🚨🚨🚨');
console.log('🚨 Current URL:', window.location.href);
console.log('🚨 Document ready state:', document.readyState);
console.log('🚨 Chrome runtime available:', !!chrome?.runtime);
console.log('🚨 Extension ID:', chrome?.runtime?.id);

// Define essential test functions IMMEDIATELY
window.simplePresidioTest = function() {
  console.log('🔧 Simple Presidio Test (immediate)');
  console.log('- PresidioClient type:', typeof window.PresidioClient);
  if (typeof window.PresidioClient !== 'undefined') {
    try {
      const client = new window.PresidioClient();
      console.log('✅ PresidioClient created successfully');
      client.isServiceAvailable().then(available => {
        console.log('🔍 Presidio Available:', available);
      }).catch(err => {
        console.log('❌ Presidio Error:', err.message);
      });
    } catch (error) {
      console.log('❌ PresidioClient creation failed:', error.message);
    }
  } else {
    console.log('❌ PresidioClient not available');
  }
};

console.log('🔧 simplePresidioTest function defined - you can call it anytime');

// Add extension context monitoring
window.addEventListener('beforeunload', () => {
  console.log('🚨 Page unloading - extension context may be invalidated');
});

// Monitor for extension context invalidation
const checkExtensionContext = () => {
  if (!chrome?.runtime?.id) {
    console.error('🚨 Extension context invalidated - extension may have been reloaded');
    return false;
  }
  return true;
};

// Check context periodically
setInterval(checkExtensionContext, 5000);

console.log('🔒 PII Extension: Content script loading...');

// IMMEDIATE GLOBAL FUNCTION - Available right away
window.testExtensionLoaded = () => {
  console.log('✅ EXTENSION CONTENT SCRIPT IS LOADED AND WORKING!');
  return 'Extension is working!';
};

console.log('🚨 testExtensionLoaded function defined immediately');

class PIIExtensionContent {
  constructor() {
    this.chatGPTIntegration = null;
    this.geminiIntegration = null;
    this.activeIntegration = null;
    this.isActive = true;
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 5;
    this.platform = this.detectPlatform();
  }

  async initialize() {
    console.log('PII Extension Content Script initializing...');
    
    if (!this.isOnSupportedSite()) {
      console.log('Not on a supported site, extension inactive');
      return;
    }

    try {
      await this.waitForPageLoad();
      await this.initializeChatIntegration();
      this.setupMessageListeners();
      this.notifyExtensionReady();
      
      console.log('PII Extension Content Script initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PII Extension:', error);
      this.scheduleRetryInitialization();
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('chatgpt.com')) {
      return 'chatgpt';
    } else if (hostname.includes('gemini.google.com')) {
      return 'gemini';
    }
    return null;
  }

  isOnSupportedSite() {
    return this.platform !== null;
  }

  async waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
        return;
      }

      const checkReady = () => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  async initializeChatIntegration() {
    console.log(`🔒 Initializing integration for platform: ${this.platform}`);
    
    if (this.platform === 'chatgpt') {
      this.chatGPTIntegration = new ChatGPTIntegration();
      this.activeIntegration = this.chatGPTIntegration;
      
      const initialized = await this.chatGPTIntegration.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize ChatGPT integration');
      }
    } else if (this.platform === 'gemini') {
      this.geminiIntegration = new GeminiIntegration();
      this.activeIntegration = this.geminiIntegration;
      
      const initialized = await this.geminiIntegration.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize Gemini integration');
      }
    } else {
      throw new Error(`Unsupported platform: ${this.platform}`);
    }

    // Notify background script that content script is ready
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('🔒 Background script not available:', chrome.runtime.lastError);
          } else {
            console.log('🔒 Background script notified, response:', response);
          }
        });
      }
    } catch (error) {
      console.log('🔒 Could not notify background script:', error);
    }

    this.setupPageChangeListener();
  }

  setupPageChangeListener() {
    let currentUrl = window.location.href;
    console.log('Setting up page change listener for:', currentUrl);
    
    // Handle SPA navigation (ChatGPT uses client-side routing)
    const handleNavigation = () => {
      if (window.location.href !== currentUrl) {
        const oldUrl = currentUrl;
        currentUrl = window.location.href;
        console.log('Navigation detected:', oldUrl, '→', currentUrl);
        
        // Reinitialize after navigation with longer delay
        setTimeout(() => {
          console.log('Reinitializing after navigation...');
          this.activeIntegration?.reinitialize();
        }, 2000);
      }
    };

    // Monitor for URL changes (SPA navigation)
    const observer = new MutationObserver(handleNavigation);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for browser navigation
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('pushstate', handleNavigation);
    window.addEventListener('replacestate', handleNavigation);

    // Intercept pushState and replaceState (for SPA navigation detection)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(handleNavigation, 100);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(handleNavigation, 100);
    };
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getStatus':
          sendResponse({
            status: 'active',
            platform: this.platform,
            isInitialized: this.activeIntegration?.isInitialized || false,
            url: window.location.href
          });
          break;

        case 'toggleExtension':
          this.isActive = !this.isActive;
          sendResponse({ isActive: this.isActive });
          break;

        case 'reinitialize':
          this.activeIntegration?.reinitialize();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  notifyExtensionReady() {
    chrome.runtime.sendMessage({
      action: 'contentScriptReady',
      url: window.location.href
    }).catch(error => {
      console.log('Could not notify background script:', error);
    });
  }

  scheduleRetryInitialization() {
    this.initializationAttempts++;
    
    if (this.initializationAttempts < this.maxInitializationAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.initializationAttempts), 10000);
      console.log(`Retrying initialization in ${delay}ms (attempt ${this.initializationAttempts})`);
      
      setTimeout(() => {
        this.initialize();
      }, delay);
    } else {
      console.error('Max initialization attempts reached, giving up');
    }
  }
}

let piiExtension;

const initializeExtension = () => {
  if (piiExtension) {
    piiExtension.chatGPTIntegration?.destroy();
    piiExtension.geminiIntegration?.destroy();
  }
  
  piiExtension = new PIIExtensionContent();
  piiExtension.initialize();
};

// Add global test function for debugging
window.testPIIDetection = async (text) => {
  console.log('Testing PII detection for:', text);
  try {
    const detector = new window.PIIPatternDetector();
    const entities = await detector.analyzePII(text);
    console.log('Detected entities:', entities);
    
    const tokenizer = new window.PIITokenizer();
    const tokenized = tokenizer.tokenizeText(text, entities);
    console.log('Tokenized result:', tokenized);
    
    return { entities, tokenized };
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Also expose the extension instance globally for debugging
window.debugPIIExtension = () => {
  console.log('Extension instance:', window.piiExtension);
  console.log('ChatGPT integration:', window.piiExtension?.chatGPTIntegration);
  console.log('Input element:', window.piiExtension?.chatGPTIntegration?.inputElement);
  console.log('Is initialized:', window.piiExtension?.chatGPTIntegration?.isInitialized);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

window.addEventListener('beforeunload', () => {
  piiExtension?.chatGPTIntegration?.destroy();
  piiExtension?.geminiIntegration?.destroy();
});

// Define global functions immediately when content script loads
window.testDetectionMethod = async function(text = "My name is Dr. Sarah Johnson and my email is sarah@hospital.org") {
  console.log("🔍 Testing detection method with:", text);
  try {
    // Test if PIIDetector is available
    if (typeof PIIDetector !== 'undefined') {
      const detector = new PIIDetector();
      console.log("🔍 Testing with PIIDetector directly...");
      const results = await detector.analyzePII(text);
      console.log("🔍 Direct Detection Results:", {
        count: results.length,
        method: results[0]?.detection_method || 'unknown',
        entities: results.map(r => ({
          type: r.entity_type,
          text: r.text,
          method: r.detection_method,
          confidence: r.confidence || r.score
        }))
      });
      return results;
    } else {
      console.log("🔍 PIIDetector not available, testing via background script...");
      return await testPIIDetection(text);
    }
  } catch (error) {
    console.error("🔍 Detection method test error:", error);
    return { error: error.message };
  }
};

// Add function to check what classes are available
window.checkLoadedClasses = function() {
  console.log('🔍 Checking loaded PII classes:');
  console.log('- PresidioClient:', typeof window.PresidioClient);
  console.log('- PIIDetector:', typeof window.PIIDetector);
  console.log('- PIIPatternDetector:', typeof window.PIIPatternDetector);
  console.log('- PIITokenizer:', typeof window.PIITokenizer);
  
  return {
    PresidioClient: typeof window.PresidioClient !== 'undefined',
    PIIDetector: typeof window.PIIDetector !== 'undefined',
    PIIPatternDetector: typeof window.PIIPatternDetector !== 'undefined',
    PIITokenizer: typeof window.PIITokenizer !== 'undefined'
  };
};

// Add simplified Presidio test
window.testPresidioService = async function() {
  console.log('🔍 Testing Presidio service availability...');
  try {
    if (typeof window.PresidioClient === 'undefined') {
      console.error('❌ PresidioClient not loaded');
      return { error: 'PresidioClient not loaded' };
    }
    
    const presidioClient = new window.PresidioClient();
    const available = await presidioClient.isServiceAvailable();
    console.log('🔍 Presidio Available:', available);
    
    if (available) {
      console.log('✅ Presidio services are running and accessible');
    } else {
      console.log('❌ Presidio services are not available');
    }
    
    return { available };
  } catch (error) {
    console.error('🔍 Error testing Presidio:', error);
    return { error: error.message };
  }
};

// Quick test for immediate verification 
window.quickPresidioCheck = function() {
  console.log('🚀 Quick Presidio Check:');
  console.log('PresidioClient available:', typeof window.PresidioClient !== 'undefined');
  if (typeof window.PresidioClient !== 'undefined') {
    const client = new window.PresidioClient();
    client.isServiceAvailable().then(available => {
      console.log('Presidio service available:', available);
    }).catch(error => {
      console.log('Presidio service error:', error.message);
    });
  }
};

console.log('🔒 PII Extension: Global functions defined');
console.log('Available functions: testDetectionMethod, checkLoadedClasses, testPresidioService, quickPresidioCheck');

// Ensure functions are available after initialization
setTimeout(() => {
  console.log('🔒 PII Extension: Debug functions available');
  console.log('- testPIIDetection:', typeof window.testPIIDetection);
  console.log('- debugPIIExtension:', typeof window.debugPIIExtension);
  console.log('- DOMUtils.isElementVisible:', typeof window.DOMUtils?.isElementVisible);
  console.log('- testDetectionMethod:', typeof window.testDetectionMethod);
  console.log('- checkLoadedClasses:', typeof window.checkLoadedClasses);
  console.log('- testPresidioService:', typeof window.testPresidioService);
  console.log('- quickPresidioCheck:', typeof window.quickPresidioCheck);
  
  // Automatically check what's loaded
  setTimeout(() => {
    if (typeof window.checkLoadedClasses === 'function') {
      window.checkLoadedClasses();
    }
  }, 500);
  
  // Add a simple test for immediate use
  window.testSubmissionInterception = () => {
    console.log('🔒 Testing submission interception...');
    const input = document.querySelector('div#prompt-textarea.ProseMirror[contenteditable="true"]');
    if (input) {
      console.log('🔒 Found input element:', input);
      const text = 'Test message with email: test@example.com';
      input.textContent = text;
      
      // Trigger an Enter key event
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      
      console.log('🔒 Dispatching Enter key event...');
      input.dispatchEvent(enterEvent);
    } else {
      console.log('🔒 No input element found');
    }
  };
  
  console.log('🔒 Added testSubmissionInterception function');
  
  // Debug function to test step-by-step
  window.debugChatGPTSubmission = () => {
    console.log('=== DEBUGGING CHATGPT SUBMISSION ===');
    
    // 1. Check what input element we found
    const inputElement = chatGPTIntegration?.inputElement;
    console.log('1. Input element:', inputElement);
    
    if (inputElement) {
      // 2. Test text extraction
      const text = DOMUtils.getTextContent(inputElement);
      console.log('2. Current text content:', text);
      
      // 3. Find all buttons that could be send buttons
      const allButtons = Array.from(document.querySelectorAll('button'));
      console.log('3. All buttons on page:', allButtons.length);
      
      const potentialSendButtons = allButtons.filter(btn => {
        const label = btn.getAttribute('aria-label') || '';
        const testId = btn.getAttribute('data-testid') || '';
        const hasIcon = btn.querySelector('svg') !== null;
        return label.toLowerCase().includes('send') || 
               testId.toLowerCase().includes('send') || 
               (hasIcon && btn.closest('form, [data-testid*="composer"]'));
      });
      
      console.log('4. Potential send buttons:', potentialSendButtons);
      potentialSendButtons.forEach((btn, i) => {
        console.log(`   Button ${i}:`, {
          element: btn,
          ariaLabel: btn.getAttribute('aria-label'),
          testId: btn.getAttribute('data-testid'),
          className: btn.className,
          hasIcon: !!btn.querySelector('svg')
        });
      });
      
      // 5. Check form structure
      const form = inputElement.closest('form');
      console.log('5. Form element:', form);
      
      // 6. Test manual text injection
      console.log('6. Testing manual text injection...');
      if (inputElement.tagName === 'TEXTAREA') {
        inputElement.value = 'Test PII: john.doe@email.com';
      } else if (inputElement.contentEditable === 'true') {
        inputElement.textContent = 'Test PII: john.doe@email.com';
      }
      
      const newText = DOMUtils.getTextContent(inputElement);
      console.log('   After injection:', newText);
    }
    
    console.log('=== END DEBUG ===');
  };
  
  // Make function available globally immediately
  window.debugChatGPTSubmission = window.debugChatGPTSubmission;
  console.log('🔒 Added debugChatGPTSubmission function - available globally');
  
  // Test event listeners
  window.testEventListeners = () => {
    console.log('=== TESTING EVENT LISTENERS ===');
    
    const inputElement = chatGPTIntegration?.inputElement;
    if (!inputElement) {
      console.log('❌ No input element found');
      return;
    }
    
    console.log('📝 Testing input events...');
    // Simulate typing
    inputElement.focus();
    
    if (inputElement.tagName === 'TEXTAREA') {
      inputElement.value = 'test@email.com';
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      inputElement.textContent = 'test@email.com';
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    console.log('⌨️ Testing Enter key...');
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true
    });
    inputElement.dispatchEvent(enterEvent);
    
    console.log('🖱️ Testing button clicks...');
    const buttons = document.querySelectorAll('button');
    let clickCount = 0;
    buttons.forEach(btn => {
      if (clickCount < 3) { // Only test first 3 buttons
        console.log(`Clicking button ${clickCount}:`, btn);
        btn.click();
        clickCount++;
      }
    });
    
    console.log('=== END EVENT TEST ===');
  };
  
  console.log('🔒 Added testEventListeners function');
}, 1000);

// Define debug functions globally and immediately
window.debugChatGPTSubmission = () => {
  console.log('=== DEBUGGING CHATGPT SUBMISSION ===');
  
  // 1. Check what input element we found
  const inputElement = window.chatGPTIntegration?.inputElement;
  console.log('1. Input element:', inputElement);
  
  if (inputElement) {
    // 2. Test text extraction
    const text = window.DOMUtils?.getTextContent(inputElement) || 'DOMUtils not available';
    console.log('2. Current text content:', text);
    
    // 3. Find all buttons that could be send buttons
    const allButtons = Array.from(document.querySelectorAll('button'));
    console.log('3. All buttons on page:', allButtons.length);
    
    const potentialSendButtons = allButtons.filter(btn => {
      const label = btn.getAttribute('aria-label') || '';
      const testId = btn.getAttribute('data-testid') || '';
      const hasIcon = btn.querySelector('svg') !== null;
      return label.toLowerCase().includes('send') || 
             testId.toLowerCase().includes('send') || 
             (hasIcon && btn.closest('form, [data-testid*="composer"]'));
    });
    
    console.log('4. Potential send buttons:', potentialSendButtons);
    potentialSendButtons.forEach((btn, i) => {
      console.log(`   Button ${i}:`, {
        element: btn,
        ariaLabel: btn.getAttribute('aria-label'),
        testId: btn.getAttribute('data-testid'),
        className: btn.className,
        hasIcon: !!btn.querySelector('svg')
      });
    });
    
    // 5. Check form structure
    const form = inputElement.closest('form');
    console.log('5. Form element:', form);
    
    // 6. Check if our event listeners are attached
    const listeners = getEventListeners ? getEventListeners(inputElement) : 'getEventListeners not available';
    console.log('6. Event listeners on input:', listeners);
  }
  
  console.log('=== END DEBUG ===');
};

console.log('🔒 debugChatGPTSubmission function defined globally');

// Add immediate status check
window.checkExtensionStatus = () => {
  console.log('=== EXTENSION STATUS CHECK ===');
  console.log('1. Content script running:', true);
  console.log('2. ChatGPT integration object:', !!window.chatGPTIntegration);
  console.log('3. DOMUtils available:', !!window.DOMUtils);
  console.log('4. Background script communication test...');
  
  // Test background script communication
  chrome.runtime.sendMessage({ action: 'getExtensionStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('❌ Background script error:', chrome.runtime.lastError);
    } else {
      console.log('✅ Background script response:', response);
    }
  });
  
  // Check if input element exists and has listeners
  const input = document.querySelector('#prompt-textarea') || 
                document.querySelector('textarea[name="prompt-textarea"]') ||
                document.querySelector('div[contenteditable="true"]');
  
  console.log('5. Input element found:', !!input);
  
  if (input) {
    console.log('   - Tag name:', input.tagName);
    console.log('   - Content editable:', input.contentEditable);
    console.log('   - Has event listeners attached by extension:', 
                input._piiExtensionListeners ? 'YES' : 'NO');
  }
  
  console.log('=== END STATUS CHECK ===');
};

console.log('🔒 checkExtensionStatus function defined globally');