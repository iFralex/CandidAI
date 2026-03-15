Hai ragione, mi scuso per l'errore. Nel tentativo di formattare il testo, alcuni punti elenco erano stati accorpati riducendo il numero totale di checkbox.

Ecco la traduzione integrale e fedele di ogni singolo punto del file originale, senza alcuna sintesi, mantenendo il rapporto 1:1 tra i contenuti originali e i task, seguendo rigorosamente il formato richiesto.

# Comprehensive Test Plan — CandidAI

## Overview
Multi-level testing strategy covering **every single user function** of CandidAI: authentication, onboarding (all plans), dashboard (all pages), Stripe payments, email campaign management, profile settings, and security. Tests simulate dozens of mock APIs (Firebase, Stripe, Resend, PDL) and cover all happy paths, negative paths, edge cases, and erroneous behavior combinations.

## Testing Stack

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest + React Testing Library | Components, pure functions, config |
| Integration | Vitest + Firebase Emulator Suite | Server Actions, API routes |
| E2E | Playwright (Chromium, Firefox, WebKit) | Complete user flows |
| API Mock | MSW (Mock Service Worker) | Stripe, Resend, PDL, OpenRouter |
| Backend Python | pytest + pytest-mock | Python logic, Flask routes |

## Validation Commands

```bash
npm run test:unit          # Vitest unit + component tests
npm run test:integration   # Vitest integration tests (requires active emulators)
npm run test:e2e           # Playwright E2E
pytest                     # Backend Python tests
npm run test:all           # Everything together via Firebase emulators:exec
```

---

