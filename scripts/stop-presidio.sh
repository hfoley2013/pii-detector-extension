#!/bin/bash

# Presidio Services Shutdown Script
# This script stops the Presidio services

echo "🛑 Stopping Presidio PII Detection Services..."

# Stop the services
docker-compose down

echo "✅ Presidio services stopped"

# Optional: Remove containers and networks
read -p "Remove containers and networks? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose down --volumes --remove-orphans
    echo "✅ Containers and networks removed"
fi