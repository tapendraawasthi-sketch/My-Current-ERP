#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Mobile Khata: Capacitor Setup ==="

echo "[1/6] Installing dependencies..."
npm install

echo "[2/6] Building web assets..."
npm run build

echo "[3/6] Ensuring Android platform package..."
npm install @capacitor/android@^6.0.0 --save-dev 2>/dev/null || true

echo "[4/6] Adding Android platform..."
npx cap add android 2>/dev/null || echo "Android platform already exists"

echo "[5/6] Syncing web assets to Android..."
npx cap sync android

echo "[6/6] Running Capacitor doctor..."
npx cap doctor

echo ""
echo "=== Setup complete ==="
echo "To open in Android Studio: npx cap open android"
echo "To run on device:          npx cap run android"
echo "To build APK:              npm run build:android"
