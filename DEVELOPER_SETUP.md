# Developer Setup Guide

This guide provides step-by-step instructions for developers to set up the PII Tokenization Chrome Extension development environment.

## 🚀 Quick Setup (5 minutes)

### 1. Prerequisites Check
```bash
# Check Docker is installed and running
docker --version
docker-compose --version

# Check Chrome/Chromium is available
google-chrome --version || chromium --version
```

### 2. Clone and Start Services
```bash
git clone <repository-url>
cd PiiDetector

# Start Presidio services in background
docker-compose up -d

# Verify services are healthy (should return {"status": "alive"})
curl http://localhost:5001/health
curl http://localhost:5002/health
```

### 3. Load Extension in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" → Select `PiiDetector` folder
4. Extension should appear with shield icon

### 4. Verify Installation
1. Open `https://chatgpt.com`
2. Open DevTools Console (F12)
3. Type: `checkExtensionStatus()`
4. Should see: ✅ Extension loaded and active

## 🔧 Development Environment

### Branch Strategy
- **`main`**: Production-ready ChatGPT support
- **`presidio-integration`**: Presidio + ChatGPT integration
- **`gemini`**: Adds Google Gemini support

### Recommended Checkout
```bash
# For full functionality including Gemini
git checkout gemini

# Load extension from gemini branch for testing
```

### File Monitoring During Development
```bash
# Watch for file changes and reload extension automatically
# (Manual reload via chrome://extensions/ is needed for now)
```

## 🧪 Testing Workflows

### 1. Basic Functionality Test
```javascript
// In ChatGPT console
testDetectionMethod("My name is Dr. Sarah Johnson and my email is sarah@hospital.org")

// Expected output:
// 🔍 Direct Detection Results: {count: 2, method: 'presidio', entities: [{type: 'name', text: 'Dr. Sarah Johnson'}, {type: 'email', text: 'sarah@hospital.org'}]}
```

### 2. Platform Detection Test
```javascript
// Should auto-detect platform
checkExtensionStatus()

// Expected: {status: 'active', platform: 'chatgpt', isInitialized: true}
```

### 3. Presidio Service Test
```javascript
testPresidioService()

// Expected: {available: true}
```

### 4. Full Integration Test
1. Type message with PII in ChatGPT/Gemini
2. Verify detection dialog appears
3. Click OK to submit tokenized version
4. Check tokens format: `[EMAIL:EMAIL_ADDRESS_EM123]`

## 🔍 Debugging Common Issues

### Extension Not Loading
```bash
# Check manifest.json syntax
cat manifest.json | python -m json.tool

# Verify all referenced files exist
ls -la src/content/
ls -la src/lib/
ls -la src/services/
```

### Presidio Connection Issues
```bash
# Check Docker containers
docker-compose ps

# Restart if needed
docker-compose down && docker-compose up -d

# Check logs
docker-compose logs presidio-analyzer
docker-compose logs presidio-anonymizer
```

### No PII Detection
```javascript
// Debug in console
checkLoadedClasses()
// Should show all classes as 'true'

testPresidioService()
// Should show 'available: true'

// Check DOM element detection
debugChatGPTSubmission()
```

### Extension Context Errors
1. Go to `chrome://extensions/`
2. Click reload on PII Tokenization Extension
3. Refresh the ChatGPT/Gemini page
4. Test again

## 🏗️ Architecture Overview for Developers

### Content Script Flow
```
content.js (coordinator)
    ↓
Platform Detection (chatgpt|gemini)
    ↓
chatgpt-integration.js OR gemini-integration.js
    ↓
Event Interception (Enter key, Submit button)
    ↓
pii-detector.js (Presidio → Regex fallback)
    ↓
tokenizer.js (Create semantic tokens)
    ↓
User Confirmation Dialog
    ↓
Submit Tokenized Text
```

### Key Integration Points

#### 1. DOM Selectors (Platform-Specific)
```javascript
// ChatGPT
inputField: 'div[contenteditable="true"]#prompt-textarea'
submitButton: 'button[data-testid="composer-speech-button"]'

// Gemini
inputField: 'div[contenteditable="true"][data-test-id="input-box"]'
submitButton: 'button[aria-label*="Send"]'
```

#### 2. Event Interception
```javascript
// Prevent default submission
event.preventDefault()
event.stopPropagation()
event.stopImmediatePropagation()

// Process with PII detection
processInputText(text) → tokenizedText

// Submit tokenized version
submitTokenizedText(tokenizedText)
```

