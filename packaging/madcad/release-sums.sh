#!/usr/bin/env bash
# SHA256SUMS.txt for a release's files, as the in-app updater checks them (`<hex>  <name>`).
#   bash packaging/madcad/release-sums.sh <file>... > SHA256SUMS.txt
set -euo pipefail
for f in "$@"; do
  printf '%s  %s\n' "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$(basename "$f")"
done