### Task 1.1: Infrastructure & Emulator Setup
- [x] Run `npx firebase init emulators` and select Firestore, Auth, and Storage on default ports (8080, 9099, 9199).
- [x] Create `.env.test.local` for Next.js with the following variables: `NEXT_PUBLIC_FIREBASE_API_KEY=fake-api-key`, `NEXT_PUBLIC_DOMAIN=http://localhost:3000`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`, `STRIPE_SECRET_KEY=sk_test_fake`, `STRIPE_WEBHOOK_SECRET=whsec_fake`, `RESEND_API_KEY=re_fake`, `SERVER_RUNNER_URL=http://localhost:5001`, `AUTH_COOKIE_NAME=CandidAIToken`, `AUTH_COOKIE_SIGNATURE_KEY_CURRENT=fake-sig-key-32chars-long-abcde`, `AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS=fake-sig-key-32chars-long-fghij`, `USE_SECURE_COOKIES=false`.
- [x] Create `.env.test` for the Python backend with the following variables: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_ADMIN_PROJECT_ID=demo-candidai`.
- [x] Install Next.js dependencies: `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event playwright @playwright/test msw`.
- [x] Install Python dependencies: `pip install pytest pytest-mock pytest-flask httpretty`.
- [x] Create `vitest.config.ts` with `@/` alias resolution, `jsdom` environment, and `vitest.setup.ts` setup file.
- [x] Create `vitest.integration.config.ts` with `node` environment to test server actions.
- [x] Create `playwright.config.ts` with `webServer: { command: "npm run dev", port: 3000 }`, browser engines Chromium + Firefox + WebKit, and 30s timeout.
- [x] Create `vitest.setup.ts` to start the MSW server in `beforeAll` and close it in `afterAll`.
- [x] Update `package.json` scripts: `"test:unit": "vitest run --config vitest.config.ts"`, `"test:integration": "vitest run --config vitest.integration.config.ts"`, `"test:e2e": "playwright test"`, `"test:all": "firebase emulators:exec --project demo-candidai 'npm run test:unit && npm run test:integration && pytest && npm run test:e2e'"`
- [x] Create `tests/conftest.py` for Python: load `.env.test`, initialize Flask test client, patch `firebase_admin.credentials` with fake credentials, and connect to Firestore emulator.
- [x] Create `tests/helpers/emulator.ts` helper for Next.js: include functions `clearFirestore()`, `createTestUser(overrides?)`, `signInTestUser()`, and `getFirestoreDoc(path)`.
- [x] Mark completed

### Task 2.1: Unit Test - Config - computePriceInCents
- [x] Verify `purchaseType="plan"`, `itemId="free_trial"` returns `0`.
- [x] Verify `purchaseType="plan"`, `itemId="base"` returns `3000` (€30.00).
- [x] Verify `purchaseType="plan"`, `itemId="pro"` returns `6900` (€69.00).
- [x] Verify `purchaseType="plan"`, `itemId="ultra"` returns `13900` (€139.00).
- [x] Verify `purchaseType="credits"`, `itemId="pkg_1000"` returns `1000` (€10.00).
- [x] Verify `purchaseType="credits"`, `itemId="pkg_2500"` returns `2000` (€20.00).
- [x] Verify `purchaseType="credits"`, `itemId="pkg_5000"` returns `3000` (€30.00).
- [x] Verify `purchaseType="plan"`, `itemId="unknown_plan"` throws `Error` or returns `undefined`.
- [x] Verify `purchaseType="credits"`, `itemId="pkg_9999"` throws `Error`.
- [x] Verify `purchaseType=undefined` throws `TypeError`.
- [x] Verify all returned values are whole `number` integers (no floats).
- [x] Mark completed

### Task 2.2: Unit Test - Config - PLANS Constants Structure
- [x] Verify every plan has properties: `id`, `name`, `price`, `maxCompanies`, `credits`.
- [x] Verify `free_trial.maxCompanies === 1`.
- [x] Verify `pro.credits === 1000`.
- [x] Verify `ultra.credits === 2500`.
- [x] Verify `CREDIT_PACKAGES` has exactly 3 elements.
- [x] Mark completed

### Task 2.3: Unit Test - Config - creditsInfo Constants Structure
- [x] Verify `creditsInfo["prompt"].cost === 100`.
- [x] Verify `creditsInfo["generate-email"].cost === 50`.
- [x] Verify `creditsInfo["find-recruiter"].cost === 100`.
- [x] Verify `creditsInfo["change-company"].cost === 70`.
- [x] Mark completed

### Task 2.4: Unit Test - Utils - cn (Class Merging Utility)
- [x] Verify simple strings: `cn("foo", "bar")` -> `"foo bar"`.
- [x] Verify with `undefined`: `cn("foo", undefined, "bar")` -> `"foo bar"`.
- [x] Verify with `null`: `cn("foo", null)` -> `"foo"`.
- [x] Verify conditionals: `cn("a", false && "b", "c")` -> `"a c"`.
- [x] Verify Tailwind conflict resolution: `cn("px-2", "px-4")` -> `"px-4"`.
- [x] Verify arrays of classes: `cn(["a", "b"], "c")` -> `"a b c"`.
- [x] Verify empty input: `cn()` -> `""`.
- [x] Mark completed

### Task 3.1: Unit Test - Components - LoginForm
- [x] Verify email field, password field, and submit button are rendered.
- [x] Verify "Forgot password?" link points to `/forgot-password`.
- [x] Verify "Register" link points to `/register`.
- [x] Verify valid email and password trigger a `POST /api/auth` call with `mode="login"`.
- [x] Verify submit with empty email shows HTML5 validation message.
- [x] Verify submit with malformed email (e.g., `notanemail`) shows error.
- [x] Verify submit with empty password shows validation message.
- [x] Verify button is disabled during submit (loading state).
- [x] Verify API response `{ success: false, error: "Invalid credentials" }` shows visible error message.
- [x] Verify API response `{ success: true }` redirects to `/dashboard`.
- [x] Verify network error shows generic error message (no crash).
- [x] Verify password field is of type `password` (not visible in plain text).
- [x] Mark completed

### Task 3.2: Unit Test - Components - RegisterForm
- [x] Verify name, email, password fields, and submit button are rendered.
- [x] Verify submit with all valid fields triggers `POST /api/auth` with `mode="register"`, `name`, `email`, `password`.
- [x] Verify submit with empty name shows validation error.
- [x] Verify submit with existing email returns API error and shows visible message.
- [x] Verify submit with password too short (< 6 chars) shows error.
- [x] Verify submit with malformed email shows error.
- [x] Verify success response redirects to `/login` (or shows "check your email" message).
- [x] Verify loading state during submit.
- [x] Mark completed

### Task 3.3: Unit Test - Components - ForgotPasswordForm
- [x] Verify email field and "Send reset link" button are rendered.
- [x] Verify submit with valid email triggers `POST /api/auth/forgot-password`.
- [x] Verify success shows "Email sent" message.
- [x] Verify unregistered email returns API 404 and shows "Email not found" message.
- [x] Verify submit with empty email triggers client-side validation.
- [x] Verify loading state.
- [x] Mark completed

### Task 3.4: Unit Test - Components - CreditSelector
- [x] Verify exactly 3 credit packages are rendered (pkg_1000, pkg_2500, pkg_5000).
- [x] Verify each card shows: name, credit amount, price.
- [x] Verify clicking pkg_1000 calls `onSelect` with `"pkg_1000"`.
- [x] Verify clicking pkg_2500 calls `onSelect` with `"pkg_2500"`.
- [x] Verify clicking pkg_5000 calls `onSelect` with `"pkg_5000"`.
- [x] Verify selected package receives active state CSS class (highlighted border).
- [x] Verify unselected packages do not have the active class.
- [x] Verify changing selection from pkg_1000 to pkg_5000 updates visual state correctly.
- [x] Mark completed

### Task 3.5: Unit Test - Components - PlanSelector
- [x] Verify all 4 plans are rendered (free_trial, base, pro, ultra).
- [x] Verify each plan shows: name, price, maxCompanies, features list.
- [x] Verify clicking a plan calls `onSelect` with `planId`.
- [x] Verify selected plan has a visual indicator.
- [x] Verify user's current plan (prop `currentPlan`) shows "Current Plan" badge and is not clickable (or disabled).
- [x] Verify free trial does not show a price (or shows "Free").
- [x] Mark completed

### Task 3.6: Unit Test - Components - UnifiedCheckout
- [x] Verify rendering without crash with valid `clientSecret` and `amount`.
- [x] Verify correct price (in EUR) from `amount` prop is shown.
- [x] Verify Stripe Elements mounts correctly (mock Stripe JS).
- [x] Verify missing `clientSecret` renders skeleton/loading state.
- [x] Verify Stripe unavailable (window.Stripe undefined) shows visible error message.
- [x] Verify clicking "Pay" calls Stripe `confirmPayment`.
- [x] Verify `confirmPayment` failure (card declined) shows error message.
- [x] Verify `confirmPayment` success calls `onSuccess` callback.
- [x] Verify Pay button is disabled during processing.
- [x] Mark completed

### Task 3.7: Unit Test - Components - AddMoreCompaniesDialog
- [x] Verify dialog is closed by default.
- [x] Verify clicking "Add More Companies" opens the dialog.
- [x] Verify rendering of form to insert companies (name, domain).
- [x] Verify submit with valid fields calls `addNewCompanies` action.
- [x] Verify submit with invalid domain shows validation error.
- [x] Verify submit with duplicate company (already in list) shows error.
- [x] Verify submit exceeding plan limit shows "Limit Reached" error.
- [x] Verify success closes dialog and updates list.
- [x] Verify clicking outside dialog closes it without saving.
- [x] Mark completed

### Task 3.8: Unit Test - Components - Sidebar
- [x] Verify links: Dashboard, Send All, Plan & Credits, Settings.
- [x] Verify Dashboard link points to `/dashboard`.
- [x] Verify Send All link points to `/dashboard/send-all`.
- [x] Verify Plan & Credits link points to `/dashboard/plan-and-credits`.
- [x] Verify Settings link points to `/dashboard/settings`.
- [x] Verify mobile hamburger trigger shows sidebar on click.
- [x] Verify active link has highlighted CSS class.
- [x] Verify credit badge is visible with the correct value.
- [x] Mark completed

### Task 4.1: MSW Mock Handlers - Stripe
- [x] `POST /v1/payment_intents` (success): return `{ id: "pi_test_123", client_secret: "pi_test_123_secret_xxx", status: "requires_payment_method", amount: 3000, currency: "eur" }`.
- [x] `POST /v1/payment_intents` (card declined): return `{ error: { type: "card_error", code: "card_declined", message: "Your card was declined." } }` with status 402.
- [x] `POST /v1/payment_intents` (insufficient funds): return `insufficient_funds` error with status 402.
- [x] `POST /v1/payment_intents` (expired card): return `expired_card` error with status 402.
- [x] `POST /v1/payment_intents` (invalid CVC): return `incorrect_cvc` error with status 402.
- [x] `POST /v1/payment_intents` (network timeout): no response after 5s.
- [x] `POST /v1/payment_intents` (Stripe server error): return status 500.
- [x] `GET /v1/payment_intents/:id`: return mock existing payment intent.
- [x] `POST /v1/payment_intents/:id/confirm`: return mock succeeded status.
- [x] Mark completed

### Task 4.2: MSW Mock Handlers - Resend
- [x] `POST https://api.resend.com/emails` (success): return `{ id: "re_fake_123" }` with status 200.
- [x] `POST https://api.resend.com/emails` (rate limit): return status 429 with header `Retry-After: 60`.
- [x] `POST https://api.resend.com/emails` (invalid API key): return status 403.
- [x] `POST https://api.resend.com/emails` (invalid email): return status 422 with `{ error: "Invalid email address" }`.
- [x] `POST https://api.resend.com/emails` (server error): return status 500.
- [x] Mark completed

### Task 4.3: MSW Mock Handlers - PDL (People Data Labs)
- [x] `POST https://api.peopledatalabs.com/v5/person/search` (success): return JSON with list of 5 mock recruiters.
- [x] `POST https://api.peopledatalabs.com/v5/company/search` (success): return JSON with mock company data.
- [x] `POST https://api.peopledatalabs.com/v5/person/search` (no results): return `{ data: [], total: 0 }`.
- [x] `POST https://api.peopledatalabs.com/v5/person/search` (rate limit): return status 429.
- [x] `POST https://api.peopledatalabs.com/v5/person/search` (unauthorized): return status 401.
- [x] `POST https://api.peopledatalabs.com/v5/person/search` (bad request): return status 400.
- [x] Mark completed

### Task 4.4: MSW Mock Handlers - External Python Server (SERVER_RUNNER_URL)
- [x] `POST /run_module` (success): return `{ status: "queued", message: "Processing started" }` with status 200.
- [x] `POST /run_module` (user not found): return status 404.
- [x] `POST /run_module` (server unavailable): return network error / status 503.
- [x] `POST /run_module` (missing user_id): return status 400.
- [x] Mark completed