#### 3. PII Detection Chain
```javascript
// 1. Try Presidio (NLP-based)
presidioClient.detectPII(text)

// 2. Fallback to Regex
regexDetector.analyzePII(text)

// 3. Merge results with overlap resolution
removeOverlappingEntities(entities)
```

## 📦 Building for Production

### Extension Packaging
```bash
# Remove development files
rm -rf .git node_modules

# Create extension package
zip -r pii-extension.zip . -x "*.git*" "node_modules/*" "*.DS_Store"
```

### Version Management
```javascript
// Update manifest.json version
{
  "manifest_version": 3,
  "name": "PII Tokenization Extension",
  "version": "1.0.0",  // Increment this
  // ...
}
```

## 🔧 Advanced Development

### Adding New PII Types
1. **Update Presidio Configuration**
```javascript
// src/services/presidio-client.js
entities: ['PERSON', 'EMAIL_ADDRESS', 'PHONE_NUMBER', 'NEW_TYPE']
```

2. **Add Regex Patterns**
```javascript
// src/lib/pii-patterns.js
newType: {
  regex: /pattern-here/g,
  entity_type: 'new_type'
}
```

3. **Update Tokenizer**
```javascript
// src/lib/tokenizer.js
getSemanticLabel(piiType) {
  const semanticLabels = {
    // ...existing types
    'new_type': 'NEW_TYPE_LABEL'
  };
}
```

### Adding New Platform Support
1. **Create Integration Module**
```javascript
// src/content/newplatform-integration.js
class NewPlatformIntegration {
  constructor() {
    this.selectors = {
      inputField: 'platform-specific-selector',
      submitButton: 'platform-submit-selector'
    };
  }
  // Implement required methods
}
```

2. **Update Platform Detection**
```javascript
// src/content/content.js
detectPlatform() {
  if (hostname.includes('newplatform.com')) {
    return 'newplatform';
  }
}
```

3. **Update Manifest**
```json
{
  "host_permissions": [
    "https://newplatform.com/*"
  ],
  "content_scripts": [{
    "matches": ["https://newplatform.com/*"],
    "js": ["src/content/newplatform-integration.js"]
  }]
}
```

## 🎯 Performance Optimization

### Content Script Performance
- Use efficient DOM queries
- Debounce event handlers
- Implement lazy loading for heavy components
- Cache DOM elements after first query

### PII Detection Performance
- Implement request caching for repeated text
- Use Web Workers for heavy processing (future enhancement)
- Optimize regex patterns for performance
- Batch multiple detection requests

### Memory Management
- Clear token mappings on tab close
- Limit token cache size
- Remove old event listeners properly
- Monitor for memory leaks in DevTools

## 🔐 Security Best Practices

### Content Script Security
- Validate all user input
- Sanitize DOM manipulation
- Use Content Security Policy
- Avoid eval() and innerHTML

### Token Security
- Generate cryptographically secure token IDs
- Implement token expiration
- Clear sensitive data from memory
- Use secure random number generation

### Presidio Security
- Keep services local-only
- Use HTTPS for production deployments
- Implement service authentication
- Monitor for data leaks

## 📊 Monitoring and Metrics

### Development Metrics
```javascript
// Performance monitoring
console.time('pii-detection')
await detector.analyzePII(text)
console.timeEnd('pii-detection')

// Success rate tracking
const metrics = await detector.getStatus()
console.log('Detection success rate:', metrics.successRate)
```

### Production Monitoring
- Extension crash reporting
- PII detection accuracy metrics
- Performance benchmarks
- User adoption analytics

---

## 🆘 Getting Help

### Debug Console Commands
```javascript
// Check everything is working
checkExtensionStatus()

// Test PII detection specifically
testDetectionMethod("test text with email@example.com")

// Verify all components loaded
checkLoadedClasses()

// Test Presidio connection
testPresidioService()

// Debug DOM integration
debugChatGPTSubmission()
```

### Log Patterns to Look For
```
✅ Good: "🔒 ChatGPT integration initialized successfully"
✅ Good: "🤖 PRESIDIO DETECTION ACTIVE"
❌ Error: "Extension context invalidated"
❌ Error: "PresidioClient not loaded"
⚠️  Warning: "📝 REGEX FALLBACK ACTIVE"
```

### Common Development Pitfalls
1. **Forgetting to reload extension** after code changes
2. **Docker services not running** when testing Presidio
3. **CORS issues** - should be auto-handled by nginx proxy
4. **Event listener conflicts** - multiple listeners can cause issues

Need help? Check the main README.md troubleshooting section or create an issue.