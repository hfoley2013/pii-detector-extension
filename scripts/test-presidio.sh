#!/bin/bash

# Presidio Services Test Script
# Tests that Presidio services are working correctly

echo "🧪 Testing Presidio PII Detection Services..."

# Test data
TEST_TEXT="My name is John Doe and my email is john.doe@example.com. My phone number is 555-123-4567."

echo ""
echo "Test text: $TEST_TEXT"
echo ""

# Test Analyzer
echo "📊 Testing Presidio Analyzer..."
ANALYZER_RESPONSE=$(curl -s -X POST \
  http://localhost:5001/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"$TEST_TEXT\",
    \"language\": \"en\"
  }")

if [ $? -eq 0 ]; then
    echo "✅ Analyzer Response:"
    echo "$ANALYZER_RESPONSE" | jq '.' 2>/dev/null || echo "$ANALYZER_RESPONSE"
else
    echo "❌ Analyzer failed"
fi

echo ""

# Test Anonymizer
echo "🔒 Testing Presidio Anonymizer..."
ANONYMIZER_RESPONSE=$(curl -s -X POST \
  http://localhost:5002/anonymize \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"$TEST_TEXT\",
    \"anonymizers\": {
      \"DEFAULT\": { \"type\": \"replace\", \"new_value\": \"<ANONYMIZED>\" },
      \"PHONE_NUMBER\": { \"type\": \"replace\", \"new_value\": \"<PHONE_NUMBER>\" },
      \"EMAIL_ADDRESS\": { \"type\": \"replace\", \"new_value\": \"<EMAIL_ADDRESS>\" },
      \"PERSON\": { \"type\": \"replace\", \"new_value\": \"<PERSON>\" }
    },
    \"analyzer_results\": [
      {\"entity_type\": \"PERSON\", \"start\": 11, \"end\": 19, \"score\": 0.85},
      {\"entity_type\": \"EMAIL_ADDRESS\", \"start\": 37, \"end\": 58, \"score\": 1.0},
      {\"entity_type\": \"PHONE_NUMBER\", \"start\": 80, \"end\": 92, \"score\": 0.75}
    ]
  }")

if [ $? -eq 0 ]; then
    echo "✅ Anonymizer Response:"
    echo "$ANONYMIZER_RESPONSE" | jq '.' 2>/dev/null || echo "$ANONYMIZER_RESPONSE"
else
    echo "❌ Anonymizer failed"
fi

echo ""
echo "🎯 Test complete!"
echo ""
echo "If both services responded successfully, Presidio is ready for integration."