#!/bin/bash
# Triggers a CandidAI scheduled endpoint from the VPS.
#
# Why this exists: the Vercel Hobby plan can only run crons once per day, but the
# onboarding lifecycle jobs need to run hourly. So the VPS system crontab invokes
# these endpoints on schedule. The functions themselves still execute on Vercel;
# this script only performs an authenticated HTTP call.
#
# Usage: candidai-lifecycle-cron.sh /api/cron/<name>
set -u

ENV_FILE=/root/CandidAI/.env.local
LOG=/root/cron/candidai-lifecycle-cron.log
BASE="https://candidai.tech"
ENDPOINT="${1:?usage: $0 /api/cron/<name>}"

# Read the shared secret from the backend env without printing it.
# The cron routes accept CRON_SECRET or SESSION_API_KEY as the bearer token.
KEY=$(sed -n 's/^SESSION_API_KEY=//p' "$ENV_FILE" | head -1 | sed 's/^"//; s/"$//')

ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
body=$(mktemp)
code=$(curl -sS -o "$body" -w "%{http_code}" -m 130 -X GET \
  -H "Authorization: Bearer ${KEY}" "${BASE}${ENDPOINT}")
printf '%s %s -> HTTP %s %s\n' "$ts" "$ENDPOINT" "$code" "$(head -c 300 "$body" | tr '\n' ' ')" >> "$LOG"
rm -f "$body"