### Task 4.5: MSW Mock Handlers - Firebase Identity Toolkit
- [x] `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` (success): return `{ idToken: "fake_id_token", localId: "user123", email: "test@test.com", refreshToken: "fake_refresh" }`.
- [x] `POST ...signInWithPassword` (wrong password): return status 400 with `{ error: { message: "INVALID_PASSWORD" } }`.
- [x] `POST ...signInWithPassword` (user not found): return status 400 with `{ error: { message: "EMAIL_NOT_FOUND" } }`.
- [x] `POST ...signInWithPassword` (account disabled): return status 400 with `{ error: { message: "USER_DISABLED" } }`.
- [x] `POST ...signInWithPassword` (too many attempts): return status 400 with `{ error: { message: "TOO_MANY_ATTEMPTS_TRY_LATER" } }`.
- [x] Mark completed

### Task 5.1: Integration Test - API Route - POST /api/auth - Register Mode
- [x] Verify valid input (`mode="register"`, email, password, name) triggers Firestore creation of `users/{uid}` with correct fields and returns `{ success: true }`.
- [x] Verify `users/{uid}` contains: `name`, `email`, `createdAt`, `lastLogin`, `onboardingStep=1`, `plan="free_trial"`, `credits=0`, `emailVerified=false`.
- [x] Verify call to `POST /api/send-email` with `type="welcome"` after registration is intercepted by MSW with 200.
- [x] Verify already registered email returns `{ success: false, error: "..." }` with status 400.
- [x] Verify missing password returns status 400.
- [x] Verify malformed email returns status 400.
- [x] Verify missing name returns status 400 or default name.
- [x] Verify malformed JSON body returns status 400.
- [x] Verify empty body returns status 400.
- [x] Mark completed

### Task 5.2: Integration Test - API Route - POST /api/auth - Login Mode
- [x] Verify valid credentials return `{ success: true, idToken, uid }` and update `lastLogin` in Firestore.
- [x] Verify wrong password returns `{ success: false }` with status 401 (MSW returns `INVALID_PASSWORD`).
- [x] Verify unregistered email returns `{ success: false }` with status 401 (MSW returns `EMAIL_NOT_FOUND`).
- [x] Verify disabled account returns `{ success: false }` with status 403 (MSW returns `USER_DISABLED`).
- [x] Verify missing `mode` returns status 400.
- [x] Verify invalid `mode` value returns status 400.
- [x] Mark completed

### Task 5.3: Integration Test - API Route - POST /api/auth/forgot-password
- [x] Verify valid registered email generates reset link via Firebase Admin + sends email via Resend and returns `{ success: true }`.
- [x] Verify email not found in Firebase returns appropriate error response.
- [x] Verify Resend 429 is handled gracefully returning `{ success: false, error: "..." }` without crashing.
- [x] Verify missing email in body returns status 400.
- [x] Verify empty body returns status 400.
- [x] Mark completed

### Task 5.4: Integration Test - API Route - GET /api/protected/user
- [x] Verify request with valid auth cookie returns user data from Firestore.
- [x] Verify response contains: `uid`, `email`, `name`, `emailVerified`, `onboardingStep`, `plan`, `credits`, `picture`, `billingType`.
- [x] Verify request without cookie returns status 401.
- [x] Verify expired cookie / invalid token returns status 401.
- [x] Verify user not found in Firestore returns status 404.
- [x] Mark completed

### Task 5.5: Integration Test - API Route - PUT /api/protected/user
- [x] Verify body `{ name: "New Name" }` with auth updates Firestore and `updatedAt`, returning `{ success: true }`.
- [x] Verify empty string name returns status 400.
- [x] Verify excessively long name returns validation error.
- [x] Verify request without authentication returns status 401.
- [x] Verify update does not overwrite other fields (credits, plan) in Firestore.
- [x] Mark completed

### Task 5.6: Integration Test - API Route - GET /api/protected/account
- [x] Verify request with valid auth returns `{ companies, profileSummary, queries, customizations }`.
- [x] Verify user without `data/account` document returns empty defaults without crashing.
- [x] Verify `companies` is an array (even if empty) in valid response.
- [x] Verify request without auth returns status 401.
- [x] Mark completed

### Task 5.7: Integration Test - API Route - GET /api/protected/results
- [x] Verify user with active campaigns returns map `{ [companyId]: { recruiter, email_sent, blog_articles, ... } }`.
- [x] Verify user without campaigns returns empty object `{}`.
- [x] Verify request without auth returns status 401.
- [x] Verify Firestore inaccessibility simulation returns status 500.
- [x] Mark completed

### Task 5.8: Integration Test - API Route - GET /api/protected/emails
- [x] Verify user with generated emails returns `{ data: { [companyId]: emailContent }, userId }`.
- [x] Verify user without generated emails returns `{ data: {}, userId }`.
- [x] Verify request without auth returns status 401.
- [x] Mark completed

### Task 5.9: Integration Test - API Route - POST /api/protected/sent_emails
- [x] Verify body `{ ids: ["company1", "company2"], userId }` with auth updates `email_sent` in results, emails, and details, returning `{ success: true }`.
- [x] Verify `email_sent` is a valid ISO timestamp after update.
- [x] Verify update does not overwrite other fields in the document.
- [x] Verify empty `ids` array returns OK but performs no update.
- [x] Verify `ids` containing non-existent ID is handled gracefully.
- [x] Verify missing `userId` returns status 400.
- [x] Verify request without auth returns status 401.
- [x] Verify `ids` not as an array returns status 400.
- [x] Mark completed

### Task 5.10: Integration Test - API Route - POST /api/create-payment
- [x] Verify `{ purchaseType: "plan", itemId: "base", payment_method_id: "pm_test" }` returns `{ client_secret, type: "one_time", amount: 3000 }` (Stripe mock).
- [x] Verify `{ purchaseType: "plan", itemId: "pro" }` returns `amount: 6900`.
- [x] Verify `{ purchaseType: "plan", itemId: "ultra" }` returns `amount: 13900`.
- [x] Verify `{ purchaseType: "credits", itemId: "pkg_1000" }` returns `amount: 1000`.
- [x] Verify `{ purchaseType: "credits", itemId: "pkg_2500" }` returns `amount: 2000`.
- [x] Verify `{ purchaseType: "credits", itemId: "pkg_5000" }` returns `amount: 3000`.
- [x] Verify `{ purchaseType: "plan", itemId: "free_trial" }` returns error response (no payment for free trial).
- [x] Verify invalid `itemId` returns status 400.
- [x] Verify invalid `purchaseType` returns status 400.
- [x] Verify Stripe API error returns status 500.
- [x] Verify request without auth returns status 401.
- [x] Verify missing body returns status 400.
- [x] Mark completed

### Task 5.11: Integration Test - API Route - POST /api/stripe-webhook - Plan Purchase
- [x] Verify valid payload with `metadata.purchaseType="plan"`, `metadata.itemId="base"`, `metadata.userId="user123"`: Creates payment document in `users/user123/payments/{paymentIntentId}`, updates `users/user123` (`plan="base"`, `maxCompanies=20`, `credits=0`, `onboardingStep=50`), calls Resend with `purchase-confirmation`, calls `SERVER_RUNNER_URL/run_module`, and returns status 200.
- [x] Verify payload with `itemId="pro"` sets `credits=1000`, `maxCompanies=50`.
- [x] Verify payload with `itemId="ultra"` sets `credits=2500`, `maxCompanies=100`.
- [x] Mark completed

