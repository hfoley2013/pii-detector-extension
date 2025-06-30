# PII Tokenization Chrome Extension

A Chrome extension that protects sensitive PII/PHI data by detecting and tokenizing it before sending to AI chat interfaces like ChatGPT and Google Gemini.

## 🔒 Overview

This extension intercepts user input on AI chat platforms, detects personally identifiable information (PII) using Microsoft Presidio, and replaces it with semantic tokens that preserve meaning while protecting privacy.

### Supported Platforms
- **ChatGPT** (`https://chatgpt.com/*`) - Blue 🔒 logs
- **Google Gemini** (`https://gemini.google.com/*`) - Yellow 🟡 logs

### Example Transformation
```
Input:  "My name is Dr. Sarah Johnson and my email is sarah@hospital.org"
Output: "My name is [NAME:PERSON_NAME_NM96AV] and my email is [EMAIL:EMAIL_ADDRESS_EM1DH9]"
```

## 🏗️ Architecture

### Core Components

1. **PII Detection Engine** (Presidio + Regex Fallback)
   - Primary: Microsoft Presidio for advanced NLP-based detection
   - Fallback: Regex patterns for basic detection when Presidio unavailable

2. **Tokenization System**
   - Semantic token format: `[TYPE:SEMANTIC_LABEL_ID]`
   - Overlap resolution to prevent malformed tokens
   - Bidirectional mapping for detokenization

3. **Platform Integrations**
   - ChatGPT: DOM manipulation for ProseMirror editor
   - Gemini: Contenteditable div and textarea handling
   - Unified event interception and submission handling

4. **Chrome Extension Architecture**
   - Manifest v3 service worker
   - Content scripts for each platform
   - Background script for coordination and state management

## 🚀 Setup Instructions

### Prerequisites
- Docker Desktop installed and running
- Chrome browser
- Git

### 1. Clone and Setup Repository
```bash
git clone <repository-url>
cd PiiDetector
```

### 2. Start Presidio Services
```bash
# Start Presidio analyzer and anonymizer services
docker-compose up -d

# Verify services are running
docker-compose ps
```

**Expected output:**
```
NAME                         STATUS    PORTS
piidetector-presidio-analyzer-1     running   0.0.0.0:5001->80/tcp
piidetector-presidio-anonymizer-1   running   0.0.0.0:5002->80/tcp
```

### 3. Verify Presidio Health
Open browser and check:
- Analyzer: http://localhost:5001/health
- Anonymizer: http://localhost:5002/health

Both should return `{"status": "alive"}`

### 4. Load Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `PiiDetector` folder
5. Verify extension appears with PII icon

### 5. Test Installation

1. Open ChatGPT or Gemini
2. Open DevTools Console (F12)
3. Type test message with PII: "My email is test@example.com"
4. Look for detection logs:
   - ChatGPT: Blue 🔒 logs
   - Gemini: Yellow 🟡 logs
5. Verify PII confirmation dialog appears

## 🔧 Development

### Project Structure
```
PiiDetector/
├── manifest.json                     # Chrome extension manifest
├── docker-compose.yml               # Presidio services configuration
├── config/                          # Nginx proxy configs for CORS
├── src/
│   ├── background/
│   │   └── background.js            # Service worker, state management
│   ├── content/
│   │   ├── content.js               # Main content script coordinator
│   │   ├── chatgpt-integration.js   # ChatGPT-specific integration
│   │   └── gemini-integration.js    # Gemini-specific integration
│   ├── lib/
│   │   ├── tokenizer.js             # Core tokenization logic
│   │   ├── pii-detector.js          # Unified PII detection
│   │   └── pii-patterns.js          # Regex pattern definitions
│   ├── services/
│   │   └── presidio-client.js       # HTTP client for Presidio
│   ├── utils/
│   │   └── dom-utils.js             # DOM manipulation utilities
│   └── ui/
│       └── popup.html               # Extension popup interface
└── assets/                          # Extension icons
```

### Key Technologies
- **Microsoft Presidio**: NLP-based PII detection
- **Chrome Extensions API**: Manifest v3
- **Docker**: Containerized Presidio services
- **Nginx**: CORS proxy for local development

### Branch Structure
- `main`: Stable ChatGPT-only version
- `presidio-integration`: Presidio + ChatGPT integration
- `gemini`: Adds Google Gemini support

## 🧪 Testing

### Debug Functions (Available in Console)
```javascript
// Test PII detection
testDetectionMethod("My name is John and email is john@test.com")

// Check loaded classes
checkLoadedClasses()

// Test Presidio service
testPresidioService()

// Extension status
checkExtensionStatus()

// Debug ChatGPT integration
debugChatGPTSubmission()
```

### Manual Testing Checklist

#### ChatGPT Testing
1. Navigate to `https://chatgpt.com`
2. Check console for blue 🔒 initialization logs
3. Type message with PII: "My name is Dr. Sarah Johnson, email sarah@hospital.org, phone (555) 123-4567"
4. Press Enter
5. Verify:
   - PII confirmation dialog appears
   - Shows detected entities (name, email, phone)
   - Original vs tokenized text preview
   - Tokens format: `[NAME:PERSON_NAME_XX123]`

#### Gemini Testing
1. Navigate to `https://gemini.google.com`
2. Check console for yellow 🟡 initialization logs
3. Repeat same PII test as ChatGPT
4. Verify same behavior with Gemini-specific selectors

