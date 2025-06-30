class PIITokenizer {
  constructor() {
    this.tokenMappings = new Map();
    this.reverseTokenMappings = new Map();
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  generateToken(piiValue, piiType) {
    const key = `${piiType}:${piiValue}:${this.sessionId}`;
    
    if (this.tokenMappings.has(key)) {
      return this.tokenMappings.get(key);
    }

    const hash = this.hashString(key);
    const tokenId = this.generateTokenId(hash, piiType);
    const token = `<${piiType}>${tokenId}</${piiType}>`;
    
    this.tokenMappings.set(key, token);
    this.reverseTokenMappings.set(token, piiValue);
    
    return token;
  }

  generateTokenId(hash, piiType) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefixes = {
      'name': 'NM',
      'email': 'EM',
      'phone': 'PH', 
      'ssn': 'SS',
      'cc': 'CC',
      'address': 'AD',
      'date': 'DT'
    };
    
    const prefix = prefixes[piiType] || 'TK';
    let result = prefix;
    
    for (let i = 0; i < 4; i++) {
      result += chars[hash % chars.length];
      hash = Math.floor(hash / chars.length);
    }
    
    return result;
  }

  tokenizeText(text, piiEntities) {
    if (!piiEntities || piiEntities.length === 0) {
      return text;
    }

    let tokenizedText = text;
    const sortedEntities = piiEntities.sort((a, b) => b.start - a.start);

    for (const entity of sortedEntities) {
      const originalValue = text.substring(entity.start, entity.end);
      const token = this.generateToken(originalValue, entity.entity_type);
      
      tokenizedText = tokenizedText.substring(0, entity.start) + 
                     token + 
                     tokenizedText.substring(entity.end);
    }

    return tokenizedText;
  }

  detokenizeText(text) {
    if (!text) return text;

    let detokenizedText = text;
    const tokenPattern = /<(name|email|phone|ssn|cc|address|date)>([^<]+)<\/\1>/g;
    
    detokenizedText = detokenizedText.replace(tokenPattern, (match) => {
      const originalValue = this.reverseTokenMappings.get(match);
      return originalValue || match;
    });

    return detokenizedText;
  }

  extractTokens(text) {
    const tokens = [];
    const tokenPattern = /<(name|email|phone|ssn|cc|address|date)>([^<]+)<\/\1>/g;
    let match;

    while ((match = tokenPattern.exec(text)) !== null) {
      tokens.push({
        token: match[0],
        type: match[1],
        tokenId: match[2],
        start: match.index,
        end: match.index + match[0].length
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
      sessionId: this.sessionId
    };
  }
}

if (typeof window !== 'undefined') {
  window.PIITokenizer = PIITokenizer;
  console.log('🔒 PII Extension: PIITokenizer loaded');
}