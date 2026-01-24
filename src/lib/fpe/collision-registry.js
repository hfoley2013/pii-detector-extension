/**
 * Collision Registry for Format-Preserving Tokenization
 *
 * Tracks all tokens generated in a session to:
 * 1. Detect potential collisions (different PII → same token)
 * 2. Ensure idempotency (same PII → same token)
 * 3. Provide disambiguation when collisions occur
 *
 * With proper FPE, collisions should be cryptographically unlikely,
 * but this provides a defensive safety net.
 */

class CollisionRegistry {
  constructor() {
    // Map: token → original PII value
    this.tokenToOriginal = new Map();

    // Map: original PII value → token (for idempotency)
    this.originalToToken = new Map();

    // Map: token base → disambiguation counter
    this.disambiguationCounters = new Map();

    // Statistics
    this.stats = {
      totalRegistrations: 0,
      collisionsDetected: 0,
      collisionsResolved: 0
    };
  }

  /**
   * Register a token-to-original mapping
   *
   * @param {string} token - The generated token (without XML tags)
   * @param {string} originalValue - The original PII value
   * @param {string} piiType - Type of PII
   * @returns {Object} Registration result with final token
   */
  register(token, originalValue, piiType) {
    this.stats.totalRegistrations++;

    // Create a canonical key for the original value (includes type for cross-type safety)
    const originalKey = `${piiType}:${originalValue}`;

    // Check for idempotency - same original should return same token
    if (this.originalToToken.has(originalKey)) {
      const existingToken = this.originalToToken.get(originalKey);
      return {
        token: existingToken,
        wasExisting: true,
        collision: false
      };
    }

    // Check for collision - different original producing same token
    if (this.tokenToOriginal.has(token)) {
      const existingOriginalKey = this.tokenToOriginal.get(token);

      if (existingOriginalKey !== originalKey) {
        // Collision detected! Different originals produced same token
        this.stats.collisionsDetected++;

        const disambiguatedToken = this.disambiguate(token, piiType);
        this.stats.collisionsResolved++;

        // Register the disambiguated token
        this.tokenToOriginal.set(disambiguatedToken, originalKey);
        this.originalToToken.set(originalKey, disambiguatedToken);

        console.warn('🔐 FPE: Collision detected and resolved:', {
          originalToken: token,
          resolvedToken: disambiguatedToken,
          piiType: piiType
        });

        return {
          token: disambiguatedToken,
          wasExisting: false,
          collision: true,
          originalToken: token
        };
      }
    }

    // No collision - register normally
    this.tokenToOriginal.set(token, originalKey);
    this.originalToToken.set(originalKey, token);

    return {
      token: token,
      wasExisting: false,
      collision: false
    };
  }

  /**
   * Disambiguate a colliding token by appending a counter
   *
   * @param {string} token - The colliding token
   * @param {string} piiType - Type of PII
   * @returns {string} Disambiguated token
   */
  disambiguate(token, piiType) {
    // Get or initialize counter for this token base
    const counter = this.disambiguationCounters.get(token) || 1;
    this.disambiguationCounters.set(token, counter + 1);

    // Append counter suffix
    // Use a format that's unlikely to collide with normal tokens
    let disambiguated = `${token}~${counter}`;

    // Ensure the disambiguated token is also unique
    while (this.tokenToOriginal.has(disambiguated)) {
      this.disambiguationCounters.set(token, counter + 1);
      disambiguated = `${token}~${this.disambiguationCounters.get(token)}`;
    }

    return disambiguated;
  }

  /**
   * Look up the original value for a token
   *
   * @param {string} token - Token to look up
   * @returns {Object|null} Original value info or null if not found
   */
  lookup(token) {
    const originalKey = this.tokenToOriginal.get(token);

    if (!originalKey) {
      return null;
    }

    // Parse the original key back into type and value
    const colonIndex = originalKey.indexOf(':');
    if (colonIndex === -1) {
      return { value: originalKey, type: 'unknown' };
    }

    return {
      type: originalKey.substring(0, colonIndex),
      value: originalKey.substring(colonIndex + 1)
    };
  }

  /**
   * Look up the token for an original value
   *
   * @param {string} originalValue - Original PII value
   * @param {string} piiType - Type of PII
   * @returns {string|null} Token or null if not registered
   */
  lookupByOriginal(originalValue, piiType) {
    const originalKey = `${piiType}:${originalValue}`;
    return this.originalToToken.get(originalKey) || null;
  }

  /**
   * Check if a token exists in the registry
   *
   * @param {string} token - Token to check
   * @returns {boolean} True if token is registered
   */
  hasToken(token) {
    return this.tokenToOriginal.has(token);
  }

  /**
   * Check if an original value has been tokenized
   *
   * @param {string} originalValue - Original value to check
   * @param {string} piiType - Type of PII
   * @returns {boolean} True if original has been tokenized
   */
  hasOriginal(originalValue, piiType) {
    const originalKey = `${piiType}:${originalValue}`;
    return this.originalToToken.has(originalKey);
  }

  /**
   * Get all registered tokens
   *
   * @returns {string[]} Array of all tokens
   */
  getAllTokens() {
    return Array.from(this.tokenToOriginal.keys());
  }

  /**
   * Get registry statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      registeredTokens: this.tokenToOriginal.size,
      registeredOriginals: this.originalToToken.size,
      collisionRate: this.stats.totalRegistrations > 0
        ? (this.stats.collisionsDetected / this.stats.totalRegistrations * 100).toFixed(4) + '%'
        : '0%'
    };
  }

  /**
   * Clear all registrations
   * Useful when starting a new session
   */
  clear() {
    this.tokenToOriginal.clear();
    this.originalToToken.clear();
    this.disambiguationCounters.clear();
    this.stats = {
      totalRegistrations: 0,
      collisionsDetected: 0,
      collisionsResolved: 0
    };
    console.log('🔐 FPE: Collision registry cleared');
  }

  /**
   * Export registry state for debugging
   *
   * @returns {Object} Serializable registry state
   */
  exportState() {
    return {
      tokenCount: this.tokenToOriginal.size,
      stats: this.getStats(),
      // Don't export actual mappings for security
      hasCollisions: this.stats.collisionsDetected > 0
    };
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.CollisionRegistry = CollisionRegistry;
  console.log('🔐 FPE: Collision registry module loaded');
}