#### Presidio vs Regex Testing
1. Stop Docker: `docker-compose down`
2. Test same input - should show "REGEX FALLBACK ACTIVE"
3. Start Docker: `docker-compose up -d`
4. Test again - should show "PRESIDIO DETECTION ACTIVE"

## 🐛 Troubleshooting

### Common Issues

#### 1. "PresidioClient not loaded"
**Solution**: Check Docker services are running
```bash
docker-compose ps
curl http://localhost:5001/health
```

#### 2. "Extension context invalidated"
**Solution**: Reload extension in Chrome
1. Go to `chrome://extensions/`
2. Click reload button on PII extension

#### 3. No PII detection on page
**Solution**: Check console logs
1. Open DevTools (F12)
2. Look for initialization logs
3. Verify correct platform detected
4. Check input element found

#### 4. CORS errors accessing Presidio
**Solution**: Nginx proxy should handle this automatically
```bash
# Restart services if CORS issues persist
docker-compose down
docker-compose up -d
```

#### 5. Submit button not intercepted
**Solution**: Check DOM selectors
```javascript
// Debug submit button detection
debugChatGPTSubmission()
```

### Log Interpretation

#### Successful ChatGPT Flow
```
🔒 PII Extension: ChatGPTIntegration loaded
🔒 ChatGPT integration initialized successfully
🔒 🔒 🔒 STARTING PRESIDIO DETECTION IN CONTENT SCRIPT
🤖 PRESIDIO DETECTION ACTIVE - Using Presidio for PII detection
🔒 🔒 🔒 CONTENT SCRIPT DETECTION COMPLETE: {count: 2, method: 'presidio'}
🔒 🔒 🔒 TOKENIZATION COMPLETE: My name is [NAME:PERSON_NAME_NM96AV]...
```

#### Successful Gemini Flow
```
🟡 PII Extension: GeminiIntegration loaded
🟡 Gemini integration initialized successfully
🟡 🟡 🟡 STARTING PRESIDIO DETECTION IN GEMINI CONTENT SCRIPT
🤖 PRESIDIO DETECTION ACTIVE - Using Presidio for PII detection
🟡 🟡 🟡 GEMINI CONTENT SCRIPT DETECTION COMPLETE: {count: 2, method: 'presidio'}
🟡 🟡 🟡 GEMINI TOKENIZATION COMPLETE: My name is [NAME:PERSON_NAME_NM96AV]...
```

## 🔐 Security Considerations

### Privacy Protection
- **Data stays local**: Presidio runs locally via Docker
- **No external API calls**: All processing happens on user's machine
- **Secure tokenization**: Bidirectional mapping stored in browser memory only
- **Session isolation**: Token mappings cleared per browser session

### Token Security
- **Semantic preservation**: Tokens maintain context for AI understanding
- **Unique session IDs**: Prevents cross-session token conflicts
- **Reversible mapping**: Allows detokenization of AI responses
- **Overlap resolution**: Prevents malformed tokens from entity conflicts

## 🔄 Development Workflow

### Adding New Platform Support
1. Create new integration file: `src/content/[platform]-integration.js`
2. Add platform detection in `src/content/content.js`
3. Update manifest.json with new URLs
4. Update background.js tab listeners
5. Test with platform-specific selectors

### Modifying PII Detection
1. Update patterns in `src/lib/pii-patterns.js` for regex
2. Modify Presidio config in `src/services/presidio-client.js`
3. Add new entity types to tokenizer semantic labels
4. Test with new PII types

### Deployment
1. Test on all supported platforms
2. Verify Presidio integration works
3. Run manual testing checklist
4. Package extension for distribution
5. Update version in manifest.json

## 📝 API Reference

### Key Classes

#### `PIIDetector`
```javascript
const detector = new PIIDetector();
const entities = await detector.analyzePII(text);
```

#### `PIITokenizer`
```javascript
const tokenizer = new PIITokenizer();
const tokenized = tokenizer.tokenizeText(text, entities);
const original = tokenizer.detokenizeText(tokenized);
```

#### `ChatGPTIntegration` / `GeminiIntegration`
```javascript
const integration = new ChatGPTIntegration();
await integration.initialize();
```

### Token Format
- Pattern: `[TYPE:SEMANTIC_LABEL_ID]`
- Example: `[EMAIL:EMAIL_ADDRESS_EM1DH9]`
- Types: NAME, EMAIL, PHONE, SSN, CC, ADDRESS, DATE, URL

## 🤝 Contributing

### Code Style
- Use semantic logging with platform emojis (🔒 ChatGPT, 🟡 Gemini)
- Follow async/await patterns
- Add overlap resolution for new tokenizers
- Maintain fallback patterns for robustness

### Pull Request Process
1. Create feature branch from appropriate base
2. Test on both ChatGPT and Gemini
3. Verify Presidio integration works
4. Add/update documentation
5. Submit PR with test results

## 📊 Monitoring

### Extension Status
- Background script tracks per-tab PII detection stats
- Content scripts log detection method (Presidio vs Regex)
- Performance metrics for detection timing
- Error tracking for service availability

### Health Checks
- Presidio service availability monitoring
- Extension context validation
- DOM element detection verification
- Event listener attachment confirmation

---

## Quick Start Summary

1. **Start services**: `docker-compose up -d`
2. **Load extension**: Chrome → Extensions → Load unpacked
3. **Test on ChatGPT**: Type PII, verify detection dialog
4. **Test on Gemini**: Same test with yellow logs
5. **Debug issues**: Use console functions like `checkExtensionStatus()`

For technical support or questions, refer to the troubleshooting section above.