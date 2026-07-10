#!/usr/bin/env bash
# Install NIOS nightly benchmark cron (02:00 daily)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NIGHTLY="$SCRIPT_DIR/nios_nightly.sh"
MARKER="# nios-nightly-benchmark"
CRON_LINE="0 2 * * * $NIGHTLY >> $SCRIPT_DIR/../data/nios_nightly.log 2>&1 $MARKER"

if crontab -l 2>/dev/null | grep -q "$MARKER"; then
  echo "NIOS nightly cron already installed"
  exit 0
fi

(crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -
echo "Installed: $CRON_LINE"
