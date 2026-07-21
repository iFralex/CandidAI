This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Lifecycle email operations

The production Resend webhook must point to:

```text
https://candidai.tech/api/resend-webhook
```

Subscribe it to `email.sent`, `email.delivered`, `email.delivery_delayed`,
`email.failed`, `email.suppressed`, `email.bounced`, `email.complained`,
`email.opened`, and `email.clicked`, then expose its signing secret as
`RESEND_WEBHOOK_SECRET`. The endpoint verifies the raw Svix signature and uses
`svix-id` as its idempotency key.

The hourly `/api/cron/onboarding-health` check writes the current state to
`_system/operational_health` and emails `ANALYTICS_RECIPIENT_EMAIL` (falling
back to `CONTACT_EMAIL`) when the lifecycle cron is stale, communications are
stuck, delivery failures spike, recruiter search becomes slow, or the realtime
preview pipeline begins failing.
