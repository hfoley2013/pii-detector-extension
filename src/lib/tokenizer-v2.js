/**
 * PIITokenizer V2 - Format-Preserving Tokenization
 *
 * A sophisticated tokenizer that:
 * 1. Preserves the format of PII (SSN hyphens, phone parentheses, etc.)
 * 2. Uses cryptographic FPE for secure, reversible tokenization
 * 3. Wraps tokens in semantic XML tags
 *
 * Example:
 *   Input:  "My SSN is 123-45-6789"
 *   Output: "My SSN is <ssn charset="numeric">847-29-3156</ssn>"
 */

class PIITokenizerV2 {
  /**
   * Create a new V2 tokenizer instance
   * @param {Object} options - Configuration options
   * @param {boolean} [options.formatPreserving=true] - Enable format preservation
   */
  constructor(options = {}) {
    this.options = {
      formatPreserving: true,
      ...options,
    };

    // Core FPE components
    this.keyManager = new FPEKeyManager();
    this.fpe = null; // Initialized async
    this.formatParser = new FormatParser();
    this.collisionRegistry = new CollisionRegistry();

    // Mapping storage (for detokenization)
    this.tokenMappings = new Map(); // compositeKey → xmlToken
    this.reverseTokenMappings = new Map(); // xmlToken → originalValue

    // Initialization state
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the tokenizer (must be called before use)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  async _doInitialize() {
    await this.keyManager.initialize();
    this.fpe = new FeistelFPE(this.keyManager);
    this.initialized = true;
    console.log(
      "🔐 PIITokenizerV2: Initialized with session",
      this.keyManager.getKeyInfo().sessionId,
    );
  }

  /**
   * Ensure tokenizer is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate a format-preserving token for a PII value
   *
   * @param {string} piiValue - The original PII value
   * @param {string} piiType - Type of PII (ssn, email, phone, etc.)
   * @param {Object} [options] - Tokenization options
   * @param {string} [options.charset] - Override charset (numeric, alpha, alphanumeric)
   * @returns {Promise<string>} XML-tagged token
   */
  async generateToken(piiValue, piiType, options = {}) {
    await this.ensureInitialized();

    // Create composite key for caching
    const compositeKey = `${piiType}:${piiValue}`;

    // Check cache first
    if (this.tokenMappings.has(compositeKey)) {
      return this.tokenMappings.get(compositeKey);
    }

    // Parse the format
    const parsed = this.formatParser.parse(piiValue, piiType);

    // Determine alphabet
    const charsetKey =
      options.charset ||
      this.formatParser.determineAlphabet(parsed.content, piiType);
    const alphabet = getAlphabet(piiType, charsetKey);

    // Generate tweak for this entity
    const tweak = this.keyManager.generateTweak(piiType, piiValue);

    // Encrypt the content (format-preserving)
    let encryptedContent;
    try {
      encryptedContent = await this.fpe.encrypt(
        parsed.content,
        alphabet,
        tweak,
      );
    } catch (error) {
      // If content has characters not in alphabet, fall back to transliteration
      console.warn(
        "🔐 FPE: Alphabet mismatch, using transliteration for",
        piiType,
      );
      encryptedContent = this.transliterateContent(parsed.content, alphabet);
    }

    // Reconstruct with original format (hyphens, spaces, etc.)
    const formattedToken = this.formatParser.reconstruct(
      encryptedContent,
      parsed,
    );

    // Register with collision detection
    const registration = this.collisionRegistry.register(
      formattedToken,
      piiValue,
      piiType,
    );
    const finalTokenContent = registration.token;

    // Create XML tag
    const xmlToken = `<${piiType} charset="${charsetKey.toLowerCase()}">${finalTokenContent}</${piiType}>`;

    // Store mappings for detokenization
    this.tokenMappings.set(compositeKey, xmlToken);
    this.reverseTokenMappings.set(xmlToken, piiValue);

    // Also store the inner token for partial matching
    this.reverseTokenMappings.set(finalTokenContent, piiValue);

    return xmlToken;
  }

  /**
   * Transliterate content to target alphabet when direct encryption fails
   * Used as fallback when content contains chars not in alphabet
   *
   * @param {string} content - Content to transliterate
   * @param {string} alphabet - Target alphabet
   * @returns {string} Transliterated content
   */
  transliterateContent(content, alphabet) {
    let result = "";
    const radix = alphabet.length;

    for (let i = 0; i < content.length; i++) {
      const charCode = content.charCodeAt(i);
      // Map character code to alphabet index
      const index = charCode % radix;
      result += alphabet[index];
    }

    return result;
  }

  /**
   * Tokenize text containing multiple PII entities
   *
   * @param {string} text - Full text to tokenize
   * @param {Array} piiEntities - Array of detected PII entities
   * @returns {Promise<string>} Tokenized text
   */
  async tokenizeText(text, piiEntities) {
    await this.ensureInitialized();

    if (!piiEntities || piiEntities.length === 0) {
      return text;
    }

    // Remove overlapping entities
    const cleanedEntities = this.removeOverlappingEntities(piiEntities);

    // Sort by position (right to left) to maintain string indices
    const sortedEntities = cleanedEntities.sort((a, b) => b.start - a.start);

    let tokenizedText = text;

    for (const entity of sortedEntities) {
      const originalValue = text.substring(entity.start, entity.end);
      const token = await this.generateToken(originalValue, entity.entity_type);

      tokenizedText =
        tokenizedText.substring(0, entity.start) +
        token +
        tokenizedText.substring(entity.end);
    }

    return tokenizedText;
  }

  /**
   * Remove overlapping entities, keeping higher-confidence ones
   *
   * @param {Array} entities - Array of PII entities
   * @returns {Array} Cleaned entities
   */
  removeOverlappingEntities(entities) {
    if (!entities || entities.length <= 1) {
      return entities;
    }

    const sorted = [...entities].sort((a, b) => a.start - b.start);
    const cleaned = [];

    for (const current of sorted) {
      let shouldInclude = true;

      for (let i = 0; i < cleaned.length; i++) {
        const accepted = cleaned[i];
        if (this.entitiesOverlap(current, accepted)) {
          if ((current.score || 0) > (accepted.score || 0)) {
            cleaned.splice(i, 1);
            i--;
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

  /**
   * Check if two entities overlap
   */
  entitiesOverlap(e1, e2) {
    return !(e1.end <= e2.start || e2.end <= e1.start);
  }

  /**
   * Detokenize text - replace tokens with original PII values
   *
   * @param {string} text - Text containing tokens
   * @returns {string} Detokenized text
   */
  detokenizeText(text) {
    if (!text) return text;

    // Pattern for XML tokens: <type charset="...">content</type>
    const xmlPattern =
      /<(ssn|email|phone|name|cc|address|date|url)(?:\s+[^>]*)?>([^<]+)<\/\1>/gi;

    return text.replace(xmlPattern, (match, type, content) => {
      // Try full match first
      if (this.reverseTokenMappings.has(match)) {
        return this.reverseTokenMappings.get(match);
      }
      // Try content only
      if (this.reverseTokenMappings.has(content)) {
        return this.reverseTokenMappings.get(content);
      }
      // Try collision registry
      const lookup = this.collisionRegistry.lookup(content);
      if (lookup) {
        return lookup.value;
      }
      return match;
    });
  }

  /**
   * Extract all tokens from text
   *
   * @param {string} text - Text to search
   * @returns {Array} Array of token objects
   */
  extractTokens(text) {
    const tokens = [];

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

  /**
   * Clear all token mappings and reset
   */
  async clearTokenMappings() {
    this.tokenMappings.clear();
    this.reverseTokenMappings.clear();
    this.collisionRegistry.clear();

    // Optionally rotate key for new session
    if (this.keyManager.initialized) {
      await this.keyManager.rotateKey();
    }

    console.log("🔐 PIITokenizerV2: Mappings cleared, key rotated");
  }

  /**
   * Get tokenizer statistics
   *
   * @returns {Object} Statistics object
   */
  getTokenMappingStats() {
    return {
      totalMappings: this.tokenMappings.size,
      version: "v2",
      algorithm: "Feistel-HMAC-SHA256",
      formatPreserving: this.options.formatPreserving,
      keyInfo: this.keyManager.getKeyInfo(),
      collisionStats: this.collisionRegistry.getStats(),
    };
  }

  /**
   * Destroy the tokenizer and clear sensitive data
   */
  destroy() {
    this.tokenMappings.clear();
    this.reverseTokenMappings.clear();
    this.collisionRegistry.clear();
    this.keyManager.destroy();
    this.initialized = false;
    console.log("🔐 PIITokenizerV2: Destroyed");
  }
}

// Export for browser environment
if (typeof window !== "undefined") {
  window.PIITokenizerV2 = PIITokenizerV2;
  console.log("🔐 PIITokenizerV2: Module loaded");
}
