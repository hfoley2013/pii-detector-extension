# Technical Architecture

## System Overview

The PII Tokenization Chrome Extension is a multi-layered security system that intercepts user input on AI chat platforms, detects PII using Microsoft Presidio, and replaces sensitive data with semantic tokens that preserve context while protecting privacy.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ChatGPT Web   │    │  Gemini Web     │    │  Other AI Chat  │
│   Interface     │    │  Interface      │    │  Platforms      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Content Scripts │
                    │ (DOM Integration)│
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │ PII Detection   │
                    │ Engine          │
                    └─────────────────┘
                         │       │
                ┌────────┘       └────────┐
                │                         │
        ┌───────────────┐       ┌─────────────────┐
        │ Presidio NLP  │       │ Regex Patterns  │
        │ (Primary)     │       │ (Fallback)      │
        └───────────────┘       └─────────────────┘
                │
        ┌───────────────┐
        │ Docker Services│
        │ - Analyzer     │
        │ - Anonymizer   │
        │ - Nginx Proxy  │
        └───────────────┘
```

## Core Components

### 1. Chrome Extension Infrastructure

#### Manifest v3 Service Worker (`src/background/background.js`)
- **Purpose**: Central coordination hub
- **Responsibilities**:
  - Tab state management per platform
  - PII detection statistics tracking
  - Token mapping coordination
  - Extension icon status updates
  - Inter-component message routing

#### Content Scripts
- **Main Coordinator** (`src/content/content.js`): Platform detection and integration initialization
- **Platform Integrations**:
  - `src/content/chatgpt-integration.js`: ChatGPT-specific DOM manipulation
  - `src/content/gemini-integration.js`: Google Gemini-specific handlers

### 2. PII Detection Engine

#### Unified Detection Interface (`src/lib/pii-detector.js`)
```javascript
class PIIDetector {
  async analyzePII(text) {
    // 1. Try Presidio (NLP-based detection)
    // 2. Fallback to regex patterns
    // 3. Merge and deduplicate results
    // 4. Return standardized entity format
  }
}
```

#### Detection Methods
1. **Primary: Microsoft Presidio**
   - Advanced NLP-based entity recognition
   - High accuracy for complex PII patterns
   - Supports multiple languages and entity types
   - Local processing via Docker containers

2. **Fallback: Regex Patterns**
   - Pattern-based detection for basic PII
   - Fast execution, minimal dependencies
   - Used when Presidio unavailable
   - Covers common formats (email, phone, SSN)

### 3. Tokenization System

#### Core Tokenizer (`src/lib/tokenizer.js`)
```javascript
class PIITokenizer {
  generateToken(piiValue, piiType) {
    // Creates: [TYPE:SEMANTIC_LABEL_ID]
    // Example: [EMAIL:EMAIL_ADDRESS_EM1DH9]
  }
  
  tokenizeText(text, piiEntities) {
    // 1. Remove overlapping entities
    // 2. Sort by position (reverse order)
    // 3. Replace with tokens from right to left
    // 4. Maintain bidirectional mapping
  }
}
```

#### Token Format Design
- **Pattern**: `[TYPE:SEMANTIC_LABEL_ID]`
- **Benefits**:
  - Avoids HTML interpretation issues
  - Preserves semantic meaning for AI
  - Enables accurate detokenization
  - Prevents token corruption in rich text editors

#### Overlap Resolution Algorithm
```javascript
removeOverlappingEntities(entities) {
  // 1. Sort entities by start position
  // 2. For each entity, check against accepted entities
  // 3. If overlap detected, keep higher confidence entity
  // 4. Remove lower confidence overlapping entity
  // 5. Return cleaned entity list
}
```

### 4. Platform Integration Layer

#### DOM Event Interception Strategy
```javascript
// Multi-layered event capture
1. Keydown event (Enter key detection)
2. Form submission interception  
3. Submit button click capture
4. Mutation observer for dynamic buttons
5. Global click listener with button filtering
```

#### Platform-Specific Selectors
```javascript
// ChatGPT Selectors
{
  inputField: 'div[contenteditable="true"]#prompt-textarea',
  submitButton: 'button[data-testid="composer-speech-button"]',
  responseContainer: 'div[data-message-author-role="assistant"]'
}

// Gemini Selectors  
{
  inputField: 'div[contenteditable="true"][data-test-id="input-box"]',
  submitButton: 'button[aria-label*="Send"]',
  responseContainer: 'div[data-response-index]'
}
```

### 5. Docker Infrastructure

#### Presidio Services (`docker-compose.yml`)
```yaml
services:
  presidio-analyzer:
    image: mcr.microsoft.com/presidio-analyzer
    ports: ["5001:3000"]
    
  presidio-anonymizer:
    image: mcr.microsoft.com/presidio-anonymizer  
    ports: ["5002:3000"]
    
  # Nginx proxies for CORS handling
  presidio-analyzer-proxy:
    image: nginx:alpine
    ports: ["5001:80"]
    
  presidio-anonymizer-proxy:
    image: nginx:alpine
    ports: ["5002:80"]
```

#### CORS Resolution
- Nginx proxy containers handle cross-origin requests
- Eliminates browser CORS restrictions for local development
- Maintains security by keeping services local-only

## Data Flow Architecture

### 1. Input Interception Flow
```
User types message with PII
        ↓
DOM event captured by content script
        ↓
Event preventDefault() called
        ↓
Text extracted from input element
        ↓
Check if already tokenized (skip processing)
        ↓
