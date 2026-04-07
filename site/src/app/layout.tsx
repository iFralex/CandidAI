import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
    default: "CandidAI — Land Your Dream Job with AI",
    template: "%s | CandidAI",
  },
  description:
    "CandidAI finds the right recruiters and writes personalised job-application emails for you — automatically. Apply to dozens of companies in minutes.",
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
    title: "CandidAI — Land Your Dream Job with AI",
    description:
      "CandidAI finds the right recruiters and writes personalised job-application emails for you — automatically.",
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
    title: "CandidAI — Land Your Dream Job with AI",
    description:
      "CandidAI finds the right recruiters and writes personalised job-application emails for you — automatically.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === "production" && (
          <Script type="text/javascript" src="https://embeds.iubenda.com/widgets/71eada8f-b797-45de-97dd-e9467691d6b4.js" />
        )}
      </head>
      <body
        className={`dark ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AnalyticsProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AnalyticsProvider>
      </body>
    </html>
  );
}