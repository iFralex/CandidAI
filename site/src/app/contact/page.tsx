import { Metadata } from "next";
import { cookies } from "next/headers";
import ContactPage from "./client";

export const metadata: Metadata = { title: "Contact Us" };

export default async function Contact() {
    const defaultSubject = (await cookies()).get("defaultSubject")?.value;
    return <ContactPage defaultSubject={defaultSubject} />;
}
