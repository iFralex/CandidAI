# CandidAI — Technical Documentation

> This document is intended as a complete reference for LLMs assisting with development. It covers architecture, file structure, database schema, workflows, API routes, authentication, and all key patterns.

---

## 1. PROJECT OVERVIEW

**CandidAI** is a full-stack SaaS application that uses AI to help job seekers generate personalized cold emails to recruiters. The user provides target companies and their CV; the platform finds recruiters at those companies and generates tailored outreach emails using LLMs.

**Core value proposition:**
1. User submits a list of target companies + their CV
2. CandidAI finds relevant recruiters via People Data Labs / RocketReach
3. An external Python server generates personalized emails via OpenRouter LLM
4. User reviews, customizes, and sends emails from the dashboard

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5.12 (App Router, Turbopack) |
| Language | TypeScript 5 (strict mode) |
| React | React 19.2.4 (Server + Client Components) |
| Styling | Tailwind CSS 4 + PostCSS |
| UI Primitives | Radix UI (checkbox, dialog, popover, tooltip, etc.) |
| Icons | lucide-react 0.544.0 |
| Animations | motion 12.23.22 (Framer Motion successor) |
| Database | Firebase Firestore (NoSQL) |
| Authentication | Firebase Auth + next-firebase-auth-edge 1.11.1 |
| File Storage | Firebase Storage |
| Payments | Stripe 20.0.0 + Nexi (Italian provider) |
| Profile Enrichment | People Data Labs (PDL) 14.0.0 |
| LLM Orchestration | OpenRouter API (external server handles generation) |
| Recruiter Data | RocketReach API |
| Transactional Email | Resend 6.5.2 |
| Skill Translation | Google Translate API (via Firebase API key) |
| Email Generation Server | External Python server at `SERVER_RUNNER_URL` |

---

## 3. FILE STRUCTURE

```
CandidAI/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth route group (no shared layout)
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── forgot-password/page.tsx
│   │   ├── api/                      # API route handlers
│   │   │   ├── auth/route.ts         # Login/Register via Firebase REST
│   │   │   ├── auth/forgot-password/route.ts
│   │   │   ├── protected/            # Auth-gated API endpoints
│   │   │   │   ├── user/route.ts
│   │   │   │   ├── account/route.ts
│   │   │   │   ├── results/route.ts
│   │   │   │   ├── result/[resultId]/route.ts
│   │   │   │   ├── emails/route.ts
│   │   │   │   ├── sent_emails/route.ts
│   │   │   │   ├── all_details/route.ts
│   │   │   │   └── nexi-payment/route.ts
│   │   │   ├── create-subscription/route.ts   # Stripe
│   │   │   ├── payment-confirm/route.ts
│   │   │   ├── refresh-user/route.ts
│   │   │   ├── send-email/route.ts   # Resend transactional emails
│   │   │   └── stripe-webhook/route.ts
│   │   ├── dashboard/
│   │   │   ├── page.tsx              # Campaign overview
│   │   │   ├── [id]/page.tsx         # Individual campaign detail
│   │   │   └── send-all/page.tsx     # Bulk send page
│   │   ├── docs/                     # Public documentation pages
│   │   ├── verify/[id]/page.tsx      # Email verification
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing page
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                       # Radix-based reusable primitives
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── label.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── hover-card.tsx
│   │   │   ├── command.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── progress.tsx
│   │   ├── landing.tsx               # Marketing landing page (client)
│   │   ├── login-form.tsx            # Auth forms: login, register, forgot-pw (client)
│   │   ├── onboarding.tsx            # Multi-step onboarding UI (client)
│   │   ├── onboardingServer.tsx      # Onboarding server wrapper (server)
│   │   ├── dashboard.tsx             # Main dashboard UI (client)
│   │   ├── dashboardServer.tsx       # Dashboard server wrapper (server)
│   │   ├── detailsServer.tsx         # Campaign detail server component
│   │   └── SidebarClientWrapper.tsx  # Sidebar navigation (client)
│   │
│   ├── actions/                      # Next.js Server Actions
│   │   ├── onboarding-actions.ts     # Core business logic (see §7)
│   │   └── pdl.ts                    # People Data Labs + Google Translate
│   │
│   ├── hooks/
│   │   └── use-mobile.ts             # Responsive breakpoint hook
│   │
│   ├── lib/
│   │   ├── firebase.ts               # Firebase client SDK init
│   │   ├── firebase-admin.ts         # Firebase Admin SDK init (server only)
│   │   ├── server-auth.ts            # Auth helpers for server components
│   │   ├── pdlClient.ts              # PDL API client init
│   │   ├── utils.ts                  # cn(), general utilities
│   │   └── utils-server.ts           # Server-only utilities (auth, Firestore helpers)
│   │
│   ├── config.ts                     # App config: plans, pricing, cookie settings
│   └── middleware.ts                 # Edge middleware: auth + referral cookie
│
├── public/                           # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── .env.local                        # Environment variables (never committed)
```

