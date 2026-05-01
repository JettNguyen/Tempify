#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Replace these or export ASC_API_KEY / ASC_API_ISSUER in your shell.
ASC_API_KEY="${ASC_API_KEY:-YOUR_APP_STORE_CONNECT_API_KEY_ID}"
ASC_API_ISSUER="${ASC_API_ISSUER:-YOUR_APP_STORE_CONNECT_ISSUER_ID}"

WORKSPACE="ios/App/App.xcworkspace"
SCHEME="App"
ARCHIVE_PATH="./build/App.xcarchive"
EXPORT_PATH="./build"
INFO_PLIST="ios/App/App/Info.plist"
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
EXPORT_OPTIONS_PLIST="./exportOptions.plist"

get_web_dir() {
  node --input-type=module -e "
    import fs from 'node:fs';
    const candidates = ['capacitor.config.ts', 'capacitor.config.js', 'capacitor.config.mjs', 'capacitor.config.cjs', 'capacitor.config.json'];
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      if (file.endsWith('.json')) {
        const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log(cfg.webDir || 'dist');
        process.exit(0);
      }
    }
    console.log('dist');
  "
}

WEB_DIR="$(get_web_dir)"
mkdir -p "$WEB_DIR"

if [[ -d "dist" ]]; then
  rm -rf "$WEB_DIR"/*
  cp -R dist/. "$WEB_DIR"/
else
  echo "Error: dist/ not found. Run npm run build first."
  exit 1
fi

echo "Using webDir: $WEB_DIR"

npx cap copy ios

CURRENT_BUNDLE_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$INFO_PLIST" 2>/dev/null || true)"
if [[ "$CURRENT_BUNDLE_VERSION" =~ ^[0-9]+$ ]]; then
  NEW_BUNDLE_VERSION=$((CURRENT_BUNDLE_VERSION + 1))
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUNDLE_VERSION" "$INFO_PLIST"
  echo "CFBundleVersion incremented to $NEW_BUNDLE_VERSION"
else
  CURRENT_PROJECT_VERSION="$(grep -m1 'CURRENT_PROJECT_VERSION = ' "$PBXPROJ" | sed -E 's/.*= ([0-9]+);/\1/')"
  if [[ "$CURRENT_PROJECT_VERSION" =~ ^[0-9]+$ ]]; then
    NEW_PROJECT_VERSION=$((CURRENT_PROJECT_VERSION + 1))
    sed -i '' -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = $NEW_PROJECT_VERSION;/g" "$PBXPROJ"
    echo "CFBundleVersion uses a build variable; incremented CURRENT_PROJECT_VERSION to $NEW_PROJECT_VERSION"
  else
    echo "Warning: Could not increment CFBundleVersion automatically"
  fi
fi

if [[ -n "${NEW_MARKETING_VERSION:-}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${NEW_MARKETING_VERSION}" "$INFO_PLIST" || \
  /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string ${NEW_MARKETING_VERSION}" "$INFO_PLIST"
  echo "CFBundleShortVersionString set to $NEW_MARKETING_VERSION"
fi

cat > "$EXPORT_OPTIONS_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>destination</key>
  <string>export</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>stripSwiftSymbols</key>
  <true/>
  <key>uploadBitcode</key>
  <false/>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
PLIST

mkdir -p ./build

xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -archivePath "$ARCHIVE_PATH" \
  -configuration Release

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"

IPA_PATH="./build/App.ipa"
if [[ ! -f "$IPA_PATH" ]]; then
  IPA_PATH="$(find ./build -maxdepth 2 -name '*.ipa' | head -n 1)"
fi

if [[ -z "${IPA_PATH:-}" || ! -f "$IPA_PATH" ]]; then
  echo "Error: IPA not found after export."
  exit 1
fi

xcrun altool --validate-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$ASC_API_KEY" \
  --apiIssuer "$ASC_API_ISSUER"

echo "IPA ready: $IPA_PATH"
