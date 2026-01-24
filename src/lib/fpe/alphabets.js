/**
 * Alphabet definitions for Format-Preserving Encryption (FPE)
 *
 * Each alphabet defines a character set that tokens can use.
 * The FPE algorithm encrypts within these character boundaries,
 * ensuring output uses only characters from the specified alphabet.
 */

const ALPHABETS = {
  // Numeric only (0-9) - for SSN, phone, credit card, dates
  NUMERIC: '0123456789',

  // Lowercase letters only
  ALPHA_LOWER: 'abcdefghijklmnopqrstuvwxyz',

  // Uppercase letters only
  ALPHA_UPPER: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',

  // All letters (mixed case) - for names
  ALPHA: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',

  // Alphanumeric (letters + digits) - for emails, addresses
  ALPHANUMERIC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',

  // Extended alphanumeric with common symbols
  ALPHANUMERIC_EXTENDED: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-',

  // Latin-1 Supplement printable characters (per requirements: Latin + Latin-1 only)
  // ASCII 32-126 (printable) + select Latin-1 Supplement 160-255
  LATIN1_PRINTABLE: ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
};

/**
 * Default alphabet mapping for each PII type
 * Determines which character set to use when tokenizing each type
 */
const PII_ALPHABETS = {
  ssn: 'NUMERIC',
  phone: 'NUMERIC',
  cc: 'NUMERIC',
  date: 'NUMERIC',
  name: 'ALPHA',
  email: 'ALPHANUMERIC',
  address: 'ALPHANUMERIC',
  url: 'ALPHANUMERIC_EXTENDED'
};

/**
 * Characters that are preserved as-is during tokenization (delimiters)
 * These are not encrypted but maintain their position in the output
 */
const DELIMITER_CHARS = {
  ssn: ['-', '.', ' '],
  phone: ['-', '.', ' ', '(', ')', '+'],
  cc: ['-', ' '],
  date: ['-', '/', '.', ' ', ','],
  email: ['@', '.', '_', '-', '+'],
  name: [' ', '-', "'", '.'],
  address: [' ', ',', '.', '#', '-'],
  url: [':', '/', '.', '-', '_', '?', '=', '&', '#']
};

/**
 * Get the alphabet string for a given PII type
 * @param {string} piiType - The type of PII (ssn, email, phone, etc.)
 * @param {string} [override] - Optional alphabet override (NUMERIC, ALPHA, ALPHANUMERIC)
 * @returns {string} The alphabet string to use for encryption
 */
function getAlphabet(piiType, override = null) {
  if (override && ALPHABETS[override.toUpperCase()]) {
    return ALPHABETS[override.toUpperCase()];
  }

  const alphabetKey = PII_ALPHABETS[piiType.toLowerCase()] || 'ALPHANUMERIC';
  return ALPHABETS[alphabetKey];
}

/**
 * Get delimiter characters for a given PII type
 * @param {string} piiType - The type of PII
 * @returns {string[]} Array of delimiter characters
 */
function getDelimiters(piiType) {
  return DELIMITER_CHARS[piiType.toLowerCase()] || [];
}

/**
 * Check if a character is in the given alphabet
 * @param {string} char - Single character to check
 * @param {string} alphabet - Alphabet string to check against
 * @returns {boolean} True if character is in alphabet
 */
function isInAlphabet(char, alphabet) {
  return alphabet.includes(char);
}

/**
 * Get the radix (size) of an alphabet
 * Used in Feistel calculations
 * @param {string} alphabet - Alphabet string
 * @returns {number} Number of characters in alphabet
 */
function getRadix(alphabet) {
  return alphabet.length;
}

/**
 * Convert a character to its index in the alphabet
 * @param {string} char - Single character
 * @param {string} alphabet - Alphabet string
 * @returns {number} Index of character, or -1 if not found
 */
function charToIndex(char, alphabet) {
  return alphabet.indexOf(char);
}

/**
 * Convert an index to its character in the alphabet
 * @param {number} index - Index in alphabet
 * @param {string} alphabet - Alphabet string
 * @returns {string} Character at index
 */
function indexToChar(index, alphabet) {
  // Handle modular arithmetic for indices outside range
  const normalizedIndex = ((index % alphabet.length) + alphabet.length) % alphabet.length;
  return alphabet[normalizedIndex];
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.FPE_ALPHABETS = ALPHABETS;
  window.FPE_PII_ALPHABETS = PII_ALPHABETS;
  window.FPE_DELIMITER_CHARS = DELIMITER_CHARS;
  window.getAlphabet = getAlphabet;
  window.getDelimiters = getDelimiters;
  window.isInAlphabet = isInAlphabet;
  window.getRadix = getRadix;
  window.charToIndex = charToIndex;
  window.indexToChar = indexToChar;
  console.log('🔐 FPE: Alphabets module loaded');
}
