/**
 * Feistel-based Format-Preserving Encryption (FPE)
 *
 * Implements a 10-round Feistel network using HMAC-SHA256 as the round function.
 * This provides format-preserving encryption where:
 * - Output has the same length as input
 * - Output uses only characters from the specified alphabet
 * - Encryption is reversible (decrypt returns original)
 *
 * Based on the principles of NIST FF1 but using HMAC-SHA256 instead of AES
 * to avoid patent concerns and simplify browser implementation.
 */

class FeistelFPE {
  /**
   * Create a new Feistel FPE instance
   * @param {FPEKeyManager} keyManager - Key manager instance for cryptographic operations
   */
  constructor(keyManager) {
    this.keyManager = keyManager;
    this.rounds = 10;  // Number of Feistel rounds (same as FF1)
  }

  /**
   * Encrypt plaintext using format-preserving encryption
   *
   * @param {string} plaintext - Text to encrypt (must contain only alphabet characters)
   * @param {string} alphabet - Character set for encryption
   * @param {Uint8Array} tweak - Context parameter (from keyManager.generateTweak)
   * @returns {Promise<string>} Encrypted text (same length, same alphabet)
   */
  async encrypt(plaintext, alphabet, tweak) {
    if (!plaintext || plaintext.length === 0) {
      return plaintext;
    }

    // Validate all characters are in alphabet
    for (const char of plaintext) {
      if (!alphabet.includes(char)) {
        throw new Error(`Character '${char}' not in alphabet`);
      }
    }

    const radix = alphabet.length;
    const n = plaintext.length;

    // Convert plaintext to array of indices
    let indices = this.stringToIndices(plaintext, alphabet);

    // Split into left and right halves
    // For odd length, left gets the extra character
    const mid = Math.ceil(n / 2);
    let left = indices.slice(0, mid);
    let right = indices.slice(mid);

    // Perform Feistel rounds
    for (let round = 0; round < this.rounds; round++) {
      const roundOutput = await this.roundFunction(right, tweak, round, radix, left.length);

      // newLeft = right
      // newRight = (left + F(right)) mod radix
      const newLeft = right.slice();
      const newRight = this.addModular(left, roundOutput, radix);

      left = newLeft;
      right = newRight;
    }

    // Combine halves back together
    const resultIndices = [...left, ...right];

    // Convert back to string
    return this.indicesToString(resultIndices, alphabet);
  }

  /**
   * Decrypt ciphertext using format-preserving encryption
   *
   * @param {string} ciphertext - Text to decrypt
   * @param {string} alphabet - Character set used for encryption
   * @param {Uint8Array} tweak - Same tweak used for encryption
   * @returns {Promise<string>} Decrypted plaintext
   */
  async decrypt(ciphertext, alphabet, tweak) {
    if (!ciphertext || ciphertext.length === 0) {
      return ciphertext;
    }

    const radix = alphabet.length;
    const n = ciphertext.length;

    // Convert to indices
    let indices = this.stringToIndices(ciphertext, alphabet);

    // Split into halves (same split as encryption)
    const mid = Math.ceil(n / 2);
    let left = indices.slice(0, mid);
    let right = indices.slice(mid);

    // Reverse Feistel rounds (iterate backwards)
    for (let round = this.rounds - 1; round >= 0; round--) {
      const roundOutput = await this.roundFunction(left, tweak, round, radix, right.length);

      // Reverse the Feistel step
      // newRight = left
      // newLeft = (right - F(left)) mod radix
      const newRight = left.slice();
      const newLeft = this.subtractModular(right, roundOutput, radix);

      left = newLeft;
      right = newRight;
    }

    // Combine and convert back
    const resultIndices = [...left, ...right];
    return this.indicesToString(resultIndices, alphabet);
  }

  /**
   * Feistel round function using HMAC-SHA256
   *
   * @param {number[]} input - Right half indices
   * @param {Uint8Array} tweak - Tweak bytes
   * @param {number} round - Round number (0-9)
   * @param {number} radix - Alphabet size
   * @param {number} outputLength - Required output length
   * @returns {Promise<number[]>} Round function output as indices
   */
  async roundFunction(input, tweak, round, radix, outputLength) {
    // Construct input to HMAC: tweak || round || input_bytes
    const inputBytes = new Uint8Array(input);
    const data = new Uint8Array(tweak.length + 1 + inputBytes.length);
    data.set(tweak, 0);
    data[tweak.length] = round;
    data.set(inputBytes, tweak.length + 1);

    // Compute HMAC-SHA256
    const hmacResult = await this.keyManager.hmac(data);

    // Map HMAC bytes to alphabet indices
    // Use multiple bytes per index for better distribution
    const output = [];
    for (let i = 0; i < outputLength; i++) {
      // Use 2 bytes per index for better randomness (handles radix up to 65536)
      const byteIndex = (i * 2) % hmacResult.length;
      const value = (hmacResult[byteIndex] << 8) | hmacResult[(byteIndex + 1) % hmacResult.length];
      output.push(value % radix);
    }

    return output;
  }

  /**
   * Convert string to array of alphabet indices
   * @param {string} str - Input string
   * @param {string} alphabet - Alphabet to use
   * @returns {number[]} Array of indices
   */
  stringToIndices(str, alphabet) {
    return str.split('').map(char => alphabet.indexOf(char));
  }

  /**
   * Convert array of indices to string
   * @param {number[]} indices - Array of alphabet indices
   * @param {string} alphabet - Alphabet to use
   * @returns {string} Resulting string
   */
  indicesToString(indices, alphabet) {
    return indices.map(i => alphabet[i]).join('');
  }

  /**
   * Element-wise modular addition of two arrays
   * @param {number[]} a - First array
   * @param {number[]} b - Second array
   * @param {number} modulus - Modulus value
   * @returns {number[]} Result array
   */
  addModular(a, b, modulus) {
    const result = [];
    const maxLen = Math.max(a.length, b.length);

    for (let i = 0; i < maxLen; i++) {
      const aVal = i < a.length ? a[i] : 0;
      const bVal = i < b.length ? b[i] : 0;
      result.push((aVal + bVal) % modulus);
    }

    return result;
  }

  /**
   * Element-wise modular subtraction of two arrays
   * @param {number[]} a - First array
   * @param {number[]} b - Second array (to subtract)
   * @param {number} modulus - Modulus value
   * @returns {number[]} Result array
   */
  subtractModular(a, b, modulus) {
    const result = [];
    const maxLen = Math.max(a.length, b.length);

    for (let i = 0; i < maxLen; i++) {
      const aVal = i < a.length ? a[i] : 0;
      const bVal = i < b.length ? b[i] : 0;
      // Add modulus before subtraction to handle negative results
      result.push(((aVal - bVal) % modulus + modulus) % modulus);
    }

    return result;
  }

  /**
   * Validate that a string only contains characters from the alphabet
   * @param {string} str - String to validate
   * @param {string} alphabet - Alphabet to check against
   * @returns {boolean} True if all characters are in alphabet
   */
  validateString(str, alphabet) {
    for (const char of str) {
      if (!alphabet.includes(char)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get encryption statistics for debugging
   * @returns {Object} Algorithm info
   */
  getInfo() {
    return {
      algorithm: 'Feistel-HMAC-SHA256',
      rounds: this.rounds,
      roundFunction: 'HMAC-SHA256'
    };
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.FeistelFPE = FeistelFPE;
  console.log('🔐 FPE: Feistel encryption module loaded');
}
