import type { Metadata } from "next";
import { cookies } from "next/headers";
import ContactPage from "./client";

export const metadata: Metadata = { title: "Contact Us" };

export default async function Contact({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
    const defaultSubject = (await cookies()).get("defaultSubject")?.value;
    const mode = (await searchParams).mode === "referral" ? "referral" : "contact";
    return <ContactPage defaultSubject={defaultSubject} mode={mode} />;
}