Send to PII detection engine
```

### 2. PII Detection Flow
```
Raw text input
        ↓
Try Presidio API call (localhost:5001)
        ↓
If successful: Parse Presidio entities
If failed: Use regex pattern detection
        ↓
Standardize entity format
        ↓
Remove overlapping entities
        ↓
Return cleaned entity list
```

### 3. Tokenization Flow
```
Text + PII entities
        ↓
For each entity (right-to-left):
  1. Generate unique token ID
  2. Create semantic token
  3. Replace in text
  4. Store bidirectional mapping
        ↓
Return tokenized text
        ↓
Show user confirmation dialog
        ↓
If confirmed: Submit tokenized version
If cancelled: Restore original text
```

### 4. Response Processing Flow
```
AI response received
        ↓
Mutation observer detects new content
        ↓
Extract text from response element
        ↓
Search for tokens using regex pattern
        ↓
Replace tokens with original values
        ↓
Update DOM with detokenized content
```

## Security Architecture

### 1. Data Isolation
- **Local Processing**: All PII detection happens locally via Docker
- **No External APIs**: Presidio runs on localhost, no cloud dependencies
- **Memory-Only Storage**: Token mappings stored in browser memory only
- **Session Isolation**: Mappings cleared on tab close/browser restart

### 2. Token Security
- **Unique Session IDs**: Prevent cross-session token conflicts
- **Cryptographic Randomness**: Secure token ID generation
- **Bidirectional Mapping**: Enables reversible tokenization
- **Semantic Preservation**: Maintains context for AI understanding

### 3. Content Script Security
- **DOM Sandboxing**: Content scripts run in isolated context
- **Event Capture**: Prevents PII from reaching target platforms
- **Input Validation**: All user input validated before processing
- **Error Boundaries**: Graceful failure doesn't expose PII

## Performance Architecture

### 1. Lazy Loading Strategy
```javascript
// Components initialized on-demand
if (!this.piiDetector) {
  this.piiDetector = new PIIDetector();
}
```

### 2. Caching Mechanisms
- **DOM Element Caching**: Store frequently accessed elements
- **Detection Result Caching**: Cache results for repeated text
- **Token Mapping Cache**: Fast bidirectional lookup tables

### 3. Debouncing and Throttling
```javascript
// Debounced response monitoring
this.responseObserver = DOMUtils.observeElement(container, 
  DOMUtils.debounce(this.handleResponseMutations, 500)
);
```

### 4. Memory Management
- **Automatic Cleanup**: Remove observers and listeners on destroy
- **Token Limits**: Prevent unlimited token accumulation
- **Garbage Collection**: Clear unused mappings periodically

## Extensibility Architecture

### 1. Platform Plugin System
```javascript
class NewPlatformIntegration extends BasePlatformIntegration {
  constructor() {
    this.selectors = { /* platform-specific */ };
  }
  
  // Implement required interface methods
  async initialize() { /* ... */ }
  setupInputInterception() { /* ... */ }
  submitForm() { /* ... */ }
}
```

### 2. Detection Engine Plugins
```javascript
class CustomDetector {
  async analyzePII(text) {
    // Custom detection logic
    return entities;
  }
}

// Register with unified detector
detector.addDetectionMethod('custom', new CustomDetector());
```

### 3. Token Format Extensions
```javascript
// Support multiple token formats
const tokenFormats = {
  bracket: '[TYPE:LABEL_ID]',
  xml: '<type>LABEL_ID</type>',
  custom: '{{TYPE::LABEL::ID}}'
};
```

## Monitoring and Observability

### 1. Logging Architecture
```javascript
// Platform-specific logging with emoji indicators
console.log('🔒 ChatGPT: ' + message);  // Blue for ChatGPT
console.log('🟡 Gemini: ' + message);   // Yellow for Gemini
console.log('🤖 Presidio: ' + message); // Robot for detection engine
```

### 2. Performance Metrics
```javascript
// Detection timing
console.time('pii-detection');
const entities = await detector.analyzePII(text);
console.timeEnd('pii-detection');

// Success rate tracking
const metrics = {
  presidioSuccessCount: 0,
  presidioFailureCount: 0,
  regexFallbackCount: 0,
  averageDetectionTime: 0
};
```

### 3. Health Monitoring
```javascript
// Service availability checks
async isServiceHealthy() {
  try {
    const response = await fetch('http://localhost:5001/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}
```

## Deployment Architecture

### 1. Development Environment
- Local Docker containers for Presidio services
- Chrome extension loaded unpacked
- Hot reload for rapid development
- Console debugging functions available

### 2. Production Considerations
- Extension packaged as .crx file
- Presidio services containerized for enterprise deployment
- Performance monitoring and error reporting
- Automatic updates via Chrome Web Store

### 3. Enterprise Deployment
- Private extension hosting
- Corporate Docker registry
- Centralized logging and monitoring
- Policy-based configuration management

## Future Architecture Considerations

### 1. Scalability Enhancements
- Web Workers for heavy PII processing
- IndexedDB for persistent token storage
- Background sync for offline capabilities
- Multiple Presidio instance load balancing

### 2. Additional Platform Support
- Microsoft Copilot integration
- Slack/Teams chat protection
- Email client extensions
- Document editor plugins

### 3. Advanced Security Features
- Hardware security module integration
- Zero-knowledge token protocols
- Encrypted token transmission
- Audit trail generation

This architecture provides a robust, secure, and extensible foundation for PII protection across multiple AI chat platforms while maintaining high performance and user experience quality.