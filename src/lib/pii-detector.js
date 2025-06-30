/**
 * Unified PII Detector
 * Uses Presidio as primary detection engine with regex patterns as fallback
 */

class PIIDetector {
  constructor() {
    this.presidioClient = new PresidioClient();
    this.regexDetector = new PIIPatternDetector();
    this.metrics = {
      presidioSuccessCount: 0,
      presidioFailureCount: 0,
      regexFallbackCount: 0,
      totalDetections: 0,
      averagePresidioTime: 0,
      averageRegexTime: 0
    };
  }

  /**
   * Analyze text for PII using Presidio first, regex as fallback
   */
  async analyzePII(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const startTime = Date.now();
    this.metrics.totalDetections++;

    try {
      // Try Presidio first
      const presidioAvailable = await this.presidioClient.isServiceAvailable();
      
      if (presidioAvailable) {
        console.log('🔒 Using Presidio for PII detection');
        return await this.detectWithPresidio(text, startTime);
      } else {
        console.log('🔒 Presidio unavailable, using regex fallback');
        return await this.detectWithRegex(text, startTime, 'service_unavailable');
      }
    } catch (error) {
      console.warn('🔒 Presidio detection failed, falling back to regex:', error);
      return await this.detectWithRegex(text, startTime, 'presidio_error');
    }
  }

  /**
   * Detect PII using Presidio
   */
  async detectWithPresidio(text, startTime) {
    try {
      const entities = await this.presidioClient.detectPII(text);
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.metrics.presidioSuccessCount++;
      this.updateAverageTime('presidio', duration);

      // Enhance entities with additional metadata
      const enhancedEntities = entities.map(entity => ({
        ...entity,
        detection_method: 'presidio',
        confidence: entity.score,
        recognizer: entity.recognizer
      }));

      console.log('🔒 Presidio detection completed:', {
        count: enhancedEntities.length,
        duration: duration + 'ms',
        entities: enhancedEntities.map(e => e.entity_type)
      });

      return enhancedEntities;

    } catch (error) {
      this.metrics.presidioFailureCount++;
      throw error;
    }
  }

  /**
   * Detect PII using regex patterns (fallback)
   */
  async detectWithRegex(text, startTime, reason = 'fallback') {
    try {
      const entities = await this.regexDetector.analyzePII(text);
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.metrics.regexFallbackCount++;
      this.updateAverageTime('regex', duration);

      // Enhance entities with additional metadata
      const enhancedEntities = entities.map(entity => ({
        ...entity,
        detection_method: 'regex',
        confidence: entity.score || 0.8, // Default confidence for regex
        fallback_reason: reason
      }));

      console.log('🔒 Regex detection completed:', {
        reason: reason,
        count: enhancedEntities.length,
        duration: duration + 'ms',
        entities: enhancedEntities.map(e => e.entity_type)
      });

      return enhancedEntities;

    } catch (error) {
      console.error('🔒 Regex detection also failed:', error);
      return [];
    }
  }

  /**
   * Get combined detection results (experimental)
   * Uses both Presidio and regex, then merges results
   */
  async analyzePIICombined(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const startTime = Date.now();
    console.log('🔒 Running combined PII detection (Presidio + Regex)');

    try {
      const [presidioResults, regexResults] = await Promise.allSettled([
        this.detectWithPresidio(text, startTime),
        this.detectWithRegex(text, startTime, 'combined_mode')
      ]);

      const presidioEntities = presidioResults.status === 'fulfilled' ? presidioResults.value : [];
      const regexEntities = regexResults.status === 'fulfilled' ? regexResults.value : [];

      // Merge and deduplicate results
      const combinedEntities = this.mergeDetectionResults(presidioEntities, regexEntities);

      console.log('🔒 Combined detection completed:', {
        presidio: presidioEntities.length,
        regex: regexEntities.length,
        combined: combinedEntities.length,
        duration: (Date.now() - startTime) + 'ms'
      });

      return combinedEntities;

    } catch (error) {
      console.error('🔒 Combined detection failed:', error);
      return await this.detectWithRegex(text, startTime, 'combined_error');
    }
  }

  /**
   * Merge results from multiple detection methods
   */
  mergeDetectionResults(presidioEntities, regexEntities) {
    const merged = [...presidioEntities];
    
    // Add regex entities that don't overlap with Presidio results
    for (const regexEntity of regexEntities) {
      const hasOverlap = presidioEntities.some(presidioEntity => 
        this.entitiesOverlap(regexEntity, presidioEntity)
      );

      if (!hasOverlap) {
        merged.push({
          ...regexEntity,
          detection_method: 'regex_supplement'
        });
      }
    }

    // Sort by start position
    return merged.sort((a, b) => a.start - b.start);
  }

  /**
   * Check if two entities overlap
   */
  entitiesOverlap(entity1, entity2) {
    const tolerance = 2; // Allow small differences in boundaries
    
    return !(entity1.end + tolerance < entity2.start || 
             entity2.end + tolerance < entity1.start);
  }

  /**
   * Update average timing metrics
   */
  updateAverageTime(method, duration) {
    const key = `average${method.charAt(0).toUpperCase() + method.slice(1)}Time`;
    const countKey = method === 'presidio' ? 'presidioSuccessCount' : 'regexFallbackCount';
    
    const currentAverage = this.metrics[key];
    const count = this.metrics[countKey];
    
    this.metrics[key] = ((currentAverage * (count - 1)) + duration) / count;
  }

  /**
   * Get detection engine status and metrics
   */
  async getStatus() {
    const presidioStatus = await this.presidioClient.getServiceStatus();
    
    return {
      presidio: presidioStatus,
      metrics: {
        ...this.metrics,
        successRate: this.metrics.totalDetections > 0 
          ? (this.metrics.presidioSuccessCount / this.metrics.totalDetections * 100).toFixed(1) + '%'
          : 'N/A',
        fallbackRate: this.metrics.totalDetections > 0
          ? (this.metrics.regexFallbackCount / this.metrics.totalDetections * 100).toFixed(1) + '%'
          : 'N/A'
      },
      preferences: {
        presidioFirst: true,
        combineResults: false,
        scoreThreshold: this.presidioClient.config.scoreThreshold
      }
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      presidioSuccessCount: 0,
      presidioFailureCount: 0,
      regexFallbackCount: 0,
      totalDetections: 0,
      averagePresidioTime: 0,
      averageRegexTime: 0
    };
    console.log('🔒 PII detection metrics reset');
  }

  /**
   * Update Presidio configuration
   */
  updatePresidioConfig(config) {
    this.presidioClient.config = {
      ...this.presidioClient.config,
      ...config
    };
    console.log('🔒 Presidio configuration updated:', config);
  }

  /**
   * Test detection capabilities
   */
  async testDetection() {
    const testText = "My name is John Doe, email john.doe@example.com, phone 555-123-4567";
    
    console.log('🔒 Testing PII detection capabilities...');
    
    const results = await this.analyzePII(testText);
    const status = await this.getStatus();
    
    return {
      testText: testText,
      results: results,
      status: status
    };
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PIIDetector;
} else {
  window.PIIDetector = PIIDetector;
}

console.log('🔒 PII Extension: PIIDetector loaded');