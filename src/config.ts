export const serverConfig = {
  cookieName: process.env.AUTH_COOKIE_NAME!,
  cookieSignatureKeys: [process.env.AUTH_COOKIE_SIGNATURE_KEY_CURRENT!, process.env.AUTH_COOKIE_SIGNATURE_KEY_PREVIOUS!],
  cookieSerializeOptions: {
    path: "/",
    httpOnly: true,
    secure: process.env.USE_SECURE_COOKIES === "true",
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
}

export const plansData = {
  free_trial: {
    credits: 0,
    maxCompanies: 1,
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

  if (data.customInstructions)
    features.push("Custom Instructions");

  if (data.recruiterStrategy)
    features.push(
      `Custom strategy for recruiter search with ${data.recruiterStrategy} criteria`
    );

  if (data.followUpAutomation)
    features.push("Follow-up email automation");

  if (data.companyConfirmationCalls)
    features.push("Company confirmation calls");

  if (data.deepDiveReports)
    features.push("Company information deep-dive reports");

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
    pricesLifetime: 0,
    description: "Try with one company",
    features: staticFeatures.free_trial,
    highlight: "Perfect to test our AI",
    icon: "Gift",
    color: "from-green-500 to-emerald-600"
  },
  {
    id: "base",
    name: "Base",
    price: 30,
    pricesLifetime: 199,
    description: "Perfect for targeted job search",
    features: staticFeatures.base,
    highlight: "Great for focused search",
    icon: "Target",
    color: "from-blue-500 to-cyan-600"
  },
  {
    id: "pro",
    name: "Pro",
    price: 69,
    pricesLifetime: 399,
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
    price: 139,
    pricesLifetime: 799,
    description: "Maximum job search power",
    features: staticFeatures.ultra,
    highlight: "Ultimate power",
    icon: "Crown",
    color: "from-yellow-500 to-orange-600"
  }
];

export const billingOptions = [
  {
    value: 'monthly',
    label: 'Monthly',
    sublabel: 'Recurring',
    months: 'Pay monthly',
    discount: null,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    value: 'biennial',
    label: '2 Years',
    sublabel: '3 months active',
    months: '3 mo / 2yr',
    discount: '10%',
    color: 'from-purple-500 to-pink-500'
  },
  {
    value: 'quintennial',
    label: '5 Years',
    sublabel: '5 months active',
    months: '5 mo / 5yr',
    discount: '15%',
    color: 'from-orange-500 to-red-500'
  },
  {
    value: 'lifetime',
    label: 'Lifetime',
    sublabel: '1 month/year',
    months: '1 mo / year',
    discount: ' ∞ %',
    color: 'from-emerald-500 to-teal-500'
  }
];

export const billingData = {
  monthly: {
    label: 'Monthly',
    sublabel: 'Recurring',
    duration: '1 month',
    discount: 0,
    durationM: 1,
    activableTimes: 1,
    description: 'Billed monthly, cancel anytime',
    savings: null
  },
  biennial: {
    label: 'Biennial',
    sublabel: '3 slots activable',
    duration: '2 years',
    discount: 10,
    durationM: 24,
    activableTimes: 3,
    description: 'Billed once every 2 years',
    savings: 'Save 10% compared to monthly'
  },
  triennial: {
    label: 'Triennial',
    sublabel: '4 slots active',
    duration: '3 years',
    discount: 15,
    durationM: 36,
    activableTimes: 4,
    description: 'Billed once every 3 years',
    savings: 'Save 15% compared to monthly'
  },
  lifetime: {
    label: 'Lifetime',
    sublabel: '1 slot/year',
    duration: 'Forever',
    discount: 100,
    durationM: 12,
    activableTimes: 1,
    description: 'One-time payment for lifetime access',
    savings: 'Save Infinity with lifetime access'
  }
};

export const referralCodes = {
  "afk": 20,
  "testa": 99,
}