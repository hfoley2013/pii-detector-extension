/**
 * Key Manager for Format-Preserving Encryption
 *
 * Handles cryptographic key generation and tweak creation using the Web Crypto API.
 * Keys are session-scoped and never persisted to storage.
 */

class FPEKeyManager {
  constructor() {
    this.sessionKey = null;
    this.rawKeyBytes = null;
    this.sessionId = null;
    this.keyCreatedAt = null;
    this.initialized = false;
  }

  /**
   * Initialize the key manager with a new session key
   * Must be called before any encryption/decryption operations
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    // Generate 256-bit (32 byte) random key material
    this.rawKeyBytes = crypto.getRandomValues(new Uint8Array(32));

    // Generate a unique session ID for this instance
    this.sessionId = this.generateSessionId();

    // Import key for HMAC operations using Web Crypto API
    this.sessionKey = await crypto.subtle.importKey(
      'raw',
      this.rawKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,  // not extractable - security measure
      ['sign']
    );

    this.keyCreatedAt = Date.now();
    this.initialized = true;

    console.log('🔐 FPE: Key manager initialized with session:', this.sessionId.substring(0, 8) + '...');
  }

  /**
   * Generate a unique session identifier
   * @returns {string} Random session ID
   */
  generateSessionId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Ensure the key manager is initialized
   * @throws {Error} If not initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('FPEKeyManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Get the HMAC key for Feistel round operations
   * @returns {CryptoKey} The session HMAC key
   */
  getKey() {
    this.ensureInitialized();
    return this.sessionKey;
  }

  /**
   * Generate a tweak (context parameter) for a specific PII entity
   *
   * The tweak ensures that:
   * 1. Same PII value with different types produces different tokens
   * 2. Same PII in different sessions produces different tokens
   *
   * Format: [piiType(4 bytes)][entityHash(4 bytes)][sessionPrefix(8 bytes)]
   *
   * @param {string} piiType - Type of PII (ssn, email, phone, etc.)
   * @param {string} entityValue - The actual PII value being tokenized
   * @returns {Uint8Array} 16-byte tweak value
   */
  generateTweak(piiType, entityValue) {
    this.ensureInitialized();

    const encoder = new TextEncoder();

    // PII type identifier (4 bytes, padded/truncated)
    const typeBytes = new Uint8Array(4);
    const typeEncoded = encoder.encode(piiType.toLowerCase().padEnd(4).slice(0, 4));
    typeBytes.set(typeEncoded);

    // Entity value hash (4 bytes)
    const entityHash = this.hashToBytes(entityValue, 4);

    // Session prefix (8 bytes from session ID)
    const sessionBytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      sessionBytes[i] = parseInt(this.sessionId.slice(i * 2, i * 2 + 2), 16);
    }

    // Combine into 16-byte tweak
    const tweak = new Uint8Array(16);
    tweak.set(typeBytes, 0);
    tweak.set(entityHash, 4);
    tweak.set(sessionBytes, 8);

    return tweak;
  }

  /**
   * Hash a string to a fixed number of bytes
   * Uses a simple but effective hash for non-cryptographic purposes
   * (The actual security comes from HMAC-SHA256 in the Feistel rounds)
   *
   * @param {string} str - String to hash
   * @param {number} numBytes - Number of bytes to produce
   * @returns {Uint8Array} Hash bytes
   */
  hashToBytes(str, numBytes) {
    const result = new Uint8Array(numBytes);

    // DJB2 hash variant
    let hash1 = 5381;
    let hash2 = 52711;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash1 = ((hash1 << 5) + hash1) ^ char;
      hash2 = ((hash2 << 5) + hash2) ^ char;
    }

    // Spread hash values across result bytes
    for (let i = 0; i < numBytes; i++) {
      if (i % 2 === 0) {
        result[i] = (hash1 >> ((i / 2) * 8)) & 0xff;
      } else {
        result[i] = (hash2 >> (((i - 1) / 2) * 8)) & 0xff;
      }
    }

    return result;
  }

  /**
   * Compute HMAC-SHA256 for Feistel round function
   *
   * @param {Uint8Array} data - Data to authenticate
   * @returns {Promise<Uint8Array>} HMAC result (32 bytes)
   */
  async hmac(data) {
    this.ensureInitialized();

    const signature = await crypto.subtle.sign('HMAC', this.sessionKey, data);
    return new Uint8Array(signature);
  }

  /**
   * Get key statistics for debugging
   * @returns {Object} Key info (without exposing actual key material)
   */
  getKeyInfo() {
    return {
      initialized: this.initialized,
      sessionId: this.sessionId ? this.sessionId.substring(0, 8) + '...' : null,
      keyCreatedAt: this.keyCreatedAt,
      keyAgeMs: this.keyCreatedAt ? Date.now() - this.keyCreatedAt : null
    };
  }

  /**
   * Rotate the session key (generate new key and session)
   * Useful for long-running sessions where key rotation is desired
   * @returns {Promise<void>}
   */
  async rotateKey() {
    console.log('🔐 FPE: Rotating session key...');
    this.initialized = false;
    this.sessionKey = null;
    this.rawKeyBytes = null;
    await this.initialize();
  }

  /**
   * Clear all key material from memory
   * Should be called when the session ends
   */
  destroy() {
    if (this.rawKeyBytes) {
      // Overwrite key material before clearing reference
      crypto.getRandomValues(this.rawKeyBytes);
    }
    this.sessionKey = null;
    this.rawKeyBytes = null;
    this.sessionId = null;
    this.keyCreatedAt = null;
    this.initialized = false;
    console.log('🔐 FPE: Key manager destroyed');
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.FPEKeyManager = FPEKeyManager;
  console.log('🔐 FPE: Key manager module loaded');
}
