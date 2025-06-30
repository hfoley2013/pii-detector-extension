class PIIExtensionTests {
  constructor() {
    this.tokenizer = new PIITokenizer();
    this.detector = new PIIPatternDetector();
    this.testResults = [];
  }

  async runAllTests() {
    console.log('Running PII Extension Test Suite...');
    
    const tests = [
      this.testBasicPIIDetection,
      this.testTokenization,
      this.testDetokenization,
      this.testMixedContent,
      this.testEdgeCases,
      this.testTokenConsistency,
      this.testSessionIsolation
    ];

    for (const test of tests) {
      try {
        await test.call(this);
      } catch (error) {
        console.error(`Test failed: ${test.name}`, error);
        this.testResults.push({
          test: test.name,
          passed: false,
          error: error.message
        });
      }
    }

    this.printResults();
  }

  async testBasicPIIDetection() {
    console.log('Testing: Basic PII Detection');
    
    const testText = "Hi, I'm John Smith. My email is john.smith@email.com and my phone is (555) 123-4567.";
    const entities = await this.detector.analyzePII(testText);
    
    const expectedTypes = ['name', 'email', 'phone'];
    const detectedTypes = entities.map(e => e.entity_type);
    
    const hasAllTypes = expectedTypes.every(type => detectedTypes.includes(type));
    
    if (!hasAllTypes) {
      throw new Error(`Expected types: ${expectedTypes.join(', ')}, Got: ${detectedTypes.join(', ')}`);
    }

    this.testResults.push({
      test: 'testBasicPIIDetection',
      passed: true,
      details: `Detected ${entities.length} PII entities: ${detectedTypes.join(', ')}`
    });
  }

  async testTokenization() {
    console.log('Testing: Tokenization');
    
    const testText = "Contact me at john.doe@example.com or call (555) 987-6543.";
    const entities = await this.detector.analyzePII(testText);
    const tokenizedText = this.tokenizer.tokenizeText(testText, entities);
    
    if (tokenizedText === testText) {
      throw new Error('Text was not tokenized');
    }

    if (!tokenizedText.includes('<email>') || !tokenizedText.includes('<phone>')) {
      throw new Error('Expected tokens not found in tokenized text');
    }

    this.testResults.push({
      test: 'testTokenization',
      passed: true,
      details: `Original: "${testText.substring(0, 50)}..." -> Tokenized: "${tokenizedText.substring(0, 50)}..."`
    });
  }

  async testDetokenization() {
    console.log('Testing: Detokenization');
    
    const testText = "My name is Jane Smith and my email is jane@test.com";
    const entities = await this.detector.analyzePII(testText);
    const tokenizedText = this.tokenizer.tokenizeText(testText, entities);
    const detokenizedText = this.tokenizer.detokenizeText(tokenizedText);
    
    if (detokenizedText !== testText) {
      throw new Error(`Detokenization failed. Expected: "${testText}", Got: "${detokenizedText}"`);
    }

    this.testResults.push({
      test: 'testDetokenization',
      passed: true,
      details: 'Successfully round-trip tokenized and detokenized text'
    });
  }

  async testMixedContent() {
    console.log('Testing: Mixed Content');
    
    const testText = `
      Please contact Dr. Sarah Johnson at sarah.johnson@hospital.com or (555) 234-5678.
      Her SSN is 123-45-6789 and credit card ending in 4532 1234 5678 9012.
      She was born on 03/15/1985 and lives at 123 Main Street, Springfield.
    `;
    
    const entities = await this.detector.analyzePII(testText);
    const tokenizedText = this.tokenizer.tokenizeText(testText, entities);
    
    const expectedTokenTypes = ['name', 'email', 'phone', 'ssn'];
    const foundTokens = this.tokenizer.extractTokens(tokenizedText);
    const foundTypes = foundTokens.map(t => t.type);
    
    const hasExpectedTypes = expectedTokenTypes.some(type => foundTypes.includes(type));
    
    if (!hasExpectedTypes) {
      throw new Error(`Expected some of: ${expectedTokenTypes.join(', ')}, Found: ${foundTypes.join(', ')}`);
    }

    this.testResults.push({
      test: 'testMixedContent',
      passed: true,
      details: `Processed mixed content with ${foundTokens.length} tokens of types: ${foundTypes.join(', ')}`
    });
  }

  async testEdgeCases() {
    console.log('Testing: Edge Cases');
    
    const edgeCases = [
      '', // empty string
      '   ', // whitespace only
      'This is just normal text with no PII',
      'Email without @ symbol: notanemail.com',
      'Phone with letters: 555-CALL-NOW',
      'Fake SSN: 000-00-0000'
    ];

    for (const testCase of edgeCases) {
      const entities = await this.detector.analyzePII(testCase);
      const tokenizedText = this.tokenizer.tokenizeText(testCase, entities);
      const detokenizedText = this.tokenizer.detokenizeText(tokenizedText);
      
      if (detokenizedText !== testCase) {
        throw new Error(`Edge case failed for: "${testCase}"`);
      }
    }

    this.testResults.push({
      test: 'testEdgeCases',
      passed: true,
      details: `Successfully handled ${edgeCases.length} edge cases`
    });
  }

  async testTokenConsistency() {
    console.log('Testing: Token Consistency');
    
    const testText = "Contact John Doe at john.doe@example.com";
    const entities = await this.detector.analyzePII(testText);
    
    const tokenized1 = this.tokenizer.tokenizeText(testText, entities);
    const tokenized2 = this.tokenizer.tokenizeText(testText, entities);
    
    if (tokenized1 !== tokenized2) {
      throw new Error('Same input produced different tokens');
    }

    this.testResults.push({
      test: 'testTokenConsistency',
      passed: true,
      details: 'Same PII produces consistent tokens within session'
    });
  }

  async testSessionIsolation() {
    console.log('Testing: Session Isolation');
    
    const testText = "Contact Alice Smith at alice@example.com";
    const entities = await this.detector.analyzePII(testText);
    
    const tokenizer1 = new PIITokenizer();
    const tokenizer2 = new PIITokenizer();
    
    const tokenized1 = tokenizer1.tokenizeText(testText, entities);
    const tokenized2 = tokenizer2.tokenizeText(testText, entities);
    
    if (tokenized1 === tokenized2) {
      throw new Error('Different sessions produced identical tokens (should be different)');
    }

    this.testResults.push({
      test: 'testSessionIsolation',
      passed: true,
      details: 'Different sessions produce different tokens for same PII'
    });
  }

  printResults() {
    console.log('\n=== PII Extension Test Results ===');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`\nSummary: ${passed}/${total} tests passed\n`);
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.test}`);
      
      if (result.details) {
        console.log(`   ${result.details}`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    if (passed === total) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log(`\n⚠️  ${total - passed} test(s) failed`);
    }
  }
}

const testData = {
  basicPII: "Hi, I'm John Smith. My email is john.smith@email.com and my phone is (555) 123-4567.",
  expectedTokenized: "Hi, I'm <name>NMXXXX</name>. My email is <email>EMXXXX</email> and my phone is <phone>PHXXXX</phone>.",
  mixedContent: `
    Please reach out to Dr. Emily Johnson at emily.johnson@hospital.com 
    or call her at (555) 987-6543. Her patient ID is 12345 and SSN is 987-65-4321.
    She was born on January 15, 1990.
  `,
  edgeCases: [
    "",
    "No PII here",
    "Invalid email: notanemail",
    "Invalid phone: 123",
    "Invalid SSN: 123-45-678"
  ]
};

if (typeof window !== 'undefined') {
  window.PIIExtensionTests = PIIExtensionTests;
  window.testData = testData;
}