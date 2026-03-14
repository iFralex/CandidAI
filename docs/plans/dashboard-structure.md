# Plan: CandidAI Dashboard Expansion & User Settings Refactoring

## Overview
This plan introduces a comprehensive expansion of the dashboard capabilities. It adds the ability to append new target companies to the generation queue (reusing onboarding components) and introduces new dedicated pages: Settings, Profile, Billing, and All Sent Emails. 
The sidebar navigation is refactored to dynamically highlight the active page. The profile dropdown is implemented using `shadcn/ui`. To efficiently separate sent emails from pending ones, the `email_sent` database architecture is migrated from a boolean `false` to an epoch date (`1970-01-01`), allowing native Firestore date-range queries.
If any shardcn ui component is not present, use the command: npx shadcn@latest add {component_name}

## Validation Commands
- `npm run lint`
- `npm run build`
- `grep -r "radix-ui" src/` (to ensure we are using `shadcn/ui` wrappers and not bare radix primitives where applicable)

---

### Task 1: Dynamic Sidebar Active State & Profile Dropdown
- [x] Open `src/components/SidebarClientWrapper.tsx`.
- [x] Import `usePathname` from `next/navigation`. Update the navigation items mapping to determine the `active` state dynamically by comparing the item's `href` with the current `pathname`.
- [x] Locate the user profile card at the bottom of the sidebar. Wrap it in a `shadcn/ui` `<DropdownMenu>`.
- [x] Add the following `<DropdownMenuItem>` elements inside the dropdown menu:
  - "View Profile" (links to `/dashboard/profile`)
  - "All Sent Emails" (links to `/dashboard/sent-emails`)
  - "Billing" (links to `/dashboard/billing`)
  - `<DropdownMenuSeparator />`
  - "Log Out" (triggers Firebase sign-out and clears cookies)
- [x] Mark completed.

---

### Task 2: Refactoring `email_sent` Logic & Python Backend Integration
- [x] Open `src/actions/onboarding-actions.ts`. In the functions that initialize campaign results or generate emails, change the default initialization of the `email_sent` field from `false` to a Firestore Timestamp representing `1970-01-01T00:00:00Z` (Epoch).
- [x] **Python Backend (`candidai_script`)**: Open the Python backend script. Locate where the database rows for newly discovered recruiters/companies are created. Change the `email_sent` default value being written to Firestore from `False` to a datetime object representing `1970-01-01`.
- [x] Update the `dashboardServer.tsx` (or the API route `results/route.ts`) to modify the main dashboard query: it must now fetch only the campaigns where `email_sent == Timestamp(1970-01-01)` (meaning they are pending/processing).
- [x] Mark completed.

---

### Task 3: Adding Target Companies Post-Onboarding
- [x] Open `src/app/dashboard/page.tsx` (Main Dashboard). Add a `shadcn/ui` `<Button>` labeled "Add More Companies" at the top of the campaign list.
- [x] When clicked, open a `shadcn/ui` `<Dialog>` that renders the existing Company Selection component reused from the onboarding flow (`src/components/CompanyInput.tsx` or similar).
- [x] Create a new server action `addNewCompanies(companies)` in `src/actions/onboarding-actions.ts`:
  - Fetch the user's `companiesLimit` from their plan.
  - Count the existing documents in `users/{uid}/data/results`.
  - If `current + new > limit`, throw an "Exceeds plan limit" error.
  - If valid, batch write the new companies to Firestore (initializing `email_sent` with the 1970 Epoch).
  - Call `startServer(userId)` at the end of the action.
- [x] **Python Backend (`candidai_script`)**: Verify the backend `run_module` logic. Ensure that when `startServer` is triggered, the script fetches all companies from `results`, filters for those that haven't been processed yet (no email generated), and safely processes the newly appended ones.
- [x] Mark completed.

---

### Task 4: All Sent Emails Page (`/dashboard/sent-emails`)
- [x] Create a new page at `src/app/dashboard/sent-emails/page.tsx`.
- [x] Create a server-side fetch function that queries the `users/{uid}/data/results` collection for documents where `email_sent > Timestamp(1970-01-01)`.
- [x] Render the fetched campaigns using the existing `CampaignCard` component.
- [x] Add a Date Filter at the top of the page using `shadcn/ui` components (`<Popover>`, `<Calendar>`, `<Select>`). When a date range is selected, update the page state to filter the rendered list locally or via a new server action query.
- [x] Mark completed.

---

### Task 5: Settings Page (`/dashboard/settings`)
- [ ] Create a new page at `src/app/dashboard/settings/page.tsx`.
- [ ] Build a form using `shadcn/ui` `<Form>`, `<Switch>` (for marketing email authorization), and `<Select>` (for reminder email frequency).
- [ ] Create a server action `updateSettings(data)` that writes to the document `users/{uid}/data/settings/preferences` (using `set` with `{ merge: true }`).
- [ ] Fetch the existing settings on page load and populate the default values of the form.
- [ ] Mark completed.

---

### Task 6: Profile Page (`/dashboard/profile`)
- [ ] Create a new page at `src/app/dashboard/profile/page.tsx`.
- [ ] **Section 1: Basic Info**. Create a form for Profile Picture (uploading to Firebase Storage) and Name.
- [ ] **Section 2: Email Update (AdminAuth)**. Add an input for the Email address. Create a server action `updateUserEmail(newEmail)`:
  - Import `adminAuth` from `src/lib/firebase-admin.ts`.
  - Call `await adminAuth.updateUser(uid, { email: newEmail, emailVerified: false })`. This bypasses the client-side fresh token requirement.
  - Use `adminAuth.generateEmailVerificationLink(newEmail)` and send it to the user via Resend to verify the new address.
- [ ] **Section 3: Onboarding Data**. Import and reuse the exact components from the onboarding flow for:
  - User Profile (Skills, Experience, Education)
  - Default Recruiter Criteria
  - Default Custom Prompt
- [ ] Wire these components to a server action `updateAccountData(data)` that updates `users/{uid}/data/account/{docId}`.
- [ ] **Python Backend (`candidai_script`)**: Verify that the Python script downloads the `data/account` profile information *only once* at the beginning of the `run_module` execution. This ensures that if the user updates their profile/prompts mid-generation, it won't corrupt the ongoing loop for the current batch.
- [ ] Mark completed.

---

### Task 7: Billing History Page (`/dashboard/billing`)
- [ ] Create a new page at `src/app/dashboard/billing/page.tsx`.
- [ ] Create a server function `fetchBillingHistory()` that queries the `users/{uid}/payments` subcollection, ordered by `createdAt` descending.
- [ ] Render the data using the `shadcn/ui` `<Table>` components (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableCell`).
- [ ] Display columns for: Date, Description/Item (e.g., "Pro Plan" or "2500 Credits"), Amount, and Status.
- [ ] Mark completed.