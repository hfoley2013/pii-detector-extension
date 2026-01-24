class PIIExtensionBackground {
  constructor() {
    this.tokenizer = null;
    this.detector = null;
    this.tabStates = new Map();
    this.initialize();
  }

  initialize() {
    console.log("PII Extension Background Script initializing...");

    this.setupMessageListeners();
    this.setupTabListeners();
    this.initializeServices();

    console.log("PII Extension Background Script initialized");
  }

  initializeServices() {
    try {
      // Background script doesn't have access to content script classes
      // We'll initialize them lazily when needed
      this.tokenizer = null;
      this.detector = null;
      console.log(
        "PII services will be initialized when needed (background script limitation)",
      );
    } catch (error) {
      console.error("Failed to initialize PII services:", error);
    }
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Background: Message listener called");
      this.handleMessage(message, sender, sendResponse);
      return true; // Always return true to indicate async response
    });
  }

  setupTabListeners() {
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTabState(tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (
        changeInfo.status === "complete" &&
        (tab.url?.includes("chatgpt.com") ||
          tab.url?.includes("gemini.google.com"))
      ) {
        this.initializeTabState(tabId);
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    console.log(
      "🔒 🔒 🔒 BACKGROUND: Received message:",
      message.action,
      "from tab:",
      sender.tab?.id,
    );
    console.log("🔒 Message content:", message);

    const tabId = sender.tab?.id || "unknown";

    switch (message.action) {
      case "tokenizeText":
        console.log(
          "🔒 BACKGROUND: Starting tokenization for text length:",
          message.text?.length,
        );
        this.tokenizeText(message.text, tabId)
          .then((result) => {
            console.log("🔒 🔒 🔒 BACKGROUND: Tokenization result:", result);
            sendResponse(result);
          })
          .catch((error) => {
            console.error("Background: Error tokenizing text:", error);
            sendResponse({
              tokenizedText: message.text,
              piiDetected: false,
              error: error.message,
            });
          });
        return true;

      case "detokenizeText":
        this.detokenizeText(message.text, tabId)
          .then((result) => sendResponse(result))
          .catch((error) => {
            console.error("Background: Error detokenizing text:", error);
            sendResponse({
              detokenizedText: message.text,
              tokensFound: false,
              error: error.message,
            });
          });
        return true;

      case "contentScriptReady":
        this.initializeTabState(tabId);
        console.log("Background: Tab state initialized for:", tabId);
        sendResponse({ success: true });
        return true;

      case "getExtensionStatus":
        // If called from popup, get the active tab ID
        if (!sender.tab) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              const activeTabId = tabs[0].id;
              const status = this.getExtensionStatus(activeTabId);
              console.log(
                "Background: Extension status for active tab",
                activeTabId,
                ":",
                status,
              );
              sendResponse(status);
            } else {
              sendResponse({ isActive: false, error: "No active tab found" });
            }
          });
          return true;
        } else {
          const status = this.getExtensionStatus(tabId);
          console.log(
            "Background: Extension status for tab",
            tabId,
            ":",
            status,
          );
          sendResponse(status);
          return true;
        }

      case "clearTokenMappings":
        // If called from popup, get the active tab ID
        if (!sender.tab) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              const activeTabId = tabs[0].id;
              this.clearTokenMappings(activeTabId);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: "No active tab found" });
            }
          });
          return true;
        } else {
          this.clearTokenMappings(tabId);
          sendResponse({ success: true });
          return true;
        }

      case "recordPiiDetection":
        console.log("🔒 🔒 🔒 BACKGROUND: Recording PII detection stats:", {
          count: message.piiCount,
          types: message.piiTypes,
          method: message.detectionMethod,
        });

        // Update tab state with detection stats
        this.updateTabState(tabId, {
          lastTokenization: Date.now(),
          piiDetectedCount:
            (this.tabStates.get(tabId)?.piiDetectedCount || 0) +
            message.piiCount,
          lastPiiTypes: message.piiTypes,
          lastDetectionMethod: message.detectionMethod,
        });

        this.updateExtensionIcon(tabId, "active");
        sendResponse({ success: true, recorded: true });
        return true;

      default:
        console.log("Background: Unknown action:", message.action);
        sendResponse({ error: "Unknown action" });
        return true;
    }
  }

  async tokenizeText(text, tabId) {
    if (!text || typeof text !== "string") {
      return { tokenizedText: text, piiDetected: false };
    }

    try {
      const piiEntities = await this.detectPII(text);

      if (piiEntities.length === 0) {
        return { tokenizedText: text, piiDetected: false };
      }

      const tokenizer = this.getTabTokenizer(tabId);
      const tokenizedText = tokenizer.tokenizeText(text, piiEntities);

      this.updateTabState(tabId, {
        lastTokenization: Date.now(),
        piiDetectedCount: piiEntities.length,
        lastPiiTypes: piiEntities.map((e) => e.entity_type),
      });

      this.updateExtensionIcon(tabId, "active");

      return {
        tokenizedText,
        piiDetected: true,
        piiCount: piiEntities.length,
        piiTypes: piiEntities.map((e) => e.entity_type),
      };
    } catch (error) {
      console.error("Error tokenizing text:", error);
      this.updateExtensionIcon(tabId, "error");
      return { tokenizedText: text, piiDetected: false, error: error.message };
    }
  }

  async detokenizeText(text, tabId) {
    if (!text || typeof text !== "string") {
      return { detokenizedText: text, tokensFound: false };
    }

    try {
      const tokenizer = this.getTabTokenizer(tabId);
      const tokens = tokenizer.extractTokens(text);

      if (tokens.length === 0) {
        return { detokenizedText: text, tokensFound: false };
      }

      const detokenizedText = tokenizer.detokenizeText(text);

      this.updateTabState(tabId, {
        lastDetokenization: Date.now(),
        tokensReplacedCount: tokens.length,
      });

      return {
        detokenizedText,
        tokensFound: true,
        tokenCount: tokens.length,
        tokenTypes: tokens.map((t) => t.type),
      };
    } catch (error) {
      console.error("Error detokenizing text:", error);
      return {
        detokenizedText: text,
        tokensFound: false,
        error: error.message,
      };
    }
  }

  async detectPII(text) {
    try {
      // Background script uses simple regex patterns
      // The real detection happens in content script
      console.log(
        "Background: Using simple regex patterns (content script handles advanced detection)",
      );

      if (!this.detector) {
        this.detector = this.createSimpleDetector();
      }

      const results = await this.detector.analyzePII(text);
      console.log("Background: PII detection results:", {
        count: results.length,
        method: "background_regex",
        entities: results.map((r) => r.entity_type),
      });

      return results;
    } catch (error) {
      console.error("PII detection error:", error);
      return [];
    }
  }

  createSimpleDetector() {
    return {
      async analyzePII(text) {
        const entities = [];
        const patterns = {
          email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          phone:
            /(?:\+?1[-.\\s]?)?\(?([0-9]{3})\)?[-.\\s]?([0-9]{3})[-.\\s]?([0-9]{4})\b/g,
          name: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g,
        };

        for (const [type, regex] of Object.entries(patterns)) {
          const matches = [...text.matchAll(regex)];
          for (const match of matches) {
            entities.push({
              entity_type: type,
              start: match.index,
              end: match.index + match[0].length,
              score: 0.8,
              text: match[0],
              detection_method: "background_regex",
            });
          }
        }

        return entities.sort((a, b) => a.start - b.start);
      },
    };
  }

  createSimpleTokenizer() {
    return {
      tokenMappings: new Map(),
      reverseTokenMappings: new Map(),
      sessionId: Math.random().toString(36).substring(2, 15),

      generateToken(piiValue, piiType) {
        const key = `${piiType}:${piiValue}:${this.sessionId}`;

        if (this.tokenMappings.has(key)) {
          return this.tokenMappings.get(key);
        }

        // Generate format-preserving token content
        const tokenContent = this.generateTokenContent(piiValue, piiType);
        const charset = this.detectCharset(piiValue);
        const token = `<${piiType.toLowerCase()} charset="${charset}">${tokenContent}</${piiType.toLowerCase()}>`;

        this.tokenMappings.set(key, token);
        this.reverseTokenMappings.set(token, piiValue);

        return token;
      },

      hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return Math.abs(hash);
      },

      detectCharset(value) {
        if (/^\d+$/.test(value.replace(/[\s\-\(\)\.]/g, ""))) {
          return "numeric";
        } else if (/^[a-zA-Z\s]+$/.test(value)) {
          return "alpha";
        }
        return "alphanumeric";
      },

      generateTokenContent(piiValue, piiType) {
        const hash = this.hashString(
          `${piiType}:${piiValue}:${this.sessionId}`,
        );
        const alphaChars =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        const numericChars = "0123456789";

        let result = "";
        let tempHash = hash;

        for (let i = 0; i < piiValue.length; i++) {
          const char = piiValue[i];
          if (/[\s\-\(\)\.\@]/.test(char)) {
            result += char;
          } else if (/\d/.test(char)) {
            result += numericChars[tempHash % numericChars.length];
            tempHash = Math.floor(tempHash / numericChars.length) || hash;
          } else if (/[a-z]/.test(char)) {
            result += alphaChars[(tempHash % 26) + 26];
            tempHash = Math.floor(tempHash / 26) || hash;
          } else if (/[A-Z]/.test(char)) {
            result += alphaChars[tempHash % 26];
            tempHash = Math.floor(tempHash / 26) || hash;
          } else {
            result += alphaChars[tempHash % alphaChars.length];
            tempHash = Math.floor(tempHash / alphaChars.length) || hash;
          }
        }

        return result;
      },

      tokenizeText(text, piiEntities) {
        if (!piiEntities || piiEntities.length === 0) {
          return text;
        }

        // Remove overlapping entities to prevent malformed tokens
        const cleanedEntities = this.removeOverlappingEntities(piiEntities);

        let tokenizedText = text;
        const sortedEntities = cleanedEntities.sort(
          (a, b) => b.start - a.start,
        );

        for (const entity of sortedEntities) {
          const originalValue = text.substring(entity.start, entity.end);
          const token = this.generateToken(originalValue, entity.entity_type);

          tokenizedText =
            tokenizedText.substring(0, entity.start) +
            token +
            tokenizedText.substring(entity.end);
        }

        return tokenizedText;
      },

      removeOverlappingEntities(entities) {
        if (!entities || entities.length <= 1) {
          return entities;
        }

        // Sort by start position
        const sorted = entities.sort((a, b) => a.start - b.start);
        const cleaned = [];

        for (let i = 0; i < sorted.length; i++) {
          const current = sorted[i];
          let shouldInclude = true;

          // Check if this entity overlaps with any already accepted entity
          for (const accepted of cleaned) {
            if (this.entitiesOverlap(current, accepted)) {
              // Keep the entity with higher confidence/score
              if ((current.score || 0.8) > (accepted.score || 0.8)) {
                // Remove the lower-scored entity and add current
                const index = cleaned.indexOf(accepted);
                cleaned.splice(index, 1);
              } else {
                shouldInclude = false;
              }
              break;
            }
          }

          if (shouldInclude) {
            cleaned.push(current);
          }
        }

        return cleaned;
      },

      entitiesOverlap(entity1, entity2) {
        return !(entity1.end <= entity2.start || entity2.end <= entity1.start);
      },

      clearTokenMappings() {
        this.tokenMappings.clear();
        this.reverseTokenMappings.clear();
        this.sessionId = Math.random().toString(36).substring(2, 15);
      },

      getTokenMappingStats() {
        return {
          totalMappings: this.tokenMappings.size,
          sessionId: this.sessionId,
        };
      },
    };
  }

  getTabTokenizer(tabId) {
    if (!this.tabStates.has(tabId)) {
      this.initializeTabState(tabId);
    }

    return this.tabStates.get(tabId).tokenizer;
  }

  initializeTabState(tabId) {
    if (!this.tabStates.has(tabId)) {
      this.tabStates.set(tabId, {
        tokenizer: this.createSimpleTokenizer(),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        piiDetectedCount: 0,
        tokensReplacedCount: 0,
        lastPiiTypes: [],
      });
    }

    this.updateExtensionIcon(tabId, "active");
  }

  updateTabState(tabId, updates) {
    if (this.tabStates.has(tabId)) {
      const state = this.tabStates.get(tabId);
      Object.assign(state, { ...updates, lastActivity: Date.now() });
    }
  }

  cleanupTabState(tabId) {
    if (this.tabStates.has(tabId)) {
      const state = this.tabStates.get(tabId);
      state.tokenizer?.clearTokenMappings();
      this.tabStates.delete(tabId);
    }
  }

  clearTokenMappings(tabId) {
    if (this.tabStates.has(tabId)) {
      const state = this.tabStates.get(tabId);
      state.tokenizer?.clearTokenMappings();
      state.piiDetectedCount = 0;
      state.tokensReplacedCount = 0;
      state.lastPiiTypes = [];
    }
  }

  getExtensionStatus(tabId) {
    const state = this.tabStates.get(tabId);

    return {
      isActive: !!state,
      tabId,
      stats: state
        ? {
            sessionDuration: Date.now() - state.createdAt,
            piiDetectedCount: state.piiDetectedCount,
            tokensReplacedCount: state.tokensReplacedCount,
            lastActivity: state.lastActivity,
            lastPiiTypes: state.lastPiiTypes,
            lastDetectionMethod: state.lastDetectionMethod || "unknown",
            tokenMappings: state.tokenizer?.getTokenMappingStats(),
          }
        : null,
    };
  }

  async updateExtensionIcon(tabId, status) {
    try {
      const iconPaths = {
        active: {
          16: "assets/icons/icon16.png",
          32: "assets/icons/icon32.png",
        },
        processing: {
          16: "assets/icons/icon16.png",
          32: "assets/icons/icon32.png",
        },
        error: {
          16: "assets/icons/icon16.png",
          32: "assets/icons/icon32.png",
        },
        inactive: {
          16: "assets/icons/icon16.png",
          32: "assets/icons/icon32.png",
        },
      };

      await chrome.action.setIcon({
        path: iconPaths[status] || iconPaths.inactive,
        tabId: tabId,
      });

      const titles = {
        active: "PII Protection Active",
        processing: "Processing PII...",
        error: "PII Protection Error",
        inactive: "PII Protection Inactive",
      };

      await chrome.action.setTitle({
        title: titles[status] || titles.inactive,
        tabId: tabId,
      });
    } catch (error) {
      console.log("Could not update extension icon:", error);
    }
  }

  cleanup() {
    for (const [tabId, state] of this.tabStates) {
      state.tokenizer?.clearTokenMappings();
    }
    this.tabStates.clear();
  }
}

