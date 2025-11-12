import { Crown, Gift, Rocket, Target } from "lucide-react";

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

export const plansInfo = [
  {
    id: 'free_trial',
    name: "Free Trial",
    price: 0,
    description: "Try with one company",
    features: [
      "1 company analysis",
      "1 recruiter match",
      "1 personalized email",
      "Basic company research"
    ],
    highlight: "Perfect to test our AI",
    icon: Gift,
    color: "from-green-500 to-emerald-600"
  },
  {
    id: 'base',
    name: "Base",
    price: 25,
    description: "Perfect for targeted job search",
    features: [
      "25 companies maximum",
      "10 recruiters analyzed per company",
      "3 detailed recruiter profiles",
      "1 personalized email per company",
      "Basic company intelligence"
    ],
    highlight: "Great for focused search",
    icon: Target,
    color: "from-blue-500 to-cyan-600"
  },
  {
    id: 'pro',
    name: "Pro",
    price: 59,
    description: "For serious job seekers",
    features: [
      "50 companies maximum",
      "25 recruiters analyzed per company",
      "10 detailed recruiter profiles",
      "2 personalized emails per company",
      "1 additional search filter",
      "Follow-up email automation"
    ],
    highlight: "Most Popular",
    icon: Rocket,
    color: "from-violet-500 to-purple-600",
    popular: true
  },
  {
    id: 'ultra',
    name: "Ultra",
    price: 119,
    description: "Maximum job search power",
    features: [
      "100 companies maximum",
      "100 recruiters analyzed per company",
      "25 detailed recruiter profiles",
      "3 personalized emails per company",
      "3 additional search filters",
      "AI company recommendations",
      "Company name search"
    ],
    highlight: "Ultimate power",
    icon: Crown,
    color: "from-yellow-500 to-orange-600"
  }
];

export const plansData = {
  free_trial: {
    credits: 0,
    maxCompanies: 1
  },
  base: {
    credits: 0,
    maxCompanies: 25
  },
  pro: {
    credits: 1000,
    maxCompanies: 50
  },
  ultra: {
    credits: 2500,
    maxCompanies: 100
  }
}