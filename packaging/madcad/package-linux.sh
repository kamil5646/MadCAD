#!/usr/bin/env bash
# Builds MadCAD for Linux x86_64 from this tree (a SolidCraft fork):
#   packaging/madcad/package-linux.sh [--skip-build]
#     -> dist/MadCAD-<version>-linux-x86_64.AppImage   any distro with glibc >= the build host's
#     -> dist/MadCAD-<version>-linux-x86_64.tar.gz     the programs, icon, menu entry and licences
# Build on an old distro (CI: Ubuntu 22.04, glibc 2.35) so the programs run on newer ones.
# appimagetool is downloaded into the target folder when it is not on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/packaging/madcad"
TARGET_DIR="${CARGO_TARGET_DIR:-$ROOT/target}"
VERSION="$(sed -n '/^\[workspace.package\]/,/^\[/s/^version = "\([^"]*\)"/\1/p' "$ROOT/Cargo.toml")"
ARCH="$(uname -m)"
[[ "$ARCH" == x86_64 ]] || { echo "MadCAD's Linux package is built on x86_64 (this is $ARCH)" >&2; exit 1; }
ID=pl.kamilkasprzak.madcad8
NAME="MadCAD-$VERSION-linux-$ARCH"
WORK="$TARGET_DIR/madcad-linux"
DIST="$ROOT/dist"

# A release build (update::release_build): the in-app update check and the usage statistics run.
export SOLIDCRAFT_VERSION="$VERSION"
[[ "${1:-}" == --skip-build ]] || (cd "$ROOT" && cargo build --locked --release -p solidcraft -p solidcraft-cli)
BIN="$TARGET_DIR/release"

rm -rf "$WORK"
mkdir -p "$DIST"

# ---- the AppDir: an FHS tree under usr/ ---------------------------------------------------------
APPDIR="$WORK/MadCAD.AppDir"
install -Dm755 "$BIN/solidcraft" "$APPDIR/usr/bin/madcad"
install -Dm755 "$BIN/solidcraft-cli" "$APPDIR/usr/bin/madcad-cli"
strip "$APPDIR/usr/bin/madcad" "$APPDIR/usr/bin/madcad-cli" 2>/dev/null || true
install -Dm644 "$HERE/linux/$ID.desktop" "$APPDIR/usr/share/applications/$ID.desktop"
for s in 16 24 32 48 64 128 256 512; do
  install -Dm644 "$HERE/linux/icons/$s.png" "$APPDIR/usr/share/icons/hicolor/${s}x${s}/apps/$ID.png"
done
# SolidCraft is MIT OR Apache-2.0: ship its licences and notices with the programs.
DOC="$APPDIR/usr/share/doc/madcad"
mkdir -p "$DOC"
cp "$ROOT/LICENSE-APACHE" "$ROOT/LICENSE-MIT" "$ROOT/NOTICE" "$ROOT/ATTRIBUTION.md" "$ROOT/THIRD-PARTY-LICENSES.txt" "$DOC/"
cp "$HERE/LICENSE-MadCAD.txt" "$DOC/LICENSE.txt"
cp "$ROOT/attribution/pending/madcad-branding.md" "$DOC/MadCAD-branding.md"
cp "$HERE/CONTINUATION-2026-11-01.md" "$DOC/MadCAD-changes.md"
if command -v desktop-file-validate >/dev/null; then
  desktop-file-validate "$APPDIR/usr/share/applications/$ID.desktop"
fi
"$APPDIR/usr/bin/madcad-cli" --version

# ---- .tar.gz: the same files in one folder ------------------------------------------------------
TAR="$WORK/tar/$NAME"
mkdir -p "$TAR"
cp "$APPDIR/usr/bin/madcad" "$APPDIR/usr/bin/madcad-cli" "$TAR/"
cp "$HERE/linux/$ID.desktop" "$TAR/"
cp "$HERE/linux/icons/256.png" "$TAR/madcad.png"
cp "$DOC"/* "$TAR/"
tar -C "$WORK/tar" -czf "$DIST/$NAME.tar.gz" "$NAME"
echo "$DIST/$NAME.tar.gz"

# ---- AppImage -----------------------------------------------------------------------------------
install -Dm755 "$HERE/linux/AppRun" "$APPDIR/AppRun"
cp "$HERE/linux/$ID.desktop" "$APPDIR/$ID.desktop"
cp "$HERE/linux/icons/256.png" "$APPDIR/$ID.png"
ln -s "$ID.png" "$APPDIR/.DirIcon"
TOOL="${APPIMAGETOOL:-$(command -v appimagetool || true)}"
if [[ -z "$TOOL" ]]; then
  TOOL="$TARGET_DIR/appimagetool-$ARCH.AppImage"
  if [[ ! -x "$TOOL" ]]; then
    curl -fsSL -o "$TOOL" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-$ARCH.AppImage"
    chmod +x "$TOOL"
  fi
fi
OUT="$DIST/$NAME.AppImage"
rm -f "$OUT"
# Extract-and-run: works without FUSE (containers, CI).
ARCH="$ARCH" APPIMAGE_EXTRACT_AND_RUN=1 "$TOOL" --no-appstream "$APPDIR" "$OUT"
chmod +x "$OUT"
echo "$OUT"
