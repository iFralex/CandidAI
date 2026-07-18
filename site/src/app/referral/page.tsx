import type { Metadata } from "next";
import ReferralPage from "./client";

const title = "Ambassador Program";
const description = "Join the CandidAI Ambassador Program, share a personal referral link, and earn progressive commissions on qualifying purchases.";

export const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: "/referral" },
    openGraph: {
        title: `${title} | CandidAI`,
        description,
        url: "/referral",
        type: "website",
        images: [{ url: "/og-image.png", width: 512, height: 512, alt: "CandidAI Ambassador Program" }],
    },
    twitter: {
        card: "summary",
        title: `${title} | CandidAI`,
        description,
        images: ["/og-image.png"],
    },
};

export default ReferralPage;
