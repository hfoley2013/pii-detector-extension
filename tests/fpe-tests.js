/**
 * FPE (Format-Preserving Encryption) Test Suite
 *
 * Run these tests in the browser console after loading the extension
 * on a supported page (ChatGPT or Gemini).
 *
 * Usage:
 *   const tests = new FPETests();
 *   await tests.runAllTests();
 */

class FPETests {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runAllTests() {
    console.log("🧪 Starting FPE Test Suite...\n");

    // Check prerequisites
    if (!this.checkPrerequisites()) {
      console.error("❌ Prerequisites not met. Ensure FPE modules are loaded.");
      return;
    }

    // Run test categories
    await this.runAlphabetTests();
    await this.runKeyManagerTests();
    await this.runFeistelTests();
    await this.runFormatParserTests();
    await this.runTokenizerV2Tests();
    await this.runSSNDetectionTests();
    await this.runIntegrationTests();

    // Print summary
    this.printSummary();
  }

  checkPrerequisites() {
    const required = [
      "FPE_ALPHABETS",
      "FPEKeyManager",
      "FeistelFPE",
      "FormatParser",
      "CollisionRegistry",
      "PIITokenizerV2",
    ];

    const optional = ["PIIPatternDetector", "PIIDetector"];

    const missing = required.filter(
      (name) => typeof window[name] === "undefined",
    );

    if (missing.length > 0) {
      console.error("Missing required modules:", missing);
      return false;
    }

    const availableOptional = optional.filter(
      (name) => typeof window[name] !== "undefined",
    );
    const missingOptional = optional.filter(
      (name) => typeof window[name] === "undefined",
    );

    console.log("✅ All required FPE modules loaded");
    if (availableOptional.length > 0) {
      console.log(
        "✅ Optional modules available:",
        availableOptional.join(", "),
      );
    }
    if (missingOptional.length > 0) {
      console.log(
        "⚠️ Optional modules not loaded (some tests may be skipped):",
        missingOptional.join(", "),
      );
    }
    console.log("");
    return true;
  }

  // ============ ALPHABET TESTS ============
  async runAlphabetTests() {
    console.log("📝 Running Alphabet Tests...");

    this.test("NUMERIC alphabet has 10 characters", () => {
      return FPE_ALPHABETS.NUMERIC.length === 10;
    });

    this.test("ALPHA alphabet has 52 characters", () => {
      return FPE_ALPHABETS.ALPHA.length === 52;
    });

    this.test("ALPHANUMERIC alphabet has 62 characters", () => {
      return FPE_ALPHABETS.ALPHANUMERIC.length === 62;
    });

    this.test("getAlphabet returns correct alphabet for SSN", () => {
      const alphabet = getAlphabet("ssn");
      return alphabet === FPE_ALPHABETS.NUMERIC;
    });

    this.test("getAlphabet returns correct alphabet for email", () => {
      const alphabet = getAlphabet("email");
      return alphabet === FPE_ALPHABETS.ALPHANUMERIC;
    });

    this.test("charToIndex and indexToChar are inverse operations", () => {
      const alphabet = FPE_ALPHABETS.ALPHANUMERIC;
      for (let i = 0; i < alphabet.length; i++) {
        const char = alphabet[i];
        const index = charToIndex(char, alphabet);
        const backToChar = indexToChar(index, alphabet);
        if (backToChar !== char) return false;
      }
      return true;
    });

    console.log("");
  }

  // ============ KEY MANAGER TESTS ============
  async runKeyManagerTests() {
    console.log("🔐 Running Key Manager Tests...");

    this.test("Key manager initializes successfully", async () => {
      const km = new FPEKeyManager();
      await km.initialize();
      return km.initialized === true;
    });

    this.test("Session ID is generated", async () => {
      const km = new FPEKeyManager();
      await km.initialize();
      return km.sessionId && km.sessionId.length === 32;
    });

    this.test("Tweak generation produces 16 bytes", async () => {
      const km = new FPEKeyManager();
      await km.initialize();
      const tweak = km.generateTweak("ssn", "123-45-6789");
      return tweak instanceof Uint8Array && tweak.length === 16;
    });

    this.test("Different PII types produce different tweaks", async () => {
      const km = new FPEKeyManager();
      await km.initialize();
      const tweak1 = km.generateTweak("ssn", "123456789");
      const tweak2 = km.generateTweak("phone", "123456789");
      // Compare first 4 bytes (type identifier)
      return tweak1[0] !== tweak2[0] || tweak1[1] !== tweak2[1];
    });

    this.test("HMAC produces 32 bytes", async () => {
      const km = new FPEKeyManager();
      await km.initialize();
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hmac = await km.hmac(data);
      return hmac instanceof Uint8Array && hmac.length === 32;
    });

    console.log("");
  }

