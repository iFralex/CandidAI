"use client";

import { useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Mail, MessageSquare, Send } from "lucide-react";

const SUBJECTS = [
    { value: "Support", label: "Support" },
    { value: "Billing", label: "Billing" },
    { value: "General", label: "General" },
    { value: "Referral Program", label: "Referral Program" },
];

type ReferralApplication = {
    location: string;
    organization: string;
    role: string;
    channels: string;
    profileUrl: string;
    audienceSize: string;
    acceptsRules: boolean;
    contactConsent: boolean;
};

const EMPTY_REFERRAL_APPLICATION: ReferralApplication = {
    location: "", organization: "", role: "", channels: "", profileUrl: "",
    audienceSize: "", acceptsRules: false, contactConsent: false,
};

export default function ContactPage({ defaultSubject, mode = "contact" }: { defaultSubject?: string; mode?: "contact" | "referral" }) {
    const isReferral = mode === "referral";
    const initialSubject = isReferral
        ? "Referral Program"
        : defaultSubject && SUBJECTS.some((s) => s.value === defaultSubject) ? defaultSubject : "";
    const [form, setForm] = useState({ name: "", email: "", subject: initialSubject, message: "" });
    const [referralApplication, setReferralApplication] = useState<ReferralApplication>(EMPTY_REFERRAL_APPLICATION);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState("");

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) newErrors.name = "Name is required";
        if (!form.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = "Enter a valid email address";
        }
        if (!form.subject) newErrors.subject = "Please select a topic";
        if (!form.message.trim()) newErrors.message = "Message is required";
        if (isReferral) {
            if (!referralApplication.location.trim()) newErrors.location = "Country and city are required";
            if (!referralApplication.role) newErrors.role = "Please select your role";
            if (!referralApplication.channels.trim()) newErrors.channels = "Tell us where you could promote CandidAI";
            if (!referralApplication.audienceSize) newErrors.audienceSize = "Please select an approximate audience size";
            if (!referralApplication.acceptsRules) newErrors.acceptsRules = "You must accept the ambassador ground rules";
            if (!referralApplication.contactConsent) newErrors.contactConsent = "We need permission to contact you about your application";
        }
        return newErrors;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors = validate();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        setStatus("loading");
        setSubmitError("");

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    mode,
                    ...(isReferral ? { referralApplication } : {}),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Something went wrong");
            }

            setStatus("success");
        } catch (err: any) {
            setStatus("error");
            setSubmitError(err.message || "Failed to send message. Please try again.");
        }
    };

    return (
        <div className="dark min-h-screen bg-black text-white">
            <Navigation simple />

            {/* Background */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,theme(colors.violet.900/50%),transparent)] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

            <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16">
                <div className="w-full max-w-lg">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-6">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {isReferral ? "Ambassador Program" : "Support & Help Center"}
                        </div>
                        <h1 className="text-4xl font-bold mb-3">
                            {isReferral ? "Ambassador" : "Contact"}{" "}
                            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                                {isReferral ? "Application" : "Us"}
                            </span>
                        </h1>
                        <p className="text-gray-400 text-base">
                            {isReferral ? "Tell us how you would bring CandidAI to your community." : "We typically reply within a few hours."}
                        </p>
                    </div>

                    {/* Card */}
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/40 backdrop-blur-sm">
                        {status === "success" ? (
                            <div className="flex flex-col items-center text-center py-8 gap-4">
                                <div className="w-16 h-16 rounded-full bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                                    <CheckCircle className="w-8 h-8 text-violet-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white mb-1">{isReferral ? "Application sent!" : "Message sent!"}</h2>
                                    <p className="text-gray-400 text-sm">
                                        We'll get back to you at <span className="text-violet-300">{form.email}</span> after reviewing {isReferral ? "your application" : "your message"}.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                        setForm({ name: "", email: "", subject: initialSubject, message: "" });
                                        setReferralApplication(EMPTY_REFERRAL_APPLICATION);
                                        setStatus("idle");
                                    }}
                                >
                                    {isReferral ? "Submit another application" : "Send another message"}
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="Your name"
                                            value={form.name}
                                            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(v => ({ ...v, name: "" })); }}
                                            error={errors.name}
                                            disabled={status === "loading"}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            placeholder="you@example.com"
                                            value={form.email}
                                            onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(v => ({ ...v, email: "" })); }}
                                            error={errors.email}
                                            disabled={status === "loading"}
                                        />
                                    </div>
                                </div>

                                {!isReferral && <div className="space-y-1.5">
                                    <Label htmlFor="subject">Subject</Label>
                                    <Select
                                        value={form.subject}
                                        onValueChange={val => { setForm(f => ({ ...f, subject: val })); setErrors(v => ({ ...v, subject: "" })); }}
                                        disabled={status === "loading"}
                                    >
                                        <SelectTrigger id="subject" className="w-full">
                                            <SelectValue placeholder="Select a topic" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUBJECTS.map(s => (
                                                <SelectItem key={s.value} value={s.value}>
                                                    {s.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.subject && <p className="text-red-400 text-sm mt-1 ml-4">{errors.subject}</p>}
                                </div>}

                                {isReferral && (
                                    <div className="space-y-5 border-y border-white/10 py-5">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="location">Country and city</Label>
                                            <Input id="location" placeholder="e.g. Italy, Milan" value={referralApplication.location}
                                                onChange={e => { setReferralApplication(v => ({ ...v, location: e.target.value })); setErrors(v => ({ ...v, location: "" })); }}
                                                error={errors.location} disabled={status === "loading"} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="organization">University or organization <span className="text-gray-500">(optional)</span></Label>
                                            <Input id="organization" placeholder="University, association, or community" value={referralApplication.organization}
                                                onChange={e => setReferralApplication(v => ({ ...v, organization: e.target.value }))} disabled={status === "loading"} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="referral-role">Your role</Label>
                                            <Select value={referralApplication.role} onValueChange={value => { setReferralApplication(v => ({ ...v, role: value })); setErrors(v => ({ ...v, role: "" })); }} disabled={status === "loading"}>
                                                <SelectTrigger id="referral-role" className="w-full"><SelectValue placeholder="Select your role" /></SelectTrigger>
                                                <SelectContent>
                                                    {[["student", "Student"], ["graduate", "Recent graduate"], ["community_manager", "Community manager"], ["creator", "Content creator"], ["other", "Other"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            {errors.role && <p className="text-red-400 text-sm mt-1 ml-4">{errors.role}</p>}
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="channels">Where could you promote CandidAI?</Label>
                                            <Input id="channels" placeholder="Campus, events, community, Instagram..." value={referralApplication.channels}
                                                onChange={e => { setReferralApplication(v => ({ ...v, channels: e.target.value })); setErrors(v => ({ ...v, channels: "" })); }}
                                                error={errors.channels} disabled={status === "loading"} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="profile-url">Main profile or community URL <span className="text-gray-500">(optional)</span></Label>
                                            <Input id="profile-url" type="url" placeholder="https://..." value={referralApplication.profileUrl}
                                                onChange={e => setReferralApplication(v => ({ ...v, profileUrl: e.target.value }))} disabled={status === "loading"} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="audience-size">Approximate audience</Label>
                                            <Select value={referralApplication.audienceSize} onValueChange={value => { setReferralApplication(v => ({ ...v, audienceSize: value })); setErrors(v => ({ ...v, audienceSize: "" })); }} disabled={status === "loading"}>
                                                <SelectTrigger id="audience-size" className="w-full"><SelectValue placeholder="Select a range" /></SelectTrigger>
                                                <SelectContent>
                                                    {["Under 100", "100–500", "501–2,000", "2,001–10,000", "More than 10,000"].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            {errors.audienceSize && <p className="text-red-400 text-sm mt-1 ml-4">{errors.audienceSize}</p>}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="message">{isReferral ? "How would you promote CandidAI?" : "Message"}</Label>
                                    <Textarea
                                        id="message"
                                        placeholder={isReferral ? "Describe your idea, the audience you would reach, and why you want to join..." : "Describe your issue or question..."}
                                        rows={5}
                                        value={form.message}
                                        onChange={e => { setForm(f => ({ ...f, message: e.target.value })); setErrors(v => ({ ...v, message: "" })); }}
                                        disabled={status === "loading"}
                                        className="resize-none"
                                    />
                                    {errors.message && <p className="text-red-400 text-sm mt-1 ml-4">{errors.message}</p>}
                                </div>

                                {isReferral && (
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <Checkbox id="accepts-rules" checked={referralApplication.acceptsRules} onCheckedChange={checked => { setReferralApplication(v => ({ ...v, acceptsRules: checked === true })); setErrors(v => ({ ...v, acceptsRules: "" })); }} disabled={status === "loading"} aria-invalid={Boolean(errors.acceptsRules)} />
                                            <Label htmlFor="accepts-rules" className="block font-normal leading-relaxed">I agree to follow the Ambassador Program ground rules, including no vandalism, prohibited posting, or personal attacks, and acknowledge the <a href="/docs/ambassador-program-terms" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">Ambassador Program Terms</a>.</Label>
                                        </div>
                                        {errors.acceptsRules && <p className="text-red-400 text-sm ml-7">{errors.acceptsRules}</p>}
                                        <div className="flex items-start gap-3">
                                            <Checkbox id="contact-consent" checked={referralApplication.contactConsent} onCheckedChange={checked => { setReferralApplication(v => ({ ...v, contactConsent: checked === true })); setErrors(v => ({ ...v, contactConsent: "" })); }} disabled={status === "loading"} aria-invalid={Boolean(errors.contactConsent)} />
                                            <Label htmlFor="contact-consent" className="font-normal leading-relaxed">I agree to be contacted by CandidAI about this application and the Ambassador Program.</Label>
                                        </div>
                                        {errors.contactConsent && <p className="text-red-400 text-sm ml-7">{errors.contactConsent}</p>}
                                    </div>
                                )}

                                {status === "error" && (
                                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                                        {submitError}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="w-full"
                                    disabled={status === "loading"}
                                >
                                    {status === "loading" ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            {isReferral ? "Submit Application" : "Send Message"}
                                        </>
                                    )}
                                </Button>
                            </form>
                        )}
                    </div>

                    {/* Alt contact */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                        <Mail className="w-4 h-4" />
                        <span>Or email us directly at</span>
                        <a
                            href="mailto:hello@candidai.tech"
                            className="text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            hello@candidai.tech
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
}
