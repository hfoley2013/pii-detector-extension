# PII Tokenization Chrome Extension - Requirements Document

## Product Requirements Document (PRD)

### Project Overview
**Objective**: Create a Chrome extension that intercepts, tokenizes, and detokenizes PII/PHI data when interacting with AI chat interfaces to protect sensitive information from being processed by AI models.

**Target Platform**: Google Chrome Extension (Manifest V3)
**Initial Scope**: ChatGPT (OpenAI) interface - selected as primary target due to simpler DOM structure
**Timeline**: Proof of Concept (PoC) implementation

### Core Functionality Requirements

#### 1. PII/PHI Detection & Classification
- **Primary Engine**: Presidio (Microsoft's open-source PII detection library)
- **Fallback**: Pattern-based detection for common PII types
- **Supported PII Types** (Initial PoC):
  - Names (PERSON)
  - Email addresses (EMAIL_ADDRESS) 
  - Phone numbers (PHONE_NUMBER)
  - Social Security Numbers (US_SSN)
  - Credit Card Numbers (CREDIT_CARD)
  - Addresses (LOCATION)
  - Dates of Birth (DATE_TIME)

#### 2. Tokenization System
- **Algorithm**: Format-preserving, deterministic tokenization
- **Token Format**: `<tag>TOKEN</tag>` where tag represents PII type
- **Token Generation**: 
  - Deterministic (same input = same token within session)
  - Alphanumeric tokens (6-8 characters)
  - Preserve original data length characteristics when possible
- **XML Tags**:
  - `<name>` for person names
  - `<email>` for email addresses
  - `<phone>` for phone numbers
  - `<ssn>` for social security numbers
  - `<cc>` for credit card numbers
  - `<address>` for addresses
  - `<date>` for dates

#### 3. Interception & Processing Flow
**Input Processing**:
1. Monitor ChatGPT text input field for form submission
2. Intercept content before submission
3. Scan content for PII using Presidio
4. Replace detected PII with semantic tokens
5. Submit tokenized content to ChatGPT

**Output Processing**:
1. Monitor ChatGPT response area for new content
2. Detect tokens in AI responses using XML tag pattern matching
3. Replace tokens with original PII values
4. Display detokenized response to user

#### 4. User Interface Requirements
- **Minimal UI**: Status indicator icon in extension toolbar
- **Status States**:
  - Green: Active and monitoring
  - Orange: PII detected and tokenized
  - Red: Error state
  - Gray: Inactive/disabled
- **Optional**: Small notification when PII is detected and tokenized

### Technical Implementation Requirements

#### Architecture Components

##### 1. Content Script (`content.js`)
**Responsibilities**:
- DOM monitoring and manipulation
- Form submission interception
- Response content monitoring
- Token replacement in real-time

**Key Functions**:
```javascript
// Core functions to implement
initializeMonitoring()
interceptFormSubmission()
scanAndTokenizeContent()
monitorResponseContent()
detokenizeResponse()
```

##### 2. Background Script (`background.js`)
**Responsibilities**:
- PII detection processing
- Token generation and storage
- Cross-tab token consistency
- Extension lifecycle management

##### 3. Presidio Integration Module (`presidio-detector.js`)
**Responsibilities**:
- Initialize Presidio analyzer
- Process text for PII detection
- Return structured PII findings

##### 4. Tokenization Engine (`tokenizer.js`)
**Responsibilities**:
- Generate deterministic tokens
- Maintain token-to-PII mapping
- Handle tokenization/detokenization logic

#### DOM Integration Specifications

**ChatGPT Target Elements**:
- Input field selector: `textarea[data-id]` or `div[contenteditable="true"]`
- Submit trigger: Form submission or Enter key press
- Response container: `div[data-message-author-role="assistant"]`
- Response monitoring: MutationObserver on response container

#### Data Flow Architecture

```
User Input → Content Script → Background Script → Presidio Analysis
     ↓              ↓               ↓                    ↓
Tokenized Input → Form Submission → ChatGPT → AI Response
     ↓              ↓               ↓           ↓
Content Script ← Token Detection ← Response Monitor ← AI Response
     ↓
Detokenized Display → User
```

#### Security & Privacy Requirements

##### Data Handling
- **No External Transmission**: All PII processing occurs locally
- **Session-Only Storage**: Token mappings cleared on tab/session close
- **Memory Management**: Secure cleanup of sensitive data
- **No Persistent Storage**: No PII stored in extension storage APIs

##### Token Security
- **Collision Resistance**: Extremely low probability of token collisions
- **Non-Reversible**: Tokens cannot be reverse-engineered without mapping
- **Session Isolation**: Different sessions generate different tokens for same PII

### Implementation Specifications for Claude Code

#### Directory Structure
```
pii-tokenization-extension/
├── manifest.json
├── src/
│   ├── content/
│   │   ├── content.js
│   │   └── chatgpt-integration.js
│   ├── background/
│   │   └── background.js
│   ├── lib/
│   │   ├── presidio-detector.js
│   │   ├── tokenizer.js
│   │   └── pii-patterns.js
│   ├── ui/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── styles.css
│   └── utils/
│       ├── dom-utils.js
│       └── security-utils.js
├── assets/
│   └── icons/
└── tests/
    └── test-cases.js
```

#### Key Implementation Files

##### manifest.json
- Manifest V3 compliance
- Content script registration for chat.openai.com
- Background script configuration
- Minimal permissions (activeTab, storage for session data)

##### Critical Functions to Implement

**Content Script Functions**:
```javascript
// Initialize extension on ChatGPT page
async function initializeChatGPTMonitoring()

// Intercept form submissions
function interceptChatSubmission(inputElement)

// Tokenize content before submission
async function tokenizeContent(text)

// Monitor for AI responses
function setupResponseMonitoring()

// Detokenize AI responses
function detokenizeResponse(responseElement)
```

**Background Script Functions**:
```javascript
// Process PII detection
async function detectPII(text)

// Generate deterministic tokens
function generateToken(piiValue, piiType)

// Manage token mappings
function storeTokenMapping(token, originalValue)
function retrieveOriginalValue(token)
```

#### Testing Requirements

**Test Scenarios**:
1. **Basic PII Detection**: Names, emails, phone numbers
2. **Mixed Content**: Text with multiple PII types
3. **Edge Cases**: Partial PII, false positives
4. **ChatGPT Integration**: Form submission, response handling
5. **Token Consistency**: Same PII generates same token within session
6. **Session Isolation**: Different sessions generate different tokens

**Test Data**:
```
Test Input: "Hi, I'm John Smith. My email is john.smith@email.com and my phone is (555) 123-4567."
Expected Tokenized: "Hi, I'm <name>Tok123</name>. My email is <email>Eml456</email> and my phone is <phone>Phn789</phone>."
```

#### Development Priorities

**Phase 1 - Core PoC**:
1. Basic Presidio integration
2. Simple tokenization (names and emails only)
3. ChatGPT form interception
4. Basic detokenization

**Phase 2 - Enhanced Detection**:
1. Full PII type support
2. Improved accuracy tuning
3. Error handling and edge cases

**Phase 3 - User Experience**:
1. Status indicators
2. User notifications
3. Performance optimization

### Performance Requirements
- **Processing Speed**: <100ms for typical chat message tokenization
- **Memory Usage**: <10MB additional memory footprint
- **CPU Impact**: Minimal impact on page responsiveness
- **Detection Accuracy**: >95% for common PII types, <5% false positive rate

### Browser Compatibility
- **Primary**: Chrome 88+ (Manifest V3 support)
- **Testing**: Latest Chrome stable version
- **Fallbacks**: Graceful degradation for unsupported features

### Error Handling Requirements
- **Network Failures**: Continue with pattern-based detection if Presidio fails
- **DOM Changes**: Robust selectors that adapt to minor UI changes
- **Processing Errors**: Fail-safe to allow original content submission
- **User Notification**: Clear error states and recovery options

### Success Metrics for PoC
1. **Functionality**: Successfully tokenizes and detokenizes common PII types
2. **Integration**: Works seamlessly with ChatGPT interface
3. **Performance**: No noticeable delay in user interaction
4. **Accuracy**: Correctly identifies PII without excessive false positives
5. **Security**: No PII leakage or persistent storage of sensitive data

---

## Claude Code Implementation Instructions

When implementing this extension:

1. **Start with manifest.json** and basic extension structure
2. **Implement core tokenizer** with simple deterministic algorithm first
3. **Add ChatGPT DOM integration** with robust selectors
4. **Integrate Presidio** or implement pattern-based PII detection
5. **Add comprehensive error handling** throughout
6. **Test extensively** with provided test cases
7. **Optimize performance** and memory usage

Focus on creating a working PoC that demonstrates the core concept rather than a production-ready solution. Prioritize functionality and reliability over advanced features.
