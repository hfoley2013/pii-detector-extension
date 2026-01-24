/**
 * Format Parser for Format-Preserving Tokenization
 *
 * Parses PII values to extract:
 * 1. Content - the characters to encrypt
 * 2. Template - the format structure with placeholders
 * 3. Delimiters - positions and characters of non-content elements
 *
 * Also reconstructs formatted strings from encrypted content + template.
 */

class FormatParser {
  constructor() {
    // Delimiter configurations per PII type
    this.delimiterConfigs = {
      ssn: {
        delimiters: new Set(['-', '.', ' ']),
        normalize: true  // Normalize different formats to consistent output
      },
      phone: {
        delimiters: new Set(['-', '.', ' ', '(', ')', '+']),
        normalize: false  // Preserve exact format
      },
      cc: {
        delimiters: new Set(['-', ' ']),
        normalize: true
      },
      date: {
        delimiters: new Set(['-', '/', '.', ' ', ',']),
        normalize: false
      },
      email: {
        delimiters: new Set(['@', '.']),
        normalize: false,
        special: true  // Requires special handling
      },
      name: {
        delimiters: new Set([' ', '-', "'", '.']),
        normalize: false
      },
      address: {
        delimiters: new Set([' ', ',', '.', '#', '-']),
        normalize: false
      },
      url: {
        delimiters: new Set([':', '/', '.', '-', '_', '?', '=', '&', '#']),
        normalize: false,
        special: true
      }
    };
  }

  /**
   * Parse a PII value into content, template, and delimiter info
   *
   * @param {string} value - The PII value to parse
   * @param {string} piiType - Type of PII (ssn, phone, email, etc.)
   * @returns {Object} Parsed format info
   */
  parse(value, piiType) {
    const config = this.delimiterConfigs[piiType.toLowerCase()] || {
      delimiters: new Set(),
      normalize: false
    };

    // Special handling for complex types
    if (config.special) {
      if (piiType === 'email') {
        return this.parseEmail(value);
      }
      if (piiType === 'url') {
        return this.parseUrl(value);
      }
    }

    return this.parseGeneric(value, config.delimiters);
  }

  /**
   * Generic parser for most PII types
   *
   * @param {string} value - Value to parse
   * @param {Set<string>} delimiters - Set of delimiter characters
   * @returns {Object} Parsed format
   */
  parseGeneric(value, delimiters) {
    let content = '';
    let template = '';
    const delimiterPositions = [];
    let contentIndex = 0;

    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      if (delimiters.has(char)) {
        // This is a delimiter - add to template as-is
        template += char;
        delimiterPositions.push({
          position: i,
          contentPosition: contentIndex,
          char: char
        });
      } else {
        // This is content - add placeholder to template
        content += char;
        template += '#';
        contentIndex++;
      }
    }