### Task 5.12: Integration Test - API Route - POST /api/stripe-webhook - Credit Purchase
- [x] Verify `metadata.purchaseType="credits"`, `metadata.itemId="pkg_1000"`: Creates payment document, increments `users/user123.credits` by 1000, sends confirmation email, does **not** call `SERVER_RUNNER_URL`, and returns status 200.
- [x] Verify `itemId="pkg_2500"` increments credits by 2500.
- [x] Verify `itemId="pkg_5000"` increments credits by 5000.
- [x] Mark completed

### Task 5.13: Integration Test - API Route - POST /api/stripe-webhook - Edge Cases
- [x] Verify invalid Stripe signature (`stripe-signature` header) returns status 400.
- [x] Verify missing Stripe signature returns status 400.
- [x] Verify already processed event (idempotency by `paymentIntentId`) skips without error and returns status 200.
- [x] Verify missing `userId` in metadata returns status 400.
- [x] Verify unhandled event type (e.g., `payment_intent.created`) skips and returns status 200.
- [x] Verify Resend 429 does not crash webhook and returns status 200.
- [x] Verify unreachable `SERVER_RUNNER_URL` does not crash webhook and returns status 200.
- [x] Mark completed

### Task 5.14: Integration Test - API Route - POST /api/send-email
- [x] Verify type `welcome` with user data calls Resend and returns 200; HTML contains username and verification link.
- [x] Verify type `password-reset` with email and link calls Resend and returns 200.
- [x] Verify type `new_emails_generated` calls Resend and returns 200.
- [x] Verify type `purchase-confirmation` calls Resend and returns 200.
- [x] Verify unrecognized type returns status 400.
- [x] Verify missing `userId` for required types returns status 400.
- [x] Verify Resend 500 returns error without crashing.
- [x] Verify Resend 429 returns graceful error.
- [x] Mark completed

### Task 5.15: Integration Test - API Route - POST /api/protected/all_details
- [x] Verify `{ companyIds: ["company1", "company2"] }` returns details for both from Firestore.
- [x] Verify non-existent `companyId` returns `null` for that ID in the array without crashing.
- [x] Verify empty `companyIds` array returns empty array.
- [x] Verify non-array `companyIds` returns status 400.
- [x] Verify request without auth returns status 401.
- [x] Mark completed

### Task 5.16: Integration Test - API Route - GET /api/protected/result/[resultId]
- [x] Verify valid `resultId` returns campaign details from Firestore.
- [x] Verify non-existent `resultId` returns status 404.
- [x] Verify request without auth returns status 401.
- [x] Mark completed

### Task 6.1: Integration Test - Server Actions - selectPlan
- [ ] Verify `selectPlan("free_trial")` updates `onboardingStep=2` in Firestore and returns `{ success: true }`.
- [ ] Verify `selectPlan("base")` updates `onboardingStep=2`.
- [ ] Verify `selectPlan("pro")` updates `onboardingStep=2`.
- [ ] Verify `selectPlan("ultra")` updates `onboardingStep=2`.
- [ ] Verify `selectPlan("unknown")` returns error or default behavior.
- [ ] Verify unauthenticated user call throws authentication error.
- [ ] Mark completed

### Task 6.2: Integration Test - Server Actions - submitCompanies - Happy path
- [ ] Verify `submitCompanies([{ name: "Acme", domain: "acme.com" }])` creates `data/account.companies` in Firestore, updates `onboardingStep=3`, and returns `{ success: true }`.
- [ ] Verify only passed companies are saved (no extra data).
- [ ] Verify `email_sent` initialized as `"1970-01-01T00:00:00Z"` for each company.
- [ ] Mark completed

### Task 6.3: Integration Test - Server Actions - submitCompanies - Validation
- [ ] Verify invalid domain (e.g., `"notadomain"`) returns error `{ success: false, error: "..." }`.
- [ ] Verify empty company name returns error.
- [ ] Verify empty array returns error (at least 1 company required).
- [ ] Verify duplicate companies in the same submission return error or deduplicate.
- [ ] Mark completed

### Task 6.4: Integration Test - Server Actions - submitCompanies - Plan limits
- [ ] Verify free_trial user (maxCompanies=1): submit 1 company -> OK.
- [ ] Verify free_trial user: submit 2 companies -> error "Exceeds plan limit".
- [ ] Verify base user (maxCompanies=20): submit 20 companies -> OK.
- [ ] Verify base user: submit 21 companies -> error.
- [ ] Verify pro user (maxCompanies=50): submit 50 companies -> OK.
- [ ] Verify ultra user (maxCompanies=100): submit 100 companies -> OK.
- [ ] Mark completed

### Task 6.5: Integration Test - Server Actions - submitCompanies - Add more companies (post-onboarding)
- [ ] Verify base plan user with 3 companies adds 5 -> total 8, OK.
- [ ] Verify base plan user with 18 companies adds 3 -> error (exceeds 20).
- [ ] Verify base plan user with 18 companies adds 2 -> total 20, OK.
- [ ] Verify domain already in existing list returns error "Already in list".
- [ ] Mark completed

### Task 6.6: Integration Test - Server Actions - submitProfile - Happy path
- [ ] Verify `submitProfile` with valid data and CV file uploads to Firebase Storage, saves URL to `data/account.cvUrl`, saves profileSummary, updates `onboardingStep=4`, and returns `{ success: true }`.
- [ ] Verify CV URL is a valid Firebase Storage URL.
- [ ] Mark completed

### Task 6.7: Integration Test - Server Actions - submitProfile - Validation
- [ ] Verify invalid CV file type (e.g., `.exe`) returns error "Invalid file type".
- [ ] Verify CV file exceeding size limit returns error "File too large".
- [ ] Verify missing CV returns error (mandatory).
- [ ] Verify empty `experience` returns error.
- [ ] Verify partial profile data handling (saves available data or error).
- [ ] Mark completed

### Task 6.8: Integration Test - Server Actions - submitProfile - Firebase Storage (emulator)
- [ ] Verify file is uploaded correctly and resulting URL points to storage emulator.
- [ ] Verify upload failure (Storage emulator offline) is handled.
- [ ] Mark completed

### Task 6.9: Integration Test - Server Actions - submitQueries
- [ ] Verify `submitQueries({ strategy: "domain", ... })` saves to `data/account.queries`, updates `onboardingStep=5`, and returns `{ success: true }`.
- [ ] Verify empty queries return error or default behavior.
- [ ] Verify invalid `strategy` returns error.
- [ ] Mark completed

### Task 6.10: Integration Test - Server Actions - completeOnboarding - Free Plan
- [ ] Verify `completeOnboarding` on free_trial saves customizations, updates `onboardingStep=50`, calls `SERVER_RUNNER_URL/run_module`, and returns `{ success: true }`.
- [ ] Verify unreachable `SERVER_RUNNER_URL` does not crash action and handles error.
- [ ] Mark completed

### Task 6.11: Integration Test - Server Actions - completeOnboarding - Paid Plan
- [ ] Verify `completeOnboarding` on base/pro/ultra saves customizations, updates `onboardingStep=6` (wait for payment), and does **not** call startServer.
- [ ] Verify `startServer` is called only after Stripe webhook, not directly.
- [ ] Mark completed

### Task 6.12: Integration Test - Server Actions - completeOnboarding - Validation
- [ ] Verify excessively long instructions (e.g., > 2000 chars) handling.
- [ ] Verify empty instructions save as empty or return error.
- [ ] Mark completed

