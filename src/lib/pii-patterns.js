class PIIPatternDetector {
  constructor() {
    this.patterns = {
      email: {
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        entity_type: 'email'
      },
      phone: {
        regex: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
        entity_type: 'phone'
      },
      ssn: {
        regex: /\b(?:\d{3}[-.\s]?\d{2}[-.\s]?\d{4}|\d{9})\b/g,
        entity_type: 'ssn'
      },
      creditCard: {
        regex: /\b(?:\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}|\d{13,19})\b/g,
        entity_type: 'cc'
      },
      name: {
        regex: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g,
        entity_type: 'name'
      },
      date: {
        regex: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{2,4}[-/]\d{1,2}[-/]\d{1,2}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi,
        entity_type: 'date'
      }
    };
  }

  detectPII(text) {
    const entities = [];
    
    for (const [patternName, patternConfig] of Object.entries(this.patterns)) {
      const matches = [...text.matchAll(patternConfig.regex)];
      
      for (const match of matches) {
        if (this.validateMatch(match[0], patternName)) {
          entities.push({
            entity_type: patternConfig.entity_type,
            start: match.index,
            end: match.index + match[0].length,
            score: this.calculateConfidence(match[0], patternName),
            text: match[0]
          });
        }
      }
    }

    return this.removeDuplicates(entities);
  }

  validateMatch(matchText, patternType) {
    switch (patternType) {
      case 'email':
        return this.validateEmail(matchText);
      case 'phone':
        return this.validatePhone(matchText);
      case 'ssn':
        return this.validateSSN(matchText);
      case 'creditCard':
        return this.validateCreditCard(matchText);
      case 'name':
        return this.validateName(matchText);
      case 'date':
        return this.validateDate(matchText);
      default:
        return true;
    }
  }

  validateEmail(email) {
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    
    const [local, domain] = parts;
    if (local.length === 0 || domain.length === 0) return false;
    if (domain.split('.').length < 2) return false;
    
    return true;
  }

  validatePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  }

  validateSSN(ssn) {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length !== 9) return false;
    if (digits === '000000000' || digits === '123456789') return false;
    if (digits.substring(0, 3) === '000') return false;
    if (digits.substring(3, 5) === '00') return false;
    if (digits.substring(5, 9) === '0000') return false;
    
    return true;
  }

  validateCreditCard(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    
    return this.luhnCheck(digits);
  }

  luhnCheck(cardNumber) {
    let sum = 0;
    let isEven = false;
    
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i), 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  }

  validateName(name) {
    const words = name.trim().split(/\s+/);
    if (words.length < 2) return false;
    
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'a', 'an', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'can', 'must'
    ]);
    
    for (const word of words) {
      if (commonWords.has(word.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  }

  validateDate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    
    const year = date.getFullYear();
    return year >= 1900 && year <= new Date().getFullYear() + 10;
  }

  calculateConfidence(matchText, patternType) {
    const baseConfidence = {
      email: 0.9,
      phone: 0.85,
      ssn: 0.95,
      creditCard: 0.9,
      name: 0.7,
      date: 0.8
    };

    return baseConfidence[patternType] || 0.5;
  }

  removeDuplicates(entities) {
    const sortedEntities = entities.sort((a, b) => a.start - b.start);
    const filtered = [];
    
    for (let i = 0; i < sortedEntities.length; i++) {
      const current = sortedEntities[i];
      let shouldAdd = true;
      
      for (let j = 0; j < filtered.length; j++) {
        const existing = filtered[j];
        
        if (this.entitiesOverlap(current, existing)) {
          if (current.score > existing.score) {
            filtered.splice(j, 1);
            j--;
          } else {
            shouldAdd = false;
            break;
          }
        }
      }
      
      if (shouldAdd) {
        filtered.push(current);
      }
    }
    
    return filtered.sort((a, b) => a.start - b.start);
  }

  entitiesOverlap(entity1, entity2) {
    return !(entity1.end <= entity2.start || entity2.end <= entity1.start);
  }

  async analyzePII(text) {
    try {
      return this.detectPII(text);
    } catch (error) {
      console.error('PII pattern detection error:', error);
      return [];
    }
  }
}

if (typeof window !== 'undefined') {
  window.PIIPatternDetector = PIIPatternDetector;
  console.log('🔒 PII Extension: PIIPatternDetector loaded');
}