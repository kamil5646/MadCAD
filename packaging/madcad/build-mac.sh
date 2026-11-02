#!/usr/bin/env bash
# Builds MadCAD.app and a DMG for Apple Silicon from this tree (a SolidCraft fork).
# Unsigned by Apple (ad-hoc signature only), like the earlier MadCAD releases.
#   packaging/madcad/build-mac.sh <version>        -> dist/MadCAD-<version>-mac-arm64.{dmg,zip}
set -euo pipefail

VERSION="${1:?usage: build-mac.sh <version>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/packaging/madcad"
BUNDLE_ID="pl.kamilkasprzak.madcad8"
TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/target}"
WORK="$TARGET_DIR/madcad-package"
DIST="$ROOT/dist"
APP="$WORK/MadCAD.app"

# Refuse mismatched metadata and accidental Intel builds under an arm64 asset name.
WORKSPACE_VERSION="$(sed -n '/^\[workspace.package\]/,/^\[/s/^version = "\([^"]*\)"/\1/p' "$ROOT/Cargo.toml")"
[[ "$VERSION" == "$WORKSPACE_VERSION" ]] || { echo "Version must match Cargo.toml ($WORKSPACE_VERSION)" >&2; exit 1; }
[[ "$(uname -m)" == arm64 ]] || { echo "This package requires an Apple Silicon host" >&2; exit 1; }
export MACOSX_DEPLOYMENT_TARGET=11.0
(cd "$ROOT" && cargo build --locked --release -p solidcraft -p solidcraft-cli)

rm -rf "$WORK"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Licenses" "$DIST"
cp "$TARGET_DIR/release/solidcraft" "$APP/Contents/MacOS/MadCAD"
cp "$TARGET_DIR/release/solidcraft-cli" "$APP/Contents/MacOS/solidcraft-cli"
cp "$HERE/madcad.icns" "$APP/Contents/Resources/MadCAD.icns"
# SolidCraft is MIT OR Apache-2.0: ship its licences and notices with the app.
cp "$ROOT/LICENSE-APACHE" "$ROOT/LICENSE-MIT" "$ROOT/NOTICE" "$ROOT/ATTRIBUTION.md" "$ROOT/THIRD-PARTY-LICENSES.txt" "$APP/Contents/Resources/Licenses/"

cp "$ROOT/attribution/pending/madcad-branding.md" "$APP/Contents/Resources/Licenses/MadCAD-branding.md"
cp "$HERE/CONTINUATION-2026-11-01.md" "$APP/Contents/Resources/Licenses/MadCAD-changes.md"

# Info.plist from the upstream template with MadCAD's name, identifier and icon. MadCAD opens
# SolidCraft designs as an alternative editor, so an installed SolidCraft keeps owning them.
sed -e "s/@VERSION@/$VERSION/g" -e "s/@SHORT_VERSION@/${VERSION%%-*}/g" \
    -e "s#<string>SolidCraft</string>#<string>MadCAD</string>#g" \
    -e "s#<string>io.tangencylabs.solidcraft</string>#<string>$BUNDLE_ID</string>#" \
    -e "s#<string>Owner</string>#<string>Alternate</string>#g" \
    "$ROOT/assets/platforms/macos/Info.plist.in" >"$APP/Contents/Info.plist"
plutil -lint "$APP/Contents/Info.plist"
printf 'APPL????' >"$APP/Contents/PkgInfo"

codesign --force --sign - "$APP/Contents/MacOS/solidcraft-cli"
codesign --force --sign - --entitlements "$ROOT/packaging/macos/entitlements.plist" "$APP"
"$APP/Contents/MacOS/MadCAD" --version

ZIP="$DIST/MadCAD-$VERSION-mac-arm64.zip"
DMG="$DIST/MadCAD-$VERSION-mac-arm64.dmg"
rm -f "$ZIP" "$DMG"
ditto -c -k --keepParent "$APP" "$ZIP"
STAGE="$WORK/dmg"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
# hdiutil sometimes fails right after signing (busy volume); a second try goes through.
for try in 1 2 3; do
  hdiutil create -quiet -volname "MadCAD $VERSION" -srcfolder "$STAGE" -ov -format UDZO "$DMG" && break
  [[ $try == 3 ]] && exit 1
  sleep 3
done
(cd "$DIST" && shasum -a 256 "${ZIP##*/}" "${DMG##*/}" > SHA256SUMS.txt)
echo "$ZIP"
echo "$DMG"
