# CLAUDE.md — Project Knowledge Base

## Playwright E2E Test Bypass System

All E2E tests run against the live Next.js dev server with `NODE_ENV=development`.
Because tests cannot obtain real Firebase tokens, two bypass mechanisms activate
only when `NODE_ENV !== 'production'`.

### 1. Cookie bypass — `__playwright_user__`

Set by tests before navigation. Value is a base64-encoded JSON object:

```
{ uid, email, displayName, onboardingStep, plan, credits, maxCompanies, ... }
```

When this cookie is present:
- `src/middleware.ts` calls `NextResponse.next()` immediately, skipping all Firebase token validation.
- `checkAuth()` in `src/actions/onboarding-actions.ts` returns `userData.uid` directly.
- Protected API routes (`/api/protected/user`, `/api/protected/account`, `/api/protected/results`, `/api/protected/result/[resultId]`) return mock responses built from the cookie without touching Firestore.
- Onboarding server actions (`selectPlan`, `submitCompanies`, `submitProfile`, `submitQueries`, `completeOnboarding`) update `onboardingStep` in the cookie in-place and call `revalidatePath` or `redirect`, skipping all Firestore writes.

### 2. In-memory mock store — `getTestMock` / `setTestMock`

Source: `src/app/api/test/set-mock/route.ts`

A global `Map` (`global.__playwright_mock_store__`) shared across all Next.js module
instances in the same process. Tests register overrides via HTTP:

```
POST   /api/test/set-mock  { pattern: "/api/protected/emails", response: {...} }
DELETE /api/test/set-mock  { pattern: "/api/protected/emails" }  // clear one
DELETE /api/test/set-mock  {}                                     // clear all
```

Pattern matching: exact match, or prefix match when pattern ends with `*`
(e.g. `"/api/protected/result/*"` matches `"/api/protected/result/abc123"`).

Every protected route handler calls `getTestMock(urlPath)` at the top of the handler.
Server components that cannot set cookies (e.g. `PaymentStripeServer`, `AdvancedFiltersServer`
in `onboardingServer.tsx`) call `setTestMock()` directly to advance user state.

### 3. Additional per-route cookies

- `__playwright_results__`: base64 JSON. If present, `/api/protected/results` returns its decoded contents directly (per-context isolation).
- `__playwright_empty_results__`: any truthy value. Forces `/api/protected/results` to return `{ success: true, data: {} }`.

### Adding a new protected API route

Any new route under `/api/protected/` must include the bypass block at the top,
otherwise tests will hit Firebase and fail:

```typescript
if (process.env.NODE_ENV !== 'production') {
    const mock = getTestMock(new URL(request.url).pathname);
    if (mock) return NextResponse.json(mock);
    if (request.cookies.get('__playwright_user__')?.value) {
        return NextResponse.json({ success: true, /* minimal valid shape */ });
    }
}
```

### Test worker configuration

Tests always run with `workers: 1` in `playwright.config.ts`. The in-memory mock store
is a single shared `Map` in the Next.js process — parallel workers would interleave
mock registrations and corrupt test isolation. Do not increase `workers` without replacing
the mock store with a per-worker isolation mechanism.

Individual test timeout is 120s (increased from 30s to accommodate onboarding flows with multiple full-page navigations).

---

## Next.js 15 — Dynamic Route Params Are Async

In Next.js 15, the `params` argument passed to route handlers is a Promise. Always await it:

```typescript
// Correct
const { resultId } = await params;

// Wrong — will return undefined in Next.js 15
const { resultId } = params;
```

This applies to all files under `app/api/**` and `app/**/page.tsx` that destructure dynamic segments from `params`.

---

## Production-only Features

The iubenda cookie consent widget (`src/app/layout.tsx`) is only loaded when
`NODE_ENV === "production"`. It is suppressed in development and test environments
to prevent it from interfering with Playwright tests that assert on page content.

---

## API Routes

### GET /api/protected/billing

Returns the authenticated user's Stripe payment history from `users/{uid}/payments`
in Firestore, ordered by `createdAt` descending.

Response shape:
```json
{ "success": true, "payments": [{ "id", "createdAt", "description", "amount", "currency", "status" }] }
```

The billing dashboard page (`src/app/dashboard/billing/page.tsx`) is a client component
that fetches this endpoint on mount (converted from a server component to support the
Playwright mock store pattern).