  // ============ FEISTEL ENCRYPTION TESTS ============
  async runFeistelTests() {
    console.log("🔒 Running Feistel Encryption Tests...");

    const km = new FPEKeyManager();
    await km.initialize();
    const fpe = new FeistelFPE(km);

    this.test("Encryption preserves length (numeric)", async () => {
      const plaintext = "123456789";
      const alphabet = FPE_ALPHABETS.NUMERIC;
      const tweak = km.generateTweak("ssn", plaintext);
      const ciphertext = await fpe.encrypt(plaintext, alphabet, tweak);
      return ciphertext.length === plaintext.length;
    });

    this.test("Encryption preserves alphabet (numeric)", async () => {
      const plaintext = "123456789";
      const alphabet = FPE_ALPHABETS.NUMERIC;
      const tweak = km.generateTweak("ssn", plaintext);
      const ciphertext = await fpe.encrypt(plaintext, alphabet, tweak);
      return /^\d+$/.test(ciphertext);
    });

    this.test("Encryption preserves length (alpha)", async () => {
      const plaintext = "JohnSmith";
      const alphabet = FPE_ALPHABETS.ALPHA;
      const tweak = km.generateTweak("name", plaintext);
      const ciphertext = await fpe.encrypt(plaintext, alphabet, tweak);
      return ciphertext.length === plaintext.length;
    });

    this.test("Encryption preserves alphabet (alpha)", async () => {
      const plaintext = "JohnSmith";
      const alphabet = FPE_ALPHABETS.ALPHA;
      const tweak = km.generateTweak("name", plaintext);
      const ciphertext = await fpe.encrypt(plaintext, alphabet, tweak);
      return /^[A-Za-z]+$/.test(ciphertext);
    });

    this.test("Encryption is deterministic (same key, tweak)", async () => {
      const plaintext = "123456789";
      const alphabet = FPE_ALPHABETS.NUMERIC;
      const tweak = km.generateTweak("ssn", plaintext);
      const cipher1 = await fpe.encrypt(plaintext, alphabet, tweak);
      const cipher2 = await fpe.encrypt(plaintext, alphabet, tweak);
      return cipher1 === cipher2;
    });

    this.test("Decryption reverses encryption (round-trip)", async () => {
      const plaintext = "123456789";
      const alphabet = FPE_ALPHABETS.NUMERIC;
      const tweak = km.generateTweak("ssn", plaintext);
      const ciphertext = await fpe.encrypt(plaintext, alphabet, tweak);
      const decrypted = await fpe.decrypt(ciphertext, alphabet, tweak);
      return decrypted === plaintext;
    });

    this.test("Round-trip works for alphanumeric", async () => {
      const plaintext = "Test123ABC";
      const alphabet = FPE_ALPHABETS.ALPHANUMERIC;
      const tweak = km.generateTweak("email", plaintext);
      const ciphertext = await fpe.encrypt(plaintext, alphabet, tweak);
      const decrypted = await fpe.decrypt(ciphertext, alphabet, tweak);
      return decrypted === plaintext;
    });

    this.test(
      "Different plaintexts produce different ciphertexts",
      async () => {
        const alphabet = FPE_ALPHABETS.NUMERIC;
        const tweak = km.generateTweak("ssn", "test");
        const cipher1 = await fpe.encrypt("123456789", alphabet, tweak);
        const cipher2 = await fpe.encrypt("987654321", alphabet, tweak);
        return cipher1 !== cipher2;
      },
    );

    console.log("");
  }