---

## 4. DATABASE SCHEMA (FIRESTORE)

There is **no SQL database** and **no Prisma**. All data is stored in **Firebase Firestore** (NoSQL, document-based).

### Top-Level Structure

```
firestore root
└── users/
    └── {uid}/                         # One document per user
        ├── [user fields]
        ├── data/                      # Sub-collection: application data
        │   ├── account/               # Sub-collection
        │   │   └── [document]         # Account setup data
        │   ├── results/               # Sub-collection
        │   │   └── {companyId}/       # One doc per target company
        │   │       └── [sub-collections per company]
        │   ├── emails/                # Sub-collection
        │   │   └── {companyId}/       # Generated email per company
        │   └── changed_companies/     # Sub-collection
        │       └── {companyId}/       # Old company data before change
        └── payments/                  # Sub-collection
            └── {paymentId}/           # One doc per payment event
```

---

### `users/{uid}` — User Document

```typescript
{
  email: string,
  name: string,
  createdAt: Timestamp,
  lastLogin: Timestamp,
  emailVerified: boolean,
  onboardingStep: number,     // 0 = fresh, 50 = onboarding complete
  plan: "free_trial" | "base" | "pro" | "ultra",
  billingType: "monthly" | "biennial" | "quintennial" | "lifetime",
  credits: number,            // Deducted for premium actions
  expirate: Timestamp,        // Subscription expiry date
  picture: string,            // Profile image URL (Google or Firebase Storage)
}
```

---

### `users/{uid}/data/account/{docId}` — Account Setup Data

```typescript
{
  companies: Array<{ name: string, domain: string }>,  // Target companies
  cvUrl: string,              // Signed Firebase Storage URL for uploaded CV
  queries: Array<{            // Recruiter search strategies (user-defined)
    // criteria filters used by external server to find recruiters
  }>,
  customizations: {
    tone: string,             // Email tone (e.g., "professional", "casual")
    length: string,           // Email length preference
    instructions: string,     // Custom LLM prompt instructions
  },
  // Profile fields (populated from CV or PDL enrichment):
  skills: string[],
  experience: Array<{ title: string, company: string, duration: string }>,
  education: Array<{ degree: string, school: string }>,
  // ... other profile fields
}
```

---

### `users/{uid}/data/results/{companyId}` — Campaign Result (Root Doc)

This root document holds a high-level summary. Sub-collections hold detailed data.

```typescript
// Root document at results/{companyId}
{
  company: {
    name: string,
    domain: string,
    // ...other company fields
  },
  recruiter: {
    name: string,
    job_title: string,
    email: string,
    // ...other recruiter fields
  },
  blog_articles: number,      // Count of company blog posts referenced
  email_sent: boolean | Timestamp,  // false = ready, Timestamp = sent, missing = processing
  start_date: Timestamp,      // When campaign generation started
}

// Also at root results/ document (not a company document):
{
  companies_to_confirm: string[],  // companyIds awaiting user approval
}
```

---

### `users/{uid}/data/results/{companyId}/details` — Full Campaign Details

```typescript
{
  company: { /* full company data */ },
  recruiter: { /* full recruiter data with email */ },
  email: {
    subject: string,
    body: string,             // HTML email body
  },
  prompt: string,             // LLM prompt used (premium unlock required to view)
  // ...all enriched data from PDL/RocketReach
}
```

---

### `users/{uid}/data/results/{companyId}/row` — Dashboard Row Summary

```typescript
{
  // Lightweight summary for rendering dashboard list without loading full details
  companyName: string,
  recruiterName: string,
  status: string,
  email_sent: boolean | Timestamp,
}
```

---

### `users/{uid}/data/results/{companyId}/customizations` — Per-Company Overrides

```typescript
{
  queries: [],           // Company-specific recruiter search overrides
  instructions: string,  // Company-specific email instructions
}
```

