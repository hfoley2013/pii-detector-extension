#!/bin/bash

# Presidio Services Startup Script
# This script pulls the latest Presidio images and starts the services

echo "🔧 Starting Presidio PII Detection Services..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "📥 Pulling latest Presidio images..."

# Pull the latest images
docker pull mcr.microsoft.com/presidio-analyzer:latest
docker pull mcr.microsoft.com/presidio-anonymizer:latest

echo "🚀 Starting Presidio services..."

# Start the services
docker-compose up -d

echo "⏳ Waiting for services to start..."

# Wait for services to be healthy
echo "Checking Presidio Analyzer..."
for i in {1..30}; do
    if curl -f http://localhost:5001/health > /dev/null 2>&1; then
        echo "✅ Presidio Analyzer is ready"
        break
    fi
    echo "   Attempt $i/30: Waiting for analyzer..."
    sleep 2
done

echo "Checking Presidio Anonymizer..."
for i in {1..30}; do
    if curl -f http://localhost:5002/health > /dev/null 2>&1; then
        echo "✅ Presidio Anonymizer is ready"
        break
    fi
    echo "   Attempt $i/30: Waiting for anonymizer..."
    sleep 2
done

echo ""
echo "🎉 Presidio services are running!"
echo ""
echo "Service URLs:"
echo "  Analyzer:   http://localhost:5001"
echo "  Anonymizer: http://localhost:5002"
echo ""
echo "Health checks:"
echo "  curl http://localhost:5001/health"
echo "  curl http://localhost:5002/health"
echo ""
echo "To stop services: docker-compose down"
echo "To view logs: docker-compose logs -f"