### Task 6.13: Integration Test - Server Actions - regenerateEmail
- [ ] Verify `regenerateEmail("company1", "Be more formal")` with sufficient credits calls Python server, decrements credits by 50, and returns `{ success: true }`.
- [ ] Verify user credits are decremented by exactly 50 in Firestore.
- [ ] Verify user with 30 credits returns error "Insufficient credits".
- [ ] Verify user with 0 credits returns error "Insufficient credits".
- [ ] Verify user with exactly 50 credits -> OK.
- [ ] Verify non-existent `companyId` returns error.
- [ ] Verify unreachable Python server handles error.
- [ ] Verify empty instructions use default or return error.
- [ ] Mark completed

### Task 6.14: Integration Test - Server Actions - refindRecruiter
- [ ] Verify `refindRecruiter` with valid inputs costs 100 credits, calls Python server, and returns `{ success: true }`.
- [ ] Verify credits are decremented by 100.
- [ ] Verify user with 90 credits returns error "Insufficient credits".
- [ ] Verify user with 0 credits returns error.
- [ ] Verify invalid `linkedinUrl` returns error or warning.
- [ ] Verify non-existent `companyId` returns error.
- [ ] Mark completed

### Task 6.15: Integration Test - Server Actions - confirmCompanies
- [ ] Verify `confirmCompanies` updates details in Firestore, removes from `companies_to_confirm`, and returns `{ success: true }`.
- [ ] Verify empty array performs no operation and returns OK.
- [ ] Verify `companyId` not in `companies_to_confirm` handling.
- [ ] Verify partial data updates only provided fields.
- [ ] Mark completed

### Task 6.16: Integration Test - Server Actions - getProfileData
- [ ] Verify it returns `{ name, picture, plan, credits, email }` for authenticated user.
- [ ] Verify user without `picture` returns `null` or default.
- [ ] Verify unauthenticated user throws error.
- [ ] Mark completed

### Task 6.17: Integration Test - Server Actions - getSettings
- [ ] Verify it returns notification settings from Firestore.
- [ ] Verify user without saved settings returns defaults (`marketingEmails: false`, `reminderFrequency: "weekly"`).
- [ ] Mark completed

### Task 6.18: Integration Test - Server Actions - fetchBillingHistory
- [ ] Verify user with 3 payments returns array of 3 transactions ordered by date.
- [ ] Verify user without payments returns empty array.
- [ ] Verify each transaction contains: `id`, `type`, `amount`, `status`, `createdAt`, `itemId`.
- [ ] Mark completed

### Task 7.1: Integration Test - Full Onboarding Flow - Free Trial
- [ ] Setup: Create test user with `onboardingStep=1`.
- [ ] Step 1: `selectPlan("free_trial")` -> `onboardingStep=2`.
- [ ] Step 2: `submitCompanies([{ name: "TestCo", domain: "testco.com" }])` -> `onboardingStep=3`.
- [ ] Step 3: `submitProfile(validProfileData, mockCVFile)` -> `onboardingStep=4`.
- [ ] Step 4: `submitQueries(validQueries)` -> `onboardingStep=5`.
- [ ] Step 5: `completeOnboarding({ instructions: "Be professional" })` -> `onboardingStep=50`.
- [ ] Verify `startServer` was called (MSW intercepts `/run_module`).
- [ ] Verify final state in Firestore: `plan="free_trial"`, `onboardingStep=50`, complete `data/account`.
- [ ] Mark completed

### Task 7.2: Integration Test - Full Onboarding Flow - Paid Plan
- [ ] Setup: Create test user with `onboardingStep=1`.
- [ ] Steps 1-5: Execute as above using `selectPlan("base")`.
- [ ] After step 5: Verify `onboardingStep=6` (waits for payment).
- [ ] Verify `startServer` is **not** called yet.
- [ ] Simulate Stripe webhook for `purchaseType="plan"`, `itemId="base"`: Sets `onboardingStep=50`, `plan="base"`, `maxCompanies=20`.
- [ ] Verify `startServer` is called by the webhook (MSW intercepts).
- [ ] Verify final state: `plan="base"`, `onboardingStep=50`.
- [ ] Mark completed

### Task 7.3: Integration Test - Onboarding Flow - Error Interruption
- [ ] Verify user at `onboardingStep=3` calling `submitCompanies` again overwrites correctly (or handles "step already completed" error).
- [ ] Verify user skipping steps (e.g., from `onboardingStep=2` to `completeOnboarding`) returns error or handled gracefully.
- [ ] Verify user losing connection during `submitProfile` upload resumes from correct point.
- [ ] Verify page reload mid-onboarding persists `onboardingStep` and restarts from correct point.
- [ ] Mark completed

### Task 8.1: Integration Test - Credits Purchase Flow
- [ ] Setup: Authenticated user with `credits=0`, `base` plan.
- [ ] Call `POST /api/create-payment` with `purchaseType="credits"`, `itemId="pkg_1000"`: returns `client_secret`.
- [ ] Simulate webhook `payment_intent.succeeded` for `purchaseType="credits"`, `itemId="pkg_1000"`.
- [ ] Verify `users/{uid}.credits` is 1000.
- [ ] Verify payment document created in `users/{uid}/payments/`.
- [ ] Verify `purchase-confirmation` email sent (MSW intercepts Resend).
- [ ] Verify purchasing `pkg_2500` for user with 1000 credits results in 3500 credits after webhook (increment, not replace).
- [ ] Verify purchasing `pkg_5000` increments credits by 5000.
- [ ] Mark completed

### Task 8.2: Integration Test - Webhook Idempotency
- [ ] Verify same `paymentIntentId` sent twice increments credits only once.
- [ ] Verify payment document is not duplicated.
- [ ] Mark completed

### Task 9.1: Backend Python - Unit Test Logic - decide_tasks_per_company - Auto mode
- [ ] Company with `blog_articles=0`, `recruiter=null`, `email_sent=null`: tasks -> `["find_recruiter", "get_blog", "generate_email"]`.
- [ ] Company with `recruiter` present, `blog_articles=0`: tasks -> `["get_blog", "generate_email"]`.
- [ ] Company with `recruiter` and `blog_articles>0`, email not generated: tasks -> `["generate_email"]`.
- [ ] Completely processed company (email generated): tasks -> `[]`.
- [ ] Company with `current_status="processing"`: tasks -> `[]` (already in queue).
- [ ] Mark completed

### Task 9.2: Backend Python - Unit Test Logic - decide_tasks_per_company - Manual mode (override)
- [ ] `force_tasks=["generate_email"]`: only generate_email, ignores current state.
- [ ] `force_tasks=["find_recruiter"]`: only find_recruiter.
- [ ] `force_tasks=[]`: no tasks (explicit override to zero).
- [ ] Mark completed

### Task 9.3: Backend Python - Unit Test Logic - decide_tasks_per_company - Edge cases
- [ ] Verify empty company list returns `{}` (no crash).
- [ ] Verify missing `current_status` field uses safe defaults.
- [ ] Verify `current_status` as `null` uses safe defaults.
- [ ] Verify corrupted data (`current_status` not a dict) does not throw fatal exception.
- [ ] Verify 100 companies in batch have acceptable performance (< 1s).
- [ ] Mark completed

### Task 9.4: Backend Python - Unit Test Logic - Credit Calculation and Limits
- [ ] Verify credit deduction for each task type.
- [ ] Verify insufficient credits: task not queued, error returned.
- [ ] Verify PDL daily request limit: queue logic respected.
- [ ] Mark completed

