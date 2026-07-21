# Scheduled jobs (cron)

CandidAI's scheduled endpoints live in the Next.js app (`site/src/app/api/cron/*`)
and run **on Vercel**, but they are **triggered from the VPS system crontab**.

## Why not Vercel Crons?

The project is on the Vercel **Hobby** plan, which only allows crons that run
**once per day**. The onboarding lifecycle jobs need to run **hourly**, so a
`vercel.json` with hourly crons fails every deployment. Instead of upgrading to
Pro, the VPS (which is always on) `curl`s the endpoints on schedule. The heavy
lifting still happens in the Vercel functions — the VPS only makes an
authenticated HTTP call.

## Schedule (`crontab`)

| Endpoint                     | Schedule      | Frequency        |
| ---------------------------- | ------------- | ---------------- |
| `/api/cron/analytics-digest` | `0 8 * * *`   | daily, 08:00 UTC |
| `/api/cron/onboarding-sequence` | `0 * * * *` | hourly           |
| `/api/cron/onboarding-health`   | `20 * * * *`| hourly, at :20   |

## Auth

The cron routes accept `Authorization: Bearer <token>` where the token is
`CRON_SECRET` or `SESSION_API_KEY`. The trigger script reads `SESSION_API_KEY`
from `/root/CandidAI/.env.local` (already present on the VPS).

## Install on a (new) VPS

```bash
cd /root/CandidAI
git pull
bash server/ops/cron/install.sh
```

`install.sh` is idempotent: it copies the trigger script to
`/root/cron/candidai-lifecycle-cron.sh` and refreshes the crontab block,
preserving unrelated cron lines. Output is logged to
`/root/cron/candidai-lifecycle-cron.log`.

## Prerequisites on the box

- `/root/CandidAI/.env.local` contains a valid `SESSION_API_KEY` that matches the
  one configured in the Vercel project (otherwise the endpoints return `401`).
- Outbound HTTPS to `https://candidai.tech`.