class PIITokenizer {
  constructor() {
    this.tokenMappings = new Map();
    this.reverseTokenMappings = new Map();
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  generateToken(piiValue, piiType) {
    const key = `${piiType}:${piiValue}:${this.sessionId}`;

    if (this.tokenMappings.has(key)) {
      return this.tokenMappings.get(key);
    }

    // Generate format-preserving token content
    const tokenContent = this.generateTokenContent(piiValue, piiType);
    const charset = this.detectCharset(piiValue);
    const token = `<${piiType.toLowerCase()} charset="${charset}">${tokenContent}</${piiType.toLowerCase()}>`;

    this.tokenMappings.set(key, token);
    this.reverseTokenMappings.set(token, piiValue);

    return token;
  }

  detectCharset(value) {
    if (/^\d+$/.test(value.replace(/[\s\-\(\)\.]/g, ""))) {
      return "numeric";
    } else if (/^[a-zA-Z\s]+$/.test(value)) {
      return "alpha";
    }
    return "alphanumeric";
  }

  generateTokenContent(piiValue, piiType) {
    // Simple format-preserving replacement (background fallback)
    const hash = this.hashString(`${piiType}:${piiValue}:${this.sessionId}`);
    const alphaChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const numericChars = "0123456789";
    const alphanumericChars = alphaChars + numericChars;

    let result = "";
    let tempHash = hash;

    for (let i = 0; i < piiValue.length; i++) {
      const char = piiValue[i];
      // Preserve delimiters
      if (/[\s\-\(\)\.\@]/.test(char)) {
        result += char;
      } else if (/\d/.test(char)) {
        result += numericChars[tempHash % numericChars.length];
        tempHash = Math.floor(tempHash / numericChars.length) || hash;
      } else if (/[a-z]/.test(char)) {
        result += alphaChars[(tempHash % 26) + 26]; // lowercase
        tempHash = Math.floor(tempHash / 26) || hash;
      } else if (/[A-Z]/.test(char)) {
        result += alphaChars[tempHash % 26]; // uppercase
        tempHash = Math.floor(tempHash / 26) || hash;
      } else {
        result += alphanumericChars[tempHash % alphanumericChars.length];
        tempHash = Math.floor(tempHash / alphanumericChars.length) || hash;
      }
    }

    return result;
  }

  tokenizeText(text, piiEntities) {
    if (!piiEntities || piiEntities.length === 0) {
      return text;
    }

    // Remove overlapping entities to prevent malformed tokens
    const cleanedEntities = this.removeOverlappingEntities(piiEntities);

    let tokenizedText = text;
    const sortedEntities = cleanedEntities.sort((a, b) => b.start - a.start);

    for (const entity of sortedEntities) {
      const originalValue = text.substring(entity.start, entity.end);
      const token = this.generateToken(originalValue, entity.entity_type);

      tokenizedText =
        tokenizedText.substring(0, entity.start) +
        token +
        tokenizedText.substring(entity.end);
    }

    return tokenizedText;
  }

  removeOverlappingEntities(entities) {
    if (!entities || entities.length <= 1) {
      return entities;
    }

    // Sort by start position
    const sorted = entities.sort((a, b) => a.start - b.start);
    const cleaned = [];

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      let shouldInclude = true;

      // Check if this entity overlaps with any already accepted entity
      for (const accepted of cleaned) {
        if (this.entitiesOverlap(current, accepted)) {
          // Keep the entity with higher confidence/score
          if ((current.score || 0.8) > (accepted.score || 0.8)) {
            // Remove the lower-scored entity and add current
            const index = cleaned.indexOf(accepted);
            cleaned.splice(index, 1);
          } else {
            shouldInclude = false;
          }
          break;
        }
      }

      if (shouldInclude) {
        cleaned.push(current);
      }
    }

    return cleaned;
  }