### Task 10.1: Backend Python - API Routes Test - POST /run_module
- [ ] Valid body `{ "user_id": "test123" }` with mocked `enqueue_job`: returns `{ "status": "queued" }` status 200.
- [ ] Missing `user_id`: returns status 400 with error message.
- [ ] Malformed JSON body: returns status 400.
- [ ] Empty body: returns status 400.
- [ ] Empty string `user_id`: returns status 400.
- [ ] `enqueue_job` exception: returns status 500.
- [ ] Mark completed

### Task 10.2: Backend Python - API Routes Test - Auth and Security
- [ ] Request without auth header (if required): status 401 or 403.
- [ ] Invalid Authorization header: status 401.
- [ ] IP not in whitelist (if firewall present): request denied.
- [ ] Mark completed

### Task 11.1: Backend Python - Firestore Emulator Integration - save_companies_to_results
- [ ] New user (no previous results): pass 3 new companies -> creates 3 docs in `users/{uid}/data/results/` with `email_sent="1970-01-01T00:00:00Z"`.
- [ ] User with existing results: 1 existing + 2 new companies -> only 2 new docs created, existing remains unchanged.
- [ ] Existing company keeps original `email_sent` (not reset).
- [ ] Correctly handle companies in `companies_to_confirm`.
- [ ] Empty company list: no writes performed.
- [ ] Special domain company (subdomain, uncommon TLD): handled correctly.
- [ ] Firestore timeout: handled with retry or clear exception.
- [ ] Mark completed

### Task 11.2: Backend Python - Firestore Emulator Integration - get_custom_queries
- [ ] `data/account` present with queries: returns correct queries.
- [ ] `data/account` absent: returns default `{}`.
- [ ] `queries` field missing in doc: returns default `{}`.
- [ ] `queries` is null: returns default `{}`.
- [ ] Mark completed

### Task 11.3: Backend Python - Firestore Emulator Integration - get_account_data
- [ ] Complete document: returns all fields.
- [ ] Partial document: returns available fields + defaults for missing ones.
- [ ] Document absent: returns default structure (no `KeyError`).
- [ ] Expired or invalid `cvUrl`: handled gracefully.
- [ ] Mark completed

### Task 11.4: Backend Python - Firestore Emulator Integration - Result Updates
- [ ] `update_email_sent`: correctly updates timestamp in Firestore.
- [ ] Batch update of 10 companies: all updated in one transaction.
- [ ] Partial update (only some companies): others left untouched.
- [ ] Mark completed

### Task 12.1: E2E Test - Auth - Landing & Navigation
- [ ] `/` loads correctly: title visible, CTA present.
- [ ] Click "Get Started" or "Login": redirect to `/login`.
- [ ] Click "Register": redirect to `/register`.
- [ ] Navbar logo click: returns to `/`.
- [ ] Mark completed

### Task 12.2: E2E Test - Auth - Login Flow - Success
- [ ] Navigate to `/login`: form is visible.
- [ ] Enter valid email + correct password: click submit -> redirect to `/dashboard`.
- [ ] Verify `CandidAIToken` cookie is present after login.
- [ ] Verify breadcrumb/header shows logged-in username.
- [ ] Mark completed

### Task 12.3: E2E Test - Auth - Login Flow - Failure
- [ ] Wrong password: shows "Invalid credentials" error -> remains on `/login`.
- [ ] Unregistered email: shows visible error message.
- [ ] Empty email: HTML5 validation blocks submit.
- [ ] Empty password: HTML5 validation blocks submit.
- [ ] Malformed email: validation blocks submit.
- [ ] Disabled account: shows specific error message.
- [ ] Mark completed

### Task 12.4: E2E Test - Auth - Login UX
- [ ] Submit button is disabled during request (loading spinner).
- [ ] Password field is type `password` (hidden text).
- [ ] "Forgot password?" link navigates to `/forgot-password`.
- [ ] "Register" link navigates to `/register`.
- [ ] Mark completed

### Task 12.5: E2E Test - Auth - Register Flow
- [ ] Navigate to `/register`: form is visible (success case).
- [ ] Fill name, email, password: click submit -> success (message or redirect).
- [ ] Welcome email sent (verify via MSW intercept log).
- [ ] Empty name: error.
- [ ] Already registered email: message "Email already in use".
- [ ] Password too short: error.
- [ ] Malformed email: error.
- [ ] Mark completed

### Task 12.6: E2E Test - Auth - Forgot Password Flow
- [ ] `/forgot-password`: fill email -> click submit -> message "Check your email".
- [ ] Unregistered email: shows appropriate message (security: without revealing existence).
- [ ] Empty email: validation triggered.
- [ ] Mark completed

### Task 12.7: E2E Test - Auth - Email Verification Flow
- [ ] Unverified user accessing dashboard: email verification dialog visible.
- [ ] Click "Resend verification email": API called -> message "Email sent".
- [ ] Navigate to `/verify/[validId]`: email marked verified -> correct redirect.
- [ ] Navigate to `/verify/[expiredId]`: error "Link expired".
- [ ] Navigate to `/verify/[invalidId]`: error message.
- [ ] Mark completed

### Task 12.8: E2E Test - Auth - Logout and Route Protection
- [ ] Logged-in user: access `/dashboard` -> OK.
- [ ] Unauthenticated user: attempt access `/dashboard` -> redirect to `/login`.
- [ ] Unauthenticated user: attempt access `/dashboard/settings` -> redirect to `/login`.
- [ ] Unauthenticated user: attempt access any `/dashboard/*` -> redirect to `/login`.
- [ ] Logged-in user: access `/login` -> redirect to `/dashboard`.
- [ ] Logout: cookie removed -> redirect to `/login` -> access to `/dashboard` denied.
- [ ] Mark completed

### Task 13.1: E2E Test - Onboarding Flow - Persona A: Free Trial
- [ ] Setup: Registered user, `onboardingStep=1`.
- [ ] Dashboard shows Step 1 (Plan Selection).
- [ ] Step 1: Select "Free Trial" -> click Next -> advance.
- [ ] Step 2: Enter 1 company (name + valid domain "acmecorp.com") -> click Next -> advance.
- [ ] Step 3: Complete profile (experience, education, location), upload valid PDF -> click Next -> advance (verify progress bar/upload).
- [ ] Step 4: Set recruiter search criteria -> click Next -> advance.
- [ ] Step 5: Enter custom instructions -> click "Complete Setup".
- [ ] Verify no payment form shown.
- [ ] Verify `startServer` called (MSW intercept).
- [ ] Verify main dashboard shown (Step 50).
- [ ] Mark completed

### Task 13.2: E2E Test - Onboarding Flow - Persona B: Base Plan
- [ ] Steps 1-5: Select "Base Plan" (€30).
- [ ] After Step 5: Stripe payment form shown.
- [ ] Enter test card data (`4242 4242 4242 4242`).
- [ ] Click "Pay €30" -> loading -> success.
- [ ] Simulate webhook receipt -> dashboard unlocked.
- [ ] Main dashboard shown.
- [ ] Mark completed

### Task 13.3: E2E Test - Onboarding Flow - Persona C: Pro Plan
- [ ] Steps 1-5: Select "Pro Plan" (€69).
- [ ] Card payment -> success.
- [ ] Verify dashboard with `maxCompanies=50`, `credits=1000` is shown.
- [ ] Mark completed

### Task 13.4: E2E Test - Onboarding Flow - Persona D: Ultra Plan
- [ ] Steps 1-5: Select "Ultra Plan" (€139).
- [ ] Verify dashboard with `maxCompanies=100`, `credits=2500` is shown.
- [ ] Mark completed

