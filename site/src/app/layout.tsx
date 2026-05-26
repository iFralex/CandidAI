import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieBanner } from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = "https://candidai.tech";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "CandidAI - Land Your Dream Job with AI",
    template: "%s | CandidAI",
  },
  description:
    "CandidAI finds the right recruiters and writes personalised job-application emails for you, automatically. Apply to dozens of companies in minutes.",
  keywords: [
    "job search",
    "AI emails",
    "job application",
    "recruiter finder",
    "career",
    "artificial intelligence",
    "email automation",
  ],
  authors: [{ name: "CandidAI", url: BASE_URL }],
  creator: "CandidAI",
  publisher: "CandidAI",
  applicationName: "CandidAI",
  category: "productivity",

  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      { rel: "mask-icon", url: "/favicon-32x32.png", color: "#7c3aed" },
    ],
  },

  manifest: "/site.webmanifest",

  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "CandidAI",
    title: "CandidAI - Land Your Dream Job with AI",
    description:
      "CandidAI finds the right recruiters and writes personalised job-application emails for you, automatically.",
    images: [
      {
        url: "/og-image.png",
        width: 512,
        height: 512,
        alt: "CandidAI logo",
      },
    ],
    locale: "en_US",
  },

  twitter: {
    card: "summary",
    site: "@candidai",
    creator: "@candidai",
    title: "CandidAI - Land Your Dream Job with AI",
    description:
      "CandidAI finds the right recruiters and writes personalised job-application emails for you, automatically.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: BASE_URL,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CandidAI",
  url: BASE_URL,
  logo: `${BASE_URL}/android-chrome-512x512.png`,
  description:
    "CandidAI finds the right recruiters and writes personalised job-application emails for you, automatically.",
  sameAs: ["https://twitter.com/candidai"],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: `${BASE_URL}/contact`,
  },
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CandidAI",
  url: BASE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Windows, macOS",
  description:
    "AI-powered platform that finds the right recruiters and writes personalised job-application emails automatically. Apply to dozens of companies in minutes.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  publisher: {
    "@type": "Organization",
    name: "CandidAI",
    url: BASE_URL,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CandidAI",
  url: BASE_URL,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body
        className={`dark ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AnalyticsProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AnalyticsProvider>
        <CookieBanner />
        <SpeedInsights />
      </body>
    </html>
  );
}