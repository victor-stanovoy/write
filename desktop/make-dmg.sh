#!/usr/bin/env bash
# Builds an ad-hoc-signed universal Wren.app and packs it into Wren.dmg. macOS only (needs hdiutil + codesign).
set -euo pipefail
cd "$(dirname "$0")"
rm -rf app dist && mkdir -p app && cp -R ../website/app/. app/ && rm -f app/sw.js
npx electron-builder --mac dir --universal -c.mac.target=dir
APP="$(find dist -maxdepth 2 -name Wren.app | head -1)"
# Apple silicon refuses to run unsigned code, so apply an ad-hoc signature (not notarized).
codesign --force --deep --sign - "$APP"
rm -rf dist/stage && mkdir -p dist/stage
cp -R "$APP" dist/stage/
ln -s /Applications dist/stage/Applications
hdiutil create -volname "Wren" -srcfolder dist/stage -ov -format UDZO dist/Wren.dmg
echo "Built: $(pwd)/dist/Wren.dmg"