  // ============ FORMAT PARSER TESTS ============
  async runFormatParserTests() {
    console.log("📋 Running Format Parser Tests...");

    const parser = new FormatParser();

    this.test("SSN format parsed correctly", () => {
      const result = parser.parse("123-45-6789", "ssn");
      return (
        result.content === "123456789" && result.template === "###-##-####"
      );
    });

    this.test("Phone format parsed correctly", () => {
      const result = parser.parse("(555) 123-4567", "phone");
      return (
        result.content === "5551234567" && result.template === "(###) ###-####"
      );
    });

    this.test("SSN format reconstructed correctly", () => {
      const parsed = parser.parse("123-45-6789", "ssn");
      const reconstructed = parser.reconstruct("987654321", parsed);
      return reconstructed === "987-65-4321";
    });

    this.test("Phone format reconstructed correctly", () => {
      const parsed = parser.parse("(555) 123-4567", "phone");
      const reconstructed = parser.reconstruct("9876543210", parsed);
      return reconstructed === "(987) 654-3210";
    });

    this.test("Email parsed into local and domain", () => {
      const result = parser.parse("john.doe@example.com", "email");
      return (
        result.type === "email" &&
        result.local.content === "johndoe" &&
        result.domain.content === "examplecom"
      );
    });

    this.test("Credit card format parsed correctly", () => {
      const result = parser.parse("4111-1111-1111-1111", "cc");
      return (
        result.content === "4111111111111111" &&
        result.template === "####-####-####-####"
      );
    });

    console.log("");
  }

  // ============ TOKENIZER V2 TESTS ============
  async runTokenizerV2Tests() {
    console.log("🎯 Running TokenizerV2 Tests...");

    this.test("TokenizerV2 initializes successfully", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();
      return tokenizer.initialized === true;
    });

