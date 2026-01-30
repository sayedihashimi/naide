#!/bin/bash

# Script to run Naide in development mode
# This starts both the sidecar and the Tauri app

set -e

echo "Starting Naide development environment..."

# Check if node_modules exist in both projects
if [ ! -d "src/copilot-sidecar/node_modules" ]; then
  echo "Installing sidecar dependencies..."
  cd src/copilot-sidecar && npm install && cd ../..
fi

if [ ! -d "src/naide-desktop/node_modules" ]; then
  echo "Installing desktop app dependencies..."
  cd src/naide-desktop && npm install && cd ../..
fi

# Build the sidecar
echo "Building sidecar..."
cd src/copilot-sidecar && npm run build && cd ../..

# Start the sidecar in the background
echo "Starting sidecar on http://localhost:3001..."
cd src/copilot-sidecar && npm start &
SIDECAR_PID=$!
cd ../..

# Give the sidecar a moment to start
sleep 2

# Cleanup function
cleanup() {
  echo "Stopping sidecar..."
  kill $SIDECAR_PID 2>/dev/null || true
  exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT SIGTERM

# Start the Tauri app
echo "Starting Tauri app..."
cd src/naide-desktop
npm run tauri:dev

# Cleanup when Tauri exits
cleanup