---

### `users/{uid}/data/results/{companyId}/unlocked` — Premium Feature Unlocks

```typescript
{
  view_prompt: boolean,        // 100 credits to unlock
  // other unlockable features
}
```

---

### `users/{uid}/data/emails/{companyId}` — Generated Email Store

```typescript
{
  subject: string,
  body: string,
  email_sent: boolean | Timestamp,
}
```

---

### `users/{uid}/payments/{paymentId}` — Payment Records

```typescript
{
  type: "one_time" | "recurring",
  amount: number,              // In cents (e.g., 2900 = €29.00)
  currency: "eur",
  status: "succeeded",
  planId: string,              // e.g., "pro"
  billingType: string,         // e.g., "monthly"
  createdAt: Timestamp,
  subscriptionId: string | null,  // Stripe subscription ID (null for one-time)
  payment_method: string,
}
```

---

## 5. AUTHENTICATION FLOW

The app uses **Firebase Authentication** for identity, combined with **next-firebase-auth-edge** to bridge Firebase tokens into Next.js middleware-compatible signed cookies.

### Login / Register Flow

```
User submits form
      ↓
POST /api/auth  (Next.js API route)
      ↓
Firebase REST API (identitytoolkit v1)
  → signInWithPassword OR signUp
      ↓
Returns { idToken, refreshToken }
      ↓
Frontend calls POST /api/login
  with Authorization: Bearer {idToken}
      ↓
next-firebase-auth-edge validates token
  → signs + sets HttpOnly cookie "AuthToken"
      ↓
User is authenticated — cookie sent with all requests
```

### Google OAuth Flow

```
User clicks "Login with Google"
      ↓
signInWithPopup (Firebase Client SDK)
      ↓
Redirect result handler extracts idToken
      ↓
Same as above from "Frontend calls POST /api/login"
```

### Protected Route / API Guard

```
Incoming request with "AuthToken" cookie
      ↓
middleware.ts (Edge) — validates token via next-firebase-auth-edge
      ↓
Protected API routes:
  const tokens = await getTokens(request.cookies, config);
  if (!tokens?.decodedToken) return 401;
  const uid = tokens.decodedToken.uid;
```

### Cookie Configuration (`src/config.ts`)

```typescript
{
  cookieName: "AuthToken",
  cookieSignatureKeys: [
    process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT,
    process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS,
  ],
  cookieSerializeOptions: {
    httpOnly: true,
    secure: process.env.USE_SECURE_COOKIES === "true",
    sameSite: "lax",
    maxAge: 12 * 24 * 60 * 60,  // 12 days in seconds
    path: "/",
  },
}
```

---

## 6. API ROUTES REFERENCE

### Public Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth` | Email/password login or register (Firebase REST) |
| POST | `/api/auth/forgot-password` | Send password reset link |
| POST | `/api/send-email` | Send transactional email via Resend |
| POST | `/api/stripe-webhook` | Handle Stripe webhook events |
| POST | `/api/create-subscription` | Create Stripe subscription or payment intent |
| POST | `/api/payment-confirm` | Confirm payment (basic acknowledgment) |
| POST | `/api/refresh-user` | Refresh auth token via cookie |

### Protected Routes (require valid `AuthToken` cookie)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/protected/user` | Fetch authenticated user profile |
| PUT | `/api/protected/user` | Update user profile (name) |
| GET | `/api/protected/account` | Fetch account setup data (companies, queries, CV URL) |
| GET | `/api/protected/results` | Fetch all campaign results with stats |
| GET | `/api/protected/result/[resultId]` | Fetch detailed data for one company campaign |
| GET | `/api/protected/emails` | Fetch all generated emails |
| GET | `/api/protected/sent_emails` | Fetch tracking data for sent emails |
| POST | `/api/protected/all_details` | Batch fetch full details for multiple companies |
| POST | `/api/protected/nexi-payment` | Process payment via Nexi (Italian provider) |

---

## 7. SERVER ACTIONS (`src/actions/onboarding-actions.ts`)

Server Actions are the primary way the client triggers mutations. They run server-side, validate auth, and write to Firestore.

