#!/bin/bash
# Installs (or updates) the CandidAI scheduled jobs into the VPS system crontab.
#
# Idempotent: it removes any previous CandidAI cron lines (identified by the
# trigger script path) and re-adds the ones defined in ./crontab, preserving any
# unrelated cron lines the box may already have.
#
# Run on the VPS after a git pull:  bash server/ops/cron/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p /root/cron
install -m 0755 "$SCRIPT_DIR/candidai-lifecycle-cron.sh" /root/cron/candidai-lifecycle-cron.sh

tmp="$(mktemp)"
# Keep existing crontab lines that are not ours (all our lines reference the script).
crontab -l 2>/dev/null | grep -v 'candidai-lifecycle-cron.sh' > "$tmp" || true
cat "$SCRIPT_DIR/crontab" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"

echo "Installed CandidAI crons:"
crontab -l | grep 'candidai-lifecycle-cron.sh'
