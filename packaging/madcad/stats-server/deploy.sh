#!/usr/bin/env bash
# MadCAD usage statistics: upload the receiver (api/stats/v1) and the dashboard (/statystyki/) to
# madcad.madmagsystem.pl. Data and the dashboard password hash stay in private_data/madcad-stats.
set -euo pipefail
cd "$(dirname "$0")"
H=madmagsystem-ssh
R=domains/madcad.madmagsystem.pl/public_html
try() { for i in 1 2 3 4 5; do "$@" && return 0; sleep $((i * 5)); done; return 1; }
try ssh "$H" "mkdir -p $R/api/stats/v1 $R/statystyki"
try scp -q api/index.php "$H:$R/api/stats/v1/index.php"
try scp -q statystyki/index.php statystyki/style.css statystyki/commands-pl.php "$H:$R/statystyki/"
echo "deployed: https://madcad.madmagsystem.pl/statystyki/"