| Action | Credits Cost | Purpose |
|---|---|---|
| `selectPlan(planId, billingType)` | 0 | Save selected plan during onboarding |
| `submitCompanies(companies)` | 0 | Save target companies array |
| `submitProfile(cvUrl, profileData)` | 0 | Save CV URL + profile fields |
| `submitQueries(queries)` | 0 | Save recruiter search strategies |
| `completeOnboarding()` | 0 | Mark onboarding complete (step → 50), trigger server |
| `startServer(userId)` | 0 | POST to `SERVER_RUNNER_URL` (Python server) |
| `regenerateEmail(companyId)` | 50 | Request new email for a company |
| `refindRecruiter(companyId)` | 100 | Request new recruiter match for a company |
| `confirmCompany(companyId, action)` | 70 | Approve or reject a company match |
| `submitEmailSent(companyId)` | 0 | Mark email as sent, set timestamp |
| `payCredits(companyId, feature)` | varies | Unlock premium feature (deducts credits) |

All actions follow the pattern:
```typescript
'use server'
export async function actionName(args) {
  const userId = await checkAuth();  // Throws if not authenticated
  const batch = adminDb.batch();
  // ... batch operations
  await batch.commit();
}
```

---

## 8. ONBOARDING WORKFLOW

The onboarding flow is tracked via `onboardingStep` on the user document:
- `0` = new user, not started
- `1-49` = in progress (specific steps tracked internally)
- `50` = onboarding complete, redirect to dashboard

### Steps

1. **Plan Selection** — User picks plan (`free_trial`, `base`, `pro`, `ultra`) and billing type
2. **Company Input** — User enters target company names + domains (e.g., `stripe.com`)
3. **CV Upload** — User uploads PDF CV → stored in Firebase Storage → URL saved
4. **Profile Setup** — Skills, experience, education (pre-filled from PDL enrichment if LinkedIn provided)
5. **Recruiter Strategy** — Define search criteria for recruiter discovery
6. **Email Customization** — Set tone, length, custom instructions for LLM
7. **Launch** — `completeOnboarding()` → `startServer()` → Python server begins processing

---

## 9. CAMPAIGN GENERATION WORKFLOW

```
completeOnboarding() or user triggers regeneration
        ↓
POST {SERVER_RUNNER_URL}/run_module
  with { userId, proxy_pass: PROXY_PASS }
        ↓
External Python Server:
  1. Fetches user data from Firestore
  2. Uses PDL + RocketReach to find recruiters at target companies
  3. Scrapes company blog/news articles for personalization
  4. Calls OpenRouter LLM to generate personalized email
  5. Writes results to Firestore:
     users/{uid}/data/results/{companyId}/details
     users/{uid}/data/results/{companyId}/row
     users/{uid}/data/emails/{companyId}
        ↓
Dashboard polls/reads Firestore
  - No email_sent field → "Processing" status
  - email_sent = false → "Ready" (email generated, not yet sent)
  - email_sent = Timestamp → "Sent"
```

---

## 10. PAYMENT & BILLING

### Plans (`src/config.ts`)

| Plan ID | Credits Included | Target User |
|---|---|---|
| `free_trial` | Limited | New users testing |
| `base` | Moderate | Individuals |
| `pro` | More | Power users |
| `ultra` | Maximum | Heavy users |

### Billing Types

| Billing Type | Duration | Discount |
|---|---|---|
| `monthly` | 1 month | 0% |
| `biennial` | 2 years | 10% |
| `quintennial` | 5 years | 15% |
| `lifetime` | Permanent | One-time payment |

### Stripe Flow (Subscriptions)

```
POST /api/create-subscription { planId, billingType }
        ↓
Stripe creates Customer + Subscription
Returns { clientSecret }
        ↓
Frontend: stripe.confirmPayment(clientSecret)
        ↓
Stripe webhook: invoice.paid event
        ↓
POST /api/stripe-webhook
  → Update user: plan, billingType, credits, expirate
```

### Stripe Flow (Lifetime / One-Time)

```
POST /api/create-subscription { planId, billingType: "lifetime" }
        ↓
Stripe creates PaymentIntent
Returns { clientSecret }
        ↓
Frontend confirms payment
        ↓
Stripe webhook: payment_intent.succeeded
        ↓
Update user: expirate = now + 20 years
```

### Referral System

- Referral codes are passed as `?ref=CODE` URL parameter
- Middleware sets a 30-day cookie with the referral code
- Codes are hardcoded in config:
  - `afk` → 20% discount
  - `testa` → 99% discount
- `getReferralDiscount(code)` is called at checkout to apply discount

### Credits System

