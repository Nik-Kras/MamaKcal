#!/bin/sh
# Release APK for the S21 (arm64 only), with source maps uploaded to Sentry.
# The Sentry token is read from the git-ignored .env.sentry-build-plugin.
set -e
cd "$(dirname "$0")/.."
if [ -f .env.sentry-build-plugin ]; then
  set -a
  . ./.env.sentry-build-plugin
  set +a
else
  echo "No .env.sentry-build-plugin: building without uploading source maps to Sentry."
  export SENTRY_DISABLE_AUTO_UPLOAD=true
fi
CI=1 npx expo prebuild --platform android
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
echo "→ android/app/build/outputs/apk/release/app-release.apk"