### Task 13.5: E2E Test - Onboarding Flow - Persona E: The Error Maker
- [ ] Step 1: Click Next without plan -> error "Select a plan".
- [ ] Step 2: Invalid domain ("notadomain") -> validation error.
- [ ] Step 2: Duplicate domain -> error.
- [ ] Step 2: Exceed plan limit (2 companies on free trial) -> limit error.
- [ ] Step 3: Upload non-PDF (e.g., `.jpg`) -> error "Invalid file type".
- [ ] Step 3: Upload PDF exceeding size limit -> error "File too large".
- [ ] Step 3: Click Next without CV -> error "CV required".
- [ ] Step 5: Payment with declined card (`4000 0000 0000 0002`) -> "Card declined".
- [ ] Step 5: Payment with insufficient funds (`4000 0000 0000 9995`) -> appropriate message.
- [ ] Step 5: Payment with expired card -> appropriate message.
- [ ] Navigate back during onboarding: can return to previous step.
- [ ] Page reload mid-onboarding: resumes from correct step (persisted data).
- [ ] Mark completed

### Task 13.6: E2E Test - Onboarding Flow - Step Navigation
- [ ] Verify cannot skip steps via URL (e.g., Step 2 to 4) -> redirected to correct step.
- [ ] If `onboardingStep=50`, direct access to `/dashboard` (no onboarding).
- [ ] Completed step not shown again if `onboardingStep` is further.
- [ ] Mark completed

### Task 14.1: E2E Test - Main Dashboard - Loading and Stats
- [ ] `/dashboard` loads: header, sidebar, content visible.
- [ ] Stats cards shown: "Processing", "Ready to Send", "Emails Sent", "Articles Found".
- [ ] Numerical stats values are correct (from Firestore mock).
- [ ] Skeleton loader visible during fetch -> replaced by data.
- [ ] Empty state shown if no campaigns + CTA.
- [ ] Mark completed

### Task 14.2: E2E Test - Main Dashboard - Active Campaigns
- [ ] Campaign list shows card for each company.
- [ ] Card shows: company name, recruiter name, status, progress bar.
- [ ] Progress bar reflects real state (recruiter found, articles, email generated).
- [ ] Click card -> navigate to `/dashboard/[companyId]`.
- [ ] "Processing" state shows processing indicator.
- [ ] Ready campaign shows "Send" button or similar.
- [ ] Mark completed

### Task 14.3: E2E Test - Main Dashboard - Companies To Confirm
- [ ] If `companies_to_confirm` not empty: section "Companies To Confirm" visible.
- [ ] List shown with data.
- [ ] Click "Confirm" -> form to update company data.
- [ ] Correct confirmation: company removed from list, processed.
- [ ] Cancel: company remains in list.
- [ ] Mark completed

### Task 14.4: E2E Test - Main Dashboard - Add More Companies
- [ ] Click "Add More Companies" -> dialog opens.
- [ ] Enter valid companies -> submit -> dialog closes -> list updated.
- [ ] Invalid domain -> inline error.
- [ ] Duplicate domain -> "Already in list" error.
- [ ] Attempt adding beyond limit -> "Limit Reached" dialog (not the form).
- [ ] Cancel dialog -> no changes.
- [ ] ESC key -> closes dialog.
- [ ] Click outside dialog -> closes dialog.
- [ ] Mark completed

### Task 14.5: E2E Test - Campaign Detail
- [ ] Navigate to `/dashboard/[validCompanyId]`: details visible.
- [ ] Display: company name, recruiter (name, title, email, LinkedIn), articles found, generated email.
- [ ] Generated email visible in preview.
- [ ] "Regenerate Email" button visible (if credits sufficient).
- [ ] Click "Regenerate Email" -> dialog with instructions field.
- [ ] Enter instructions -> confirm -> loading -> new email shown.
- [ ] Credits updated in sidebar badge (decremented by 50).
- [ ] Insufficient credits: "Regenerate" disabled or shows message.
- [ ] "Find New Recruiter" button -> dialog with options.
- [ ] Select alternative strategy -> confirm -> loading -> new recruiter shown.
- [ ] Verify 100 credits deducted.
- [ ] "Change Company": costs 70 credits.
- [ ] Navigate to `/dashboard/[nonExistentId]`: 404 or redirect.
- [ ] Mark completed

### Task 15.1: E2E Test - Send All - Email Visualization
- [ ] `/dashboard/send-all` loads list of ready emails.
- [ ] Each email shows: company name, subject, body preview, recruiter name, recipient email.
- [ ] Checkbox for individual selection.
- [ ] "Select All" selects everything.
- [ ] "Deselect All" deselects everything.
- [ ] Selected counter updates in real-time.
- [ ] Mark completed

### Task 15.2: E2E Test - Send All - Sending Emails
- [ ] Select 2 emails -> click "Send Selected" -> confirmation dialog.
- [ ] Confirm -> API `POST /api/protected/sent_emails` called -> emails marked sent.
- [ ] Sent emails disappear from "Send All" list (or change state).
- [ ] Success message shown.
- [ ] Select 0 emails: "Send Selected" button disabled.
- [ ] "Send All" sends everything in list.
- [ ] Cancel confirmation dialog: no emails sent.
- [ ] Mark completed

### Task 15.3: E2E Test - Send All - Empty State
- [ ] No ready emails: "No emails ready" message -> appropriate CTA.
- [ ] All emails already sent: empty state.
- [ ] Mark completed

### Task 16.1: E2E Test - Sent Emails - History Visualization
- [ ] `/dashboard/sent-emails` loads sent email list.
- [ ] Row shows: company, recruiter, send date, status.
- [ ] Table sortable by column.
- [ ] Empty state if no emails sent.
- [ ] Mark completed

### Task 16.2: E2E Test - Sent Emails - Date Filters
- [ ] Filter "Last 7 days" shows only emails from last 7 days.
- [ ] Filter "Last 30 days" shows only emails from last 30 days.
- [ ] Filter "Custom range" opens calendar picker.
- [ ] Custom range selection filters correctly.
- [ ] Start date > end date: error or automatic swap.
- [ ] Range with no results: empty state.
- [ ] Mark completed

### Task 17.1: E2E Test - Plan & Credits - Visualization
- [ ] `/dashboard/plan-and-credits` loads current plan.
- [ ] Display: current plan, available credits, company limit, features.
- [ ] Current plan highlighted in plan grid.
- [ ] Credit packages shown.
- [ ] Mark completed

### Task 17.2: E2E Test - Plan & Credits - Credit Purchase Success
- [ ] Click "Buy Credits" -> select `pkg_1000` -> Stripe form dialog.
- [ ] Enter test card `4242...` -> pay -> success.
- [ ] Sidebar credit badge updated (+1000).
- [ ] Success message shown.
- [ ] Select `pkg_2500` -> pay -> credits +2500.
- [ ] Select `pkg_5000` -> pay -> credits +5000.
- [ ] Mark completed

### Task 17.3: E2E Test - Plan & Credits - Credit Purchase Cancellation/Failure
- [ ] Open credits dialog -> click "Cancel" or X -> dialog closed -> credits unchanged.
- [ ] Open dialog -> ESC -> dialog closed.
- [ ] Card declined (`4000 0000 0000 0002`) -> "Card declined" message in Stripe form.
- [ ] Insufficient funds -> appropriate message.
- [ ] Expired card -> appropriate message.
- [ ] Cancel after error: dialog closeable without credit modification.
- [ ] Mark completed