    this.test("SSN token has XML format", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();
      const token = await tokenizer.generateToken("123-45-6789", "ssn");
      return /<ssn\s+charset="numeric">[^<]+<\/ssn>/.test(token);
    });

    this.test("SSN token preserves format", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();
      const token = await tokenizer.generateToken("123-45-6789", "ssn");
      // Extract content from XML tag
      const match = token.match(/<ssn[^>]*>([^<]+)<\/ssn>/);
      if (!match) return false;
      const content = match[1];
      // Should match pattern: ###-##-####
      return /^\d{3}-\d{2}-\d{4}$/.test(content);
    });

    this.test("Detokenization reverses tokenization", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();
      const original = "123-45-6789";
      const token = await tokenizer.generateToken(original, "ssn");
      const detokenized = tokenizer.detokenizeText(token);
      return detokenized === original;
    });

    this.test("Same SSN produces same token (idempotent)", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();
      const token1 = await tokenizer.generateToken("123-45-6789", "ssn");
      const token2 = await tokenizer.generateToken("123-45-6789", "ssn");
      return token1 === token2;
    });

    this.test("Email token has XML format", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();
      const token = await tokenizer.generateToken("john@example.com", "email");
      return /<email\s+charset="alphanumeric">[^<]+<\/email>/.test(token);
    });

    this.test("Tokenize text with multiple PII entities", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();

      const text = "My SSN is 123-45-6789";
      const entities = [
        {
          entity_type: "ssn",
          start: 10,
          end: 21,
          text: "123-45-6789",
          score: 0.95,
        },
      ];

      const tokenized = await tokenizer.tokenizeText(text, entities);
      return tokenized.includes("<ssn") && tokenized.includes("</ssn>");
    });

    console.log("");
  }

  // ============ SSN DETECTION TESTS ============
  async runSSNDetectionTests() {
    console.log("🔢 Running SSN Detection Tests...");

    // Check if PIIPatternDetector is available
    if (typeof PIIPatternDetector === "undefined") {
      console.log(
        "  ⚠️ PIIPatternDetector not loaded, skipping SSN detection tests",
      );
      return;
    }

    const detector = new PIIPatternDetector();

    this.test("Detects SSN with hyphens (123-45-6789)", async () => {
      const text = "My SSN is 123-45-6789";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 1 && ssnEntities[0].text === "123-45-6789";
    });

    this.test("Detects SSN with dots (123.45.6789)", async () => {
      const text = "SSN: 123.45.6789";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 1 && ssnEntities[0].text === "123.45.6789";
    });

    this.test("Detects SSN with spaces (123 45 6789)", async () => {
      const text = "SSN is 123 45 6789 here";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 1 && ssnEntities[0].text === "123 45 6789";
    });

    this.test("Detects continuous SSN (123456789)", async () => {
      const text = "Number: 123456789";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 1 && ssnEntities[0].text === "123456789";
    });

    this.test("Detects multiple SSNs in text", async () => {
      const text = "SSN1: 123-45-6789, SSN2: 987-65-4321";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 2;
    });

    this.test('SSN detected after "is" (common pattern)', async () => {
      const text = "My social security number is 555-12-3456";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 1 && ssnEntities[0].text === "555-12-3456";
    });

    this.test("SSN detected at beginning of text", async () => {
      const text = "123-45-6789 is my SSN";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 1 && ssnEntities[0].text === "123-45-6789";
    });

    this.test("SSN detected at end of text", async () => {
      const text = "Please use SSN 123-45-6789";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 1 && ssnEntities[0].text === "123-45-6789";
    });

    this.test("Rejects invalid SSN with 000 area", async () => {
      const text = "SSN: 000-12-3456";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 0;
    });

    this.test("Rejects invalid SSN with 666 area", async () => {
      const text = "SSN: 666-12-3456";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 0;
    });

    this.test("Rejects invalid SSN with 900+ area", async () => {
      const text = "SSN: 900-12-3456";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 0;
    });

    this.test("Rejects invalid SSN with 00 group", async () => {
      const text = "SSN: 123-00-3456";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 0;
    });

    this.test("Rejects invalid SSN with 0000 serial", async () => {
      const text = "SSN: 123-45-0000";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      return ssnEntities.length === 0;
    });

    this.test("Does not match SSN embedded in longer number", async () => {
      const text = "Account: 9123456789012";
      const entities = await detector.analyzePII(text);
      const ssnEntities = entities.filter((e) => e.entity_type === "ssn");
      // Should not match the 123456789 within the longer number
      return ssnEntities.length === 0;
    });

    console.log("");
  }

  // ============ INTEGRATION TESTS ============
  async runIntegrationTests() {
    console.log("🔗 Running Integration Tests...");

    this.test("Full SSN tokenization pipeline", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();

      const original = "Please send to SSN 123-45-6789 for processing.";
      const entities = [
        {
          entity_type: "ssn",
          start: 19,
          end: 30,
          text: "123-45-6789",
          score: 0.95,
        },
      ];

      const tokenized = await tokenizer.tokenizeText(original, entities);
      const detokenized = tokenizer.detokenizeText(tokenized);

      return detokenized === original;
    });

    this.test("Multiple PII types in same text", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();

      const original = "Contact john@test.com or call 555-123-4567";
      const entities = [
        {
          entity_type: "email",
          start: 8,
          end: 21,
          text: "john@test.com",
          score: 0.9,
        },
        {
          entity_type: "phone",
          start: 30,
          end: 42,
          text: "555-123-4567",
          score: 0.85,
        },
      ];

      const tokenized = await tokenizer.tokenizeText(original, entities);

      // Should have both email and phone tags
      return tokenized.includes("<email") && tokenized.includes("<phone");
    });

    this.test("Collision registry tracks tokens", async () => {
      const tokenizer = new PIITokenizerV2();
      await tokenizer.initialize();

      await tokenizer.generateToken("123-45-6789", "ssn");
      await tokenizer.generateToken("987-65-4321", "ssn");
      await tokenizer.generateToken("555-12-3456", "ssn");

      const stats = tokenizer.getTokenMappingStats();
      return stats.totalMappings === 3;
    });

    console.log("");
  }

  // ============ TEST HELPERS ============
  test(name, fn) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        result
          .then((passed) => {
            this.recordResult(name, passed);
          })
          .catch((error) => {
            this.recordResult(name, false, error.message);
          });
      } else {
        this.recordResult(name, result);
      }
    } catch (error) {
      this.recordResult(name, false, error.message);
    }
  }

  recordResult(name, passed, error = null) {
    if (passed) {
      console.log(`  ✅ ${name}`);
      this.passed++;
    } else {
      console.log(`  ❌ ${name}${error ? ": " + error : ""}`);
      this.failed++;
    }
    this.results.push({ name, passed, error });
  }

  printSummary() {
    console.log("\n" + "=".repeat(50));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total:  ${this.passed + this.failed}`);
    console.log(`Passed: ${this.passed} ✅`);
    console.log(`Failed: ${this.failed} ❌`);
    console.log("=".repeat(50));

    if (this.failed > 0) {
      console.log("\nFailed tests:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) =>
          console.log(`  - ${r.name}${r.error ? ": " + r.error : ""}`),
        );
    }
  }
}

// Export for browser
if (typeof window !== "undefined") {
  window.FPETests = FPETests;
  console.log(
    "🧪 FPE Test Suite loaded. Run with: const tests = new FPETests(); await tests.runAllTests();",
  );
}
