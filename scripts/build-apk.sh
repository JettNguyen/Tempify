#!/usr/bin/env bash
# Builds the Tempify APK for Android on this Mac, signed with Tempify's own
# release key. The version comes from the Xcode project, so set it there first.
# docs/RELEASING.md has where the APK goes after.
#
# What it needs, installed on November 20, 2026:
#   brew install openjdk@21
#   brew install --cask android-commandlinetools
#   sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
#
# Usage: ./scripts/build-apk.sh [/path/to/Tempify.apk]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:$PATH"
export JAVA_HOME="${JAVA_HOME_21:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# The key sits outside every repo, beside the App Store key. Lose it and no
# later APK can install over the ones people have, so keep a backup of it.
export TEMPIFY_KEYSTORE="${TEMPIFY_KEYSTORE:-$ROOT/../tempify-android.jks}"
if [ ! -f "$TEMPIFY_KEYSTORE" ]; then
  echo "The release key isn't at $TEMPIFY_KEYSTORE. Restore it from its backup; making a new one breaks updates."
  exit 1
fi
TEMPIFY_KEYSTORE_PASSWORD="$(security find-generic-password -s tempify-android-keystore -w)"
export TEMPIFY_KEYSTORE_PASSWORD

if [ ! -x "$JAVA_HOME/bin/java" ] || [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
  echo "Java 21 or the Android SDK is missing. The top of this script lists what to install."
  exit 1
fi

OUT="${1:-${TMPDIR:-/tmp}/Tempify.apk}"

npm run build
npx cap sync android
(cd android && caffeinate -i ./gradlew --no-daemon assembleRelease)

APK="android/app/build/outputs/apk/release/app-release.apk"
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify "$APK"
cp "$APK" "$OUT"
echo "Built $OUT"