    return {
      original: value,
      content: content,
      template: template,
      delimiterPositions: delimiterPositions,
      contentLength: content.length
    };
  }

  /**
   * Parse email address with special handling for local@domain structure
   *
   * @param {string} email - Email address to parse
   * @returns {Object} Parsed email format
   */
  parseEmail(email) {
    const atIndex = email.lastIndexOf('@');

    if (atIndex === -1) {
      // Not a valid email, parse as generic
      return this.parseGeneric(email, new Set(['.', '_', '-', '+']));
    }

    const local = email.substring(0, atIndex);
    const domain = email.substring(atIndex + 1);

    // Parse local part (before @)
    const localParsed = this.parseGeneric(local, new Set(['.', '_', '-', '+']));

    // Parse domain part (after @)
    const domainParsed = this.parseGeneric(domain, new Set(['.']));

    return {
      original: email,
      type: 'email',
      local: localParsed,
      domain: domainParsed,
      atPosition: atIndex,
      // Combined content for encryption (local + domain, separated)
      content: localParsed.content + domainParsed.content,
      localContentLength: localParsed.contentLength,
      domainContentLength: domainParsed.contentLength
    };
  }

  /**
   * Parse URL with structure preservation
   *
   * @param {string} url - URL to parse
   * @returns {Object} Parsed URL format
   */
  parseUrl(url) {
    // For URLs, we only encrypt certain parts to maintain validity
    // Keep protocol, slashes, dots intact
    const delimiters = new Set([':', '/', '.', '?', '=', '&', '#']);
    return this.parseGeneric(url, delimiters);
  }

  /**
   * Reconstruct a formatted string from encrypted content and template
   *
   * @param {string} encryptedContent - The encrypted content characters
   * @param {Object} parsedFormat - The original parsed format info
   * @returns {string} Reconstructed formatted string
   */
  reconstruct(encryptedContent, parsedFormat) {
    // Handle email special case
    if (parsedFormat.type === 'email') {
      return this.reconstructEmail(encryptedContent, parsedFormat);
    }

    const template = parsedFormat.template;
    let result = '';
    let contentIndex = 0;

    for (let i = 0; i < template.length; i++) {
      if (template[i] === '#') {
        // Replace placeholder with encrypted content
        if (contentIndex < encryptedContent.length) {
          result += encryptedContent[contentIndex];
          contentIndex++;
        }
      } else {
        // Keep delimiter as-is
        result += template[i];
      }
    }

    return result;
  }

  /**
   * Reconstruct an email address from encrypted content
   *
   * @param {string} encryptedContent - Combined encrypted local + domain content
   * @param {Object} parsedFormat - Parsed email format info
   * @returns {string} Reconstructed email
   */
  reconstructEmail(encryptedContent, parsedFormat) {
    const localContent = encryptedContent.substring(0, parsedFormat.localContentLength);
    const domainContent = encryptedContent.substring(parsedFormat.localContentLength);

    // Reconstruct local part
    const localReconstructed = this.reconstructGeneric(localContent, parsedFormat.local.template);

    // Reconstruct domain part
    const domainReconstructed = this.reconstructGeneric(domainContent, parsedFormat.domain.template);

    return localReconstructed + '@' + domainReconstructed;
  }

  /**
   * Generic reconstruction from content and template
   *
   * @param {string} content - Content characters
   * @param {string} template - Template with # placeholders
   * @returns {string} Reconstructed string
   */
  reconstructGeneric(content, template) {
    let result = '';
    let contentIndex = 0;

    for (let i = 0; i < template.length; i++) {
      if (template[i] === '#') {
        if (contentIndex < content.length) {
          result += content[contentIndex];
          contentIndex++;
        }
      } else {
        result += template[i];
      }
    }

    return result;
  }

  /**
   * Determine the appropriate alphabet for content based on PII type and content
   *
   * @param {string} content - The extracted content
   * @param {string} piiType - Type of PII
   * @param {string} [requestedCharset] - User-requested charset override
   * @returns {string} Alphabet key to use
   */
  determineAlphabet(content, piiType, requestedCharset = null) {
    // If user specified a charset, use it
    if (requestedCharset) {
      return requestedCharset.toUpperCase();
    }

    // Analyze content to determine best alphabet
    const hasDigits = /\d/.test(content);
    const hasLower = /[a-z]/.test(content);
    const hasUpper = /[A-Z]/.test(content);
    const hasAlpha = hasLower || hasUpper;

    // Default mappings based on PII type
    const typeDefaults = {
      ssn: 'NUMERIC',
      phone: 'NUMERIC',
      cc: 'NUMERIC',
      date: 'NUMERIC',
      name: 'ALPHA',
      email: 'ALPHANUMERIC',
      address: 'ALPHANUMERIC'
    };

    // If we have a default for this type, use it
    if (typeDefaults[piiType.toLowerCase()]) {
      return typeDefaults[piiType.toLowerCase()];
    }

    // Otherwise, infer from content
    if (hasDigits && hasAlpha) {
      return 'ALPHANUMERIC';
    } else if (hasDigits) {
      return 'NUMERIC';
    } else if (hasAlpha) {
      return 'ALPHA';
    }

    // Fallback
    return 'ALPHANUMERIC';
  }

  /**
   * Validate that a formatted string matches expected pattern
   *
   * @param {string} value - Value to validate
   * @param {string} piiType - Expected PII type
   * @returns {boolean} True if format is valid
   */
  validateFormat(value, piiType) {
    const patterns = {
      ssn: /^\d{3}[-.\s]?\d{2}[-.\s]?\d{4}$/,
      phone: /^[\d()+\-.\s]{10,20}$/,
      cc: /^[\d\-\s]{13,23}$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      date: /^[\d\-/.\s,]+$/
    };

    const pattern = patterns[piiType.toLowerCase()];
    if (!pattern) {
      return true;  // No pattern defined, accept any format
    }

    return pattern.test(value);
  }

  /**
   * Get format statistics for debugging
   *
   * @param {Object} parsedFormat - Parsed format object
   * @returns {Object} Format statistics
   */
  getFormatStats(parsedFormat) {
    return {
      originalLength: parsedFormat.original?.length || 0,
      contentLength: parsedFormat.contentLength || parsedFormat.content?.length || 0,
      delimiterCount: parsedFormat.delimiterPositions?.length || 0,
      template: parsedFormat.template,
      isEmail: parsedFormat.type === 'email'
    };
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.FormatParser = FormatParser;
  console.log('🔐 FPE: Format parser module loaded');
}
