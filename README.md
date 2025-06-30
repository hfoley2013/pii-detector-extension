# PII Tokenization Chrome Extension

A Chrome extension that protects sensitive information by tokenizing PII/PHI data when interacting with AI chat interfaces like ChatGPT.

## Features

- **Automatic PII Detection**: Detects names, email addresses, phone numbers, SSNs, credit cards, and dates
- **Format-Preserving Tokenization**: Replaces PII with semantic tokens before sending to AI models
- **Real-time Detokenization**: Converts tokens back to original values in AI responses
- **Session-based Security**: Token mappings are session-specific and cleared automatically
- **ChatGPT Integration**: Seamlessly works with ChatGPT interface

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the extension directory
5. Navigate to `chatgpt.com` to use the extension

## How It Works

1. **Input Interception**: Monitors text input on ChatGPT
2. **PII Detection**: Scans for sensitive information using pattern matching
3. **Tokenization**: Replaces PII with XML-tagged tokens (e.g., `<name>TOKEN123</name>`)
4. **Submission**: Sends tokenized text to ChatGPT
5. **Response Monitoring**: Watches for AI responses containing tokens
6. **Detokenization**: Replaces tokens with original PII values for display

## File Structure

```
├── manifest.json              # Extension configuration
├── src/
│   ├── content/
│   │   ├── content.js         # Main content script
│   │   └── chatgpt-integration.js  # ChatGPT-specific DOM integration
│   ├── background/
│   │   └── background.js      # Background service worker
│   ├── lib/
│   │   ├── tokenizer.js       # Core tokenization logic
│   │   └── pii-patterns.js    # PII detection patterns
│   ├── ui/
│   │   ├── popup.html         # Extension popup interface
│   │   ├── popup.js           # Popup functionality
│   │   └── styles.css         # UI styling
│   └── utils/
│       └── dom-utils.js       # DOM manipulation utilities
├── tests/
│   └── test-cases.js          # Test suite
└── README.md
```

## Security Features

- **Local Processing**: All PII processing happens locally in the browser
- **No External Transmission**: PII never leaves your device
- **Session-Only Storage**: Token mappings are cleared when tabs/sessions close
- **No Persistent Storage**: No PII stored in extension storage APIs
- **Deterministic Tokens**: Same PII generates same token within a session

## Testing

The extension includes a comprehensive test suite. To run tests:

1. Open browser developer tools on a page with the extension loaded
2. Load the test files and run:
```javascript
const tests = new PIIExtensionTests();
tests.runAllTests();
```

## Supported PII Types

- **Names**: Person names (First Last format)
- **Email Addresses**: Standard email format validation
- **Phone Numbers**: US format with various separators
- **Social Security Numbers**: XXX-XX-XXXX format
- **Credit Card Numbers**: Major card formats with Luhn validation
- **Dates**: Various date formats
- **Addresses**: Street addresses (partial support)

## Example Usage

**Input Text:**
```
Hi, I'm John Smith. My email is john.smith@email.com and my phone is (555) 123-4567.
```

**Tokenized (sent to ChatGPT):**
```
Hi, I'm <name>NM8K4L</name>. My email is <email>EM9X2P</email> and my phone is <phone>PH7M5N</phone>.
```

**AI Response (with tokens):**
```
Hello <name>NM8K4L</name>! I can help you with that. Feel free to reach out at <email>EM9X2P</email>.
```

**Final Display (detokenized):**
```
Hello John Smith! I can help you with that. Feel free to reach out at john.smith@email.com.
```

## Limitations

- Currently only supports ChatGPT (chatgpt.com)
- Pattern-based detection may have false positives/negatives
- Requires JavaScript enabled
- Works only with Manifest V3 compatible Chrome versions

## Privacy

This extension is designed with privacy as the top priority:
- No data collection or analytics
- No network requests made by the extension
- All processing happens locally
- No PII stored persistently
- Token mappings cleared on session end

## Contributing

This is a proof-of-concept implementation. For production use, consider:
- Integrating Microsoft Presidio for improved PII detection
- Adding support for more chat platforms
- Implementing user-configurable PII types
- Adding enterprise policy controls
- Comprehensive security audit

## License

This project is provided as-is for educational and research purposes.