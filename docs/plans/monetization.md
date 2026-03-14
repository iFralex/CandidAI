# Plan: CandidAI One-Time Monetization & Credits Refactoring

## Overview
Transform the monetization system from a recurring subscription model (Stripe/Nexi) to a **strictly Pay-As-You-Go / One-Time Purchase** model via Stripe. The concept of a "Plan" is kept but it becomes a one-time purchase (never expires, removing the `expirate` field), allowing the user to buy a new plan once they run out of their company limits. 
A new modular credit package system (10€, 20€, 30€) is introduced. The UI heavily reuses components (like the plan selector and a unified checkout component) across the Landing Page, Onboarding, a new `/dashboard/plan-and-credits` page, and an emergency Dialog when credits run out, ensuring zero code duplication. Nexi is completely removed to simplify the codebase.

## Validation Commands
- `npm run lint`
- `npm run build`
- `npx stripe listen --forward-to localhost:3000/api/stripe-webhook` (for local webhook testing)

---

### Task 1: Complete Nexi Removal & Expiration Logic
- [x] Open `src/app/api/protected/nexi-payment/route.ts` and delete the entire file.
- [x] Open `.env.local` and remove the variables `NEXT_PUBLIC_NEXI_ALIAS` and `NEXT_PUBLIC_NEXI_SECRET_KEY`.
- [x] Open `src/components/onboarding.tsx` and `src/components/onboardingServer.tsx`. Remove any UI elements, functions, or server logic related to Nexi payments.
-[x] Open `src/actions/onboarding-actions.ts`. In the onboarding completion / user setup logic, **completely remove the initialization of the `expirate` field**.
- [x] Open the Python backend file `candidai_script`. Find the logic that validates the user's subscription and remove the check for `expired`. The backend must now rely solely on the target companies limit vs processed companies.
- [x] Mark completed.

---

### Task 2: Update Pricing Configurations (`src/config.ts`)
- [ ] Open `src/config.ts`.
- [ ] Modify the `Plan` type and existing plans: remove `monthly`, `biennial`, `quintennial`, `lifetime` from the `price` object. Keep a single numeric value (e.g., `price: 4900` for €49.00).
- [ ] Add and export a new constant `CREDIT_PACKAGES`:
  ```typescript
  export const CREDIT_PACKAGES =[
    { id: "pkg_1000", credits: 1000, price: 1000 }, // 10€
    { id: "pkg_2500", credits: 2500, price: 2000 }, // 20€
    { id: "pkg_5000", credits: 5000, price: 3000 }  // 30€
  ];
  ```
- [ ] Update the `computePriceInCents` function so it accepts a purchase type (`plan` or `credits`) and the corresponding ID, returning the exact amount without calculating duration discounts.
- [ ] Mark completed.

---

### Task 3: Stripe Backend Refactoring (PaymentIntents Only)
- [ ] Rename the file `src/app/api/create-subscription/route.ts` to `src/app/api/create-payment/route.ts`.
- [ ] Refactor the route to exclusively call `stripe.paymentIntents.create`. Remove all logic related to creating Stripe Subscriptions or Customers for recurring billing.
- [ ] Add metadata to the PaymentIntent: `{ userId: string, purchaseType: 'plan' | 'credits', itemId: string }`.
- [ ] Open `src/app/api/stripe-webhook/route.ts`. Remove the handling of the `invoice.paid` event and any `stripe.subscriptions` calls.
- [ ] Implement handling for the `payment_intent.succeeded` event exclusively.
- [ ] Inside the webhook logic:
  - If `purchaseType === 'credits'`: Use `adminDb` to update the user document with `FieldValue.increment(creditsAmount)` on the `credits` field.
  - If `purchaseType === 'plan'`: Update the user's `plan` field, reset or add to their generated companies limit, and increment the base credits included in the plan.
  - Write a payment record to the `users/{uid}/payments/{paymentId}` subcollection.
- [ ] Mark completed.

---

### Task 4: Unified Checkout & Reusable Selection Components
- [ ] Create `src/components/UnifiedCheckout.tsx`. Extract the existing Stripe checkout logic from the final step of the onboarding into this component. Adapt it so it accepts a `purchaseType` and `itemId` as props, allowing it to dynamically handle both plan purchases and credit purchases without duplicating code.
- [ ] Create `src/components/CreditSelector.tsx`. Build a clean UI to display the 3 credit packages. It should accept an `onSelect` callback.
- [ ] Ensure the existing Plan Selector component (used in the landing page) is modular enough to be imported and reused elsewhere.
- [ ] Mark completed.

---

### Task 5: Refactor Insufficient Credits Flow
- [ ] Open `src/app/dashboard/[id]/client.tsx` and locate the `CreditsDialog` component.
- [ ] Locate the "Insufficient credits" error block.
- [ ] Replace the hardcoded `<Link>` with a shadcn/ui `<Button>` that triggers a shadcn/ui `<Dialog>`.
- [ ] Inside this new Dialog, render **both** the `CreditSelector` and the `UnifiedCheckout` components simultaneously. When the user clicks a package in the selector, the checkout component instantly updates to process that specific amount. This ensures the user can buy credits with the minimum number of clicks without leaving the modal.
- [ ] Mark completed.

---

### Task 6: New Plan & Credits Dashboard Page
- [ ] Create a new page at `src/app/dashboard/plan-and-credits/page.tsx`.
- [ ] In the top section of this page, import and reuse the **Plan Selector** component (the exact same one used in the landing page and onboarding) to allow users to buy a new plan when their limit is reached.
- [ ] In the bottom section, import and reuse the `CreditSelector.tsx` component.
- [ ] In this specific page context, pass a prop to `CreditSelector` to render a "Buy" button inside each credit package card. When clicked, it should open a shadcn/ui `<Dialog>` containing **only** the `UnifiedCheckout.tsx` component (since the package has already been selected).
- [ ] Open `src/components/SidebarClientWrapper.tsx` (or the top navigation where credits are displayed). Next to the credits indicator, add a compact `+` button (using the Lucide `Plus` icon). Clicking it should route the user to `/dashboard/plan-and-credits`.
- [ ] Mark completed.

---

### Task 7: Transactional Email via Resend
- [ ] Open `src/app/api/send-email/route.ts`.
- [ ] Add `"purchase-confirmation"` to the `EmailType` union type.
-[ ] Implement the HTML template block for this email. It should accept a payload containing: `amount` (e.g., "€10.00"), `item` (e.g., "2500 Credits" or "Pro Plan"), `newBalance`, and the `receiptUrl` provided by Stripe.
- [ ] Open `src/app/api/stripe-webhook/route.ts`. Upon successful completion of `payment_intent.succeeded`, trigger the `POST` request to the `/api/send-email` route with the updated transaction details to send the receipt to the user.
- [ ] Mark completed.

---

### Task 8: Landing Page & Onboarding Cleanup
- [ ] Open `src/components/landing.tsx`. Remove the "Monthly / Yearly" billing toggle state and UI entirely. Update the pricing copy to reflect one-time purchases (e.g., "Pay once, use until finished", "No subscriptions"). Ensure it uses the shared Plan Selector component.
- [ ] Open `src/components/onboarding.tsx`. Update Step 1 (Plan Selection) to rely entirely on the shared Plan Selector component, showing single prices and removing any references to recurring billing durations.
- [ ] Verify that step 7 (Launch) uses the refactored `UnifiedCheckout.tsx` component.
- [ ] Mark completed.