  entitiesOverlap(entity1, entity2) {
    return !(entity1.end <= entity2.start || entity2.end <= entity1.start);
  }

  detokenizeText(text) {
    if (!text) return text;

    let detokenizedText = text;

    // XML format: <type charset="...">token</type>
    const xmlTokenPattern =
      /<(ssn|email|phone|name|cc|address|date|url)(?:\s+[^>]*)?>([^<]+)<\/\1>/gi;

    detokenizedText = detokenizedText.replace(
      xmlTokenPattern,
      (match, type, content) => {
        // Try full match first
        if (this.reverseTokenMappings.has(match)) {
          return this.reverseTokenMappings.get(match);
        }
        // Try content only
        if (this.reverseTokenMappings.has(content)) {
          return this.reverseTokenMappings.get(content);
        }
        return match;
      },
    );

    return detokenizedText;
  }

  extractTokens(text) {
    const tokens = [];

    // XML format
    const xmlPattern =
      /<(ssn|email|phone|name|cc|address|date|url)(?:\s+charset="([^"]*)")?[^>]*>([^<]+)<\/\1>/gi;
    let match;

    while ((match = xmlPattern.exec(text)) !== null) {
      tokens.push({
        token: match[0],
        type: match[1].toLowerCase(),
        charset: match[2] || "unknown",
        content: match[3],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return tokens;
  }

  clearTokenMappings() {
    this.tokenMappings.clear();
    this.reverseTokenMappings.clear();
    this.sessionId = this.generateSessionId();
  }

  getTokenMappingStats() {
    return {
      totalMappings: this.tokenMappings.size,
      sessionId: this.sessionId,
    };
  }
}

class PIIPatternDetector {
  constructor() {
    this.patterns = {
      email: {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        entity_type: "email",
      },
      phone: {
        regex:
          /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        entity_type: "phone",
      },
      ssn: {
        regex: /\b(?:\d{3}[-.\s]?\d{2}[-.\s]?\d{4}|\d{9})\b/g,
        entity_type: "ssn",
      },
      creditCard: {
        regex: /\b(?:\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}|\d{13,19})\b/g,
        entity_type: "cc",
      },
      name: {
        regex: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g,
        entity_type: "name",
      },
    };
  }

  async analyzePII(text) {
    const entities = [];

    for (const [patternName, patternConfig] of Object.entries(this.patterns)) {
      const matches = [...text.matchAll(patternConfig.regex)];

      for (const match of matches) {
        if (this.validateMatch(match[0], patternName)) {
          entities.push({
            entity_type: patternConfig.entity_type,
            start: match.index,
            end: match.index + match[0].length,
            score: 0.8,
            text: match[0],
          });
        }
      }
    }

    return this.removeDuplicates(entities);
  }

  validateMatch(matchText, patternType) {
    switch (patternType) {
      case "email":
        return matchText.includes("@") && matchText.includes(".");
      case "phone":
        const digits = matchText.replace(/\D/g, "");
        return digits.length === 10 || digits.length === 11;
      case "name":
        const words = matchText.trim().split(/\s+/);
        return words.length >= 2 && words.length <= 4;
      default:
        return true;
    }
  }

  removeDuplicates(entities) {
    return entities.sort((a, b) => a.start - b.start);
  }
}

const piiExtensionBackground = new PIIExtensionBackground();

chrome.runtime.onInstalled.addListener(() => {
  console.log("PII Tokenization Extension installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("PII Tokenization Extension started");
});