Credits are consumed for premium in-app actions:
- **Regenerate email**: 50 credits
- **Find new recruiter**: 100 credits
- **Change company**: 70 credits
- **View LLM prompt**: 100 credits

---

## 11. EXTERNAL INTEGRATIONS

### People Data Labs (PDL)
- **Client**: `src/lib/pdlClient.ts`
- **Server Action**: `src/actions/pdl.ts`
- `enrichProfile(linkedinUrl)` → returns structured skills, experience, education
- `translateSkillsToEnglish(skills)` → calls Google Translate API

### OpenRouter (LLM)
- Called by the **external Python server**, not directly from Next.js
- Used to generate personalized cold emails
- Multiple API keys configured in `OPENROUTER_API_KEYS` (rotation/load balancing)

### Resend (Transactional Email)
- Called via `POST /api/send-email`
- Three email types:
  - `welcome` — Sent on user registration
  - `password-reset` — Password reset link
  - `new_emails_generated` — Notification when campaign is ready
- All emails use a shared HTML template: `wrapEmail(content, preheader)`

### Stripe
- **Secret key**: `STRIPE_SECRET_KEY` (server only)
- **Publishable key**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client)
- **Webhook secret**: `STRIPE_WEBHOOK_SECRET`
- Webhook endpoint: `POST /api/stripe-webhook`

### Nexi (Italian Payment Provider)
- Alternative to Stripe for Italian users
- Config: `NEXT_PUBLIC_NEXI_ALIAS`, `NEXT_PUBLIC_NEXI_SECRET_KEY`
- Handled via `POST /api/protected/nexi-payment`

### External Python Server
- **URL**: `SERVER_RUNNER_URL` env var (e.g., `http://91.99.227.223:5000/run_module`)
- **Auth**: `PROXY_PASS` shared secret
- Handles the heavy lifting: recruiter discovery, article scraping, email generation
- Reads/writes Firestore directly using service account credentials

---

## 12. ENVIRONMENT VARIABLES

```env
# Firebase Client SDK (exposed to browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin SDK (server only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=        # Multi-line PEM key

# Auth cookie signing
AUTH_COOKIE_NAME=AuthToken
AUTH_COOKIE_SIGNATURE_KEY_CURRENT= # Secret for signing cookies
AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS=# Previous secret (rotation support)
USE_SECURE_COOKIES=false           # Set to true in production

# App domain
NEXT_PUBLIC_DOMAIN=http://localhost:3000

# External APIs
PEOPLE_DATA_API_KEY=
OPENROUTER_API_KEYS=               # Comma-separated keys
ROCKETREACH_API_KEY=
RESEND_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Nexi
NEXT_PUBLIC_NEXI_ALIAS=
NEXT_PUBLIC_NEXI_SECRET_KEY=

# External Python server
SERVER_RUNNER_URL=
PROXY_PASS=
```

---

## 13. MIDDLEWARE (`src/middleware.ts`)

Runs on **every request** at the Edge runtime.

**Responsibilities:**
1. **Auth validation** — Validates `AuthToken` cookie via next-firebase-auth-edge
2. **Route protection** — Redirects unauthenticated users away from `/dashboard`
3. **Referral tracking** — Detects `?ref=CODE` query param, sets 30-day cookie
4. **Token refresh** — Automatically refreshes expiring tokens

**Route matching config:**
```typescript
// Middleware runs on all routes except static files and Next.js internals
matcher: ["/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
```

---

## 14. KEY CODE PATTERNS

### Auth Check in Server Actions
```typescript
// src/lib/utils-server.ts
export async function checkAuth(): Promise<string> {
  const tokens = await getTokens(cookies(), authConfig);
  if (!tokens?.decodedToken) throw new Error("Unauthorized");
  return tokens.decodedToken.uid;
}
```

### Atomic Firestore Batch
```typescript
const batch = adminDb.batch();
batch.update(userRef, { credits: FieldValue.increment(-50) });
batch.set(resultRef, { email_sent: FieldValue.serverTimestamp() }, { merge: true });
batch.delete(oldRef);
await batch.commit(); // All-or-nothing
```

### Server vs Client Component Split
```typescript
// Server component: fetches data, passes to client
// dashboardServer.tsx
export default async function DashboardServer() {
  const uid = await checkAuth();
  const data = await fetchResults(uid);
  return <Dashboard initialData={data} />;
}

// Client component: handles interaction
// dashboard.tsx
'use client'
export function Dashboard({ initialData }) {
  const [data, setData] = useState(initialData);
  // ...
}
```