### Task 17.4: E2E Test - Plan & Credits - Plan Upgrade
- [ ] Click "Pro" plan (upgrade from "Base") -> confirmation dialog with price.
- [ ] Confirm -> Stripe form -> pay -> plan updated.
- [ ] Header/badge shows new plan.
- [ ] New `maxCompanies` reflected in UI.
- [ ] Attempt downgrade (Pro to Base): disabled button or message (if not allowed).
- [ ] Current plan: no action possible.
- [ ] Upgrade to same plan: no action.
- [ ] Mark completed

### Task 18.1: E2E Test - Billing - Payment History
- [ ] `/dashboard/billing` loads payment history.
- [ ] Row shows: date, type (plan/credits), amount, status, transaction ID.
- [ ] "succeeded" status shown in green, others highlighted differently.
- [ ] Correct EUR format (e.g., "€30.00").
- [ ] Sorted by date (most recent first).
- [ ] Empty state if no payments.
- [ ] Mark completed

### Task 18.2: E2E Test - Billing - Download/Details
- [ ] Click transaction: expands details or navigates to detail.
- [ ] If available: download invoice -> file downloaded.
- [ ] Mark completed

### Task 19.1: E2E Test - Profile - Visualization
- [ ] `/dashboard/profile` loads profile data.
- [ ] Display: current name, email (read-only), plan, credits.
- [ ] Name field is editable.
- [ ] Profile picture upload (if supported).
- [ ] Mark completed

### Task 19.2: E2E Test - Profile - Name Modification
- [ ] Edit name -> click "Save" -> API `PUT /api/protected/user` -> success toast.
- [ ] Updated name visible in sidebar after save.
- [ ] Empty name -> validation error.
- [ ] Unchanged name: click save -> no update or no-op update.
- [ ] Network error during save -> error toast.
- [ ] Mark completed

### Task 19.3: E2E Test - Profile - Picture Upload
- [ ] Click "Change Picture" -> file chooser -> select image -> upload -> photo updated.
- [ ] Non-image file -> error.
- [ ] Image exceeding size limit -> error.
- [ ] Mark completed

### Task 20.1: E2E Test - Settings - Notification Settings
- [ ] `/dashboard/settings` loads current settings.
- [ ] Toggle "Marketing Emails": correct default shown.
- [ ] Toggle ON -> save -> API updates Firestore -> success toast.
- [ ] Toggle OFF -> save -> API updates Firestore.
- [ ] Page reload: persisted settings shown correctly.
- [ ] "Reminder Frequency" selector: daily, weekly, monthly, never options available.
- [ ] Change frequency -> save -> persisted.
- [ ] Mark completed

### Task 20.2: E2E Test - Settings - Edge Cases
- [ ] Modify setting -> navigate away without saving -> setting not persisted.
- [ ] Reset settings to defaults (if functionality present).
- [ ] Mark completed

### Task 21.1: E2E Test - Dashboard Navigation - Sidebar
- [ ] All sidebar links navigate correctly.
- [ ] Active link highlighted based on current route.
- [ ] Sidebar credit badge updated after purchase.
- [ ] Mobile: hamburger menu -> sidebar slide-in -> click link -> sidebar closes -> navigate.
- [ ] Mobile: tap outside sidebar -> sidebar closes.
- [ ] Mark completed

### Task 21.2: E2E Test - Dashboard Navigation - Route Errors
- [ ] Navigate to `/dashboard/nonexistent-page`: 404 or redirect to `/dashboard`.
- [ ] Navigate to `/nonexistent`: 404 page.
- [ ] Mark completed

### Task 21.3: E2E Test - Dashboard Navigation - Back Button
- [ ] Dashboard -> Campaign detail -> Back -> returns to Dashboard.
- [ ] Settings -> Back -> returns to previous page.
- [ ] Mark completed

### Task 22.1: E2E Test - Accessibility
- [ ] Every page has an appropriate `<h1>`.
- [ ] Form inputs have associated `<label>`.
- [ ] Dialog has `aria-modal`, `aria-label`.
- [ ] Focus trap inside open dialog.
- [ ] Tab navigation works throughout the dashboard.
- [ ] Toast notifications announced via `aria-live`.
- [ ] WCAG AA color contrast (visual verification).
- [ ] Mark completed

### Task 22.2: E2E Test - Responsive
- [ ] Mobile (375px): responsive layout, collapsed sidebar.
- [ ] Tablet (768px): hybrid layout.
- [ ] Desktop (1280px): full layout.
- [ ] No horizontal overflow on any breakpoint.
- [ ] Form usable on mobile (inputs, labels, buttons).
- [ ] Mark completed

### Task 23.1: Security Tests - Auth Security
- [ ] Requests to `/api/protected/*` without cookie: return status 401 (no data leaked).
- [ ] Manually modified cookie: token validation fails -> status 401.
- [ ] Cookie from another user (`uid=attacker`): no access to victim data.
- [ ] Stripe webhook without valid signature: status 400 (no processing).
- [ ] Stripe webhook with test signature in production environment: rejected.
- [ ] Mark completed

### Task 23.2: Security Tests - Input Validation
- [ ] XSS: company name with `<script>alert(1)</script>` -> saved escaped, not executed.
- [ ] XSS: custom instructions with XSS payload -> escaped.
- [ ] SQL Injection: Verify Firestore queries use safe parameters (not applicable but verified).
- [ ] Path traversal: `companyId` with `../../../etc/passwd` -> Firestore document path does not reach file system.
- [ ] `companyId` with special characters (`%00`, null byte): handled gracefully.
- [ ] CSRF: API routes with mutation methods (PUT, POST, DELETE) require auth cookie.
- [ ] Mark completed

### Task 23.3: Security Tests - Rate Limiting
- [ ] 10+ requests to `POST /api/auth` in 1 minute from same IP: rate limit activated (if implemented).
- [ ] 10+ requests to `POST /api/auth/forgot-password`: rate limit activated.
- [ ] Mark completed

### Task 24.1: Cross-Browser Tests
- [ ] Run critical E2E tests (auth, onboarding, dashboard) on Chromium.
- [ ] Run critical E2E tests on Firefox.
- [ ] Run critical E2E tests on WebKit (Safari).
- [ ] No browser-specific regressions in forms and dialogs.
- [ ] Stripe Elements works correctly on all browsers.
- [ ] Mark completed

### Task 25.1: CI/CD Pipeline Setup
- [ ] Create `.github/workflows/ci.yml` triggered on `push` and `pull_request` to `main`.
- [ ] Step 1: `actions/checkout@v4`.
- [ ] Step 2: `actions/setup-node@v4` with Node.js 20.
- [ ] Step 3: `npm ci` to install dependencies.
- [ ] Step 4: `actions/setup-python@v5` with Python 3.11.
- [ ] Step 5: `pip install -r requirements.txt -r requirements-test.txt`.
- [ ] Step 6: `npm i -g firebase-tools`.
- [ ] Step 7: `npx playwright install --with-deps chromium firefox webkit`.
- [ ] Step 8: `firebase emulators:exec --project demo-candidai "npm run test:all"`.
- [ ] On Playwright failure: upload artifacts (screenshots, traces, videos) via `actions/upload-artifact@v4`.
- [ ] Branch protection on `main`: CI required before merge.
- [ ] Cache `node_modules` and `~/.cache/pip` between runs.
- [ ] Mark completed