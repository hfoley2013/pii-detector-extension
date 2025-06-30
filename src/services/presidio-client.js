/**
 * Presidio Client for PII Detection and Anonymization
 * Communicates with local Presidio services running in Docker
 */

class PresidioClient {
  constructor(config = {}) {
    this.config = {
      analyzerUrl: config.analyzerUrl || 'http://localhost:5001',
      anonymizerUrl: config.anonymizerUrl || 'http://localhost:5002',
      timeout: config.timeout || 5000,
      retries: config.retries || 2,
      language: config.language || 'en',
      scoreThreshold: config.scoreThreshold || 0.5
    };
    
    this.isAvailable = false;
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 30000; // 30 seconds
  }

  /**
   * Check if Presidio services are available
   */
  async isServiceAvailable() {
    const now = Date.now();
    
    // Return cached result if recent
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isAvailable;
    }

    try {
      const [analyzerHealth, anonymizerHealth] = await Promise.all([
        this.checkServiceHealth(this.config.analyzerUrl + '/health'),
        this.checkServiceHealth(this.config.anonymizerUrl + '/health')
      ]);

      this.isAvailable = analyzerHealth && anonymizerHealth;
      this.lastHealthCheck = now;
      
      console.log('🔒 Presidio health check:', {
        analyzer: analyzerHealth,
        anonymizer: anonymizerHealth,
        available: this.isAvailable
      });

      return this.isAvailable;
    } catch (error) {
      console.warn('🔒 Presidio health check failed:', error);
      this.isAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Check individual service health
   */
  async checkServiceHealth(url) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        timeout: 2000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect PII in text using Presidio Analyzer
   */
  async detectPII(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    try {
      const response = await this.makeRequest(
        this.config.analyzerUrl + '/analyze',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            language: this.config.language
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Analyzer request failed: ${response.status}`);
      }

      const results = await response.json();
      
      // Filter by score threshold and convert to our format
      const filteredResults = results
        .filter(entity => entity.score >= this.config.scoreThreshold)
        .map(entity => ({
          entity_type: this.mapPresidioEntityType(entity.entity_type),
          start: entity.start,
          end: entity.end,
          score: entity.score,
          text: text.substring(entity.start, entity.end),
          recognizer: entity.recognition_metadata?.recognizer_name || 'Unknown'
        }));

      console.log('🔒 Presidio detected PII:', filteredResults);
      return filteredResults;

    } catch (error) {
      console.error('🔒 Presidio PII detection failed:', error);
      throw error;
    }
  }

  /**
   * Anonymize text using Presidio Anonymizer
   */
  async anonymizeText(text, entities) {
    if (!text || !entities || entities.length === 0) {
      return text;
    }

    try {
      // Convert entities to Presidio format
      const presidioEntities = entities.map(entity => ({
        entity_type: this.mapToPresidioEntityType(entity.entity_type),
        start: entity.start,
        end: entity.end,
        score: entity.score
      }));

      // Create anonymizer configuration
      const anonymizers = this.createAnonymizers(entities);

      const response = await this.makeRequest(
        this.config.anonymizerUrl + '/anonymize',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            analyzer_results: presidioEntities,
            anonymizers: anonymizers
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Anonymizer request failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('🔒 Presidio anonymized text:', result);
      
      return result.text || text;

    } catch (error) {
      console.error('🔒 Presidio anonymization failed:', error);
      throw error;
    }
  }

  /**
   * Create anonymizer configuration for different entity types
   */
  createAnonymizers(entities) {
    const anonymizers = {};

    entities.forEach(entity => {
      const presidioType = this.mapToPresidioEntityType(entity.entity_type);
      const semanticLabel = this.getSemanticLabel(entity.entity_type);
      
      anonymizers[presidioType] = {
        type: 'replace',
        new_value: `<${entity.entity_type}>${semanticLabel}_TOKEN</${entity.entity_type}>`
      };
    });

    // Default anonymizer for any unspecified types
    anonymizers.DEFAULT = {
      type: 'replace',
      new_value: '<PII_TOKEN>'
    };

    return anonymizers;
  }

  /**
   * Map Presidio entity types to our internal types
   */
  mapPresidioEntityType(presidioType) {
    const mapping = {
      'PERSON': 'name',
      'EMAIL_ADDRESS': 'email',
      'PHONE_NUMBER': 'phone',
      'SSN': 'ssn',
      'CREDIT_CARD': 'cc',
      'LOCATION': 'address',
      'DATE_TIME': 'date',
      'URL': 'url'
    };

    return mapping[presidioType] || presidioType.toLowerCase();
  }

  /**
   * Map our internal types to Presidio entity types
   */
  mapToPresidioEntityType(internalType) {
    const mapping = {
      'name': 'PERSON',
      'email': 'EMAIL_ADDRESS',
      'phone': 'PHONE_NUMBER',
      'ssn': 'SSN',
      'cc': 'CREDIT_CARD',
      'address': 'LOCATION',
      'date': 'DATE_TIME',
      'url': 'URL'
    };

    return mapping[internalType] || internalType.toUpperCase();
  }

  /**
   * Get semantic label for entity type
   */
  getSemanticLabel(entityType) {
    const labels = {
      'name': 'PERSON_NAME',
      'email': 'EMAIL_ADDRESS',
      'phone': 'PHONE_NUMBER',
      'ssn': 'SSN_NUMBER',
      'cc': 'CREDIT_CARD',
      'address': 'STREET_ADDRESS',
      'date': 'DATE_VALUE',
      'url': 'URL_LINK'
    };

    return labels[entityType] || 'PII_TOKEN';
  }

  /**
   * Make HTTP request with timeout and retry logic
   */
  async makeRequest(url, options) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response;

      } catch (error) {
        lastError = error;
        console.warn(`🔒 Presidio request attempt ${attempt}/${this.config.retries} failed:`, error);
        
        if (attempt < this.config.retries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      }
    }

    throw lastError;
  }

  /**
   * Get detailed service status
   */
  async getServiceStatus() {
    try {
      const [analyzerAvailable, anonymizerAvailable] = await Promise.all([
        this.checkServiceHealth(this.config.analyzerUrl + '/health'),
        this.checkServiceHealth(this.config.anonymizerUrl + '/health')
      ]);

      return {
        available: analyzerAvailable && anonymizerAvailable,
        services: {
          analyzer: {
            url: this.config.analyzerUrl,
            available: analyzerAvailable
          },
          anonymizer: {
            url: this.config.anonymizerUrl,
            available: anonymizerAvailable
          }
        },
        config: {
          timeout: this.config.timeout,
          retries: this.config.retries,
          language: this.config.language,
          scoreThreshold: this.config.scoreThreshold
        },
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PresidioClient;
} else {
  window.PresidioClient = PresidioClient;
}

console.log('🔒 PII Extension: PresidioClient loaded');