### Suspense Boundary Pattern
```typescript
<Suspense fallback={<Skeleton />}>
  <DashboardServer />
</Suspense>
```

### Class Merging Utility
```typescript
// Uses clsx + tailwind-merge
import { cn } from "@/lib/utils";
<div className={cn("base-class", condition && "conditional-class", props.className)} />
```

### Firestore Field Operations
```typescript
import { FieldValue } from "firebase-admin/firestore";

// Delete a field
{ fieldName: FieldValue.delete() }

// Server timestamp
{ createdAt: FieldValue.serverTimestamp() }

// Increment a number
{ credits: FieldValue.increment(-50) }

// Array operations
{ list: FieldValue.arrayRemove("item") }
{ list: FieldValue.arrayUnion("item") }
```

---

## 15. PRICING MODEL (CONFIG-DRIVEN)

All plan/price logic lives in `src/config.ts`. The frontend and backend both import from this single source of truth.

### Plan Structure
```typescript
type Plan = {
  id: "free_trial" | "base" | "pro" | "ultra",
  name: string,
  credits: number,
  companiesLimit: number,
  price: {
    monthly: number,      // Price in euros (monthly)
    biennial: number,     // Effective monthly price (2yr)
    quintennial: number,  // Effective monthly price (5yr)
    lifetime: number,     // One-time price
  }
}
```

### Price Computation
```typescript
// All amounts stored and sent to Stripe in cents
function computePriceInCents(planId, billingType, referralCode?): number
```

### Billing Period → Expiry Date
| `billingType` | Expiry set to |
|---|---|
| `monthly` | now + 1 month |
| `biennial` | now + 2 years |
| `quintennial` | now + 5 years |
| `lifetime` | now + 20 years |

---

## 16. EMAIL TEMPLATE SYSTEM

Located in `src/app/api/send-email/route.ts`.

```typescript
// Wraps content in shared branded HTML email layout
function wrapEmail(content: string, preheader: string): string

// Button component
function emailButton(href: string, text: string): string

// Three email types:
type EmailType = "welcome" | "password-reset" | "new_emails_generated"
```

All emails are sent via **Resend** with:
- `from`: CandidAI branded address
- `to`: user's email
- `subject`: type-dependent
- `html`: generated by template functions

---

## 17. NOTABLE GOTCHAS FOR LLMs

1. **No Prisma, no SQL** — All DB operations use `firebase-admin/firestore` directly. Use `adminDb` (from `src/lib/firebase-admin.ts`) for server-side Firestore access.

2. **Two Firebase SDKs** — `src/lib/firebase.ts` is the client SDK (browser), `src/lib/firebase-admin.ts` is the Admin SDK (server only). Never import Admin SDK in client components.

3. **Email generation is external** — The LLM email generation happens on a separate Python server. Next.js only triggers it via `startServer()` and reads results from Firestore.

4. **`onboardingStep: 50`** means complete — Any value below 50 means the user is still in onboarding. The dashboard is only shown when `onboardingStep >= 50`.

5. **Credits vs Subscription** — Credits are a separate resource from the subscription plan. A user can be on `free_trial` but have purchased extra credits, or be on `ultra` but have spent all credits.

6. **`email_sent` field is tri-state**:
   - Field **missing** or `undefined` → still processing
   - `false` → email generated and ready to send
   - `Timestamp` → email has been sent (value = send time)

7. **`companies_to_confirm`** is a special array on the root `results` document (not on a company sub-document). It tracks company IDs that need user approval before generating emails.

8. **Firestore path for emails**: `users/{uid}/data/emails/{companyId}` — separate from `users/{uid}/data/results/{companyId}/details` which also contains the email.

9. **Cookie signing uses two keys** — `AUTH_COOKIE_SIGNATURE_KEY_CURRENT` + `PREVIOUS` to support key rotation without logging everyone out.

10. **Referral discounts are hardcoded** in `src/config.ts`, not in the database.

11. **`SERVER_RUNNER_URL`** is a plain HTTP endpoint on an external VPS. It is authenticated only via the `PROXY_PASS` shared secret in the request body.

12. **Stripe prices are computed at request time** from config, not stored in the DB as Stripe Price IDs. This means plan pricing changes require a code deployment, not a Stripe dashboard change.
