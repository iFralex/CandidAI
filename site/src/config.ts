export const serverConfig = {
  cookieName: process.env.AUTH_COOKIE_NAME!,
  cookieSignatureKeys: [process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!, process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!],
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    secure: process.env.USE_SECURE_COOKIES === "true" || process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 12 * 60 * 60 * 24,
  },
  serviceAccount: {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")!,
  }
};

export const clientConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

export const creditsInfo = {
  prompt: {
    cost: 100,
    description: "Unlock the complete prompt used to generate the email"
  },
  "generate-email": {
    cost: 50,
    description: "Generate a new email using custom instructions for this company"
  },
  "find-recruiter": {
    cost: 100,
    description: "Find a new recruiter using a custom strategy for this company"
  },
  "change-company": {
    cost: 70,
    description: "Replace the selected companies with new ones and retrieve their updated data"
  },
  "research-blog-articles": {
    cost: 75,
    description: "Search for new blog articles for this company"
  },
  "follow-up": {
    cost: 50,
    description: "Generate another personalized follow-up version with new instructions"
  },
}

export const plansData = {
  free_trial: {
    credits: 0,
    maxCompanies: 1,
    revealRecruiterEmail: false,
    customInstructions: false,
    recruiterStrategy: false,
    followUpAutomation: false,
    companyConfirmationCalls: false,
    deepDiveReports: false,
    aiRecommendations: false,
    generationPriority: false
  },
  base: {
    credits: 0,
    maxCompanies: 20,
    revealRecruiterEmail: true,
    customInstructions: false,
    recruiterStrategy: false,
    followUpAutomation: false,
    companyConfirmationCalls: false,
    deepDiveReports: false,
    aiRecommendations: false,
    generationPriority: false
  },
  pro: {
    credits: 1000,
    maxCompanies: 50,
    revealRecruiterEmail: true,
    customInstructions: true,
    recruiterStrategy: 30,
    followUpAutomation: true,
    companyConfirmationCalls: false,
    deepDiveReports: false,
    aiRecommendations: false,
    generationPriority: false
  },
  ultra: {
    credits: 2500,
    maxCompanies: 100,
    revealRecruiterEmail: true,
    customInstructions: true,
    recruiterStrategy: 50,
    followUpAutomation: true,
    companyConfirmationCalls: true,
    deepDiveReports: true,
    aiRecommendations: true,
    generationPriority: true
  }
};

// --------------------------
//  GENERATORE DI TESTO (solo nel file, non a runtime)
// --------------------------

function buildFeatures(data) {
  const features = [
    `${data.maxCompanies} companies maximum`,
  ];

  if (data.credits > 0)
    features.push(`${data.credits} credits included`);

  if (data.revealRecruiterEmail)
    features.push("Recruiter's verified email included");

  if (data.customInstructions)
    features.push("Custom Instructions");

  if (data.recruiterStrategy)
    features.push(
      `Recruiter search strategy with ${data.recruiterStrategy} custom criteria`
    );

  if (data.followUpAutomation)
    features.push("Personalized follow-ups and timing reminders");

  if (data.companyConfirmationCalls)
    features.push("Company confirmation calls");

  if (data.deepDiveReports) {
    features.push("Company information deep-dive reports");
    features.push("Per-company recruiter strategies and custom instructions");
  }

  if (data.aiRecommendations)
    features.push("AI company recommendations");

  if (data.generationPriority)
    features.push("Generation priority");

  return features;
}

// --------------------------
//  FEATURES STATICHE PRE-GENERATE
// --------------------------

const staticFeatures = {
  free_trial: buildFeatures(plansData.free_trial),
  base: buildFeatures(plansData.base),
  pro: buildFeatures(plansData.pro),
  ultra: buildFeatures(plansData.ultra)
};

// --------------------------
//  plansInfo con features STATICHE
// --------------------------

export const plansInfo = [
  {
    id: "free_trial",
    name: "Free Trial",
    price: 0,
    description: "Try with one company",
    features: staticFeatures.free_trial,
    highlight: "Perfect to test our AI",
    icon: "Gift",
    color: "from-green-500 to-emerald-600"
  },
  {
    id: "base",
    name: "Base",
    price: 24,
    description: "Perfect for targeted job search",
    features: staticFeatures.base,
    highlight: "Great for focused search",
    icon: "Target",
    color: "from-blue-500 to-cyan-600"
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    description: "For serious job seekers",
    features: staticFeatures.pro,
    highlight: "Most Popular",
    popular: true,
    icon: "Rocket",
    color: "from-violet-500 to-purple-600"
  },
  {
    id: "ultra",
    name: "Ultra",
    price: 109,
    description: "Maximum job search power",
    features: staticFeatures.ultra,
    highlight: "Ultimate power",
    icon: "Crown",
    color: "from-yellow-500 to-orange-600"
  }
];

/**
 * A plan is "paid" when it is a real purchased tier (price > 0). `free_trial`
 * and an unset/undefined plan are NOT paid. Used to decide whether a plan
 * purchase is a user's FIRST paid plan — which must run the post-purchase
 * onboarding — versus an already-paid user changing tier.
 */
export function isPaidPlan(plan?: string | null): boolean {
  if (!plan) return false;
  const info = plansInfo.find((p) => p.id === plan);
  return info ? info.price > 0 : plan !== "free_trial";
}

/**
 * Ordinal tier rank of a plan, by price (free_trial = 0, base = 1, pro = 2,
 * ultra = 3). Unknown/unset plans rank 0. Used to compare tiers for upgrade /
 * downgrade decisions without hardcoding the plan ids.
 */
export function planRank(plan?: string | null): number {
  if (!plan) return 0;
  const idx = [...plansInfo].sort((a, b) => a.price - b.price).findIndex((p) => p.id === plan);
  return idx < 0 ? 0 : idx;
}

/**
 * Whether a user on `currentPlan` may purchase `targetPlan`. Buying a strictly
 * lower tier is not allowed — it would drop paid-for features (see the tier
 * overwrite discussion). Same tier (capacity top-up) and upgrades are allowed.
 */
export function isPlanPurchasable(currentPlan: string | null | undefined, targetPlan: string): boolean {
  return planRank(targetPlan) >= planRank(currentPlan);
}

export const CREDIT_PACKAGES = [
  { id: "pkg_1000", credits: 1000, price: 1000 }, // 10€
  { id: "pkg_2500", credits: 2500, price: 2000 }, // 20€
  { id: "pkg_5000", credits: 5000, price: 3000 }  // 30€
];

export const referralCodes = {
  "afk": 20,
}

// NOTE: discount codes have been moved to Firestore (collection `discount_codes`)
// for privacy + live management. See lib/discount-codes.ts (server-only) and the
// /api/discount/validate endpoint. The in-bundle map was visible to anyone who
// opened DevTools — Firestore registry fixes that.
//
// To add/edit codes:
//   - seed/update via Firebase console, OR
//   - run site/scripts/seed-discount-codes.mjs (one-shot)
